import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TRAITS, founderGenome, genomeKey, validateGenome, mutationOptions,
  mutateGenome, geneticDistance, deriveGenome, describeGenome,
} from '../../src/simulation/life/v1/genes/genome.js';
import { createRandom, binomial, uniformPartitions } from '../../src/simulation/life/v1/random.js';
import {
  supportsHabitat, directWaterAccess, habitatFactor, temperatureFactor,
  waterConnected, canCross, chooseHabitat, crossingDifficulty,
} from '../../src/simulation/life/v1/habitat.js';
import { allocateLight } from '../../src/simulation/life/v1/light.js';

const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `expected ${actual} to be within ${tolerance} of ${expected}`);
const genome = changes => ({ ...founderGenome(), ...changes });
const hex = (id, changes = {}) => ({ id, waterType: 'none', bedElevation: 20, waterLevel: 0,
  runoff: 0, downstream: null, neighbors: [], permanentIce: false, humidity: 0.5,
  temperature: 20, ...changes });

test('gene mutation graph respects one-step bounds, prerequisites and reversible temperature expression', () => {
  const founder = Object.freeze(founderGenome());
  const options = mutationOptions(founder);
  assert.equal(options.length, TRAITS.length);
  assert.deepEqual(options.find(option => option.key === 'temperatureTolerance').values, [0]);
  assert.deepEqual(mutationOptions(genome({ temperatureTolerance: 0 }))
    .find(option => option.key === 'temperatureTolerance').values, [-1, 1, null]);
  assert.deepEqual(mutationOptions(genome({ temperatureTolerance: -2 }))
    .find(option => option.key === 'temperatureTolerance').values, [-1]);
  assert.deepEqual(mutationOptions(genome({ temperatureTolerance: 2 }))
    .find(option => option.key === 'temperatureTolerance').values, [1]);
  assert.equal(mutationOptions(genome({ trunk: 1 })).some(option => option.key === 'photosynthesis'), false);
  assert.equal(mutationOptions(genome({ photosynthesis: 0 })).some(option => option.key === 'trunk'), false);
  assert.equal(validateGenome(genome({ trunk: 1, photosynthesis: 0 })), false);
  assert.equal(validateGenome(genome({ size: 0 })), false);
  assert.equal(validateGenome(genome({ landAdaptation: 4 })), false);
  assert.equal(validateGenome(genome({ movement: 2 })), false);
  assert.notEqual(genomeKey(founder), genomeKey(genome({ temperatureTolerance: 0 })));

  // Midpoints explicitly select each eligible trait before choosing a change.
  for (let index = 0; index < options.length; index += 1) {
    const draws = [(index + 0.5) / options.length, 0.5];
    const mutated = mutateGenome(founder, () => draws.shift());
    assert.deepEqual(TRAITS.filter(({ key }) => mutated[key] !== founder[key]).map(({ key }) => key), [options[index].key]);
    assert.equal(geneticDistance(founder, mutated), 1);
  }
  const random = createRandom('gene-walk');
  let previous = founder;
  for (let step = 0; step < 2000; step += 1) {
    const before = genomeKey(previous);
    const next = mutateGenome(previous, random.next);
    assert.ok(validateGenome(next));
    assert.equal(geneticDistance(previous, next), 1);
    assert.equal(geneticDistance(next, previous), 1);
    assert.equal(genomeKey(previous), before, 'mutation does not rewrite the parent');
    previous = Object.freeze(next);
  }
});

test('genetic distance follows the temperature graph and dependency-respecting trait paths', () => {
  const states = [null, -2, -1, 0, 1, 2];
  const graph = new Map([[null, [0]], [-2, [-1]], [-1, [-2, 0]], [0, [-1, 1, null]], [1, [0, 2]], [2, [1]]]);
  for (const start of states) {
    const distances = new Map([[start, 0]]);
    const queue = [start];
    for (const current of queue) {
      for (const neighbor of graph.get(current)) {
        if (distances.has(neighbor)) continue;
        distances.set(neighbor, distances.get(current) + 1);
        queue.push(neighbor);
      }
    }
    for (const end of states) assert.equal(geneticDistance(genome({ temperatureTolerance: start }),
      genome({ temperatureTolerance: end })), distances.get(end));
  }
  const trunkProducer = genome({ trunk: 3, temperatureTolerance: -2 });
  const consumer = genome({ photosynthesis: 0, plantFeeding: 1 });
  // Remove three trunk steps, photosynthesis, traverse -2 -> -1 -> 0 -> absent,
  // and acquire grazing: every legal transition is charged.
  assert.equal(geneticDistance(trunkProducer, consumer), 8);
  assert.equal(geneticDistance(consumer, trunkProducer), 8);
  assert.equal(geneticDistance(trunkProducer, trunkProducer), 0);
});

test('derived body costs, temperature expression and acquisition shares retain trait trade-offs', () => {
  const baseline = deriveGenome(founderGenome());
  assert.equal(baseline.cells, 19);
  assert.equal(baseline.upkeep, 20);
  assert.equal(baseline.role, 'producer');
  assert.deepEqual(baseline.habitats, ['water']);
  assert.deepEqual(baseline.temperatureRange, [18, 22]);
  const expressed = deriveGenome(genome({ temperatureTolerance: 0 }));
  assert.equal(expressed.upkeep, baseline.upkeep + 1);
  assert.deepEqual(expressed.temperatureRange, [16, 24]);
  const traits = describeGenome(genome({ temperatureTolerance: 0 }));
  assert.equal(traits.find(trait => trait.key === 'temperatureTolerance').active, true);
  const mixed = deriveGenome(genome({ plantFeeding: 1, animalFeeding: 1, landAdaptation: 1 }));
  assert.equal(mixed.role, 'mixed');
  close(mixed.photosynthesisShare + mixed.grazingShare + mixed.predationShare, 1);
  close(mixed.photosynthesisShare, 1 / 3);
  assert.deepEqual(mixed.habitats, ['water', 'land']);
  assert.deepEqual(deriveGenome(genome({ landAdaptation: 2 })).habitats, ['land']);
  assert.equal(deriveGenome(genome({ photosynthesis: 0 })).role, 'other');
});

test('habitat occupancy distinguishes river channels, banks, moisture costs and permanent ice', () => {
  const aquatic = founderGenome();
  const amphibious = genome({ landAdaptation: 1 });
  const terrestrial = genome({ landAdaptation: 2 });
  const dry = genome({ landAdaptation: 3 });
  const bank = hex(0, { runoff: 3, humidity: 0.25 });
  const plain = hex(1, { humidity: 0.25 });
  const sea = hex(2, { waterType: 'sea', bedElevation: -5000 });
  assert.equal(supportsHabitat(aquatic, bank, 'water'), true);
  assert.equal(supportsHabitat(aquatic, bank, 'land'), false);
  assert.equal(supportsHabitat(aquatic, plain, 'water'), false);
  assert.equal(supportsHabitat(terrestrial, bank, 'land'), true);
  assert.equal(supportsHabitat(terrestrial, sea, 'water'), false);
  assert.equal(supportsHabitat(amphibious, sea, 'water'), true);
  assert.equal(supportsHabitat(amphibious, { ...bank, permanentIce: true }, 'land'), false);
  assert.equal(supportsHabitat(aquatic, { ...sea, permanentIce: true }, 'water'), false);
  assert.equal(supportsHabitat(dry, { ...plain, bedElevation: 3500 }, 'land'), false);
  close(habitatFactor(amphibious, plain, 'land', false), 0.25 / 0.85);
  close(habitatFactor(terrestrial, plain, 'land', false), 0.5);
  close(habitatFactor(dry, plain, 'land', false), 1);
  close(habitatFactor(amphibious, plain, 'land', true), 1);
  close(habitatFactor(amphibious, sea, 'water', false), 0.9);
  const derived = deriveGenome(aquatic);
  close(temperatureFactor(derived, 20), 1);
  close(temperatureFactor(derived, 13), 0.5);
  close(temperatureFactor(derived, 8), 0);
  close(temperatureFactor(derived, 32), 0);
});

test('crossing requires actual river links, neighbors and passable ground without seabed cliffs', () => {
  const aquatic = founderGenome();
  const amphibious = genome({ landAdaptation: 1 });
  const dry = genome({ landAdaptation: 3 });
  const riverA = hex(0, { runoff: 4, neighbors: [1, 2], downstream: 1 });
  const riverB = hex(1, { runoff: 3, neighbors: [0], bedElevation: 80 });
  const riverOther = hex(2, { runoff: 3, neighbors: [0] });
  assert.equal(waterConnected(riverA, riverB), true);
  assert.equal(waterConnected(riverB, riverA), true, 'upstream use is possible');
  assert.equal(canCross(aquatic, riverA, 'water', riverB, 'water'), true);
  assert.equal(canCross(aquatic, riverA, 'water', riverOther, 'water'), false);
  assert.equal(canCross(dry, riverA, 'land', riverOther, 'land'), true);
  assert.equal(chooseHabitat(amphibious, riverA, 'water', riverOther), 'land');
  assert.equal(chooseHabitat(aquatic, riverA, 'water', riverOther), null);
  assert.equal(canCross(amphibious, riverA, 'water', riverA, 'land'), true);
  assert.equal(canCross(dry, riverA, 'land', hex(3), 'land'), false, 'no teleport to non-neighbor');
  assert.equal(canCross(dry, riverA, 'land', { ...riverB, bedElevation: 1020 }, 'land'), false);
  assert.equal(canCross(dry, riverA, 'land', { ...riverB, bedElevation: 1019 }, 'land'), true);
  assert.equal(canCross(dry, { ...riverA, bedElevation: 3500 }, 'land', riverB, 'land'), false);
  const seaA = { ...riverA, waterType: 'sea', bedElevation: -6000, waterLevel: 0 };
  const seaB = { ...riverB, waterType: 'sea', bedElevation: -100, waterLevel: 0 };
  assert.equal(canCross(aquatic, seaA, 'water', seaB, 'water'), true);
  assert.equal(crossingDifficulty(aquatic, deriveGenome(aquatic), seaA, 'water', seaB, 'water', false), 0);
  const poorDestination = { ...riverB, temperature: -30, humidity: 0 };
  assert.equal(canCross(amphibious, riverA, 'land', poorDestination, 'land'), true, 'soft conditions do not sever classifier edges');
  assert.equal(crossingDifficulty(amphibious, deriveGenome(amphibious), riverA, 'land', poorDestination, 'land', false), 1);
});

test('direct water access respects coastal cliffs and permanent ice', () => {
  const coast = hex(0, { neighbors: [1], humidity: 0.1 });
  const sea = hex(1, { waterType: 'sea', neighbors: [0], bedElevation: -200 });
  assert.equal(directWaterAccess(coast, [coast, sea]), true);
  const cliff = { ...coast, bedElevation: 1000 };
  assert.equal(directWaterAccess(cliff, [cliff, sea]), false);
  assert.equal(directWaterAccess(coast, [coast, { ...sea, permanentIce: true }]), false);
  assert.equal(directWaterAccess({ ...coast, runoff: 1, neighbors: [] }, []), true);
});

test('weighted light filling redistributes caps and never multiplies a shared hex budget', () => {
  const capped = Object.freeze([
    Object.freeze({ count: 10, cap: 1, weight: 10 }),
    Object.freeze({ count: 10, cap: 100, weight: 1 }),
  ]);
  assert.deepEqual(allocateLight(capped, 100), [1, 9]);
  const shared = [{ count: 100, cap: 20, weight: 1 }, { count: 100, cap: 20, weight: 1 }];
  assert.deepEqual(allocateLight(shared), [10, 10]);
  assert.deepEqual(allocateLight([{ count: 10, cap: 20, weight: 1 }, { count: 10, cap: 20, weight: 3 }], 100), [2.5, 7.5]);
  assert.deepEqual(allocateLight([{ count: 0, cap: 20, weight: 1 }, { count: 2, cap: 3, weight: 0 }]), [0, 0]);
  assert.deepEqual(allocateLight([], 100), []);
  const random = createRandom('light-conservation');
  for (let example = 0; example < 100; example += 1) {
    const entries = Array.from({ length: 20 }, () => ({
      count: Math.floor(random.next() * 100), cap: random.next() * 50, weight: random.next() * 10,
    }));
    const before = JSON.stringify(entries);
    const budget = random.next() * 4000;
    const allocation = allocateLight(entries, budget);
    allocation.forEach((value, index) => assert.ok(value >= 0 && value <= entries[index].cap));
    const used = allocation.reduce((sum, value, index) => sum + value * entries[index].count, 0);
    const capacity = entries.reduce((sum, entry) => sum + entry.count * entry.cap, 0);
    close(used, Math.min(capacity, budget), 1e-8);
    assert.equal(JSON.stringify(entries), before);
    const reverse = allocateLight([...entries].reverse(), budget).reverse();
    allocation.forEach((value, index) => close(value, reverse[index], 1e-8));
  }
});

test('serializable random continuation preserves streams and returned state has independent ownership', () => {
  const original = createRandom('life-random');
  Array.from({ length: 137 }, original.next);
  const state = original.exportState();
  const resumed = createRandom('ignored-on-resume', state);
  state.fill(0);
  assert.ok(original.exportState().some(Boolean));
  assert.ok(resumed.exportState().some(Boolean));
  assert.deepEqual(Array.from({ length: 200 }, original.next), Array.from({ length: 200 }, resumed.next));
  assert.deepEqual(original.exportState(), resumed.exportState());
  assert.throws(() => createRandom('invalid', [0, 0, 0, 0]), /Invalid/);
  assert.throws(() => createRandom('invalid', [1, 2, 3]), /Invalid/);
  assert.throws(() => createRandom('invalid', [1, -1, 3, 4]), /Invalid/);
});

test('cohort binomial samples retain Bernoulli moments, complementary tails and sparse work', () => {
  const forbiddenDraw = () => { throw new Error('Boundary probabilities need no random draw'); };
  assert.equal(binomial(0, 0.5, forbiddenDraw), 0);
  assert.equal(binomial(100, 0, forbiddenDraw), 0);
  assert.equal(binomial(100, 1, forbiddenDraw), 100);
  for (const probability of [0.001, 0.1, 0.5, 0.9, 0.999]) {
    const random = createRandom(`binomial-moments-${probability}`);
    const count = 100;
    const trials = 8000;
    let sum = 0;
    let squares = 0;
    for (let trial = 0; trial < trials; trial += 1) {
      const sample = binomial(count, probability, random.next);
      assert.ok(Number.isInteger(sample) && sample >= 0 && sample <= count);
      sum += sample;
      squares += sample * sample;
    }
    const expectedMean = count * probability;
    const expectedVariance = count * probability * (1 - probability);
    const mean = sum / trials;
    close(mean, expectedMean, 5 * Math.sqrt(expectedVariance / trials));
    close(squares / trials - mean * mean, expectedVariance, expectedVariance * 0.12 + 0.02);
  }
  const low = createRandom('complement');
  const high = createRandom('complement');
  assert.equal(binomial(1000, 0.25, low.next) + binomial(1000, 0.75, high.next), 1000);
  const sparse = createRandom('sparse');
  let draws = 0;
  const successes = binomial(1_000_000, 0.000001, () => { draws += 1; return sparse.next(); });
  assert.equal(draws, successes + 1);
  assert.ok(draws < 20, 'rare outcomes do not loop over a million organisms');
  const partitionRandom = createRandom('partitions');
  const totals = [0, 0, 0, 0, 0];
  for (let trial = 0; trial < 2000; trial += 1) {
    const partitions = uniformPartitions(40, 5, partitionRandom.next);
    assert.equal(partitions.reduce((sum, value) => sum + value, 0), 40);
    partitions.forEach((value, index) => { assert.ok(Number.isInteger(value) && value >= 0); totals[index] += value; });
  }
  for (const total of totals) close(total / 2000, 8, 0.3);
});
