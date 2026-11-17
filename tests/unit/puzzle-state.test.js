import { describe, it, expect } from 'vitest';
import {
  createState, occupied, trayMatches, moveToSlot, moveToTray, rotateMatch,
  movesUsed, resetState, solutionPlan,
} from '../../js/core/puzzle-state.js';
import { buildBoard } from '../../js/core/board-model.js';
import { layoutEquation, encodeText } from '../../js/core/glyphs.js';
import { gridSlots } from '../../js/core/lattice.js';

function equationPuzzle(start, sols) {
  const { types, slots } = layoutEquation([start, ...sols]);
  return {
    board: buildBoard(slots),
    start: encodeText(start, types),
    solutions: sols.map((s) => encodeText(s, types)),
    mode: 'move',
    moves: 1,
  };
}

function logPuzzle() {
  const slots = gridSlots(2, 2);
  const all = new Set(slots.map((s) => s.id));
  const sol = new Set(all);
  sol.delete('h1-0');
  sol.delete('v0-1');
  return { board: buildBoard(slots), start: all, solutions: [sol], mode: 'remove', moves: 2 };
}

const num = () => equationPuzzle('9+4=5', ['5+4=9']);

describe('createState', () => {
  it('num-01 má 19 zápaliek m0.. na slotoch štartu', () => {
    const p = num();
    const s = createState(p);
    expect(s.matches.length).toBe(19);
    expect(s.matches[0].id).toBe('m0');
    for (const m of s.matches) {
      const slot = p.board.slotById.get(m.slot);
      expect([m.x, m.y, m.angle]).toEqual([slot.x, slot.y, slot.angle]);
    }
    expect(occupied(s)).toEqual(p.start);
    expect(trayMatches(s)).toEqual([]);
  });
});

describe('moveToSlot', () => {
  it('presun c0.b -> c4.b: movesUsed 1, pôvodný stav nezmenený', () => {
    const p = num();
    const s = createState(p);
    const before = structuredClone(s);
    const id = s.matches.find((m) => m.slot === 'c0.b').id;
    const t = moveToSlot(s, id, 'c4.b', p.board);
    expect(s).toEqual(before);
    expect(occupied(t).has('c4.b')).toBe(true);
    expect(occupied(t).has('c0.b')).toBe(false);
    expect(movesUsed(t, p)).toBe(1);
    expect(movesUsed(s, p)).toBe(0);
    const m = t.matches.find((x) => x.id === id);
    expect([m.x, m.y, m.angle]).toEqual([
      p.board.slotById.get('c4.b').x, p.board.slotById.get('c4.b').y, 90,
    ]);
  });
  it('hádže pri obsadenom alebo neznámom slote', () => {
    const p = num();
    const s = createState(p);
    expect(() => moveToSlot(s, 'm0', 'c0.b', p.board)).toThrow();
    expect(() => moveToSlot(s, 'm0', 'nic', p.board)).toThrow();
  });
});

describe('moveToTray', () => {
  it('uvoľní slot, uhol 90', () => {
    const p = num();
    const s = createState(p);
    const t = moveToTray(s, 'm0', { x: 5, y: 7 });
    const m = t.matches[0];
    expect([m.slot, m.x, m.y, m.angle]).toEqual([null, 5, 7, 90]);
    expect(trayMatches(t).length).toBe(1);
    expect(s.matches[0].slot).not.toBe(null);
    expect(movesUsed(t, p)).toBe(1);
  });
});

describe('rotateMatch', () => {
  it('c1.h 0° -> 45° sa prichytí do c1.x1', () => {
    const p = num();
    const s = createState(p);
    const id = s.matches.find((m) => m.slot === 'c1.h').id;
    const t = rotateMatch(s, id, p.board);
    const m = t.matches.find((x) => x.id === id);
    expect(m.angle).toBe(45);
    expect(m.slot).toBe('c1.x1');
    expect(s.matches.find((x) => x.id === id).angle).toBe(0);
  });
  it('bez voľného slotu sa zápalka uvoľní na rovnakých súradniciach', () => {
    const p = equationPuzzle('9+4=5', ['5+4=9']);
    const s = createState(p);
    const id = s.matches.find((m) => m.slot === 'c0.a').id;
    const before = s.matches.find((m) => m.id === id);
    const t = rotateMatch(s, id, p.board);
    const m = t.matches.find((x) => x.id === id);
    expect(m.angle).toBe(45);
    expect(m.slot).toBe(null);
    expect([m.x, m.y]).toEqual([before.x, before.y]);
  });
  it('zápalka mimo slotu sa len otočí (90 -> 135)', () => {
    const p = num();
    let s = createState(p);
    s = moveToTray(s, 'm0', { x: 0, y: 0 });
    const t = rotateMatch(s, 'm0', p.board);
    expect(t.matches[0].angle).toBe(135);
    expect(t.matches[0].slot).toBe(null);
  });
});

describe('resetState a movesUsed', () => {
  it('reset = nový štart', () => {
    const p = num();
    const s = moveToSlot(createState(p), 'm0', 'c4.b', p.board);
    expect(movesUsed(s, p)).toBe(1);
    const r = resetState(p);
    expect(r).toEqual(createState(p));
    expect(movesUsed(r, p)).toBe(0);
  });
});

describe('solutionPlan', () => {
  it('num-01', () => {
    expect(solutionPlan(num(), 0)).toEqual([{ from: 'c0.b', to: 'c4.b' }]);
  });
  it('log-01 remove -> tray', () => {
    expect(solutionPlan(logPuzzle(), 0)).toEqual([
      { from: 'h1-0', to: 'tray' },
      { from: 'v0-1', to: 'tray' },
    ]);
  });
});

describe('rotateMatch (R7: vždy uvoľní slot)', () => {
  const romanBoard = () => {
    const { types, slots } = layoutEquation(['V']);
    return { board: buildBoard(slots), start: encodeText('V', types), solutions: [], mode: 'move', moves: 1 };
  };
  it('vl 75° -> 90° sa prichytí do c0.i', () => {
    const p = romanBoard();
    const s = createState(p);
    const id = s.matches.find((m) => m.slot === 'c0.vl').id;
    const m = rotateMatch(s, id, p.board).matches.find((x) => x.id === id);
    expect([m.slot, m.angle]).toEqual(['c0.i', 90]);
  });
  it('ak sú všetky blízke sloty obsadené, ostane voľná s uhlom 90', () => {
    const p = romanBoard();
    const at = (id, slot) => {
      const sl = p.board.slotById.get(slot);
      return { id, slot, x: sl.x, y: sl.y, angle: sl.angle };
    };
    const s = { matches: [at('a', 'c0.vl'), at('b', 'c0.vr'), at('c', 'c0.i'), at('d', 'c0.xa'), at('e', 'c0.xb')] };
    const m = rotateMatch(s, 'a', p.board).matches[0];
    expect([m.slot, m.angle, m.x, m.y]).toEqual([null, 90, 21, 100]);
  });
  it('invariant: zápalka v slote má vždy uhol slotu', () => {
    const p = num();
    let s = createState(p);
    for (let round = 0; round < 3; round++) {
      for (const m of createState(p).matches) s = rotateMatch(s, m.id, p.board);
    }
    for (const m of s.matches) {
      if (m.slot !== null) expect(m.angle).toBe(p.board.slotById.get(m.slot).angle);
    }
  });
  it('nemení pôvodný stav a hádže pri neznámom id', () => {
    const p = num();
    const s = createState(p);
    const before = structuredClone(s);
    rotateMatch(s, 'm1', p.board);
    moveToTray(s, 'm1', { x: 1, y: 2 });
    expect(s).toEqual(before);
    expect(() => rotateMatch(s, 'nope', p.board)).toThrow();
  });
});

describe('rímske X sa dá poskladať otáčaním', () => {
  const board = buildBoard(layoutEquation(['X']).slots);

  it('zvislá zápalka v slote I sa otočením (135°) prichytí do xb', () => {
    const s = { matches: [{ id: 'm0', slot: 'c0.i', x: 34, y: 100, angle: 90 }] };
    const t = rotateMatch(s, 'm0', board);
    expect(t.matches[0].slot).toBe('c0.xb');
  });

  it('zápalka otočená na 45° sa prichytí do xa', () => {
    const s = { matches: [{ id: 'm0', slot: null, x: 34, y: 100, angle: 0 }] };
    const t = rotateMatch(s, 'm0', board);
    expect(t.matches[0].slot).toBe('c0.xa');
  });
});
