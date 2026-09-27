import { test, expect } from '@playwright/test';
import { lineageFixture } from './fixtures/lineage.js';
import { recordGenome } from '../src/simulation/life/v5/lineage.js';
import { createSave } from '../src/ui/save-state.js';
import { messages } from '../src/ui/messages.js';
import { chooseTheme } from './ui-helpers.js';

const newGenes = ['leafArea', 'shadeTolerance', 'deepRoots', 'waxyCuticle', 'buoyancy',
  'propaguleDispersal', 'camouflage', 'warningSignals', 'ambush', 'cooperativeHunting',
  'herding', 'burrowing', 'filterFeeding', 'dormancy', 'insulation', 'offspringInvestment',
  'mateAttraction', 'clonalGrowth', 'treeClimbing', 'fallenForaging', 'branchPulling', 'longReach'];

test('V5 genes have notebook labels and usable localized tree explanations', async ({ page }, testInfo) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  // This deliberately broad genome is a UI fixture, not a claim of naturally
  // evolved anatomy, an optimal strategy or ecological calibration.
  const { world, state } = lineageFixture();
  const species = state.species.find(record => record.id === 'species-3');
  Object.assign(species.genome, Object.fromEntries(newGenes.map(key => [key, 1])), { sexualReproduction: 1 });
  species.genomeRevision += 1;
  recordGenome(species, state.day, 'adaptation');
  const saved = createSave(world, state, { camera: { zoom: 3, x: 0, y: 0 }, layer: 'terrain', pinnedId: 18, speed: 1 });
  await page.goto('/world.html?restore');
  await page.locator('#restore-file').setInputFiles({ name: 'v5-genes.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
  await page.locator('#restore-dialog [type="submit"]').click();
  await expect(page.locator('#world-map')).toBeFocused();
  for (const locale of ['en', 'pl']) {
    await page.locator(`[data-locale="${locale}"]`).click();
    for (const key of newGenes) {
      const label = messages[locale][`gene${key[0].toUpperCase()}${key.slice(1)}`];
      await expect(page.locator(`.gene-row[data-gene="${key}"] dt`)).toHaveText(label);
    }
    for (const theme of ['light', 'dark']) {
      await chooseTheme(page, theme);
      await page.locator('.gene-row[data-gene="longReach"]').scrollIntoViewIfNeeded();
      expect(await page.locator('.notebook').evaluate(node => node.scrollWidth > node.clientWidth)).toBe(false);
      await page.screenshot({ path: testInfo.outputPath(`v5-notebook-${locale}-${theme}.png`) });
    }
  }
  await page.locator('#application-menu > summary').click();
  await page.locator('#open-tree-of-life').click();
  await page.locator('.tree-species-choice[data-species-id="species-3"]').click();
  for (const locale of ['en', 'pl']) {
    await page.locator(`[data-locale="${locale}"]`).click();
    for (const key of [...newGenes, 'sexualReproduction']) {
      const gene = page.locator(`.tree-gene[data-gene="${key}"]`);
      await gene.click();
      await expect(gene).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.tree-trace > .field-note').first()).toHaveText(messages[locale][`treeGeneHelp_${key}`]);
    }
    for (const theme of ['light', 'dark']) {
      await chooseTheme(page, theme);
      const gene = page.locator('.tree-gene[data-gene="treeClimbing"]');
      await gene.scrollIntoViewIfNeeded(); await gene.focus(); await page.keyboard.press('Enter');
      await expect(gene).toBeFocused();
      await expect(gene).toHaveCSS('outline-style', 'solid');
      expect(await page.locator('#tree-of-life').evaluate(node => node.scrollWidth > node.clientWidth)).toBe(false);
      await page.screenshot({ path: testInfo.outputPath(`v5-genes-${locale}-${theme}.png`) });
    }
  }
  expect(errors).toEqual([]);
});
