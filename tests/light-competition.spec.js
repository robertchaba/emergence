import { test, expect } from '@playwright/test';
import { lightCompetitionFixture } from './fixtures/light-competition.js';
import { restoreLifeModel } from '../src/simulation/life/v4/model.js';
import { createSave } from '../src/ui/save-state.js';
import { chooseTheme } from './ui-helpers.js';

// Chromium's headless default hides scrollbar painting in screenshots.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test('local light percentages update across hexes and remain visible in collapsed EN/PL species entries', async ({ page }, testInfo) => {
  const { world, checkpoint, hexIds } = lightCompetitionFixture();
  const observation = restoreLifeModel(world, checkpoint).observe({ detail: 'summary' });
  const saved = createSave(world, checkpoint, {
    camera: { x: 0, y: 0, zoom: 1 }, layer: 'terrain', pinnedId: hexIds[0], speed: 10,
  });
  await page.goto('/world.html?restore');
  await page.locator('#restore-file').setInputFiles({ name: 'light.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(saved)) });
  await page.locator('#restore-dialog [type="submit"]').click();
  const notebook = page.locator('.notebook');
  const labels = page.locator('.species-energy-label[data-energy="photosynthesis"]');
  await expect(labels).toHaveCount(2);
  await expect(page.locator('#species-detail')).toHaveCount(0);
  const species = observation.hexes.find(hex => hex.hexId === hexIds[0]).species;
  for (const theme of ['light', 'dark']) {
    await chooseTheme(page, theme);
    for (const locale of ['en', 'pl']) {
      await page.locator(`[data-locale="${locale}"]`).click();
      const format = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
      for (const row of species.filter(row => row.lightShare !== undefined)) {
        const label = page.locator(`.species-choice[data-species-id="${row.id}"] [data-energy="photosynthesis"]`);
        await expect(label).toHaveText(locale === 'en'
          ? `Photosynthesis · ${format.format(row.lightShare)} of light`
          : `Fotosynteza · ${format.format(row.lightShare)} światła`);
      }
      await expect(page.locator('.species-choice[data-species-id="species-3"]')).not.toContainText('%');
      const width = await notebook.evaluate(node => node.clientWidth);
      const first = page.locator('.species-choice').first();
      await first.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(first).toHaveCSS('outline-style', 'solid');
      await first.press('Enter');
      await expect(page.locator('#species-detail')).toHaveAttribute('data-level', 'genes');
      expect(await notebook.evaluate(node => node.clientWidth)).toBe(width);
      await first.press('Enter');
      await expect(page.locator('#species-detail')).toHaveCount(0);
      await first.scrollIntoViewIfNeeded();
      expect(await notebook.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`light-share-${theme}-${locale}.png`) });
    }
  }
  // Move between actual occupied hexes without replacing the world or census.
  const map = page.locator('#world-map');
  const from = world.hexes[hexIds[0]], to = world.hexes[hexIds[1]];
  for (let i = 0; i < Math.abs(to.row - from.row); i += 1) await map.press(to.row > from.row ? 'ArrowDown' : 'ArrowUp');
  for (let i = 0; i < (to.col - from.col + world.width) % world.width; i += 1) await map.press('ArrowRight');
  await expect(map).toHaveAttribute('data-pinned-id', String(to.id));
  await expect(labels).toHaveText(['Fotosynteza', 'Fotosynteza']);
  if (testInfo.project.name === 'phone') {
    await page.setViewportSize({ width: 320, height: 700 });
    expect(await notebook.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
  for (let i = 0; i < (to.col - from.col + world.width) % world.width; i += 1) await map.press('ArrowLeft');
  for (let i = 0; i < Math.abs(to.row - from.row); i += 1) await map.press(to.row > from.row ? 'ArrowUp' : 'ArrowDown');
  await expect(map).toHaveAttribute('data-pinned-id', String(from.id));
  await expect(labels.first()).toContainText('%');
  await page.locator('#step-world').click();
  await expect(labels.first()).toContainText('%');
  expect(await notebook.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
});
