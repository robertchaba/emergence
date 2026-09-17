import test from 'node:test';
import assert from 'node:assert/strict';
import { assignClimate } from '../../src/simulation/climate.js';
import { createGrid } from '../../src/simulation/grid.js';
import { createLifeModel, restoreLifeModel } from '../../src/simulation/life/v2/model.js';
import { founderGenome, deriveGenome } from '../../src/simulation/life/v2/genes/genome.js';

function fixture() {
  return assignClimate({ width: 6, height: 7, day: 0, seed: 'interactions-v2', version: 'fixture',
    hexes: createGrid(6, 7).map(hex => ({ ...hex, bedElevation: -100, waterType: 'sea',
      waterLevel: 0, runoff: 0, downstream: null, distanceToWater: 0 })) });
}

function population(world, groups, seed = 'interaction-check') {
  const original = createLifeModel(world, { seed, energyQuantum: 0 });
  original.introduce(18);
  const saved = original.exportState();
  const template = saved.cohorts[0];
  saved.genomes = groups.map(({ genome }, index) => ({ id: `variant-${index + 1}`, genome,
    parentGenomeId: null, originDay: 0, establishedOrder: index + 1 }));
  saved.cohorts = groups.map(({ count, energy, transit }, index) => ({ ...template,
    genomeId: saved.genomes[index].id, count, energy,
    ...(transit ? { transit: { ...transit } } : {}) }));
  saved.nextGenome = groups.length + 1;
  saved.nextEstablished = groups.length + 1;
  return restoreLifeModel(world, saved);
}

test('a survivor cannot reproduce sexually using partners that starved during the same turn', () => {
  const world = fixture();
  const producer = { ...founderGenome(), temperatureTolerance: 2, sexualReproduction: 1 };
  const starving = { ...producer, photosynthesis: 0 };
  for (const seed of ['dead-mate-check', 'dead-mate-check-2', 'dead-mate-check-3']) {
    const model = population(world, [
      { genome: producer, count: 1, energy: deriveGenome(producer).cells },
      { genome: starving, count: 1000, energy: 0 },
    ], seed);
    model.advanceTo(4);
    const snapshot = model.observe();
    assert.ok(snapshot.stats.deaths >= 1000);
    assert.equal(snapshot.stats.sexualBirths, 0, 'The only surviving sexual organism has no living partner');
    assert.equal(snapshot.counts.organisms, 1001 + snapshot.stats.births - snapshot.stats.deaths);
  }
});

test('grazing, reciprocal predation and reproduction preserve population and cannot manufacture energy', () => {
  const world = fixture();
  const producer = { ...founderGenome(), size: 2, temperatureTolerance: 2 };
  const grazer = { ...producer, photosynthesis: 0, plantFeeding: 1, poison: 1 };
  const predator = { ...grazer, plantFeeding: 0, animalFeeding: 1, biteForce: 1, detoxification: 1 };
  const mixed = { ...producer, plantFeeding: 1, animalFeeding: 1 };
  const groups = [producer, grazer, predator, mixed].map(genome => ({ genome, count: 35,
    energy: deriveGenome(genome).cells }));
  const model = population(world, groups, 'energy-and-counts');
  const energy = checkpoint => {
    const traits = new Map(checkpoint.genomes.map(record => [record.id, deriveGenome(record.genome)]));
    return checkpoint.cohorts.reduce((sum, cohort) => sum + cohort.count * (cohort.energy + traits.get(cohort.genomeId).cells), 0);
  };
  let previous = model.exportState();
  for (const day of [4, 7, 10, 14, 17, 20, 24, 27, 30]) {
    const occupied = new Set(previous.cohorts.map(cohort => cohort.hexId)).size;
    model.advanceTo(day);
    const after = model.exportState();
    const observation = model.observe();
    assert.equal(observation.counts.organisms, 140 + observation.stats.births - observation.stats.deaths);
    assert.ok(after.cohorts.every(cohort => Number.isSafeInteger(cohort.count) && cohort.count > 0 && cohort.energy >= 0));
    // Movement can disperse light collectors into at most six new neighbors per
    // occupied hex. This deliberately loose bound detects energy creation while
    // remaining independent of exact encounter outcomes and recruitment costs.
    assert.ok(energy(after) <= energy(previous) + occupied * 7 * 2000 * 2.4 + 1e-8);
    previous = after;
  }
  assert.ok(model.observe().stats.predationDeaths > 0, 'Fixture exercises real predation');
  const resumed = restoreLifeModel(world, model.exportState());
  model.advanceTo(60); resumed.advanceTo(60);
  assert.deepEqual(model.exportState(), resumed.exportState());
});

test('malformed pending barrier passages are rejected when restoring a checkpoint', () => {
  const world = fixture();
  const model = createLifeModel(world);
  model.introduce(18);
  for (const invalid of [
    { hexId: 999, habitat: 'water', dueTurn: 2, probability: 0.5 },
    { hexId: 21, habitat: 'air', dueTurn: 2, probability: 0.5 },
    { hexId: 21, habitat: 'water', dueTurn: -1, probability: 0.5 },
    { hexId: 21, habitat: 'water', dueTurn: 1.5, probability: 0.5 },
    { hexId: 21, habitat: 'water', dueTurn: 2, probability: -0.1 },
    { hexId: 21, habitat: 'water', dueTurn: 2, probability: 1.1 },
  ]) {
    const saved = model.exportState();
    saved.cohorts[0].transit = invalid;
    assert.throws(() => restoreLifeModel(world, saved), /Invalid checkpoint/, JSON.stringify(invalid));
  }
});

test('cannibal predators cannot leave phantom hunting turns after their cohort is depleted', () => {
  const world = fixture();
  const predator = { ...founderGenome(), photosynthesis: 0, animalFeeding: 1, temperatureTolerance: 2,
    biteForce: 3, eyesight: 3, echolocation: 3, thermalSensing: 3 };
  const model = population(world, [{ genome: predator, count: 12, energy: deriveGenome(predator).cells }], 'self-hunt-101');
  model.advanceTo(4);
  const observation = model.observe();
  assert.ok(observation.stats.predationDeaths > 0);
  assert.equal(observation.counts.organisms, 12 + observation.stats.births - observation.stats.deaths);
  assert.ok(model.exportState().cohorts.every(cohort => cohort.count > 0));
});
