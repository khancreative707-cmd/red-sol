// Seeded RNG (mulberry32). State lives in obj.rng (an integer) so it serializes with the game state.
export function rnd(o) {
  o.rng = (o.rng + 0x6D2B79F5) | 0;
  let t = o.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rndInt = (o, n) => Math.floor(rnd(o) * n);
export const rndRange = (o, a, b) => a + rnd(o) * (b - a);
export function pick(o, arr) { return arr[rndInt(o, arr.length)]; }
export function shuffle(o, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rndInt(o, i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
export function seedState(seed) {
  let x = (Math.imul((seed | 0) + 101, 2654435761) ^ 0x9E3779B9) | 0;
  return x;
}
