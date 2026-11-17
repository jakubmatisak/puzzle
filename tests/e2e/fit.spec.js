import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { normalizePuzzles } from '../../js/core/puzzles.js';
import { solutionPlan } from '../../js/core/puzzle-state.js';

// Herná obrazovka sa musí zmestiť do jedného okna: dokument sa neposúva pri žiadnej úlohe
// ani pri žiadnej z bežných veľkostí okna (telefón na výšku aj na šírku, tablet, počítač).
const DATA = normalizePuzzles(JSON.parse(readFileSync(new URL('../../data/puzzles.json', import.meta.url), 'utf8')));
const VIEWPORTS = [
  [375, 667], [375, 812], [390, 844], [360, 640], [320, 568], [812, 375], [667, 375],
  [768, 1024], [1024, 768], [1280, 720], [1366, 768], [1440, 900], [1920, 1080],
];
const STATE_VIEWPORTS = [[375, 667], [812, 375], [1366, 768]];

/** Kontext prehliadača pre danú veľkosť (pod 600 px ako telefón s dotykom). */
function contextFor(width, height) {
  const phone = width < 600;
  return { viewport: { width, height }, isMobile: phone, hasTouch: phone };
}

/** Otvorí úlohu: prvýkrát cez goto, potom len zmenou hashu (rýchlejšie). */
async function openPuzzle(page, puzzle, first) {
  const hash = `#/play/${puzzle.category}?puzzle=${puzzle.id}`;
  if (first) await page.goto(`./${hash}`);
  else await page.evaluate((h) => { window.location.hash = h; }, hash);
  await page.waitForFunction((id) => window.__zapalkovoGame?.getCurrent()?.id === id, puzzle.id);
  await page.locator('#board .match').first().waitFor();
}

/** Rozmery dokumentu, okna a obdĺžniky viditeľných prvkov hry. */
function measure(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      if (!el || el.getClientRects().length === 0) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, bottom: r.bottom, right: r.right, height: r.height };
    };
    const visible = [...document.querySelectorAll(
      '#view-play .play-head, #controls > .btn, #message, #rotate-tip, #rec-indicator, #recording, .success-card',
    )].map((el) => ({ name: el.id || el.className, r: rect(el) })).filter((x) => x.r && x.r.height > 0);
    return {
      sh: document.documentElement.scrollHeight,
      sw: document.documentElement.scrollWidth,
      ih: window.innerHeight,
      iw: window.innerWidth,
      wrap: rect(document.querySelector('.board-wrap')),
      visible,
    };
  });
}

/** Overí, že sa dokument neposúva a všetko potrebné je celé v okne. */
async function expectFits(page, label) {
  const m = await measure(page);
  expect(m.sh, `${label}: vertical scroll`).toBeLessThanOrEqual(m.ih);
  expect(m.sw, `${label}: horizontal scroll`).toBeLessThanOrEqual(m.iw);
  const inside = (r) => r.top >= -0.5 && r.left >= -0.5 && r.bottom <= m.ih + 0.5 && r.right <= m.iw + 0.5;
  expect(inside(m.wrap), `${label}: board-wrap inside the viewport`).toBe(true);
  for (const { name, r } of m.visible) expect(inside(r), `${label}: ${name} inside the viewport`).toBe(true);
  return m;
}

test.describe('play view fits one viewport', () => {
  test.describe.configure({ mode: 'parallel' });
  test.beforeEach(({ page: _page }, info) => {
    test.skip(info.project.name !== 'chromium', 'layout matrix runs in chromium');
  });

  for (const [width, height] of VIEWPORTS) {
    test.describe(`${width}x${height}`, () => {
      test.use(contextFor(width, height));

      test('every puzzle fits without scrolling', async ({ page }) => {
        const portraitPhone = width < 600 && height > width;
        for (const [i, puzzle] of DATA.puzzles.entries()) {
          await openPuzzle(page, puzzle, i === 0);
          const m = await expectFits(page, `${width}x${height} ${puzzle.id}`);
          if (portraitPhone) {
            expect(m.wrap.height, `${puzzle.id}: board height`).toBeGreaterThanOrEqual(0.35 * height);
          }
        }
      });
    });
  }

  for (const [width, height] of STATE_VIEWPORTS) {
    test.describe(`${width}x${height} states`, () => {
      test.use(contextFor(width, height));
      const tag = `${width}x${height}`;

      test('hint and solution (with the next-solution button)', async ({ page }) => {
        await openPuzzle(page, DATA.puzzles.find((p) => p.id === 'num-02'), true);
        await page.locator('#controls [data-action="hint"]').click();
        await expect(page.locator('#message')).not.toBeEmpty();
        await expectFits(page, `${tag} hint`);
        await page.locator('#controls [data-action="solution"]').click();
        await expect(page.locator('#controls [data-action="next-solution"]')).toBeVisible();
        await expect(page.locator('#message')).toContainText('Toto je riešenie');
        await expectFits(page, `${tag} solution`);
      });

      test('success panel', async ({ page }) => {
        const puzzle = DATA.puzzles.find((p) => p.id === 'log-04');
        await openPuzzle(page, puzzle, true);
        await page.evaluate((plan) => window.__zapalkovoBoard.animatePlan(plan, 0), solutionPlan(puzzle, 0));
        await expect(page.locator('#success')).toBeVisible();
        await expectFits(page, `${tag} success`);
      });

      test('recording indicator and result panel', async ({ page }) => {
        await openPuzzle(page, DATA.puzzles.find((p) => p.id === 'log-04'), true);
        const record = page.locator('#controls [data-action="record"]');
        await record.click();
        await expect(page.locator('#rec-indicator')).toBeVisible();
        await expectFits(page, `${tag} recording`);
        await page.waitForTimeout(600);
        await record.click();
        await expect(page.locator('#recording video')).toHaveCount(1);
        await expect(page.locator('#rec-download')).toBeVisible();
        await expectFits(page, `${tag} recording result`);
      });
    });
  }
});
