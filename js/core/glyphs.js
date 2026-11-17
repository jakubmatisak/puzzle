/**
 * Glyfy rovníc: kde môžu ležať zápalky v bunkách (číslica, operátor,
 * relácia, rímska číslica) a ako sa z textu rovnice určia obsadené sloty.
 * Slot = {id, x, y, angle}; dĺžka zápalky je 100 (pozri geometry.js).
 */

/** Šírka (posun) jednotlivých typov buniek. */
export const CELL = {
  digit: { advance: 160 },
  op: { advance: 140 },
  rel: { advance: 140 },
  roman: { advance: 80 },
};

/** Šablóny slotov: [meno, x, y, uhol] v lokálnych súradniciach bunky. */
const TEMPLATES = {
  digit: [
    ['a', 50, 0, 0], ['b', 100, 50, 90], ['c', 100, 150, 90], ['d', 50, 200, 0],
    ['e', 0, 150, 90], ['f', 0, 50, 90], ['g', 50, 100, 0],
  ],
  op: [['h', 50, 100, 0], ['v', 50, 100, 90], ['x1', 50, 100, 45], ['x2', 50, 100, 135]],
  rel: [
    ['e1', 50, 80, 0], ['e2', 50, 120, 0], ['u1', 50, 75, 150],
    ['u2', 50, 75, 30], ['l1', 50, 125, 30], ['l2', 50, 125, 150],
  ],
  roman: [
    ['i', 34, 100, 90], ['vl', 21, 100, 75], ['vr', 47, 100, 105],
    ['xa', 34, 100, 75], ['xb', 34, 100, 105],
  ],
};

/** Kanonické sady slotov pre každý znak. */
export const ENCODE = {
  digit: {
    0: ['a', 'b', 'c', 'd', 'e', 'f'], 1: ['b', 'c'], 2: ['a', 'b', 'd', 'e', 'g'],
    3: ['a', 'b', 'c', 'd', 'g'], 4: ['b', 'c', 'f', 'g'], 5: ['a', 'c', 'd', 'f', 'g'],
    6: ['a', 'c', 'd', 'e', 'f', 'g'], 7: ['a', 'b', 'c'], 8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    9: ['a', 'b', 'c', 'd', 'f', 'g'],
  },
  op: { '+': ['h', 'v'], '-': ['h'], '×': ['x1', 'x2'] },
  rel: { '=': ['e1', 'e2'], '<': ['u1', 'l1'], '>': ['u2', 'l2'] },
  roman: { I: ['i'], V: ['vl', 'vr'], X: ['xa', 'xb'] },
};

/**
 * Typ bunky pre znak, alebo null (medzera, neznámy znak).
 * @param {string} ch jeden znak
 * @returns {'digit'|'op'|'rel'|'roman'|null}
 */
export function cellTypeOf(ch) {
  for (const type of Object.keys(ENCODE)) {
    if (Object.hasOwn(ENCODE[type], ch)) return type;
  }
  return null;
}

/**
 * Sloty jednej bunky posunuté o ox; id má tvar `c{index}.{meno}`.
 * @param {string} type typ bunky
 * @param {number} index poradie bunky v rovnici
 * @param {number} ox x-ový začiatok bunky
 * @returns {{id:string,x:number,y:number,angle:number}[]}
 */
export function cellSlots(type, index, ox) {
  return TEMPLATES[type].map(([name, x, y, angle]) => ({
    id: `c${index}.${name}`, x: x + ox, y, angle,
  }));
}

/**
 * Typ jedného stĺpca: všetky nemedzerové znaky musia mať rovnaký typ.
 * @param {string[]} texts
 * @param {number} i index stĺpca
 * @returns {string}
 */
function columnType(texts, i) {
  const types = new Set();
  for (const t of texts) {
    const type = cellTypeOf(t[i]);
    if (type) types.add(type);
  }
  if (types.size === 0) throw new Error(`Stĺpec ${i} je prázdny`);
  if (types.size > 1) throw new Error(`Stĺpec ${i} mieša typy: ${[...types].join(', ')}`);
  return [...types][0];
}

/**
 * Rozloží rovnicu (jeden alebo viac zarovnaných reťazcov) do buniek a slotov.
 * @param {string[]} texts reťazce rovnakej dĺžky (medzera = prázdne miesto)
 * @returns {{types:string[], slots:object[], width:number}}
 */
export function layoutEquation(texts) {
  const len = texts[0].length;
  if (texts.some((t) => t.length !== len)) throw new Error('Texty majú rôznu dĺžku');
  const types = [];
  const slots = [];
  let ox = 0;
  for (let i = 0; i < len; i++) {
    const type = columnType(texts, i);
    types.push(type);
    slots.push(...cellSlots(type, i, ox));
    ox += CELL[type].advance;
  }
  return { types, slots, width: ox };
}

/**
 * Množina ID slotov obsadených textom (medzera nič).
 * @param {string} text
 * @param {string[]} types typy buniek z layoutEquation
 * @returns {Set<string>}
 */
export function encodeText(text, types) {
  const out = new Set();
  [...text].forEach((ch, i) => {
    if (ch === ' ') return;
    if (cellTypeOf(ch) !== types[i]) throw new Error(`Znak '${ch}' nepasuje do bunky ${i} (${types[i]})`);
    for (const name of ENCODE[types[i]][ch]) out.add(`c${i}.${name}`);
  });
  return out;
}
