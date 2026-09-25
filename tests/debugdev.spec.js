import { createServer } from 'vite';
import { test, expect } from '@playwright/test';
import { workerFixture } from './fixtures/life-workers.js';
import { createSave } from '../src/ui/save-state.js';
import { chooseTheme } from './ui-helpers.js';

test('debugdev reports real UI, coordinator and helper work; normal dev stays quiet', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const { world, checkpoint } = workerFixture({ speciesCount: 24 });
  const saved = createSave(world, checkpoint, {
    camera: { x: 0, y: 0, zoom: 1 }, layer: 'terrain', pinnedId: checkpoint.populations[0].hexId, speed: 10,
  });
  const messages = [];
  const rows = [];
  const errors = [];
  const pending = [];
  page.on('console', message => {
    messages.push(message.text());
    if (message.type() === 'table') pending.push(message.args()[0].jsonValue().then(value => {
      if (Array.isArray(value)) rows.push(...value.filter(row => Number.isFinite(row.totalMs)));
    }).catch(() => {}));
  });
  page.on('pageerror', error => errors.push(error.message));
  for (const mode of ['debugdev', 'development']) {
    const server = await createServer({ mode, server: { host: '127.0.0.1', port: 0, open: false },
      logLevel: 'error' });
    try {
      await server.listen();
      const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
      const offset = messages.length;
      await page.goto(`${origin}/world.html?restore`);
      await page.locator('#restore-file').setInputFiles({ name: 'world.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(saved)) });
      await page.locator('#restore-dialog [type="submit"]').click();
      await expect(page.locator('#restore-dialog')).not.toBeVisible();
      await expect(page.locator('#step-world')).toBeEnabled();
      await page.locator('#step-world').click();
      await expect(page.locator('#step-world')).toBeEnabled();
      if (mode === 'debugdev') {
        await page.locator('.species-choice').first().click();
        await expect(page.locator('#species-detail .gene-row').first()).toBeVisible();
        await page.locator('.species-tendencies > summary').click();
        await expect.poll(() => rows.some(row => row.phase === 'pool.helper'), { timeout: 15000 }).toBe(true);
        await page.evaluate(async () => (await import('/src/ui/debugdev.js')).debug.flush());
        await Promise.all(pending);
        for (const phase of ['worker.command', 'life.advance', 'observation.total', 'observation.copy',
          'ui.draw', 'ui.notebook', 'worker.roundTrip', 'pool.helper']) {
          expect(rows.some(row => row.phase === phase && row.calls > 0), phase).toBe(true);
        }
        expect(messages.some(message => message.includes('INCLUSIVE'))).toBe(true);
        for (const theme of ['light', 'dark']) {
          await page.locator('#application-menu > summary').click();
          await chooseTheme(page, theme);
          await page.locator('#application-menu > summary').click();
          await page.screenshot({ path: testInfo.outputPath(`debugdev-${theme}.png`) });
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        }
      } else {
        expect(messages.slice(offset).some(message => message.includes('[Emergence debugdev]'))).toBe(false);
      }
      await page.goto('about:blank');
    } finally { await server.close(); }
  }
  expect(errors).toEqual([]);
});
