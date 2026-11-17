/**
 * Pomocník na kreslenie SVG cez DOM (doska aj ilustrácie na domovskej obrazovke).
 */

/** Menný priestor SVG prvkov. */
export const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Vytvorí SVG prvok s atribútmi.
 * @param {string} name názov prvku, napr. 'line'
 * @param {Object<string, string|number>} [attrs] atribúty prvku
 * @returns {SVGElement}
 */
export function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  return el;
}
