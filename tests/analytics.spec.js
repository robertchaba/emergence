import { test, expect } from '@playwright/test';

const tagURL = 'https://www.googletagmanager.com/gtag/js?id=G-YWYZTQZ4V3';

// Serve the real build at each browser URL, stubbing all external traffic.
// These checks never load Google's script or send real analytics events.
async function visitDeployment(page, request, address) {
  const deployment = new URL(address);
  const directory = new URL('.', deployment).pathname;
  const externalRequests = [];
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== deployment.origin) {
      externalRequests.push(url.href);
      await route.fulfill({ contentType: 'text/javascript', body: '' });
      return;
    }
    const path = url.pathname.slice(directory.length);
    const response = await request.get(`http://127.0.0.1:4173/${path}`);
    await route.fulfill({ response });
  });
  await page.goto(address);
  await expect(page.locator('[data-locale="pl"]')).toBeEnabled();
  return externalRequests;
}

for (const path of ['', 'index.html?source=test#main', 'world.html']) {
  test(`Google tag loads on the public deployment: ${path || '/'}`, async ({ page, request }) => {
    const externalRequests = await visitDeployment(page, request, `https://robertchaba.github.io/emergence/${path}`);
    await expect.poll(() => externalRequests).toEqual([tagURL]);
    const tag = page.locator(`script[src="${tagURL}"]`);
    await expect(tag).toHaveCount(1);
    await expect(tag).toHaveJSProperty('async', true);
    expect(await page.evaluate(() => ({
      commands: window.dataLayer.map(args => [...args].map(value => value instanceof Date ? 'date' : value)),
      gtag: typeof window.gtag,
    }))).toEqual({ commands: [['js', 'date'], ['config', 'G-YWYZTQZ4V3']], gtag: 'function' });
  });
}

for (const address of [
  'http://127.0.0.1:4173/',
  'http://localhost:4173/emergence/',
  'http://robertchaba.github.io/emergence/',
  'https://robertchaba.github.io:444/emergence/',
  'https://someone.github.io/emergence/',
  'https://robertchaba.github.io.example.com/emergence/',
  'https://robertchaba.github.io/',
  'https://robertchaba.github.io/other/',
  'https://robertchaba.github.io/emergence-preview/',
]) {
  test(`Google tag stays inactive at ${address}`, async ({ page, request }) => {
    const externalRequests = await visitDeployment(page, request, address);
    expect(externalRequests).toEqual([]);
    await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
    expect(await page.evaluate(() => ({ dataLayer: typeof window.dataLayer, gtag: typeof window.gtag })))
      .toEqual({ dataLayer: 'undefined', gtag: 'undefined' });
  });
}
