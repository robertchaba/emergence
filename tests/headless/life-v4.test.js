import test from 'node:test';
import assert from 'node:assert/strict';
import { assignClimate, climateAt } from '../../src/simulation/climate.js';
import { createGrid } from '../../src/simulation/grid.js';
import { createLifeModel, restoreLifeModel, EVOLUTION_RULES } from '../../src/simulation/life/v4/model.js';
import { createLifeModel as createV3 } from '../../src/simulation/life/v3/model.js';
import { TRAITS, validateGenome, founderGenome, geneticDistance } from '../../src/simulation/life/v4/genes/genome.js';
import { scoreSpecies } from '../../src/simulation/life/v4/ecology.js';
import { evaluateObservationJobs } from '../../src/simulation/life/v4/observation-jobs.js';
import { workerFixture } from '../fixtures/life-workers.js';

function fixture() {
  return assignClimate({ width: 6, height: 7, day: 0, seed: 'v4-fixture', version: 'fixture',
    hexes: createGrid(6, 7).map(hex => ({ ...hex, bedElevation: -100,
      waterType: 'sea', waterLevel: 0, runoff: 0, downstream: null, distanceToWater: 0 })) });
}

function reconcile(model) {
  const observation = model.observe();
  assert.equal(observation.modelId, 'v4');
  assert.equal(observation.countQuality, 'exact');
  assert.equal(observation.counts.organisms, observation.hexes.reduce((sum, hex) => sum + hex.population, 0));
  assert.equal(observation.counts.organisms, observation.species.reduce((sum, species) => sum + species.population, 0));
  assert.equal(observation.counts.species, observation.species.length);
  assert.equal(observation.counts.occupiedHexes, observation.hexes.length);
  assert.equal(observation.counts.organisms, 20 + observation.stats.births - observation.stats.deaths);
  for (const hex of observation.hexes) {
    assert.ok(Number.isSafeInteger(hex.population) && hex.population > 0);
    assert.equal(hex.population, hex.species.reduce((sum, species) => sum + species.population, 0));
    assert.equal(hex.population, hex.display.reduce((sum, group) => sum + group.population, 0));
    assert.equal(hex.speciesCount, hex.species.length);
    assert.equal(model.inspectHex(hex.hexId).population, hex.population);
    for (const group of hex.display) {
      assert.equal(typeof group.morphology.form, 'string');
      assert.equal(typeof group.morphology.pattern, 'string');
      assert.ok(['solitary', 'clustered'].includes(group.morphology.social));
      assert.equal('genome' in group, false, 'rendering gets morphology observations, never model internals');
    }
  }
  for (const species of observation.species) {
    assert.equal(species.population, species.locations.reduce((sum, location) => sum + location.population, 0));
    assert.equal(model.inspectSpecies(species.id).population, species.population);
    assert.equal(species.variants.length, 1);
    assert.ok(species.tendencies.length <= EVOLUTION_RULES.maximumCandidates);
    for (const location of species.locations) {
      assert.equal(location.population, observation.hexes.find(hex => hex.hexId === location.hexId)
        .species.find(row => row.id === species.id).population);
    }
    for (const trait of species.traits) {
      assert.equal(trait.population, species.population);
      assert.equal(trait.expressions.length, 1);
      assert.equal(trait.expressions[0].population, species.population);
    }
  }
  return observation;
}

test('V4 introduction is atomic, preserves the physical world and rejects V3 continuation', () => {
  const world = fixture();
  const originalWorld = structuredClone(world);
  const model = createLifeModel(world);
  const empty = model.exportState();
  assert.equal(model.observe().status, 'not-introduced');
  assert.equal(model.introduce(-1).reason, 'unknown-hex');
  assert.deepEqual(model.exportState(), empty);
  assert.equal(model.introduce(18).ok, true);
  const introduced = model.exportState();
  assert.equal(introduced.modelId, 'v4');
  assert.equal(model.introduce(19).reason, 'already-introduced');
  assert.deepEqual(model.exportState(), introduced);
  assert.equal(model.observe().counts.organisms, 20);
  assert.throws(() => restoreLifeModel(world, createV3(world).exportState()), /Incompatible/);
  assert.throws(() => restoreLifeModel(world, { ...introduced, rulesRevision: 'v4-unknown' }), /Incompatible/);
  assert.deepEqual(world, originalWorld);
  reconcile(model);
});

test('V4 replay, partial-turn continuation and detached observations preserve identical biology', () => {
  const world = fixture();
  const options = { seed: 'v4-deterministic', runId: 'v4-repeatable-run' };
  const bulk = createLifeModel(world, options);
  const stepped = createLifeModel(world, options);
  bulk.introduce(18); stepped.introduce(18);
  bulk.advanceTo(721);
  for (let day = 1; day <= 721; day += 1) {
    stepped.advanceTo(day);
    if (day % 31 === 0) {
      stepped.observe(); stepped.inspectHex(18); stepped.inspectSpecies('species-1');
    }
  }
  assert.deepEqual(stepped.exportState(), bulk.exportState());
  assert.equal(bulk.exportState().biologicalTurns, 216);
  assert.equal(bulk.exportState().turnCredit, 3);
  const restored = restoreLifeModel(world, JSON.parse(JSON.stringify(stepped.exportState())));
  bulk.advanceTo(1440); restored.advanceTo(1440);
  assert.deepEqual(restored.exportState(), bulk.exportState());
  const beforeQueries = restored.exportState();
  const observation = restored.observe();
  observation.counts.organisms = -1;
  if (observation.hexes.length) observation.hexes[0].display[0].morphology.form = 'changed';
  assert.deepEqual(restored.exportState(), beforeQueries);
  assert.notEqual(restored.observe().counts.organisms, -1);
  reconcile(restored);
});

test('V4 growth, dispersal, selection and all new loci retain a consistent represented census', () => {
  const world = fixture();
  const model = createLifeModel(world, { seed: 'v4-accounting' });
  model.introduce(18);
  assert.equal(TRAITS.length, 40);
  for (const day of [4, 10, 120, 360, 720, 1440]) {
    model.advanceTo(day);
    const snapshot = reconcile(model);
    const state = model.exportState();
    const positions = state.populations.map(row => `${row.speciesId}:${row.hexId}:${row.habitat}`);
    assert.equal(new Set(positions).size, positions.length);
    assert.ok(state.populations.every(row => Number.isSafeInteger(row.count) && row.count > 0
      && Number.isFinite(row.reserve) && row.reserve >= 0));
    for (const species of state.species) {
      assert.ok(validateGenome(species.genome));
      assert.ok(species.candidates.length <= EVOLUTION_RULES.maximumCandidates);
      assert.ok(species.candidates.every(candidate => validateGenome(candidate.genome)
        && !('count' in candidate) && !('populations' in candidate)));
    }
    assert.deepEqual(restoreLifeModel(world, state).observe(), snapshot);
  }
});

test('V4 checkpoints validate added loci and require the complete V4 genome', () => {
  const world = fixture();
  const model = createLifeModel(world);
  model.introduce(18);
  const checkpoint = model.exportState();
  for (const trait of TRAITS.slice(22)) {
    const invalid = structuredClone(checkpoint);
    invalid.species[0].genome[trait.key] = trait.max + 1;
    assert.throws(() => restoreLifeModel(world, invalid), /Invalid/);
    const missing = structuredClone(checkpoint);
    delete missing.species[0].genome[trait.key];
    assert.throws(() => restoreLifeModel(world, missing), /Invalid/);
  }
});

test('V4 counts births from accepted sexual phenotypes without counting hypothetical sexuality', () => {
  const world = fixture();
  for (const sexualReproduction of [0, 1]) {
    const initial = createLifeModel(world, { seed: 'v4-sexual-births' });
    initial.introduce(18);
    const checkpoint = initial.exportState();
    checkpoint.species[0].genome = { ...founderGenome(), temperatureTolerance: 1,
      depthTolerance: 2, sexualReproduction };
    delete checkpoint.species[0].genomeHistory;
    const model = restoreLifeModel(world, checkpoint);
    model.advanceTo(10);
    const { stats } = model.exportState();
    assert.ok(stats.births > 0);
    assert.equal(stats.sexualBirths, sexualReproduction ? stats.births : 0);
  }
});

test('V4 preserves distinct morphology groups without changing the species or organism census', () => {
  const world = fixture();
  const original = createLifeModel(world);
  original.introduce(18);
  const checkpoint = original.exportState();
  const first = checkpoint.species[0];
  first.genome = { ...founderGenome(), leafArea: 1 };
  delete first.genomeHistory;
  checkpoint.species.push({ ...first, id: 'species-2', name: 'Morphology fixture',
    genome: { ...first.genome, leafArea: 0, propaguleDispersal: 2 } });
  checkpoint.nextSpecies = 3;
  checkpoint.populations[0].count = 7;
  checkpoint.populations.push({ ...checkpoint.populations[0], speciesId: 'species-2', count: 13 });
  const model = restoreLifeModel(world, checkpoint);
  const observation = reconcile(model);
  const groups = observation.hexes[0].display;
  assert.equal(groups.length, 2);
  assert.deepEqual(new Set(groups.map(group => group.morphology.form)), new Set(['broadleaf', 'plume']));
  assert.deepEqual(groups.map(group => group.population).sort((a, b) => a - b), [7, 13]);
  groups[0].morphology.form = 'changed';
  assert.ok(model.observe().hexes[0].display.every(group => group.morphology.form !== 'changed'));
  assert.deepEqual(model.exportState(), checkpoint);
});

test('V4 propagules and roots affect actual dispersal, crossing remains rare and outward conductance stays bounded', () => {
  const run = (changes, barriers = false) => {
    const world = fixture();
    if (barriers) for (const hex of world.hexes) {
      // Disconnected water pools retain usable water habitat but no channel.
      hex.waterType = 'none'; hex.runoff = 1;
    }
    const original = createLifeModel(world, { seed: 'v4-dispersal-integration' });
    original.introduce(18);
    const state = original.exportState();
    state.species[0].genome = { ...founderGenome(), ...changes };
    delete state.species[0].genomeHistory;
    state.populations[0].count = 100000;
    const model = restoreLifeModel(world, state);
    model.advanceTo(4);
    const after = model.exportState();
    const survivingAdults = 100000 - after.stats.deaths;
    assert.equal(after.populations.reduce((sum, row) => sum + row.count, 0),
      survivingAdults + after.stats.births, 'movement conserves all represented organisms');
    assert.equal(after.stats.movements, after.populations.filter(row => row.hexId !== 18)
      .reduce((sum, row) => sum + row.count, 0));
    return { share: after.stats.movements / survivingAdults, after };
  };
  const baseline = run({});
  const propagules = run({ propaguleDispersal: 3 });
  const roots = run({ deepRoots: 3 });
  assert.ok(propagules.share > baseline.share * 2, 'propagules increase realized source departures');
  assert.ok(roots.share < baseline.share * 0.75, 'deep anchoring carries a real dispersal cost');
  const rare = run({}, true);
  const carried = run({ propaguleDispersal: 3 }, true);
  assert.ok(rare.after.stats.barrierArrivals > 0);
  assert.equal(rare.after.stats.barrierArrivals, rare.after.stats.movements);
  assert.ok(carried.share > rare.share * 3.5, 'propagules affect difficult crossings as well as normal dispersal');
  assert.ok(carried.share < baseline.share, 'a dispersal trait does not erase the barrier');
  const fast = run({ movement: 4, propaguleDispersal: 3 });
  assert.ok(fast.share > 0.119 && fast.share < 0.1201,
    'the total 0.12 conductance cap permits only per-route integer rounding error');
});

test('V4 parallel observation scoring agrees with serial scoring and cannot mutate continuation', async () => {
  const { world, checkpoint } = workerFixture();
  const serial = restoreLifeModel(world, checkpoint);
  const parallel = restoreLifeModel(world, checkpoint);
  let dispatched = false;
  const execute = async jobs => {
    dispatched = true;
    const batches = Array.from({ length: 4 }, (_, index) => jobs.filter((_, position) => position % 4 === index));
    const results = batches.reverse().flatMap(batch => evaluateObservationJobs(structuredClone(batch)));
    jobs[0].hex.bedElevation = 999999;
    jobs[0].queries[0].genome.size = 10;
    return results;
  };
  const before = parallel.exportState();
  assert.deepEqual(await parallel.observeAsync(execute), serial.observe());
  assert.equal(dispatched, true);
  assert.deepEqual(parallel.exportState(), before);
  serial.advanceTo(world.day + 41); parallel.advanceTo(world.day + 41);
  assert.deepEqual(await parallel.observeAsync(execute), serial.observe());
  assert.deepEqual(parallel.exportState(), serial.exportState());
});

test('V4 can sample bounded two-locus hypotheses without creating intermediate carriers', () => {
  const world = fixture();
  const model = createLifeModel(world, { seed: 'v4-compound-0' });
  model.introduce(18);
  const original = model.exportState().species[0].genome;
  model.advanceTo(40);
  const state = model.exportState();
  assert.equal(state.species.length, 1, 'a proposal is not a species');
  assert.deepEqual(state.species[0].genome, original, 'the accepted phenotype waits for persistence');
  const compounds = state.species[0].candidates.filter(candidate => candidate.steps === 2);
  assert.ok(compounds.length > 0);
  assert.ok(compounds.every(candidate => geneticDistance(original, candidate.genome) === 2
    && TRAITS.filter(({ key }) => candidate.genome[key] !== original[key]).length === 2));
  assert.ok(state.species[0].candidates.length <= EVOLUTION_RULES.maximumCandidates);
  assert.equal(state.populations.reduce((sum, row) => sum + row.count, 0),
    20 + state.stats.births - state.stats.deaths);
});

test('V4 a persistent endpoint can cross a losing intermediate but still requires actual founding food', () => {
  const world = fixture();
  for (const hex of world.hexes) hex.neighbors = [];
  const producer = { ...founderGenome(), temperatureTolerance: 1, depthTolerance: 2, leafArea: 3 };
  const intermediate = { ...producer, plantFeeding: 1 };
  const consumer = { ...intermediate, photosynthesis: 0 };
  const environment = { ...world.hexes[18], ...climateAt(world, world.hexes[18], 40) };
  const community = [{ speciesId: 'species-1', genome: producer, population: 100, habitat: 'water' }];
  const options = { excludeSpeciesId: 'species-1', independentLineage: true };
  assert.ok(scoreSpecies(intermediate, environment, 'water', community, options).score < 0,
    'the intermediate would fail ordinary individual-step selection');
  assert.ok(scoreSpecies(consumer, environment, 'water', community, options).score > 0.005);
  assert.ok(scoreSpecies(consumer, environment, 'water', [], options).score < 0,
    'a hypothesis never supplies its own food');
  for (const [population, expectedSpecies] of [[100, 2], [200, 1]]) {
    const initial = createLifeModel(world, { seed: 'v4-compound-branch' });
    initial.introduce(18);
    const checkpoint = initial.exportState();
    checkpoint.species[0].genome = producer;
    delete checkpoint.species[0].genomeHistory;
    checkpoint.species[0].candidates = [{ id: 'direction-1', genome: consumer, originDay: 0,
      lastEvaluation: 0, age: EVOLUTION_RULES.persistenceAssessments - 1,
      support: 1, advantage: 0.05, steps: 2 }];
    checkpoint.populations[0].count = population;
    checkpoint.nextCandidate = 2;
    checkpoint.day = 37; checkpoint.biologicalTurns = 11; checkpoint.turnCredit = 1;
    const model = restoreLifeModel(world, checkpoint);
    model.advanceTo(40);
    const observation = model.observe();
    assert.equal(observation.counts.species, expectedSpecies,
      'the large founding transfer is rejected when actual food cannot support it');
    assert.equal(observation.counts.organisms, population + observation.stats.births - observation.stats.deaths,
      'accepted endpoints transfer existing organisms, without adding intermediate carriers');
    assert.ok(model.exportState().species.every(species =>
      !(species.genome.photosynthesis && species.genome.plantFeeding)));
  }
});
