import { describe, it, expect } from 'vitest';
import { isSolved } from '../../js/core/validator.js';
import { solveEquation } from '../../js/core/solver.js';
import { createState, moveToSlot, moveToTray } from '../../js/core/puzzle-state.js';
import { buildBoard } from '../../js/core/board-model.js';
import { layoutEquation, encodeText } from '../../js/core/glyphs.js';
import { gridSlots } from '../../js/core/lattice.js';

function equationPuzzle(start, sols, moves = 1) {
  const { types, slots } = layoutEquation([start, ...sols]);
  return {
    id: 'x', kind: 'equation', mode: 'move', moves, types,
    board: buildBoard(slots),
    start: encodeText(start, types),
    solutions: sols.map((s) => encodeText(s, types)),
  };
}

function gridPuzzle(moves, count, removed) {
  const slots = gridSlots(2, 2);
  const start = new Set(slots.map((s) => s.id));
  return {
    id: 'log', kind: 'shapes', mode: 'remove', moves,
    board: buildBoard(slots), start,
    solutions: [new Set([...start].filter((id) => !removed.includes(id)))],
    boardDef: { type: 'grid', rows: 2, cols: 2 },
    goal: { shape: 'square', count, noLoose: true },
  };
}

const matchAt = (state, slot) => state.matches.find((m) => m.slot === slot).id;

describe('isSolved - move', () => {
  const puzzle = equationPuzzle('9+4=5', ['5+4=9']);

  it('start is not a solution', () => {
    expect(isSolved(createState(puzzle), puzzle)).toBe(false);
  });
  it('correct move c0.b -> c4.b solves', () => {
    const s = createState(puzzle);
    expect(isSolved(moveToSlot(s, matchAt(s, 'c0.b'), 'c4.b', puzzle.board), puzzle)).toBe(true);
  });
  it('move to another slot does not solve', () => {
    const s = createState(puzzle);
    expect(isSolved(moveToSlot(s, matchAt(s, 'c0.b'), 'c4.e', puzzle.board), puzzle)).toBe(false);
  });
  it('match left in tray -> false', () => {
    const s = createState(puzzle);
    const t = moveToTray(s, matchAt(s, 'c0.b'), { x: 0, y: 0 });
    expect(isSolved(t, puzzle)).toBe(false);
  });
});

describe('isSolved - two moves', () => {
  // 6+4=4 -> 8+1=9 needs exactly two moves
  const p = equationPuzzle('6+4=4', ['8+1=9'], 2);
  const target = p.solutions[0];
  const vacate = [...p.start].filter((id) => !target.has(id));
  const fill = [...target].filter((id) => !p.start.has(id));
  let s = createState(p);
  vacate.forEach((id, i) => { s = moveToSlot(s, matchAt(s, id), fill[i], p.board); });

  it('accepted only when puzzle.moves is 2', () => {
    expect(vacate.length).toBe(2);
    expect(isSolved(s, p)).toBe(true);
    expect(isSolved(s, { ...p, moves: 1 })).toBe(false); // true equation, wrong move count
  });
  it('one move does not satisfy moves = 2', () => {
    const one = equationPuzzle('9+4=5', ['5+4=9'], 2);
    const st = createState(one);
    expect(isSolved(moveToSlot(st, matchAt(st, 'c0.b'), 'c4.b', one.board), one)).toBe(false);
  });
});

describe('isSolved - remove', () => {
  const removeAll = (state, ids) => ids.reduce(
    (acc, id) => moveToTray(acc, matchAt(acc, id), { x: 0, y: 0 }),
    state,
  );
  const p = gridPuzzle(2, 2, ['h1-0', 'v0-1']);

  it('removing h1-0 and v0-1 solves', () => {
    expect(isSolved(removeAll(createState(p), ['h1-0', 'v0-1']), p)).toBe(true);
  });
  it('removing three does not solve', () => {
    expect(isSolved(removeAll(createState(p), ['h1-0', 'v0-1', 'h0-0']), p)).toBe(false);
  });
  it('start does not solve', () => {
    expect(isSolved(createState(p), p)).toBe(false);
  });
});

describe('solveEquation', () => {
  const num03 = equationPuzzle('6+4=4', ['0+4=4', '8-4=4']);

  it('num-03 contains 0+4=4 and 8-4=4', () => {
    const r = solveEquation(num03);
    expect(r).toContain('0+4=4');
    expect(r).toContain('8-4=4');
  });
  it('num-01 contains 5+4=9', () => {
    expect(solveEquation(equationPuzzle('9+4=5', ['5+4=9']))).toContain('5+4=9');
  });
  it('result is sorted and unique', () => {
    const r = solveEquation(num03);
    expect(r).toEqual([...new Set(r)].sort());
  });
  it('throws for remove mode and for more than 2 moves', () => {
    expect(() => solveEquation({ ...num03, mode: 'remove' })).toThrow();
    expect(() => solveEquation({ ...num03, moves: 3 })).toThrow();
  });
});
