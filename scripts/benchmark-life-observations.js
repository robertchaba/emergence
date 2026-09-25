import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from '@playwright/test';
import { generateWorld } from '../src/simulation/world.js';
import { createLifeModel } from '../src/simulation/life/v4/model.js';
import { createSave } from '../src/ui/save-state.js';
import { workerFixture } from '../tests/fixtures/life-workers.js';
import { exerciseLifeWorker, lifeWorkerHarness } from '../tests/fixtures/browser-life-worker.js';

// Build first. Same rules/state, different requested detail. Includes production
// worker transport and complete biological advancement, excludes Canvas/DOM.
const horizon = Number(process.argv[2] ?? 4320);
if (!Number.isSafeInteger(horizon) || horizon < 1) throw new RangeError('Supply a positive integer day horizon.');
const asset = (await readdir('dist/assets')).find(name => /^life-worker-.*\.js$/.test(name));
if (!asset) throw new Error('Run npm run build first.');
const world = generateWorld({ seed: 'emergence', size: 'small' });
const life = createLifeModel(world);
const site = world.hexes.filter(hex => hex.waterType !== 'none' && !hex.permanentIce
  && hex.temperature >= 15 && hex.temperature <= 30)
  .sort((a, b) => Math.abs(a.latitude) - Math.abs(b.latitude) || a.id - b.id)[0];
life.introduce(site.id); life.advanceTo(horizon);
const workloads = [
  { name: 'evolved-small-water', world, checkpoint: life.exportState(), reset: false, advanceDays: 5, rounds: 40, warmups: 0 },
  { name: 'dense-mixed-fixture', ...workerFixture(), reset: true, advanceDays: 4, rounds: 15, warmups: 3 },
];
const server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } });
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route('**/assets/life-test-worker.js?*', route => route.fulfill({ contentType: 'text/javascript', body: lifeWorkerHarness }));
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  await page.goto(origin);
  for (const workload of workloads) {
    let baseline;
    const speciesId = workload.checkpoint.populations[0]?.speciesId ?? null;
    const modes = [
      ['full', undefined],
      ['collapsed', { detail: 'summary' }],
      ['genes', { detail: 'summary', speciesId }],
      ['ranges', { detail: 'summary', speciesId, includeTendencies: true }],
    ];
    // Reverse the second pass to reduce systematic warmup/order bias.
    for (const [mode, observationOptions] of [...modes, ...modes.toReversed()]) {
      const saved = createSave(workload.world, workload.checkpoint,
        { camera: { x: 0, y: 0, zoom: 1 }, layer: 'terrain', pinnedId: null, speed: 10 });
      const result = await page.evaluate(exerciseLifeWorker, { url: `${origin}/assets/${asset}`, saved, workers: 4,
        reset: workload.reset, advanceDays: workload.advanceDays, rounds: workload.rounds,
        warmups: workload.warmups, observationOptions });
      if (!baseline) baseline = result;
      assert.deepEqual(result.checkpoint, baseline.checkpoint);
      for (const key of ['counts', 'hexes', 'day', 'revision', 'history']) assert.deepEqual(result.observation[key], baseline.observation[key]);
      if (mode === 'full') assert.deepEqual(result.observation, baseline.observation);
      const selected = result.observation.species.find(row => row.id === speciesId);
      const complete = baseline.observation.species.find(row => row.id === speciesId);
      if (mode === 'ranges' && selected) {
        const { detailLevel, tendencyCount, ...record } = selected;
        assert.deepEqual(record, complete);
      }
      if (mode === 'genes' && selected) assert.deepEqual(selected.traits, complete.traits);
      const samples = [...result.samples].sort((a, b) => a - b);
      console.log(JSON.stringify({ workload: workload.name, mode, helpers: result.helpers,
        samples: samples.length, totalMs: +samples.reduce((a, b) => a + b, 0).toFixed(2),
        medianMs: +samples[Math.floor(samples.length / 2)].toFixed(2),
        p95Ms: +samples[Math.ceil(samples.length * 0.95) - 1].toFixed(2),
        observationBytes: new TextEncoder().encode(JSON.stringify(result.observation)).length, identicalState: true }));
    }
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
