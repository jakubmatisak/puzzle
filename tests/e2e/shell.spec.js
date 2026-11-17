import { test, expect } from '@playwright/test';

test.describe('page shell', () => {
  test('title contains Zápalkovo and favicon is favicon.svg', async ({ page }) => {
    await page.goto('./');
    await expect(page).toHaveTitle(/Zápalkovo/);
    const href = await page.locator('link[rel="icon"]').getAttribute('href');
    expect(href).toMatch(/favicon\.svg$/);
  });

  test('home shows 3 category cards linking to play', async ({ page }) => {
    await page.goto('./#/');
    await expect(page.locator('#view-home')).toBeVisible();
    await expect(page.locator('#view-help')).toBeHidden();
    await expect(page.locator('#view-play')).toBeHidden();
    const cards = page.locator('#categories .category-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toHaveAttribute('href', '#/play/numbers');
    await expect(cards.first()).toContainText('Vyriešené 0 / 7');
  });

  test('#/help shows the help view only', async ({ page }) => {
    await page.goto('./#/help');
    await expect(page.locator('#view-help')).toBeVisible();
    await expect(page.locator('#view-home')).toBeHidden();
    await expect(page.locator('#view-help article[lang="sk"]')).toBeVisible();
    await expect(page.locator('#view-help article[lang="en"]')).toBeHidden();
  });

  test('#/play/<id> shows the play skeleton', async ({ page }) => {
    await page.goto('./#/play/numbers');
    await expect(page.locator('#view-play')).toBeVisible();
    await expect(page.locator('#board')).toHaveAttribute('role', 'application');
    await expect(page.locator('#message')).toHaveAttribute('aria-live', 'polite');
  });

  test('language toggle switches to English and persists', async ({ page }) => {
    await page.goto('./#/help');
    await expect(page.locator('html')).toHaveAttribute('lang', 'sk');
    await expect(page.locator('nav')).toContainText('Domov');
    await page.locator('button#lang-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('nav')).toContainText('Home');
    await expect(page.locator('#view-help article[lang="en"]')).toBeVisible();
    await expect(page.locator('#view-help article[lang="sk"]')).toBeHidden();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('nav')).toContainText('Home');
  });

  test('print media hides nav and play, shows help', async ({ page }) => {
    await page.goto('./#/help');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('nav')).toBeHidden();
    await expect(page.locator('#view-play')).toBeHidden();
    await expect(page.locator('#view-home')).toBeHidden();
    await expect(page.locator('#view-help')).toBeVisible();
  });

  test('print media shows help even from home', async ({ page }) => {
    await page.goto('./#/');
    await expect(page.locator('#categories .category-card')).toHaveCount(3);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#view-help')).toBeVisible();
    await expect(page.locator('#view-home')).toBeHidden();
  });

  test('phone landscape 812x375: whole board is visible without scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 812, height: 375 });
    await page.goto('./#/play/numbers?puzzle=num-01');
    await expect(page.locator('#board .match').first()).toBeVisible();
    const box = await page.locator('#board').boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(375);
    const ok = await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(ok).toBe(true);
  });

  test('no horizontal scroll at 375x812', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const views = [
      ['#/', '#categories .category-card'],
      ['#/help', '#view-help article[lang="sk"]'],
      ['#/play/numbers', '#board .match'],
      ['#/play/roman?puzzle=rom-02', '#board .match'],
    ];
    for (const [hash, ready] of views) {
      await page.goto(`./${hash}`);
      await expect(page.locator(ready).first()).toBeVisible();
      const ok = await page.evaluate(() =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      expect(ok, hash).toBe(true);
    }
  });
});
