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
    hexId: hex.id, population: hex.row === 2 ? 3680 : 1200, species: [], display: [
      { role: 'producer', size: [0.05, 0.5, 1][hex.row], mobile: false,
        habitat: hex.col % 2 ? 'water' : 'land', population: hex.row === 2 ? 80 : 600 },
      ...(hex.row === 2 ? [{ role: 'producer', size: 0.05, mobile: false,
        habitat: hex.col % 2 ? 'water' : 'land', population: 3000 }] : []),
      { role: ['grazer', 'predator', 'mixed'][hex.row], size: 0.9, mobile: true,
        habitat: hex.col % 2 ? 'water' : 'land', population: 600 },
    ],
  })) };
  for (const theme of ['light', 'dark']) {
    await page.goto('/');
    await chooseTheme(page, theme);
    const { frames, meanDifference, changedFraction } = await page.evaluate(async ({ world, life }) => {
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
      // Repainting mobile neighbours must match a fresh full frame with the
      // larger canopies. No stale or overlapping plant pixels may accumulate.
      const context = canvas.getContext('2d');
      const cached = context.getImageData(0, 0, canvas.width, canvas.height).data;
      map.setTokens(tokens);
      map.draw(world, { life, motionTime: 1.25 });
      const fresh = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let total = 0, changed = 0;
      for (let index = 0; index < cached.length; index += 4) {
        let difference = Math.abs(cached[index + 3] - fresh[index + 3]);
        for (let channel = 0; channel < 3; channel += 1) {
          difference = Math.max(difference, Math.abs(cached[index + channel] * cached[index + 3]
            - fresh[index + channel] * fresh[index + 3]) / 255);
        }
        total += difference;
        if (difference > 2) changed += 1;
      }
      const plants = { ...life, hexes: life.hexes.map(hex => ({ ...hex,
        display: hex.display.filter(group => group.role === 'producer'),
      })) };
      map.draw(world, { life: plants, motionTime: 0 });
      frames.push(canvas.toDataURL());
      map.draw(world, { life: plants, motionTime: 24 });
      frames.push(canvas.toDataURL());
      map.draw(world, { life, motionTime: 1.25 });
      return { frames, meanDifference: total / (cached.length / 4), changedFraction: changed / (cached.length / 4) };
    }, { world, life });
    expect(frames[0]).not.toBe(frames[1]);
    expect(frames[1]).toBe(frames[2]);
    // Same small antialiasing tolerance as the seasonal repaint check.
    expect(meanDifference).toBeLessThan(0.01);
    expect(changedFraction).toBeLessThan(0.0005);
    expect(frames[3]).toBe(frames[4]);
    await page.screenshot({ path: testInfo.outputPath(`life-silhouettes-${theme}.png`) });
  }
});
