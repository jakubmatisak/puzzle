/** Vráti window.localStorage, alebo undefined ak nie je dostupné (Node, zákaz prístupu). */
function defaultBackend() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Bezpečný obal nad localStorage. Hodnoty sa ukladajú ako JSON.
 * Ak úložisko nie je dostupné alebo hádže chybu, hodnoty sa držia v RAM mape.
 * @param {{getItem: Function, setItem: Function}|undefined} backend
 * @returns {{get: (key: string, fallback: any) => any, set: (key: string, value: any) => void}}
 */
export function createStorage(backend = defaultBackend()) {
  const memory = new Map();

  /** Vráti uloženú hodnotu alebo fallback (chýba kľúč, zlý JSON, chyba prístupu). */
  function get(key, fallback) {
    if (memory.has(key)) return memory.get(key);
    if (!backend) return fallback;
    try {
      const raw = backend.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      const parsed = JSON.parse(raw);
      return parsed === null ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  /** Uloží hodnotu; pri chybe ju nechá v RAM a nikdy nehodí výnimku. */
  function set(key, value) {
    if (!backend) {
      memory.set(key, value);
      return;
    }
    try {
      backend.setItem(key, JSON.stringify(value));
      memory.delete(key);
    } catch {
      memory.set(key, value);
    }
  }

  return { get, set };
}
