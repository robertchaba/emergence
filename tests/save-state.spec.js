import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { generateWorld, setDay } from '../src/simulation/world.js';
import { createLifeModel } from '../src/simulation/life/v3/model.js';
import { createSave, restoreSave } from '../src/ui/save-state.js';
import { chooseTheme } from './ui-helpers.js';

const world = setDay(generateWorld({ seed: 'save-browser', size: 'small' }), 1);
const model = createLifeModel(world);
const site = world.hexes.find(hex => hex.waterType === 'none' && !hex.permanentIce && hex.temperature > 15);
model.introduce(site.id);
model.advanceTo(38);
const fixture = createSave(world, model.exportState(), {
  camera: { zoom: 2, x: -10, y: 15 }, layer: 'temperature', pinnedId: site.id, speed: 6,
});

async function menu(page) {
  const menu = page.locator('#application-menu');
  if (!await menu.evaluate(node => node.open)) await menu.locator('summary').click();
}

async function upload(page, contents = JSON.stringify(fixture)) {
  await page.locator('#restore-file').setInputFiles({ name: 'world.json', mimeType: 'application/json', buffer: Buffer.from(contents) });
  await page.locator('#restore-dialog [type="submit"]').click();
}

async function save(page, action) {
  await menu(page);
  const downloadPromise = page.waitForEvent('download');
  if (action) await action();
  else await page.locator('#save-state').click();
  const download = await downloadPromise;
  const saved = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(download.suggestedFilename()).toBe(`emergence-day-${saved.life.day}.json`);
  return saved;
}

test('landing restore and menu downloads preserve life, map view and exact continuation', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const landingURL = page.url();
  const restoreButton = page.locator('#restore-landing');
  for (const [theme, locale] of [['light', 'en'], ['dark', 'pl']]) {
    await chooseTheme(page, theme);
    await page.locator(`[data-locale="${locale}"]`).click();
    await restoreButton.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(restoreButton).toHaveCSS('outline-style', 'solid');
    expect(await restoreButton.evaluate(node => {
      const probe = document.createElement('span');
      probe.style.background = 'var(--color-panel-raised)';
      node.append(probe);
      const matches = getComputedStyle(node).backgroundColor === getComputedStyle(probe).backgroundColor;
      probe.remove();
      return matches;
    })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`landing-restore-button-${theme}.png`) });
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(landingURL);
    await expect(page.locator('#world-setup')).toHaveCount(0);
    await expect(page.locator('.hero')).toBeVisible();
    await expect(page.locator('#restore-file')).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`landing-restore-dialog-${theme}.png`) });
    await upload(page, '{ invalid json');
    await expect(page.locator('#restore-status')).toContainText(locale === 'en' ? 'Could not restore' : 'Nie udało się');
    await page.keyboard.press('Escape');
    await expect(restoreButton).toBeFocused();
    await expect(page).toHaveURL(landingURL);
  }
  await page.locator('[data-locale="en"]').click();
  await restoreButton.click();
  await expect(page.locator('#restore-dialog')).toBeVisible();
  await page.route('**/world.html', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await upload(page);
  await expect(page.locator('#restore-status')).toHaveText('Could not open the world. Please try restoring again.');
  await expect(page.locator('#world-setup')).toHaveCount(0);
  await page.unroute('**/world.html');
  await upload(page);
  await expect(page.locator('#workspace')).toBeVisible();
  await expect(page).toHaveURL(landingURL);
  await expect(page.locator('#world-map')).toBeFocused();
  await expect(page.locator('#restore-dialog')).toHaveCount(1);
  await expect(page.locator('#restore-dialog')).not.toBeVisible();
  await expect(page.locator('#world-day')).toHaveAttribute('data-day', '38');
  await expect(page.locator('#pause-world')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#simulation-speed')).toHaveValue('6');
  await expect(page.locator('#world-map')).toHaveAttribute('data-pinned-id', String(site.id));
  await expect(page.locator('#world-map')).toHaveAttribute('data-layer', 'temperature');
  await expect(page.locator('#world-map')).toHaveAttribute('data-zoom', '2');
  const initial = await save(page);
  expect(initial).toEqual(fixture);

  // Queue an advance and a save in the same browser turn, before its reply.
  const pending = await save(page, () => page.evaluate(() => {
    document.querySelector('#step-world').click();
    document.querySelector('#save-state').click();
    if (!document.querySelector('#play-world').disabled) throw new Error('Playback must be locked while exporting');
  }));
  expect(pending.life.day).toBe(39);
  const expected = restoreSave(fixture).model;
  expected.advanceTo(39);
  expect(pending.life).toEqual(expected.exportState());
  await page.locator('#application-menu > summary').click();
  await page.locator('#play-world').click();
  await expect.poll(async () => Number(await page.locator('#world-day').getAttribute('data-day'))).toBeGreaterThan(39);
  const running = await save(page);
  await expect(page.locator('#pause-world')).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(300);
  await expect(page.locator('#world-day')).toHaveAttribute('data-day', String(running.life.day));

  await page.locator('#restore-state').click();
  await upload(page, JSON.stringify(initial));
  expect(await save(page)).toEqual(initial);
  expect(errors).toEqual([]);
});

test('invalid uploads and cancellation preserve the current run; controls wrap in both themes and languages', async ({ page }, testInfo) => {
  await page.goto('/world.html?restore');
  await upload(page);
  for (const [theme, locale] of [['light', 'en'], ['dark', 'pl']]) {
    await chooseTheme(page, theme);
    await page.locator(`[data-locale="${locale}"]`).click();
    await menu(page);
    await page.locator('#save-state').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#restore-state')).toBeFocused();
    await expect(page.locator('#restore-state')).toHaveCSS('outline-style', 'solid');
    await page.screenshot({ path: testInfo.outputPath(`save-menu-${theme}.png`) });
    await page.keyboard.press('Enter');
    await upload(page, '{ invalid json');
    await expect(page.locator('#restore-status')).toContainText(locale === 'en' ? 'Could not restore' : 'Nie udało się');
    await page.screenshot({ path: testInfo.outputPath(`restore-error-${theme}.png`) });
    expect(await page.locator('#restore-dialog').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#application-menu > summary')).toBeFocused();
    expect(await save(page)).toEqual(fixture);
    await page.locator('#application-menu > summary').click();
  }
  await menu(page);
  await page.locator('#restore-state').click();
  await upload(page, JSON.stringify({ ...fixture, generatorVersion: 'old-world' }));
  await expect(page.locator('#restore-status')).toContainText('Nie udało się');
  await page.locator('#restore-dialog [type="button"]').click();
  expect(await save(page)).toEqual(fixture);
});

test('an unseeded world can be saved and restored without storage access', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
    Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Storage blocked'); } });
  });
  await page.goto('/world.html');
  await page.locator('#seed').fill('empty-save');
  await page.locator('#world-size').selectOption('small');
  await page.locator('#start-workspace').click();
  const saved = await save(page);
  expect(saved.life.introduced).toBe(false);
  await page.goto('/');
  await page.locator('#restore-landing').click();
  await upload(page, JSON.stringify(saved));
  await expect(page.locator('#species-count')).toHaveText('0');
  expect(await save(page)).toEqual(saved);
  await page.locator('#application-menu > summary').click();
  await page.locator('#world-map').press('ArrowRight');
  // Restore/cancel may happen before the pending introduction acknowledges.
  await page.evaluate(() => {
    document.querySelector('#start-life').click();
    document.querySelector('#restore-state').click();
    document.querySelector('#restore-dialog [type="button"]').click();
  });
  await expect(page.locator('#species-count')).toHaveText('1');
  await expect(page.locator('#pause-world')).toHaveAttribute('aria-pressed', 'true');
});

test('cancelling an in-progress restore and retrying a failed download keep the original state', async ({ page }) => {
  await page.goto('/world.html?restore');
  await upload(page);
  await menu(page);
  await page.route('**/assets/life-worker-*.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      const receive = self.onmessage;
      self.onmessage = event => { if (event.data.command === 'restore') setTimeout(() => receive(event), 600);
        else receive(event); };` });
  });
  await page.locator('#restore-state').click();
  const empty = createSave(world, createLifeModel(world).exportState(), fixture.view);
  await upload(page, JSON.stringify(empty));
  await expect(page.locator('#restore-file')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('#application-menu > summary')).toBeFocused();
  await page.waitForTimeout(700);
  expect(await save(page)).toEqual(fixture);

  await page.evaluate(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = () => { URL.createObjectURL = original; throw new Error('Download unavailable'); };
  });
  await page.locator('#save-state').click();
  await expect(page.locator('#save-status')).toContainText('Could not create');
  await expect(page.locator('#pause-world')).toHaveAttribute('aria-pressed', 'true');
  expect(await save(page)).toEqual(fixture);
});
