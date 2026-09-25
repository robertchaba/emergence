import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDebugProfiler, validateDebugConfig, PHASES } from '../../src/ui/debugdev-profiler.js';
import { createLifeModel, restoreLifeModel } from '../../src/simulation/life/v3/model.js';
import { evaluateObservationJobs } from '../../src/simulation/life/v3/observation-jobs.js';
import { workerFixture } from '../fixtures/life-workers.js';

const defaults = JSON.parse(readFileSync(new URL('../../degugdev-config.json', import.meta.url)));
const allConfig = () => ({ ...defaults, measure: Object.fromEntries(Object.keys(defaults.measure).map(key => [key, true])) });

test('debug timing aggregates inclusive calls and separates measurement from output', async () => {
  let time = 0;
  let reads = 0;
  const printed = [];
  const logger = Object.fromEntries(['group', 'groupCollapsed', 'table', 'log', 'info', 'groupEnd']
    .map(key => [key, (...args) => printed.push([key, ...args])]));
  const profiler = createDebugProfiler({ ...defaults, output: { ...defaults.output, ui: false } },
    { now: () => { reads += 1; return time; }, logger });
  const draw = profiler.wrap('ui.draw', () => { time += 5; return 7; });
  const update = profiler.wrap('ui.accept', () => { time += 2; draw(); time += 3; });
  update(); draw();
  const rows = profiler.flush();
  assert.deepEqual(rows.map(({ phase, calls, totalMs, averageMs, maxMs }) => ({ phase, calls, totalMs, averageMs, maxMs })),
    [{ phase: 'ui.draw', calls: 2, totalMs: 10, averageMs: 5, maxMs: 5 }]);
  assert.equal(profiler.flush(), undefined, 'reports reset aggregates');
  const before = reads;
  const disabled = () => 1;
  assert.equal(profiler.wrap('life.score', disabled), disabled);
  assert.equal(profiler.start('life.score'), null);
  assert.equal(reads, before, 'disabled measurement never reads a clock');
  await assert.rejects(profiler.measureAsync('worker.command', async () => { time += 12; throw new Error('fixture'); }), /fixture/);
  assert.equal(profiler.flush()[0].totalMs, 12);
  const muted = createDebugProfiler({ ...defaults, output: {} }, { now: () => time, logger });
  const printedBefore = printed.length;
  muted.wrap('ui.draw', draw)(); muted.flush();
  assert.equal(printed.length, printedBefore, 'output switches do not log disabled groups');
  const off = createDebugProfiler({ ...defaults, enabled: false }, { now: () => { throw new Error('clock'); }, logger });
  off.announce(); off.wrap('ui.draw', disabled)(); off.flush();
  assert.equal(printed.length, printedBefore);
  const overrides = createDebugProfiler({ ...defaults,
    measure: { ...defaults.measure, 'ui.draw': false, 'life.score': true },
    output: { ...defaults.output, detail: false, 'life.score': true },
  }, { now: () => time, logger });
  assert.equal(overrides.wrap('ui.draw', disabled), disabled, 'phase overrides enabled group');
  overrides.wrap('life.score', () => { time += 6; })();
  assert.deepEqual(overrides.flush().map(row => row.phase), ['life.score'], 'phase overrides disabled groups');
  assert.throws(() => validateDebugConfig({ ...defaults, measure: { typo: true } }), /typo/);
  assert.throws(() => validateDebugConfig({ ...defaults, reportIntervalMs: 0 }), /reportIntervalMs/);
});

test('debug phases preserve exact V3 state, observations, async jobs and continuation', async () => {
  const { world, checkpoint } = workerFixture();
  let clock = 0;
  const profiler = createDebugProfiler(allConfig(), { now: () => ++clock, logger: {
    group() {}, groupCollapsed() {}, log() {}, table() {}, groupEnd() {},
  } });
  const plain = restoreLifeModel(world, checkpoint);
  const traced = restoreLifeModel(world, checkpoint, profiler.listeners);
  assert.deepEqual(await traced.observeAsync(jobs => evaluateObservationJobs(jobs, profiler.listeners)), plain.observe());
  for (const day of [4, 11, 41]) {
    plain.advanceTo(day); traced.advanceTo(day);
    assert.deepEqual(traced.exportState(), plain.exportState());
    assert.deepEqual(await traced.observeAsync(jobs => evaluateObservationJobs(jobs, profiler.listeners)), plain.observe());
  }
  const phases = new Set(profiler.flush().map(row => row.phase));
  for (const phase of ['life.advance', 'life.evolution', 'life.demography', 'life.dispersal', 'life.climate',
    'ecology.grazing', 'ecology.hunting', 'genes.derive', 'genes.describe', 'observation.copy', 'observation.detach']) assert.ok(phases.has(phase), phase);
  const throwing = Object.fromEntries(Object.keys(PHASES).map(key => [key, () => { throw new Error('diagnostic failure'); }]));
  const continued = restoreLifeModel(world, traced.exportState(), throwing);
  plain.advanceTo(51); continued.advanceTo(51);
  assert.deepEqual(continued.exportState(), plain.exportState());
  assert.deepEqual(continued.observe(), plain.observe());
  const founder = createLifeModel(world, {}, throwing);
  const ordinary = createLifeModel(world);
  founder.introduce(1); ordinary.introduce(1);
  assert.deepEqual(founder.exportState(), ordinary.exportState());
});
