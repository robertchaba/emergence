import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { generateWorld, setDay } from '../src/simulation/world.js';
import { chooseTheme } from './ui-helpers.js';

test('partial seasonal repaint matches a fresh frame in both themes', async ({ page }) => {
  await page.route('**/test-renderer.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: readFileSync(new URL('../src/rendering/map.js', import.meta.url), 'utf8'),
  }));
  await page.route('**/territory.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: readFileSync(new URL('../src/rendering/territory.js', import.meta.url), 'utf8'),
  }));
  await page.route('**/life-marks.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: readFileSync(new URL('../src/rendering/life-marks.js', import.meta.url), 'utf8'),
  }));
  await page.route('**/life-shapes.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: readFileSync(new URL('../src/rendering/life-shapes.js', import.meta.url), 'utf8'),
  }));
  await page.goto('/');
  const geography = generateWorld({ seed: 'seasonal-rendering', size: 'small', waterAbundance: 1 });
  const snapshots = [0, 1, 45, 90, 180, 270, 359, 360].map(day => setDay(geography, day));
  for (const theme of ['light', 'dark']) {
    await chooseTheme(page, theme);
    const differences = await page.evaluate(async ({ geography, snapshots }) => {
      const { createMapRenderer, MAP_TOKEN_NAMES } = await import('/test-renderer.js');
      const styles = getComputedStyle(document.documentElement);
      const tokens = Object.fromEntries(MAP_TOKEN_NAMES.map(name => [name, styles.getPropertyValue(name)]));
      const cached = document.createElement('canvas');
      const fresh = document.createElement('canvas');
      const a = createMapRenderer(cached, { tokens });
      const b = createMapRenderer(fresh, { tokens });
      const failures = [];
      for (const [width, height, dpr] of [[600, 360, 1], [320, 460, 1.5]]) {
        a.resize(width, height, dpr);
        b.resize(width, height, dpr);
        for (const camera of [a.fit(geography), a.cover(geography), { ...a.fit(geography), x: width * 0.55 }, { zoom: 3, x: 71, y: -45 }]) {
          for (const snapshot of snapshots) {
            const options = { geography, camera, pinnedId: geography.hexes.find(hex => hex.runoff > 0).id,
              motionTime: snapshot.day * 0.4,
              selectedSpeciesId: 'species-1', selectedVariantHexIds: snapshot.day < 180 ? [100] : [101],
              life: { runId: 'contour-check', revision: snapshot.day, hexes: [96, 119, 120, 143, 100, 101, 124].map(hexId => ({
                hexId, population: 100, species: [{ id: 'species-1', population: 100 }],
                display: [{ role: 'producer', size: 0.1, habitat: 'land', population: 100 },
                  { role: 'grazer', size: 0.6, habitat: 'land', population: 100, mobile: true }],
              })) },
            };
            a.draw(snapshot, options);
            b.setTokens(tokens); // The reference always repaints the entire frame.
            b.draw(snapshot, options);
            const actual = cached.getContext('2d').getImageData(0, 0, cached.width, cached.height).data;
            const expected = fresh.getContext('2d').getImageData(0, 0, fresh.width, fresh.height).data;
            // Clipping can change a few antialiased edge samples. Compare
            // premultiplied colour so invisible RGB at alpha zero is irrelevant.
            // Wrapped cuts exercise additional subpixel alignments; allow 0.02
            // channel levels on average while retaining the sparse-pixel bound.
            let total = 0, changed = 0;
            for (let i = 0; i < actual.length; i += 4) {
              let difference = Math.abs(actual[i + 3] - expected[i + 3]);
              for (let channel = 0; channel < 3; channel++) {
                difference = Math.max(difference, Math.abs(actual[i + channel] * actual[i + 3]
                  - expected[i + channel] * expected[i + 3]) / 255);
              }
              total += difference;
              if (difference > 2) changed++;
            }
            const pixels = actual.length / 4;
            if (total / pixels > 0.02 || changed / pixels > 0.0005) {
              failures.push({ width, dpr, zoom: camera.zoom, day: snapshot.day,
                meanDifference: total / pixels, changedFraction: changed / pixels });
            }
          }
        }
      }
      return failures;
    }, { geography, snapshots });
    expect(differences, theme).toEqual([]);
  }
});

test('preview and atlas start covering the frame and zooming out stops before duplicate hexes', async ({ page }) => {
  await page.goto('/world.html');
  await expect(page.locator('#start-workspace')).toBeEnabled();
  await expect.poll(async () => Number(await page.locator('#world-preview').getAttribute('data-zoom'))).toBeGreaterThan(1);
  await page.locator('#start-workspace').click();
  const map = page.locator('#world-map');
  await expect.poll(async () => Number(await map.getAttribute('data-zoom'))).toBeGreaterThan(1);
  const bounds = await map.boundingBox();
  await page.mouse.move(bounds.x + 30, bounds.y + 30);
  await page.mouse.wheel(0, 4000);
  await expect.poll(async () => Number(await map.getAttribute('data-zoom'))).toBeGreaterThan(1);
  await expect(page.locator('#zoom-out')).toBeDisabled();
});

test('generation stays off the UI thread and superseded worker requests cannot win', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.generationRequests = [];
    window.Worker = class extends NativeWorker {
      postMessage(settings) {
        const record = { settings, terminated: false };
        this.record = record;
        window.generationRequests.push(record);
        this.addEventListener('message', event => { record.result = event.data.world; });
        super.postMessage(settings);
      }
      terminate() {
        if (this.record) this.record.terminated = true;
        super.terminate();
      }
    };
  });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/generation-worker-*.js', async route => {
    await gate;
    await route.continue().catch(() => {}); // An obsolete worker may already be terminated.
  });
  try {
    await page.goto('/world.html');
    await expect.poll(() => page.evaluate(() => window.generationRequests.length)).toBe(1);
    await expect(page.locator('#start-workspace')).toBeDisabled();
    await page.locator('#seed').fill('worker-latest-settings');
    await page.getByLabel('World size').selectOption('small');
    await chooseTheme(page, 'dark'); // Inputs and theme remain usable during generation.
    await expect.poll(() => page.evaluate(() => window.generationRequests.at(-1).settings.seed)).toBe('worker-latest-settings');
    expect(await page.evaluate(() => window.generationRequests[0].terminated)).toBe(true);
  } finally {
    release();
  }
  await expect(page.locator('#start-workspace')).toBeEnabled();
  const latest = await page.evaluate(() => window.generationRequests.at(-1));
  expect(latest.result).toEqual(generateWorld(latest.settings));
  await expect(page.locator('#world-preview')).toHaveAttribute('aria-label', /seed worker-latest-settings/);
});
