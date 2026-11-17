import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { normalizePuzzles } from '../../js/core/puzzles.js';
import { createState } from '../../js/core/puzzle-state.js';

const DATA = normalizePuzzles(JSON.parse(readFileSync(new URL('../../data/puzzles.json', import.meta.url), 'utf8')));
const PUZZLE = DATA.puzzles.find((p) => p.id === 'num-01');

/** Otvorí úlohu cez deep link a počká na dosku aj háčiky. */
async function openPuzzle(page) {
  await page.goto(`./#/play/${PUZZLE.category}?puzzle=${PUZZLE.id}`);
  await page.waitForFunction((pid) => window.__zapalkovoGame?.getCurrent()?.id === pid, PUZZLE.id);
  await expect(page.locator('#board .match')).toHaveCount(createState(PUZZLE).matches.length);
}

/** Množina obsadených slotov podľa DOM. */
async function occupiedSlots(page) {
  const slots = await page.locator('#board .match').evaluateAll((els) => els.map((e) => e.dataset.slot));
  return slots.filter(Boolean).sort();
}

/** Náklon doľava: udalosti natočenia každých 50 ms po dobu ms. */
async function tiltLeft(page, ms = 500) {
  await page.evaluate(async (duration) => {
    const end = performance.now() + duration;
    while (performance.now() < end) {
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: 0, gamma: -45 }));
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }, ms);
}

/** Jedna dávka otrasu: zrýchlenie kmitá 20/0 po dobu ms. */
async function shakeBurst(page, ms = 150) {
  await page.evaluate(async (duration) => {
    const end = performance.now() + duration;
    let high = true;
    while (performance.now() < end) {
      window.dispatchEvent(new DeviceMotionEvent('devicemotion', { acceleration: { x: high ? 20 : 0, y: 0, z: 0 } }));
      high = !high;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }, ms);
}

/** Pošle ticho (nulové zrýchlenie) po dobu ms. */
async function quiet(page, ms = 300) {
  await page.evaluate(async (duration) => {
    const end = performance.now() + duration;
    while (performance.now() < end) {
      window.dispatchEvent(new DeviceMotionEvent('devicemotion', { acceleration: { x: 0, y: 0, z: 0 } }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }, ms);
}

/** Presunie prvú zápalku do odkladacej plochy (cez háčik dosky), aby bol reset viditeľný. */
async function dirtyBoard(page) {
  await page.evaluate(() => {
    const board = window.__zapalkovoBoard;
    const state = board.getState();
    const [first] = state.matches;
    board.setState({ ...state, matches: state.matches.map((m) => (m === first ? { ...m, slot: null, x: 5, y: 5 } : m)) });
  });
}

test.describe('sensors', () => {
  // Novšie Chromium samo ponúka requestPermission; základ testov je prehliadač bez neho
  // (Android/desktop), testy povolenia si ho nastavia samy.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      delete DeviceOrientationEvent.requestPermission;
      delete DeviceMotionEvent.requestPermission;
    });
  });

  test('tilting left holds and shows the solution', async ({ page }) => {
    await openPuzzle(page);
    await tiltLeft(page);
    await expect(page.locator('#message')).toContainText('Toto je riešenie');
    await expect.poll(() => occupiedSlots(page)).toEqual([...PUZZLE.solutions[0]].sort());
  });

  test('a short tilt does not show the solution', async ({ page }) => {
    await openPuzzle(page);
    await tiltLeft(page, 150);
    await expect(page.locator('#message')).toBeEmpty();
  });

  test('two shake bursts reset the puzzle', async ({ page }) => {
    await openPuzzle(page);
    const before = await occupiedSlots(page);
    await dirtyBoard(page);
    expect(await occupiedSlots(page)).not.toEqual(before);
    await shakeBurst(page);
    await quiet(page);
    await shakeBurst(page);
    await expect.poll(() => occupiedSlots(page)).toEqual(before);
    await expect(page.locator('#message')).toContainText('zresetovaná');
  });

  test('a single shake burst does not reset', async ({ page }) => {
    await openPuzzle(page);
    await dirtyBoard(page);
    const dirty = await occupiedSlots(page);
    await shakeBurst(page);
    await quiet(page, 500);
    expect(await occupiedSlots(page)).toEqual(dirty);
  });

  test('sensor events on the home view do nothing', async ({ page }) => {
    await openPuzzle(page);
    await dirtyBoard(page);
    const dirty = await occupiedSlots(page);
    await page.locator('.back-link').click();
    await expect(page.locator('#view-home')).toBeVisible();
    await tiltLeft(page);
    await shakeBurst(page);
    await quiet(page);
    await shakeBurst(page);
    // doska ostala nedotknutá (je skrytá, ale stav čítame priamo)
    expect(await occupiedSlots(page)).toEqual(dirty);
    await expect(page.locator('#message')).toBeEmpty();
  });

  test('permission API on a fine pointer (desktop): button stays hidden', async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium', 'desktop project only');
    await page.addInitScript(() => {
      DeviceOrientationEvent.requestPermission = () => Promise.resolve('granted');
    });
    await openPuzzle(page);
    await expect(page.locator('#sensors-btn')).toBeHidden();
  });

  test('iOS-style permission: denied shows the message without errors', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile-chrome', 'coarse pointer only');
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => {
      DeviceOrientationEvent.requestPermission = () => Promise.resolve('denied');
    });
    await openPuzzle(page);
    const button = page.locator('#sensors-btn');
    await expect(button).toBeVisible();
    await expect(button).toContainText('Povoliť senzory');
    await button.click();
    await expect(page.locator('#message')).toContainText('Prístup k senzorom bol zamietnutý');
    await expect(button).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('iOS-style permission: granted hides the button', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile-chrome', 'coarse pointer only');
    await page.addInitScript(() => {
      DeviceOrientationEvent.requestPermission = () => Promise.resolve('granted');
    });
    await openPuzzle(page);
    await page.locator('#sensors-btn').click();
    await expect(page.locator('#sensors-btn')).toBeHidden();
  });

  test('button hides itself once an orientation event with gamma arrives', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile-chrome', 'coarse pointer only');
    await page.addInitScript(() => {
      DeviceOrientationEvent.requestPermission = () => Promise.resolve('granted');
    });
    await openPuzzle(page);
    await expect(page.locator('#sensors-btn')).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: 0, gamma: 5 })));
    await expect(page.locator('#sensors-btn')).toBeHidden();
  });

  test('a shake during the solution animation resets cleanly', async ({ page }) => {
    await openPuzzle(page);
    const before = await occupiedSlots(page);
    await tiltLeft(page, 400);
    await shakeBurst(page);
    await quiet(page);
    await shakeBurst(page);
    await expect.poll(() => occupiedSlots(page)).toEqual(before);
    await page.waitForTimeout(1500);
    expect(await occupiedSlots(page)).toEqual(before);
    await expect(page.locator('#success')).toBeHidden();
    await expect(page.locator('#message')).toContainText('zresetovaná');
  });

  test('holding the tilt for 2 s shows the solution only once', async ({ page }) => {
    await openPuzzle(page);
    await page.evaluate(() => {
      const game = window.__zapalkovoGame;
      const original = game.showSolution;
      window.__solutionCalls = 0;
      game.showSolution = (...args) => { window.__solutionCalls += 1; return original(...args); };
    });
    await tiltLeft(page, 2000);
    expect(await page.evaluate(() => window.__solutionCalls)).toBe(1);
  });

  test('button stays hidden when no permission is needed', async ({ page }) => {
    await openPuzzle(page);
    await expect(page.locator('#sensors-btn')).toBeHidden();
  });
});
