import { describe, it, expect } from 'vitest';
import { createI18n } from '../../js/core/i18n.js';
import { STRINGS } from '../../js/core/strings.js';
import { createStorage } from '../../js/core/storage.js';

function memStorage() {
  const data = {};
  return createStorage({
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
  });
}

describe('i18n', () => {
  it('defaults to Slovak and interpolates params', () => {
    const i18n = createI18n(memStorage());
    expect(i18n.lang).toBe('sk');
    expect(i18n.t('game.moves', { n: 1, max: 2 })).toBe('Ťahy: 1 / 2');
  });

  it('switches to English', () => {
    const i18n = createI18n(memStorage());
    i18n.setLang('en');
    expect(i18n.t('game.moves', { n: 1, max: 2 })).toBe('Moves: 1 / 2');
  });

  it('sk and en have identical key sets', () => {
    expect(Object.keys(STRINGS.en).sort()).toEqual(Object.keys(STRINGS.sk).sort());
  });

  it('persists language under zapalkovo.lang and restores it', () => {
    const storage = memStorage();
    createI18n(storage).setLang('en');
    expect(storage.get('zapalkovo.lang', null)).toBe('en');
    expect(createI18n(storage).lang).toBe('en');
  });

  it('ignores unknown language', () => {
    const storage = memStorage();
    const i18n = createI18n(storage);
    i18n.setLang('de');
    expect(i18n.lang).toBe('sk');
    expect(storage.get('zapalkovo.lang', null)).toBe(null);
  });

  it('returns the key for a missing key and keeps unknown placeholders', () => {
    const i18n = createI18n(memStorage());
    expect(i18n.t('no.such.key')).toBe('no.such.key');
    expect(i18n.t('game.moves', { n: 3 })).toBe('Ťahy: 3 / {max}');
  });

  it('pick falls back to sk then empty string', () => {
    const i18n = createI18n(memStorage(), 'en');
    expect(i18n.pick({ sk: 'a', en: 'b' })).toBe('b');
    expect(i18n.pick({ sk: 'a' })).toBe('a');
    expect(i18n.pick({})).toBe('');
  });
});
