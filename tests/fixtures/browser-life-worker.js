// Serve beside the production worker: Vite resolves nested worker assets from
// self.location, so a blob wrapper would give them an invalid base URL.
export const lifeWorkerHarness = `
  const options = new URL(self.location.href).searchParams;
  Object.defineProperty(navigator, 'hardwareConcurrency', { value: Number(options.get('workers')) });
  const NativeWorker = Worker;
  globalThis.Worker = class extends NativeWorker {
    constructor(url, config) {
      if (options.get('failure') === 'true') throw new Error('Fixture: helpers unavailable');
      super(url, config);
      self.postMessage({ diagnostic: 'helper-created' });
    }
  };
  await import(options.get('target'));
  self.postMessage({ diagnostic: 'ready' });
`;

// Runs inside page.evaluate; all diagnostics/configuration stay in this harness.
export async function exerciseLifeWorker({ url, saved, workers = 4, rounds = 1,
  warmups = 0, advanceDays = 1, reset = true, failure = false, queueQueries = false }) {
  const harness = new URL('./life-test-worker.js', url);
  harness.search = new URLSearchParams({ target: url, workers, failure }).toString();
  const worker = new Worker(harness, { type: 'module' });
  let helpers = 0;
  const pending = [];
  const responses = [];
  try {
    await new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) => { if (data.diagnostic === 'ready') resolve(); };
      worker.onerror = reject;
    });
    worker.onmessage = ({ data }) => {
      if (data.diagnostic) { helpers += Number(data.diagnostic === 'helper-created'); return; }
      responses.push(data.command);
      const next = pending.shift();
      if (data.error) next.reject(new Error(data.error)); else next.resolve(data);
    };
    worker.onerror = event => { for (const item of pending.splice(0)) item.reject(new Error(event.message)); };
    const command = data => new Promise((resolve, reject) => {
      pending.push({ resolve, reject }); worker.postMessage(data);
    });
    const restore = () => command({ command: 'restore', file: new File([JSON.stringify(saved)], 'fixture.json') });
    let observation;
    let exported;
    let tree;
    const samples = [];
    await restore();
    for (let index = 0; index < rounds + warmups; index += 1) {
      if (reset && index > 0) await restore();
      const start = performance.now();
      const advance = command({ command: 'advance', day: saved.life.day + advanceDays * (reset ? 1 : index + 1) });
      const queries = queueQueries ? [command({ command: 'tree', requestId: 71 }),
        command({ command: 'export', view: saved.view })] : [];
      observation = (await advance).observation;
      if (index >= warmups) samples.push(performance.now() - start);
      if (queries.length) {
        const result = await Promise.all(queries);
        tree = result[0].tree; exported = JSON.parse(result[1].json).life;
      }
    }
    if (!exported) exported = JSON.parse((await command({ command: 'export', view: saved.view })).json).life;
    return { helpers, samples, observation, checkpoint: exported, tree, responses };
  } finally {
    worker.terminate();
  }
}
