/**
 * Nemenný stav úlohy: zápalky na doske. Každá funkcia vracia nový stav.
 * Zápalka = {id, slot, x, y, angle}; slot je null, ak leží mimo slotu.
 */
import { rotateStep, findSnapSlot } from './geometry.js';

export { trayPosition } from './board-model.js';

/**
 * Počiatočný stav: zápalky m0, m1, … na slotoch štartu (v poradí slotov dosky).
 * @param {{board:object, start:Set<string>}} puzzle
 * @returns {{matches:object[]}}
 */
export function createState(puzzle) {
  const matches = puzzle.board.slots
    .filter((s) => puzzle.start.has(s.id))
    .map((s, i) => ({ id: `m${i}`, slot: s.id, x: s.x, y: s.y, angle: s.angle }));
  return { matches };
}

/**
 * Množina id obsadených slotov.
 * @param {{matches:object[]}} state
 * @returns {Set<string>}
 */
export function occupied(state) {
  return new Set(state.matches.filter((m) => m.slot !== null).map((m) => m.slot));
}

/**
 * Zápalky mimo slotov (v odkladacej ploche alebo voľne na doske).
 * @param {{matches:object[]}} state
 * @returns {object[]}
 */
export function trayMatches(state) {
  return state.matches.filter((m) => m.slot === null);
}

/**
 * Vráti nový stav, v ktorom je zápalka matchId nahradená výsledkom update(match).
 * @param {{matches:object[]}} state
 * @param {string} matchId
 * @param {(m:object)=>object} update
 * @returns {{matches:object[]}}
 */
function updateMatch(state, matchId, update) {
  if (!state.matches.some((m) => m.id === matchId)) throw new Error(`Neznáma zápalka ${matchId}`);
  return { matches: state.matches.map((m) => (m.id === matchId ? update(m) : { ...m })) };
}

/**
 * Presunie zápalku do slotu (uhol aj pozícia podľa slotu).
 * Hádže chybu, ak je slot neznámy alebo obsadený inou zápalkou.
 * @param {{matches:object[]}} state
 * @param {string} matchId
 * @param {string} slotId
 * @param {{slotById:Map<string,object>}} board doska (kvôli súradniciam slotu)
 * @returns {{matches:object[]}}
 */
export function moveToSlot(state, matchId, slotId, board) {
  const slot = board.slotById.get(slotId);
  if (!slot) throw new Error(`Neznámy slot ${slotId}`);
  const taken = state.matches.some((m) => m.slot === slotId && m.id !== matchId);
  if (taken) throw new Error(`Slot ${slotId} je obsadený`);
  return updateMatch(state, matchId, (m) => ({
    ...m, slot: slotId, x: slot.x, y: slot.y, angle: slot.angle,
  }));
}

/**
 * Položí zápalku mimo slotu na dané súradnice (uhol 90).
 * @param {{matches:object[]}} state
 * @param {string} matchId
 * @param {{x:number,y:number}} pos
 * @returns {{matches:object[]}}
 */
export function moveToTray(state, matchId, pos) {
  return updateMatch(state, matchId, (m) => ({
    ...m, slot: null, x: pos.x, y: pos.y, angle: 90,
  }));
}

/**
 * Otočí zápalku o krok (rotateStep). Zápalka sa vždy uvoľní zo svojho slotu
 * a skúsi sa prichytiť do iného voľného slotu v dosahu (pôvodný slot sa
 * nepočíta). Zápalka v slote tak má vždy presne uhol slotu.
 * @param {{matches:object[]}} state
 * @param {string} matchId
 * @param {{slots:object[]}} board
 * @returns {{matches:object[]}}
 */
export function rotateMatch(state, matchId, board) {
  return updateMatch(state, matchId, (m) => {
    const angle = rotateStep(m.angle);
    const taken = occupied(state);
    if (m.slot !== null) taken.add(m.slot); // pôvodný slot vylúčený
    const snap = findSnapSlot({ x: m.x, y: m.y, angle }, board.slots, taken);
    if (snap) return { ...m, slot: snap.id, x: snap.x, y: snap.y, angle: snap.angle };
    return { ...m, slot: null, angle };
  });
}

/**
 * Počet použitých ťahov = koľko slotov štartu je už uvoľnených.
 * @param {{matches:object[]}} state
 * @param {{start:Set<string>}} puzzle
 * @returns {number}
 */
export function movesUsed(state, puzzle) {
  const occ = occupied(state);
  return [...puzzle.start].filter((id) => !occ.has(id)).length;
}

/**
 * Obnoví východiskový stav úlohy.
 * @param {object} puzzle
 * @returns {{matches:object[]}}
 */
export function resetState(puzzle) {
  return createState(puzzle);
}

/**
 * Plán riešenia: páry (zápalka z uvoľneného slotu -> nový slot alebo 'tray').
 * @param {{start:Set<string>, solutions:Set<string>[], mode:string}} puzzle
 * @param {number} solutionIndex
 * @returns {{from:string, to:string}[]}
 */
export function solutionPlan(puzzle, solutionIndex) {
  const sol = puzzle.solutions[solutionIndex];
  const from = [...puzzle.start].filter((id) => !sol.has(id)).sort((a, b) => a.localeCompare(b));
  const to = [...sol].filter((id) => !puzzle.start.has(id)).sort((a, b) => a.localeCompare(b));
  return from.map((id, i) => ({ from: id, to: puzzle.mode === 'remove' ? 'tray' : to[i] }));
}
