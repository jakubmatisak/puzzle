/**
 * Solver hrubou silou: nájde všetky pravdivé rovnice dosiahnuteľné k presunmi.
 */
import { decodeBoard, normalizeText } from './decode.js';
import { tokenize, evaluate } from './expression.js';

/** Všetky k-prvkové kombinácie poľa (k ≤ 2). */
function combinations(items, k) {
  if (k === 0) return [[]];
  if (k === 1) return items.map((x) => [x]);
  const out = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) out.push([items[i], items[j]]);
  }
  return out;
}

/** Je dek�dovan� text pravdiv� rovnica? */
function isTrue(text, types) {
  return evaluate(tokenize([...text].map((ch, i) => ({ type: types[i], ch }))));
}

/**
 * Vráti zoradené unikátne pravdivé texty (bez medzier) po presne `moves` presunoch.
 * @param {{kind:string, mode:string, moves:number, types:string[], board:object, start:Set<string>}} puzzle
 * @returns {string[]}
 */
export function solveEquation(puzzle) {
  const k = puzzle.moves;
  if (puzzle.mode !== 'move') throw new Error('Solver podporuje iba režim move');
  if (k > 2) throw new Error('Solver podporuje najviac 2 presuny');
  const filled = [...puzzle.start];
  const empty = puzzle.board.slots.map((s) => s.id).filter((id) => !puzzle.start.has(id));
  const found = new Set();
  for (const vacate of combinations(filled, k)) {
    for (const fill of combinations(empty, k)) {
      const occ = new Set(puzzle.start);
      vacate.forEach((id) => occ.delete(id));
      fill.forEach((id) => occ.add(id));
      const text = decodeBoard(puzzle.types, occ);
      if (text !== null && isTrue(text, puzzle.types)) found.add(normalizeText(text));
    }
  }
  return [...found].sort();
}
