import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { test, expect } from '@playwright/test';

// A strict static mount catches root-relative requests that Vite's fallback
// could otherwise hide. Cover both the build and direct source publishing.
let server;
let origin;
test.beforeAll(async () => {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp' };
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const prefix = pathname.startsWith('/source/emergence/') ? '/source/emergence/' : '/emergence/';
    const root = resolve(prefix.startsWith('/source/') ? '.' : 'dist');
    const file = resolve(root, pathname.slice(prefix.length) || 'index.html');
    if (!pathname.startsWith(prefix) || !file.startsWith(root + sep)) {
      response.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'text/plain' });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

for (const [kind, prefix] of [['production', '/emergence/'], ['source', '/source/emergence/']]) {
  test(`${kind} pages, assets, licence and both workers work in a subdirectory`, async ({ page, request }) => {
    const errors = [];
    const paths = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().startsWith(origin)) paths.push(new URL(request.url()).pathname); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto(`${origin}${prefix}`);
    await expect(page.locator('[data-locale="pl"]')).toBeEnabled();
    const licence = await request.get(`${origin}${prefix}LICENSE`);
    expect(await licence.text()).toBe(await readFile('LICENSE', 'utf8'));
    await page.getByRole('link', { name: 'Create a world' }).click();
    await expect(page).toHaveURL(`${origin}${prefix}world.html`);
    await expect(page.locator('#start-workspace')).toBeEnabled();
    await page.reload(); // Direct entry must work too.
    await page.getByRole('link', { name: 'Back to Emergence' }).click();
    await expect(page).toHaveURL(`${origin}${prefix}`);
    await page.getByRole('link', { name: 'Create a world' }).click();
    await page.locator('#world-size').selectOption('small');
    await page.locator('#start-workspace').click();
    await expect(page.locator('#step-world')).toBeEnabled();
    await page.locator('#world-map').press('ArrowRight');
    await page.locator('#start-life').click();
    await expect(page.locator('#species-count')).toHaveText('1');
    await page.locator('#pause-world').click();
    await page.locator('#application-menu > summary').click();
    const downloading = page.waitForEvent('download');
    await page.locator('#save-state').click();
    const downloaded = await downloading;
    await page.goto(`${origin}${prefix}`);
    await page.locator('#restore-landing').click();
    await expect(page).toHaveURL(`${origin}${prefix}`);
    await expect(page.locator('#world-setup')).toHaveCount(0);
    await page.locator('#restore-file').setInputFiles(await downloaded.path());
    await page.locator('#restore-dialog [type="submit"]').click();
    await expect(page.locator('#workspace')).toBeVisible();
    await expect(page.locator('#pause-world')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-locale="pl"]').click();
    await expect(page.locator('#playback-state')).toHaveText('Pauza');
    expect(paths.some(path => /generation-worker(?:-.*)?\.js$/.test(path))).toBe(true);
    expect(paths.some(path => /life-worker(?:-.*)?\.js$/.test(path))).toBe(true);
    expect(paths.every(path => path.startsWith(prefix))).toBe(true);
    expect(errors).toEqual([]);
  });
}
