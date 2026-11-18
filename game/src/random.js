// A small seeded generator (mulberry32): the same seed rebuilds the same
// city, traffic and staged screenshots, so a shot is repeatable.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, low, high) {
  return low + rng() * (high - low);
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

export function chance(rng, p) {
  return rng() < p;
}

// A deterministic hash of a short string, for per-block variety that does
// not depend on call order.
export function hashStr(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}
