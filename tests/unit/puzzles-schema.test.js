import { describe, it, expect } from 'vitest';
import { normalizePuzzles } from '../../js/core/puzzles.js';

const text = { sk: 'text', en: 'text' };
const categories = [
  { id: 'numbers', kind: 'equation', name: text, description: text },
  { id: 'logic', kind: 'shapes', name: text, description: text },
];
const eq = (over = {}) => ({
  id: 'e1', category: 'numbers', mode: 'move', moves: 1,
  start: '9+4=5', solutions: ['5+4=9'], task: text, hint: text, ...over,
});
const shape = (over = {}) => ({
  id: 's1', category: 'logic', mode: 'remove', moves: 2,
  board: { type: 'grid', rows: 2, cols: 2 }, start: 'all',
  goal: { shape: 'square', count: 2, noLoose: true },
  solutions: [{ without: ['h1-0', 'v0-1'] }], task: text, hint: text, ...over,
});
const make = (...puzzles) => normalizePuzzles({ version: 1, categories, puzzles });

describe('normalizePuzzles', () => {
  it('vyrobí normalizovanú rovnicu', () => {
    const p = make(eq()).puzzles[0];
    expect(p.kind).toBe('equation');
    expect(p.types).toEqual(['digit', 'op', 'digit', 'rel', 'digit']);
    expect(p.start.has('c0.a')).toBe(true);
    expect(p.solutionTexts).toEqual(['5+4=9']);
    expect(p.board.tray.h).toBe(160);
  });

  it('start "all" = všetky sloty mriežky a without odoberá sloty', () => {
    const p = make(shape()).puzzles[0];
    expect(p.start.size).toBe(12);
    expect(p.solutions[0].size).toBe(10);
    expect(p.solutions[0].has('h1-0')).toBe(false);
    expect(p.boardDef).toEqual({ type: 'grid', rows: 2, cols: 2 });
  });

  it('duplicitné ID vyhodí chybu s ID', () => {
    expect(() => make(eq(), eq())).toThrow(/e1/);
  });

  it('neznáma kategória vyhodí chybu', () => {
    expect(() => make(eq({ category: 'nope' }))).toThrow(/e1.*nope/);
  });

  it('chýbajúce pole vyhodí chybu', () => {
    const bad = eq();
    delete bad.hint;
    expect(() => make(bad)).toThrow(/e1.*hint/);
  });

  it('neznámy slot vyhodí chybu', () => {
    expect(() => make(shape({ solutions: [{ without: ['h9-9'] }] }))).toThrow(/s1.*h9-9/);
    expect(() => make(shape({ start: ['zz'] }))).toThrow(/s1.*zz/);
  });

  it('nepovolený znak v rovnici vyhodí chybu', () => {
    expect(() => make(eq({ start: '9+4=a' }))).toThrow(/e1/);
  });

  it('zlý tvar cieľa vyhodí chybu', () => {
    expect(() => make(shape({ goal: { shape: 'triangle', count: 1, noLoose: true } }))).toThrow(/s1/);
  });

  it('neplatný režim a moves < 1 vyhodia chybu', () => {
    expect(() => make(eq({ mode: 'jump' }))).toThrow(/e1/);
    expect(() => make(eq({ moves: 0 }))).toThrow(/e1/);
  });

  it('riešenie s {text, without, with} sa overí dekódovaním', () => {
    const ok = { text: '5+4=9', without: ['c0.b'], with: ['c4.a'] };
    expect(() => make(eq({ solutions: [{ ...ok, with: ['c4.d'] }] }))).toThrow(/e1/);
  });
});
