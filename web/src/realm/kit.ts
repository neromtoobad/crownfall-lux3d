// Which set of building models the realm is built from. The Lux3D set (public/env/lux3d) was generated with Aholo Lux3D
// by tools/lux3d/kit.mjs, which also writes lux3dKit.json: the models it has finished. ?kit=original shows the models
// they replaced, so the two can be compared in the same realm.
import DONE from './lux3dKit.json';

export type Kit = 'lux3d' | 'original';
export const KIT: Kit = new URLSearchParams(location.search).get('kit') === 'original' ? 'original' : 'lux3d';
const done = new Set(DONE as string[]);
/** How many of the kit models are Lux3D generations. */
export const LUX3D_COUNT = done.size;
/** The file for one model: from the Lux3D set when it has been generated and that set is showing. */
export const kitUrl = (name: string) => (KIT === 'lux3d' && done.has(name) ? `/env/lux3d/${name}.glb` : `/env/${name}.glb`);
/** Whether this model is being drawn from the Lux3D set right now. */
export const isLux3d = (name: string) => KIT === 'lux3d' && done.has(name);
/** Reloads the realm with the other set of models. */
export function switchKit(to: Kit) {
  const u = new URL(location.href);
  if (to === 'original') u.searchParams.set('kit', 'original');
  else u.searchParams.delete('kit');
  location.href = u.toString();
}
