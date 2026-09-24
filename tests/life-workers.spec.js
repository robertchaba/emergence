import { readdir } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { workerFixture } from './fixtures/life-workers.js';
import { exerciseLifeWorker, lifeWorkerHarness } from './fixtures/browser-life-worker.js';
import { restoreLifeModel } from '../src/simulation/life/v3/model.js';
import { createSave } from '../src/ui/save-state.js';

const { world, checkpoint } = workerFixture();
const view = { camera: { x: 0, y: 0, zoom: 1 }, layer: 'terrain', pinnedId: null, speed: 10 };
const saved = createSave(world, checkpoint, view);

test.beforeEach(async ({ page }) => {
  await page.route('**/assets/life-test-worker.js?*', route => route.fulfill({
    contentType: 'text/javascript', body: lifeWorkerHarness }));
});

test('four real workers match one worker and headless state while queued queries retain order', async ({ page }) => {
  await page.goto('/');
  const asset = (await readdir('dist/assets')).find(name => /^life-worker-.*\.js$/.test(name));
  const url = new URL(`/assets/${asset}`, page.url()).href;
  const serial = await page.evaluate(exerciseLifeWorker, { url, saved, workers: 1, queueQueries: true });
  const parallel = await page.evaluate(exerciseLifeWorker, { url, saved, workers: 4, queueQueries: true });
  expect(serial.helpers).toBe(0);
  expect(parallel.helpers).toBe(3);
  expect(parallel.responses).toEqual(['restore', 'advance', 'tree', 'export']);
  expect(parallel.observation).toEqual(serial.observation);
  expect(parallel.checkpoint).toEqual(serial.checkpoint);
  expect(parallel.tree).toEqual(serial.tree);
  const headless = restoreLifeModel(world, checkpoint);
  headless.advanceTo(checkpoint.day + 1);
  expect(parallel.observation).toEqual(headless.observe());
  expect(parallel.checkpoint).toEqual(headless.exportState());
  expect(parallel.tree).toEqual(headless.observeTree());
  const continued = await page.evaluate(exerciseLifeWorker, { url,
    saved: createSave(world, parallel.checkpoint, view), workers: 4, advanceDays: 40 });
  const serialContinuation = await page.evaluate(exerciseLifeWorker, { url,
    saved: createSave(world, serial.checkpoint, view), workers: 1, advanceDays: 40 });
  expect(continued.checkpoint).toEqual(serialContinuation.checkpoint);
  expect(continued.observation).toEqual(serialContinuation.observation);
  headless.advanceTo(checkpoint.day + 41);
  // Chromium/Node can differ in last-bit floating-point reserves. Exact
  // checkpoint equality above compares worker counts in the same engine.
  expect(continued.checkpoint.randomState).toEqual(headless.exportState().randomState);
  expect(continued.observation.counts).toEqual(headless.observe().counts);
  expect(continued.observation.stats).toEqual(headless.observe().stats);
});

test('unavailable or crashing helpers fall back to the same completed observation and saved state', async ({ page }) => {
  await page.goto('/');
  const asset = (await readdir('dist/assets')).find(name => /^life-worker-.*\.js$/.test(name));
  const url = new URL(`/assets/${asset}`, page.url()).href;
  const result = await page.evaluate(exerciseLifeWorker, { url, saved, failure: true, queueQueries: true });
  expect(result.helpers).toBe(0);
  const headless = restoreLifeModel(world, checkpoint);
  headless.advanceTo(checkpoint.day + 1);
  expect(result.observation).toEqual(headless.observe());
  expect(result.checkpoint).toEqual(headless.exportState());
  expect(result.responses).toEqual(['restore', 'advance', 'tree', 'export']);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/assets/life-observation-worker-*.js', route => route.fulfill({
    contentType: 'text/javascript', body: "throw new Error('Fixture: helper runtime failure');" }));
  const crashed = await page.evaluate(exerciseLifeWorker, { url, saved, queueQueries: true });
  expect(crashed.helpers).toBe(3);
  expect(crashed.observation).toEqual(result.observation);
  expect(crashed.checkpoint).toEqual(result.checkpoint);
  expect(errors).toEqual([]);
});
