import test from 'node:test';
import assert from 'node:assert/strict';
import { assignClimate } from '../../src/simulation/climate.js';
import { createGrid } from '../../src/simulation/grid.js';
import { createLifeModel, restoreLifeModel } from '../../src/simulation/life/v2/model.js';
import { createLifeModel as createV1 } from '../../src/simulation/life/v1/model.js';
import { founderGenome, deriveGenome } from '../../src/simulation/life/v2/genes/genome.js';

function fixture() {
  return assignClimate({ width: 6, height: 7, day: 0, seed: 'v2-fixture', version: 'fixture',
    hexes: createGrid(6, 7).map(hex => ({ ...hex, bedElevation: -100,
      waterType: 'sea', waterLevel: 0, runoff: 0, downstream: null, distanceToWater: 0 })) });
}
function reconcile(snapshot) {
  assert.equal(snapshot.countQuality, 'exact');
  assert.equal(snapshot.counts.organisms, snapshot.hexes.reduce((sum, row) => sum + row.population, 0));
  assert.equal(snapshot.counts.organisms, snapshot.species.reduce((sum, row) => sum + row.population, 0));
  assert.equal(snapshot.counts.species, snapshot.species.length);
  for (const species of snapshot.species) {
    assert.equal(species.population, species.variants.reduce((sum, row) => sum + row.population, 0));
    assert.equal(species.population, species.locations.reduce((sum, row) => sum + row.population, 0));
    for (const trait of species.traits) for (const expression of trait.expressions) {
      assert.equal(expression.population, expression.locations.reduce((sum, row) => sum + row.population, 0));
    }
  }
}

test('v2 is a separate deterministic model with detached observations and complete resume', () => {
  const world = fixture();
  const before = JSON.stringify(world);
  const a = createLifeModel(world);
  const b = createLifeModel(world);
  assert.equal(a.observe().modelId, 'v2');
  assert.equal(a.introduce(18).ok, true);
  b.introduce(18);
  const rejected = a.exportState();
  assert.equal(a.introduce(19).ok, false);
  assert.deepEqual(a.exportState(), rejected);
  a.advanceTo(360);
  for (let day = 1; day <= 360; day += 1) b.advanceTo(day);
  assert.deepEqual(a.exportState(), b.exportState());
  assert.equal(a.observe().biologicalTurns, 108);
  const checkpoint = a.exportState();
  const resumed = restoreLifeModel(world, checkpoint);
  a.advanceTo(720); resumed.advanceTo(720);
  assert.deepEqual(a.exportState(), resumed.exportState());
  reconcile(a.observe());
  const stable = a.exportState();
  const snapshot = a.observe();
  snapshot.species[0].variants[0].traits[0].value = 999;
  a.inspectHex(18); a.inspectSpecies('species-1');
  assert.deepEqual(a.exportState(), stable);
  assert.equal(JSON.stringify(world), before);
  assert.throws(() => restoreLifeModel(world, createV1(world).exportState()), /Incompatible/);
});

test('waiting barrier carriers retain one physical location and resume their actual delay', () => {
  const world = fixture();
  const model = createLifeModel(world);
  model.introduce(18);
  const state = model.exportState();
  state.cohorts[0].count = 100;
  state.cohorts[0].transit = { hexId: 21, habitat: 'water', dueTurn: 6, probability: 1 };
  const travelling = restoreLifeModel(world, state);
  travelling.advanceTo(17);
  assert.equal(travelling.observe().biologicalTurns, 5);
  assert.equal(travelling.observe().hexes.length, 1);
  assert.equal(travelling.observe().hexes[0].hexId, 18);
  assert.equal(travelling.observe().stats.births, 0, 'waiting carriers cannot reproduce');
  reconcile(travelling.observe());
  const resumed = restoreLifeModel(world, travelling.exportState());
  travelling.advanceTo(20); resumed.advanceTo(20);
  assert.deepEqual(travelling.exportState(), resumed.exportState());
  assert.ok(travelling.observe().stats.barrierArrivals > 0);
  assert.ok(travelling.inspectHex(21).population > 0);
  reconcile(travelling.observe());
});

test('sexual reproduction recombines local conspecific genomes and accounts for real offspring', () => {
  const world = fixture();
  const model = createLifeModel(world);
  model.introduce(18);
  const state = model.exportState();
  const a = { ...founderGenome(), temperatureTolerance: 2, sexualReproduction: 1, poison: 1 };
  const b = { ...founderGenome(), temperatureTolerance: 2, sexualReproduction: 1, spines: 1 };
  state.genomes = [a, b].map((genome, index) => ({ id: `variant-${index + 1}`, genome,
    parentGenomeId: null, originDay: 0, establishedOrder: index + 1 }));
  state.nextGenome = 3; state.nextEstablished = 3;
  state.cohorts = state.genomes.map(record => ({ ...state.cohorts[0], genomeId: record.id, count: 12,
    energy: deriveGenome(record.genome).cells }));
  const sexual = restoreLifeModel(world, state);
  sexual.advanceTo(4);
  assert.ok(sexual.observe().stats.sexualBirths > 0);
  assert.ok(sexual.exportState().genomes.some(record => record.genome.poison === 1 && record.genome.spines === 1));
  assert.equal(sexual.observe().counts.organisms, 24 + sexual.observe().stats.births - sexual.observe().stats.deaths);
  reconcile(sexual.observe());
});

test('background turnover and baseline mutation remain active without predators', () => {
  const world = fixture();
  const model = createLifeModel(world, { seed: 'baseline-drift' });
  model.introduce(18);
  model.advanceTo(1800);
  const snapshot = model.observe();
  assert.ok(snapshot.stats.births > 0);
  assert.ok(snapshot.stats.deaths > 0);
  assert.ok(snapshot.stats.mutations > 0);
  assert.equal(snapshot.counts.organisms, 20 + snapshot.stats.births - snapshot.stats.deaths);
  reconcile(snapshot);
});
