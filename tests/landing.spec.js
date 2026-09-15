import { test, expect } from '@playwright/test';

async function expectTheme(page, theme) {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
  const expectedGround = await page.locator('html').evaluate((root) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--color-ground)';
    root.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  await expect(page.locator('html')).toHaveCSS('background-color', expectedGround);
  const logo = page.locator(`.logo-${theme}`);
  await expect(logo).toBeVisible();
  await expect(logo).toHaveJSProperty('complete', true);
  expect(await logo.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  return expectedGround;
}

async function expectLayout(page) {
  const layout = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const elements = [...document.querySelectorAll('header, h1, .hero-copy, .specimen, .principles article, footer')];
    const outside = elements.filter((element) => {
      const box = element.getBoundingClientRect();
      return box.left < -1 || box.right > width + 1;
    }).map((element) => element.className || element.tagName);
    const copy = document.querySelector('.hero-copy').getBoundingClientRect();
    const artwork = document.querySelector('.specimen').getBoundingClientRect();
    return {
      outside,
      overflow: document.documentElement.scrollWidth > width,
      separated: artwork.left >= copy.right || artwork.top >= copy.bottom,
      titleFits: document.querySelector('h1').scrollWidth <= document.querySelector('h1').clientWidth,
    };
  });
  expect(layout).toEqual({ outside: [], overflow: false, separated: true, titleFits: true });
}

test('landing loads, both themes render, and the layout fits', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const response = await page.goto('/');
  expect(response.ok()).toBeTruthy();
  await expect(page).toHaveTitle('Emergence — an evolution sandbox');
  await expect(page.getByRole('heading', { level: 1, name: 'Emergence', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start a world' })).toBeDisabled();

  const backgrounds = [];
  for (const theme of ['light', 'dark']) {
    await page.getByLabel(theme === 'light' ? 'Light' : 'Dark', { exact: true }).check();
    backgrounds.push(await expectTheme(page, theme));
    await expectLayout(page);
  }
  expect(backgrounds[0]).not.toBe(backgrounds[1]);
  expect(errors).toEqual([]);
});

test('system changes apply until an explicit choice; reset restores system behavior', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.getByLabel('System', { exact: true })).toBeChecked();
  await expectTheme(page, 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expectTheme(page, 'light');

  await page.getByLabel('Dark', { exact: true }).check();
  await page.reload();
  await expectTheme(page, 'dark');
  await expect(page.getByLabel('Dark', { exact: true })).toBeChecked();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expectTheme(page, 'dark');

  await page.getByLabel('Light', { exact: true }).check();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await expectTheme(page, 'light');

  await page.getByLabel('System', { exact: true }).check();
  await expectTheme(page, 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expectTheme(page, 'light');
  await page.reload();
  await expect(page.getByLabel('System', { exact: true })).toBeChecked();
  await expectTheme(page, 'light');
});

test('theme controls work when storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Storage unavailable', 'SecurityError'); },
    });
  });
  await page.goto('/');
  await page.getByLabel('Dark', { exact: true }).check();
  await expectTheme(page, 'dark');
  await page.getByLabel('Light', { exact: true }).check();
  await expectTheme(page, 'light');
});

test('keyboard users can choose a theme and see focus', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('System', { exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Light', { exact: true })).toBeFocused();
  await expectTheme(page, 'light');
  await expect(page.locator('input[value="light"] + span')).toHaveCSS('outline-style', 'solid');
});

test('content and system themes work without JavaScript', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: testInfo.project.use.viewport,
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  await page.goto(testInfo.project.use.baseURL);
  await expect(page.getByRole('heading', { level: 1, name: 'Emergence', exact: true })).toBeVisible();
  await expect(page.locator('.theme-switcher')).toBeHidden();
  await expect(page.locator('.logo-dark')).toBeVisible();
  const dark = await page.locator('html').evaluate((root) => getComputedStyle(root).backgroundColor);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('.logo-light')).toBeVisible();
  const light = await page.locator('html').evaluate((root) => getComputedStyle(root).backgroundColor);
  expect(light).not.toBe(dark);
  await context.close();
});
