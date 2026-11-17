/**
 * Jednoduchý hash router: #/ = domov, #/help = návod, #/play/<kategória>?puzzle=<id> = hra.
 */

const HOME = Object.freeze({ view: 'home' });

/** Dekóduje časť URL; pri chybnom kódovaní vráti null. */
function decode(part) {
  try {
    return decodeURIComponent(part);
  } catch {
    return null;
  }
}

/** Z reťazca „puzzle=…&…“ vytiahne ID úlohy (alebo null). */
function readPuzzleId(query) {
  const value = new URLSearchParams(query).get('puzzle');
  return value ? value : null;
}

/**
 * Rozloží hash adresy na trasu. Neznáma trasa vedie na domov.
 * @param {string} hash napr. '#/play/numbers?puzzle=num-01'
 * @returns {{view:'home'|'play'|'help', category?:string, puzzleId?:string}}
 */
export function parseRoute(hash) {
  const raw = String(hash ?? '').replace(/^#/, '');
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter((p) => p !== '');
  if (parts.length === 0) return { ...HOME };
  if (parts[0] === 'help' && parts.length === 1) return { view: 'help' };
  if (parts[0] === 'play' && parts.length === 2) {
    const category = decode(parts[1]);
    if (!category) return { ...HOME };
    const route = { view: 'play', category };
    const puzzleId = readPuzzleId(query);
    if (puzzleId) route.puzzleId = puzzleId;
    return route;
  }
  return { ...HOME };
}

/**
 * Spustí router: zavolá onChange(trasa) hneď a pri každej zmene hashu.
 * @param {(route: ReturnType<typeof parseRoute>) => void} onChange
 * @returns {() => void} funkcia, ktorá router zastaví
 */
export function startRouter(onChange) {
  const handle = () => onChange(parseRoute(window.location.hash));
  window.addEventListener('hashchange', handle);
  handle();
  return () => window.removeEventListener('hashchange', handle);
}
