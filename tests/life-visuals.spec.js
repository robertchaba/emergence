import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { createGrid } from '../src/simulation/grid.js';
import { chooseTheme } from './ui-helpers.js';

async function routeRenderers(page) {
  for (const name of ['map', 'territory', 'life-marks', 'life-shapes']) {
    await page.route(`**/visual-${name}.js`, route => route.fulfill({
      contentType: 'text/javascript',
      body: readFileSync(new URL(`../src/rendering/${name}.js`, import.meta.url), 'utf8')
        .replaceAll("'./territory.js'", "'./visual-territory.js'")
        .replaceAll("'./life-marks.js'", "'./visual-life-marks.js'")
        .replaceAll("'./life-shapes.js'", "'./visual-life-shapes.js'"),
    }));
  }
}

test('illustrative life stays legible in both themes and viewports', async ({ page }, testInfo) => {
  await routeRenderers(page);
  const world = { width: 4, height: 3, hexes: createGrid(4, 3).map(hex => ({
    ...hex, bedElevation: hex.col % 2 ? -100 : 300, waterType: hex.col % 2 ? 'sea' : 'none',
    temperature: 20, humidity: 0.5, runoff: 0, springDischarge: 0, downstream: null,
  })) };
  // Controlled common observations exercise all visual roles, without claiming
  // these are species that evolved in a run or adding them to the application.
  const life = { runId: 'visual-fixture', revision: 1, hexes: world.hexes.map(hex => ({
    hexId: hex.id, population: hex.row === 2 ? 3920 : 1440, species: [], display: [
      { role: 'producer', size: [0.05, 0.5, 1][hex.row], mobile: false,
        habitat: hex.col % 2 ? 'water' : 'land', population: hex.row === 2 ? 80 : 600 },
      ...(hex.row === 2 ? [{ role: 'producer', size: 0.05, mobile: false,
        habitat: hex.col % 2 ? 'water' : 'land', population: 3000 }] : []),
      { role: ['grazer', 'predator', 'mixed'][hex.row], size: 0.9, mobile: true,
        energySources: ['plantFeeding', 'animalFeeding'],
        habitat: hex.col % 2 ? 'water' : 'land', population: 600 },
      ...['plantFeeding', 'animalFeeding'].map(source => ({ role: 'mixed', size: 0.6,
        mobile: true, energySources: ['photosynthesis', source],
        habitat: hex.col % 2 ? 'water' : 'land', population: 120 })),
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

test('complete habitat and feeding palette remains distinct at close zoom', async ({ page }, testInfo) => {
  await routeRenderers(page);
  for (const theme of ['light', 'dark']) {
    await page.goto('/');
    await chooseTheme(page, theme);
    const result = await page.evaluate(async () => {
      const { drawLifeMarker, lifeMarkerPose, lifeMarkerColour } = await import('/visual-life-marks.js');
      const { MAP_TOKEN_NAMES } = await import('/visual-map.js');
      const styles = getComputedStyle(document.documentElement);
      const palette = Object.fromEntries(MAP_TOKEN_NAMES.map(name => [name.slice(6), styles.getPropertyValue(name)]));
      const sheet = document.createElement('section');
      sheet.style.cssText = `position:fixed;inset:0;z-index:10;display:grid;align-content:start;
        grid-template-columns:repeat(${innerWidth < 600 ? 4 : 8},minmax(0,1fr));
        padding:12px;gap:4px;background:var(--color-ground);color:var(--color-text);
        font:var(--text-compact) var(--font-body);overflow:auto`;
      sheet.setAttribute('aria-label', 'Controlled silhouette and feeding palette fixture');
      document.body.append(sheet);
      const pictures = [];
      function sample(marker, variant, label) {
        const item = document.createElement('div');
        item.style.cssText = 'display:grid;justify-items:center;align-content:start;min-width:0;text-align:center';
        const canvas = document.createElement('canvas');
        canvas.width = 150; canvas.height = 110;
        canvas.style.cssText = 'width:75px;height:55px';
        canvas.setAttribute('aria-label', label);
        const caption = document.createElement('span');
        caption.textContent = label;
        item.append(canvas, caption); sheet.append(item);
        const context = canvas.getContext('2d');
        context.scale(2, 2);
        const slot = { seed: variant, offset: 0 };
        const pose = lifeMarkerPose(marker, slot, 0);
        drawLifeMarker(context, marker, slot, 0, 37.5 - pose.x * 250, 27.5 - pose.y * 250, 250, palette);
        pictures.push(canvas.toDataURL());
      }
      for (const habitat of ['land', 'water']) {
        for (let variant = 0; variant < 6; variant += 1) sample({ role: 'producer',
          size: 1, mobile: false, habitat }, variant, `${habitat} plant ${variant + 1}`);
        for (let variant = 0; variant < 8; variant += 1) sample({ role: 'grazer',
          size: 1, mobile: true, habitat }, variant, `${habitat} animal ${variant + 1}`);
      }
      const colours = [];
      for (const [energySources, label] of [
        [['plantFeeding', 'animalFeeding'], 'Plant + animal'],
        [['photosynthesis', 'plantFeeding'], 'Photo + plant'],
        [['photosynthesis', 'animalFeeding'], 'Photo + animal'],
        [['photosynthesis', 'plantFeeding', 'animalFeeding'], 'All three'],
      ]) {
        const marker = { role: 'mixed', size: 1, mobile: true, habitat: 'water', energySources };
        sample(marker, 0, label);
        colours.push(palette[lifeMarkerColour(marker)].trim());
      }
      return { pictures, colours, overflow: sheet.scrollWidth > sheet.clientWidth };
    });
    expect(new Set(result.pictures.slice(0, 28)).size).toBe(28);
    expect(new Set(result.colours).size).toBe(4);
    expect(result.colours.every(Boolean)).toBe(true);
    expect(result.overflow).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`life-vocabulary-${theme}.png`) });
  }
});
