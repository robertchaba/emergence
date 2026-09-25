import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { lineageFixture } from './fixtures/lineage.js';
import { recordGenome } from '../src/simulation/life/v4/lineage.js';
import { createSave } from '../src/ui/save-state.js';
import { messages } from '../src/ui/messages.js';
import { chooseTheme } from './ui-helpers.js';

const newGenes = ['leafArea', 'shadeTolerance', 'deepRoots', 'waxyCuticle', 'buoyancy',
  'propaguleDispersal', 'camouflage', 'warningSignals', 'ambush', 'cooperativeHunting',
  'herding', 'burrowing', 'filterFeeding', 'dormancy', 'insulation', 'offspringInvestment',
  'mateAttraction', 'clonalGrowth'];

test('V4 morphology vocabulary is distinct and bounded in both themes', async ({ page }, testInfo) => {
  for (const name of ['map', 'territory', 'life-marks', 'life-shapes']) {
    await page.route(`**/v4-visual-${name}.js`, route => route.fulfill({
      contentType: 'text/javascript',
      body: readFileSync(new URL(`../src/rendering/${name}.js`, import.meta.url), 'utf8')
        .replaceAll("'./territory.js'", "'./v4-visual-territory.js'")
        .replaceAll("'./life-marks.js'", "'./v4-visual-life-marks.js'")
        .replaceAll("'./life-shapes.js'", "'./v4-visual-life-shapes.js'"),
    }));
  }
  for (const theme of ['light', 'dark']) {
    await page.goto('/');
    await chooseTheme(page, theme);
    const result = await page.evaluate(async () => {
      const { drawLifeMarker, lifeMarkerPose, lifeMarkerPositions } = await import('/v4-visual-life-marks.js');
      const { MAP_TOKEN_NAMES } = await import('/v4-visual-map.js');
      const styles = getComputedStyle(document.documentElement);
      const palette = Object.fromEntries(MAP_TOKEN_NAMES.map(name => [name.slice(6), styles.getPropertyValue(name)]));
      const sheet = document.createElement('section');
      sheet.style.cssText = `position:fixed;inset:0;z-index:10;display:grid;align-content:start;
        grid-template-columns:repeat(${innerWidth < 600 ? 4 : 6},minmax(0,1fr));padding:12px;gap:8px;
        background:var(--color-ground);color:var(--color-text);font:var(--text-compact) var(--font-body);overflow:auto`;
      sheet.setAttribute('aria-label', 'Controlled V4 morphology fixture');
      document.body.append(sheet);
      const pictures = [];
      function sample(marker, label) {
        const item = document.createElement('div');
        item.style.cssText = 'display:grid;justify-items:center;align-content:start;min-width:0;text-align:center';
        const canvas = document.createElement('canvas');
        canvas.width = 150; canvas.height = 110;
        canvas.style.cssText = 'width:75px;height:55px'; canvas.setAttribute('aria-label', label);
        const caption = document.createElement('span'); caption.textContent = label;
        item.append(canvas, caption); sheet.append(item);
        const context = canvas.getContext('2d'); context.scale(2, 2);
        const slot = lifeMarkerPositions(10)[0], pose = lifeMarkerPose(marker, slot, 0);
        drawLifeMarker(context, marker, slot, 0, 37.5 - pose.x * 250, 27.5 - pose.y * 250, 250, palette);
        pictures.push(canvas.toDataURL());
      }
      for (const [role, forms] of [
        ['producer', ['rosette', 'broadleaf', 'needleleaf', 'floating', 'beaded', 'plume']],
        ['grazer', ['general', 'sail', 'burrower', 'ambush', 'filter']],
      ]) for (const form of forms) for (const pattern of ['plain', 'mottled', 'banded']) {
        sample({ role, size: 1, mobile: role !== 'producer', habitat: ['floating', 'beaded', 'sail', 'filter'].includes(form) ? 'water' : 'land',
          morphology: { form, pattern, social: 'solitary' } }, `${form} · ${pattern}`);
      }
      return { pictures, overflow: sheet.scrollWidth > sheet.clientWidth,
        theme: document.documentElement.dataset.theme };
    });
    expect(new Set(result.pictures).size).toBe(33);
    expect(result.overflow).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`v4-morphology-${theme}.png`) });
  }
});

test('all V4 genes have notebook labels and usable localized tree explanations', async ({ page }, testInfo) => {
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
  await page.locator('#restore-file').setInputFiles({ name: 'v4-genes.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
  await page.locator('#restore-dialog [type="submit"]').click();
  await expect(page.locator('#world-map')).toBeFocused();
  for (const locale of ['en', 'pl']) {
    await page.locator(`[data-locale="${locale}"]`).click();
    for (const key of newGenes) {
      const label = messages[locale][`gene${key[0].toUpperCase()}${key.slice(1)}`];
      await expect(page.locator(`.gene-row[data-gene="${key}"] dt`)).toHaveText(label);
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
      const gene = page.locator('.tree-gene[data-gene="propaguleDispersal"]');
      await gene.scrollIntoViewIfNeeded(); await gene.focus(); await page.keyboard.press('Enter');
      await expect(gene).toBeFocused();
      await expect(gene).toHaveCSS('outline-style', 'solid');
      expect(await page.locator('#tree-of-life').evaluate(node => node.scrollWidth > node.clientWidth)).toBe(false);
      await page.screenshot({ path: testInfo.outputPath(`v4-genes-${locale}-${theme}.png`) });
    }
  }
  expect(errors).toEqual([]);
});
