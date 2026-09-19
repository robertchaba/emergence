import { chooseTheme } from './ui-helpers.js';
import { test, expect } from '@playwright/test';
import { WORLD_SIZES } from '../src/simulation/world.js';

const defaultWidth = WORLD_SIZES.medium.width;

test('Small, Medium and Large generate the advertised dimensions in both languages', async ({ page }) => {
  await page.goto('/world.html');
  await expect(page.locator('#world-size')).toHaveValue('medium');
  const presets = [['small', 24, 16, 384], ['medium', 42, 28, 1176], ['large', 60, 40, 2400]];
  await page.locator('#seed').fill('world-size-check');
  for (const [size, width, height, count] of presets) {
    await page.locator('#world-size').selectOption(size);
    await expect(page.locator('#start-workspace')).toBeEnabled();
    await expect(page.locator('#world-preview')).toHaveAttribute('aria-label', new RegExp(`${width} by ${height} hexes`));
    await expect(page.locator('#world-summary')).toContainText(new Intl.NumberFormat('en').format(count) + ' hexes');
    for (const locale of ['pl', 'en']) {
      await page.locator(`[data-locale="${locale}"]`).click();
      await expect(page.locator('#world-size option:checked')).toContainText(`${width} × ${height}`);
      await expect(page.locator('#world-size')).toHaveValue(size);
    }
  }
});

async function openWorld(page, seed) {
  await page.goto('/world.html');
  if (seed) await page.getByLabel('Seed', { exact: true }).fill(seed);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const map = page.getByRole('application', { name: 'World map' });
  await expect(map).toBeFocused();
  return map;
}

test('setup settings update live and returning to setup randomizes the seed', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/world.html');
  const start = page.getByRole('button', { name: 'Start', exact: true });
  await expect(start).toBeEnabled();
  await page.getByLabel('Seed', { exact: true }).fill('field-notes-17');
  await page.getByLabel('World size').selectOption('small');
  await page.getByLabel('Geography', { exact: false }).fill('0');
  await page.getByLabel('Land fraction', { exact: false }).fill('35');
  await expect(start).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Generate world' })).toHaveCount(0);
  await expect(start).toBeEnabled();
  await expect(page.locator('#world-summary')).toContainText('384 hexes');
  await expect(page.locator('#world-summary')).toContainText('34.9% non-marine footprint');
  await expect(page.locator('#world-preview')).toHaveAttribute('aria-label', /24 by 16 hexes, seed field-notes-17/);
  await start.click();
  await expect(page.getByRole('region', { name: 'Simulation workspace' })).toBeVisible();
  await page.getByLabel('Emergence application menu', { exact: true }).click();
  await page.getByRole('button', { name: 'Return to World setup' }).click();
  await expect(page.getByLabel('Seed', { exact: true })).toBeFocused();
  await expect(page.locator('#workspace')).toBeHidden();
  await expect(page.getByLabel('Seed', { exact: true })).not.toHaveValue('field-notes-17');
  await expect(start).toBeEnabled();
  expect(errors).toEqual([]);
});

test('wheel zoom, drag, pin, keyboard inspection and fit work together', async ({ page }) => {
  const map = await openWorld(page);
  const startLife = page.locator('#start-life');
  await expect(startLife).toBeDisabled();
  const bounds = await map.boundingBox();
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => Number(await map.getAttribute('data-zoom'))).toBeGreaterThan(1.5);
  await page.mouse.down();
  await page.mouse.move(x + 45, y + 25, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => Number(await map.getAttribute('data-pan-x'))).toBeGreaterThan(40);
  await expect(map).toHaveAttribute('data-pinned-id', '');
  await page.mouse.click(x, y);
  await expect(map).toHaveAttribute('data-pinned-id', /\d+/);
  await expect(startLife).toBeEnabled();
  const pinned = Number(await map.getAttribute('data-pinned-id'));
  await expect(page.locator('#hex-details h2')).toContainText('Hex');
  await page.keyboard.press('ArrowRight');
  await expect(map).toHaveAttribute('data-pinned-id', String(Math.floor(pinned / defaultWidth) * defaultWidth + (pinned % defaultWidth + 1) % defaultWidth));
  await page.keyboard.press('Escape');
  await expect(map).toHaveAttribute('data-pinned-id', '');
  await expect(startLife).toBeDisabled();
  await expect(page.locator('#map-status')).toHaveText('No hex pinned.');
  for (let i = 0; i < 15; i += 1) await page.keyboard.press('+');
  await expect(map).toHaveAttribute('data-zoom', '32');
  await page.keyboard.press('-');
  await expect.poll(async () => Number(await map.getAttribute('data-zoom'))).toBeLessThan(32);
  const zoom = await map.getAttribute('data-zoom');
  await page.getByRole('button', { name: 'Center', exact: true }).click();
  await expect(map).toHaveAttribute('data-zoom', zoom);
  await expect(map).toHaveAttribute('data-pan-x', '0');
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await expect(map).toBeFocused();
  await expect(map).toHaveAttribute('data-zoom', '1');
  await expect(map).toHaveAttribute('data-pan-x', '0');
  await expect(map).toHaveAttribute('data-pan-y', '0');
});

test('keyboard wraps the seam, stops at poles and opens the brand menu', async ({ page }) => {
  const map = await openWorld(page);
  await page.keyboard.press('ArrowRight');
  await expect(map).toHaveAttribute('data-pinned-id', /\d+/);
  await expect(page.locator('#start-life')).toBeEnabled();
  const first = Number(await map.getAttribute('data-pinned-id'));
  for (let i = 0; i < defaultWidth; i += 1) await page.keyboard.press('ArrowRight');
  await expect(map).toHaveAttribute('data-pinned-id', String(first));
  for (let i = 0; i < 45; i += 1) await page.keyboard.press('ArrowUp');
  await expect(map).toHaveAttribute('data-pinned-id', String(first % defaultWidth));
  const menu = page.getByLabel('Emergence application menu', { exact: true });
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('radio', { name: 'Terrain', exact: true })).toBeVisible();
  await expect(page.locator('#application-menu #fit-world')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(menu).toHaveCSS('outline-style', 'solid');
});

test('playback updates climate while physical readings and menu layers stay stable', async ({ page }) => {
  await page.clock.install();
  // Weather can cancel seasonal warming at a randomly chosen site. Use a
  // reproducible site with a visible change at the notebook's 0.1 °C precision.
  const map = await openWorld(page, 'playback-climate-v2');
  await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('ArrowUp');
  const elevationReading = page.locator('.hex-facts > div').filter({ hasText: 'Elevation' }).locator('dd');
  const temperatureReading = page.locator('.hex-facts > div').filter({ hasText: 'Temperature' }).locator('dd');
  const elevation = await elevationReading.textContent();
  const temperature = await temperatureReading.textContent();
  await expect(page.locator('.hex-facts dt')).toHaveText(['Terrain', 'Elevation', 'Temperature', 'Moisture']);
  await page.getByLabel('Emergence application menu', { exact: true }).click();
  for (const [label, value] of [['Elevation', 'elevation'], ['Temperature', 'temperature'], ['Moisture', 'humidity'], ['Regions', 'regions'], ['Terrain', 'terrain']]) {
    await page.getByRole('radio', { name: label, exact: true }).check();
    await expect(map).toHaveAttribute('data-layer', value);
    await expect(page.getByRole('radio', { name: label, exact: true })).toBeChecked();
  }
  await page.keyboard.press('Escape');
  await page.getByRole('slider', { name: 'Speed' }).fill('10');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.clock.runFor(2000);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(elevationReading).toHaveText(elevation);
  await expect(temperatureReading).not.toHaveText(temperature);
});

test('touch pinch zooms without creating a pin', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'Touch layout check');
  const map = await openWorld(page);
  const bounds = await map.boundingBox();
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const session = await context.newCDPSession(page);
  const points = (distance) => [
    { x: center.x - distance, y: center.y, id: 0 },
    { x: center.x + distance, y: center.y, id: 1 },
  ];
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(25) });
  for (const distance of [35, 45, 60, 80]) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(distance) });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => Number(await map.getAttribute('data-zoom'))).toBeGreaterThan(2);
  await expect(map).toHaveAttribute('data-pinned-id', '');
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(120) });
  for (const distance of [80, 40, 15, 5]) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(distance) });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(map).toHaveAttribute('data-zoom', '1');
  await expect(map).toHaveAttribute('data-pan-x', '0');
  await expect(map).toHaveAttribute('data-pan-y', '0');
  await session.detach();
});

test('both themes fit desktop and phone workspace layouts', async ({ page }, testInfo) => {
  const map = await openWorld(page);
  await map.press('ArrowRight');
  for (const theme of ['light', 'dark']) {
    await chooseTheme(page, theme);
    const geometry = await page.evaluate(() => {
      const map = document.querySelector('.map-column').getBoundingClientRect();
      const notebook = document.querySelector('.notebook').getBoundingClientRect();
      const workspace = document.querySelector('#workspace').getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        below: notebook.top >= map.bottom - 1,
        beside: notebook.left >= map.right - 1,
        inViewport: workspace.bottom <= innerHeight + 1 && workspace.right <= innerWidth + 1,
        canvasHeight: document.querySelector('#world-map').getBoundingClientRect().height,
        factsVisible: document.querySelector('.hex-facts').getBoundingClientRect().bottom <= notebook.bottom,
      };
    });
    expect(geometry.overflow).toBe(false);
    expect(geometry.inViewport).toBe(true);
    expect(geometry.factsVisible).toBe(true);
    expect(geometry.canvasHeight).toBeGreaterThan(150);
    expect(testInfo.project.name === 'phone' ? geometry.below : geometry.beside).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`workspace-${theme}.png`) });
  }
  if (testInfo.project.name === 'phone') {
    await page.setViewportSize({ width: 320, height: 700 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('workspace-320.png') });
  }
});


test('Create a world opens a separate page and each visit gets a fresh seed', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Create a world' }).click();
  await expect(page).toHaveURL(/world\.html$/);
  await expect(page.getByRole('heading', { level: 1, name: 'World setup' })).toBeVisible();
  await expect(page.locator('.hero')).toHaveCount(0);
  const seed = page.getByLabel('Seed', { exact: true });
  await expect(seed).not.toHaveValue('');
  const original = await seed.inputValue();
  await page.getByRole('button', { name: 'Randomize', exact: true }).click();
  await expect(seed).not.toHaveValue(original);
  const randomized = await seed.inputValue();
  await expect(page.locator('#world-preview')).toHaveAttribute('aria-label', new RegExp(randomized));
  await page.getByRole('link', { name: 'Back to Emergence' }).click();
  await page.getByRole('link', { name: 'Create a world' }).click();
  await expect(seed).not.toHaveValue(randomized);
  const revisited = await seed.inputValue();
  await page.reload();
  await expect(seed).not.toHaveValue(revisited);
});

test('latest settings win, invalid seeds cannot start, and water changes regenerate', async ({ page }) => {
  await page.goto('/world.html');
  const seed = page.getByLabel('Seed', { exact: true });
  const start = page.getByRole('button', { name: 'Start', exact: true });
  await expect(start).toBeEnabled();
  await seed.fill('');
  await expect(start).toBeDisabled();
  await expect(page.locator('#generation-status')).toContainText('Enter a seed');
  await seed.fill('first');
  await seed.fill('last-input-wins');
  await page.getByLabel('Lakes and rivers').fill('100');
  await expect(start).toBeEnabled();
  await expect(page.locator('#world-preview')).toHaveAttribute('aria-label', /seed last-input-wins/);
  await expect(page.locator('#world-preview')).toHaveAttribute('data-water-abundance', '1');
  await page.getByLabel('Lakes and rivers').fill('0');
  await expect(start).toBeEnabled();
  await expect(page.locator('#world-preview')).toHaveAttribute('data-water-abundance', '0');
});

test('preview stays live and the atlas has measured playback from 1× to 10×', async ({ page }) => {
  await page.clock.install();
  await page.goto('/world.html');
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeEnabled();
  // Keep locator work from adding real elapsed time to the preview measurement.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const preview = page.locator('#world-preview');
  const previewDay = () => preview.getAttribute('data-day').then(Number);
  const initial = await previewDay();
  await page.clock.runFor(1000);
  expect(await previewDay() - initial).toBeGreaterThanOrEqual(19);
  expect(await previewDay() - initial).toBeLessThanOrEqual(21);
  await expect(page.getByRole('button', { name: 'Pause preview' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  // Freeze automatic clock ticking so locator actions cannot add time between
  // measurements; only runFor/fastForward advances the playback clock below.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const day = () => page.locator('#world-day').getAttribute('data-day').then(Number);
  const paused = await day();
  expect(paused).toBe(1);
  await expect(page.locator('#playback-state')).toHaveText('Paused');
  await page.clock.runFor(1000);
  expect(await day()).toBe(paused);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.clock.runFor(2100);
  expect(await day() - paused).toBe(4);
  expect(Number(await page.locator('#actual-speed').getAttribute('data-days-per-second'))).toBeGreaterThan(1.8);
  const speed = page.getByRole('slider', { name: 'Speed' });
  await speed.fill('10');
  await expect(page.locator('#target-speed')).toHaveText('10× · 20 days/s');
  await expect(speed).toHaveAttribute('max', '10');
  const fastStart = await day();
  await page.clock.runFor(2100);
  expect(await day() - fastStart).toBeGreaterThanOrEqual(40);
  expect(await day() - fastStart).toBeLessThanOrEqual(42);
  expect(Number(await page.locator('#actual-speed').getAttribute('data-days-per-second'))).toBeGreaterThan(19);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const stopped = await day();
  await page.clock.runFor(1000);
  expect(await day()).toBe(stopped);
  await expect(page.locator('#actual-speed')).toHaveText('0× · 0 days/s');
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.clock.runFor(1100);
  expect(await day()).toBeGreaterThan(stopped);
  const beforeStall = await day();
  await page.clock.fastForward(10000);
  expect(await day() - beforeStall).toBeLessThanOrEqual(5);
  expect(Number(await page.locator('#actual-speed').getAttribute('data-days-per-second'))).toBeLessThan(2);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hiddenDay = await day();
  await page.clock.runFor(3000);
  expect(await day()).toBe(hiddenDay);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(1000);
  expect(await day() - hiddenDay).toBeGreaterThanOrEqual(19);
  expect(await day() - hiddenDay).toBeLessThanOrEqual(20);
});

test('setup frames and controls fit both themes and viewport sizes', async ({ page }, testInfo) => {
  await page.goto('/world.html');
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeEnabled();
  for (const theme of ['light', 'dark']) {
    await chooseTheme(page, theme);
    await page.getByLabel('Seed', { exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#randomize-seed')).toHaveCSS('outline-style', 'solid');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('#world-setup')).toHaveCSS('border-top-width', '0px');
    expect(await page.locator('#world-setup').evaluate((element) => getComputedStyle(element, '::before').content)).toBe('none');
    await page.screenshot({ path: testInfo.outputPath(`setup-${theme}.png`), fullPage: true });
  }
  if (testInfo.project.name === 'phone') {
    await page.setViewportSize({ width: 320, height: 700 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('switching language during playback preserves the world, camera, layer, and clock', async ({ page }) => {
  await page.clock.install();
  const map = await openWorld(page);
  await map.press('ArrowRight');
  await page.locator('#zoom-in').click();
  await page.locator('#application-menu summary').click();
  await page.getByRole('radio', { name: 'Moisture', exact: true }).check();
  await page.keyboard.press('Escape');
  await page.getByRole('slider', { name: 'Speed' }).fill('10');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.clock.runFor(1200);
  const state = () => page.evaluate(() => ({
    seed: document.querySelector('#seed').value,
    day: document.querySelector('#world-day').dataset.day,
    camera: { ...document.querySelector('#world-map').dataset },
    actual: document.querySelector('#actual-speed').dataset.daysPerSecond,
    speed: document.querySelector('#simulation-speed').value,
    playing: document.querySelector('#play-world').getAttribute('aria-pressed'),
  }));
  const before = await state();
  expect(Number(before.actual)).toBeGreaterThan(0);
  await expect(page.locator('#playback-state')).toHaveText('Running');
  await page.getByRole('button', { name: 'PL', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  expect(await state()).toEqual(before);
  await expect(page.locator('#playback-state')).toHaveText('W toku');
  await expect(page.locator('.hex-facts dt')).toHaveText(['Teren', 'Wysokość', 'Temperatura', 'Wilgotność']);
  await expect(page.locator('#actual-speed')).toContainText('dni/s');
  await expect(page.getByRole('slider', { name: 'Prędkość', exact: true })).toHaveValue('10');
  await expect(page.locator('#layer-legend')).toContainText('wskaźnik wilgotności lądu');
  await page.clock.runFor(1100);
  const localizedZoom = new Intl.NumberFormat('pl', { maximumFractionDigits: 1 }).format(Number(before.camera.zoom));
  await expect(page.locator('#zoom-level')).toHaveText(`${localizedZoom}×`);
  expect(Number((await state()).day)).toBeGreaterThan(Number(before.day));
  await page.getByRole('button', { name: 'Pauza', exact: true }).click();
  const paused = await state();
  await expect(page.locator('#playback-state')).toHaveText('Pauza');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  expect(await state()).toEqual(paused);
  await expect(page.locator('#playback-state')).toHaveText('Paused');
  await page.locator('#application-menu summary').click();
  await page.getByRole('button', { name: 'Return to World setup' }).click();
  await expect(page.locator('.page-preferences .language-switcher')).toBeVisible();
});

test('notebook fills desktop height and centered playback with stacked speeds fits both locales', async ({ page }, testInfo) => {
  const map = await openWorld(page);
  await map.press('ArrowRight');
  await page.locator('#simulation-speed').fill('10');
  const widths = testInfo.project.name === 'phone' ? [390, 320] : [1440, 1401, 1281, 1024, 800];
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 400 ? 700 : 1000 });
    for (const locale of ['en', 'pl']) {
      await page.getByRole('button', { name: locale.toUpperCase(), exact: true }).click();
      for (const theme of ['light', 'dark']) {
        await chooseTheme(page, theme);
        const slider = page.locator('#simulation-speed');
        await slider.fill('9');
        const beforeTen = await slider.boundingBox();
        await slider.fill('10');
        expect(await slider.boundingBox()).toEqual(beforeTen);
        const layout = await page.evaluate(() => {
          const box = (selector) => document.querySelector(selector).getBoundingClientRect();
          const notebook = box('.notebook'), header = box('.workspace-header'), footer = box('.workspace-footer');
          const target = box('#target-speed'), actual = box('#actual-speed');
          const selectors = ['.workspace-header', '.workspace-footer', '.speed-readouts', '.playback-controls', '#workspace-preferences'];
          return {
            overflow: selectors.filter((selector) => {
              const el = document.querySelector(selector), b = el.getBoundingClientRect();
              return b.left < -1 || b.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 1;
            }),
            fullHeight: notebook.top === 0 && notebook.bottom === innerHeight,
            separate: header.right <= notebook.left && footer.right <= notebook.left,
            stacked: actual.top >= target.bottom && Math.abs(target.left - actual.left) < 1,
            centered: Math.abs(box('.playback-controls').x + box('.playback-controls').width / 2 - (footer.x + footer.width / 2)) < 1,
            controlsSeparate: innerWidth <= 1439 || (box('.simulation-date').right <= box('.playback-controls').left && box('.playback-controls').right <= box('.zoom-controls').left),
            sliderWidth: box('#simulation-speed').width,
          };
        });
        expect(layout.overflow).toEqual([]);
        expect(layout.stacked).toBe(true);
        expect(layout.centered).toBe(true);
        expect(layout.controlsSeparate).toBe(true);
        expect(layout.sliderWidth).toBeLessThanOrEqual(100);
        if (width > 760) {
          expect(layout.fullHeight).toBe(true);
          expect(layout.separate).toBe(true);
        }
        await page.screenshot({ path: testInfo.outputPath(`atlas-${width}-${locale}-${theme}.png`) });
      }
    }
  }
});
