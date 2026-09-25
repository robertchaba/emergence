import { evaluateObservationJobs, observationJobCost } from '../simulation/life/v3/observation-jobs.js';

/** One coordinator plus at most three helpers, created only for substantial
 * read-only work. Worker lifetime is bounded by the owning life worker. */
export function createLifeWorkerPool({ concurrency = globalThis.navigator?.hardwareConcurrency ?? 1,
  createWorker = index => new Worker(new URL('./life-observation-worker.js', import.meta.url), { type: 'module', name: `observation helper ${index}` }),
  timeout = 10000, debug = null } = {}) {
  const localEvaluation = jobs => evaluateObservationJobs(jobs, debug?.listeners);
  const evaluateLocal = debug?.wrap('pool.local', localEvaluation) ?? localEvaluation;
  const count = Math.max(1, Math.min(4, Math.floor(concurrency) || 1));
  let helpers = [];
  let disabled = count === 1;
  let nextId = 0;

  function close() {
    disabled = true;
    for (const helper of helpers) helper.terminate();
    helpers = [];
  }

  function dispatch(worker, jobs) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error('Observation helper timed out.')), timeout);
      const finish = (error, results) => {
        clearTimeout(timer);
        worker.onmessage = worker.onerror = worker.onmessageerror = null;
        if (error) reject(error); else resolve(results);
      };
      worker.onmessage = ({ data }) => {
        if (data.id !== id) return;
        finish(data.error ? new Error(data.error) : null, data.results);
      };
      worker.onerror = worker.onmessageerror = event => {
        // Handle a helper failure here rather than forwarding an uncaught
        // worker error to the application's fatal life-worker handler.
        event.preventDefault?.();
        finish(new Error('Observation helper failed.'));
      };
      try { worker.postMessage({ id, jobs }); } catch (error) { finish(error); }
    });
  }

  async function evaluate(jobs) {
    const work = jobs.reduce((sum, job) => sum + observationJobCost(job), 0);
    if (disabled || jobs.length < count || work < 20000) return evaluateLocal(jobs);
    try {
      while (helpers.length < count - 1) helpers.push(createWorker(helpers.length + 1));
      const batches = Array.from({ length: count }, () => ({ jobs: [], cost: 0 }));
      for (const job of [...jobs].sort((a, b) => observationJobCost(b) - observationJobCost(a))) {
        const batch = batches.reduce((least, item) => item.cost < least.cost ? item : least);
        batch.jobs.push(job); batch.cost += observationJobCost(job);
      }
      const remote = helpers.map((helper, index) => dispatch(helper, batches[index + 1].jobs));
      // Attach rejection handling before the coordinator executes its own share.
      const completed = Promise.allSettled(remote);
      const local = evaluateLocal(batches[0].jobs);
      const results = await completed;
      if (results.some(result => result.status === 'rejected')) throw new Error('Observation helpers unavailable.');
      return [...local, ...results.flatMap(result => result.value)];
    } catch {
      close();
      // Read-only jobs are safe to repeat; no random draw or day is replayed.
      return evaluateLocal(jobs);
    }
  }

  return { evaluate: debug ? jobs => debug.measureAsync('pool.total', () => evaluate(jobs)) : evaluate,
    close, get enabled() { return !disabled; } };
}
