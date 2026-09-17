import assert from 'node:assert/strict';
import test from 'node:test';
import { founderGenome } from '../../src/simulation/life/v2/genes/genome.js';
import { supportsHabitat, habitatFactor, canCross } from '../../src/simulation/life/v2/habitat.js';
import { dispersalRoutes } from '../../src/simulation/life/v2/dispersal.js';
import { acquisitionSignature, classify, ISOLATION_RULES } from '../../src/simulation/life/v2/classification.js';

const genome = (changes = {}) => ({ ...founderGenome(), size: 1, landAdaptation: 3, ...changes });
const hex = (id, changes = {}) => ({ id, waterType: 'none', bedElevation: 20, waterLevel: 0,
  runoff: 0, downstream: null, neighbors: [], permanentIce: false, humidity: 0.7,
  temperature: 20, ...changes });
const line = (length) => Array.from({ length }, (_, id) => hex(id,
  { neighbors: [id - 1, id + 1].filter((neighbor) => neighbor >= 0 && neighbor < length) }));
const islands = () => line(3).map((cell) => cell.id === 1
  ? { ...cell, waterType: 'sea', bedElevation: -100 } : cell);
const cohort = (hexId, genomeId, count = 30, changes = {}) => ({ hexId, genomeId, count,
  speciesId: 'species-1', habitat: 'land', groupId: null, ...changes });
const records = (entries) => new Map(entries.map(([id, value], index) => [id,
  { genome: value, establishedOrder: index + 1 }]));
const classifier = () => ({ groups: [], timers: {}, nextGroup: 1 });

test('v2 land and water have overlapping reversible adaptation steps', () => {
  const land = hex(0);
  const water = hex(1, { waterType: 'sea', bedElevation: -200 });
  const habitats = [0, 1, 2, 3].map((landAdaptation) => {
    const value = genome({ landAdaptation });
    return [supportsHabitat(value, water, 'water'), supportsHabitat(value, land, 'land')];
  });
  assert.deepEqual(habitats, [[true, false], [true, true], [true, true], [false, true]]);
  assert.equal(habitatFactor(genome({ landAdaptation: 2 }), water, 'water', false), 0.58);
  assert.ok(habitatFactor(genome({ landAdaptation: 1 }), land, 'land', false) > 0);
  assert.equal(supportsHabitat(genome(), { ...land, permanentIce: true }, 'land'), false);
  const aquatic = genome({ landAdaptation: 0 });
  assert.equal(habitatFactor(aquatic, { ...water, iceCover: 1 }, 'water', false), 0.35);
  assert.ok(habitatFactor(aquatic, { ...water, waterExposure: 0.5 }, 'water', false)
    < habitatFactor(aquatic, water, 'water', false));
});

test('v2 land plants and animals cross one water hex only through delayed routes', () => {
  const cells = islands();
  const before = JSON.stringify(cells);
  for (const movement of [0, 1]) {
    const value = genome({ movement });
    assert.equal(canCross(value, cells[0], 'land', cells[1], 'water'), false);
    const route = dispersalRoutes(value, cells[0], 'land', cells).find((entry) => entry.hexId === 2);
    assert.ok(route);
    assert.equal(route.habitat, 'land');
    assert.equal(route.delay, 180);
    assert.ok(route.probability > 0 && route.probability < 1);
    assert.equal(dispersalRoutes(value, cells[0], 'land', cells).some((entry) => entry.hexId === 1), false);
  }
  assert.equal(JSON.stringify(cells), before, 'transport never edits physical water or creates an intermediate habitat');
  const amphibious = genome({ landAdaptation: 1 });
  const normal = dispersalRoutes(amphibious, cells[0], 'land', cells);
  assert.equal(normal.find((entry) => entry.hexId === 1).delay, 0);
  assert.equal(normal.some((entry) => entry.hexId === 2), false, 'supported habitat is crossed one cell at a time');
});

test('v2 transport is bounded, bidirectional, deterministic and never instant even with flight', () => {
  const cells = islands();
  const terrestrial = genome();
  const normal = dispersalRoutes(terrestrial, cells[0], 'land', cells);
  assert.deepEqual(normal, dispersalRoutes(terrestrial, cells[0], 'land', cells));
  const precursor = dispersalRoutes(genome({ flight: 2 }), cells[0], 'land', cells);
  assert.deepEqual(precursor, normal, 'flight expression without movement does not provide powered transport');
  const flying = dispersalRoutes(genome({ flight: 2, movement: 1, skeleton: 2 }), cells[0], 'land', cells)[0];
  assert.ok(flying.delay > 0 && flying.delay < normal[0].delay);
  const armored = dispersalRoutes(genome({ flight: 2, movement: 1, skeleton: 2, armor: 3 }), cells[0], 'land', cells)[0];
  assert.ok(armored.delay > flying.delay, 'flight transport uses the same armor penalty as active movement');
  const longer = line(4).map((cell) => [1, 2].includes(cell.id)
    ? { ...cell, waterType: 'sea', bedElevation: -100 } : cell);
  assert.equal(dispersalRoutes(terrestrial, longer[0], 'land', longer).length, 0,
    'two hostile cells cannot be bypassed in one journey');
  const ponds = cells.map((cell) => cell.id === 1 ? { ...cell, waterType: 'none', bedElevation: 20 }
    : { ...cell, waterType: 'lake', bedElevation: -20 });
  const aquatic = dispersalRoutes(genome({ landAdaptation: 0 }), ponds[0], 'water', ponds);
  assert.equal(aquatic.find((entry) => entry.hexId === 2).delay, 180);
  const cliff = line(2).map((cell) => cell.id ? { ...cell, bedElevation: 1600 } : cell);
  assert.equal(canCross(terrestrial, cliff[0], 'land', cliff[1], 'land'), false);
  assert.ok(dispersalRoutes(terrestrial, cliff[0], 'land', cliff)[0].delay > 0);
});

test('v2 barrier divergence can branch without a majority exact genome and survives rare immigrants', () => {
  const cells = islands();
  const genomes = records(Array.from({ length: 6 }, (_, index) => [`g${index + 1}`, genome({ size: index + 1 })]));
  const cohorts = [cohort(0, 'g1', 8), cohort(0, 'g2', 7), cohort(0, 'g3', 7),
    cohort(2, 'g4', 8), cohort(2, 'g5', 7), cohort(2, 'g6', 7)];
  const state = classifier();
  const parents = [];
  const branch = (parent) => { parents.push(parent); return `species-${parents.length + 1}`; };
  for (let turn = 0; turn < ISOLATION_RULES.barrierTurns - 1; turn += 1) {
    classify(cohorts, genomes, cells, state, turn * 10 / 3, branch);
    if (turn === Math.floor(ISOLATION_RULES.barrierTurns / 3)) cohorts.push(cohort(2, 'g1', 1));
  }
  assert.equal(parents.length, 0);
  assert.equal(Math.max(...Object.values(state.timers)), ISOLATION_RULES.barrierTurns - 1);
  classify(cohorts, genomes, cells, state, ISOLATION_RULES.barrierTurns * 10 / 3, branch);
  assert.deepEqual(parents, ['species-1']);
  assert.equal(new Set(cohorts.map((value) => value.speciesId)).size, 2);
  assert.equal(cohorts.reduce((sum, value) => sum + value.count, 0), 45, 'classification neither creates nor removes organisms');
});

test('v2 nearby ordinary reconnection resets isolation before the branch threshold', () => {
  const cells = islands();
  const genomes = records([['a', genome()], ['b', genome({ size: 4 })]]);
  const cohorts = [cohort(0, 'a'), cohort(2, 'b')];
  const state = classifier();
  const neverBranch = () => assert.fail('a newly reconnected lineage must not branch');
  const elapsed = ISOLATION_RULES.barrierTurns - 1;
  for (let turn = 0; turn < elapsed; turn += 1) classify(cohorts, genomes, cells, state, turn, neverBranch);
  assert.equal(Math.max(...Object.values(state.timers)), elapsed);
  const reconnected = line(3);
  cohorts.push(cohort(1, 'a'));
  classify(cohorts, genomes, reconnected, state, elapsed + 1, neverBranch);
  assert.deepEqual(state.timers, {});
  assert.equal(state.groups.length, 2, 'local demes remain bounded after reconnection');
});

test('v2 distance alone requires stronger divergence and longer persistence than a barrier', () => {
  const cells = line(12);
  const genomes = records([['a', genome()], ['b', genome({ size: 3 })], ['c', genome({ size: 4 })]]);
  const cohorts = cells.map((cell) => cohort(cell.id, cell.id < 6 ? 'a' : 'b'));
  const state = classifier();
  let branches = 0;
  const branch = () => `species-${++branches + 1}`;
  for (let turn = 0; turn < 400; turn += 1) classify(cohorts, genomes, cells, state, turn, branch);
  assert.equal(branches, 0, 'two steps across connected plains are insufficient');
  for (const value of cohorts) if (value.genomeId === 'b') value.genomeId = 'c';
  for (let turn = 0; turn < ISOLATION_RULES.distanceTurns - 1; turn += 1) {
    classify(cohorts, genomes, cells, state, 400 + turn, branch);
  }
  assert.equal(branches, 0);
  assert.ok(Object.keys(state.timers).every((key) => key.endsWith('|distance')));
  classify(cohorts, genomes, cells, state, 400 + ISOLATION_RULES.distanceTurns, branch);
  assert.ok(branches > 0);
});

test('v2 isolation alone never manufactures a species, and declining divergence resets the timer', () => {
  const cells = islands();
  const genomes = records([['a', genome()], ['b', genome({ size: 4 })]]);
  const cohorts = [cohort(0, 'a'), cohort(2, 'a')];
  const state = classifier();
  const neverBranch = () => assert.fail('insufficient divergence cannot create a species');
  for (let turn = 0; turn < 400; turn += 1) classify(cohorts, genomes, cells, state, turn, neverBranch);
  assert.deepEqual(state.timers, {});
  cohorts[1].genomeId = 'b';
  classify(cohorts, genomes, cells, state, 401, neverBranch);
  assert.equal(Math.max(...Object.values(state.timers)), 1);
  cohorts[1].genomeId = 'a';
  classify(cohorts, genomes, cells, state, 402, neverBranch);
  assert.deepEqual(state.timers, {});
});

test('v2 an unoccupied nearby plain is not mistaken for an impermeable barrier', () => {
  const cells = line(3);
  const genomes = records([['a', genome()], ['b', genome({ size: 3 })]]);
  const cohorts = [cohort(0, 'a'), cohort(2, 'b')];
  const state = classifier();
  classify(cohorts, genomes, cells, state, 1, () => assert.fail('no barrier'));
  assert.equal(state.groups.length, 2);
  assert.deepEqual(state.timers, {});
});

test('v2 a persistent minority feeding niche can branch while sharing the founder hex', () => {
  const cells = line(1);
  const producer = genome();
  const grazer = genome({ photosynthesis: 0, plantFeeding: 1, detoxification: 1 });
  assert.equal(acquisitionSignature(producer), '1:0:0');
  assert.equal(acquisitionSignature(grazer), '0:1:0');
  const genomes = records([['producer', producer], ['grazer', grazer]]);
  const cohorts = [cohort(0, 'producer', 1000), cohort(0, 'grazer', 30)];
  const state = classifier();
  let branches = 0;
  const branch = () => `species-${++branches + 1}`;
  for (let turn = 0; turn < ISOLATION_RULES.ecologicalTurns - 1; turn += 1) {
    classify(cohorts, genomes, cells, state, turn, branch);
  }
  assert.equal(branches, 0, 'food-system change never assigns a species instantly');
  assert.equal(state.groups.length, 2, 'a feeding niche need not outnumber its food');
  assert.equal(Math.max(...Object.values(state.timers)), ISOLATION_RULES.ecologicalTurns - 1);
  assert.ok(Object.keys(state.timers).every((key) => key.endsWith('|ecological')));
  classify(cohorts, genomes, cells, state, ISOLATION_RULES.ecologicalTurns, branch);
  assert.equal(branches, 1);
  assert.equal(cohorts[0].speciesId, 'species-1');
  assert.equal(cohorts[1].speciesId, 'species-2');
  assert.equal(cohorts.reduce((sum, value) => sum + value.count, 0), 1030);
});

test('v2 ecological isolation needs three changes and resets with a lost niche or insufficient population', () => {
  const cells = line(1);
  const genomes = records([['producer', genome()],
    ['mixed', genome({ plantFeeding: 1 })],
    ['grazer', genome({ photosynthesis: 0, plantFeeding: 1, detoxification: 1 })],
    ['converged', genome({ detoxification: 3 })]]);
  const cohorts = [cohort(0, 'producer', 1000), cohort(0, 'mixed', 30)];
  const state = classifier();
  const neverBranch = () => assert.fail('insufficient ecological divergence or persistence');
  for (let turn = 0; turn < 400; turn += 1) classify(cohorts, genomes, cells, state, turn, neverBranch);
  assert.deepEqual(state.timers, {}, 'one acquired feeding gene is insufficient');
  cohorts[1].genomeId = 'grazer';
  const elapsed = ISOLATION_RULES.ecologicalTurns - 1;
  for (let turn = 0; turn < elapsed; turn += 1) classify(cohorts, genomes, cells, state, 400 + turn, neverBranch);
  assert.equal(Math.max(...Object.values(state.timers)), elapsed);
  cohorts[1].genomeId = 'converged';
  classify(cohorts, genomes, cells, state, 401 + elapsed, neverBranch);
  assert.deepEqual(state.timers, {}, 'loss of feeding-system isolation clears persistence');
  cohorts[1].genomeId = 'grazer';
  classify(cohorts, genomes, cells, state, 402 + elapsed, neverBranch);
  assert.equal(Math.max(...Object.values(state.timers)), 1, 'a returned niche must qualify afresh');
  cohorts[1].count = ISOLATION_RULES.minimumPopulation - 1;
  classify(cohorts, genomes, cells, state, 403 + elapsed, neverBranch);
  assert.deepEqual(state.timers, {});
});

test('v2 one connected ecological lineage receives one species identity across its local demes', () => {
  const cells = line(5);
  const genomes = records([['producer', genome()],
    ['grazer', genome({ photosynthesis: 0, plantFeeding: 1, detoxification: 1 })]]);
  const cohorts = cells.flatMap((cell) => [cohort(cell.id, 'producer', 100), cohort(cell.id, 'grazer', 30)]);
  const state = classifier();
  let branches = 0;
  const branch = () => `species-${++branches + 1}`;
  for (let turn = 0; turn < ISOLATION_RULES.ecologicalTurns; turn += 1) {
    classify(cohorts, genomes, cells, state, turn, branch);
  }
  assert.equal(branches, 1, 'a contiguous new feeding niche is not split once per local deme');
  assert.deepEqual(new Set(cohorts.filter((value) => value.genomeId === 'grazer').map((value) => value.speciesId)),
    new Set(['species-2']));
  assert.ok(cohorts.filter((value) => value.genomeId === 'producer').every((value) => value.speciesId === 'species-1'));
});

test('v2 established species keep separate identities after contact and genetic convergence', () => {
  const cells = islands();
  const genomes = records([['a', genome()], ['b', genome({ size: 4 })]]);
  const cohorts = [cohort(0, 'a'), cohort(2, 'b')];
  const state = classifier();
  let branches = 0;
  for (let turn = 0; turn < ISOLATION_RULES.barrierTurns; turn += 1) {
    classify(cohorts, genomes, cells, state, turn, () => `species-${++branches + 1}`);
  }
  assert.equal(branches, 1);
  const species = cohorts.map((row) => row.speciesId);
  cohorts[1].hexId = 0;
  cohorts[1].genomeId = 'a';
  for (let turn = 0; turn < ISOLATION_RULES.distanceTurns; turn += 1) {
    classify(cohorts, genomes, cells, state, ISOLATION_RULES.barrierTurns + turn,
      () => assert.fail('contact alone cannot branch either established species'));
  }
  assert.deepEqual(cohorts.map((row) => row.speciesId), species);
  assert.equal(new Set(species).size, 2);
  assert.equal(cohorts.reduce((sum, row) => sum + row.count, 0), 60);
});
