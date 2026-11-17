import { describe, it, expect } from 'vitest';
import { isSolved, sameSet } from '../../js/core/validator.js';
import { solveEquation } from '../../js/core/solver.js';
import { createState, occupied, moveToSlot, moveToTray } from '../../js/core/puzzle-state.js';
import { buildBoard } from '../../js/core/board-model.js';
import { layoutEquation, encodeText } from '../../js/core/glyphs.js';
import { isTrueEquation } from '../../js/core/decode.js';
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

function gridPuzzle(moves, count, removed, without = []) {
  const slots = gridSlots(2, 2);
  const start = new Set(slots.map((s) => s.id).filter((id) => !without.includes(id)));
  return {
    id: 'log', kind: 'shapes', mode: 'remove', moves,
    board: buildBoard(slots), start,
    solutions: [new Set([...start].filter((id) => !removed.includes(id)))],
    boardDef: { type: 'grid', rows: 2, cols: 2 },
    goal: { shape: 'square', count, noLoose: true },
  };
}

const matchAt = (state, slot) => state.matches.find((m) => m.slot === slot).id;
const removeMatches = (state, ids) => ids.reduce(
  (acc, id) => moveToTray(acc, matchAt(acc, id), { x: 0, y: 0 }),
  state,
);

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

describe('isSolved - tray check (move mode)', () => {
  it('rejects a correct board when an extra match lies in the tray', () => {
    const puzzle = equationPuzzle('9+4=5', ['5+4=9']);
    const s = createState(puzzle);
    const solved = moveToSlot(s, matchAt(s, 'c0.b'), 'c4.b', puzzle.board);
    expect(isSolved(solved, puzzle)).toBe(true);
    const extra = { id: 'mx', slot: null, x: 0, y: 0, angle: 90 };
    expect(isSolved({ matches: [...solved.matches, extra] }, puzzle)).toBe(false);
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
  const removeAll = removeMatches;
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

describe('isSolved - semantic path without listed solution', () => {
  it('equation: unlisted true 8-4=4 is accepted when only 0+4=4 is listed', () => {
    const full = equationPuzzle('6+4=4', ['0+4=4', '8-4=4']);
    const puzzle = { ...full, solutions: [full.solutions[0]] };
    const target = encodeText('8-4=4', full.types);
    const [from] = [...puzzle.start].filter((id) => !target.has(id));
    const [to] = [...target].filter((id) => !puzzle.start.has(id));
    const s = createState(puzzle);
    expect(isSolved(moveToSlot(s, matchAt(s, from), to, puzzle.board), puzzle)).toBe(true);
  });
  it('shapes: unlisted symmetric removal giving 2 squares is accepted', () => {
    const p = gridPuzzle(2, 2, ['h1-0', 'v0-1']); // only this pair is listed
    expect(isSolved(removeMatches(createState(p), ['h1-1', 'v1-1']), p)).toBe(true);
  });
  it('shapes: right square count with a loose stick is rejected', () => {
    // keep one unit square plus loose h2-1 (5 sticks), remove the other 7
    const keep = ['h0-0', 'h1-0', 'v0-0', 'v0-1', 'h2-1'];
    const removed = gridSlots(2, 2).map((x) => x.id).filter((id) => !keep.includes(id));
    const p = { ...gridPuzzle(7, 1, removed), solutions: [] };
    expect(isSolved(removeMatches(createState(p), removed), p)).toBe(false);
    const clean = removed.concat('h2-1');
    const q = { ...gridPuzzle(8, 1, clean), solutions: [] };
    expect(isSolved(removeMatches(createState(q), clean), q)).toBe(true); // control
  });
  it('remove mode: a match placed outside start is rejected', () => {
    const p = { ...gridPuzzle(1, 2, ['h1-0', 'v0-1'], ['h2-1']), solutions: [] };
    let s = createState(p);
    s = moveToTray(s, matchAt(s, 'v0-1'), { x: 0, y: 0 });
    s = moveToSlot(s, matchAt(s, 'h1-0'), 'h2-1', p.board);
    expect([...occupied(s)].every((id) => p.start.has(id))).toBe(false);
    expect(isSolved(s, p)).toBe(false);
  });
});

describe('solveEquation', () => {
  const num03 = equationPuzzle('6+4=4', ['0+4=4', '8-4=4']);

  it('num-01 gives exactly 5+4=9', () => {
    expect(solveEquation(equationPuzzle('9+4=5', ['5+4=9']))).toEqual(['5+4=9']);
  });
  it('num-03 gives exactly these true texts (5+4=9 is a third, unlisted one)', () => {
    expect(solveEquation(num03)).toEqual(['0+4=4', '5+4=9', '8-4=4']);
  });
  it('every result is a true equation and differs from the start', () => {
    for (const text of solveEquation(num03)) {
      expect(isTrueEquation(num03.types, encodeText(text, num03.types))).toBe(true);
      expect(text).not.toBe('6+4=4');
    }
  });
  it('blank cells: VII+I=VIII appears once, without spaces', () => {
    const rom = equationPuzzle('VIII+I=VII ', ['VII +I=VIII']);
    expect(solveEquation(rom)).toEqual(['VII+I=VIII']);
  });
  it('moves = 2 on num-01 does not contain the 1-move result', () => {
    const r = solveEquation(equationPuzzle('9+4=5', ['5+4=9'], 2));
    expect(r).not.toContain('5+4=9');
    expect(r).toEqual(['2+4=6', '4+4=8', '8+1=9', '9+4>5']);
  });
  it('throws for remove mode and for more than 2 moves', () => {
    expect(() => solveEquation({ ...num03, mode: 'remove' })).toThrow();
    expect(() => solveEquation({ ...num03, moves: 3 })).toThrow();
  });
});

describe('sameSet', () => {
  it('porovná množiny bez ohľadu na poradie', () => {
    expect(sameSet(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true);
    expect(sameSet(new Set(['a']), new Set(['a', 'b']))).toBe(false);
    expect(sameSet(new Set(['a', 'c']), new Set(['a', 'b']))).toBe(false);
  });
});
