import test from 'node:test';
import assert from 'node:assert/strict';
import { workerFixture } from '../fixtures/life-workers-v3.js';
import { createLifeModel, restoreLifeModel } from '../../src/simulation/life/v3/model.js';
import { evaluateObservationJobs } from '../../src/simulation/life/v3/observation-jobs.js';

test('parallel V3 observations preserve complete observations, checkpoints and continuation', async () => {
  const { world, checkpoint } = workerFixture();
  const serial = restoreLifeModel(world, checkpoint);
  const parallel = restoreLifeModel(world, checkpoint);
  const original = parallel.exportState();
  let executions = 0;
  const execute = async jobs => {
    executions += 1;
    const batches = Array.from({ length: 4 }, (_, index) => jobs.filter((_, i) => i % 4 === index));
    // Transport clones and reversed completion order must have no effect.
    const results = batches.reverse().flatMap(batch => evaluateObservationJobs(structuredClone(batch)));
    jobs[0].hex.bedElevation = 999999;
    jobs[0].queries[0].genome.size = 10;
    return results;
  };
  const observed = await parallel.observeAsync(execute);
  assert.deepEqual(observed, serial.observe());
  assert.deepEqual(parallel.exportState(), original, 'queries and detached jobs cannot mutate state');
  observed.species[0].population = -1;
  assert.deepEqual(await parallel.observeAsync(execute), serial.observe());
  assert.equal(executions, 1, 'a completed revision reuses its observation');
  for (const day of [4, 11, 41, 81]) {
    serial.advanceTo(day); parallel.advanceTo(day);
    assert.deepEqual(await parallel.observeAsync(execute), serial.observe());
    assert.deepEqual(parallel.exportState(), serial.exportState());
  }
  const resumed = restoreLifeModel(world, parallel.exportState());
  resumed.advanceTo(101); serial.advanceTo(101);
  assert.deepEqual(resumed.exportState(), serial.exportState());
});

test('failed or superseded asynchronous observations do not publish partial revisions', async () => {
  const { world, checkpoint } = workerFixture();
  const model = restoreLifeModel(world, checkpoint);
  const before = model.exportState();
  await assert.rejects(model.observeAsync(async () => { throw new Error('helper failed'); }), /helper failed/);
  await assert.rejects(model.observeAsync(async () => []), /Incomplete/);
  assert.deepEqual(model.exportState(), before);
  let resolve;
  const pending = model.observeAsync(jobs => new Promise(done => { resolve = () => done(evaluateObservationJobs(jobs)); }));
  model.advanceTo(world.day + 1);
  resolve();
  await assert.rejects(pending, /superseded/);
  assert.deepEqual(model.observe(), restoreLifeModel(world, model.exportState()).observe());
});

test('empty and small life observations do not dispatch parallel jobs', async () => {
  const { world } = workerFixture();
  const model = createLifeModel(world);
  const unexpected = () => { throw new Error('No helper work expected'); };
  assert.deepEqual(await model.observeAsync(unexpected), model.observe());
  model.introduce(1);
  assert.deepEqual(await model.observeAsync(unexpected), model.observe());
});
