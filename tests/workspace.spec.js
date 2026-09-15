import { test, expect } from '@playwright/test';

async function openWorld(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const map = page.getByRole('application', { name: 'World map' });
  await expect(map).toBeFocused();
  return map;
}

test('setup settings generate the actual preview and navigation restores Start focus', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const start = page.getByRole('button', { name: 'Start', exact: true });
  await expect(start).toBeEnabled();
  await page.getByLabel('Seed', { exact: true }).fill('field-notes-17');
  await page.getByLabel('World size').selectOption('small');
  await page.getByLabel('Geography', { exact: false }).fill('0');
  await page.getByLabel('Land fraction', { exact: false }).fill('35');
  await expect(start).toBeDisabled();
  await page.getByRole('button', { name: 'Generate world' }).click();
  await expect(start).toBeEnabled();
  await expect(page.locator('#world-summary')).toContainText('384 hexes');
  await expect(page.locator('#world-summary')).toContainText('34.9% non-marine footprint');
  await expect(page.locator('#world-preview')).toHaveAttribute('aria-label', /24 by 16 hexes, seed field-notes-17/);
  await start.click();
  await expect(page.getByRole('region', { name: 'Simulation workspace' })).toBeVisible();
  await expect(page.locator('#world-readout')).toContainText('24 × 16 · seed field-notes-17');
  await page.getByText('Application menu', { exact: true }).click();
  await page.getByRole('button', { name: 'Return to World setup' }).click();
  await expect(start).toBeFocused();
  await expect(page.locator('#workspace')).toBeHidden();
  await expect(page.getByLabel('Seed', { exact: true })).toHaveValue('field-notes-17');
  expect(errors).toEqual([]);
});

test('wheel zoom, drag, pin, keyboard inspection and fit work together', async ({ page }) => {
  const map = await openWorld(page);
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
  const pinned = Number(await map.getAttribute('data-pinned-id'));
  await expect(page.locator('#hex-details h2')).toContainText('Hex');
  await page.keyboard.press('ArrowRight');
  await expect(map).toHaveAttribute('data-pinned-id', String(Math.floor(pinned / 60) * 60 + (pinned % 60 + 1) % 60));
  await page.keyboard.press('Escape');
  await expect(map).toHaveAttribute('data-pinned-id', '');
  await expect(page.locator('#map-status')).toHaveText('No hex pinned.');
  for (let i = 0; i < 15; i += 1) await page.keyboard.press('+');
  await expect(map).toHaveAttribute('data-zoom', '32');
  await page.keyboard.press('-');
  await expect.poll(async () => Number(await map.getAttribute('data-zoom'))).toBeLessThan(32);
  await page.getByText('Application menu', { exact: true }).click();
  await page.getByRole('button', { name: 'Fit world' }).click();
  await expect(map).toBeFocused();
  await expect(map).toHaveAttribute('data-zoom', '1');
  await expect(map).toHaveAttribute('data-pan-x', '0');
  await expect(map).toHaveAttribute('data-pan-y', '0');
});

test('keyboard wraps the seam, stops at poles and navigates the notebook tab', async ({ page }) => {
  const map = await openWorld(page);
  await page.keyboard.press('ArrowRight');
  const first = Number(await map.getAttribute('data-pinned-id'));
  for (let i = 0; i < 60; i += 1) await page.keyboard.press('ArrowRight');
  await expect(map).toHaveAttribute('data-pinned-id', String(first));
  for (let i = 0; i < 45; i += 1) await page.keyboard.press('ArrowUp');
  await expect(map).toHaveAttribute('data-pinned-id', String(first % 60));
  const tab = page.getByRole('tab', { name: 'Hex', exact: true });
  await tab.focus();
  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
    await page.keyboard.press(key);
    await expect(tab).toBeFocused();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }
  await expect(tab).toHaveCSS('outline-style', 'solid');
});

test('season and all map layers update while physical readings remain stable', async ({ page }) => {
  const map = await openWorld(page);
  await page.keyboard.press('ArrowRight');
  const elevationReading = page.locator('.hex-facts > div').filter({ hasText: 'Bed elevation' }).locator('dd');
  const temperatureReading = page.locator('.hex-facts > div').filter({ hasText: 'Temperature' }).locator('dd');
  const elevation = await elevationReading.textContent();
  const temperature = await temperatureReading.textContent();
  for (const [label, value] of [['Elevation', 'elevation'], ['Temperature', 'temperature'], ['Humidity', 'humidity'], ['Regions', 'regions'], ['Terrain', 'terrain']]) {
    await page.getByRole('radio', { name: label, exact: true }).check();
    await expect(map).toHaveAttribute('data-layer', value);
    await expect(page.getByRole('radio', { name: label, exact: true })).toBeChecked();
  }
  await page.getByRole('button', { name: '+90 days', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Day', exact: true })).toHaveValue('90');
  await expect(page.locator('#season-readout')).toContainText('Northern summer solstice');
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
  await session.detach();
});

test('both themes fit desktop and phone workspace layouts', async ({ page }, testInfo) => {
  await openWorld(page);
  for (const theme of ['light', 'dark']) {
    await page.getByLabel(theme === 'light' ? 'Light' : 'Dark', { exact: true }).check();
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
      };
    });
    expect(geometry.overflow).toBe(false);
    expect(geometry.inViewport).toBe(true);
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
