// Builds report/report.html (the hackathon project report) from the Lux3D build record and the pictures in report/img.
//   node report.mjs <live-url> <repo-url>
// Print it to PDF with Chrome:  chrome --headless --print-to-pdf=report/report.pdf report/report.html
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const [LIVE = 'https://crownfall-lux3d.vercel.app', REPO = 'https://github.com/neromtoobad/crownfall-lux3d'] = process.argv.slice(2);
const rec = JSON.parse(await readFile(path.join(ROOT, 'web/public/lux3d/kit.json'), 'utf8'));
const models = rec.models;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => Number(n).toLocaleString('en-US');
const totalSecs = models.reduce((s, m) => s + m.seconds, 0);
const rawTris = models.reduce((s, m) => s + m.rawTriangles, 0);
const fitTris = models.reduce((s, m) => s + m.triangles, 0);
const name = (id) => id.replace('props/', '').replace('-', ' ');
const pic = (id) => id.replace('/', '-');

const rows = models.map((m) => `
  <tr>
    <td><b>${esc(name(m.id))}</b><br><span class="soft">${esc(m.what)}</span></td>
    <td class="mono">#${m.taskId}</td>
    <td class="mono">${m.seconds}s</td>
    <td class="mono">${num(m.rawTriangles)} &rarr; ${num(m.triangles)}</td>
    <td class="mono">${(m.rawBytes / 1e6).toFixed(1)} MB &rarr; ${Math.round(m.bytes / 1e3)} KB</td>
  </tr>`).join('');

const pairs = models.map((m) => `
  <div class="pair">
    <h3>${esc(name(m.id))} <span class="soft">· ${esc(m.what)}</span></h3>
    <div class="two">
      <figure><img src="img/before-${pic(m.id)}.jpg"><figcaption>Before: the model it replaced</figcaption></figure>
      <figure><img src="img/after-${pic(m.id)}.jpg"><figcaption>After: Lux3D ${esc(m.request.version)}, task #${m.taskId}</figcaption></figure>
    </div>
    <blockquote>${esc(m.request.prompt)}</blockquote>
  </div>`).join('');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Crownfall, rebuilt with Aholo Lux3D: project report</title>
<style>
  @page { size: A4; margin: 16mm 15mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1d1a16; font: 10.6pt/1.5 -apple-system, 'Helvetica Neue', Arial, sans-serif; }
  h1 { font: 700 30pt/1.08 Georgia, 'Times New Roman', serif; margin: 0 0 8pt; letter-spacing: -0.01em; }
  h2 { font: 700 17pt/1.2 Georgia, serif; margin: 0 0 8pt; padding-top: 4pt; border-top: 2pt solid #b88a3b; }
  h3 { font: 700 11.5pt/1.3 Georgia, serif; margin: 0 0 4pt; }
  p { margin: 0 0 7pt; }
  ul, ol { margin: 0 0 7pt; padding-left: 16pt; }
  li { margin-bottom: 3pt; }
  .lead { font-size: 13pt; line-height: 1.45; }
  .soft { color: #6f6557; font-weight: 400; }
  .mono { font: 8.6pt/1.4 ui-monospace, Menlo, Consolas, monospace; white-space: nowrap; }
  code { font: 9pt ui-monospace, Menlo, Consolas, monospace; background: #f1ebdf; padding: 0 3pt; border-radius: 2pt; }
  a { color: #7a5514; }
  section { break-before: page; }
  section.first { break-before: auto; }
  img { width: 100%; display: block; border-radius: 3pt; border: 0.5pt solid #cfc4b0; background: #2a241e; }
  figure { margin: 0; }
  figcaption { font-size: 8.4pt; color: #6f6557; margin-top: 3pt; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt; }
  .pair { break-inside: avoid; margin-bottom: 12pt; }
  blockquote { margin: 5pt 0 0; padding: 4pt 8pt; border-left: 2.5pt solid #b88a3b; background: #f7f2e8; font: italic 9.6pt/1.45 Georgia, serif; }
  table { width: 100%; border-collapse: collapse; margin: 4pt 0 9pt; }
  th { text-align: left; font-size: 8.6pt; color: #6f6557; font-weight: 600; border-bottom: 1pt solid #b9ad97; padding: 3pt 6pt 3pt 0; }
  td { vertical-align: top; border-bottom: 0.5pt solid #ddd3c1; padding: 5pt 6pt 5pt 0; }
  .facts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8pt; margin: 10pt 0; }
  .fact { border: 0.5pt solid #cfc4b0; border-radius: 4pt; padding: 7pt 9pt; background: #faf6ee; }
  .fact b { display: block; font: 700 17pt/1.1 Georgia, serif; color: #7a5514; }
  .fact span { font-size: 8.4pt; color: #6f6557; }
  .links { margin: 10pt 0; padding: 8pt 10pt; background: #f7f2e8; border-radius: 4pt; }
  .links div { margin: 1pt 0; }
  .note { break-inside: avoid; margin-bottom: 10pt; }
</style></head><body>

<section class="first">
  <p class="soft">Manycore Aholo Global 3D AI Hackathon · project report · 19 November 2026 · team of one (neromtoobad)</p>
  <h1>Crownfall, rebuilt with Aholo Lux3D</h1>
  <p class="lead">A playable 3D medieval realm in the browser. Every castle, wall, tower, house and hall in it is placed from six 3D models, and all six were generated from text with the Lux3D API.</p>
  <img src="img/realm-after.jpg">
  <figcaption>The realm of Vael as it runs today. Every building in this picture is a Lux3D generation.</figcaption>
  <div class="links">
    <div><b>Play it:</b> <a href="${LIVE}">${LIVE}</a> (no sign-in, runs in the browser)</div>
    <div><b>Prompts and task numbers:</b> <a href="${LIVE}/lux3d/index.html">${LIVE}/lux3d/index.html</a></div>
    <div><b>Source code:</b> <a href="${REPO}">${REPO}</a></div>
  </div>
  <div class="facts">
    <div class="fact"><b>${models.length}</b><span>kit models, each one Lux3D text-to-3D task</span></div>
    <div class="fact"><b>${Math.round(totalSecs / 60)} min</b><span>total generation time, one task at a time</span></div>
    <div class="fact"><b>${num(rawTris)}</b><span>triangles as generated</span></div>
    <div class="fact"><b>${num(fitTris)}</b><span>triangles after fitting for the realm</span></div>
  </div>
  <h3>Try it in two minutes</h3>
  <ol>
    <li>Open the demo. The whole realm loads: eight castles, a walled capital, villages, a hippodrome with a race running.</li>
    <li>Click <b>Show the original models</b> in the header. The same realm reloads with the models Lux3D replaced, so you can compare the two worlds directly. Click again to return.</li>
    <li>Click <b>Take your seat</b>, pick a lord and a house, and walk or drive a chariot through a Lux3D town (W A S D).</li>
    <li>Click <b>World rebuilt with Aholo Lux3D</b> for each model's exact prompt and Lux3D task number.</li>
  </ol>
</section>

<section>
  <h2>1. The idea</h2>
  <p>Most text-to-3D showcases are single objects on a turntable. We wanted to know whether Lux3D is good enough to be the <b>only source of architecture in a real, playable game world</b>.</p>
  <p>Crownfall made that a clean test. The realm's layout is code: it decides where every wall segment, tower and house goes, and stretches one model into each slot. So the built world is defined by just six models. That means <b>the look of the whole realm is six sentences of text</b>. Change the sentences, run Lux3D, and hundreds of buildings change, without touching the layout or the game.</p>
  <p>Why it is worth trying: this is the workflow a small team would actually use. Write the art direction once as prompts, generate a kit, drop it into a working game. The header switch shows the result honestly, because the old models are still one click away.</p>

  <h2>2. How it was built</h2>
  <ol>
    <li><b>One prompt per kit model.</b> The prompts are in <code>tools/lux3d/kit.json</code>. They share one art direction: pale limestone, terracotta roofs, timber frames, thatch.</li>
    <li><b>Lux3D text-to-3D through the API.</b> <code>tools/lux3d/kit.mjs</code> calls <code>POST /lux3d/v1/generate/text-to-3d/task/create</code> (model ${esc(models[0]?.request.version || 'G1-Turbo')}, GLB output), polls <code>GET /lux3d/v1/generate/task/get</code>, and downloads the result. Lux3D runs one generation at a time per account, so the script is a serial queue that waits for the slot.</li>
    <li><b>Fit for the realm.</b> The same script joins each model into one mesh, keeps its base colour texture, brings it to a common size, simplifies it to a triangle budget, converts the texture to WebP and compresses the mesh. Each model is drawn hundreds of times, so this step matters.</li>
    <li><b>Placed by the game.</b> <code>web/src/realm/Props.tsx</code> draws each model as one instanced mesh, stretched into every slot the layout asks for. <code>web/src/realm/kit.ts</code> chooses between the Lux3D set and the original set.</li>
  </ol>
  <table>
    <tr><th>Model and where it is used</th><th>Lux3D task</th><th>Time</th><th>Triangles (generated &rarr; in the realm)</th><th>File size</th></tr>
    ${rows}
  </table>
  <p class="soft">These numbers are written by the script while it runs (<code>web/public/lux3d/kit.json</code>), not typed by hand.</p>
</section>

<section>
  <h2>3. Asset comparisons: before and after</h2>
  <p class="soft">Left: the model Crownfall used before. Right: the Lux3D model that replaced it, after fitting. Below each pair: the exact prompt.</p>
  ${pairs}
</section>

<section>
  <h2>4. The realm, before and after</h2>
  <div class="two">
    <figure><img src="img/realm-before.jpg"><figcaption>Before: original models</figcaption></figure>
    <figure><img src="img/realm-after.jpg"><figcaption>After: Lux3D models, same layout and camera</figcaption></figure>
  </div>
  <p></p>
  <div class="two">
    <figure><img src="img/play-1.jpg"><figcaption>On foot in a Lux3D town</figcaption></figure>
    <figure><img src="img/play-2.jpg"><figcaption>Arriving in the capital, walls and towers behind</figcaption></figure>
  </div>

  <h2 style="margin-top:14pt">5. What went wrong, and what we changed</h2>
  <div class="two">
    <div class="note">
      <h3>Forcing a triangle budget smeared the textures</h3>
      <p>The keep came back with ${num(models.find((m) => m.id === 'keep')?.rawTriangles || 0)} triangles and edge-collapse simplification stopped at about half. We tried snapping vertices to a grid to force it lower. It hit the budget and wrecked the texture mapping (right). We threw that step away, kept the clean result, and gave the keep a larger budget, since only eight are drawn.</p>
    </div>
    <figure><img src="img/iteration-keep-grid.jpg"><figcaption>Rejected: grid simplification of the Lux3D keep</figcaption></figure>
  </div>
  <div class="two" style="margin-top:8pt">
    <div class="note">
      <h3>Real-world scale broke the walls</h3>
      <p>Lux3D predicts real sizes: the wall segment came back 12 units long. The realm bakes each model's transform into compressed positions that only hold values from -1 to 1, so the first walls rendered as grey shards across the sky (right, behind the houses). The fix is in the fitting step: every model is brought to one small size before compression.</p>
    </div>
    <figure><img src="img/iteration-wall-clipped.jpg"><figcaption>First try in the game: clipped Lux3D walls in the background</figcaption></figure>
  </div>
</section>

<section>
  <h2>6. What is Lux3D here, and what is not</h2>
  <ul>
    <li><b>Lux3D:</b> the keep of every house, every wall tower and gatehouse, every stretch of wall, every cottage and townhouse, and the hall of the Ashen Throne. All six are text-to-3D with no reference image and no manual modelling. The market barrels, crates, wells and hay bales are Lux3D too.</li>
    <li><b>Not Lux3D:</b> the land, water and trees (procedural geometry), the lords, peasants, soldiers and horses (rigged characters made earlier with other tools), the throne, the chariot, the market stalls, signposts and rookery, the carts (modelled in Blender), and the game code.</li>
    <li><b>Prior work:</b> Crownfall the game was first built from 8 to 15 November 2026 for a different hackathon, as a blockchain game. What was made for this event: the 10 Lux3D models, the generation and fitting script, the model switch, the "how it was built" page and this report. The blockchain parts are switched off in this copy; the purse and seals stay in the browser.</li>
    <li><b>Limits we know about:</b> the fitted cottage, keep and hall are heavier than the models they replaced, so the Lux3D realm draws more triangles than the original. Lux3D's texture detail is reduced to 512 px on the small models to keep the download light.</li>
  </ul>
  <h2>7. Manycore tools used</h2>
  <ul>
    <li><b>Aholo Lux3D</b> (required): text-to-3D, model ${esc(models[0]?.request.version || 'G1-Turbo')}, style "${esc(models[0]?.request.style || 'photorealistic')}", through the Aholo API at <code>api.aholo.ai</code>.</li>
    <li><b>Aholo API</b>: task create, task query and result download, automated in one script that anyone with a key can re-run: <code>cd tools/lux3d && npm install && node kit.mjs</code>.</li>
  </ul>
  <h2>8. What we would do next</h2>
  <ul>
    <li><b>Theme packs.</b> A second <code>kit.json</code> (a desert kingdom, a frozen north) would rebuild the realm again in about ${Math.round(totalSecs / 60)} minutes of generation. The game already loads its buildings from a named set, so a second set is a small change.</li>
    <li><b>Lux3D part-splitting</b> for walls and gates that can be broken in a siege, and <b>auto-rigging</b> to bring the characters into the same pipeline.</li>
  </ul>
</section>
</body></html>
`;
await writeFile(path.join(ROOT, 'report/report.html'), html);
console.log(`report/report.html written (${models.length} models)`);
