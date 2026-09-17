import assert from 'node:assert/strict';
import test from 'node:test';
import { compactVariants, VARIANT_RULES } from '../../src/simulation/life/v2/compaction.js';
import { founderGenome, deriveGenome, validateGenome } from '../../src/simulation/life/v2/genes/genome.js';
import { acquisitionSignature } from '../../src/simulation/life/v2/classification.js';

const genome = (changes = {}) => ({ ...founderGenome(), ...changes });
const records = (entries) => new Map(entries.map(([id, value], index) => [id,
  { genome: value, establishedOrder: index + 1 }]));
const cohort = (genomeId, count, changes = {}) => ({ speciesId: 'species-1', hexId: 0,
  habitat: 'water', genomeId, count, energy: 0.5, groupId: `source-${genomeId}`, ...changes });
const total = (cohorts) => cohorts.reduce((sum, row) => sum + row.count, 0);
const ids = (cohorts) => new Set(cohorts.map((row) => row.genomeId));
const sorted = (cohorts) => [...cohorts].sort((a, b) => a.groupId.localeCompare(b.groupId));

test('v2 compaction leaves populations with at most three real genomes unchanged', () => {
  const genomes = records([['a', genome()], ['b', genome({ poison: 1 })], ['c', genome({ spines: 1 })]]);
  const cohorts = [cohort('a', 100), cohort('a', 15, { energy: 0.25, groupId: 'split-a' }),
    cohort('b', 2), cohort('c', 1)];
  const before = structuredClone(cohorts);
  const beforeGenomes = structuredClone([...genomes]);
  for (const row of cohorts) Object.freeze(row);
  Object.freeze(cohorts);
  const result = compactVariants(cohorts, genomes, { seed: 'already-compact' });
  assert.deepEqual(result.cohorts, before);
  assert.equal(result.reassignedPopulation, 0);
  assert.equal(result.reassignedCohorts, 0);
  assert.deepEqual([...genomes], beforeGenomes);
  assert.equal(VARIANT_RULES.maximumPerPool, 3);
  assert.equal(VARIANT_RULES.protectedAbundant, 2);
});

test('v2 compaction preserves population, abundant competitors and complete living genomes', () => {
  const genomes = records([['a', genome()], ['b', genome({ poison: 3, spines: 3, detoxification: 3 })],
    ['c', genome({ poison: 1 })], ['d', genome({ spines: 1 })]]);
  const cohorts = [cohort('a', 50), cohort('a', 50, { groupId: 'split-a', energy: 0.25 }),
    cohort('b', 90), cohort('c', 2), cohort('d', 1)];
  const before = structuredClone(cohorts);
  const beforeGenomes = structuredClone([...genomes]);
  const result = compactVariants(cohorts, genomes, { seed: 'compact-neighbors' });
  const retained = ids(result.cohorts);
  assert.equal(retained.size, 3);
  assert.ok(retained.has('a') && retained.has('b'), 'abundance is counted across energy and group records');
  assert.equal(total(result.cohorts), total(cohorts));
  assert.ok([...retained].every((id) => genomes.has(id) && validateGenome(genomes.get(id).genome)));
  const reassigned = result.cohorts.filter((row) => row.genomeId !== cohorts.find((old) => old.groupId === row.groupId).genomeId);
  assert.equal(reassigned.length, 1);
  assert.equal(reassigned[0].genomeId, 'a', 'excess carriers join their nearest surviving real genome');
  assert.equal(result.reassignedPopulation, total(reassigned));
  assert.equal(result.reassignedCohorts, reassigned.length);
  assert.deepEqual(cohorts, before);
  assert.deepEqual([...genomes], beforeGenomes);
  const repeated = compactVariants(result.cohorts, genomes, { seed: 'compact-neighbors' });
  assert.deepEqual(repeated.cohorts, result.cohorts);
  assert.equal(repeated.reassignedPopulation, 0);
});

test('v2 compaction never mixes species, places, habitats, feeding niches or pending passages', () => {
  const transit = { hexId: 2, habitat: 'land', dueTurn: 70, probability: 0.2 };
  const contexts = [{}, { speciesId: 'species-2' }, { hexId: 1 }, { habitat: 'land' },
    { niche: 'grazer' }, { transit }, { transit: { ...transit, hexId: 3 } },
    { transit: { ...transit, dueTurn: 71 } }, { transit: { ...transit, probability: 0.3 } },
    { transit: { ...transit, habitat: 'water' } }];
  const genomes = new Map();
  const cohorts = contexts.flatMap(({ niche, ...context }, pool) => [100, 50, 10, 1].map((count, variant) => {
    const id = `pool-${pool}-variant-${variant}`;
    const value = genome({ size: pool + 1, movement: variant, landAdaptation: 1,
      ...(niche === 'grazer' ? { photosynthesis: 0, plantFeeding: 1 } : {}) });
    genomes.set(id, { genome: value, derived: deriveGenome(value), establishedOrder: genomes.size + 1 });
    return cohort(id, count, context);
  }));
  const before = structuredClone(cohorts);
  const result = compactVariants(cohorts, genomes, { seed: 'separate-pools' });
  for (let pool = 0; pool < contexts.length; pool += 1) {
    const marker = `source-pool-${pool}-`;
    const original = cohorts.filter((row) => row.groupId.startsWith(marker));
    const compacted = result.cohorts.filter((row) => row.groupId.startsWith(marker));
    assert.equal(ids(compacted).size, 3);
    assert.equal(total(compacted), total(original));
    for (const row of compacted) {
      const prior = original.find((entry) => entry.groupId === row.groupId);
      assert.equal(row.count, prior.count);
      assert.equal(row.speciesId, prior.speciesId);
      assert.equal(row.hexId, prior.hexId);
      assert.equal(row.habitat, prior.habitat);
      assert.deepEqual(row.transit, prior.transit);
      assert.equal(acquisitionSignature(genomes.get(row.genomeId).genome),
        acquisitionSignature(genomes.get(prior.genomeId).genome));
      assert.ok(row.genomeId.startsWith(`pool-${pool}-`), 'each survivor originates in its own population');
    }
  }
  assert.deepEqual(cohorts, before);
});

test('v2 rare challengers retain a seeded chance without displacing the two abundant variants', () => {
  const genomes = records([['a', genome()], ['b', genome({ poison: 1 })],
    ['c', genome({ poison: 2 })], ['d', genome({ poison: 3 })], ['e', genome({ spines: 1 })]]);
  const cohorts = [cohort('a', 100), cohort('b', 80), cohort('c', 8), cohort('d', 1), cohort('e', 1)];
  const challengers = new Set();
  for (let seed = 0; seed < 256; seed += 1) {
    const result = compactVariants(cohorts, genomes, { seed: `challenger-${seed}` });
    const retained = ids(result.cohorts);
    assert.equal(retained.size, 3);
    assert.ok(retained.has('a') && retained.has('b'));
    challengers.add([...retained].find((id) => id !== 'a' && id !== 'b'));
  }
  assert.deepEqual(challengers, new Set(['c', 'd', 'e']), 'singletons can be retained, without promising their survival');
});

test('v2 compaction decisions do not depend on cohort order, map order or repeated calls', () => {
  const genomes = records([['z', genome()], ['y', genome({ poison: 1 })],
    ['x', genome({ poison: 2 })], ['w', genome({ poison: 3 })]]);
  const cohorts = [...genomes.keys()].map((id) => cohort(id, 10));
  const first = compactVariants(cohorts, genomes, { seed: 'stable-compaction' });
  assert.ok(ids(first.cohorts).has('z') && ids(first.cohorts).has('y'), 'older establishments break abundance ties');
  assert.deepEqual(compactVariants(cohorts, genomes, { seed: 'stable-compaction' }), first);
  const reordered = compactVariants([...cohorts].reverse(), new Map([...genomes].reverse()), { seed: 'stable-compaction' });
  assert.deepEqual(sorted(reordered.cohorts), sorted(first.cohorts));
  assert.equal(reordered.reassignedPopulation, first.reassignedPopulation);
  assert.equal(reordered.reassignedCohorts, first.reassignedCohorts);
  for (const record of genomes.values()) record.establishedOrder = 1;
  const tied = compactVariants(cohorts, genomes, { seed: 'stable-compaction' });
  assert.ok(ids(tied.cohorts).has('w') && ids(tied.cohorts).has('x'), 'stable IDs break equal establishment ties');
});

test('v2 a retained exploratory variant keeps its slot when its population strengthens', () => {
  const genomes = records([['a', genome()], ['b', genome({ poison: 1 })],
    ['c', genome({ poison: 2 })], ['d', genome({ poison: 3 })], ['e', genome({ spines: 1 })]]);
  const cohorts = [cohort('a', 100), cohort('b', 80), cohort('c', 2), cohort('d', 2), cohort('e', 2)];
  for (let seed = 0; seed < 16; seed += 1) {
    const options = { seed: `persistent-challenger-${seed}` };
    const original = compactVariants(cohorts, genomes, options);
    const explorer = [...ids(original.cohorts)].find((id) => id !== 'a' && id !== 'b');
    const strengthened = cohorts.map((row) => row.genomeId === explorer ? { ...row, count: 3 } : row);
    const next = compactVariants(strengthened, genomes, options);
    assert.ok(ids(next.cohorts).has(explorer), 'an improved rare competitor is not discarded by a fresh lottery');
  }
});

test('v2 equivalent pending passage records share a compact pool regardless of property order', () => {
  const genomes = records([['a', genome()], ['b', genome({ poison: 1 })],
    ['c', genome({ poison: 2 })], ['d', genome({ poison: 3 })]]);
  const passage = { hexId: 3, habitat: 'water', dueTurn: 90, probability: 0.2 };
  const reordered = { probability: 0.2, dueTurn: 90, habitat: 'water', hexId: 3 };
  const cohorts = [...genomes.keys()].map((id, index) => cohort(id, 10 - index,
    { transit: index % 2 ? passage : reordered }));
  const result = compactVariants(cohorts, genomes, { seed: 'equivalent-passage' });
  assert.equal(ids(result.cohorts).size, 3);
  assert.equal(total(result.cohorts), total(cohorts));
  assert.ok(result.cohorts.every((row) => row.transit.hexId === 3 && row.transit.dueTurn === 90));
});

test('v2 reassignment caps stored energy to the retained body and never creates stored energy', () => {
  const genomes = records([['a', genome({ size: 1 })], ['b', genome({ size: 2 })],
    ['c', genome({ size: 9 })], ['d', genome({ size: 10 })]]);
  const cohorts = [['a', 100], ['b', 80], ['c', 1], ['d', 1]].map(([id, count]) =>
    cohort(id, count, { energy: deriveGenome(genomes.get(id).genome).cells }));
  let observedReduction = false;
  for (let seed = 0; seed < 32; seed += 1) {
    const result = compactVariants(cohorts, genomes, { seed: `energy-cap-${seed}` });
    assert.equal(total(result.cohorts), total(cohorts));
    for (const row of result.cohorts) {
      const prior = cohorts.find((entry) => entry.groupId === row.groupId);
      assert.ok(row.energy <= prior.energy);
      assert.ok(row.energy <= deriveGenome(genomes.get(row.genomeId).genome).cells);
      if (row.genomeId === prior.genomeId) assert.equal(row.energy, prior.energy);
      if (row.energy < prior.energy) observedReduction = true;
    }
  }
  assert.ok(observedReduction, 'a large discarded body cannot carry oversized reserves into a smaller representative');
});
