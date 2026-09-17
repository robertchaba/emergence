import { coordinateHash, hashSeed } from '../../noise.js';

const rotate = (value, shift) => (value << shift | value >>> (32 - shift)) >>> 0;

/** Xoshiro128**: complete stream state is four uint32 words, never a browser clock. */
export function createRandom(seed, savedState) {
  let state = savedState ? [...savedState] : Array.from({ length: 4 }, (_, index) =>
    coordinateHash(hashSeed(seed), index, 713, 19));
  if (state.length !== 4 || state.some((value) => !Number.isInteger(value) || value < 0 || value > 0xffffffff)
    || !state.some(Boolean)) throw new TypeError('Invalid xoshiro128** state.');
  function next() {
    const result = Math.imul(rotate(Math.imul(state[1], 5), 7), 9) >>> 0;
    const shift = state[1] << 9;
    state[2] ^= state[0]; state[3] ^= state[1]; state[1] ^= state[2]; state[0] ^= state[3];
    state[2] ^= shift; state[3] = rotate(state[3], 11);
    state = state.map((word) => word >>> 0);
    // Open interval avoids log(0) in geometric waiting times.
    return (result + 0.5) / 4294967296;
  }
  return { next, exportState: () => [...state] };
}

/** Count independent Bernoulli successes via exact geometric waiting times.
 * Work scales with the rarer outcome, not total cohort population. */
export function binomial(count, probability, random) {
  if (count <= 0 || probability <= 0) return 0;
  if (probability >= 1) return count;
  const complement = probability > 0.5;
  const chance = complement ? 1 - probability : probability;
  const logarithm = Math.log1p(-chance);
  let position = 0;
  let successes = 0;
  while (true) {
    position += Math.floor(Math.log(random()) / logarithm) + 1;
    if (position > count) break;
    successes += 1;
  }
  return complement ? count - successes : successes;
}

export function uniformPartitions(count, choices, random) {
  const result = [];
  for (let index = 0; index < choices; index += 1) {
    const part = index === choices - 1 ? count : binomial(count, 1 / (choices - index), random);
    result.push(part);
    count -= part;
  }
  return result;
}
