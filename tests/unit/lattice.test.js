import { describe, it, expect } from 'vitest';
import { gridSlots, triSlots, findSquares, findTriangles, checkShapes } from '../../js/core/lattice.js';

const ids = (slots) => slots.map((s) => s.id);
const without = (slots, removed) => new Set(ids(slots).filter((id) => !removed.includes(id)));

describe('gridSlots', () => {
  it('2x2 ma 12 slotov a správne súradnice', () => {
    const s = gridSlots(2, 2);
    expect(s.length).toBe(12);
    const h = s.find((x) => x.id === 'h1-1');
    expect(h).toEqual({ id: 'h1-1', x: 150, y: 100, angle: 0 });
    const v = s.find((x) => x.id === 'v0-2');
    expect(v).toEqual({ id: 'v0-2', x: 200, y: 50, angle: 90 });
  });
});

describe('triSlots', () => {
  it('počty slotov', () => {
    expect(triSlots(2).length).toBe(9);
    expect(triSlots(3).length).toBe(18);
  });
  it('stredy a uhly hrán', () => {
    const s = new Map(triSlots(2).map((x) => [x.id, x]));
    expect(s.get('a1-0')).toMatchObject({ x: 100, y: 86.6, angle: 0 });
    expect(s.get('l0-0').angle).toBe(120);
    expect(s.get('r0-0').angle).toBe(60);
    expect(s.get('l0-0').x).toBeCloseTo(75);
    expect(s.get('r0-0').x).toBeCloseTo(125);
    expect(s.get('l0-0').y).toBeCloseTo(43.3);
  });
});

describe('findSquares / findTriangles', () => {
  it('plná 2x2 = 5, plná 3x3 = 14', () => {
    expect(findSquares(new Set(ids(gridSlots(2, 2))), 2, 2).length).toBe(5);
    expect(findSquares(new Set(ids(gridSlots(3, 3))), 3, 3).length).toBe(14);
  });
  it('plná trigrid n=2 = 5, n=3 = 13', () => {
    expect(findTriangles(new Set(ids(triSlots(2))), 2).length).toBe(5);
    expect(findTriangles(new Set(ids(triSlots(3))), 3).length).toBe(13);
  });
  it('tri n=2 bez a1-0 = 3', () => {
    expect(findTriangles(without(triSlots(2), ['a1-0']), 2).length).toBe(3);
  });
});

describe('checkShapes', () => {
  const sq = (count) => ({ shape: 'square', count, noLoose: true });
  const tr = (count) => ({ shape: 'triangle', count, noLoose: true });
  const g22 = { type: 'grid', rows: 2, cols: 2 };
  const g33 = { type: 'grid', rows: 3, cols: 3 };
  const t2 = { type: 'trigrid', n: 2 };
  const cases = [
    ['log-01', gridSlots(2, 2), g22, sq(2), ['h1-0', 'v0-1']],
    ['log-02', gridSlots(2, 2), g22, sq(3), ['h0-1', 'v0-2']],
    ['log-03', gridSlots(3, 3), g33, sq(5), ['h1-1', 'h2-1', 'v1-1', 'v1-2']],
    ['log-04', gridSlots(3, 3), g33, sq(2),
      ['h1-0', 'h1-2', 'h2-0', 'h2-2', 'v0-1', 'v0-2', 'v2-1', 'v2-2']],
    ['log-05', triSlots(2), t2, tr(3), ['a1-0']],
    ['log-06', triSlots(2), t2, tr(1), ['a1-0', 'r1-0', 'l1-1']],
  ];
  for (const [name, slots, board, goal, removed] of cases) {
    it(`${name}: riešenie vyhovuje, plný štart nie`, () => {
      expect(checkShapes(without(slots, removed), board, goal)).toBe(true);
      expect(checkShapes(new Set(ids(slots)), board, goal)).toBe(false);
    });
  }
  it('noLoose: voľná hrana vadí', () => {
    const occ = new Set(['h0-0', 'h1-0', 'v0-0', 'v0-1', 'h2-1']);
    expect(checkShapes(occ, g22, { shape: 'square', count: 1, noLoose: true })).toBe(false);
    expect(checkShapes(occ, g22, { shape: 'square', count: 1, noLoose: false })).toBe(true);
  });
});
