import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { chooseTheme } from './ui-helpers.js';

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
