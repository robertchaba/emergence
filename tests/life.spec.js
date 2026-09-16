import { test, expect } from '@playwright/test';
import { generateWorld, setDay } from '../src/simulation/world.js';
import { createLifeModel } from '../src/simulation/life/v1/model.js';
import { chooseTheme } from './ui-helpers.js';

const settings = { seed: 'life-browser-check', size: 'small' };

async function openLifeWorld(page, options = settings) {
  await page.goto('/world.html');
  await page.locator('#seed').fill(options.seed);
  await page.locator('#world-size').selectOption(options.size);
  await page.locator('#start-workspace').click();
  await expect(page.locator('#world-map')).toBeFocused();
  const day = Number(await page.locator('#world-day').getAttribute('data-day'));
  return setDay(generateWorld(options), day);
}

async function pinHex(page, hex, width, height = 16) {
  const map = page.locator('#world-map');
  await map.press('Escape');
  await map.press('ArrowRight');
  await expect(map).toHaveAttribute('data-pinned-id', String(Math.floor(height / 2) * width + Math.floor(width / 2)));
  let id = Number(await map.getAttribute('data-pinned-id'));
  const row = Math.floor(id / width);
  for (let index = 0; index < Math.abs(row - hex.row); index += 1) {
    await map.press(row > hex.row ? 'ArrowUp' : 'ArrowDown');
  }
  for (let index = 0; index < (hex.col - id % width + width) % width; index += 1) {
    await map.press('ArrowRight');
  }
  await expect(map).toHaveAttribute('data-pinned-id', String(hex.id));
}

function suitable(world) {
  return world.hexes.find(hex => hex.waterType !== 'none' && !hex.permanentIce
    && hex.temperature >= 18 && hex.temperature <= 22);
}

async function introduce(page, world) {
  const site = suitable(world);
  expect(site).toBeTruthy();
  await pinHex(page, site, world.width, world.height);
  await page.locator('#start-life').click();
  await expect(page.locator('#organism-count')).toHaveText('20');
  await expect(page.locator('#species-count')).toHaveText('1');
  return site;
}

test('plant introduction validates sites, advances completed biology, and prevents resetting living populations', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const world = await openLifeWorld(page);
  await expect(page.locator('#organism-count')).toHaveText('0');
  await expect(page.locator('#start-life')).toBeDisabled();
  const ice = world.hexes.find(hex => hex.permanentIce);
  await pinHex(page, ice, world.width);
  await page.locator('#start-life').click();
  await expect(page.locator('#life-message')).toContainText(/ice/i);
  await expect(page.locator('#organism-count')).toHaveText('0');
  const site = await introduce(page, world);
  await expect(page.locator('#variant-count')).toHaveText('1');
  await expect(page.locator('#occupied-count')).toHaveText('1');
  await expect(page.locator('#pause-world')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#species-panel')).toBeVisible();
  await expect(page.locator('#species-detail')).toContainText('Photosynthesis');
  const day = Number(await page.locator('#world-day').getAttribute('data-day'));
  await page.locator('#step-world').click();
  await expect(page.locator('#world-day')).toHaveAttribute('data-day', String(day + 1));
  await expect.poll(async () => Number((await page.locator('#organism-count').textContent()).replace(/\D/g, ''))).toBeGreaterThan(20);
  await expect(page.locator('#life-census-day')).toContainText(String(day + 1));
  await expect(page.locator('#world-map')).toHaveAttribute('data-pinned-id', String(site.id));
  await expect(page.locator('#reset-life')).toHaveCount(0);
  await expect(page.locator('#founder-population')).toHaveCount(0);
  await expect(page.locator('#start-life')).toBeHidden();
  expect(errors).toEqual([]);
});

test('life catalogue preserves state through themes and languages and fits narrow screens', async ({ page }, testInfo) => {
  const world = await openLifeWorld(page);
  await introduce(page, world);
  const before = await page.locator('#world-day').getAttribute('data-day');
  for (const locale of ['en', 'pl']) {
    await page.locator(`[data-locale="${locale}"]`).click();
    for (const theme of ['light', 'dark']) {
      await chooseTheme(page, theme);
      await page.locator('#species-select').scrollIntoViewIfNeeded();
      await page.locator('#species-select').focus();
      await expect(page.locator('#species-select')).toHaveCSS('outline-style', 'solid');
      await expect(page.locator('#species-detail .specimen-svg')).toBeVisible();
      await expect(page.locator('#organism-count')).toHaveText('20');
      await expect(page.locator('#world-day')).toHaveAttribute('data-day', before);
      expect(await page.evaluate(() => {
        const notebook = document.querySelector('.notebook');
        return document.documentElement.scrollWidth <= innerWidth
          && notebook.scrollWidth <= notebook.clientWidth + 1;
      })).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`life-${locale}-${theme}.png`) });
    }
  }
  if (testInfo.project.name === 'phone') {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.locator('#species-detail').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.querySelector('.notebook').scrollWidth
      <= document.querySelector('.notebook').clientWidth + 1)).toBe(true);
  }
});

test('worker playback matches headless biology at the same completed day despite display changes', async ({ page }) => {
  const world = await openLifeWorld(page);
  const site = await introduce(page, world);
  await page.locator('#simulation-speed').fill('10');
  await page.locator('#play-world').click();
  await page.locator('#zoom-in').click();
  await chooseTheme(page, 'dark');
  await page.locator('[data-locale="pl"]').click();
  await expect.poll(async () => Number(await page.locator('#world-day').getAttribute('data-day'))).toBeGreaterThanOrEqual(world.day + 20);
  await page.locator('#pause-world').click();
  await expect(page.locator('#playback-state')).toHaveText('Pauza');
  const completedDay = Number(await page.locator('#world-day').getAttribute('data-day'));
  const reference = createLifeModel(world);
  expect(reference.introduce(site.id).ok).toBe(true);
  reference.advanceTo(completedDay);
  const counts = reference.observe().counts;
  for (const [selector, key] of [['#organism-count', 'organisms'], ['#species-count', 'species'], ['#variant-count', 'variants'], ['#occupied-count', 'occupiedHexes']]) {
    await expect(page.locator(selector)).toHaveAttribute('data-count', String(counts[key]));
  }
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.locator('#play-world').click();
  await page.waitForTimeout(600);
  await expect(page.locator('#world-day')).toHaveAttribute('data-day', String(completedDay));
});

test('plants adapt to a land site and a new introduction is available only after extinction', async ({ page }) => {
  const world = await openLifeWorld(page);
  // A real seasonal-shortage scenario, without injecting or deleting organisms.
  const site = world.hexes.find(hex => {
    if (hex.waterType !== 'none' || hex.runoff || hex.permanentIce || hex.temperature > 9 || hex.row < world.height / 2) return false;
    const reference = createLifeModel(world);
    if (!reference.introduce(hex.id).ok) return false;
    reference.advanceTo(world.day + 120);
    return reference.observe().status === 'extinct';
  });
  expect(site).toBeTruthy();
  await pinHex(page, site, world.width, world.height);
  await page.locator('#start-life').click();
  await expect(page.locator('#organism-count')).toHaveText('20');
  await expect(page.locator('.gene-row').filter({ hasText: 'Land adaptation' })).not.toContainText('Aquatic');
  await expect(page.locator('.gene-row').filter({ hasText: 'Temperature tolerance' })).not.toContainText('Absent');
  await expect(page.locator('#start-life')).toBeHidden();
  await expect(page.locator('#reset-life')).toHaveCount(0);
  await page.locator('#simulation-speed').fill('10');
  await page.locator('#play-world').click();
  await expect(page.locator('#life-state')).toHaveAttribute('data-status', 'extinct', { timeout: 12000 });
  await expect(page.locator('#playback-state')).toHaveText('Paused');
  await expect(page.locator('#organism-count')).toHaveText('0');
  await expect(page.locator('#start-life')).toBeVisible();
  const day = Number(await page.locator('#world-day').getAttribute('data-day'));
  await introduce(page, setDay(world, day));
  await expect(page.locator('#world-day')).toHaveAttribute('data-day', String(day));
  await expect(page.locator('#life-state')).toHaveAttribute('data-status', 'living');
  await expect(page.locator('#start-life')).toBeHidden();
});
