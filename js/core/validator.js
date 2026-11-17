/**
 * Validátor: rozhodne, či aktuálna doska rieši úlohu.
 */
import { occupied, trayMatches, movesUsed } from './puzzle-state.js';
import { isTrueEquation } from './decode.js';
import { checkShapes } from './lattice.js';

/**
 * Rovnosť dvoch množín (rovnaké prvky, poradie nehrá rolu).
 * @param {Set<string>} a
 * @param {Set<string>} b
 * @returns {boolean}
 */
export function sameSet(a, b) {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/** Je množina obsadených slotov medzi uvedenými riešeniami? */
function isListedSolution(occ, puzzle) {
  return puzzle.solutions.some((s) => sameSet(occ, s));
}

/** Spĺňa množina obsadených slotov cieľ úlohy (rovnica / útvary)? */
function meetsGoal(occ, puzzle) {
  if (puzzle.kind === 'equation') return isTrueEquation(puzzle.types, occ);
  if (puzzle.kind === 'shapes') return checkShapes(occ, puzzle.boardDef, puzzle.goal);
  return false;
}

/**
 * Je úloha vyriešená? V režime 'move' musia byť všetky zápalky v slotoch a
 * presne `moves` ťahov; v režime 'remove' sa len odoberajú zápalky zo štartu.
 * @param {{matches:object[]}} state
 * @param {object} puzzle normalizovaná úloha
 * @returns {boolean}
 */
export function isSolved(state, puzzle) {
  const occ = occupied(state);
  if (puzzle.mode === 'move') {
    if (trayMatches(state).length > 0) return false;
    if (movesUsed(state, puzzle) !== puzzle.moves) return false;
  } else {
    if (![...occ].every((id) => puzzle.start.has(id))) return false;
    if (puzzle.start.size - occ.size !== puzzle.moves) return false;
  }
  return isListedSolution(occ, puzzle) || meetsGoal(occ, puzzle);
}
