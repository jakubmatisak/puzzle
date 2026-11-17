import { romanToInt } from './roman.js';

const RELATIONS = ['=', '<', '>'];
const OPERATORS = ['+', '-', '×'];

/**
 * Zloží súvislé bunky rovnakého typu (digit/roman) na jedno číslo.
 * @param {'digit'|'roman'} type typ buniek
 * @param {string} text spojené znaky
 * @returns {number|null} číslo alebo null ak je neplatné
 */
function parseNumber(type, text) {
  if (type === 'roman') return romanToInt(text);
  if (text.length > 1 && text[0] === '0') return null;
  return Number(text);
}

/**
 * Premení bunky dosky na tokeny (čísla a znaky operátorov/vzťahov).
 * Prázdne bunky (' ') sa preskakujú, takže susedné čísla cez ne splývajú.
 * @param {{type: string, ch: string}[]} cells bunky zľava doprava
 * @returns {(number|string)[]|null} tokeny alebo null pri neplatnom čísle/znaku
 */
export function tokenize(cells) {
  const tokens = [];
  let runType = null;
  let runText = '';

  const flush = () => {
    if (runType === null) return true;
    const n = parseNumber(runType, runText);
    runType = null;
    runText = '';
    if (n === null) return false;
    tokens.push(n);
    return true;
  };

  for (const { type, ch } of cells) {
    if (ch === ' ') continue;
    if (type === 'digit' || type === 'roman') {
      if (type !== runType && !flush()) return null;
      runType = type;
      runText += ch;
    } else if (
      (type === 'op' && OPERATORS.includes(ch)) ||
      (type === 'rel' && RELATIONS.includes(ch))
    ) {
      if (!flush()) return null;
      tokens.push(ch);
    } else {
      return null;
    }
  }
  return flush() ? tokens : null;
}

/**
 * Vyhodnotí výraz bez vzťahov: čísla spojené +, -, × (× má prednosť).
 * @param {(number|string)[]} part tokeny jedného výrazu
 * @returns {number|null} hodnota alebo null pri nesprávnej postupnosti
 */
function evalExpr(part) {
  if (part.length === 0 || part.length % 2 === 0) return null;
  const terms = [];
  let sign = 1;
  let product = null;
  for (let i = 0; i < part.length; i++) {
    const t = part[i];
    if (i % 2 === 0) {
      if (typeof t !== 'number') return null;
      product = product === null ? t : product * t;
    } else if (t === '×') {
      continue;
    } else if (t === '+' || t === '-') {
      terms.push(sign * product);
      product = null;
      sign = t === '+' ? 1 : -1;
    } else {
      return null;
    }
  }
  terms.push(sign * product);
  return terms.reduce((a, b) => a + b, 0);
}

/**
 * Zistí, či je rovnica/nerovnica pravdivá. Gramatika: expr (rel expr)+,
 * vzťahy sa reťazia a musia platiť všetky. Nikdy nevyhodí chybu.
 * @param {(number|string)[]} tokens čísla a znaky + - × = < >
 * @returns {boolean} true ak je výraz platný a pravdivý
 */
export function evaluate(tokens) {
  if (!Array.isArray(tokens)) return false;
  const exprs = [];
  const rels = [];
  let current = [];
  for (const t of tokens) {
    if (RELATIONS.includes(t)) {
      exprs.push(current);
      rels.push(t);
      current = [];
    } else {
      current.push(t);
    }
  }
  exprs.push(current);
  if (rels.length === 0) return false;

  const values = exprs.map(evalExpr);
  if (values.some((v) => v === null)) return false;
  return rels.every((rel, i) => {
    const a = values[i];
    const b = values[i + 1];
    if (rel === '=') return a === b;
    return rel === '<' ? a < b : a > b;
  });
}
