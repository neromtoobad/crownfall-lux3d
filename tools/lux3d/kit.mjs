// Rebuilds Crownfall's building and tree kit with Aholo Lux3D text-to-3D.
//
//   node kit.mjs              generate every kit model that is not done yet
//   node kit.mjs keep wall    generate these again
//   node kit.mjs --fit keep   only re-run the fitting step on an already downloaded model
//
// For each model: create a Lux3D task -> poll -> download the GLB -> fit it for the realm
// (one mesh, base colour only, simplified to the realm's triangle budget, WebP texture,
// meshopt compression) -> write web/public/env/lux3d/<id>.glb, which the game instances
// hundreds of times (web/src/realm/Props.tsx). The models they replace stay in web/public/env,
// so the game can show either set (?kit=original).
// Lux3D runs one generation at a time per account, so this is a serial loop.
// API reference: https://labs.aholo.ai/api-docs/en/api-reference#tag/lux3d
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { flatten, join, weld, simplify, prune, dedup, textureCompress, meshopt, getBounds, clearNodeTransform } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const API = process.env.LUX3D_BASE_URL || 'https://api.aholo.ai/global';
const VERSION = process.env.LUX3D_VERSION || 'G1-Turbo';
const ENV_DIR = path.join(ROOT, 'web/public/env/lux3d');
const DONE_LIST = path.join(ROOT, 'web/src/realm/lux3dKit.json');
const RECORD = path.join(ROOT, 'web/public/lux3d/kit.json');
const RAW = path.join(HERE, 'raw');

async function loadKey() {
  if (process.env.AHOLO_API_KEY) return process.env.AHOLO_API_KEY.trim();
  for (const file of [path.join(ROOT, '.env'), path.join(HERE, '.env'), path.resolve(ROOT, '../aholo/.env')]) {
    const env = await readFile(file, 'utf8').catch(() => '');
    const m = env.match(/^AHOLO_API_KEY=(.+)$/m);
    if (m && m[1].trim()) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('No API key. Put AHOLO_API_KEY=... in .env (key from https://labs.aholo.ai/api-keys)');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = async (file, fallback) => (existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : fallback);

async function api(key, method, route, body) {
  const res = await fetch(API + route, {
    method,
    headers: { Authorization: key, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    return { http: res.status, json: JSON.parse(text) };
  } catch {
    throw new Error(`${method} ${route} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
}

async function createTask(key, item) {
  const request = { prompt: item.prompt, style: item.style, version: item.version || VERSION, faceCount: item.faceCount, outputFormat: ['glb'] };
  for (let attempt = 0; attempt < 90; attempt++) {
    const { http, json } = await api(key, 'POST', '/lux3d/v1/generate/text-to-3d/task/create', request);
    if (json.c === '0' && json.d) return { taskId: json.d, request };
    if (json.c === 'GENERATION_CONCURRENCY_LIMIT_EXCEEDED') {
      await sleep(8000);
      continue;
    }
    throw new Error(`create failed (HTTP ${http}): ${JSON.stringify(json).slice(0, 400)}`);
  }
  throw new Error('gave up waiting for the generation slot');
}

async function waitForTask(key, taskId) {
  const started = Date.now();
  for (;;) {
    await sleep(4000);
    const { json } = await api(key, 'GET', `/lux3d/v1/generate/task/get?taskid=${taskId}`);
    const d = json.d || {};
    const secs = Math.round((Date.now() - started) / 1000);
    if (d.status === 3) return d;
    if (d.status === 4 || d.status === 6) throw new Error(`task ${taskId} ended with status ${d.status}: ${JSON.stringify(d).slice(0, 400)}`);
    if (secs % 20 < 4) console.log(`   status ${d.status ?? '?'} after ${secs}s`);
    if (secs > 900) throw new Error(`task ${taskId} still running after 15 minutes`);
  }
}

function pickGlbUrl(task) {
  const urls = (task.outputs || []).map((o) => o.content).filter((c) => typeof c === 'string' && c.startsWith('http'));
  return urls.find((u) => /\.glb(\?|$)/i.test(u)) || urls.find((u) => /glb/i.test(u)) || null;
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  return (await stat(file)).size;
}

let ioPromise;
function getIo() {
  ioPromise ||= (async () =>
    new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    }))();
  return ioPromise;
}

function countTriangles(doc) {
  let n = 0;
  let prims = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      prims += 1;
      const idx = prim.getIndices();
      n += (idx ? idx.getCount() : prim.getAttribute('POSITION').getCount()) / 3;
    }
  }
  return { triangles: Math.round(n), primitives: prims };
}

const boxSize = (doc) => {
  const b = getBounds(doc.getRoot().listScenes()[0]);
  return [0, 1, 2].map((i) => +(b.max[i] - b.min[i]).toFixed(3));
};

// Fits a raw Lux3D GLB to what the realm needs and writes it to outFile.
async function fit(rawFile, outFile, item) {
  await MeshoptSimplifier.ready;
  await MeshoptEncoder.ready;
  const io = await getIo();
  const doc = await io.read(rawFile);
  const before = countTriangles(doc);

  // The realm lights every building the same way: keep the base colour map only.
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null).setEmissiveTexture(null);
    mat.setMetallicFactor(0).setRoughnessFactor(0.9).setEmissiveFactor([0, 0, 0]);
  }
  // Lux3D returns models at their predicted real-world size (a wall segment comes back 12 units long). The realm
  // stretches every model into its slot anyway, and it bakes the model's transform into quantized positions, which
  // only hold values from -1 to 1. So bring every model to the same small size, centred on the origin.
  // An optional turn is for a model that came out facing the wrong way for its slot.
  {
    const scene = doc.getRoot().listScenes()[0];
    const b = getBounds(scene);
    const k = 1.8 / Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2], 1e-6);
    const c = [0, 1, 2].map((i) => (b.max[i] + b.min[i]) / 2);
    const half = ((item.turn || 0) * Math.PI) / 360;
    const scaleNode = doc.createNode('fit').setScale([k, k, k]).setTranslation([-c[0] * k, -c[1] * k, -c[2] * k]);
    for (const child of scene.listChildren()) scaleNode.addChild(child);
    const turnNode = doc.createNode('turn').setRotation([0, Math.sin(half), 0, Math.cos(half)]);
    turnNode.addChild(scaleNode);
    scene.addChild(turnNode);
  }

  const ratio = Math.min(1, item.tris / Math.max(1, before.triangles));
  await doc.transform(
    flatten(),
    join(),
    weld(),
    // Each model is drawn hundreds of times, so simplify hard. Edge collapse keeps the UVs intact; very dense
    // models stop at about half their triangles, which is fine for the few-of-a-kind keep and hall.
    simplify({ simplifier: MeshoptSimplifier, ratio, error: Number(process.env.SIMPLIFY_ERROR || 1), lockBorder: false }),
    prune(),
    dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [item.tex, item.tex], quality: 82 }),
  );
  // The small props stay uncompressed: the game moves and scales their vertices directly (the loose barrels and
  // crates tumble), and compressed positions cannot hold values outside -1 to 1.
  // Their size and turn are baked into the vertices for the same reason.
  if (item.plain) for (const node of doc.getRoot().listNodes()) if (node.getMesh()) clearNodeTransform(node);
  else await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(outFile, doc);
  const after = countTriangles(doc);
  return { before, after, size: boxSize(doc), bytes: (await stat(outFile)).size };
}

async function main() {
  const args = process.argv.slice(2);
  // --fit re-fits a downloaded model; --dry fits into raw/ without touching the game or the record.
  const dry = args[0] === '--dry';
  const fitOnly = args[0] === '--fit' || dry;
  const only = fitOnly ? args.slice(1) : args;
  const { kit } = JSON.parse(await readFile(path.join(HERE, 'kit.json'), 'utf8'));
  await mkdir(RAW, { recursive: true });
  await mkdir(path.dirname(RECORD), { recursive: true });
  await mkdir(ENV_DIR, { recursive: true });
  const record = await readJson(RECORD, { generator: 'Aholo Lux3D text-to-3D', api: API, models: [] });
  const key = fitOnly ? null : await loadKey();

  for (const item of kit) {
    const have = record.models.find((m) => m.id === item.id);
    if (only.length ? !only.includes(item.id) : have) continue;
    const rawFile = path.join(RAW, `${item.id.replace('/', '-')}.glb`);
    const outFile = path.join(ENV_DIR, `${item.id}.glb`);
    await mkdir(path.dirname(outFile), { recursive: true });

    let entry = have;
    if (!fitOnly) {
      console.log(`\n${item.id}: "${item.prompt}"`);
      const t0 = Date.now();
      const { taskId, request } = await createTask(key, item);
      console.log(`   task ${taskId} created (${request.version})`);
      const task = await waitForTask(key, taskId);
      const seconds = Math.round((Date.now() - t0) / 1000);
      const url = pickGlbUrl(task);
      if (!url) throw new Error(`task ${taskId} succeeded but returned no GLB url: ${JSON.stringify(task).slice(0, 400)}`);
      const rawBytes = await download(url, rawFile);
      console.log(`   generated in ${seconds}s, ${(rawBytes / 1e6).toFixed(1)} MB`);
      entry = { id: item.id, what: item.what, taskId, request, seconds, rawBytes, finishedAt: new Date().toISOString() };
    }
    if (!entry && !dry) throw new Error(`${item.id} has not been generated yet`);

    const fitted = await fit(rawFile, dry ? path.join(RAW, `dry-${item.id.replace('/', '-')}.glb`) : outFile, item);
    console.log(`   fitted: ${fitted.before.triangles} -> ${fitted.after.triangles} triangles, ${fitted.after.primitives} primitive(s), box ${fitted.size.join(' x ')}, ${(fitted.bytes / 1e3).toFixed(0)} KB`);
    if (dry) continue;
    Object.assign(entry, {
      rawTriangles: fitted.before.triangles,
      triangles: fitted.after.triangles,
      primitives: fitted.after.primitives,
      box: fitted.size,
      bytes: fitted.bytes,
      turn: item.turn || 0,
    });
    record.models = record.models.filter((m) => m.id !== item.id).concat(entry);
    record.models.sort((a, b) => kit.findIndex((k) => k.id === a.id) - kit.findIndex((k) => k.id === b.id));
    await writeFile(RECORD, JSON.stringify(record, null, 2) + '\n');
    // The game reads this list to know which models to take from the Lux3D set.
    await writeFile(DONE_LIST, JSON.stringify(record.models.map((m) => m.id)) + '\n');
  }
  console.log(`\n${record.models.length} of ${kit.length} kit models are Lux3D`);
}

main().catch((err) => {
  console.error('\n' + (err.stack || err.message));
  process.exit(1);
});
