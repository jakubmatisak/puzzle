import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const PUZZLE = 'num-01';
const FRAME_PATH = process.env.ZAPALKOVO_FRAME; // voliteľné: kam uložiť snímok videa

/** Otvorí úlohu a počká na hru. */
async function openPuzzle(page) {
  await page.goto(`./#/play/numbers?puzzle=${PUZZLE}`);
  await page.waitForFunction((id) => window.__zapalkovoGame?.getCurrent()?.id === id, PUZZLE);
}

/** Jeden skutočný ťah myšou: prvá zápalka z dosky do odkladacej plochy. */
async function dragOneMatch(page) {
  const box = await page.locator('#board .match').first().boundingBox();
  const board = await page.locator('#board').boundingBox();
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(board.x + board.width / 2, board.y + board.height - 30, { steps: 25 });
  await page.waitForTimeout(150);
  return () => page.mouse.up();
}

test.describe('video recording', () => {
  test.beforeEach(({ page: _page }, info) => {
    test.skip(info.project.name !== 'chromium', 'recording is verified in chromium');
  });

  test('record, drag, stop gives a downloadable webm', async ({ page }) => {
    if (FRAME_PATH) {
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.captureStream;
        HTMLCanvasElement.prototype.captureStream = function capture(...args) {
          window.__recCanvas = this;
          return original.apply(this, args);
        };
      });
    }
    await openPuzzle(page);
    const record = page.locator('#controls [data-action="record"]');
    await expect(record).toBeEnabled();
    await record.click();
    await expect(record).toContainText('Zastaviť');
    await expect(page.locator('#rec-indicator')).toBeVisible();
    await expect(page.locator('#rec-indicator')).toContainText(/● REC 00:0\d/);
    const release = await dragOneMatch(page);
    if (FRAME_PATH) {
      const dataUrl = await page.evaluate(() => window.__recCanvas.toDataURL('image/png'));
      writeFileSync(FRAME_PATH, Buffer.from(dataUrl.split(',')[1], 'base64'));
    }
    await release();
    await page.waitForTimeout(600);
    await record.click();
    await expect(record).toContainText('Nahrávať');
    await expect(page.locator('#rec-indicator')).toBeHidden();

    const link = page.locator('#rec-download');
    await expect(page.locator('#recording')).toBeVisible();
    await expect(page.locator('#recording video')).toHaveCount(1);
    await expect(link).toBeFocused();
    await expect(record).not.toHaveAttribute('aria-pressed', /.*/);
    await expect(link).toHaveAttribute('href', /^blob:/);
    await expect(link).toHaveAttribute('download', `zapalkovo-${PUZZLE}.webm`);
    const href = await link.getAttribute('href');
    const size = await page.evaluate(async (url) => (await (await fetch(url)).blob()).size, href);
    expect(size).toBeGreaterThan(0);

    await page.locator('#rec-close').click();
    await expect(page.locator('#recording')).toBeHidden();
  });

  test('reset and solution do not stop a running recording', async ({ page }) => {
    await openPuzzle(page);
    const record = page.locator('#controls [data-action="record"]');
    await record.click();
    const release1 = await dragOneMatch(page);
    await release1();
    await page.locator('#controls [data-action="reset"]').click();
    await expect(page.locator('#rec-indicator')).toBeVisible();
    const release2 = await dragOneMatch(page);
    await release2();
    await page.locator('#controls [data-action="solution"]').click();
    await expect(page.locator('#rec-indicator')).toBeVisible();
    await page.locator('#controls [data-action="reset"]').click();
    await page.waitForTimeout(400);
    await record.click();
    const link = page.locator('#rec-download');
    await expect(link).toHaveAttribute('href', /^blob:/);
    const href = await link.getAttribute('href');
    const size = await page.evaluate(async (url) => (await (await fetch(url)).blob()).size, href);
    expect(size).toBeGreaterThan(0);
  });

  test('double click on Stop does not throw', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openPuzzle(page);
    const record = page.locator('#controls [data-action="record"]');
    await record.click();
    await page.waitForTimeout(300);
    await record.dblclick();
    await expect(page.locator('#recording')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('leaving the play view stops the recording and keeps the result', async ({ page }) => {
    await openPuzzle(page);
    await page.locator('#controls [data-action="record"]').click();
    await page.waitForTimeout(500);
    await page.goto('./#/help');
    await page.goto(`./#/play/numbers?puzzle=${PUZZLE}`);
    await expect(page.locator('#rec-indicator')).toBeHidden();
    await expect(page.locator('#recording')).toBeVisible();
  });

  test('without MediaRecorder the button is disabled with a note', async ({ page }) => {
    await page.addInitScript(() => {
      delete window.MediaRecorder;
    });
    await openPuzzle(page);
    const record = page.locator('#controls [data-action="record"]');
    await expect(record).toBeDisabled();
    await expect(record).toHaveAttribute('title', /nepodporuje/);
    await expect(page.locator('#record-note')).toBeVisible();
    await expect(page.locator('#record-note')).toContainText('nepodporuje nahrávanie videa');
  });
});
