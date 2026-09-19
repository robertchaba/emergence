import { test, expect } from '@playwright/test';

test('theme power dips and afterglow leave controls usable and settle in both directions', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('.theme-transition')).toHaveCount(0);
  // Freeze the actual CSS animations to inspect their intermediate frames.
  await page.evaluate(() => {
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (!node.classList?.contains('theme-transition')) continue;
        for (const animation of node.getAnimations({ subtree: true })) {
          animation.pause(); animation.currentTime = 320;
        }
      }
    }).observe(document.body, { childList: true });
  });
  for (const theme of ['dark', 'light']) {
    await page.locator('.theme-picker > summary').click();
    await page.locator(`.theme-switcher input[value="${theme}"]`).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const effect = page.locator('.theme-transition');
    await expect(effect).toHaveCount(1);
    await expect(effect).toHaveAttribute('aria-hidden', 'true');
    await expect(effect).toHaveCSS('pointer-events', 'none');
    const frames = await effect.evaluate(node => ({
      dip: Number(getComputedStyle(node, '::before').opacity),
      glow: Number(getComputedStyle(node, '::after').opacity),
      animations: node.getAnimations({ subtree: true }).length,
    }));
    expect(frames.dip).toBeCloseTo(0.075);
    expect(frames.glow).toBeGreaterThan(0);
    expect(frames.animations).toBe(2);
    await page.locator('.theme-picker > summary').click();
    await page.screenshot({ path: testInfo.outputPath(`theme-flicker-${theme}.png`), fullPage: true });
    await page.locator('[data-locale="pl"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await expect(effect).toHaveCount(1);
    await effect.evaluate(node => node.getAnimations({ subtree: true }).forEach(animation => animation.finish()));
    await expect(effect).toHaveCount(0);
    // Let the guard against repeated flashes expire before the other direction.
    await page.waitForTimeout(1000);
  }
});

test('rapid theme changes, reduced motion and system preferences settle without stale effects', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.goto('/world.html');
  await page.locator('.theme-picker > summary').click();
  await page.locator('.theme-switcher input[value="dark"]').check();
  await expect(page.locator('.theme-transition')).toHaveCount(1);
  await page.locator('.theme-switcher input[value="light"]').check();
  await expect(page.locator('.theme-transition')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.theme-switcher input[value="dark"]').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.theme-transition')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.theme-transition')).toHaveCount(0);
  await page.locator('.theme-picker > summary').click();
  await page.locator('.theme-switcher input[value="system"]').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.theme-transition')).toHaveCount(0);
});
