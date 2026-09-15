/** Stateless integer hashing: no clock, shared stream or browser state. */
export function hashSeed(seed) {
  let hash = 2166136261;
  for (const character of String(seed)) {
    hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  }
  return hash >>> 0;
}

export function coordinateHash(seed, x, y, salt = 0) {
  let hash = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt, 1274126177);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  hash = Math.imul(hash ^ (hash >>> 16), 2246822519);
  return (hash ^ (hash >>> 13)) >>> 0;
}

const fade = (value) => value * value * value * (value * (value * 6 - 15) + 10);
const mix = (a, b, fraction) => a + (b - a) * fraction;

/** Value noise with a precisely integer longitudinal period. */
export function periodicNoise(seed, longitude, latitude, frequency, salt = 0) {
  const x = longitude * frequency;
  const y = latitude * frequency * (2 / 3);
  const column = Math.floor(x);
  const row = Math.floor(y);
  const wrap = (value) => ((value % frequency) + frequency) % frequency;
  const sample = (dx, dy) => coordinateHash(seed, wrap(column + dx), row + dy, salt) / 4294967295 * 2 - 1;
  return mix(
    mix(sample(0, 0), sample(1, 0), fade(x - column)),
    mix(sample(0, 1), sample(1, 1), fade(x - column)),
    fade(y - row),
  );
}

/** Five correlated octaves; attenuate details below the tiny grid's resolution. */
export function elevationNoise(seed, longitude, latitude, geography, width) {
  let elevation = 0;
  let weightSum = 0;
  for (let octave = 0; octave < 5; octave += 1) {
    const frequency = (4 + 6 * geography) * 2 ** octave;
    const lower = Math.floor(frequency);
    const blend = frequency - lower;
    const value = mix(
      periodicNoise(seed, longitude, latitude, lower, octave),
      periodicNoise(seed, longitude, latitude, lower + 1, octave),
      blend,
    );
    const weight = 0.36 ** octave * Math.min(1, width / (3 * frequency));
    elevation += value * weight;
    weightSum += weight;
  }
  const polarTaper = 0.65 * Math.abs(2 * latitude - 1) ** 6;
  return elevation / weightSum - polarTaper;
}
