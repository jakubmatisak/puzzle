import { describe, it, expect } from 'vitest';
import { solveEquation } from '../../js/core/solver.js';
import { buildBoard } from '../../js/core/board-model.js';
import { layoutEquation, encodeText } from '../../js/core/glyphs.js';

function equationPuzzle(start, others) {
  const { types, slots } = layoutEquation([start, ...others]);
  return {
    kind: 'equation', mode: 'move', moves: 1, types,
    board: buildBoard(slots), start: encodeText(start, types),
  };
}

describe('solveEquation canonicalOnly', () => {
  const p = equationPuzzle('6+4=4', ['0+4=4', '8-4=4']);
  it('predvolene vráti aj varianty číslic', () => {
    expect(solveEquation(p)).toEqual(['0+4=4', '5+4=9', '8-4=4']);
  });
  it('canonicalOnly vynechá nekanonické zápisy', () => {
    expect(solveEquation(p, { canonicalOnly: true })).toEqual(['0+4=4', '8-4=4']);
  });
});
