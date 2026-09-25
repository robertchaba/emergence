import { coordinateHash, hashSeed } from '../../noise.js';

const rotate = (value, shift) => (value << shift | value >>> (32 - shift)) >>> 0;

/** Model-local Xoshiro128** stream with its complete continuation state. */
export function createRandom(seed, savedState) {
  let state = savedState ? [...savedState] : Array.from({ length: 4 }, (_, index) =>
    coordinateHash(hashSeed(seed), index, 931, 37));
  if (state.length !== 4 || state.some(value => !Number.isInteger(value) || value < 0 || value > 0xffffffff)
    || !state.some(Boolean)) throw new TypeError('Invalid V4 random state.');
  return {
    next() {
      const result = Math.imul(rotate(Math.imul(state[1], 5), 7), 9) >>> 0;
      const shift = state[1] << 9;
      state[2] ^= state[0]; state[3] ^= state[1]; state[1] ^= state[2]; state[0] ^= state[3];
      state[2] ^= shift; state[3] = rotate(state[3], 11);
      state = state.map(word => word >>> 0);
      return (result + 0.5) / 4294967296;
    },
    exportState: () => [...state],
  };
}

/** Unbiased stochastic rounding, a bounded-work population approximation.
 * This deliberately does not reproduce individual Bernoulli variance. */
export function roundedExpectation(expectation, random) {
  const bounded = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, expectation));
  const whole = Math.floor(bounded);
  return whole + (random() < bounded - whole ? 1 : 0);
}
