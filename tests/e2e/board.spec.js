import { test, expect } from '@playwright/test';

const URL = './#/play/numbers?puzzle=num-01';

/** Stred slotu (z prvku <line class="slot">) v súradniciach obrazovky. */
async function slotCenter(page, slotId) {
  return page.evaluate((id) => {
    const line = document.querySelector(`#board line.slot[data-slot="${id}"]`);
    const svg = line.ownerSVGElement;
    const p = new DOMPoint(
      (Number(line.getAttribute('x1')) + Number(line.getAttribute('x2'))) / 2,
      (Number(line.getAttribute('y1')) + Number(line.getAttribute('y2'))) / 2,
    ).matrixTransform(svg.getScreenCTM());
    return { x: p.x, y: p.y };
  }, slotId);
}

/** Bod v SVG súradniciach prepočítaný na obrazovku. */
async function svgToScreen(page, x, y) {
  return page.evaluate(([sx, sy]) => {
    const svg = document.getElementById('board');
    const p = new DOMPoint(sx, sy).matrixTransform(svg.getScreenCTM());
    return { x: p.x, y: p.y };
  }, [x, y]);
}

/** Ťah myšou z bodu a do bodu b po malých krokoch. */
async function mouseDrag(page, a, b) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
}

/** Leží celá kresba zápalky vnútri obdĺžnika odkladacej plochy? */
async function insideTray(page, matchId) {
  return page.evaluate((id) => {
    const m = document.querySelector(`#board .match[data-match="${id}"]`).getBoundingClientRect();
    const t = document.querySelector('#board rect.tray').getBoundingClientRect();
    return m.left >= t.left - 0.5 && m.right <= t.right + 0.5
      && m.top >= t.top - 0.5 && m.bottom <= t.bottom + 0.5;
  }, matchId);
}

/** Jeden dotyk cez CDP (touchStart/Move/End); bez bodu = koniec dotyku. */
async function cdpTouch(cdp, type, p) {
  await cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: p ? [{ x: Math.round(p.x), y: Math.round(p.y) }] : [],
  });
}

const match = (page, slot) => page.locator(`#board .match[data-slot="${slot}"]`);

async function openBoard(page) {
  await page.goto(URL);
  await expect(page.locator('#board .match')).toHaveCount(19);
  await expect(page.locator('#moves')).toContainText('0 / 1');
}

test.describe('board (mouse + keyboard)', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'mobile-chrome', 'mouse/keyboard tests run on desktop projects');
    await openBoard(page);
  });

  test('renders slots, tray, gradients and matches', async ({ page }) => {
    await expect(page.locator('#board line.slot')).toHaveCount(31);
    await expect(page.locator('#board rect.tray')).toHaveCount(1);
    await expect(page.locator('#board #stick')).toHaveCount(1);
    await expect(page.locator('#board #head')).toHaveCount(1);
    const m = match(page, 'c0.b');
    await expect(m).toHaveAttribute('tabindex', '0');
    await expect(m).toHaveAttribute('role', 'button');
    await expect(m).toHaveAttribute('aria-label', /^Zápalka \d+$/);
    await expect(m).toHaveAttribute('transform', /translate\(100 50\) rotate\(90\)/);
    await expect(page.locator('#task-text')).not.toHaveText('Načítavam úlohu…');
  });

  test('mouse drag snaps into a free slot and counts the move', async ({ page }) => {
    await mouseDrag(page, await slotCenter(page, 'c0.b'), await slotCenter(page, 'c4.b'));
    await expect(match(page, 'c4.b')).toHaveCount(1);
    await expect(match(page, 'c0.b')).toHaveCount(0);
    await expect(page.locator('#moves')).toContainText('1 / 1');
  });

  test('drop outside any slot returns the match', async ({ page }) => {
    const from = await slotCenter(page, 'c0.b');
    await mouseDrag(page, from, await svgToScreen(page, 350, -40));
    await expect(match(page, 'c0.b')).toHaveCount(1);
    await expect(match(page, 'c0.b')).toHaveAttribute('transform', /translate\(100 50\) rotate\(90\)/);
    await expect(page.locator('#moves')).toContainText('0 / 1');
  });

  test('pointercancel during a drag reverts the match', async ({ page }) => {
    await page.evaluate(() => {
      document.getElementById('board').addEventListener('pointerdown', (e) => {
        window.lastPointerId = e.pointerId;
      });
    });
    const from = await slotCenter(page, 'c0.b');
    const to = await slotCenter(page, 'c4.b');
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.evaluate(() => {
      document.getElementById('board').dispatchEvent(new PointerEvent('pointercancel', {
        pointerId: window.lastPointerId, bubbles: true,
      }));
    });
    await page.mouse.up();
    await expect(match(page, 'c0.b')).toHaveCount(1);
    await expect(match(page, 'c4.b')).toHaveCount(0);
    await expect(page.locator('#moves')).toContainText('0 / 1');
  });

  test('horizontal match on a vertical slot does not snap and asks to rotate', async ({ page }) => {
    await mouseDrag(page, await slotCenter(page, 'c0.a'), await slotCenter(page, 'c4.b'));
    await expect(match(page, 'c0.a')).toHaveCount(1);
    await expect(match(page, 'c4.b')).toHaveCount(0);
    await expect(page.locator('#message')).toContainText('otoč');
  });

  test('double-click rotates the match', async ({ page }) => {
    const m = match(page, 'c0.a');
    const id = await m.getAttribute('data-match');
    const p = await slotCenter(page, 'c0.a');
    await page.mouse.dblclick(p.x, p.y);
    const rotated = page.locator(`#board .match[data-match="${id}"]`);
    await expect(rotated).toHaveAttribute('transform', /rotate\(45/);
    await expect(rotated).toHaveAttribute('data-slot', '');
  });

  test('R key and the Rotate button rotate the focused/selected match', async ({ page }) => {
    const id = await match(page, 'c0.d').getAttribute('data-match');
    const m = page.locator(`#board .match[data-match="${id}"]`);
    await m.focus();
    await page.keyboard.press('r');
    await expect(m).toHaveAttribute('transform', /rotate\(45/);
    await expect(m).toHaveClass(/match-selected/);
    await page.locator('[data-action="rotate"]').click();
    await expect(m).toHaveAttribute('transform', /rotate\(90/);
  });

  test('arrow keys move the focused match and Enter drops it into a slot', async ({ page }) => {
    const id = await match(page, 'c0.b').getAttribute('data-match');
    await page.locator(`#board .match[data-match="${id}"]`).focus();
    for (let i = 0; i < 60; i += 1) await page.keyboard.press('ArrowRight');
    await expect(page.locator('#board line.slot[data-slot="c4.b"]')).toHaveClass(/slot-target/);
    await page.keyboard.press('Enter');
    await expect(page.locator(`#board .match[data-match="${id}"]`)).toHaveAttribute('data-slot', 'c4.b');
    await expect(page.locator('#board .slot-target')).toHaveCount(0);
  });

  test('Escape cancels a keyboard move', async ({ page }) => {
    const id = await match(page, 'c0.b').getAttribute('data-match');
    await page.locator(`#board .match[data-match="${id}"]`).focus();
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    await expect(page.locator(`#board .match[data-match="${id}"]`))
      .toHaveAttribute('transform', /translate\(100 50\) rotate\(90\)/);
  });

  test('dropping into the tray parks the match there', async ({ page }) => {
    const id = await match(page, 'c0.b').getAttribute('data-match');
    await mouseDrag(page, await slotCenter(page, 'c0.b'), await svgToScreen(page, 300, 340));
    const m = page.locator(`#board .match[data-match="${id}"]`);
    await expect(m).toHaveAttribute('data-slot', '');
    await expect(m).toHaveAttribute('transform', /rotate\(90\)/);
    await expect(page.locator('#board .tray-label')).toHaveText('Odkladací priestor');
    expect(await insideTray(page, id)).toBe(true);
  });

  test('at 375 px a press 15 px off the centerline grabs the nearest match', async ({ page }) => {
    // myš nemá „touch adjustment“ prehliadača, takže test overuje vlastné hľadanie najbližšej zápalky
    await page.setViewportSize({ width: 375, height: 812 });
    await openBoard(page);
    const from = await slotCenter(page, 'c0.b');
    const to = await slotCenter(page, 'c4.b');
    await mouseDrag(page, { x: from.x - 15, y: from.y }, { x: to.x - 15, y: to.y });
    await expect(match(page, 'c4.b')).toHaveCount(1);
    await expect(match(page, 'c0.b')).toHaveCount(0);
  });

  test('window blur during a drag reverts the match', async ({ page }) => {
    const from = await slotCenter(page, 'c0.b');
    const to = await slotCenter(page, 'c4.b');
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.mouse.up();
    await expect(match(page, 'c0.b')).toHaveCount(1);
    await expect(match(page, 'c4.b')).toHaveCount(0);
  });

  test('unknown puzzle id goes home', async ({ page }) => {
    await page.goto('./#/play/numbers?puzzle=nope-99');
    await expect(page.locator('#view-home')).toBeVisible();
  });
});

test.describe('board (touch + layout)', () => {
  test('touch drag via CDP snaps the match and does not scroll the page', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile-chrome', 'CDP touch only in mobile-chrome');
    await page.setViewportSize({ width: 412, height: 560 }); // nízke okno: dotyk na doske nesmie nič posunúť
    await openBoard(page);
    const from = await slotCenter(page, 'c0.b');
    const to = await slotCenter(page, 'c4.b');
    const scrollBefore = await page.evaluate(() => window.scrollY);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, p) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: p ? [{ x: Math.round(p.x), y: Math.round(p.y) }] : [],
    });
    await touch('touchStart', from);
    const steps = 12;
    for (let i = 1; i <= steps; i += 1) {
      await touch('touchMove', {
        x: from.x + ((to.x - from.x) * i) / steps,
        y: from.y + ((to.y - from.y) * i) / steps,
      });
    }
    await touch('touchEnd');
    await expect(match(page, 'c4.b')).toHaveCount(1);
    await expect(page.locator('#moves')).toContainText('1 / 1');
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  });

  test('double-tap rotates the match', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile-chrome', 'CDP touch only in mobile-chrome');
    await openBoard(page);
    const id = await match(page, 'c0.a').getAttribute('data-match');
    const p = await slotCenter(page, 'c0.a');
    const cdp = await page.context().newCDPSession(page);
    const point = [{ x: Math.round(p.x), y: Math.round(p.y) }];
    for (let i = 0; i < 2; i += 1) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await expect(page.locator(`#board .match[data-match="${id}"]`)).toHaveAttribute('transform', /rotate\(45/);
  });

  test('touch 15 px off the centerline still grabs the match', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile-chrome', 'CDP touch only in mobile-chrome');
    await openBoard(page);
    const from = await slotCenter(page, 'c0.b');
    const to = await slotCenter(page, 'c4.b');
    const cdp = await page.context().newCDPSession(page);
    const off = { x: from.x - 15, y: from.y };
    await cdpTouch(cdp, 'touchStart', off);
    for (let i = 1; i <= 12; i += 1) {
      await cdpTouch(cdp, 'touchMove', {
        x: off.x + ((to.x - from.x) * i) / 12, y: off.y + ((to.y - from.y) * i) / 12,
      });
    }
    await cdpTouch(cdp, 'touchEnd');
    await expect(match(page, 'c4.b')).toHaveCount(1);
    await expect(match(page, 'c0.b')).toHaveCount(0);
  });

  test('double-tap with 3 px finger jitter rotates', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile-chrome', 'CDP touch only in mobile-chrome');
    await openBoard(page);
    const id = await match(page, 'c0.a').getAttribute('data-match');
    const p = await slotCenter(page, 'c0.a');
    const cdp = await page.context().newCDPSession(page);
    await cdpTouch(cdp, 'touchStart', p);
    await cdpTouch(cdp, 'touchMove', { x: p.x + 3, y: p.y + 2 });
    await cdpTouch(cdp, 'touchEnd');
    await cdpTouch(cdp, 'touchStart', { x: p.x - 2, y: p.y + 3 });
    await cdpTouch(cdp, 'touchMove', { x: p.x + 1, y: p.y + 3 });
    await cdpTouch(cdp, 'touchEnd');
    await expect(page.locator(`#board .match[data-match="${id}"]`)).toHaveAttribute('transform', /rotate\(45/);
  });

  test('touch swipe on a content page scrolls it (only the board blocks touch scrolling)', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile-chrome', 'CDP touch only in mobile-chrome');
    await page.setViewportSize({ width: 412, height: 560 });
    // herná obrazovka sa už neposúva (fit.spec.js), preto swipe overujeme na návode
    await page.goto('./#/help');
    await expect(page.locator('#view-help article[lang="sk"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(true);
    const box = await page.locator('#view-help article[lang="sk"] .help-header').boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const x = Math.round(box.x + 20);
    const y0 = Math.round(box.y + box.height - 5);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let i = 1; i <= 10; i += 1) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - i * 12 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test('svg has touch-action none, the rest of the page does not', async ({ page }) => {
    await openBoard(page);
    const actions = await page.evaluate(() => ({
      svg: getComputedStyle(document.getElementById('board')).touchAction,
      wrap: getComputedStyle(document.querySelector('.board-wrap')).touchAction,
      body: getComputedStyle(document.body).touchAction,
    }));
    expect(actions.svg).toBe('none');
    expect(actions.wrap).toBe('auto');
    expect(actions.body).toBe('auto');
  });

  test('board scales to a 375 px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openBoard(page);
    const box = await page.locator('#board').boundingBox();
    expect(box.width).toBeLessThanOrEqual(375);
    expect(box.x).toBeGreaterThanOrEqual(0);
    const noHScroll = await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(noHScroll).toBe(true);
  });
});

test.describe('board on small screens', () => {
  test('phone portrait: almost no padding, rotate tip for wide puzzles, dismissible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('./#/play/roman?puzzle=rom-02');
    await expect(page.locator('#board .match')).not.toHaveCount(0);
    const pad = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.querySelector('.board-wrap')).paddingLeft));
    expect(pad).toBeLessThanOrEqual(4);
    const tip = page.locator('#rotate-tip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('otoč telefón na šírku');
    await tip.locator('button').click();
    await expect(tip).toBeHidden();
    await page.reload();
    await expect(page.locator('#board .match')).not.toHaveCount(0);
    await expect(tip).toBeHidden();
  });

  test('rotate tip is not shown for compact puzzles or on wide screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('./#/play/logic?puzzle=log-06');
    await expect(page.locator('#board .match')).not.toHaveCount(0);
    await expect(page.locator('#rotate-tip')).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./#/play/roman?puzzle=rom-02');
    await expect(page.locator('#board .match')).not.toHaveCount(0);
    await expect(page.locator('#rotate-tip')).toBeHidden();
  });

  test('phone landscape 812x375: the whole board fits the viewport height', async ({ page }) => {
    await page.setViewportSize({ width: 812, height: 375 });
    for (const [cat, id] of [['roman', 'rom-02'], ['logic', 'log-06'], ['numbers', 'num-01']]) {
      await page.goto(`./#/play/${cat}?puzzle=${id}`);
      await expect(page.locator('#board .match')).not.toHaveCount(0);
      const h = await page.evaluate(() =>
        document.querySelector('.board-wrap').getBoundingClientRect().height);
      expect(h, id).toBeLessThanOrEqual(375);
    }
    // prilepená lišta ovládania by na nízkej obrazovke zakryla dosku
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('controls')).position)).toBe('static');
  });
});

test.describe('animatePlan (test hook window.__zapalkovoBoard)', () => {
  const openHooked = async (page, cat, id) => {
    await page.goto(`./#/play/${cat}?puzzle=${id}`);
    await expect(page.locator('#board .match')).not.toHaveCount(0);
    await page.waitForFunction(() => Boolean(window.__zapalkovoBoard));
  };

  test('plays a move plan for num-01 and reports the change', async ({ page }) => {
    await openHooked(page, 'numbers', 'num-01');
    await page.evaluate(() => window.__zapalkovoBoard.animatePlan([{ from: 'c0.b', to: 'c4.b' }], 200));
    await expect(match(page, 'c4.b')).toHaveCount(1);
    await expect(match(page, 'c0.b')).toHaveCount(0);
    await expect(page.locator('#moves')).toContainText('1 / 1');
  });

  test('tray steps for log-01 park the matches inside the tray', async ({ page }) => {
    await openHooked(page, 'logic', 'log-01');
    const ids = await page.evaluate(() => ['h1-0', 'v0-1']
      .map((s) => document.querySelector(`#board .match[data-slot="${s}"]`).dataset.match));
    await page.evaluate(() => window.__zapalkovoBoard.animatePlan(
      [{ from: 'h1-0', to: 'tray' }, { from: 'v0-1', to: 'tray' }], 100,
    ));
    for (const id of ids) {
      await expect(page.locator(`#board .match[data-match="${id}"]`)).toHaveAttribute('data-slot', '');
      expect(await insideTray(page, id)).toBe(true);
    }
    await expect(page.locator('#moves')).toContainText('2 / 2');
  });

  test('setState during the animation stops it and keeps the given state', async ({ page }) => {
    await openHooked(page, 'logic', 'log-01');
    const result = await page.evaluate(async () => {
      const board = window.__zapalkovoBoard;
      const initial = board.getState();
      let changes = 0;
      const running = board.animatePlan([{ from: 'h1-0', to: 'tray' }, { from: 'v0-1', to: 'tray' }], 600);
      await new Promise((r) => { setTimeout(r, 200); });
      board.setState(initial);
      const before = JSON.stringify(board.getState());
      const observer = new MutationObserver(() => { changes += 1; });
      observer.observe(document.getElementById('board'), { attributes: true, subtree: true });
      await running;
      await new Promise((r) => { setTimeout(r, 1000); });
      observer.disconnect();
      const after = JSON.stringify(board.getState());
      return { same: before === JSON.stringify(initial) && after === before, changes };
    });
    expect(result.same).toBe(true);
    expect(result.changes).toBe(0);
    await expect(match(page, 'h1-0')).toHaveCount(1);
    await expect(match(page, 'h1-0')).toHaveAttribute('transform', /translate\(50 100\) rotate\(0\)/);
  });

  test('a second animatePlan cancels the first without throwing', async ({ page }) => {
    await openHooked(page, 'numbers', 'num-01');
    const error = await page.evaluate(async () => {
      const board = window.__zapalkovoBoard;
      try {
        const first = board.animatePlan([{ from: 'c0.b', to: 'c4.b' }], 600);
        await new Promise((r) => { setTimeout(r, 100); });
        const second = board.animatePlan([{ from: 'c0.b', to: 'c4.b' }], 100);
        await Promise.all([first, second]);
        return null;
      } catch (e) {
        return String(e);
      }
    });
    expect(error).toBeNull();
    await expect(match(page, 'c4.b')).toHaveCount(1);
  });

  test('reduced motion applies the plan instantly', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openHooked(page, 'numbers', 'num-01');
    const ms = await page.evaluate(async () => {
      const t0 = performance.now();
      await window.__zapalkovoBoard.animatePlan([{ from: 'c0.b', to: 'c4.b' }], 5000);
      return performance.now() - t0;
    });
    expect(ms).toBeLessThan(500);
    await expect(match(page, 'c4.b')).toHaveCount(1);
  });

  test('a stale step is skipped with a warning, not thrown', async ({ page }) => {
    await openHooked(page, 'numbers', 'num-01');
    const warnings = [];
    page.on('console', (msg) => { if (msg.type() === 'warning') warnings.push(msg.text()); });
    const error = await page.evaluate(async () => {
      try {
        await window.__zapalkovoBoard.animatePlan(
          [{ from: 'c4.b', to: 'c0.b' }, { from: 'c0.b', to: 'c4.b' }], 50,
        );
        return null;
      } catch (e) {
        return String(e);
      }
    });
    expect(error).toBeNull();
    expect(warnings.length).toBeGreaterThan(0);
    await expect(match(page, 'c4.b')).toHaveCount(1);
  });
});

test.describe('roman X from two matches (rom-04)', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'mobile-chrome', 'mouse flow runs on desktop projects');
    await page.goto('./#/play/roman?puzzle=rom-04');
    await page.waitForFunction(() => window.__zapalkovoGame?.getCurrent()?.id === 'rom-04');
  });

  /** Stav zápalky cez testovací háčik. */
  const readMatch = (page, id) => page.evaluate(
    (mid) => window.__zapalkovoBoard.getState().matches.find((m) => m.id === mid),
    id,
  );

  /** Bod na osi zápalky 20 jednotiek od stredu (stred X je spoločný dvom zápalkám). */
  async function grab(page, id) {
    const m = await readMatch(page, id);
    const rad = (m.angle * Math.PI) / 180;
    return svgToScreen(page, m.x + 20 * Math.cos(rad), m.y + 20 * Math.sin(rad));
  }

  /** Dvojklik na zápalku, kým neleží v slote `slot` (najviac 4 otočenia). */
  async function rotateInto(page, id, slot) {
    for (let i = 0; i < 4 && (await readMatch(page, id)).slot !== slot; i += 1) {
      const p = await grab(page, id);
      await page.mouse.dblclick(p.x, p.y);
    }
    expect((await readMatch(page, id)).slot).toBe(slot);
  }

  test('two matches dropped into the empty cell and rotated form X', async ({ page }) => {
    const a = await match(page, 'c0.i').getAttribute('data-match');
    const b = await match(page, 'c1.i').getAttribute('data-match');
    await mouseDrag(page, await slotCenter(page, 'c0.i'), await slotCenter(page, 'c5.i'));
    expect((await readMatch(page, a)).slot).toBe('c5.i');
    const once = await grab(page, a);
    await page.mouse.dblclick(once.x, once.y);
    expect((await readMatch(page, a)).slot).toBe('c5.xb');
    await mouseDrag(page, await slotCenter(page, 'c1.i'), await slotCenter(page, 'c5.i'));
    expect((await readMatch(page, b)).slot).toBe('c5.i');
    await rotateInto(page, b, 'c5.xa');
    const cell = await page.locator('#board .match').evaluateAll(
      (els) => els.map((e) => e.dataset.slot).filter((s) => s.startsWith('c5.')).sort(),
    );
    expect(cell).toEqual(['c5.xa', 'c5.xb']); // ENCODE.roman.X
  });
});
