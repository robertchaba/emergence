import test from 'node:test';
import assert from 'node:assert/strict';
import { speciesName } from '../../src/simulation/life/v1/names.js';

test('seeded species names remain unique as their vocabulary expands beyond three syllables', () => {
  const names = new Set();
  for (let ordinal = 1; ordinal <= 100000; ordinal += 1) {
    const name = speciesName('many-species', ordinal);
    assert.match(name, /^[A-Z][a-z]+ [a-z]+$/);
    assert.equal(names.has(name), false, `duplicate at ${ordinal}`);
    names.add(name);
  }
  assert.equal(speciesName('many-species', 32768), speciesName('many-species', 32768));
  assert.notEqual(speciesName('many-species', 1), speciesName('another-world', 1));
  assert.notEqual(speciesName('many-species', 32n ** 20n), speciesName('many-species', 32n ** 20n + 1n));
});
