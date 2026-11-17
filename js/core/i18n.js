import { STRINGS } from './strings.js';

const LANG_KEY = 'zapalkovo.lang';
const LANGS = ['sk', 'en'];

/** Nahradí {meno} v texte hodnotami z params; neznáme zástupné znaky nechá nezmenené. */
function interpolate(text, params) {
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match);
}

/**
 * Vytvorí prekladač s uloženým jazykom.
 * @param {{get: Function, set: Function}} storage úložisko z createStorage()
 * @param {string} defaultLang jazyk, ak nič nie je uložené
 */
export function createI18n(storage, defaultLang = 'sk') {
  const stored = storage.get(LANG_KEY, null);
  let lang = LANGS.includes(stored) ? stored : defaultLang;

  /** Nastaví jazyk a uloží ho; neznámy jazyk ignoruje. */
  function setLang(next) {
    if (!LANGS.includes(next)) return;
    lang = next;
    storage.set(LANG_KEY, next);
  }

  /** Vráti preklad kľúča s dosadenými parametrami; chýbajúci kľúč vráti kľúč samotný. */
  function t(key, params = {}) {
    const text = STRINGS[lang][key];
    return text === undefined ? key : interpolate(text, params);
  }

  /** Z objektu {sk, en} vyberie text v aktuálnom jazyku (záloha: sk, potom ''). */
  function pick(obj) {
    return obj[lang] ?? obj.sk ?? '';
  }

  return {
    get lang() { return lang; },
    setLang,
    t,
    pick,
  };
}
