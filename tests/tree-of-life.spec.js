import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { lineageFixture } from './fixtures/lineage.js';
import { createSave, restoreSave } from '../src/ui/save-state.js';
import { createLifeModel } from '../src/simulation/life/v4/model.js';
import { chooseTheme } from './ui-helpers.js';

const { world, state } = lineageFixture();
const view = { camera: { zoom: 2, x: -10, y: 15 }, layer: 'temperature', pinnedId: 18, speed: 6 };
const fixture = createSave(world, state, view);
async function upload(page, saved = fixture, landing = false) {
  await page.goto(landing ? '/' : '/world.html?restore');
  if (landing) await page.locator('#restore-landing').click();
  await page.locator('#restore-file').setInputFiles({ name: 'tree.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
  await page.locator('#restore-dialog [type="submit"]').click();
  await expect(page.locator('#world-map')).toBeFocused();
}
async function openTree(page) {
  await page.locator('#application-menu > summary').click();
  await page.locator('#open-tree-of-life').click();
  await expect(page.locator('#tree-title')).toBeFocused();
  await expect(page.locator('#tree-census')).toContainText('Paused on day');
}
async function download(page) {
  await page.locator('#application-menu > summary').click();
  const pending = page.waitForEvent('download');
  await page.locator('#save-state').click();
  return JSON.parse(await readFile(await (await pending).path(), 'utf8'));
}

test('tree shows all species, ancestral links and gene history in both themes and languages', async ({ page }, testInfo) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  // Also verifies that the landing restore path loads the tree styles.
  await upload(page, fixture, true);
  await openTree(page);
  await expect(page.locator('.tree-species-choice')).toHaveCount(4);
  await expect(page.locator('.tree-detail .tree-gene')).toHaveCount(3);
  await page.locator('.tree-gene[data-gene="photosynthesis"]').click();
  await expect(page.locator('.tree-species-choice[data-gene-present="true"]')).toHaveCount(1);
  await expect(page.locator('.tree-species-choice[data-gene-context="true"]')).toHaveCount(3);
  await expect(page.locator('#tree-all-species')).not.toBeChecked();
  await page.locator('#tree-all-species').check();
  await expect(page.locator('.tree-species-choice[data-gene-present="true"]')).toHaveCount(2);
  await expect(page.locator('.tree-species-choice[data-gene-present="false"]')).toHaveCount(2);
  await page.locator('#tree-clear-gene').click();
  const width = await page.locator('.tree-chart').evaluate(node => node.clientWidth);
  await page.locator('#tree-zoom-in').click();
  expect(await page.locator('.tree-chart').evaluate(node => node.clientWidth)).toBeGreaterThan(width);
  await page.locator('#tree-fit').click();
  await expect(page.locator('#tree-zoom-out')).toBeDisabled();
  await page.locator('.tree-species-choice[data-species-id="species-3"]').click();
  await expect(page.locator('#tree-species-title')).toHaveText('Acutora nocturna');
  await expect(page.locator('.tree-family')).toContainText('Veladora silvatica');
  const gene = page.locator('.tree-gene[data-gene="movement"]');
  await gene.scrollIntoViewIfNeeded(); await gene.focus();
  const position = await page.locator('#tree-of-life').evaluate(node => node.scrollTop);
  const geneTop = (await gene.boundingBox()).y;
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-gene-species]')).toHaveCount(3);
  expect(await page.locator('#tree-of-life').evaluate(node => node.scrollTop)).toBe(position);
  expect(Math.abs((await gene.boundingBox()).y - geneTop)).toBeLessThan(2);
  await expect(page.locator('.tree-gene[data-gene="poison"]')).toHaveCount(0);
  // Default highlights only the inherited path, clipped at each split.
  const rootBands = page.locator('[data-gene-species="species-1"] [data-gene-active]');
  await expect(rootBands).toHaveCount(1);
  await expect(rootBands).toHaveAttribute('data-value', '1');
  await expect(page.locator('[data-gene-origin="species-1"]')).toHaveAttribute('data-day', '10');
  await expect(page.locator('[data-gene-link]')).toHaveCount(2);
  await expect(page.locator('[data-gene-species="species-4"]')).toHaveCount(0);
  await expect(page.locator('.tree-species-choice[data-species-id="species-1"] .tree-species-gene')).toHaveText('Expression 1');
  await expect(gene).toBeFocused();
  await expect(gene).toHaveCSS('outline-style', 'solid');
  // All-species mode explicitly includes the later parent adaptation and sibling.
  await page.locator('#tree-all-species').scrollIntoViewIfNeeded();
  await page.locator('#tree-all-species').focus();
  const togglePosition = await page.locator('#tree-of-life').evaluate(node => node.scrollTop);
  await page.keyboard.press('Space');
  expect(await page.locator('#tree-of-life').evaluate(node => node.scrollTop)).toBe(togglePosition);
  await expect(page.locator('#tree-all-species')).toBeFocused();
  await expect(page.locator('[data-gene-species]')).toHaveCount(4);
  await expect(rootBands).toHaveCount(2);
  await expect(rootBands.nth(1)).toHaveAttribute('data-value', '2');
  expect(Number(await rootBands.nth(1).getAttribute('stroke-width'))).toBeGreaterThan(Number(await rootBands.nth(0).getAttribute('stroke-width')));
  await expect(page.locator('.tree-species-choice[data-species-id="species-4"] .tree-species-gene')).toHaveText('Expression 2');
  await page.keyboard.press('Space');
  await expect(rootBands).toHaveCount(1);
  await expect(page.locator('.tree-gene-timeline li')).toHaveCount(0);
  await page.locator('.tree-history-open').click();
  await expect(page.locator('#tree-history-title')).toBeFocused();
  await expect(page.locator('.tree-gene-timeline li')).toHaveCount(6);
  await expect(page.locator('.tree-gene-timeline li[data-kind="loss"]')).toContainText('Day 30');
  await expect(page.locator('.tree-origin')).toContainText('Primora viridis, day 10');
  await expect(page.locator('.tree-gene-timeline')).not.toContainText('Day 60');
  await page.locator('.tree-history-page > button').click();
  await expect(page.locator('.tree-history-open')).toBeFocused();
  for (const locale of ['en', 'pl']) {
    await page.locator(`[data-locale="${locale}"]`).click();
    await expect(gene).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tree-all-species')).not.toBeChecked();
    await expect(page.locator('#tree-species-title')).toHaveText('Acutora nocturna');
    for (const theme of ['light', 'dark']) {
      await chooseTheme(page, theme);
      await page.locator('#tree-of-life').evaluate(node => { node.scrollTop = 0; });
      await page.screenshot({ path: testInfo.outputPath(`tree-${locale}-${theme}.png`) });
      await page.locator('.tree-trace').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`gene-summary-${locale}-${theme}.png`) });
      await page.locator('.tree-history-open').click();
      await page.screenshot({ path: testInfo.outputPath(`gene-history-${locale}-${theme}.png`) });
      await page.locator('.tree-history-page > button').click();
      expect(await page.locator('#tree-of-life').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    }
  }
  await page.locator('.tree-family .tree-link').click();
  await expect(page.locator('#tree-species-title')).toHaveText('Veladora silvatica');
  await expect(page.locator('.tree-status')).toHaveText('Wymarły');
  await expect(page.locator('.tree-gene')).toHaveCount(3);
  await page.locator('#tree-close').click();
  await expect(page.locator('#tree-of-life')).toBeHidden();
  await expect(page.locator('#application-menu > summary')).toBeFocused();
  await expect(page.locator('#pause-world')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#world-map')).toHaveAttribute('data-zoom', '2');
  await expect(page.locator('#world-map')).toHaveAttribute('data-pinned-id', '18');
  expect(await download(page)).toEqual(fixture);
  expect(errors).toEqual([]);
});

test('unfiltered tree preserves earlier introductions below the chart', async ({ page }) => {
  await upload(page); await openTree(page);
  await expect(page.locator('#tree-search, #tree-filter, #tree-attempt, .tree-toolbar')).toHaveCount(0);
  await expect(page.locator('.tree-species-choice')).toHaveCount(4);
  await page.locator('.tree-archives > summary').click();
  await page.locator('[data-run-id="earlier-run"]').click();
  await expect(page.locator('.tree-species-choice')).toHaveCount(1);
  await expect(page.locator('#tree-species-title')).toHaveText('Antiqua prima');
  await page.locator('.tree-gene[data-gene="photosynthesis"]').click();
  await expect(page.locator('.tree-origin')).toContainText('Antiqua prima, day 0');
  await page.locator('.tree-history-open').click();
  await expect(page.locator('.tree-gene-timeline li')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.tree-overview')).toBeVisible();
  await page.locator('[data-run-id="tree-fixture"]').click();
  await expect(page.locator('.tree-species-choice')).toHaveCount(4);
  await page.locator('#tree-close').focus(); await page.keyboard.press('Escape');
  await expect(page.locator('#tree-of-life')).toBeHidden();
});

test('opening during a pending day pauses and observes its completed state without changing continuation', async ({ page }) => {
  await upload(page);
  await page.locator('#application-menu > summary').click();
  await page.evaluate(() => {
    document.querySelector('#step-world').click();
    document.querySelector('#open-tree-of-life').click();
  });
  await expect(page.locator('#tree-census')).toContainText('Paused on day 151');
  await page.waitForTimeout(350);
  await expect(page.locator('#world-day')).toHaveAttribute('data-day', '151');
  await page.locator('#tree-close').click();
  const saved = await download(page);
  const expected = restoreSave(fixture).model; expected.advanceTo(151);
  expect(saved.life).toEqual(expected.exportState());
  await page.locator('#application-menu > summary').click();
  await page.locator('#play-world').click();
  await expect.poll(async () => Number(await page.locator('#world-day').getAttribute('data-day'))).toBeGreaterThan(151);
  await openTree(page);
  const day = await page.locator('#world-day').getAttribute('data-day');
  await page.waitForTimeout(350);
  await expect(page.locator('#world-day')).toHaveAttribute('data-day', day);
});

test('leaving the tree restores playback and speed from each visit', async ({ page }) => {
  await upload(page);
  for (const [speed, escape] of [['3', false], ['8', true]]) {
    await page.locator('#simulation-speed').fill(speed);
    await page.locator('#play-world').click();
    await openTree(page);
    await expect(page.locator('#pause-world')).toHaveAttribute('aria-pressed', 'true');
    const day = Number(await page.locator('#world-day').getAttribute('data-day'));
    await page.waitForTimeout(350);
    await expect(page.locator('#world-day')).toHaveAttribute('data-day', String(day));
    if (escape) {
      await page.locator('.tree-gene').first().click();
      await page.locator('.tree-history-open').click();
      await page.keyboard.press('Escape');
      await expect(page.locator('.tree-overview')).toBeVisible();
      await expect(page.locator('#pause-world')).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Escape');
    } else await page.locator('#tree-close').click();
    await expect(page.locator('#tree-of-life')).toBeHidden();
    await expect(page.locator('#play-world')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#simulation-speed')).toHaveValue(speed);
    await expect(page.locator('#target-speed')).toHaveText(`${speed}× · ${Number(speed) * 2} days/s`);
    await expect.poll(async () => Number(await page.locator('#world-day').getAttribute('data-day'))).toBeGreaterThan(day);
    await page.locator('#pause-world').click();
  }
  // A later paused visit must not reuse an earlier visit's running state.
  await openTree(page);
  const day = await page.locator('#world-day').getAttribute('data-day');
  await page.locator('#tree-close').click();
  await expect(page.locator('#pause-world')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#simulation-speed')).toHaveValue('8');
  await page.waitForTimeout(350);
  await expect(page.locator('#world-day')).toHaveAttribute('data-day', day);
});

test('empty worlds and older saves show honest history availability and fit narrow phones', async ({ page }, testInfo) => {
  await upload(page, createSave(world, createLifeModel(world).exportState(), view));
  await page.locator('#application-menu > summary').click();
  await page.locator('#open-tree-of-life').click();
  await expect(page.locator('#tree-message')).toContainText('No life has been introduced');
  await expect(page.locator('.tree-species-choice')).toHaveCount(0);
  await page.locator('#tree-close').click();
  const legacy = structuredClone(fixture);
  for (const record of legacy.life.species) delete record.genomeHistory;
  await upload(page, legacy); await openTree(page);
  await page.locator('.tree-gene[data-gene="movement"]').click();
  await expect(page.locator('.tree-history-notice')).toContainText('Earlier gene history was not recorded');
  await page.locator('.tree-history-open').click();
  await expect(page.locator('.tree-gene-timeline li')).toHaveCount(1);
  await page.keyboard.press('Escape');
  if (testInfo.project.name === 'phone') {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.locator('[data-locale="pl"]').click();
    expect(await page.locator('#tree-of-life').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.locator('#tree-close').click();
    await expect(page.locator('#world-map')).toHaveAttribute('data-pinned-id', '18');
  }
});

test('long histories are paginated and returning restores gene selection and scroll', async ({ page }) => {
  const saved = structuredClone(fixture);
  const root = saved.life.species[0];
  root.extinctDay = null;
  for (let index = 0; index < 45; index += 1) {
    root.genome = { ...root.genome, movement: index % 2 ? 2 : 3 };
    root.genomeRevision += 1;
    root.genomeHistory.push({ day: 61 + index, kind: 'adaptation', revision: root.genomeRevision,
      parentRevision: null, genome: { ...root.genome } });
  }
  saved.life.species = [root];
  saved.life.populations = [{ ...saved.life.populations[0], speciesId: root.id }];
  await upload(page, saved); await openTree(page);
  await page.locator('.tree-gene[data-gene="movement"]').click();
  await expect(page.locator('.tree-history-open')).toContainText('48 records');
  await page.locator('#tree-zoom-in').click();
  await page.locator('.tree-chart-scroll').evaluate(node => { node.scrollLeft = 120; });
  await page.locator('.tree-history-open').scrollIntoViewIfNeeded();
  const before = await page.locator('#tree-of-life').evaluate(node => node.scrollTop);
  await page.locator('.tree-history-open').click();
  await expect(page.locator('.tree-gene-timeline li')).toHaveCount(20);
  await expect(page.locator('.tree-pagination')).toContainText('Page 1 of 3');
  await expect(page.locator('[data-history-action="previous"]')).toBeDisabled();
  await page.locator('[data-history-action="next"]').click();
  await expect(page.locator('.tree-gene-timeline li')).toHaveCount(20);
  await expect(page.locator('.tree-gene-timeline li').first()).toContainText('Day 78');
  await page.locator('[data-history-action="next"]').click();
  await expect(page.locator('.tree-gene-timeline li')).toHaveCount(8);
  await expect(page.locator('[data-history-action="next"]')).toBeDisabled();
  await page.locator('[data-locale="pl"]').click();
  await expect(page.locator('.tree-pagination')).toContainText('Strona 3 z 3');
  await page.locator('[data-locale="en"]').click();
  await page.locator('[data-history-action="previous"]').click();
  await expect(page.locator('.tree-gene-timeline li')).toHaveCount(20);
  await page.keyboard.press('Escape');
  await expect(page.locator('.tree-history-open')).toBeFocused();
  expect(await page.locator('#tree-of-life').evaluate(node => node.scrollTop)).toBe(before);
  expect(await page.locator('.tree-chart-scroll').evaluate(node => node.scrollLeft)).toBe(120);
  await expect(page.locator('.tree-gene[data-gene="movement"]')).toHaveAttribute('aria-pressed', 'true');
  // Rapid choices must not apply a late result for the previous gene.
  await page.locator('.tree-gene[data-gene="size"]').evaluate(node => {
    node.click(); document.querySelector('.tree-gene[data-gene="photosynthesis"]').click();
  });
  await expect(page.locator('#tree-traced-gene')).toHaveText('Tracing Photosynthesis');
  await expect(page.locator('[data-gene-species="species-1"] [data-gene-active]')).toHaveCount(1);
  await page.locator('#tree-clear-gene').click();
  await expect(page.locator('[data-gene-species]')).toHaveCount(0);
  await expect(page.locator('.tree-gene[aria-pressed="true"]')).toHaveCount(0);
});

test('each new gene or species starts at its own earliest inherited appearance', async ({ page }) => {
  await upload(page); await openTree(page);
  await page.locator('.tree-species-choice[data-species-id="species-3"]').click();
  await page.locator('.tree-gene[data-gene="movement"]').click();
  await page.locator('#tree-all-species').check();
  await expect(page.locator('[data-gene-species]')).toHaveCount(4);
  await page.locator('.tree-gene[data-gene="animalFeeding"]').click();
  await expect(page.locator('#tree-all-species')).not.toBeChecked();
  await expect(page.locator('[data-gene-species]')).toHaveCount(1);
  await expect(page.locator('[data-gene-origin="species-3"]')).toHaveAttribute('data-day', '50');
  await expect(page.locator('[data-gene-link]')).toHaveCount(0);
  await page.locator('.tree-gene[data-gene="movement"]').click();
  await page.locator('#tree-all-species').check();
  await page.locator('.tree-species-choice[data-species-id="species-4"]').click();
  await expect(page.locator('#tree-all-species')).not.toBeChecked();
  await expect(page.locator('[data-gene-species]')).toHaveCount(2);
  await expect(page.locator('[data-gene-species="species-2"]')).toHaveCount(0);
  await expect(page.locator('[data-gene-species="species-3"]')).toHaveCount(0);
  await expect(page.locator('[data-gene-species="species-1"] [data-gene-active]')).toHaveCount(2);
  await page.locator('#tree-all-species').check();
  await page.locator('[data-locale="pl"]').click();
  await expect(page.locator('#tree-all-species')).toBeChecked();
  await page.locator('.tree-history-open').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#tree-all-species')).toBeChecked();
});
