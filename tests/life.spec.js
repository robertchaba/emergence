import { test, expect } from '@playwright/test';
import { generateWorld, setDay } from '../src/simulation/world.js';
import { createLifeModel, restoreLifeModel } from '../src/simulation/life/v1/model.js';
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
  await expect(page.locator('#species-count')).toHaveText('1');
  await expect(page.locator('#play-world')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#pause-world').click();
  await expect(page.locator('#playback-state')).toHaveText('Paused');
  return site;
}

test('plant introduction validates sites, advances completed biology, and prevents resetting living populations', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const world = await openLifeWorld(page);
  await expect(page.locator('#species-count')).toHaveText('0');
  await expect(page.locator('#start-life')).toBeDisabled();
  await expect(page.locator('#world-day')).toHaveAttribute('data-day', '1');
  await expect(page.locator('#pause-world')).toHaveAttribute('aria-pressed', 'true');
  const ice = world.hexes.find(hex => hex.permanentIce);
  await pinHex(page, ice, world.width);
  await page.locator('#start-life').click();
  await expect(page.locator('#life-message')).toContainText(/ice/i);
  await expect(page.locator('#species-count')).toHaveText('0');
  const site = await introduce(page, world);
  await expect(page.locator('#variant-count')).toHaveCount(0);
  await expect(page.locator('#occupied-count')).toHaveText('0.3%');
  await expect(page.locator('#pause-world')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#species-panel')).toBeVisible();
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-species-id', '');
  const choice = page.locator('#species-list button');
  await expect(choice).toHaveAttribute('aria-expanded', 'true');
  await choice.click();
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-species-id', 'species-1');
  await choice.click();
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-species-id', '');
  await expect(page.locator('#show-life, #organism-count, #variant-select, #life-processes, .model-badge')).toHaveCount(0);
  await expect(page.locator('.notebook')).not.toContainText(/Life introduced|Life is present|approximated|upkeep cost/);
  await expect(page.locator('#species-detail')).toContainText('Photosynthesis');
  const day = Number(await page.locator('#world-day').getAttribute('data-day'));
  await page.locator('#step-world').click();
  await expect(page.locator('#world-day')).toHaveAttribute('data-day', String(day + 1));
  await expect.poll(async () => Number((await page.locator('.species-population').textContent()).replace(/\D/g, ''))).toBeGreaterThan(20);
  await expect(page.locator('#life-census-day')).toHaveCount(0);
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
      await page.locator('#species-list button').scrollIntoViewIfNeeded();
      await page.locator('#species-list button').focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(page.locator('#species-list button')).toHaveCSS('outline-style', 'solid');
      await expect(page.locator('#species-detail .specimen-svg')).toBeVisible();
      await expect(page.locator('.species-population')).toHaveAttribute('data-count', '20');
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
  await expect(page.locator('.species-population')).toHaveAttribute('data-count', String(reference.observe().species.find(row => row.id === 'species-1').population));
  for (const [selector, key] of [['#species-count', 'species'], ['#extinct-species-count', 'extinctSpecies'], ['#occupied-count', 'occupiedHexes']]) {
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
  await expect(page.locator('.species-population')).toHaveAttribute('data-count', '20');
  await expect(page.locator('.gene-row').filter({ hasText: 'Land adaptation' })).not.toContainText('Aquatic');
  await expect(page.locator('.gene-row').filter({ hasText: 'Temperature tolerance' })).not.toContainText('Absent');
  await expect(page.locator('#start-life')).toBeHidden();
  await expect(page.locator('#reset-life')).toHaveCount(0);
  await page.locator('#simulation-speed').fill('10');
  await page.locator('#play-world').click();
  await expect(page.locator('.life-panel')).toHaveAttribute('data-status', 'extinct', { timeout: 12000 });
  await expect(page.locator('#extinct-species-count')).toHaveText('1');
  await expect(page.locator('#playback-state')).toHaveText('Paused');
  await expect(page.locator('#species-count')).toHaveText('0');
  await expect(page.locator('#start-life')).toBeVisible();
  const day = Number(await page.locator('#world-day').getAttribute('data-day'));
  await page.locator('#simulation-speed').fill('1');
  await introduce(page, setDay(world, day));
  expect(Number(await page.locator('#world-day').getAttribute('data-day'))).toBeGreaterThanOrEqual(day);
  await expect(page.locator('.life-panel')).toHaveAttribute('data-status', 'living');
  await expect(page.locator('#start-life')).toBeHidden();
});

test('local species list excludes distant species and shows partial gene carriers with explicit highlights', async ({ page }, testInfo) => {
  const world = setDay(generateWorld(settings), 1);
  const site = suitable(world);
  const model = createLifeModel(world);
  model.introduce(site.id);
  const saved = model.exportState();
  const original = saved.genomes[0];
  saved.genomes.push({ ...original, id: 'rare-mobile', genome: { ...original.genome, movement: 1 }, establishedOrder: 2 });
  saved.cohorts.push({ ...saved.cohorts[0], genomeId: 'rare-mobile', count: 5 });
  saved.species.push({ id: 'species-2', name: 'Veladora mirena', originDay: 1, parentId: 'species-1', extinctDay: null });
  saved.species.push({ id: 'species-3', name: 'Selathe arolina', originDay: 1, parentId: 'species-1', extinctDay: null });
  saved.cohorts.push({ ...saved.cohorts[0], speciesId: 'species-2', count: 8 });
  saved.cohorts.push({ ...saved.cohorts[0], speciesId: 'species-3', hexId: site.neighbors[0], count: 4 });
  saved.history = [{ day: 1, population: 37, species: 3, extinctSpecies: 0, variants: 2, occupiedHexes: 2 }];
  const snapshot = restoreLifeModel(world, saved).observe();
  // The browser receives a real model observation via a fixed worker fixture.
  await page.route('**/assets/life-worker-*.js', route => route.fulfill({ contentType: 'text/javascript',
    body: `self.onmessage = ({data}) => self.postMessage({command: data.command, observation: ${JSON.stringify(snapshot)}});`,
  }));
  await openLifeWorld(page);
  await pinHex(page, site, world.width, world.height);
  await expect(page.locator('#species-count')).toHaveText('3');
  const choices = page.locator('#species-list button');
  await expect(choices).toHaveText([snapshot.species.find(row => row.id === 'species-1').name, 'Veladora mirena']);
  await expect(page.locator('#species-detail')).toHaveCount(0);
  await choices.first().click();
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-species-id', 'species-1');
  await expect(page.locator('.species-population')).toHaveAttribute('data-count', '25');
  await expect(page.locator('.gene-row.is-partial')).toContainText('Movement');
  await expect(page.locator('.gene-row.is-partial')).toContainText('20% of population');
  await expect(page.locator('.gene-list')).not.toContainText(/Animal feeding|Trunk|Absent/);
  for (const theme of ['light', 'dark']) {
    await chooseTheme(page, theme);
    await page.locator('#species-detail').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`mixed-genes-${theme}.png`) });
  }
  const map = page.locator('#world-map');
  const still = await map.screenshot();
  await page.locator('#play-world').click();
  await page.waitForTimeout(350);
  expect((await map.screenshot()).equals(still)).toBe(false);
  await page.locator('#pause-world').click();
  const paused = await map.screenshot();
  await page.waitForTimeout(300);
  expect((await map.screenshot()).equals(paused)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#play-world').click();
  const reduced = await map.screenshot();
  await page.waitForTimeout(300);
  expect((await map.screenshot()).equals(reduced)).toBe(true);
  await page.locator('#pause-world').click();
  await choices.nth(1).click();
  await expect(page.locator('.species-population')).toHaveAttribute('data-count', '8');
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-species-id', 'species-2');
  await page.locator('[data-locale="pl"]').click();
  await expect(choices.nth(1)).toHaveText('Veladora mirena');
  await expect(choices.nth(1)).toHaveAttribute('aria-pressed', 'true');
  const empty = world.hexes.find(hex => !snapshot.hexes.some(row => row.hexId === hex.id));
  await pinHex(page, empty, world.width, world.height);
  await expect(page.locator('#hex-life-empty')).toHaveText('Brak życia w tym heksie.');
  await expect(page.locator('#species-panel')).toBeHidden();
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-species-id', '');
});
