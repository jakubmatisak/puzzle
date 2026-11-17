/**
 * Geometria hry: uhly (v stupňoch) a priťahovanie zápalky k voľnému slotu.
 * Zápalka je symetrická, preto sa uhly počítajú modulo 180.
 */

/** Polovica dĺžky zápalky (zápalka má dĺžku 100 jednotiek SVG). */
export const MATCH_HALF = 50;
/** Do akej vzdialenosti od stredu slotu sa pustená zápalka prichytí. */
export const SNAP_RADIUS = 45;
/** Najväčší uhlový rozdiel (mod 180), pri ktorom sa zápalka ešte prichytí. */
export const SNAP_MAX_ANGLE = 23;

/**
 * Zníži uhol do intervalu 0 až 179.999 (modulo 180).
 * @param {number} a uhol v stupňoch
 * @returns {number}
 */
export function normAngle(a) {
  return ((a % 180) + 180) % 180;
}

/**
 * Najmenší rozdiel dvoch uhlov (modulo 180), vždy 0 až 90.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function angleDiff(a, b) {
  const d = Math.abs(normAngle(a) - normAngle(b));
  return Math.min(d, 180 - d);
}

/**
 * Ďalší krok otočenia zápalky: 0 -> 45 -> 90 -> 135 -> 0.
 * @param {number} a aktuálny uhol
 * @returns {number}
 */
export function rotateStep(a) {
  return ((Math.floor(normAngle(a) / 45) + 1) * 45) % 180;
}

/**
 * Euklidovská vzdialenosť dvoch bodov {x, y}.
 * @param {{x:number, y:number}} p
 * @param {{x:number, y:number}} q
 * @returns {number}
 */
export function distance(p, q) {
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/**
 * Nájde najbližší voľný slot v polomere so zhodnou orientáciou.
 * Pri rovnakej vzdialenosti vyhráva slot, ktorý je v poli skôr.
 * @param {{x:number, y:number, angle:number}} pos pozícia pustenej zápalky
 * @param {{id:string, x:number, y:number, angle:number}[]} slots všetky sloty
 * @param {Set<string>} occupied id obsadených slotov
 * @param {{radius?:number, maxAngle?:number}} [opts] polomer (45) a max. uhlový rozdiel (23)
 * @returns {object|null} slot alebo null, ak nič nevyhovuje
 */
export function findSnapSlot(pos, slots, occupied, opts = {}) {
  const { radius = SNAP_RADIUS, maxAngle = SNAP_MAX_ANGLE } = opts;
  let best = null;
  let bestDist = Infinity;
  for (const slot of slots) {
    if (occupied.has(slot.id)) continue;
    if (angleDiff(pos.angle, slot.angle) > maxAngle) continue;
    const d = distance(pos, slot);
    if (d <= radius && d < bestDist) {
      best = slot;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Oba koncové body úsečky zápalky alebo slotu so stredom (x, y) a uhlom.
 * @param {{x:number, y:number, angle:number}} s stred a uhol
 * @param {number} [half] polovica dĺžky (MATCH_HALF)
 * @returns {{x:number, y:number}[]} dva body [začiatok, koniec]
 */
export function segmentEnds(s, half = MATCH_HALF) {
  const rad = (s.angle * Math.PI) / 180;
  const dx = half * Math.cos(rad);
  const dy = half * Math.sin(rad);
  return [{ x: s.x - dx, y: s.y - dy }, { x: s.x + dx, y: s.y + dy }];
}

/**
 * Vzdialenosť bodu od úsečky zápalky (stred x, y, uhol, polovica dĺžky half).
 * Používa sa na „chytenie“ najbližšej zápalky prstom.
 * @param {{x:number, y:number}} p bod
 * @param {{x:number, y:number, angle:number}} m stred a uhol zápalky
 * @param {number} [half] polovica dĺžky (50)
 * @returns {number}
 */
export function segmentDistance(p, m, half = MATCH_HALF) {
  const rad = (m.angle * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const along = (p.x - m.x) * ux + (p.y - m.y) * uy; // priemet na os zápalky
  const t = Math.max(-half, Math.min(half, along));
  return distance(p, { x: m.x + t * ux, y: m.y + t * uy });
}
