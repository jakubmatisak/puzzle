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
  });

  test('unknown puzzle id goes home', async ({ page }) => {
    await page.goto('./#/play/numbers?puzzle=nope-99');
    await expect(page.locator('#view-home')).toBeVisible();
  });
});

test.describe('board (touch + layout)', () => {
  test('touch drag via CDP snaps the match and does not scroll the page', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile-chrome', 'CDP touch only in mobile-chrome');
    await page.setViewportSize({ width: 412, height: 560 }); // stránka sa dá posúvať
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

  test('touch swipe outside the board scrolls the page', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile-chrome', 'CDP touch only in mobile-chrome');
    await page.setViewportSize({ width: 412, height: 560 }); // nižšie okno, aby sa stránka dala posúvať
    await openBoard(page);
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(true);
    const box = await page.locator('.play-head').boundingBox();
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
