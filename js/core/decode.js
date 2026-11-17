import { ENCODE } from './glyphs.js';
import { tokenize, evaluate } from './expression.js';

/** Alternatívne zápisy číslic (okrem kanonických z ENCODE). */
const DIGIT_ALTERNATES = {
  1: ['e', 'f'],
  7: ['a', 'b', 'c', 'f'],
  9: ['a', 'b', 'c', 'f', 'g'],
  6: ['c', 'd', 'e', 'f', 'g'],
};

/** Kľúč množiny slotov: zoradené mená spojené čiarkou. */
function setKey(names) {
  return [...names].sort().join(',');
}

/** Tabuľka kľúč -> znak pre každý typ bunky. */
const LOOKUP = {};
for (const type of Object.keys(ENCODE)) {
  LOOKUP[type] = new Map();
  for (const [ch, names] of Object.entries(ENCODE[type])) {
    LOOKUP[type].set(setKey(names), ch);
  }
}
for (const [ch, names] of Object.entries(DIGIT_ALTERNATES)) {
  LOOKUP.digit.set(setKey(names), ch);
}

/**
 * Dekóduje jednu bunku podľa obsadených lokálnych slotov.
 * @param {string} type typ bunky (digit/op/rel/roman)
 * @param {Set<string>} names mená obsadených slotov, napr. {'b','c'}
 * @returns {string|null} znak, '' pre prázdnu bunku, null pre neplatnú kombináciu
 */
export function decodeCell(type, names) {
  if (names.size === 0) return '';
  return LOOKUP[type]?.get(setKey(names)) ?? null;
}

/**
 * Dekóduje celú dosku do textu; prázdna bunka je medzera.
 * @param {string[]} types typy buniek zľava doprava
 * @param {Set<string>} occupied obsadené sloty, id tvaru `c{i}.{meno}`
 * @returns {string|null} text (dĺžka = types.length) alebo null ak je niektorá bunka neplatná
 */
export function decodeBoard(types, occupied) {
  const perCell = types.map(() => new Set());
  for (const id of occupied) {
    const dot = id.indexOf('.');
    const index = Number(id.slice(1, dot));
    if (perCell[index]) perCell[index].add(id.slice(dot + 1));
  }
  let text = '';
  for (let i = 0; i < types.length; i++) {
    const ch = decodeCell(types[i], perCell[i]);
    if (ch === null) return null;
    text += ch === '' ? ' ' : ch;
  }
  return text;
}

/**
 * Zistí, či obsadené sloty tvoria pravdivú rovnicu. Nikdy nevyhodí chybu.
 * @param {string[]} types typy buniek
 * @param {Set<string>} occupied obsadené sloty
 * @returns {boolean}
 */
export function isTrueEquation(types, occupied) {
  const text = decodeBoard(types, occupied);
  return text !== null && isTrueText(text, types);
}

/**
 * Je už dekódovaný text pravdivá rovnica? Nikdy nevyhodí chybu.
 * @param {string} text text z decodeBoard (medzera = prázdna bunka)
 * @param {string[]} types typy buniek
 * @returns {boolean}
 */
export function isTrueText(text, types) {
  const cells = [...text].map((ch, i) => ({ type: types[i], ch }));
  return evaluate(tokenize(cells));
}

/**
 * Normalizuje text rovnice: odstráni medzery (prázdne bunky).
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  return text.replace(/ /g, '');
}
