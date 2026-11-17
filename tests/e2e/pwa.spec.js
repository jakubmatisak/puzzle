import { test, expect } from '@playwright/test';

test.skip(({ browserName }) => browserName !== 'chromium', 'PWA test len v Chromiu');

/** Zaregistruje SW a počká, kým stránku riadi (po reloade). */
async function installAndControl(page) {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test.describe('PWA', () => {
  test('manifest has the required fields and icons exist', async ({ page, request }) => {
    await page.goto('./');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('./manifest.webmanifest');
    const res = await request.get(new URL(href, page.url()).href);
    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toContain('application/manifest+json');
    const m = await res.json();
    expect(m.name).toBe('Zápalkovo – zápalkové hlavolamy');
    expect(m.short_name).toBe('Zápalkovo');
    expect(m.start_url).toBe('./');
    expect(m.scope).toBe('./');
    expect(m.display).toBe('standalone');
    expect(m.background_color).toBe('#f6ecd9');
    expect(m.theme_color).toBe('#c2410c');
    const sizes = m.icons.map((i) => `${i.sizes}|${i.purpose || 'any'}`);
    expect(sizes).toContain('192x192|any');
    expect(sizes).toContain('512x512|any');
    expect(sizes).toContain('512x512|maskable');
    for (const icon of m.icons) {
      const r = await request.get(new URL(icon.src, page.url()).href);
      expect(r.status(), icon.src).toBe(200);
      expect(r.headers()['content-type']).toContain(icon.type);
    }
  });

  test('service worker registers and controls the page', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installAndControl(page);
    await context.close();
  });

  test('works offline: home and a puzzle board render', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installAndControl(page);
    await context.setOffline(true);
    await page.evaluate(() => { location.hash = '#/play/numbers'; });
    await page.reload();
    await expect(page.locator('#board .match').first()).toBeVisible();
    await page.goto('./#/');
    await expect(page.locator('#categories .category-card')).toHaveCount(3);
    await context.setOffline(false);
    await page.reload();
    await expect(page.locator('#categories .category-card')).toHaveCount(3);
    await context.close();
  });
});

test.describe('offline navigation', () => {
  test('deep link with ?puzzle= and a real query string work offline', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installAndControl(page);
    await context.setOffline(true);
    await page.evaluate(() => { location.hash = '#/play/numbers?puzzle=num-01'; });
    await page.reload();
    await expect(page.locator('#board .match').first()).toBeVisible();
    await page.goto('./?x=1#/');
    await expect(page.locator('#categories .category-card')).toHaveCount(3);
    await context.close();
  });
});

test.describe('install button', () => {
  test('hidden by default, shown on beforeinstallprompt, header does not overflow at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto('./');
    const btn = page.locator('#install-btn');
    await expect(btn).toBeHidden();
    await page.evaluate(() => {
      const ev = new Event('beforeinstallprompt', { cancelable: true });
      ev.prompt = () => Promise.resolve();
      ev.userChoice = Promise.resolve({ outcome: 'dismissed' });
      window.dispatchEvent(ev);
    });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('aria-label', 'Inštalovať');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    const box = await btn.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    await btn.click();
    await expect(btn).toBeHidden();
  });
});
