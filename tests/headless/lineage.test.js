import test from 'node:test';
import assert from 'node:assert/strict';
import { createLifeModel, restoreLifeModel } from '../../src/simulation/life/v3/model.js';
import { lineageFixture } from '../fixtures/lineage.js';
import { layoutLifeTree } from '../../src/rendering/life-tree.js';

test('tree observations retain extinct descriptions, separate introductions and leave state untouched', () => {
  const { world, state } = lineageFixture();
  const model = restoreLifeModel(world, state);
  const before = model.exportState();
  const tree = model.observeTree();
  assert.equal(tree.attempts.length, 2);
  assert.equal(tree.attempts[0].species[0].id, tree.attempts[1].species[0].id);
  assert.equal(model.observe().previousAttempts[0].species[0].genomeHistory, undefined);
  assert.ok(model.exportState().previousAttempts[0].species[0].genomeHistory.length);
  assert.notEqual(tree.attempts[0].runId, tree.attempts[1].runId);
  const records = tree.attempts[1].species;
  assert.equal(records.length, 4);
  assert.equal(records.filter(row => row.extinctDay !== null).length, 2);
  assert.equal(records[0].population, 0);
  assert.equal(records[0].traits.length, 22);
  assert.equal(records[2].parentId, records[1].id);
  assert.equal(records[2].population, 200);
  const trace = model.inspectGeneHistory(state.runId, 'species-3', 'movement');
  trace.events[0].trait.value = 999;
  tree.attempts[1].species[0].traits[0].value = 999;
  assert.deepEqual(model.exportState(), before);
  assert.deepEqual(restoreLifeModel(world, before).observeTree(), model.observeTree());
  assert.throws(() => model.inspectGeneHistory(state.runId, 'missing', 'movement'), RangeError);
  assert.throws(() => model.inspectGeneHistory(state.runId, 'species-1', 'missing'), RangeError);
});

test('gene tracing follows parent at branching, preserves loss and reacquisition, and excludes future adaptations', () => {
  const { world, state } = lineageFixture();
  const model = restoreLifeModel(world, state);
  const trace = model.inspectGeneHistory(state.runId, 'species-3', 'movement');
  assert.equal(trace.complete, true);
  assert.deepEqual(trace.events.map(row => [row.day, row.trait.value, row.kind]), [
    [1, 0, 'founder'], [10, 1, 'appearance'], [20, 1, 'inherited'],
    [30, 0, 'loss'], [40, 1, 'appearance'], [50, 1, 'inherited'],
  ]);
  assert.equal(trace.firstAppearance.speciesId, 'species-1');
  assert.equal(trace.firstAppearance.day, 10);
  const canopy = model.inspectGeneHistory(state.runId, 'species-4', 'movement');
  assert.ok(canopy.events.some(row => row.day === 60 && row.trait.value === 2));
  const extinction = model.inspectGeneHistory(state.runId, 'species-2', 'plantFeeding');
  assert.equal(extinction.firstAppearance.speciesId, 'species-2');
  assert.equal(extinction.firstAppearance.day, 20);
  const old = model.inspectGeneHistory('earlier-run', 'species-1', 'movement');
  assert.equal(old.firstAppearance, null);
  assert.equal(old.events.length, 1);
});

test('compatible old saves have explicitly incomplete gene histories and continue deterministically', () => {
  const { world, state } = lineageFixture();
  const partial = structuredClone(state);
  delete partial.species[0].genomeHistory;
  const partialTrace = restoreLifeModel(world, partial).inspectGeneHistory(state.runId, 'species-4', 'movement');
  assert.equal(partialTrace.complete, false);
  assert.deepEqual(partialTrace.events.map(row => [row.speciesId, row.day, row.kind]), [['species-4', 80, 'branch']],
    'a missing parent history cannot be replaced with its later snapshot');
  for (const record of state.species) delete record.genomeHistory;
  const model = restoreLifeModel(world, state);
  const trace = model.inspectGeneHistory(state.runId, 'species-3', 'movement');
  assert.equal(trace.complete, false);
  assert.deepEqual(trace.events.map(row => row.kind), ['snapshot']);
  assert.equal(trace.events[0].day, 150);
  const other = restoreLifeModel(world, state);
  model.observeTree(); model.inspectGeneHistory(state.runId, 'species-1', 'photosynthesis');
  model.advanceTo(160); other.advanceTo(160);
  assert.deepEqual(model.exportState(), other.exportState());
});

test('new founders record their accepted genes and actual adaptations survive checkpoint continuation', () => {
  const { world } = lineageFixture();
  const model = createLifeModel(world, { seed: 'lineage-recording' });
  const site = world.hexes.find(hex => hex.waterType === 'none' && hex.temperature > 15 && !hex.permanentIce);
  model.introduce(site.id);
  const initial = model.exportState().species[0];
  assert.equal(initial.genomeHistory[0].kind, 'origin');
  assert.deepEqual(initial.genomeHistory[0].genome, initial.genome);
  model.advanceTo(1500);
  const checkpoint = model.exportState();
  assert.ok(checkpoint.stats.adaptations > 0 || checkpoint.stats.speciations > 0);
  for (const species of checkpoint.species) {
    assert.equal(species.genomeHistory.length, species.genomeRevision);
    assert.deepEqual(species.genomeHistory.at(-1).genome, species.genome);
    if (species.parentId) assert.ok(species.genomeHistory[0].parentRevision > 0);
  }
  const restored = restoreLifeModel(world, checkpoint);
  model.advanceTo(1600); restored.advanceTo(1600);
  assert.deepEqual(restored.exportState(), model.exportState());
});

test('restoration rejects malformed or cyclic ancestry and contradictory gene history', () => {
  const { world, state } = lineageFixture();
  for (const change of [
    saved => { saved.species[0].parentId = 'species-3'; },
    saved => { saved.species[1].parentId = 'missing'; },
    saved => { saved.species[1].genomeHistory[0].parentRevision = 99; },
    saved => { saved.species[1].genomeHistory[0].parentRevision = 3; },
    saved => { saved.species[0].genomeHistory.at(-1).genome.movement = 1; },
    saved => { saved.species[0].genomeHistory[1].day = 0; },
    saved => { saved.species[0].genomeHistory[1].revision = 9; },
    saved => { saved.previousAttempts[0].species[0].parentId = 'missing'; },
  ]) {
    const invalid = structuredClone(state); change(invalid);
    assert.throws(() => restoreLifeModel(world, invalid), TypeError);
  }
});

test('tree geometry keeps every species, including equal-day branches and long chains', () => {
  const rows = Array.from({ length: 2000 }, (_, index) => ({ id: `s${index}`, parentId: index ? `s${index - 1}` : null, originDay: 1, extinctDay: null }));
  const layout = layoutLifeTree(rows, 1);
  assert.equal(layout.rows.length, rows.length);
  assert.equal(layout.rows.at(-1).depth, 1999);
  assert.ok(layout.rows.every(row => Number.isFinite(row.x) && Number.isFinite(row.endX)));
});

test('whole-tree gene bands retain branch-specific levels, inactive gaps and legacy boundaries', () => {
  const { world, state } = lineageFixture();
  const model = restoreLifeModel(world, state);
  const before = model.exportState();
  const trace = model.inspectGeneHistory(state.runId, 'species-3', 'movement');
  assert.equal(trace.quantitative, true);
  assert.deepEqual(trace.branches.map(branch => [branch.speciesId, branch.endDay,
    branch.events.map(event => [event.day, event.trait.value, event.trait.active])]), [
    ['species-1', 100, [[1, 0, false], [10, 1, true], [60, 2, true]]],
    ['species-2', 70, [[20, 1, true], [30, 0, false], [40, 1, true]]],
    ['species-3', 150, [[50, 1, true]]],
    ['species-4', 150, [[80, 2, true]]],
  ]);
  trace.branches[0].events[1].trait.value = 99;
  assert.deepEqual(model.exportState(), before);
  for (const key of ['skeleton', 'armorType', 'landAdaptation', 'temperatureTolerance', 'photosynthesis']) {
    assert.equal(model.inspectGeneHistory(state.runId, 'species-1', key).quantitative, false);
  }
  delete state.species[0].genomeHistory;
  const partial = restoreLifeModel(world, state).inspectGeneHistory(state.runId, 'species-3', 'movement');
  assert.equal(partial.branches[0].complete, false);
  assert.deepEqual(partial.branches[0].events.map(event => event.day), [100]);
  assert.equal(partial.branches[1].complete, true);
  const earlier = model.inspectGeneHistory('earlier-run', 'species-1', 'photosynthesis');
  assert.equal(earlier.branches.length, 1);
  assert.equal(earlier.branches[0].endDay, 1);
});

test('gene lineage starts at first presence and ends ancestor bands at the inherited split', () => {
  const { world, state } = lineageFixture();
  const model = restoreLifeModel(world, state);
  const before = model.exportState();
  const trace = model.inspectGeneHistory(state.runId, 'species-3', 'movement');
  assert.deepEqual(trace.lineage.map(branch => [branch.speciesId, branch.endDay,
    branch.events.map(event => [event.day, event.trait.value])]), [
    ['species-1', 20, [[10, 1]]],
    ['species-2', 50, [[20, 1], [30, 0], [40, 1]]],
    ['species-3', 150, [[50, 1]]],
  ]);
  const firstInChild = model.inspectGeneHistory(state.runId, 'species-3', 'animalFeeding');
  assert.deepEqual(firstInChild.lineage.map(branch => branch.speciesId), ['species-3']);
  assert.equal(firstInChild.lineage[0].events[0].day, 50);
  const canopy = model.inspectGeneHistory(state.runId, 'species-4', 'movement');
  assert.deepEqual(canopy.lineage.map(branch => [branch.speciesId, branch.endDay]), [['species-1', 80], ['species-4', 150]]);
  assert.deepEqual(canopy.lineage[0].events.map(event => event.trait.value), [1, 2]);
  assert.deepEqual(model.inspectGeneHistory('earlier-run', 'species-1', 'movement').lineage, []);
  trace.lineage[0].events[0].trait.value = 99;
  assert.deepEqual(model.exportState(), before);
  delete state.species[0].genomeHistory;
  const partial = restoreLifeModel(world, state).inspectGeneHistory(state.runId, 'species-4', 'movement');
  assert.equal(partial.complete, false);
  assert.deepEqual(partial.lineage.map(branch => branch.speciesId), ['species-4']);
  assert.equal(partial.lineage[0].events[0].day, 80);
});
