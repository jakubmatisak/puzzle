/**
 * Načítanie a kontrola úloh z data/puzzles.json. Z JSON-u vyrobí normalizované
 * úlohy (sety slotov, doska, typy buniek), s ktorými pracuje validátor a solver.
 */
import { layoutEquation, encodeText } from './glyphs.js';
import { decodeBoard } from './decode.js';
import { gridSlots, triSlots } from './lattice.js';
import { buildBoard } from './board-model.js';

const REQUIRED = ['id', 'category', 'mode', 'moves', 'start', 'solutions', 'task', 'hint'];
const EQUATION_CHARS = /^[0-9+\-×=<> IVX]+$/;

/** Chyba schémy; správa vždy obsahuje ID úlohy. */
function fail(id, message) {
  return new Error(`Úloha ${id}: ${message}`);
}

/** Má objekt neprázdne texty sk aj en? */
function hasTexts(obj) {
  return Boolean(obj) && typeof obj.sk === 'string' && typeof obj.en === 'string'
    && obj.sk.trim() !== '' && obj.en.trim() !== '';
}

/** Skontroluje povinné polia, režim, počet ťahov a texty. */
function checkCommon(raw, label) {
  for (const field of REQUIRED) {
    if (raw[field] === undefined || raw[field] === null) throw fail(label, `chýba pole '${field}'`);
  }
  if (!['move', 'remove'].includes(raw.mode)) throw fail(label, `neplatný režim '${raw.mode}'`);
  if (!Number.isInteger(raw.moves) || raw.moves < 1) throw fail(label, 'moves musí byť celé číslo >= 1');
  if (!hasTexts(raw.task)) throw fail(label, 'task musí mať neprázdne sk a en');
  if (!hasTexts(raw.hint)) throw fail(label, 'hint musí mať neprázdne sk a en');
  if (!Array.isArray(raw.solutions) || raw.solutions.length === 0) {
    throw fail(label, 'solutions musí byť neprázdne pole');
  }
}

/** Skontroluje, že reťazec rovnice obsahuje len povolené znaky. */
function checkEquationText(text, label) {
  if (typeof text !== 'string' || !EQUATION_CHARS.test(text)) {
    throw fail(label, `rovnica '${text}' obsahuje nepovolený znak`);
  }
}

/** Text riešenia: reťazec, alebo objekt {text, without, with}. */
function solutionText(entry) {
  return typeof entry === 'string' ? entry : entry?.text;
}

/**
 * Množina slotov riešenia rovnice. Objekt {text, without, with} popisuje
 * netypický zápis znaku (napr. deviatka bez spodnej zápalky) ako štart
 * bez `without` a s pridanými `with`; jeho text sa overí dekódovaním.
 */
function equationSolution(entry, start, layout, label) {
  if (typeof entry === 'string') return encodeText(entry, layout.types);
  const set = new Set([...start].filter((id) => !entry.without.includes(id)));
  entry.with.forEach((id) => set.add(id));
  const decoded = decodeBoard(layout.types, set);
  if (decoded === null || decoded.replace(/ /g, '') !== entry.text.replace(/ /g, '')) {
    throw fail(label, `sloty riešenia '${entry.text}' sa nedekódujú na jeho text`);
  }
  return set;
}

/** Zostaví úlohu typu rovnica (doska z rozloženia všetkých textov). */
function buildEquation(raw, base) {
  const solTexts = raw.solutions.map(solutionText);
  const texts = [raw.start, ...solTexts];
  texts.forEach((t) => checkEquationText(t, raw.id));
  if (texts.some((t) => t.length !== raw.start.length)) {
    throw fail(raw.id, 'štart a riešenia musia mať rovnakú dĺžku');
  }
  const layout = layoutEquation(texts);
  const start = encodeText(raw.start, layout.types);
  return {
    ...base,
    board: buildBoard(layout.slots),
    types: layout.types,
    start,
    solutions: raw.solutions.map((e) => equationSolution(e, start, layout, raw.id)),
    solutionTexts: solTexts,
  };
}

/** Sloty mriežky podľa definície dosky; neplatný typ vyhodí chybu. */
function boardSlots(def, id) {
  if (def?.type === 'grid') return gridSlots(def.rows, def.cols);
  if (def?.type === 'trigrid') return triSlots(def.n);
  throw fail(id, 'neplatná definícia dosky (board)');
}

/** Overí, že všetky ID slotov existujú na doske. */
function checkSlotIds(ids, board, id) {
  for (const slotId of ids) {
    if (!board.slotById.has(slotId)) throw fail(id, `neznámy slot '${slotId}'`);
  }
}

/** Jedno riešenie tvarov: pole slotov, alebo {without:[…]} = štart bez týchto slotov. */
function shapeSolution(entry, start, id) {
  if (Array.isArray(entry)) return new Set(entry);
  if (entry && Array.isArray(entry.without)) {
    const unknown = entry.without.find((s) => !start.has(s));
    if (unknown) throw fail(id, `neznámy slot '${unknown}' v without`);
    return new Set([...start].filter((s) => !entry.without.includes(s)));
  }
  throw fail(id, 'riešenie musí byť pole slotov alebo {without:[…]}');
}

/** Zostaví úlohu typu tvary (zápalky na mriežke). */
function buildShapes(raw, base) {
  if (!raw.board || !raw.goal) throw fail(raw.id, "chýba pole 'board' alebo 'goal'");
  const board = buildBoard(boardSlots(raw.board, raw.id));
  const wanted = raw.board.type === 'grid' ? 'square' : 'triangle';
  if (raw.goal.shape !== wanted) throw fail(raw.id, `goal.shape musí byť '${wanted}' pre túto dosku`);
  const startIds = raw.start === 'all' ? board.slots.map((s) => s.id) : raw.start;
  if (!Array.isArray(startIds)) throw fail(raw.id, "start musí byť 'all' alebo pole slotov");
  checkSlotIds(startIds, board, raw.id);
  const start = new Set(startIds);
  const solutions = raw.solutions.map((e) => shapeSolution(e, start, raw.id));
  solutions.forEach((s) => checkSlotIds(s, board, raw.id));
  return { ...base, board, boardDef: raw.board, goal: raw.goal, start, solutions };
}

/** Vyrobí normalizovanú úlohu zo surového záznamu. */
function normalizeOne(raw, index, categories, seen) {
  const label = raw.id ?? `#${index}`;
  checkCommon(raw, label);
  if (seen.has(raw.id)) throw fail(raw.id, 'duplicitné ID');
  const category = categories.get(raw.category);
  if (!category) throw fail(raw.id, `neznáma kategória '${raw.category}'`);
  const base = {
    id: raw.id, category: raw.category, kind: category.kind, mode: raw.mode,
    moves: raw.moves, task: raw.task, hint: raw.hint,
  };
  return category.kind === 'equation' ? buildEquation(raw, base) : buildShapes(raw, base);
}

/**
 * Skontroluje JSON úloh a vráti normalizované úlohy. Pri chybe schémy
 * vyhodí Error, ktorého správa obsahuje ID úlohy.
 * @param {{categories:object[], puzzles:object[]}} json obsah puzzles.json
 * @returns {{categories:object[], puzzles:object[]}}
 */
export function normalizePuzzles(json) {
  if (!Array.isArray(json?.categories) || !Array.isArray(json?.puzzles)) {
    throw new Error('puzzles.json: chýba categories alebo puzzles');
  }
  const categories = new Map(json.categories.map((c) => [c.id, c]));
  const seen = new Set();
  const puzzles = json.puzzles.map((raw, i) => {
    const puzzle = normalizeOne(raw, i, categories, seen);
    seen.add(puzzle.id);
    return puzzle;
  });
  return { categories: json.categories, puzzles };
}

/**
 * Stiahne puzzles.json a normalizuje ho.
 * @param {string} [url] cesta k súboru (relatívna)
 * @returns {Promise<{categories:object[], puzzles:object[]}>}
 */
export async function loadPuzzles(url = './data/puzzles.json') {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Načítanie úloh zlyhalo: HTTP ${response.status}`);
  return normalizePuzzles(await response.json());
}
