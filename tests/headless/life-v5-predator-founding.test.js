import assert from 'node:assert/strict';
import test from 'node:test';
import { assignClimate, climateAt } from '../../src/simulation/climate.js';
import { createGrid } from '../../src/simulation/grid.js';
import { createLifeModel, restoreLifeModel, EVOLUTION_RULES } from '../../src/simulation/life/v5/model.js';
import { founderGenome } from '../../src/simulation/life/v5/genes/genome.js';
import { evaluateCommunity, scoreSpecies } from '../../src/simulation/life/v5/ecology.js';

const plant = changes => ({ ...founderGenome(), size: 1, temperatureTolerance: 1, ...changes });
const grazer = changes => plant({ photosynthesis: 0, plantFeeding: 1, movement: 1, ...changes });
const predator = changes => grazer({ plantFeeding: 0, animalFeeding: 1, ...changes });

function fixture({ parent = grazer(), candidate = predator(), parentCount = 80,
  plantCount = 48, locations = [18], extraPrey = 0, steps = 2 } = {}) {
  const world = assignClimate({ width: 12, height: 3, day: 0, seed: 'v5-founding-fixture', version: 'fixture',
    hexes: createGrid(12, 3).map(hex => ({ ...hex, bedElevation: -5, waterType: 'sea',
      waterLevel: 0, runoff: 0, downstream: null, distanceToWater: 0, neighbors: [] })) });
  const initial = createLifeModel(world, { seed: 'v5-predator-founding' });
  initial.introduce(18);
  const state = initial.exportState();
  const base = state.species[0];
  delete base.genomeHistory; // Synthetic fixture has no invented accepted history.
  base.genome = parent;
  base.candidates = [{ id: 'direction-1', genome: candidate, originDay: 0, lastEvaluation: 0,
    age: EVOLUTION_RULES.persistenceAssessments - 1, support: 1, advantage: 0.05, steps }];
  const population = state.populations[0];
  state.populations = locations.map(hexId => ({ ...population, hexId, count: parentCount }));
  for (const [genome, count] of [[plant(), plantCount], [grazer(), extraPrey]]) {
    if (!count) continue;
    const id = `species-${state.species.length + 1}`;
    state.species.push({ ...base, id, genome, candidates: [] });
    state.populations.push(...locations.map(hexId => ({ ...population, hexId, speciesId: id, count })));
  }
  state.nextSpecies = state.species.length + 1;
  state.nextCandidate = 2;
  state.day = 37; state.biologicalTurns = 11; state.turnCredit = 1;
  return { world, state, candidate, nextId: `species-${state.nextSpecies}` };
}

function run(fixture) {
  const model = restoreLifeModel(fixture.world, fixture.state);
  model.advanceTo(40);
  const saved = model.exportState();
  assert.equal(saved.populations.reduce((sum, row) => sum + row.count, 0),
    fixture.state.populations.reduce((sum, row) => sum + row.count, 0) + saved.stats.births - saved.stats.deaths,
    'founders are transferred from parents without creating organisms');
  return { model, saved, children: saved.populations.filter(row => row.speciesId === fixture.nextId) };
}

function localScores(world, state, hexId) {
  const rows = state.populations.filter(row => row.hexId === hexId);
  const environment = { ...world.hexes[hexId], ...climateAt(world, world.hexes[hexId], 40) };
  return { rows, environment, community: rows.map(row => ({ ...row,
    genome: state.species.find(record => record.id === row.speciesId).genome })) };
}

test('V5 a prey-funded predator lineage can establish with fewer than twenty founders', () => {
  const setup = fixture();
  const { model, saved, children } = run(setup);
  const count = children.reduce((sum, row) => sum + row.count, 0);
  assert.equal(saved.stats.speciations, 1);
  assert.ok(count >= EVOLUTION_RULES.minimumPredatorPopulation && count < EVOLUTION_RULES.minimumPopulation);
  const { rows, environment, community } = localScores(setup.world, saved, 18);
  const scores = evaluateCommunity(environment, 'water', community);
  const childScore = scores[rows.findIndex(row => row.speciesId === setup.nextId)];
  assert.ok(childScore.score > 0 && childScore.predationFood > 0, 'actual founding density has real prey income');
  assert.ok(scores[rows.findIndex(row => row.speciesId === 'species-1')].predationLoss > 0);
  const restored = restoreLifeModel(setup.world, saved);
  model.advanceTo(80); restored.advanceTo(80);
  assert.deepEqual(restored.exportState(), model.exportState());
});

test('V5 sparse local parents can supply distinct singleton predators without emptying their source', () => {
  const setup = fixture({ parent: grazer({ size: 3 }), candidate: predator({ size: 3 }),
    parentCount: 3, plantCount: 60, extraPrey: 100,
    locations: Array.from({ length: 12 }, (_, index) => index + 12) });
  const { saved, children } = run(setup);
  assert.equal(saved.stats.speciations, 1);
  assert.ok(children.length >= EVOLUTION_RULES.minimumPredatorPopulation);
  assert.ok(children.every(row => row.count === 1), 'all fractional transfers rounded to zero');
  for (const child of children) {
    assert.ok(saved.populations.some(row => row.speciesId === 'species-1' && row.hexId === child.hexId && row.count >= 1));
    const { rows, environment, community } = localScores(setup.world, saved, child.hexId);
    const score = evaluateCommunity(environment, 'water', community)[rows.findIndex(row => row.speciesId === setup.nextId)];
    assert.ok(score.score > 0 && score.predationFood > 0);
  }
});

test('V5 predator founding still needs twenty supported parents and actual prey', () => {
  const unsupported = fixture({ parent: grazer({ size: 3 }), candidate: predator({ size: 3 }),
    parentCount: 3, plantCount: 60, extraPrey: 100,
    locations: Array.from({ length: 6 }, (_, index) => index + 12) });
  const supportResult = run(unsupported);
  assert.equal(supportResult.saved.stats.speciations, 0);
  assert.equal(supportResult.children.length, 0);
  const noPrey = fixture({ parent: plant(), candidate: predator(), plantCount: 0 });
  const { environment, community } = localScores(noPrey.world, noPrey.state, 18);
  const score = scoreSpecies(noPrey.candidate, environment, 'water', community,
    { excludeSpeciesId: 'species-1', independentLineage: true });
  assert.equal(score.predationFood, 0);
  assert.ok(score.score < 0);
  const noFoodResult = run(noPrey);
  assert.equal(noFoodResult.saved.stats.speciations, 0);
  assert.equal(noFoodResult.children.length, 0);
});

test('V5 an unused animal-feeding gene does not lower ordinary lineage founding requirements', () => {
  const setup = fixture({ parent: plant({ size: 10 }),
    candidate: grazer({ size: 7, animalFeeding: 1 }), parentCount: 60, plantCount: 0,
    locations: [12, 13, 14, 15], steps: 7 });
  const { environment, community } = localScores(setup.world, setup.state, 12);
  const projected = [{ ...community[0], count: 57 }, { speciesId: 'child', genome: setup.candidate, count: 3 }];
  const score = evaluateCommunity(environment, 'water', projected).at(-1);
  assert.ok(score.score > 0 && score.grazingFood > 0, 'small founders can live on real plant food');
  assert.equal(score.predationFood, 0, 'no prey funds this animal-feeding capability');
  const { saved, children } = run(setup);
  assert.equal(saved.stats.speciations, 0, 'twelve plant-funded founders retain the ordinary twenty-founder requirement');
  assert.equal(children.length, 0);
});

test('V5 ordinary grazer branches still require twenty founders', () => {
  for (const [parentCount, branches] of [[60, 0], [100, 1]]) {
    const setup = fixture({ parent: plant(), candidate: grazer(), parentCount, plantCount: 0, steps: 3 });
    const { saved, children } = run(setup);
    assert.equal(saved.stats.speciations, branches);
    if (branches) assert.ok(children.reduce((sum, row) => sum + row.count, 0) >= EVOLUTION_RULES.minimumPopulation);
  }
});
