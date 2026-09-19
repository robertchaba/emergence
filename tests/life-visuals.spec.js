import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { createGrid } from '../src/simulation/grid.js';
import { chooseTheme } from './ui-helpers.js';

test('illustrative life stays legible in both themes and viewports', async ({ page }, testInfo) => {
  for (const name of ['map', 'territory', 'life-marks']) {
    await page.route(`**/visual-${name}.js`, route => route.fulfill({
      contentType: 'text/javascript',
      body: readFileSync(new URL(`../src/rendering/${name}.js`, import.meta.url), 'utf8')
        .replaceAll("'./territory.js'", "'./visual-territory.js'")
        .replaceAll("'./life-marks.js'", "'./visual-life-marks.js'"),
    }));
  }
  const world = { width: 4, height: 3, hexes: createGrid(4, 3).map(hex => ({
    ...hex, bedElevation: hex.col % 2 ? -100 : 300, waterType: hex.col % 2 ? 'sea' : 'none',
    temperature: 20, humidity: 0.5, runoff: 0, springDischarge: 0, downstream: null,
  })) };
  // Controlled common observations exercise all visual roles, without claiming
  // these are species that evolved in a run or adding them to the application.
  const life = { runId: 'visual-fixture', revision: 1, hexes: world.hexes.map(hex => ({
    hexId: hex.id, population: 1200, species: [], display: [
      { role: 'producer', size: 0.7, mobile: false, habitat: hex.col % 2 ? 'water' : 'land', population: 600 },
      { role: ['grazer', 'predator', 'mixed'][hex.row], size: 0.9, mobile: true,
        habitat: hex.col % 2 ? 'water' : 'land', population: 600 },
    ],
  })) };
  for (const theme of ['light', 'dark']) {
    await page.goto('/');
    await chooseTheme(page, theme);
    const frames = await page.evaluate(async ({ world, life }) => {
      const { createMapRenderer, MAP_TOKEN_NAMES } = await import('/visual-map.js');
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-label', 'Illustrative population rendering test');
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;background:var(--color-ground);z-index:10';
      document.body.append(canvas);
      const styles = getComputedStyle(document.documentElement);
      const tokens = Object.fromEntries(MAP_TOKEN_NAMES.map(name => [name, styles.getPropertyValue(name)]));
      const map = createMapRenderer(canvas, { tokens });
      map.resize(innerWidth, innerHeight, devicePixelRatio);
      const frames = [];
      for (const motionTime of [1, 1.25, 1.25]) {
        map.draw(world, { life, motionTime });
        frames.push(canvas.toDataURL());
      }
      return frames;
    }, { world, life });
    expect(frames[0]).not.toBe(frames[1]);
    expect(frames[1]).toBe(frames[2]);
    await page.screenshot({ path: testInfo.outputPath(`life-silhouettes-${theme}.png`) });
  }
});
