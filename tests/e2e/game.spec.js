import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { normalizePuzzles } from '../../js/core/puzzles.js';
import { createState, solutionPlan } from '../../js/core/puzzle-state.js';
import { angleDiff } from '../../js/core/geometry.js';

// Úlohy načítané v Node rovnako ako v prehliadači (plán riešenia, sloty, odkladacia plocha).
const DATA = normalizePuzzles(JSON.parse(readFileSync(new URL('../../data/puzzles.json', import.meta.url), 'utf8')));
const byId = (id) => DATA.puzzles.find((p) => p.id === id);
const FIREFOX_SAMPLES = ['num-02', 'rom-02', 'log-06'];
const GRAB = 20; // zápalku chytáme 20 jednotiek od stredu (stred „+“ a „X“ je spoločný dvom zápalkám)

/** Bod v SVG súradniciach prepočítaný na obrazovku. */
async function svgToScreen(page, p) {
  return page.evaluate(([x, y]) => {
    const svg = document.getElementById('board');
    const q = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
    return { x: q.x, y: q.y };
  }, [p.x, p.y]);
}

/** Aktuálny stav zápalky (cez testovací háčik dosky). */
async function readMatch(page, matchId) {
  return page.evaluate((id) => window.__zapalkovoBoard.getState().matches.find((m) => m.id === id), matchId);
}

/** Bod na osi zápalky posunutý o GRAB od stredu. */
function grabPoint(m) {
  const rad = (m.angle * Math.PI) / 180;
  return { x: m.x + GRAB * Math.cos(rad), y: m.y + GRAB * Math.sin(rad) };
}

/** Ťah myšou po malých krokoch. */
async function mouseDrag(page, a, b) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
}

/** Otvorí úlohu cez deep link a počká na dosku aj háčiky. */
async function openPuzzle(page, id) {
  const puzzle = byId(id);
  await page.goto(`./#/play/${puzzle.category}?puzzle=${id}`);
  await page.waitForFunction((pid) => window.__zapalkovoGame?.getCurrent()?.id === pid, id);
  await expect(page.locator('#board .match')).toHaveCount(createState(puzzle).matches.length);
  return puzzle;
}

/** Vykoná jeden krok plánu myšou: otočí (dvojklik), kým uhol nesedí, potom presunie. */
async function playStep(page, puzzle, step) {
  const matchId = await page.locator(`#board .match[data-slot="${step.from}"]`).getAttribute('data-match');
  const target = step.to === 'tray'
    ? { x: puzzle.board.tray.x + puzzle.board.tray.w / 2, y: puzzle.board.tray.y + puzzle.board.tray.h / 2, angle: null }
    : puzzle.board.slotById.get(step.to);
  let m = await readMatch(page, matchId);
  for (let i = 0; target.angle !== null && angleDiff(m.angle, target.angle) > 23 && i < 4; i += 1) {
    const p = await svgToScreen(page, grabPoint(m));
    await page.mouse.dblclick(p.x, p.y);
    m = await readMatch(page, matchId);
  }
  if (m.slot === step.to) return;
  const grab = grabPoint(m);
  const drop = { x: target.x + (grab.x - m.x), y: target.y + (grab.y - m.y) };
  await mouseDrag(page, await svgToScreen(page, grab), await svgToScreen(page, drop));
  const after = await readMatch(page, matchId);
  if (step.to === 'tray') expect(after.slot, `${puzzle.id} ${step.from}->tray`).toBeNull();
  else expect(after.slot, `${puzzle.id} ${step.from}->${step.to}`).toBe(step.to);
}

/** Vyrieši úlohu myšou podľa prvého riešenia. */
async function solveByMouse(page, puzzle) {
  for (const step of solutionPlan(puzzle, 0)) await playStep(page, puzzle, step);
}

/** Množina obsadených slotov podľa DOM. */
async function occupiedSlots(page) {
  const slots = await page.locator('#board .match').evaluateAll((els) => els.map((e) => e.dataset.slot));
  return slots.filter(Boolean).sort();
}

test.describe('solve every puzzle through the UI', () => {
  for (const puzzle of DATA.puzzles) {
    test(`solves ${puzzle.id}`, async ({ page }, info) => {
      test.skip(info.project.name === 'mobile-chrome', 'mouse flow runs on desktop projects');
      test.skip(info.project.name === 'firefox' && !FIREFOX_SAMPLES.includes(puzzle.id), 'firefox: 3 samples');
      await openPuzzle(page, puzzle.id);
      await expect(page.locator('#success')).toBeHidden();
      await solveByMouse(page, puzzle);
      const success = page.locator('#success');
      await expect(success).toBeVisible();
      await expect(success).toHaveAttribute('role', 'status');
      await expect(success).toContainText('Výborne');
      await expect(success.locator('[data-action="next"]')).toBeFocused();
    });
  }
});

test.describe('game controls', () => {
  test.beforeEach(({ page: _page }, info) => {
    test.skip(info.project.name === 'mobile-chrome', 'mouse flow runs on desktop projects');
  });

  test('hint shows the hint text in the live region', async ({ page }) => {
    const puzzle = await openPuzzle(page, 'num-01');
    await page.locator('#controls [data-action="hint"]').click();
    await expect(page.locator('#message')).toContainText(puzzle.hint.sk);
    await expect(page.locator('#message')).toHaveAttribute('aria-live', 'polite');
  });

  test('solution animates the board into the solution and marks it revealed', async ({ page }) => {
    const puzzle = await openPuzzle(page, 'num-01');
    await expect(page.locator('#controls [data-action="next-solution"]')).toBeHidden();
    await page.locator('#controls [data-action="solution"]').click();
    await expect(page.locator('#message')).toContainText('Toto je riešenie');
    await expect.poll(() => occupiedSlots(page)).toEqual([...puzzle.solutions[0]].sort());
    await expect(page.locator('#success')).toBeHidden();
    await expect(page.locator('#controls [data-action="next-solution"]')).toBeHidden();
    await page.goto('./#/');
    await expect(page.locator('#categories .category-card').first()).toContainText('Vyriešené 0 / 6');
  });

  test('num-03 offers the next solution and switches to it', async ({ page }) => {
    const puzzle = await openPuzzle(page, 'num-03');
    expect(puzzle.solutions.length).toBeGreaterThan(1);
    const nextSolution = page.locator('#controls [data-action="next-solution"]');
    await expect(nextSolution).toBeHidden();
    await page.locator('#controls [data-action="solution"]').click();
    await expect.poll(() => occupiedSlots(page)).toEqual([...puzzle.solutions[0]].sort());
    await expect(nextSolution).toBeVisible();
    await nextSolution.click();
    await expect.poll(() => occupiedSlots(page)).toEqual([...puzzle.solutions[1]].sort());
  });

  test('reset after a move puts every match back to its start slot', async ({ page }) => {
    const puzzle = await openPuzzle(page, 'num-01');
    const before = await page.locator('#board .match').evaluateAll((els) =>
      Object.fromEntries(els.map((e) => [e.dataset.match, e.dataset.slot])));
    await playStep(page, puzzle, solutionPlan(puzzle, 0)[0]);
    await page.locator('#controls [data-action="reset"]').click();
    const after = await page.locator('#board .match').evaluateAll((els) =>
      Object.fromEntries(els.map((e) => [e.dataset.match, e.dataset.slot])));
    expect(after).toEqual(before);
    await expect(page.locator('#moves')).toContainText('0 / 1');
    await expect(page.locator('#success')).toBeHidden();
  });

  test('moves over the limit get .is-over', async ({ page }) => {
    const puzzle = await openPuzzle(page, 'num-01');
    // dve zápalky do odkladacej plochy (zápalka mimo slotov úlohu nikdy nevyrieši)
    const [a, b] = [...puzzle.start];
    await playStep(page, puzzle, { from: a, to: 'tray' });
    await expect(page.locator('#moves')).toContainText('1 / 1');
    await expect(page.locator('#moves')).not.toHaveClass(/is-over/);
    await playStep(page, puzzle, { from: b, to: 'tray' });
    await expect(page.locator('#moves')).toContainText('2 / 1');
    await expect(page.locator('#moves')).toHaveClass(/is-over/);
  });

  test('rotate button is enabled only with a selected match', async ({ page }) => {
    await openPuzzle(page, 'num-01');
    const rotate = page.locator('#controls [data-action="rotate"]');
    await expect(rotate).toBeDisabled();
    await page.locator('#board .match[data-slot="c0.d"]').focus();
    await expect(rotate).toBeEnabled();
  });

  test('language switch re-translates task and message', async ({ page }) => {
    const puzzle = await openPuzzle(page, 'num-01');
    await page.locator('#controls [data-action="hint"]').click();
    await page.locator('#lang-toggle').click();
    await expect(page.locator('#task-text')).toHaveText(puzzle.task.en);
    await expect(page.locator('#message')).toContainText(puzzle.hint.en);
    await expect(page.locator('#moves')).toContainText('Moves: 0 / 1');
  });
});

test.describe('queue and progress', () => {
  test.beforeEach(({ page: _page }, info) => {
    test.skip(info.project.name === 'mobile-chrome', 'mouse flow runs on desktop projects');
  });

  const currentId = (page) => page.evaluate(() => window.__zapalkovoGame.getCurrent()?.id);

  test('queue order survives a reload and never repeats within a round', async ({ page }) => {
    await page.goto('./#/play/numbers');
    await page.waitForFunction(() => Boolean(window.__zapalkovoGame?.getCurrent()));
    const first = [await currentId(page)];
    const next = page.locator('#controls [data-action="next"]');
    for (let i = 0; i < 2; i += 1) {
      await next.click();
      await expect.poll(() => currentId(page)).not.toBe(first[first.length - 1]);
      first.push(await currentId(page));
    }
    expect(new Set(first).size).toBe(3);
    expect(new URL(page.url()).hash).toBe('#/play/numbers');
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__zapalkovoGame?.getCurrent()));
    expect(await currentId(page)).toBe(first[2]);
    const rest = [];
    for (let i = 0; i < 3; i += 1) {
      const prev = await currentId(page);
      await next.click();
      await expect.poll(() => currentId(page)).not.toBe(prev);
      rest.push(await currentId(page));
    }
    const all = DATA.puzzles.filter((p) => p.category === 'numbers').map((p) => p.id);
    expect(new Set(rest).size).toBe(3);
    expect(rest.filter((id) => first.includes(id))).toEqual([]);
    expect([...first, ...rest].sort()).toEqual([...all].sort());
  });

  test('home shows solved 1 / 6 after solving one puzzle', async ({ page }) => {
    const puzzle = await openPuzzle(page, 'num-01');
    await solveByMouse(page, puzzle);
    await expect(page.locator('#success')).toBeVisible();
    await page.locator('.back-link').click();
    await expect(page.locator('#categories .category-card').first()).toContainText('Vyriešené 1 / 6');
  });

  test('next puzzle button in the success panel loads another puzzle', async ({ page }) => {
    const puzzle = await openPuzzle(page, 'num-01');
    await solveByMouse(page, puzzle);
    await page.locator('#success [data-action="next"]').click();
    await expect.poll(() => currentId(page)).not.toBe('num-01');
    await expect(page.locator('#success')).toBeHidden();
    await expect(page.locator('#moves')).toContainText('0 /');
  });
});
