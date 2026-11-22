// Seeded RNG (mulberry32) so staged screenshots and replays are
// deterministic: the same seed always deals the same patrol offsets and
// sparkle phases. The game itself needs no randomness for its rules.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function parseSeed(query) {
  const raw = new URLSearchParams(query).get('seed');
  const n = raw === null ? 1 : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 1;
}
