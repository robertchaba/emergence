import test from 'node:test';
import assert from 'node:assert/strict';
import { assignClimate } from '../../src/simulation/climate.js';
import { createGrid } from '../../src/simulation/grid.js';
import { createLifeModel, restoreLifeModel } from '../../src/simulation/life/v5/model.js';
import { createLifeModel as createV4, restoreLifeModel as restoreV4 } from '../../src/simulation/life/v4/model.js';
import { TRAITS, founderGenome, validateGenome } from '../../src/simulation/life/v5/genes/genome.js';
import { evaluateObservationJobs } from '../../src/simulation/life/v5/observation-jobs.js';

const additions = ['treeClimbing', 'fallenForaging', 'branchPulling', 'longReach', 'streamlining'];
function fixture() {
  return assignClimate({ width: 6, height: 7, day: 0, seed: 'v5-fixture', version: 'fixture',
    hexes: createGrid(6, 7).map(hex => ({ ...hex, bedElevation: -100,
      waterType: 'sea', waterLevel: 0, runoff: 0, downstream: null, distanceToWater: 0 })) });
}

function reconcile(model) {
  const observation = model.observe();
  assert.equal(observation.modelId, 'v5');
  assert.equal(observation.countQuality, 'exact');
  assert.equal(observation.counts.organisms, observation.hexes.reduce((sum, hex) => sum + hex.population, 0));
  assert.equal(observation.counts.organisms, observation.species.reduce((sum, species) => sum + species.population, 0));
  assert.equal(observation.counts.organisms, 20 + observation.stats.births - observation.stats.deaths);
  for (const species of observation.species) {
    assert.equal(species.population, species.locations.reduce((sum, location) => sum + location.population, 0));
    for (const location of species.locations) assert.equal(location.population,
      observation.hexes.find(hex => hex.hexId === location.hexId).species.find(row => row.id === species.id).population);
  }
  assert.equal(observation.counts.species, observation.species.length);
  assert.equal(observation.counts.occupiedHexes, observation.hexes.length);
  return observation;
}

test('V5 identifies a separate life model, rejects V4 saves in both directions and preserves atomic introduction', () => {
  const world = fixture();
  const physical = structuredClone(world);
  const model = createLifeModel(world);
  const empty = model.exportState();
  assert.equal(model.introduce(-1).reason, 'unknown-hex');
  assert.deepEqual(model.exportState(), empty);
  assert.equal(model.introduce(18).ok, true);
  const introduced = model.exportState();
  assert.equal(introduced.modelId, 'v5');
  assert.equal(introduced.rulesRevision, 'v5-populations-2');
  assert.equal(introduced.format, 'emergence-life-v5-checkpoint-1');
  assert.equal(model.introduce(19).reason, 'already-introduced');
  assert.deepEqual(model.exportState(), introduced);
  assert.throws(() => restoreLifeModel(world, createV4(world).exportState()), /Incompatible/);
  assert.throws(() => restoreV4(world, introduced), /Incompatible/);
  assert.throws(() => restoreLifeModel(world, { ...introduced, rulesRevision: 'v5-populations-1' }), /Incompatible/);
  assert.deepEqual(world, physical);
  reconcile(model);
});

test('V5 replay and partial-turn continuation preserve biology independently of observation cadence', () => {
  const world = fixture();
  const options = { seed: 'v5-deterministic', runId: 'v5-repeatable-run' };
  const bulk = createLifeModel(world, options);
  const stepped = createLifeModel(world, options);
  bulk.introduce(18); stepped.introduce(18);
  bulk.advanceTo(241);
  for (let day = 1; day <= 241; day += 1) {
    stepped.advanceTo(day);
    if (day % 31 === 0) {
      stepped.observe(); stepped.inspectHex(18); stepped.observeTree();
      stepped.inspectGeneHistory(options.runId, 'species-1', 'treeClimbing');
    }
  }
  assert.deepEqual(stepped.exportState(), bulk.exportState());
  assert.equal(bulk.exportState().biologicalTurns, 72);
  assert.equal(bulk.exportState().turnCredit, 3);
  const resumed = restoreLifeModel(world, JSON.parse(JSON.stringify(stepped.exportState())));
  bulk.advanceTo(720); resumed.advanceTo(720);
  assert.deepEqual(resumed.exportState(), bulk.exportState());
  const snapshot = reconcile(resumed);
  const checkpoint = resumed.exportState();
  snapshot.counts.organisms = -1;
  if (snapshot.species.length) snapshot.species[0].traits[0].expressions[0].value = 999;
  assert.deepEqual(resumed.exportState(), checkpoint);
  assert.notEqual(resumed.observe().counts.organisms, -1);
  for (const species of checkpoint.species) {
    assert.equal(validateGenome(species.genome), true);
    assert.equal(Object.keys(species.genome).length, 45);
    assert.deepEqual(species.genomeHistory.at(-1).genome, species.genome);
    assert.ok(species.candidates.every(candidate => validateGenome(candidate.genome)));
  }
});

test('V5 saves require every new locus in accepted genomes, candidate genomes and accepted history', () => {
  const world = fixture();
  const model = createLifeModel(world);
  model.introduce(18);
  const checkpoint = model.exportState();
  for (const key of additions) {
    for (const [target, change] of [
      ['accepted', genome => { delete genome[key]; }],
      ['accepted', genome => { genome[key] = 4; }],
      ['history', genome => { delete genome[key]; }],
      ['history', genome => { genome[key] = -1; }],
      ['candidate', genome => { delete genome[key]; }],
      ['candidate', genome => { genome[key] = 1.5; }],
    ]) {
      const invalid = structuredClone(checkpoint);
      const record = invalid.species[0];
      if (target === 'candidate') {
        record.candidates = [{ id: 'direction-1', genome: { ...record.genome, [key]: 1 },
          originDay: 0, lastEvaluation: 0, support: 0, advantage: 0, age: 0, steps: 1 }];
        invalid.nextCandidate = 2;
      }
      change(target === 'accepted' ? record.genome : target === 'history'
        ? record.genomeHistory[0].genome : record.candidates[0].genome);
      assert.throws(() => restoreLifeModel(world, invalid), /Invalid/, `${target}: ${key}`);
    }
  }
});

test('V5 new gene histories retain appearance, loss and reappearance as detached 45-trait observations', () => {
  const world = fixture();
  const model = createLifeModel(world);
  model.introduce(18);
  const checkpoint = model.exportState();
  const initial = { ...checkpoint.species[0].genome, ...Object.fromEntries(additions.map(key => [key, 0])) };
  checkpoint.day = 10; checkpoint.biologicalTurns = 3; checkpoint.turnCredit = 0;
  const record = checkpoint.species[0];
  record.genomeRevision = 4;
  record.genomeHistory = [0, 1, 0, 3].map((value, index) => ({
    day: [0, 4, 7, 10][index], kind: index ? 'adaptation' : 'origin', revision: index + 1,
    parentRevision: null, genome: { ...initial, ...Object.fromEntries(additions.map(key => [key, value])) },
  }));
  record.genome = { ...record.genomeHistory.at(-1).genome };
  const restored = restoreLifeModel(world, checkpoint);
  const before = restored.exportState();
  for (const key of additions) {
    const trace = restored.inspectGeneHistory(checkpoint.runId, record.id, key);
    assert.equal(trace.complete, true);
    assert.equal(trace.quantitative, true);
    assert.deepEqual(trace.events.map(event => [event.day, event.trait.value, event.kind]), [
      [0, 0, 'founder'], [4, 1, 'appearance'], [7, 0, 'loss'], [10, 3, 'appearance'],
    ]);
    assert.equal(trace.firstAppearance.day, 4);
    trace.events[1].trait.value = 999;
  }
  const tree = restored.observeTree();
  assert.equal(tree.attempts[0].species[0].traits.length, TRAITS.length);
  assert.equal('genome' in tree.attempts[0].species[0], false);
  tree.attempts[0].species[0].traits[0].value = 999;
  assert.deepEqual(restored.exportState(), before);
  assert.deepEqual(restoreLifeModel(world, before).observeTree(), restored.observeTree());
});

test('V5 asynchronous new-gene scoring matches serial observations and cannot mutate continuation', async () => {
  const world = fixture();
  const initial = createLifeModel(world);
  initial.introduce(18);
  const checkpoint = initial.exportState();
  const base = checkpoint.species[0];
  const plant = { ...founderGenome(), size: 10, trunk: 10, temperatureTolerance: 1, depthTolerance: 2 };
  const consumer = { ...plant, size: 2, trunk: 0, photosynthesis: 0, plantFeeding: 1, movement: 1, biteForce: 1 };
  checkpoint.species = [
    { ...base, genomeHistory: undefined, genome: plant, candidates: [] },
    ...Array.from({ length: 11 }, (_, speciesIndex) => ({
      ...base, id: `species-${speciesIndex + 2}`, genomeHistory: undefined, genome: consumer,
      candidates: [{ treeClimbing: 1 }, { fallenForaging: 1 }, { branchPulling: 1, longReach: 1, streamlining: 1 }]
        .map((changes, index) => ({ id: `direction-${speciesIndex * 3 + index + 1}`, genome: { ...consumer, ...changes },
          originDay: 0, lastEvaluation: 0, support: 0, advantage: 0, age: 0, steps: Object.keys(changes).length })),
    })),
  ];
  checkpoint.populations = world.hexes.flatMap(hex => checkpoint.species.map(record => ({
    ...checkpoint.populations[0], hexId: hex.id, speciesId: record.id, count: 10,
  })));
  checkpoint.nextSpecies = 13; checkpoint.nextCandidate = 34;
  const serial = restoreLifeModel(world, checkpoint);
  const parallel = restoreLifeModel(world, checkpoint);
  let calls = 0;
  const execute = async jobs => {
    calls += 1;
    assert.ok(jobs.some(job => job.queries.some(query => additions.some(key => query.genome[key] > 0))));
    const batches = [jobs.filter((_, index) => index % 2 === 0), jobs.filter((_, index) => index % 2 === 1)];
    const results = batches.reverse().flatMap(batch => evaluateObservationJobs(structuredClone(batch)));
    jobs[0].hex.bedElevation = 999999;
    jobs[0].queries[0].genome.treeClimbing = 999;
    return results;
  };
  const before = parallel.exportState();
  assert.deepEqual(await parallel.observeAsync(execute), serial.observe());
  assert.equal(calls, 1);
  assert.deepEqual(parallel.exportState(), before);
  parallel.advanceTo(10); serial.advanceTo(10);
  assert.deepEqual(parallel.exportState(), serial.exportState());
  assert.deepEqual(await parallel.observeAsync(execute), serial.observe());
  assert.equal(calls, 2);
  assert.deepEqual(parallel.exportState(), serial.exportState());
  assert.equal(parallel.observe().counts.organisms,
    parallel.exportState().populations.reduce((sum, row) => sum + row.count, 0));
});
