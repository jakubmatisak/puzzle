import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizePuzzles } from '../../js/core/puzzles.js';
import { createState } from '../../js/core/puzzle-state.js';
import { drawScene, fitTransform, canvasSize } from '../../js/ui/canvas-renderer.js';

const DATA = normalizePuzzles(JSON.parse(readFileSync(new URL('../../data/puzzles.json', import.meta.url), 'utf8')));
const puzzle = DATA.puzzles.find((p) => p.id === 'num-01');

/** Falošný 2D kontext: zapisuje volania metód (a zápisy vlastností), gradienty sú atrapy. */
function mockCtx() {
  const calls = [];
  const target = {};
  const ctx = new Proxy(target, {
    get(t, name) {
      if (name === 'calls') return calls;
      if (name in t) return t[name];
      return (...args) => {
        calls.push({ name, args });
        if (name.startsWith('create')) return { addColorStop() {} };
        if (name === 'measureText') return { width: 10 };
        return undefined;
      };
    },
    set(t, name, value) {
      t[name] = value;
      return true;
    },
  });
  return ctx;
}

function sceneOf(extra = {}) {
  return {
    board: puzzle.board,
    matches: createState(puzzle).matches,
    drag: null,
    solved: false,
    title: 'Úloha',
    ...extra,
  };
}

const SIZE = { width: 1280, height: 720 };

describe('drawScene', () => {
  it('nakreslí 19 zápaliek (19x ellipse = hlavičky)', () => {
    const ctx = mockCtx();
    drawScene(ctx, sceneOf(), SIZE);
    expect(createState(puzzle).matches).toHaveLength(19);
    expect(ctx.calls.filter((c) => c.name === 'ellipse')).toHaveLength(19);
  });

  it('ťahaná zápalka sa kreslí posledná na pozícii drag.x/y', () => {
    const ctx = mockCtx();
    const first = createState(puzzle).matches[0];
    drawScene(ctx, sceneOf({ drag: { matchId: first.id, x: 123, y: 456, angle: 30 } }), SIZE);
    const translates = ctx.calls.filter((c) => c.name === 'translate');
    expect(translates.at(-1).args).toEqual([123, 456]);
    // pôvodná poloha ťahanej zápalky sa už nekreslí
    expect(translates.filter((c) => c.args[0] === first.x && c.args[1] === first.y)).toHaveLength(0);
    expect(ctx.calls.filter((c) => c.name === 'ellipse')).toHaveLength(19);
  });

  it('mierku a posun nastaví cez setTransform podľa fitTransform', () => {
    const ctx = mockCtx();
    drawScene(ctx, sceneOf(), SIZE);
    const fit = fitTransform(puzzle.board, SIZE.width, SIZE.height);
    const set = ctx.calls.filter((c) => c.name === 'setTransform');
    expect(set.some((c) => Math.abs(c.args[0] - fit.scale) < 1e-9 && Math.abs(c.args[3] - fit.scale) < 1e-9)).toBe(true);
    expect(fit.scale).toBeGreaterThan(0);
  });

  it('po vyriešení napíše text s vyriešením', () => {
    const ctx = mockCtx();
    drawScene(ctx, sceneOf({ solved: true, solvedText: '✓ Vyriešené' }), SIZE);
    expect(ctx.calls.some((c) => c.name === 'fillText' && c.args[0] === '✓ Vyriešené')).toBe(true);
  });
});

describe('canvasSize', () => {
  it('vráti párne rozmery so šírkou 1280', () => {
    const { width, height } = canvasSize(puzzle.board, 1280);
    expect(width).toBe(1280);
    expect(height % 2).toBe(0);
    expect(height).toBeGreaterThan(300);
  });
});
