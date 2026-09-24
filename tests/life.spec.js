import { test, expect } from '@playwright/test';
import { generateWorld, setDay } from '../src/simulation/world.js';
import { createLifeModel, restoreLifeModel } from '../src/simulation/life/v2/model.js';
import { createLifeModel as createActiveLifeModel, restoreLifeModel as restoreActiveLifeModel } from '../src/simulation/life/v3/model.js';
import { chooseTheme } from './ui-helpers.js';

const settings = { seed: 'life-browser-check', size: 'small' };

test('a sole species opens by default and remembers a keyboard collapse through updates', async ({ page }, testInfo) => {
  const world = setDay(generateWorld(settings), 1);
  const site = suitable(world);
  const model = createActiveLifeModel(world);
  model.introduce(site.id);
  const saved = model.exportState();
  saved.populations.push({ ...saved.populations[0], hexId: site.neighbors[0], count: 7 });
  const snapshot = restoreActiveLifeModel(world, saved).observe();
  await page.route('**/assets/life-worker-*.js', route => route.fulfill({ contentType: 'text/javascript',
    body: `const observation = ${JSON.stringify(snapshot)};
      self.onmessage = ({data}) => { if (data.command === 'advance') { observation.day += 1; observation.revision += 1; }
        self.postMessage({command: data.command, observation}); };`,
  }));
  await openLifeWorld(page);
  await pinHex(page, site, world.width, world.height);
  const choice = page.locator('.species-choice');
  await expect(choice).toHaveCount(1);
  await expect(choice).toHaveAttribute('aria-expanded', 'true');
  await expect(choice).toHaveAttribute('data-collapsible', 'true');
  await expect(choice).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-species-id', snapshot.species[0].id);
  await expect(page.locator('.species-population')).toHaveText('Total population: 27');
  await expect(page.locator('.species-local-population')).toHaveText('On this hex: 20');
  await choice.press('Enter');
  await expect(choice).toHaveAttribute('aria-expanded', 'false');
  for (const theme of ['light', 'dark']) {
    await chooseTheme(page, theme);
    await page.locator(`[data-locale="${theme === 'light' ? 'en' : 'pl'}"]`).click();
    await page.locator('#step-world').click();
    await expect(choice).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#species-detail')).toHaveCount(0);
    await expect(page.locator('#world-map')).toHaveAttribute('data-selected-species-id', '');
    await choice.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(choice).toHaveCSS('outline-style', 'solid');
    await page.screenshot({ path: testInfo.outputPath(`sole-species-collapsed-${theme}.png`) });
    await choice.press('Space');
    await expect(choice).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#species-detail')).toBeVisible();
    await expect(page.locator('#world-map')).toHaveAttribute('data-selected-species-id', snapshot.species[0].id);
    await expect(page.locator('.species-local-population')).toHaveText(theme === 'light' ? 'On this hex: 20' : 'W tym heksie: 20');
    await page.screenshot({ path: testInfo.outputPath(`sole-species-expanded-${theme}.png`) });
    await page.locator('.species-local-population').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`local-population-${theme}.png`) });
    await choice.press('Enter');
  }
  await pinHex(page, world.hexes[site.neighbors[0]], world.width, world.height);
  await expect(choice).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-species-id', snapshot.species[0].id);
  await expect(page.locator('.species-population')).toHaveAttribute('data-count', '27');
  await expect(page.locator('.species-local-population')).toHaveAttribute('data-count', '7');
});

test('species size and energy labels, ordered genomes and collapsible details survive live updates', async ({ page }, testInfo) => {
  const world = setDay(generateWorld(settings), 1);
  const site = suitable(world);
  const model = createActiveLifeModel(world);
  model.introduce(site.id);
  const soleSpecies = model.observe();
  const saved = model.exportState();
  const original = saved.species[0];
  const diets = [
    { photosynthesis: 1, plantFeeding: 0, animalFeeding: 0 },
    { photosynthesis: 0, plantFeeding: 1, animalFeeding: 0 },
    { photosynthesis: 0, plantFeeding: 0, animalFeeding: 1 },
    { photosynthesis: 1, plantFeeding: 1, animalFeeding: 1 },
  ];
  saved.species = diets.map((diet, index) => ({ ...original, id: `species-${index + 1}`,
    genomeHistory: undefined, // Synthetic genomes have no recorded evolutionary past.
    name: `Exemplaria ${['viridis', 'brunnea', 'rubra', 'mixta'][index]}`,
    genome: { ...original.genome, ...diet, size: [1, 3, 6, 10][index], trunk: 0, sexualReproduction: 1 }, candidates: [] }));
  saved.populations = saved.species.map(species => ({ ...saved.populations[0], speciesId: species.id }));
  saved.day = 2; saved.revision += 1;
  const initial = restoreActiveLifeModel(world, saved).observe();
  saved.day += 1; saved.revision += 1;
  saved.species[0].genome.animalFeeding = 1;
  saved.species[0].genome.size = 7;
  const changed = restoreActiveLifeModel(world, saved).observe();
  await page.route('**/assets/life-worker-*.js', route => route.fulfill({ contentType: 'text/javascript',
    body: `const snapshots = ${JSON.stringify([soleSpecies, initial, changed])}; let revision = 0;
      self.onmessage = ({data}) => { if (data.command === 'advance') revision = Math.min(2, revision + 1);
        self.postMessage({command: data.command, observation: snapshots[revision]}); };`,
  }));
  await openLifeWorld(page);
  await pinHex(page, site, world.width, world.height);
  const choices = page.locator('.species-choice');
  await expect(choices).toHaveCount(1);
  await expect(choices.first()).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#step-world').click();
  await expect(choices).toHaveCount(4);
  await expect(page.locator('.life-trend-legend li')).toHaveCount(4);
  expect(await page.locator('.life-trend-legend li').evaluateAll(nodes => nodes.map(node => Number(node.dataset.count))))
    .toEqual([1, 1, 1, 1]);
  await expect(page.locator('.life-trend-band')).toHaveCount(4);
  await choices.first().click();
  await expect(page.locator('#species-detail')).toHaveCount(0);
  const first = choices.first();
  const mixed = choices.last();
  await expect(mixed.locator('.species-energy-label')).toHaveCount(3);
  for (const locale of ['en', 'pl']) {
    await page.locator(`[data-locale="${locale}"]`).click();
    await expect(choices.locator('.species-size')).toHaveText(locale === 'en'
      ? ['Tiny', 'Small', 'Moderately large', 'Enormous']
      : ['Maleńki', 'Mały', 'Umiarkowanie duży', 'Olbrzymi']);
    await expect(mixed.locator('.species-energy-label')).toHaveText(locale === 'en'
      ? ['Photosynthesis', 'Plant feeding', 'Animal feeding'] : ['Fotosynteza', 'Roślinożerność', 'Mięsożerność']);
    for (const theme of ['light', 'dark']) {
      await chooseTheme(page, theme);
      const sizeBounds = await first.locator('.species-size').boundingBox();
      const energyBounds = await first.locator('.species-energy-label').boundingBox();
      expect(Math.abs(sizeBounds.y - energyBounds.y)).toBeLessThan(1);
      expect(sizeBounds.x).toBeGreaterThanOrEqual(energyBounds.x + energyBounds.width);
      await page.locator('.life-overview').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`energy-chart-${locale}-${theme}.png`) });
      await mixed.focus();
      await page.keyboard.press('Enter');
      await expect(mixed).toHaveAttribute('aria-expanded', 'true');
      await expect(mixed.locator('.species-size')).toContainText(await page.locator('.gene-expression[data-gene="size"]').innerText());
      expect(await page.locator('.gene-row').evaluateAll(rows => rows.slice(0, 5).map(row => row.dataset.gene)))
        .toEqual(['photosynthesis', 'plantFeeding', 'animalFeeding', 'size', 'sexualReproduction']);
      await expect(mixed).toBeFocused();
      await expect(mixed).toHaveCSS('outline-style', 'solid');
      const colours = await mixed.locator('.species-energy-label').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).color));
      expect(new Set(colours).size).toBe(3);
      await page.screenshot({ path: testInfo.outputPath(`species-energy-${locale}-${theme}.png`) });
      await page.locator('.gene-heading').first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`ordered-genes-${locale}-${theme}.png`) });
      await mixed.press('Enter');
      await expect(mixed).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#species-detail')).toHaveCount(0);
      await expect(page.locator('#world-map')).toHaveAttribute('data-selected-species-id', '');
      await expect(mixed.locator('.species-size')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth
        && document.querySelector('.notebook').scrollWidth <= document.querySelector('.notebook').clientWidth + 1)).toBe(true);
      await page.locator('.notebook').evaluate(node => { node.scrollTop = node.scrollHeight; });
      await page.screenshot({ path: testInfo.outputPath(`species-collapsed-${locale}-${theme}.png`) });
    }
  }
  await page.locator('#step-world').click();
  await expect(page.locator('#world-day')).toHaveAttribute('data-day', '3');
  expect(await page.locator('.life-trend-legend li').evaluateAll(nodes => nodes.map(node => Number(node.dataset.count))))
    .toEqual([0, 1, 1, 2]);
  await expect(page.locator('#species-detail')).toHaveCount(0);
  await page.locator('[data-locale="en"]').click();
  await expect(page.locator('#species-detail')).toHaveCount(0);
  await expect(first.locator('.species-size')).toHaveText('Large');
  await first.click();
  expect(await page.locator('.gene-row').evaluateAll(rows => rows.slice(0, 4).map(row => row.dataset.gene)))
    .toEqual(['photosynthesis', 'animalFeeding', 'size', 'sexualReproduction']);
  if (testInfo.project.name === 'phone') {
    await page.setViewportSize({ width: 320, height: 700 });
    expect(await page.evaluate(() => document.querySelector('.notebook').scrollWidth
      <= document.querySelector('.notebook').clientWidth + 1)).toBe(true);
  }
});

test('population counts ease towards observations, retarget smoothly and respect reduced motion', async ({ page }) => {
  const world = setDay(generateWorld(settings), 1);
  const site = suitable(world);
  const model = createActiveLifeModel(world);
  model.introduce(site.id);
  const saved = model.exportState();
  const snapshots = [20, 32, 24, 50].map((count, index) => {
    saved.day = index + 1; saved.revision = index + 1;
    saved.populations[0].count = count;
    return restoreActiveLifeModel(world, saved).observe();
  });
  await page.route('**/assets/life-worker-*.js', route => route.fulfill({ contentType: 'text/javascript',
    body: `const snapshots = ${JSON.stringify(snapshots)}; let revision = 0;
      self.onmessage = ({data}) => { if (data.command === 'advance') revision = Math.min(3, revision + 1);
        self.postMessage({command: data.command, observation: snapshots[revision]}); };`,
  }));
  await openLifeWorld(page);
  await pinHex(page, site, world.width, world.height);
  const population = page.locator('.species-population');
  await expect(population).toHaveText('Total population: 20');
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.locator('#step-world').click();
  await expect(population).toHaveAttribute('data-count', '32');
  await expect(population).toHaveText('Total population: 20');
  await page.clock.runFor(80);
  const intermediate = Number((await population.textContent()).replace(/\D/g, ''));
  expect(intermediate).toBeGreaterThan(20);
  expect(intermediate).toBeLessThan(32);
  await page.locator('#step-world').click();
  await expect(population).toHaveAttribute('data-count', '24');
  await page.locator('[data-locale="pl"]').click();
  await expect(population).toHaveText(`Łączna populacja: ${intermediate}`);
  await page.clock.runFor(300);
  await expect(population).toHaveText('Łączna populacja: 24');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#step-world').click();
  await expect(population).toHaveAttribute('data-count', '50');
  await expect(population).toHaveText('Łączna populacja: 50');
  await page.clock.runFor(300);
  await expect(population).toHaveText('Łączna populacja: 50');
});

test('V3 distinguishes estimated adaptation ranges from inherited traits in both languages and themes', async ({ page }, testInfo) => {
  const world = setDay(generateWorld(settings), 1);
  const site = suitable(world);
  const model = createActiveLifeModel(world);
  model.introduce(site.id);
  const saved = model.exportState();
  const species = saved.species[0];
  Object.assign(species.genome, { elevationTolerance: 1, depthTolerance: 1 });
  delete species.genomeHistory; // Synthetic genome has no recorded evolutionary past.
  // Controlled ecological mismatch, inspected through the real V3 observer.
  // Candidates are prospective directions and have no carrier population.
  species.candidates = [
    { id: 'depth-direction', genome: { ...species.genome, depthTolerance: 3 } },
    { id: 'unfavoured-direction', genome: { ...species.genome, elevationTolerance: 2 } },
  ].map(candidate => ({ ...candidate, originDay: 1, lastEvaluation: 1, age: 0, steps: 1, support: 0, advantage: 0 }));
  const snapshot = restoreActiveLifeModel(world, saved).observe();
  expect(snapshot.modelId).toBe('v3');
  expect(snapshot.species[0].tendencies[0].locations).toEqual([{ hexId: site.id }]);
  await page.route('**/assets/life-worker-*.js', route => route.fulfill({ contentType: 'text/javascript',
    body: `self.onmessage = ({data}) => self.postMessage({command: data.command, observation: ${JSON.stringify(snapshot)}});`,
  }));
  await openLifeWorld(page);
  await pinHex(page, site, world.width, world.height);
  const direction = page.locator('[data-tendency-id="depth-direction"]');
  const disclosure = page.locator('.species-tendencies summary');
  await expect(direction).toBeHidden();
  await expect(page.locator('#species-detail .specimen-portrait')).toHaveCount(0);
  await expect(page.locator('.species-tendencies .field-note')).toHaveCount(0);
  await disclosure.focus();
  await page.keyboard.press('Enter');
  await expect(direction).toBeVisible();
  await expect(page.locator('[data-tendency-id="unfavoured-direction"]')).toBeDisabled();
  await expect(page.locator('.gene-list button')).toHaveCount(0);
  await expect(page.locator('.gene-expression[data-gene="photosynthesis"]')).toHaveText('100%');
  await direction.focus();
  await page.keyboard.press('Enter');
  await expect(direction).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-variant-id', 'tendency:depth-direction');
  const labels = {
    en: ['Possible adaptations', 'Elevation tolerance', 'Water depth tolerance', 'Hexes: ~1'],
    pl: ['Możliwe adaptacje', 'Tolerancja wysokości', 'Tolerancja głębokości wody', 'Heksy: ~1'],
  };
  for (const locale of ['en', 'pl']) {
    await page.locator(`[data-locale="${locale}"]`).click();
    await expect(disclosure).toHaveText(labels[locale][0]);
    await expect(page.locator('.gene-list')).toContainText(labels[locale][1]);
    await expect(page.locator('.gene-list')).toContainText(labels[locale][2]);
    await expect(direction).toContainText(labels[locale][3]);
    await expect(direction).not.toContainText('%');
    for (const theme of ['light', 'dark']) {
      await chooseTheme(page, theme);
      await direction.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(direction).toBeFocused();
      await expect(direction).toHaveCSS('outline-style', 'solid');
      await expect(direction).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#world-day')).toHaveAttribute('data-day', '1');
      await expect(page.locator('.species-population')).toHaveAttribute('data-count', '20');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth
        && document.querySelector('.notebook').scrollWidth <= document.querySelector('.notebook').clientWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`v3-tendencies-${locale}-${theme}.png`) });
    }
  }
  await disclosure.click();
  await expect(direction).toBeHidden();
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-variant-id', 'tendency:depth-direction');
  await page.locator('[data-locale="en"]').click();
  await expect(direction).toBeHidden();
  await disclosure.focus();
  await page.keyboard.press('Enter');
  await expect(direction).toBeVisible();
  if (testInfo.project.name === 'phone') {
    await page.setViewportSize({ width: 320, height: 700 });
    expect(await page.evaluate(() => document.querySelector('.notebook').scrollWidth
      <= document.querySelector('.notebook').clientWidth + 1)).toBe(true);
  }
});

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
  await expect(page.locator('#simulation-speed')).toHaveValue('10');
  await expect(page.locator('#target-speed')).toContainText('10×');
  await expect(page.locator('#target-speed')).toContainText('20 days/s');
  return site;
}

test('plant introduction advances completed biology and prevents resetting living populations', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const world = await openLifeWorld(page);
  await expect(page.locator('#species-count')).toHaveText('0');
  await expect(page.locator('#start-life')).toBeDisabled();
  await expect(page.locator('#world-day')).toHaveAttribute('data-day', '1');
  await expect(page.locator('#pause-world')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#simulation-speed')).toHaveValue('1');
  const site = await introduce(page, world);
  await expect(page.locator('#hex-details')).toContainText('100% (water)');
  await expect(page.locator('.life-trend-drawing svg')).toHaveCount(1);
  await expect(page.locator('.life-trend-drawing')).toHaveAttribute('data-metric', 'species');
  await expect(page.locator('#species-title')).toHaveCount(0);
  await expect(page.locator('.gene-list')).not.toContainText('Present');
  await expect(page.locator('button.gene-expression')).toHaveCount(0);
  await expect(page.locator('span.gene-expression[data-gene="photosynthesis"]')).toHaveText('100%');
  await expect(page.locator('#variant-count')).toHaveCount(0);
  await expect(page.locator('#occupied-count')).toHaveText('0.3%');
  await expect(page.locator('#pause-world')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#species-panel')).toBeVisible();
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-species-id', 'species-1');
  const choice = page.locator('.species-choice');
  await expect(choice).toHaveAttribute('aria-expanded', 'true');
  await choice.click();
  await expect(choice).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#species-detail')).toHaveCount(0);
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-species-id', '');
  await choice.click();
  await expect(choice).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-species-id', 'species-1');
  await expect(page.locator('#show-life, #organism-count, #variant-select, #life-processes, .model-badge')).toHaveCount(0);
  await expect(page.locator('.notebook')).not.toContainText(/Life introduced|Life is present|approximated|upkeep cost/);
  await expect(page.locator('#species-detail')).toContainText('Photosynthesis');
  const day = Number(await page.locator('#world-day').getAttribute('data-day'));
  for (let offset = 1; offset <= 4; offset += 1) {
    await page.locator('#step-world').click();
    await expect(page.locator('#world-day')).toHaveAttribute('data-day', String(day + offset));
  }
  await expect.poll(async () => Number((await page.locator('.species-population').textContent()).replace(/\D/g, ''))).toBeGreaterThan(20);
  await expect(page.locator('#life-census-day')).toHaveCount(0);
  await expect(page.locator('#world-map')).toHaveAttribute('data-pinned-id', String(site.id));
  await expect(page.locator('#reset-life')).toHaveCount(0);
  await expect(page.locator('#founder-population')).toHaveCount(0);
  await expect(page.locator('#start-life')).toBeHidden();
  expect(errors).toEqual([]);
});

test('ice accepts life and normal extinction allows another introduction', async ({ page }) => {
  const world = await openLifeWorld(page);
  const ice = world.hexes.find(hex => hex.permanentIce);
  await pinHex(page, ice, world.width, world.height);
  await page.locator('#start-life').click();
  await expect(page.locator('#species-count')).toHaveText('1');
  await expect(page.locator('.species-population')).toHaveAttribute('data-count', '20');
  await expect(page.locator('#play-world')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#simulation-speed').fill('10');
  await expect(page.locator('.life-panel')).toHaveAttribute('data-status', 'extinct');
  await expect(page.locator('#playback-state')).toHaveText('Paused');
  await expect(page.locator('#start-life')).toBeVisible();
  await page.locator('#simulation-speed').fill('1');
  await page.locator('#start-life').click();
  await expect(page.locator('#simulation-speed')).toHaveValue('10');
  await page.locator('#pause-world').click();
  await expect(page.locator('#species-count')).toHaveText('1');
  await expect(page.locator('#world-map')).toHaveAttribute('data-pinned-id', String(ice.id));
});

test('life catalogue preserves state through themes and languages and fits narrow screens', async ({ page }, testInfo) => {
  const world = await openLifeWorld(page);
  const site = await introduce(page, world);
  const reference = createActiveLifeModel(world);
  reference.introduce(site.id);
  const size = reference.observe().species[0].variants[0].traits.find(trait => trait.key === 'size').value;
  const sizeLabels = {
    en: ['Tiny', 'Very small', 'Small', 'Fairly small', 'Medium', 'Moderately large', 'Large', 'Very large', 'Huge', 'Enormous'],
    pl: ['Maleńki', 'Bardzo mały', 'Mały', 'Dość mały', 'Średni', 'Umiarkowanie duży', 'Duży', 'Bardzo duży', 'Ogromny', 'Olbrzymi'],
  };
  const before = await page.locator('#world-day').getAttribute('data-day');
  // Introduction starts 10× playback; a turn may complete before Pause arrives.
  const populationBefore = await page.locator('.species-population').getAttribute('data-count');
  expect(Number(populationBefore)).toBeGreaterThan(0);
  for (const locale of ['en', 'pl']) {
    await page.locator(`[data-locale="${locale}"]`).click();
    await expect(page.locator('.gene-expression[data-gene="size"]')).toHaveText(sizeLabels[locale][size - 1]);
    await expect(page.locator('#hex-details')).toContainText(locale === 'pl' ? '100% (woda)' : '100% (water)');
    for (const theme of ['light', 'dark']) {
      await chooseTheme(page, theme);
      await page.locator('.species-choice').scrollIntoViewIfNeeded();
      await page.locator('.species-choice').focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(page.locator('.species-choice')).toHaveCSS('outline-style', 'solid');
      await expect(page.locator('#species-detail .specimen-svg')).toHaveCount(0);
      await expect(page.locator('.species-population')).toHaveAttribute('data-count', populationBefore);
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
  const reference = createActiveLifeModel(world);
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
  // A real V3 cold-land shortage, without injecting or deleting organisms.
  const site = world.hexes.find(hex => {
    if (hex.waterType !== 'none' || hex.runoff || hex.permanentIce || hex.humidity <= 0
      || hex.temperature >= 0 || hex.row < world.height / 2) return false;
    const reference = createActiveLifeModel(world);
    if (!reference.introduce(hex.id).ok) return false;
    reference.advanceTo(world.day + 180);
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
  saved.cohorts[0].count = 15961;
  saved.genomes.push({ ...original, id: 'rare-mobile', genome: { ...original.genome, movement: 1 }, establishedOrder: 2 });
  saved.cohorts.push({ ...saved.cohorts[0], genomeId: 'rare-mobile', count: 4200 });
  for (const [id, key, count] of [['minor', 'trunk', 419], ['threshold', 'plantFeeding', 420]]) {
    saved.genomes.push({ ...original, id, genome: { ...original.genome, [key]: 1 }, establishedOrder: 3 });
    saved.cohorts.push({ ...saved.cohorts[0], genomeId: id, count });
  }
  saved.species.push({ id: 'species-2', name: 'Veladora mirena', originDay: 1, parentId: 'species-1', extinctDay: null });
  saved.species.push({ id: 'species-3', name: 'Selathe arolina', originDay: 1, parentId: 'species-1', extinctDay: null });
  saved.cohorts.push({ ...saved.cohorts[0], speciesId: 'species-2', count: 8 });
  saved.cohorts.push({ ...saved.cohorts[0], speciesId: 'species-3', hexId: site.neighbors[0], count: 4 });
  saved.history = [{ day: 1, population: 21012, species: 3, extinctSpecies: 0, variants: 4, occupiedHexes: 2 }];
  const snapshot = restoreLifeModel(world, saved).observe();
  // The browser receives a real model observation via a fixed worker fixture.
  await page.route('**/assets/life-worker-*.js', route => route.fulfill({ contentType: 'text/javascript',
    body: `self.onmessage = ({data}) => self.postMessage({command: data.command, observation: ${JSON.stringify(snapshot)}});`,
  }));
  await openLifeWorld(page);
  await pinHex(page, site, world.width, world.height);
  await expect(page.locator('#species-count')).toHaveText('3');
  const choices = page.locator('.species-choice');
  await expect(choices.locator('.species-name')).toHaveText([snapshot.species.find(row => row.id === 'species-1').name, 'Veladora mirena']);
  await expect(page.locator('#species-detail')).toHaveCount(0);
  await choices.first().click();
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-species-id', 'species-1');
  await expect(page.locator('.species-population')).toHaveAttribute('data-count', '21000');
  await expect(page.locator('.species-population')).toHaveText('Total population: 21K');
  await expect(page.locator('.gene-expression[data-gene="movement"]')).toHaveText('Expression 1 · 20%');
  await expect(page.locator('.gene-expression[data-gene="plantFeeding"]')).toHaveText('2%');
  await expect(page.locator('.gene-list')).not.toContainText(/Animal feeding|Trunk|Absent/);
  expect(snapshot.species.find(row => row.id === 'species-1').variants.some(variant => variant.id === 'minor')).toBe(true);
  const variant = page.locator('.gene-expression[data-gene="movement"]');
  await variant.focus();
  await page.keyboard.press('Enter');
  await expect(variant).toBeFocused();
  await expect(variant).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-variant-id', '["movement",1]');
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-species-id', 'species-1');
  await expect(page.locator('.life-trend-drawing svg')).toHaveCount(1);
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
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-variant-id', '');
  await expect(page.locator('.species-population')).toHaveAttribute('data-count', '8');
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-species-id', 'species-2');
  await page.locator('[data-locale="pl"]').click();
  await expect(choices.nth(1).locator('.species-name')).toHaveText('Veladora mirena');
  await expect(choices.nth(1)).toHaveAttribute('aria-pressed', 'true');
  const empty = world.hexes.find(hex => !snapshot.hexes.some(row => row.hexId === hex.id));
  await pinHex(page, empty, world.width, world.height);
  await expect(page.locator('#hex-life-empty')).toHaveText('Brak życia w tym heksie.');
  await expect(page.locator('#species-panel')).toBeHidden();
  await expect(page.locator('#world-map')).toHaveAttribute('data-selected-species-id', '');
});

test('near-universal photosynthesis keeps its colour across rounded percentages and updates', async ({ page }, testInfo) => {
  const world = setDay(generateWorld(settings), 1);
  const site = suitable(world);
  const model = createLifeModel(world);
  model.introduce(site.id);
  const saved = model.exportState();
  const original = saved.genomes[0];
  saved.genomes.push({ ...original, id: 'without-photo',
    genome: { ...original.genome, photosynthesis: 0 }, establishedOrder: 2 });
  const founder = saved.cohorts[0];
  const shares = [10000, 9999, 10000, 9800, 9799, 10000];
  const snapshots = shares.map((carriers, index) => {
    saved.day = index + 1;
    saved.revision = index + 1;
    saved.cohorts = [{ ...founder, count: carriers },
      ...(carriers < 10000 ? [{ ...founder, genomeId: 'without-photo', count: 10000 - carriers }] : [])];
    return restoreLifeModel(world, saved).observe();
  });
  await page.route('**/assets/life-worker-*.js', route => route.fulfill({ contentType: 'text/javascript',
    body: `const snapshots = ${JSON.stringify(snapshots)}; let revision = 0;
      self.onmessage = ({data}) => {
        if (data.command === 'advance') revision += 1;
        self.postMessage({command: data.command, observation: snapshots[revision % snapshots.length]});
      };`,
  }));
  await openLifeWorld(page);
  await pinHex(page, site, world.width, world.height);
  const photo = page.locator('.gene-expression[data-gene="photosynthesis"]');
  for (const theme of ['light', 'dark']) {
    await chooseTheme(page, theme);
    for (const [index, carriers] of shares.entries()) {
      for (const locale of ['en', 'pl']) {
        await page.locator(`[data-locale="${locale}"]`).click();
        const share = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(carriers / 10000);
        await expect(photo).toHaveText(share);
        const appearance = await photo.evaluate(node => {
          const row = node.closest('.gene-row');
          const size = document.querySelector('.gene-expression[data-gene="size"]');
          return { value: getComputedStyle(node).color, label: getComputedStyle(row.querySelector('dt')).color,
            normalValue: getComputedStyle(size).color,
            normalLabel: getComputedStyle(size.closest('.gene-row').querySelector('dt')).color,
            selectable: node.localName === 'button' };
        });
        if (carriers >= 9800) {
          expect(appearance.value).toBe(appearance.normalValue);
          expect(appearance.label).toBe(appearance.normalLabel);
          expect(appearance.selectable).toBe(false);
        } else {
          expect(appearance.value).not.toBe(appearance.normalValue);
          expect(appearance.label).not.toBe(appearance.normalLabel);
          expect(appearance.selectable).toBe(true);
        }
      }
      if (carriers === 9999 || carriers === 9799) {
        await photo.scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(`photosynthesis-${theme}-${carriers}.png`) });
      }
      await page.locator('#step-world').click();
      await expect(page.locator('#world-day')).toHaveAttribute('data-day', String((index + 1) % shares.length + 1));
    }
  }
});

test('territory and carrier selections survive updates and clear when an expression becomes minor', async ({ page }, testInfo) => {
  const world = setDay(generateWorld(settings), 1);
  const site = suitable(world);
  const model = createLifeModel(world);
  model.introduce(site.id);
  const saved = model.exportState();
  const original = saved.genomes[0];
  saved.genomes.push({ ...original, id: 'mobile', genome: { ...original.genome, movement: 1 }, establishedOrder: 2 });
  const range = new Set([site.id, ...site.neighbors]);
  for (const id of site.neighbors) for (const neighbor of world.hexes[id].neighbors) range.add(neighbor);
  // A deterministic display fixture with a connected range and a carrier subset.
  const cohort = saved.cohorts[0];
  saved.cohorts = [...range].flatMap(hexId => [
    { ...cohort, hexId, count: 900 },
    ...(world.hexes[hexId].col >= site.col ? [{ ...cohort, hexId, genomeId: 'mobile', count: 100 }] : []),
  ]);
  saved.history = Array.from({ length: 40 }, (_, index) => ({ day: index + 1, species: 1,
    extinctSpecies: 0, occupiedHexes: Math.min(range.size, 1 + Math.floor(index / 2)) }));
  saved.day = 40;
  const initial = restoreLifeModel(world, saved).observe();
  saved.day = 41; saved.revision += 1;
  for (const group of saved.cohorts) if (group.genomeId === 'mobile') group.count = 120;
  const changed = restoreLifeModel(world, saved).observe();
  saved.day = 42; saved.revision += 1;
  const mobileGroups = saved.cohorts.filter(group => group.genomeId === 'mobile').length;
  const stationaryGroups = saved.cohorts.length - mobileGroups;
  for (const group of saved.cohorts) group.count = group.genomeId === 'mobile' ? stationaryGroups * 49 : mobileGroups;
  const universal = restoreLifeModel(world, saved).observe();
  saved.day = 43; saved.revision += 1;
  for (const group of saved.cohorts) group.count = group.genomeId === 'mobile' ? 120 : 900;
  const partialAgain = restoreLifeModel(world, saved).observe();
  saved.day = 44; saved.revision += 1;
  for (const group of saved.cohorts) if (group.genomeId === 'mobile') group.count = 1;
  const minor = restoreLifeModel(world, saved).observe();
  await page.route('**/assets/life-worker-*.js', route => route.fulfill({ contentType: 'text/javascript',
    body: `const snapshots = ${JSON.stringify([initial, changed, universal, partialAgain, minor])}; let revision = 0;
      self.onmessage = ({data}) => { if (data.command === 'advance') revision = Math.min(snapshots.length - 1, revision + 1);
        self.postMessage({command: data.command, observation: snapshots[revision]}); };`,
  }));
  await openLifeWorld(page);
  await pinHex(page, site, world.width, world.height);
  const map = page.locator('#world-map');
  const variant = page.locator('.gene-expression[data-gene="movement"]');
  // Selecting carriers also enables the surrounding species outline.
  await variant.click();
  await expect(map).toHaveAttribute('data-selected-species-id', 'species-1');
  await expect(map).toHaveAttribute('data-selected-variant-id', '["movement",1]');
  for (const theme of ['light', 'dark']) {
    await chooseTheme(page, theme);
    await variant.scrollIntoViewIfNeeded();
    await variant.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(variant).toHaveCSS('outline-style', 'solid');
    // The same green selection treatment applies to both themes, without a flashing border.
    const appearance = await variant.evaluate(node => {
      const style = getComputedStyle(node);
      const root = getComputedStyle(document.documentElement);
      return { background: style.backgroundColor,
        pale: root.getPropertyValue('--map-life-selected').trim() };
    });
    expect(appearance.background).toBe('rgb(37, 76, 53)');
    expect(appearance.pale).toBe('#f5edd0');
    const selectedSize = await variant.boundingBox();
    await variant.click();
    expect(await variant.boundingBox()).toEqual(selectedSize);
    await variant.click();
    await page.screenshot({ path: testInfo.outputPath(`territory-${theme}.png`) });
    await page.locator('.notebook').evaluate(notebook => { notebook.scrollTop = 0; });
    await page.screenshot({ path: testInfo.outputPath(`charts-${theme}.png`) });
  }
  await page.locator('[data-locale="pl"]').click();
  await expect(variant).toHaveAttribute('aria-pressed', 'true');
  await expect(map).toHaveAttribute('data-selected-species-id', 'species-1');
  // Retain keyboard focus through asynchronous population updates.
  await page.evaluate(() => {
    document.querySelector('.gene-expression[data-gene="movement"]').focus();
    document.querySelector('#step-world').click();
  });
  await expect(page.locator('#world-day')).toHaveAttribute('data-day', '41');
  await expect(variant).toBeFocused();
  await expect(variant).toHaveAttribute('aria-pressed', 'true');
  await variant.click();
  await expect(map).toHaveAttribute('data-selected-variant-id', '');
  await expect(map).toHaveAttribute('data-selected-species-id', 'species-1');
  await variant.click();
  await page.evaluate(() => {
    document.querySelector('.gene-expression[data-gene="movement"]').focus();
    document.querySelector('#step-world').click();
  });
  await expect(page.locator('#world-day')).toHaveAttribute('data-day', '42');
  await expect(page.locator('button.gene-expression[data-gene="movement"]')).toHaveCount(0);
  await expect(variant).toHaveText('Ekspresja 1 · 98%');
  await expect(variant).not.toHaveAttribute('aria-pressed');
  await expect(page.locator('.species-choice')).toBeFocused();
  await expect(map).toHaveAttribute('data-selected-variant-id', '');
  await expect(map).toHaveAttribute('data-selected-species-id', 'species-1');
  await page.locator('#step-world').click();
  await expect(page.locator('#world-day')).toHaveAttribute('data-day', '43');
  await expect(variant).toHaveAttribute('aria-pressed', 'false');
  await variant.click();
  await page.locator('#step-world').click();
  await expect(page.locator('#world-day')).toHaveAttribute('data-day', '44');
  await expect(variant).toHaveCount(0);
  await expect(map).toHaveAttribute('data-selected-variant-id', '');
  await expect(map).toHaveAttribute('data-selected-species-id', 'species-1');
  expect(minor.species[0].variants.some(row => row.id === 'mobile')).toBe(true);
  if (testInfo.project.name === 'phone') {
    await page.setViewportSize({ width: 320, height: 700 });
    expect(await page.evaluate(() => document.querySelector('.notebook').scrollWidth
      <= document.querySelector('.notebook').clientWidth + 1)).toBe(true);
  }
});

test('V2 inherited traits and skeleton types are translated and fit both themes', async ({ page }, testInfo) => {
  const world = setDay(generateWorld(settings), 1);
  const site = suitable(world);
  const model = createLifeModel(world);
  model.introduce(site.id);
  const saved = model.exportState();
  const original = saved.genomes[0];
  const traits = {
    poison: 2, spines: 2, detoxification: 2, biteForce: 2, armor: 2, flight: 2,
    eyesight: 3, echolocation: 2, thermalSensing: 2, sexualReproduction: 1,
  };
  // A model-produced observation of explicit test genomes checks presentation;
  // this fixture makes no claim that these combinations evolved in a real run.
  saved.genomes = [1, 2, 3].map(skeleton => ({ ...original, id: `skeleton-${skeleton}`,
    genome: { ...original.genome, ...traits, movement: 3, skeleton, armorType: skeleton }, establishedOrder: skeleton }));
  saved.cohorts = saved.genomes.map(genome => ({ ...saved.cohorts[0], genomeId: genome.id, count: 20 }));
  const snapshot = restoreLifeModel(world, saved).observe();
  await page.route('**/assets/life-worker-*.js', route => route.fulfill({ contentType: 'text/javascript',
    body: `self.onmessage = ({data}) => self.postMessage({command: data.command, observation: ${JSON.stringify(snapshot)}});`,
  }));
  await openLifeWorld(page);
  await pinHex(page, site, world.width, world.height);
  const labels = {
    en: ['Toxins', 'Spines', 'Toxin resistance', 'Bite strength', 'Armour', 'Flight', 'Eyesight',
      'Echolocation', 'Thermal sensing', 'Sexual reproduction', 'Skeleton', 'Armour type'],
    pl: ['Toksyny', 'Kolce', 'Odporność na toksyny', 'Siła ugryzienia', 'Pancerz', 'Lot', 'Wzrok',
      'Echolokacja', 'Wykrywanie ciepła', 'Rozmnażanie płciowe', 'Szkielet', 'Rodzaj pancerza'],
  };
  const skeletonLabels = {
    en: ['Hydrostatic skeleton', 'Exoskeleton', 'Endoskeleton'],
    pl: ['Szkielet hydrostatyczny', 'Szkielet zewnętrzny', 'Szkielet wewnętrzny'],
  };
  const armorLabels = {
    en: ['Mineral shell', 'Segmented plates', 'Scales'],
    pl: ['Skorupa mineralna', 'Płyty segmentowe', 'Łuski'],
  };
  const day = await page.locator('#world-day').getAttribute('data-day');
  for (const locale of ['en', 'pl']) {
    await page.locator(`[data-locale="${locale}"]`).click();
    for (const label of labels[locale]) await expect(page.locator('.gene-list dt').getByText(label, { exact: true })).toBeVisible();
    for (const [index, label] of skeletonLabels[locale].entries()) {
      await expect(page.locator(`.gene-expression[data-gene="skeleton"][data-expression="${index + 1}"]`)).toContainText(label);
    }
    for (const [index, label] of armorLabels[locale].entries()) {
      await expect(page.locator(`.gene-expression[data-gene="armorType"][data-expression="${index + 1}"]`)).toContainText(label);
    }
    await expect(page.locator('.gene-expression[data-gene="sexualReproduction"]')).toHaveText('100%');
    expect(await page.locator('.gene-row').evaluateAll(rows => rows.slice(0, 3).map(row => row.dataset.gene)))
      .toEqual(['photosynthesis', 'size', 'sexualReproduction']);
    for (const theme of ['light', 'dark']) {
      await chooseTheme(page, theme);
      const skeleton = page.locator('.gene-expression[data-gene="skeleton"]').first();
      await skeleton.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(skeleton).toHaveCSS('outline-style', 'solid');
      await skeleton.press('Enter');
      await expect(skeleton).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#world-day')).toHaveAttribute('data-day', day);
      expect(await page.evaluate(() => {
        const notebook = document.querySelector('.notebook');
        return document.documentElement.scrollWidth <= innerWidth && notebook.scrollWidth <= notebook.clientWidth + 1;
      })).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`v2-traits-${locale}-${theme}.png`) });
      await skeleton.press('Enter');
    }
  }
});
