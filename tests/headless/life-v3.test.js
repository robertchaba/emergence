import test from 'node:test';
import assert from 'node:assert/strict';
import { assignClimate, climateAt } from '../../src/simulation/climate.js';
import { createGrid } from '../../src/simulation/grid.js';
import { createLifeModel, restoreLifeModel, EVOLUTION_RULES } from '../../src/simulation/life/v3/model.js';
import { founderGenome, deriveGenome, genomeKey } from '../../src/simulation/life/v3/genes/genome.js';
import { evaluateCommunity } from '../../src/simulation/life/v3/ecology.js';
import { createLifeModel as createV2 } from '../../src/simulation/life/v2/model.js';

function fixture(width = 6) {
  return assignClimate({ width, height: 7, day: 0, seed: 'v3-fixture', version: 'fixture',
    hexes: createGrid(width, 7).map(hex => ({ ...hex, bedElevation: -100,
      waterType: 'sea', waterLevel: 0, runoff: 0, downstream: null, distanceToWater: 0 })) });
}

function reconcile(model) {
  const snapshot = model.observe();
  assert.equal(snapshot.countQuality, 'exact');
  assert.equal(snapshot.counts.organisms, snapshot.hexes.reduce((sum, row) => sum + row.population, 0));
  assert.equal(snapshot.counts.organisms, snapshot.species.reduce((sum, row) => sum + row.population, 0));
  assert.equal(snapshot.counts.species, snapshot.species.length);
  assert.equal(snapshot.counts.occupiedHexes, snapshot.hexes.length);
  for (const hex of snapshot.hexes) {
    assert.ok(Number.isSafeInteger(hex.population) && hex.population > 0);
    assert.equal(hex.population, hex.species.reduce((sum, row) => sum + row.population, 0));
    assert.equal(hex.population, hex.display.reduce((sum, row) => sum + row.population, 0));
    assert.equal(hex.speciesCount, hex.species.length);
    assert.equal(model.inspectHex(hex.hexId).population, hex.population);
    for (const species of hex.species) {
      assert.equal(species.population, snapshot.species.find(row => row.id === species.id)
        .locations.find(row => row.hexId === hex.hexId).population);
    }
  }
  for (const species of snapshot.species) {
    assert.equal(species.population, species.locations.reduce((sum, row) => sum + row.population, 0));
    assert.equal(model.inspectSpecies(species.id).population, species.population);
    assert.equal(species.variants.length, 1);
    assert.equal(species.variants[0].population, species.population);
    assert.ok(species.tendencies.length <= 3);
    for (const direction of species.tendencies) {
      assert.equal(direction.rangeQuality, 'estimated');
      assert.equal('population' in direction, false);
      for (const location of direction.locations) {
        assert.equal('population' in location, false, 'a favorable site is not an exact carrier range');
        assert.ok(species.locations.some(row => row.hexId === location.hexId));
      }
    }
    for (const trait of species.traits) {
      assert.equal(trait.population, species.population, 'accepted traits describe the whole species phenotype');
      assert.equal(trait.expressions.length, 1, 'directions are not actual alternative carrier phenotypes');
      for (const expression of trait.expressions) {
        assert.equal(expression.population, species.population);
        assert.equal(expression.population, expression.locations.reduce((sum, row) => sum + row.population, 0));
      }
    }
  }
  return snapshot;
}

test('v3 introduction and incompatible checkpoint rejection are atomic and model specific', () => {
  const world = fixture();
  const model = createLifeModel(world);
  const empty = model.exportState();
  assert.equal(model.observe().modelId, 'v3');
  assert.equal(model.observe().status, 'not-introduced');
  assert.equal(model.introduce(-1).reason, 'unknown-hex');
  assert.equal(model.introduce(world.hexes.length).reason, 'unknown-hex');
  assert.deepEqual(model.exportState(), empty);
  assert.equal(model.introduce(18).ok, true);
  const introduced = model.exportState();
  assert.equal(model.introduce(19).reason, 'already-introduced');
  assert.deepEqual(model.exportState(), introduced);
  assert.equal(model.observe().counts.organisms, 20);
  assert.equal(model.inspectHex(18).population, 20);
  assert.equal(model.inspectHex(0).population, 0);
  assert.throws(() => model.inspectHex(10000), RangeError);
  assert.throws(() => model.inspectSpecies('unknown-species'), RangeError);
  assert.throws(() => restoreLifeModel(world, createV2(world).exportState()), /Incompatible/);
  assert.throws(() => restoreLifeModel(world, { ...introduced, rulesRevision: 'other-v3-rules' }), /Incompatible/);
  assert.throws(() => restoreLifeModel(world, { ...introduced, rulesRevision: 'v3-populations-2' }), /Incompatible/);
  assert.throws(() => restoreLifeModel(world, { ...introduced, rulesRevision: 'v3-populations-4' }), /Incompatible/);
  const changedWorld = fixture();
  changedWorld.hexes[18].bedElevation -= 1;
  assert.throws(() => restoreLifeModel(changedWorld, introduced), /Incompatible/);
  reconcile(model);
});

test('v3 replay is independent of day batching, inspection frequency and checkpoint continuation', () => {
  const world = fixture();
  const originalWorld = JSON.stringify(world);
  const bulk = createLifeModel(world, { seed: 'v3-replay', runId: 'repeatable-run' });
  const stepped = createLifeModel(world, { seed: 'v3-replay', runId: 'repeatable-run' });
  bulk.introduce(18); stepped.introduce(18);
  bulk.advanceTo(720);
  for (let day = 1; day <= 720; day += 1) {
    stepped.advanceTo(day);
    if (day % 11 === 0) {
      stepped.observe(); stepped.inspectHex(18); stepped.inspectSpecies('species-1');
    }
  }
  assert.deepEqual(stepped.exportState(), bulk.exportState());
  const checkpoint = JSON.parse(JSON.stringify(stepped.exportState()));
  const resumed = restoreLifeModel(world, checkpoint);
  bulk.advanceTo(1440); resumed.advanceTo(1440);
  assert.deepEqual(resumed.exportState(), bulk.exportState());
  const beforeQueries = bulk.exportState();
  const observed = bulk.observe();
  observed.counts.organisms = -1;
  if (observed.species.length) observed.species[0].traits[0].expressions[0].value = 999;
  bulk.inspectHex(18); bulk.inspectSpecies('species-1');
  assert.deepEqual(bulk.exportState(), beforeQueries);
  assert.notEqual(bulk.observe().counts.organisms, -1);
  assert.equal(JSON.stringify(world), originalWorld);
  reconcile(bulk);
});

test('v3 completes three biological turns per ten days and preserves partial turn credit', () => {
  const world = fixture();
  const model = createLifeModel(world);
  model.advanceTo(23);
  assert.equal(model.introduce(18).ok, true);
  const before = model.exportState();
  model.advanceTo(26);
  assert.equal(model.observe().biologicalTurns, 0);
  assert.deepEqual(model.exportState().populations, before.populations);
  assert.deepEqual(model.exportState().randomState, before.randomState);
  const resumed = restoreLifeModel(world, model.exportState());
  for (const [day, turns] of [[27, 1], [30, 2], [33, 3], [123, 30]]) {
    model.advanceTo(day); resumed.advanceTo(day);
    assert.equal(model.observe().day, day);
    assert.equal(model.observe().biologicalTurns, turns);
    assert.deepEqual(resumed.exportState(), model.exportState());
  }
  assert.throws(() => model.advanceTo(122), RangeError);
  assert.throws(() => model.advanceTo(123.5), RangeError);
  const invalid = model.exportState();
  invalid.turnCredit = 10;
  assert.throws(() => restoreLifeModel(world, invalid), /Invalid checkpoint/);
});

test('v3 population counts reconcile after growth, dispersal, selection and checkpointing', () => {
  const world = fixture();
  const model = createLifeModel(world, { seed: 'v3-accounting' });
  model.introduce(18);
  for (const day of [4, 10, 30, 120, 360, 720, 1440]) {
    model.advanceTo(day);
    const snapshot = reconcile(model);
    assert.equal(snapshot.counts.organisms, 20 + snapshot.stats.births - snapshot.stats.deaths);
    const state = model.exportState();
    assert.ok(state.populations.every(row => Number.isSafeInteger(row.count) && row.count > 0
      && Number.isFinite(row.reserve) && row.reserve >= 0));
    const positions = state.populations.map(row => `${row.speciesId}:${row.hexId}:${row.habitat}`);
    assert.equal(new Set(positions).size, positions.length, 'only one aggregate record represents a species in one habitat');
    assert.deepEqual(restoreLifeModel(world, state).observe(), snapshot);
  }
});

test('v3 caps exploratory directions per species independently of occupied hex count', () => {
  for (const width of [6, 18]) {
    const world = fixture(width);
    const original = createLifeModel(world, { seed: `v3-global-budget-${width}` });
    original.introduce(3 * width);
    const state = original.exportState();
    const template = state.populations[0];
    state.populations = world.hexes.filter(hex => hex.row === 3)
      .map(hex => ({ ...template, hexId: hex.id, count: 30 }));
    const model = restoreLifeModel(world, state);
    assert.equal(model.observe().counts.occupiedHexes, width);
    for (const day of [30, 90, 180, 360, 720]) {
      model.advanceTo(day);
      for (const species of model.exportState().species) {
        assert.ok(species.candidates.length <= 3);
        for (const candidate of species.candidates) {
          assert.equal('locations' in candidate, false, 'candidate ranges must be derived estimates');
          assert.equal('populations' in candidate, false);
          assert.equal('count' in candidate, false, 'hypothetical variation never owns living carriers');
        }
      }
      reconcile(model);
    }
  }
});

test('v3 exploratory feeding changes are hypothetical and cannot turn a fraction of one species into consumers', () => {
  const world = fixture();
  const original = createLifeModel(world, { seed: 'v3-hypothetical-feeding' });
  original.introduce(18);
  const state = original.exportState();
  state.species[0].genome = { ...founderGenome(), temperatureTolerance: 1, depthTolerance: 2 };
  delete state.species[0].genomeHistory; // Synthetic genome has no recorded ancestry.
  const control = restoreLifeModel(world, state);
  const species = state.species[0];
  species.candidates = [{ id: 'candidate-1', genome: { ...species.genome, plantFeeding: 1 },
    originDay: 0, lastEvaluation: 0, age: 0, support: 0, advantage: 0, steps: 1 }];
  const exploring = restoreLifeModel(world, state);
  const before = exploring.exportState();
  reconcile(exploring);
  assert.deepEqual(exploring.exportState(), before, 'estimating a direction does not change population or random state');
  for (const model of [control, exploring]) model.advanceTo(4);
  assert.deepEqual(exploring.exportState().populations, control.exportState().populations);
  assert.deepEqual(exploring.exportState().randomState, control.exportState().randomState);
  assert.equal(exploring.observe().counts.species, 1);
  assert.ok(exploring.observe().hexes.every(hex => hex.display.every(row => row.role === 'producer')));
  const traits = exploring.observe().species[0].traits;
  assert.equal(traits.some(trait => trait.key === 'plantFeeding'), false);
  reconcile(exploring);
});

test('v3 rejects checkpoints with invalid represented populations or an excessive species direction budget', () => {
  const world = fixture();
  const original = createLifeModel(world);
  original.introduce(18);
  for (const changes of [{ count: -1 }, { count: 1.5 }, { reserve: -1 },
    { hexId: 10000 }, { speciesId: 'missing-species' }, { habitat: 'air' }]) {
    const invalid = original.exportState();
    Object.assign(invalid.populations[0], changes);
    assert.throws(() => restoreLifeModel(world, invalid), /Invalid checkpoint/);
  }
  const invalid = original.exportState();
  const genome = invalid.species[0].genome;
  invalid.species[0].candidates = ['movement', 'poison', 'spines', 'plantFeeding'].map((key, index) => ({
    id: `candidate-${index + 1}`, genome: { ...genome, [key]: genome[key] + 1 },
    originDay: 0, lastEvaluation: 0, age: 0, support: 0, advantage: 0, steps: 1,
  }));
  assert.throws(() => restoreLifeModel(world, invalid), /Invalid checkpoint/);
});

function matureFeedingDirection(world, incumbent = false) {
  const original = createLifeModel(world, { seed: 'v3-branch-fixture' });
  original.introduce(18);
  const state = original.exportState();
  const producer = { ...founderGenome(), temperatureTolerance: 1, depthTolerance: 2 };
  const consumer = { ...producer, photosynthesis: 0, plantFeeding: 1 };
  state.species[0].genome = producer;
  delete state.species[0].genomeHistory; // Synthetic genome has no recorded ancestry.
  state.species[0].candidates = [{ id: 'direction-1', genome: consumer, originDay: 0,
    lastEvaluation: 0, age: EVOLUTION_RULES.persistenceAssessments - 1,
    support: 1, advantage: 0.05, steps: 2 }];
  state.populations = [{ ...state.populations[0], count: 100, reserve: deriveGenome(producer).cells }];
  state.nextCandidate = 2;
  // Finish just before an assessment, preserving a valid three-per-ten clock.
  state.day = 37; state.biologicalTurns = 11; state.turnCredit = 1;
  if (incumbent) {
    state.species.push({ ...state.species[0], id: 'species-2', name: 'Incumbent test lineage',
      parentId: 'species-1', genome: consumer, candidates: [] });
    state.populations.push({ ...state.populations[0], speciesId: 'species-2', count: 10 });
    state.nextSpecies = 3;
  }
  return restoreLifeModel(world, state);
}

test('v3 admits a persistent advantageous feeding direction only as a distinct species', () => {
  const world = fixture();
  const model = matureFeedingDirection(world);
  assert.equal(model.observe().counts.species, 1);
  assert.ok(model.observe().species[0].tendencies[0].locations.some(row => row.hexId === 18));
  model.advanceTo(40);
  const snapshot = reconcile(model);
  assert.equal(snapshot.stats.speciations, 1);
  assert.equal(snapshot.counts.species, 2);
  assert.equal(snapshot.counts.organisms, 100 + snapshot.stats.births - snapshot.stats.deaths,
    'naming a lineage transfers existing organisms instead of creating them');
  const parent = snapshot.species.find(row => row.id === 'species-1');
  const child = snapshot.species.find(row => row.parentId === parent.id);
  assert.equal(parent.variants[0].role, 'producer');
  assert.equal(child.variants[0].role, 'grazer');
  assert.equal(parent.traits.some(trait => trait.key === 'plantFeeding'), false);
  assert.equal(child.traits.find(trait => trait.key === 'plantFeeding').population, child.population);
  const resumed = restoreLifeModel(world, model.exportState());
  model.advanceTo(160); resumed.advanceTo(160);
  assert.deepEqual(resumed.exportState(), model.exportState());
  reconcile(model);
});

test('v3 rejects a direction that looks viable when rare but cannot support the proposed founding population', () => {
  const world = fixture();
  const state = matureFeedingDirection(world).exportState();
  state.populations[0].count = 600;
  const model = restoreLifeModel(world, state);
  assert.ok(model.observe().species[0].tendencies[0].locations.some(row => row.hexId === 18),
    'the rare candidate has a positive score and an advantage over its parent');
  model.advanceTo(40);
  const snapshot = reconcile(model);
  assert.equal(snapshot.counts.species, 1, 'the finite food pool cannot fund the proposed 25% split');
  assert.equal(snapshot.stats.speciations, 0);
  assert.equal(snapshot.counts.organisms, 600 + snapshot.stats.births - snapshot.stats.deaths);
});

test('v3 suppresses a proposed species when its established ecological equivalent already occupies the niche', () => {
  const world = fixture();
  const model = matureFeedingDirection(world, true);
  assert.equal(model.observe().counts.species, 2);
  model.advanceTo(40);
  const snapshot = reconcile(model);
  assert.equal(snapshot.counts.species, 2);
  assert.equal(snapshot.stats.speciations, 0);
  assert.equal(snapshot.counts.organisms, 110 + snapshot.stats.births - snapshot.stats.deaths);
});

test('v3 a viable feeding change must differ ecologically from its own parent', () => {
  const world = fixture();
  for (const hex of world.hexes) hex.neighbors = [];
  const original = createLifeModel(world, { seed: 'redundant-parent' });
  original.introduce(18);
  const state = original.exportState();
  const producer = { ...founderGenome(), temperatureTolerance: 1, depthTolerance: 2 };
  const parent = { ...producer, size: 2, plantFeeding: 1 };
  const candidate = { ...parent, photosynthesis: 0 };
  state.species[0].genome = parent;
  delete state.species[0].genomeHistory; // Synthetic genome has no recorded ancestry.
  state.species[0].candidates = [{ id: 'direction-1', genome: candidate, originDay: 0,
    lastEvaluation: 0, age: EVOLUTION_RULES.persistenceAssessments - 1,
    steps: 1, support: 1, advantage: 0.05 }];
  state.species.push({ ...state.species[0], id: 'species-2', genome: producer, candidates: [] });
  state.nextSpecies = 3; state.nextCandidate = 2;
  state.populations = [{ ...state.populations[0], count: 100 },
    { ...state.populations[0], speciesId: 'species-2', count: 150 }];
  state.day = 37; state.biologicalTurns = 11; state.turnCredit = 1;
  const model = restoreLifeModel(world, state);
  model.advanceTo(40);
  const snapshot = reconcile(model);
  assert.ok(snapshot.species.find(row => row.id === 'species-1').tendencies
    .find(row => row.id === 'direction-1').locations.some(row => row.hexId === 18));
  const saved = model.exportState();
  const transferred = Math.floor(saved.populations.find(row => row.speciesId === 'species-1').count / 4);
  const projected = saved.populations.map(row => ({ speciesId: row.speciesId,
    genome: row.speciesId === 'species-1' ? parent : producer,
    population: row.count - (row.speciesId === 'species-1' ? transferred : 0) }));
  projected.push({ speciesId: 'child', genome: candidate, population: transferred });
  const hex = { ...world.hexes[18], ...climateAt(world, world.hexes[18], 40) };
  assert.ok(transferred >= EVOLUTION_RULES.minimumPopulation);
  assert.ok(evaluateCommunity(hex, 'water', projected).at(-1).score > 0,
    'food can fund the split, but both parent and child would occupy the grazing niche');
  assert.equal(snapshot.stats.speciations, 0);
  assert.equal(snapshot.counts.species, 2);
  assert.equal(snapshot.counts.organisms, 250 + snapshot.stats.births - snapshot.stats.deaths);
});

test('v3 improvement over a parent is insufficient when a stronger incumbent already occupies the feeding niche', () => {
  const world = fixture();
  const state = matureFeedingDirection(world, true).exportState();
  // The proposed consumer differs from the resident consumer, but pays for
  // armor with no predator present. It still improves on its crowded producer
  // parent; its lower efficiency cannot justify another identity in this niche.
  state.species[0].genome.armor = 2;
  state.species[0].candidates[0].genome.armor = 2;
  const model = restoreLifeModel(world, state);
  assert.ok(model.observe().species.find(row => row.id === 'species-1')
    .tendencies[0].locations.some(row => row.hexId === 18));
  model.advanceTo(40);
  const snapshot = reconcile(model);
  assert.equal(snapshot.counts.species, 2);
  assert.equal(snapshot.stats.speciations, 0);
});

test('v3 broad adaptation cannot converge an existing species onto another accepted phenotype', () => {
  const world = fixture();
  const state = matureFeedingDirection(world, true).exportState();
  const producer = { ...founderGenome(), temperatureTolerance: 1, depthTolerance: 2 };
  state.species[0].genome = { ...producer, armor: 2 };
  state.species[0].candidates[0].genome = producer;
  state.species[0].candidates[0].steps = 2;
  state.species[1].genome = producer;
  state.populations.forEach(row => { row.count = 30; });
  const model = restoreLifeModel(world, state);
  assert.ok(model.observe().species.find(row => row.id === 'species-1')
    .tendencies[0].locations.some(row => row.hexId === 18), 'removing unused armor is beneficial');
  model.advanceTo(40);
  const extant = model.exportState().species.filter(row => row.extinctDay === null);
  assert.equal(new Set(extant.map(row => genomeKey(row.genome))).size, extant.length);
  assert.equal(model.observe().stats.adaptations, 0);
  assert.equal(model.observe().stats.speciations, 0);
  reconcile(model);
});

test('v3 extinction remains empty until explicit deterministic restart', () => {
  const world = fixture();
  const model = createLifeModel(world, { seed: 'v3-extinction' });
  model.introduce(0);
  model.advanceTo(360);
  assert.equal(model.observe().status, 'extinct');
  assert.equal(model.observe().counts.organisms, 0);
  assert.equal(model.observe().counts.species, 0);
  assert.equal(model.observe().counts.extinctSpecies, 1);
  assert.equal(model.inspectSpecies('species-1').population, 0);
  assert.deepEqual(model.inspectSpecies('species-1').locations, []);
  model.advanceTo(400);
  assert.equal(model.observe().status, 'extinct');
  const resumed = restoreLifeModel(world, model.exportState());
  const previousRunId = model.observe().runId;
  assert.equal(model.introduce(18).ok, true);
  assert.equal(resumed.introduce(18).ok, true);
  assert.notEqual(model.observe().runId, previousRunId);
  assert.equal(model.observe().attempt, 2);
  assert.equal(model.observe().previousAttempts.length, 1);
  assert.equal(model.observe().counts.organisms, 20);
  assert.equal(model.observe().counts.extinctSpecies, 0);
  model.advanceTo(500); resumed.advanceTo(500);
  assert.deepEqual(resumed.exportState(), model.exportState());
  reconcile(model);
});


test('v3 energy census partitions living identities and preserves optional historical counts', () => {
  const world = fixture();
  const model = createLifeModel(world);
  assert.deepEqual(model.observe().counts.speciesByEnergy,
    { photosynthesis: 0, plantFeeding: 0, animalFeeding: 0, other: 0 });
  model.introduce(18);
  const saved = model.exportState();
  const original = saved.species[0];
  // Every combination, including no intake, plus duplicate habitat/location rows.
  saved.species = Array.from({ length: 8 }, (_, bits) => ({ ...original,
    id: `diet-${bits}`, candidates: [], genomeHistory: undefined, genome: { ...founderGenome(),
      photosynthesis: bits & 1, plantFeeding: (bits >> 1) & 1, animalFeeding: (bits >> 2) & 1 } }));
  saved.populations = saved.species.flatMap(species => [18, 19].map(hexId => ({
    ...saved.populations[0], speciesId: species.id, hexId, count: 12,
  })));
  saved.nextSpecies = 9;
  const restored = restoreLifeModel(world, saved);
  const before = restored.exportState();
  const expected = { photosynthesis: 1, plantFeeding: 1, animalFeeding: 1, other: 5 };
  assert.deepEqual(restored.observe().counts.speciesByEnergy, expected);
  assert.deepEqual(restored.exportState(), before, 'observation consumes no random state');
  restored.advanceTo(1); // No biological turn; all eight established identities remain.
  const snapshot = reconcile(restored);
  assert.deepEqual(snapshot.history.at(-1).speciesByEnergy, expected);
  for (const hex of snapshot.hexes) {
    assert.equal(hex.display.length, 8, 'mixed strategies with the same size and habitat stay separate');
    for (let bits = 0; bits < 8; bits += 1) {
      const sources = ['photosynthesis', 'plantFeeding', 'animalFeeding'].filter((_, i) => bits & (1 << i));
      const group = hex.display.find(row => JSON.stringify(row.energySources) === JSON.stringify(sources));
      assert.equal(group?.population, 12);
    }
  }
  const detached = restored.observe();
  detached.hexes[0].display[0].energySources.push('external-change');
  assert.deepEqual(restored.observe(), snapshot, 'display capabilities are detached from model state');
  assert.equal(Object.values(snapshot.counts.speciesByEnergy).reduce((a, b) => a + b), snapshot.counts.species);
  const checkpoint = restored.exportState();
  assert.deepEqual(restoreLifeModel(world, checkpoint).observe(), snapshot);
  delete checkpoint.history[0].speciesByEnergy;
  const legacy = restoreLifeModel(world, checkpoint);
  assert.equal(legacy.observe().history[0].speciesByEnergy, undefined);
  legacy.advanceTo(2);
  assert.deepEqual(legacy.observe().history.at(-1).speciesByEnergy, expected);
  checkpoint.history.at(-1).speciesByEnergy.other += 1;
  assert.throws(() => restoreLifeModel(world, checkpoint), /Invalid checkpoint metadata/);
});

function frontierFixture(kind = 'coast') {
  const world = fixture();
  for (const hex of world.hexes) { hex.bedElevation = -5; hex.neighbors = []; }
  if (kind === 'river') Object.assign(world.hexes[18], { waterType: 'none', bedElevation: 0, runoff: 1 });
  else if (kind !== 'ocean') {
    Object.assign(world.hexes[19], { waterType: 'none', bedElevation: kind === 'barrier' ? 1500 : 0,
      row: kind === 'ice' ? 0 : 3 });
    world.hexes[18].neighbors = [19]; world.hexes[19].neighbors = [18];
  }
  const initial = createLifeModel(world); initial.introduce(18);
  const state = initial.exportState();
  state.species[0].genome = { ...founderGenome(), size: 1, temperatureTolerance: 1 };
  delete state.species[0].genomeHistory; // Synthetic genome has no recorded ancestry.
  state.species[0].candidates = [{ id: 'direction-1',
    genome: { ...state.species[0].genome, landAdaptation: 1 }, originDay: 0, lastEvaluation: 0,
    age: 3, support: 0, advantage: 0, steps: 1 }];
  state.populations[0].count = 400;
  state.day = 37; state.biologicalTurns = 11; state.turnCredit = 1; state.nextCandidate = 2;
  return { world, state };
}

test('v3 shoreline and river directions establish real land populations without creating organisms', () => {
  for (const kind of ['coast', 'river']) {
    const { world, state } = frontierFixture(kind);
    const model = restoreLifeModel(world, state);
    const before = model.exportState();
    const direction = model.observe().species[0].tendencies[0];
    assert.ok(direction.advantage >= EVOLUTION_RULES.minimumAdvantage);
    assert.deepEqual(direction.locations, [{ hexId: 18 }], 'the estimated opportunity belongs to an occupied source');
    assert.deepEqual(model.exportState(), before, 'frontier analysis is a pure query');
    model.advanceTo(40);
    const saved = model.exportState();
    assert.equal(saved.stats.speciations, 1);
    const child = saved.populations.find(row => row.speciesId !== 'species-1');
    assert.equal(child.habitat, 'land');
    assert.equal(child.hexId, kind === 'river' ? 18 : 19);
    assert.equal(saved.species[0].genome.landAdaptation, 0, 'the aquatic parent remains aquatic');
    assert.equal(saved.populations.reduce((sum, row) => sum + row.count, 0),
      400 + saved.stats.births - saved.stats.deaths);
    const resumed = restoreLifeModel(world, saved);
    model.advanceTo(240); resumed.advanceTo(240);
    assert.deepEqual(model.exportState(), resumed.exportState());
    reconcile(model);
  }
});

test('v3 frontier opportunity requires reachable viable habitat and sufficient source population', () => {
  for (const kind of ['ocean', 'ice', 'barrier']) {
    const { world, state } = frontierFixture(kind);
    const model = restoreLifeModel(world, state);
    model.advanceTo(40);
    assert.equal(model.observe().stats.speciations, 0, kind);
    assert.ok(model.exportState().populations.every(row => row.habitat === 'water'));
  }
  const { world, state } = frontierFixture();
  state.populations[0].count = 20;
  const small = restoreLifeModel(world, state); small.advanceTo(40);
  assert.equal(small.observe().stats.speciations, 0, 'opportunity alone cannot supply a founding population');
});

test('v3 a predator direction can establish below the prey-density split and still conserve population', () => {
  const { world, state } = frontierFixture('ocean');
  const plant = { ...state.species[0].genome };
  const grazer = { ...plant, photosynthesis: 0, plantFeeding: 1, movement: 1 };
  const predator = { ...grazer, plantFeeding: 0, animalFeeding: 1 };
  state.species[0].genome = grazer;
  Object.assign(state.species[0].candidates[0], { genome: predator, steps: 2 });
  state.species.push({ ...state.species[0], id: 'species-2', name: 'Fixture producer',
    genome: plant, candidates: [] });
  state.nextSpecies = 3;
  state.populations[0].count = 1000;
  state.populations.push({ ...state.populations[0], speciesId: 'species-2', count: 2000 });
  const model = restoreLifeModel(world, state);
  model.advanceTo(40);
  const saved = model.exportState();
  assert.equal(saved.stats.speciations, 1);
  const parent = saved.populations.find(row => row.speciesId === 'species-1');
  const child = saved.populations.find(row => row.speciesId === 'species-3');
  assert.ok(child.count >= 20 && child.count < (parent.count + child.count) * 0.25);
  const scores = evaluateCommunity({ ...world.hexes[18], ...climateAt(world, world.hexes[18], 40) }, 'water',
    saved.populations.map(row => ({ ...row, genome: saved.species.find(species => species.id === row.speciesId).genome })));
  assert.ok(scores[saved.populations.indexOf(child)].score > 0, 'the real founding density can feed itself');
  assert.equal(model.observe().counts.organisms, 3000 + saved.stats.births - saved.stats.deaths);
  reconcile(model);
});

test('v3 mobile consumers disperse preferentially toward usable food without creating population', () => {
  for (const feeding of ['plantFeeding', 'animalFeeding']) {
    const { world, state } = frontierFixture('ocean');
    world.hexes[18].neighbors = [19, 20];
    const base = createLifeModel(world); base.introduce(18);
    const checkpoint = base.exportState();
    const plant = { ...state.species[0].genome };
    const consumer = { ...plant, photosynthesis: 0, [feeding]: 1, movement: 1 };
    checkpoint.species[0].genome = consumer;
    delete checkpoint.species[0].genomeHistory; // Synthetic genome has no recorded ancestry.
    checkpoint.populations[0].count = 1000;
    checkpoint.species.push({ ...checkpoint.species[0], id: 'species-2', name: 'Fixture food',
      genome: feeding === 'plantFeeding' ? plant : { ...plant, photosynthesis: 0, plantFeeding: 1 } });
    checkpoint.populations.push({ ...checkpoint.populations[0], speciesId: 'species-2', hexId: 19, count: 1000 });
    checkpoint.nextSpecies = 3;
    const model = restoreLifeModel(world, checkpoint);
    model.advanceTo(4);
    const saved = model.exportState();
    const arrivals = hexId => saved.populations.find(row => row.speciesId === 'species-1' && row.hexId === hexId)?.count ?? 0;
    assert.ok(arrivals(19) > 5 * arrivals(20), feeding);
    assert.equal(model.observe().counts.organisms, 2000 + saved.stats.births - saved.stats.deaths);
  }
});
