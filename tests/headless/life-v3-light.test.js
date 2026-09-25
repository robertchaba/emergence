import test from 'node:test';
import assert from 'node:assert/strict';
import { assignClimate, climateAt } from '../../src/simulation/climate.js';
import { createGrid } from '../../src/simulation/grid.js';
import { createLifeModel, restoreLifeModel } from '../../src/simulation/life/v3/model.js';
import { allocateLight, evaluateCommunity } from '../../src/simulation/life/v3/ecology.js';
import { lightCompetitionFixture } from '../fixtures/light-competition.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test('light shares match gross allocation, include mixed feeders and hide unused light', async () => {
  const { world, checkpoint, hexIds } = lightCompetitionFixture();
  const model = restoreLifeModel(world, checkpoint);
  const before = model.exportState();
  const observation = model.observe({ detail: 'summary' });
  const saturated = observation.hexes.find(hex => hex.hexId === hexIds[0]);
  const physical = world.hexes[hexIds[0]];
  const climate = { ...physical, ...climateAt(world, physical, checkpoint.day) };
  const rows = checkpoint.populations.filter(row => row.hexId === physical.id).map(row => ({
    ...row, population: row.count, genome: checkpoint.species.find(record => record.id === row.speciesId).genome,
  }));
  const rates = evaluateCommunity(climate, 'water', rows);
  rows.forEach((row, index) => {
    const actual = saturated.species.find(record => record.id === row.speciesId);
    if (row.genome.photosynthesis) close(actual.lightShare, rates[index].grossProduction * row.count / rates[index].resourceBudget);
    else assert.equal(actual.lightShare, undefined, 'grazers do not receive a light percentage');
  });
  assert.ok(rates[0].production < rates[0].grossProduction, 'fixture distinguishes light capture from retained energy after grazing');
  close(saturated.species.reduce((sum, row) => sum + (row.lightShare ?? 0), 0), 1);
  assert.ok(observation.hexes.find(hex => hex.hexId === hexIds[1]).species.every(row => row.lightShare === undefined));
  assert.deepEqual(model.inspectHex(hexIds[0]), { runId: observation.runId, revision: observation.revision, day: observation.day, ...saturated });
  assert.deepEqual(model.observe().hexes, observation.hexes);
  assert.deepEqual((await model.observeAsync(() => { throw new Error('No range jobs expected'); }, { detail: 'summary' })).hexes, observation.hexes);
  saturated.species[0].lightShare = -1;
  assert.ok(model.inspectHex(hexIds[0]).species[0].lightShare >= 0, 'shares are detached');
  assert.deepEqual(model.exportState(), before, 'inspection changes no state or random draws');
  model.advanceTo(10);
  const baseline = restoreLifeModel(world, before);
  baseline.advanceTo(10);
  assert.deepEqual(model.exportState(), baseline.exportState());
  assert.deepEqual(model.observe().hexes, baseline.observe().hexes);
});

test('light exhaustion requires actual capacity, including exact equality, before rounding', () => {
  const hex = { waterType: 'none', runoff: 0 };
  const row = { population: 1500, environment: 1,
    derived: { cells: 1, photosynthesisShare: 1, landCompetition: 1 } };
  const exact = allocateLight(hex, 'land', [row]);
  assert.equal(exact.exhausted, true);
  assert.equal(exact.allocations[0], exact.budget);
  assert.equal(allocateLight(hex, 'land', [{ ...row, population: 1499.999 }]).exhausted, false);
  assert.equal(allocateLight(hex, 'land', [{ ...row, environment: 0 }]).exhausted, false);
  assert.equal(allocateLight(hex, 'land', []).exhausted, false);
  const tall = { ...row, derived: { ...row.derived, landCompetition: 3 } };
  const contested = allocateLight(hex, 'land', [row, tall]);
  close(contested.allocations[0] / contested.budget, 0.25);
  close(contested.allocations[1] / contested.budget, 0.75);
  const capped = allocateLight(hex, 'land', [{ ...tall, population: 100 }, row]);
  assert.equal(capped.allocations[0], 160, 'a competitive canopy cannot exceed its own demand');
});

test('a river shows shares only when both habitat budgets are used and aggregates the same species', () => {
  const world = assignClimate({ width: 3, height: 3, day: 0, seed: 'light-river', version: 'fixture',
    hexes: createGrid(3, 3).map(hex => ({ ...hex, bedElevation: 0, waterType: 'none',
      waterLevel: 0, runoff: 1, downstream: null, distanceToWater: 0 })) });
  const base = createLifeModel(world);
  base.introduce(4);
  const state = base.exportState();
  state.species[0].genome.landAdaptation = 1;
  state.species[0].genomeHistory = undefined;
  state.populations = [{ ...state.populations[0], habitat: 'land', count: 1000000 }];
  assert.equal(restoreLifeModel(world, state).inspectHex(4).species[0].lightShare, undefined, 'unused river water prevents whole-hex exhaustion');
  state.populations.push({ ...state.populations[0], habitat: 'water' });
  close(restoreLifeModel(world, state).inspectHex(4).species[0].lightShare, 1);
  state.species.push({ ...state.species[0], id: 'species-2', name: 'River water' });
  state.nextSpecies = 3;
  state.populations[1].speciesId = 'species-2';
  const species = restoreLifeModel(world, state).inspectHex(4).species;
  const landBudget = 2400 * 0.7;
  const waterBudget = 2000 * 0.3;
  close(species.find(row => row.id === 'species-1').lightShare, landBudget / (landBudget + waterBudget));
  close(species.find(row => row.id === 'species-2').lightShare, waterBudget / (landBudget + waterBudget));
  state.populations[1].count = 1;
  assert.ok(restoreLifeModel(world, state).inspectHex(4).species.every(row => row.lightShare === undefined));
});
