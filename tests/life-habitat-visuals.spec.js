import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { createGrid } from '../src/simulation/grid.js';
import { chooseTheme } from './ui-helpers.js';

async function routeRenderers(page) {
  for (const name of ['map', 'territory', 'life-marks', 'life-shapes']) {
    await page.route(`**/habitat-${name}.js`, route => route.fulfill({
      contentType: 'text/javascript',
      body: readFileSync(new URL(`../src/rendering/${name}.js`, import.meta.url), 'utf8')
        .replaceAll("'./territory.js'", "'./habitat-territory.js'")
        .replaceAll("'./life-marks.js'", "'./habitat-life-marks.js'")
        .replaceAll("'./life-shapes.js'", "'./habitat-life-shapes.js'"),
    }));
  }
}

test('new gene expression silhouettes remain distinct in both themes and viewports', async ({ page }, testInfo) => {
  await routeRenderers(page);
  for (const theme of ['light', 'dark']) {
    await page.goto('/');
    await chooseTheme(page, theme);
    const result = await page.evaluate(async () => {
      const { drawLifeMarker, lifeMarkerPose, lifeMarkerPositions } = await import('/habitat-life-marks.js');
      const { MAP_TOKEN_NAMES } = await import('/habitat-map.js');
      const styles = getComputedStyle(document.documentElement);
      const palette = Object.fromEntries(MAP_TOKEN_NAMES.map(name => [name.slice(6), styles.getPropertyValue(name)]));
      const sheet = document.createElement('section');
      sheet.style.cssText = `position:fixed;inset:0;z-index:10;display:grid;align-content:start;
        grid-template-columns:repeat(${innerWidth < 600 ? 3 : 6},minmax(0,1fr));padding:12px;gap:12px;
        background:var(--color-ground);color:var(--color-text);font:var(--text-compact) var(--font-body);overflow:auto`;
      sheet.setAttribute('aria-label', 'Controlled gene expression rendering fixture');
      document.body.append(sheet);
      const pictures = [];
      for (const form of ['succulent', 'ribbon', 'plated', 'tentacled', 'paddle', 'jet']) {
        for (const pattern of ['plain', 'mottled', 'banded']) {
          const plant = ['succulent', 'ribbon'].includes(form);
          const marker = { role: plant ? 'producer' : 'grazer', mobile: !plant, size: 1,
            habitat: ['succulent', 'plated'].includes(form) ? 'land' : 'water',
            morphology: { form, pattern, social: 'solitary' } };
          const item = document.createElement('div');
          item.style.cssText = 'display:grid;justify-items:center;min-width:0;text-align:center';
          const canvas = document.createElement('canvas');
          canvas.width = 150; canvas.height = 110;
          canvas.style.cssText = 'width:75px;height:55px';
          canvas.setAttribute('aria-label', `${form} · ${pattern}`);
          const caption = document.createElement('span'); caption.textContent = `${form} · ${pattern}`;
          item.append(canvas, caption); sheet.append(item);
          const context = canvas.getContext('2d'); context.scale(2, 2);
          const slot = lifeMarkerPositions(10)[0], pose = lifeMarkerPose(marker, slot, 1);
          drawLifeMarker(context, marker, slot, 1, 37.5 - pose.x * 250, 27.5 - pose.y * 250, 250, palette);
          pictures.push(canvas.toDataURL());
        }
      }
      return { pictures, overflow: sheet.scrollWidth > sheet.clientWidth };
    });
    expect(new Set(result.pictures).size).toBe(18);
    expect(result.overflow).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`new-expression-forms-${theme}.png`) });
  }
});

test('a river hex preserves grounded land motion and swimming water motion together', async ({ page }, testInfo) => {
  await routeRenderers(page);
  const world = { width: 4, height: 3, hexes: createGrid(4, 3).map(hex => ({ ...hex,
    bedElevation: 150, waterType: 'none', temperature: 20, humidity: 0.5,
    runoff: hex.id === 5 ? 1 : 0, springDischarge: 0, downstream: hex.id === 5 ? 6 : null,
  })) };
  for (const theme of ['light', 'dark']) {
    await page.goto('/');
    await chooseTheme(page, theme);
    const result = await page.evaluate(async world => {
      const { createMapRenderer, MAP_TOKEN_NAMES } = await import('/habitat-map.js');
      const { lifeMarkerPositions, LIFE_PLANT_MARKER_LIMIT } = await import('/habitat-life-marks.js');
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:10;background:var(--color-ground)';
      canvas.setAttribute('aria-label', 'Land and water populations sharing one river hex');
      document.body.append(canvas);
      const styles = getComputedStyle(document.documentElement);
      const tokens = Object.fromEntries(MAP_TOKEN_NAMES.map(name => [name, styles.getPropertyValue(name)]));
      const context = canvas.getContext('2d'), positions = [];
      const translate = context.translate.bind(context);
      context.translate = (x, y) => { positions.push({ x, y }); translate(x, y); };
      const map = createMapRenderer(canvas, { tokens }); map.resize(innerWidth, innerHeight, devicePixelRatio);
      const camera = map.fit(world), center = map.cellCenter(world, 5, camera);
      camera.x += innerWidth / 2 - center.x; camera.y += innerHeight / 2 - center.y;
      const life = { runId: 'river-habitats', revision: 1, hexes: [{ hexId: 5, population: 2,
        species: [], display: ['land', 'water'].map(habitat => ({ role: 'grazer', mobile: true,
          size: 0.8, population: 1, habitat })),
      }] };
      const before = JSON.stringify(life);
      const slot = lifeMarkerPositions(5)[LIFE_PLANT_MARKER_LIMIT];
      const duration = (0.85 + 2.2 * 0.8 ** 2) * 3.5;
      const step = Math.ceil(slot.offset / 3.5);
      const time = part => (step + part - slot.offset / 3.5) * duration;
      map.draw(world, { life, camera, motionTime: time(0.03) });
      const first = positions.splice(0);
      map.draw(world, { life, camera, motionTime: time(0.19) });
      const second = positions.splice(0);
      const frame = canvas.toDataURL();
      map.draw(world, { life, camera, motionTime: time(0.19) });
      const paused = canvas.toDataURL() === frame;
      const occupantsStayInHex = [...first, ...second].every(point => map.hitTest(world, camera, point.x, point.y) === 5);
      return { first, second, paused, occupantsStayInHex, immutable: JSON.stringify(life) === before };
    }, world);
    expect(result.first).toHaveLength(2);
    expect(result.second).toHaveLength(2);
    expect(result.first[0]).toEqual(result.second[0]);
    expect(result.first[1]).not.toEqual(result.second[1]);
    expect(result.paused).toBe(true);
    expect(result.occupantsStayInHex).toBe(true);
    expect(result.immutable).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`river-habitat-motion-${theme}.png`) });
  }
});
