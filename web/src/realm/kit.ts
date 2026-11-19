// The building models the realm is built from. The Lux3D set (public/env/lux3d) was generated with Aholo Lux3D
// by tools/lux3d/kit.mjs, which also writes lux3dKit.json: the models it has finished.
import DONE from './lux3dKit.json';

const done = new Set(DONE as string[]);
/** How many of the kit models are Lux3D generations. */
export const LUX3D_COUNT = done.size;
/** The file for one model: from the Lux3D set when it has been generated. */
export const kitUrl = (name: string) => (done.has(name) ? `/env/lux3d/${name}.glb` : `/env/${name}.glb`);
/** Whether this model is drawn from the Lux3D set. */
export const isLux3d = (name: string) => done.has(name);
