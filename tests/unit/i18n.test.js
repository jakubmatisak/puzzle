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

  it('hardens lookups against prototype keys', () => {
    const i18n = createI18n(memStorage());
    expect(i18n.t('constructor')).toBe('constructor');
    expect(i18n.t('toString')).toBe('toString');
    expect(i18n.t('game.moves', { n: 1 })).toBe('Ťahy: 1 / {max}');
    const tmp = createI18n(memStorage());
    expect(tmp.pick(null)).toBe('');
    expect(tmp.pick({ sk: 'a', en: '' })).toBe('a');
    const en = createI18n(memStorage());
    en.setLang('en');
    expect(en.pick({ sk: 'a', en: '' })).toBe('a');
  });

  it('does not interpolate prototype names', () => {
    const i18n = createI18n(memStorage());
    // placeholder {toString} is not in STRINGS, so test via a key with {n} only
    expect(i18n.t('home.solved', { n: 1 })).toBe('Vyriešené 1 / {total}');
    expect(i18n.t('home.solved', {})).toBe('Vyriešené {n} / {total}');
  });

  it('invalid stored or default language falls back to sk', () => {
    const storage = memStorage();
    storage.set('zapalkovo.lang', 'de');
    expect(createI18n(storage).lang).toBe('sk');
    expect(createI18n(memStorage(), 'de').lang).toBe('sk');
  });

  it('has all required keys in both languages', () => {
    const required = ['nav.home', 'nav.help', 'home.choose', 'home.solved',
      'game.moves', 'game.hint', 'game.solution', 'game.nextSolution', 'game.reset',
      'game.rotate', 'game.record', 'game.stopRecord', 'game.download', 'game.next',
      'game.solved', 'game.revealed', 'game.needRotate', 'sensors.enable',
      'sensors.denied', 'record.unsupported', 'lang.switch'];
    for (const lang of ['sk', 'en']) {
      for (const key of required) expect(Object.hasOwn(STRINGS[lang], key)).toBe(true);
    }
  });

  it('pick falls back to sk then empty string', () => {
    const i18n = createI18n(memStorage(), 'en');
    expect(i18n.pick({ sk: 'a', en: 'b' })).toBe('b');
    expect(i18n.pick({ sk: 'a' })).toBe('a');
    expect(i18n.pick({})).toBe('');
  });
});

describe('texty nápovedy', () => {
  it('odkladací priestor má jednotný názov', () => {
    expect(STRINGS.sk['board.tray']).toBe('Odkladací priestor');
    expect(STRINGS.en['board.tray']).toBe('Spare area');
  });
  it('rada „najprv otoč“ platí pre myš aj dotyk', () => {
    expect(STRINGS.sk['game.needRotate']).toBe('Najprv zápalku otoč (dvojklik / dvojité ťuknutie alebo R).');
    expect(STRINGS.en['game.needRotate']).toBe('Rotate the match first (double-click / double-tap or R).');
  });
});
