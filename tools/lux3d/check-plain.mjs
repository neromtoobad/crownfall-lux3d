// Prints the raw vertex range of a fitted prop, to confirm its size and upright axis are baked into the vertices.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const file of process.argv.slice(2)) {
  const d = await io.read(file);
  for (const m of d.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
    const a = p.getAttribute('POSITION');
    console.log(file.split('/').pop(), a.getArray().constructor.name, 'min', a.getMin([]).map((v) => +v.toFixed(2)), 'max', a.getMax([]).map((v) => +v.toFixed(2)));
  }
  for (const n of d.getRoot().listNodes()) console.log('  node scale', n.getScale().map((v) => +v.toFixed(3)), 'rotation', n.getRotation().map((v) => +v.toFixed(3)));
}
