import test from 'node:test';
import assert from 'node:assert/strict';
import { workerFixture } from '../fixtures/life-workers.js';
import { restoreLifeModel } from '../../src/simulation/life/v4/model.js';
import { evaluateObservationJobs } from '../../src/simulation/life/v4/observation-jobs.js';
import { createLifeWorkerPool } from '../../src/ui/life-worker-pool.js';

const { world, checkpoint } = workerFixture();
let jobs;
await restoreLifeModel(world, checkpoint).observeAsync(async work => {
  jobs = work;
  return evaluateObservationJobs(work);
});
const expected = new Map(evaluateObservationJobs(jobs));

function helpers(failure) {
  const created = [];
  return { created, createWorker() {
    if (failure === 'construction' && created.length === 1) throw new Error('Unavailable');
    const index = created.length;
    const worker = { terminated: false, requests: 0,
      terminate() { this.terminated = true; },
      postMessage(data) {
        this.requests += 1;
        if (failure === 'timeout' && index === 0) return;
        if (failure === 'post' && index === 0) throw new Error('Cannot clone');
        setTimeout(() => {
          if (this.terminated) return;
          if (failure === 'error' && index === 0) { this.onerror?.({}); return; }
          this.onmessage?.({ data: { id: -1, results: [] } }); // Ignore stale replies.
          this.onmessage?.({ data: { id: data.id, results: evaluateObservationJobs(structuredClone(data.jobs)) } });
        }, 3 - index);
      },
    };
    created.push(worker);
    return worker;
  } };
}

test('pool uses at most four workers, balances real work, reuses helpers and respects smaller devices', async () => {
  for (const [concurrency, helperCount] of [[1, 0], [2, 1], [4, 3], [16, 3]]) {
    const factory = helpers();
    const pool = createLifeWorkerPool({ concurrency, createWorker: factory.createWorker });
    assert.deepEqual(new Map(await pool.evaluate(jobs)), expected);
    assert.deepEqual(new Map(await pool.evaluate(jobs)), expected);
    assert.equal(factory.created.length, helperCount);
    assert.ok(factory.created.every(worker => worker.requests === 2));
    pool.close();
    assert.ok(factory.created.every(worker => worker.terminated));
    assert.equal(pool.enabled, false);
  }
  const factory = helpers();
  const pool = createLifeWorkerPool({ concurrency: 4, createWorker: factory.createWorker });
  await pool.evaluate([jobs[0]]);
  assert.equal(factory.created.length, 0, 'small jobs avoid startup and messaging');
});

test('construction, transport, runtime and timeout failures fall back without losing work', async () => {
  for (const failure of ['construction', 'post', 'error', 'timeout']) {
    const factory = helpers(failure);
    const pool = createLifeWorkerPool({ concurrency: 4, createWorker: factory.createWorker, timeout: 30 });
    assert.deepEqual(new Map(await pool.evaluate(jobs)), expected, failure);
    assert.equal(pool.enabled, false);
    assert.ok(factory.created.every(worker => worker.terminated));
    const count = factory.created.length;
    assert.deepEqual(new Map(await pool.evaluate(jobs)), expected);
    assert.equal(factory.created.length, count, 'a failed pool stays on the coordinator');
  }
});
