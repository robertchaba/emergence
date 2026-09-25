import { test, expect } from '@playwright/test';
import { readdir } from 'node:fs/promises';
import { workerFixture } from './fixtures/life-workers.js';
import { createSave } from '../src/ui/save-state.js';
import { exerciseLifeWorker, lifeWorkerHarness } from './fixtures/browser-life-worker.js';

test('playback requests compact revisions and lazy details follow rapid selection, locale and saves', async ({ page }) => {
  const { world, checkpoint } = workerFixture();
  const saved = createSave(world, checkpoint, {
    camera: { x: 0, y: 0, zoom: 1 }, layer: 'terrain', pinnedId: checkpoint.populations[0].hexId, speed: 10,
  });
  await page.addInitScript(() => {
    const NativeWorker = Worker;
    globalThis.lifeRequests = [];
    globalThis.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        if (String(url).includes('life-worker-')) globalThis.testLifeWorker = this;
      }
      postMessage(message, ...rest) {
        if (message.command) globalThis.lifeRequests.push(message.command === 'restore'
          ? { command: message.command, observationOptions: message.observationOptions }
          : message);
        return super.postMessage(message, ...rest);
      }
    };
  });
  // Hold only the first inspection reply to force selection to change in flight.
  await page.route('**/assets/life-worker-*.js', async route => {
    const source = await (await route.fetch()).text();
    await route.fulfill({ contentType: 'text/javascript', body: `
      const originalPost = self.postMessage.bind(self);
      let holdInspection = true;
      const pendingInspections = [];
      self.postMessage = (data, ...args) => {
        if (holdInspection && data.command === 'observe') pendingInspections.push([data, args]);
        else originalPost(data, ...args);
      };
      self.addEventListener('message', event => {
        if (event.data.command !== 'test-release-inspection') return;
        event.stopImmediatePropagation(); holdInspection = false;
        for (const [data, args] of pendingInspections.splice(0)) originalPost(data, ...args);
      });
      ${source}` });
  });
  await page.goto('/world.html?restore');
  await page.locator('#restore-file').setInputFiles({ name: 'world.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(saved)) });
  await page.locator('#restore-dialog [type="submit"]').click();
  await expect(page.locator('.species-choice')).toHaveCount(12);
  expect(await page.evaluate(() => lifeRequests.filter(item => item.command === 'observe'))).toEqual([]);
  await page.locator('.species-choice').first().click();
  await expect(page.locator('#species-detail')).toHaveAttribute('data-level', 'summary');
  await expect.poll(() => page.evaluate(() => lifeRequests.some(item => item.command === 'observe'))).toBe(true);
  const second = page.locator('.species-choice').nth(1);
  const id = await second.getAttribute('data-species-id');
  await second.click();
  await expect(page.locator('#species-detail')).toHaveAttribute('data-species-id', id);
  await page.locator('#application-menu > summary').click();
  await page.locator('#open-tree-of-life').click();
  await expect(page.locator('#tree-census')).toContainText('Paused on day');
  await page.evaluate(() => testLifeWorker.postMessage({ command: 'test-release-inspection' }));
  await expect(page.locator('#step-world')).toBeEnabled();
  expect(await page.evaluate(() => lifeRequests.filter(item => item.command === 'observe').length)).toBe(1);
  await page.locator('#tree-close').click();
  await expect(page.locator('#species-detail')).toHaveAttribute('data-level', 'genes');
  await expect(page.locator('#species-detail')).toHaveAttribute('data-species-id', id);
  await page.locator('.species-tendencies > summary').click();
  await expect(page.locator('#species-detail')).toHaveAttribute('data-level', 'full');
  await expect(page.locator('.tendency-choice')).toHaveCount(2);
  // Locale changes retain the same current revision and do not fetch again.
  const requests = await page.evaluate(() => lifeRequests.filter(item => item.command === 'observe').length);
  await page.locator('[data-locale="pl"]').click();
  await expect(page.locator('#species-detail .gene-heading').first()).toHaveText('Dziedziczone cechy');
  expect(await page.evaluate(() => lifeRequests.filter(item => item.command === 'observe').length)).toBe(requests);
  await page.locator(`[data-species-id="${id}"].species-choice`).click();
  await expect(page.locator('#species-detail')).toHaveCount(0);
  await page.locator('#play-world').click();
  await expect.poll(() => page.evaluate(() => lifeRequests.filter(item => item.command === 'advance').length)).toBeGreaterThan(2);
  await page.locator('#pause-world').click();
  await expect(page.locator('#step-world')).toBeEnabled();
  const advances = await page.evaluate(() => lifeRequests.filter(item => item.command === 'advance'));
  expect(advances.every(item => item.observationOptions.detail === 'summary'
    && item.observationOptions.speciesId === null && !item.observationOptions.includeTendencies)).toBe(true);
  expect(advances.some((item, index) => index > 0 && item.day - advances[index - 1].day > 1)).toBe(true);
  await page.locator('#application-menu > summary').click();
  const download = page.waitForEvent('download');
  await page.locator('#save-state').click();
  const stream = await (await download).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString()).life;
  await page.route('**/assets/life-test-worker.js?*', route => route.fulfill({
    contentType: 'text/javascript', body: lifeWorkerHarness }));
  const asset = (await readdir('dist/assets')).find(name => /^life-worker-.*\.js$/.test(name));
  const baseline = await page.evaluate(exerciseLifeWorker, {
    url: new URL(`/assets/${asset}`, page.url()).href, saved,
    advanceDays: exported.day - checkpoint.day,
  });
  // Compare exact state within Chromium; Node differs in last-bit reserves.
  expect(exported).toEqual(baseline.checkpoint);
});
