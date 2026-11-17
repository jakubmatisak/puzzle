const playedKey = (cat) => `zapalkovo.played.${cat}`;
const currentKey = (cat) => `zapalkovo.current.${cat}`;
const SOLVED_KEY = 'zapalkovo.solved';

/**
 * Fronta úloh: náhodné poradie bez opakovania, uložené medzi návštevami.
 * @param {{get: Function, set: Function}} storage  výsledok createStorage
 * @param {() => number} rng  generátor čísel z [0, 1)
 */
export function createQueue(storage, rng = Math.random) {
  /** Odohrané ID danej kategórie, bez ID, ktoré už v úlohách neexistujú. */
  function playedIn(categoryId, allIds) {
    const stored = storage.get(playedKey(categoryId), []);
    return Array.isArray(stored) ? stored.filter((id) => allIds.includes(id)) : [];
  }

  /**
   * Aktuálna úloha kategórie alebo null. Ak sú zadané allIds,
   * neznáme uložené ID sa ignoruje.
   */
  function current(categoryId, allIds) {
    const id = storage.get(currentKey(categoryId), null);
    if (typeof id !== 'string') return null;
    if (allIds && !allIds.includes(id)) return null;
    return id;
  }

  /**
   * Vyberie ďalšiu úlohu: náhodne z ešte neodohraných. Keď sú odohrané všetky,
   * história sa vyčistí a vyberie sa z ostatných (okrem poslednej, ak ich je viac).
   */
  function next(categoryId, allIds) {
    let played = playedIn(categoryId, allIds);
    let pool = allIds.filter((id) => !played.includes(id));
    if (pool.length === 0) {
      const last = played[played.length - 1];
      played = [];
      pool = allIds.length > 1 ? allIds.filter((id) => id !== last) : [...allIds];
    }
    const id = pool[Math.floor(rng() * pool.length)];
    storage.set(playedKey(categoryId), [...played, id]);
    storage.set(currentKey(categoryId), id);
    return id;
  }

  /** Zapíše úlohu medzi vyriešené (každé ID najviac raz). */
  function markSolved(id) {
    const solved = storage.get(SOLVED_KEY, []);
    const list = Array.isArray(solved) ? solved : [];
    if (!list.includes(id)) storage.set(SOLVED_KEY, [...list, id]);
  }

  /** Počet vyriešených úloh spomedzi allIds. */
  function solvedCount(categoryId, allIds) {
    const solved = storage.get(SOLVED_KEY, []);
    const list = Array.isArray(solved) ? solved : [];
    return allIds.filter((id) => list.includes(id)).length;
  }

  return { current, next, markSolved, solvedCount };
}
