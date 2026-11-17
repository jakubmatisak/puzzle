import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizePuzzles } from '../../js/core/puzzles.js';
import { solveEquation } from '../../js/core/solver.js';
import { isSolved } from '../../js/core/validator.js';
import { normalizeText } from '../../js/core/decode.js';
import { angleDiff } from '../../js/core/geometry.js';
import {
  createState, moveToSlot, moveToTray, trayPosition, solutionPlan, occupied,
} from '../../js/core/puzzle-state.js';

const json = JSON.parse(readFileSync(new URL('../../data/puzzles.json', import.meta.url), 'utf8'));
const { categories, puzzles } = normalizePuzzles(json);

/** Aplikuje plán riešenia `index` na počiatočný stav. */
function applyPlan(puzzle, index) {
  let state = createState(puzzle);
  const byslot = (slot) => state.matches.find((m) => m.slot === slot).id;
  solutionPlan(puzzle, index).forEach(({ from, to }, k) => {
    const id = byslot(from);
    state = to === 'tray'
      ? moveToTray(state, id, trayPosition(puzzle.board, k))
      : moveToSlot(state, id, to, puzzle.board);
  });
  return state;
}

describe('data/puzzles.json', () => {
  it('má každú kategóriu aspoň 5 úloh', () => {
    for (const c of categories) {
      expect(puzzles.filter((p) => p.category === c.id).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('kategórie majú popis a názov v oboch jazykoch', () => {
    for (const c of categories) {
      for (const f of ['name', 'description']) {
        expect(c[f].sk.trim()).not.toBe('');
        expect(c[f].en.trim()).not.toBe('');
      }
    }
  });

  it('každá úloha má neprázdne task a hint (sk/en)', () => {
    for (const p of puzzles) {
      for (const f of ['task', 'hint']) {
        expect(p[f].sk.trim(), p.id).not.toBe('');
        expect(p[f].en.trim(), p.id).not.toBe('');
      }
    }
  });

  it('aspoň jedna úloha má viac riešení', () => {
    expect(puzzles.some((p) => p.solutions.length >= 2)).toBe(true);
  });

  it('štart nie je vyriešený', () => {
    for (const p of puzzles) expect(isSolved(createState(p), p), p.id).toBe(false);
  });

  it('každé riešenie po aplikovaní plánu je vyriešené', () => {
    for (const p of puzzles) {
      p.solutions.forEach((_, i) => {
        expect(isSolved(applyPlan(p, i), p), `${p.id} #${i}`).toBe(true);
      });
    }
  });

  it('riešenie z plánu zodpovedá množine slotov riešenia', () => {
    for (const p of puzzles) {
      p.solutions.forEach((sol, i) => {
        expect([...occupied(applyPlan(p, i))].sort(), p.id).toEqual([...sol].sort());
      });
    }
  });

  it('rovnice: solver sa zhoduje so zoznamom riešení', () => {
    for (const p of puzzles.filter((x) => x.kind === 'equation')) {
      const listed = new Set(p.solutionTexts.map(normalizeText));
      expect(listed.size, `${p.id} duplicity`).toBe(p.solutionTexts.length);
      expect([...listed].sort(), p.id).toEqual(solveEquation(p));
    }
  });

  it('aspoň jedna úloha vyžaduje rotáciu zápalky', () => {
    const rotates = puzzles.some((p) => p.solutions.some((_, i) => solutionPlan(p, i).some(
      ({ from, to }) => to !== 'tray'
        && angleDiff(p.board.slotById.get(from).angle, p.board.slotById.get(to).angle) > 23,
    )));
    expect(rotates).toBe(true);
  });

  it('aspoň jedno riešenie skladá + z dvoch zápaliek cez seba', () => {
    const stacks = puzzles.some((p) => p.kind === 'equation' && p.solutionTexts.some(
      (text) => [...text].some((ch, i) => ch === '+' && json.puzzles.find((r) => r.id === p.id).start[i] !== '+'),
    ));
    expect(stacks).toBe(true);
  });
});
