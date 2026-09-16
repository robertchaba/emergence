import { test, expect } from '@playwright/test';
import { chooseTheme } from './ui-helpers.js';

test('regeneration conceals the swap inside a stable preview frame in both themes', async ({ page }, testInfo) => {
  await page.goto('/world.html');
  const start = page.locator('#start-workspace');
  const surface = page.locator('.preview-surface');
  const preview = page.locator('#world-preview');
  await expect(start).toBeEnabled();
  for (const theme of ['light', 'dark']) {
    await chooseTheme(page, theme);
    await expect(preview).toHaveCSS('opacity', '1');
    const before = await surface.boundingBox();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const hold = async route => { await gate; await route.continue().catch(() => {}); };
    await page.route('**/generation-worker-*.js', hold);
    try {
      await page.locator('#world-size').selectOption(theme === 'light' ? 'large' : 'small');
      await page.locator('#seed').fill(`transition-${theme}`);
      await expect(start).toBeDisabled();
      await expect(surface).toHaveAttribute('aria-busy', 'true');
      await expect(preview).toHaveCSS('opacity', '0');
      expect(await surface.boundingBox()).toEqual(before);
      await page.screenshot({ path: testInfo.outputPath(`regenerating-${theme}.png`), fullPage: true });
    } finally {
      release();
    }
    await expect(start).toBeEnabled();
    await expect(surface).not.toHaveAttribute('aria-busy');
    await expect(preview).toHaveAttribute('aria-label', new RegExp(`seed transition-${theme}`));
    await expect(preview).toHaveCSS('opacity', '1');
    expect(await surface.boundingBox()).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`regenerated-${theme}.png`), fullPage: true });
    await page.unroute('**/generation-worker-*.js', hold);
  }
});

test('reduced motion, invalid input and worker failure leave no lingering effect', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/world.html');
  const start = page.locator('#start-workspace');
  const surface = page.locator('.preview-surface');
  const preview = page.locator('#world-preview');
  await expect(start).toBeEnabled();
  await page.locator('#seed').fill('');
  await expect(page.locator('#generation-status')).toContainText('Enter a seed');
  await expect(surface).not.toHaveAttribute('aria-busy');
  await expect(preview).toHaveCSS('opacity', '1');
  await expect(start).toBeDisabled();
  await page.route('**/generation-worker-*.js', route => route.abort());
  await page.locator('#seed').fill('failed-transition');
  expect(await surface.evaluate(element => ({
    animation: getComputedStyle(element, '::after').animationName,
    transition: getComputedStyle(element.querySelector('canvas')).transitionDuration,
    filter: getComputedStyle(element.querySelector('canvas')).filter,
  }))).toEqual({ animation: 'none', transition: '0s', filter: 'none' });
  await expect(page.locator('#generation-status')).toContainText('World generation failed');
  await expect(surface).not.toHaveAttribute('aria-busy');
  await expect(start).toBeDisabled();
  await page.unroute('**/generation-worker-*.js');
  await page.locator('#seed').fill('recovered-transition');
  await expect(start).toBeEnabled();
  await expect(preview).toHaveCSS('opacity', '1');
  await expect(surface).not.toHaveAttribute('aria-busy');
});
