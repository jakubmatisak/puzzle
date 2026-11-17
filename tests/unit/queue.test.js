import { describe, it, expect } from 'vitest';
import { createStorage } from '../../js/core/storage.js';
import { createQueue } from '../../js/core/queue.js';

function fakeBackend() {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}

const IDS = ['a', 'b', 'c', 'd', 'e'];

describe('createStorage', () => {
  it('ukladá a číta JSON', () => {
    const s = createStorage(fakeBackend());
    s.set('k', { x: [1, 2] });
    expect(s.get('k', null)).toEqual({ x: [1, 2] });
  });
  it('chýbajúci kľúč vráti fallback', () => {
    expect(createStorage(fakeBackend()).get('nic', 7)).toBe(7);
  });
  it('nevalidný JSON vráti fallback', () => {
    const b = fakeBackend();
    b.setItem('k', '{zle');
    expect(createStorage(b).get('k', 'fb')).toBe('fb');
  });
  it('backend hádže → bez výnimky, hodnoty držané v RAM', () => {
    const b = {
      getItem() { throw new Error('zakázané'); },
      setItem() { throw new Error('plné'); },
    };
    const s = createStorage(b);
    expect(() => s.set('k', 5)).not.toThrow();
    expect(s.get('k', 0)).toBe(5);
    expect(s.get('iny', 'fb')).toBe('fb');
  });
  it('bez backendu (undefined) funguje cez RAM', () => {
    const s = createStorage(undefined);
    s.set('k', 'v');
    expect(s.get('k', null)).toBe('v');
  });
});

describe('createStorage - ochrana prístupu', () => {
  it('window.localStorage getter hádže → createStorage() nehodí a ide cez RAM', () => {
    const had = Object.getOwnPropertyDescriptor(globalThis, 'window');
    globalThis.window = {};
    Object.defineProperty(globalThis.window, 'localStorage', {
      get() { throw new Error('SecurityError'); },
    });
    try {
      let s;
      expect(() => { s = createStorage(); }).not.toThrow();
      s.set('k', 1);
      expect(s.get('k', 0)).toBe(1);
    } finally {
      if (had) Object.defineProperty(globalThis, 'window', had);
      else delete globalThis.window;
    }
  });
  it('JSON null vráti fallback', () => {
    const b = fakeBackend();
    b.setItem('k', 'null');
    expect(createStorage(b).get('k', 'fb')).toBe('fb');
  });
});

describe('createQueue', () => {
  it('next s prázdnym allIds vráti null a nič nezapíše', () => {
    const b = fakeBackend();
    expect(createQueue(createStorage(b)).next('cat', [])).toBeNull();
    expect(b.m.size).toBe(0);
  });
  it('5× next = permutácia bez opakovania', () => {
    const q = createQueue(createStorage(fakeBackend()));
    const got = IDS.map(() => q.next('cat', IDS));
    expect([...got].sort()).toEqual(IDS);
  });
  it('rng () => 0 dáva deterministické poradie', () => {
    const q = createQueue(createStorage(fakeBackend()), () => 0);
    expect(IDS.map(() => q.next('cat', IDS))).toEqual(IDS);
  });
  it('prerušenie: nový queue nad tým istým backendom pokračuje', () => {
    const b = fakeBackend();
    const q1 = createQueue(createStorage(b));
    const first3 = [q1.next('cat', IDS), q1.next('cat', IDS), q1.next('cat', IDS)];
    const q2 = createQueue(createStorage(b));
    expect(q2.current('cat')).toBe(first3[2]);
    const rest = [q2.next('cat', IDS), q2.next('cat', IDS)];
    expect([...first3, ...rest].sort()).toEqual(IDS);
  });
  it('6. next po vyčerpaní ≠ posledné (5.)', () => {
    const q = createQueue(createStorage(fakeBackend()));
    const got = IDS.map(() => q.next('cat', IDS));
    expect(q.next('cat', IDS)).not.toBe(got[4]);
  });
  it('uložené neznáme ID sa ignoruje a ponúkne sa nové', () => {
    const b = fakeBackend();
    const s = createStorage(b);
    s.set('zapalkovo.played.cat', ['stare', 'a']);
    s.set('zapalkovo.current.cat', 'stare');
    const q = createQueue(s, () => 0);
    expect(q.current('cat', IDS)).toBeNull();
    expect(q.next('cat', IDS)).toBe('b');
    expect(s.get('zapalkovo.played.cat', [])).toEqual(['a', 'b']);
  });
  it('current bez uloženej hodnoty = null', () => {
    expect(createQueue(createStorage(fakeBackend())).current('cat')).toBeNull();
  });
  it('kategórie sú nezávislé', () => {
    const q = createQueue(createStorage(fakeBackend()), () => 0);
    q.next('x', IDS);
    expect(q.next('y', IDS)).toBe('a');
  });
  it('jediná úloha v kategórii sa opakuje', () => {
    const q = createQueue(createStorage(fakeBackend()));
    expect(q.next('c', ['z'])).toBe('z');
    expect(q.next('c', ['z'])).toBe('z');
  });
  it('markSolved pridá raz a solvedCount počíta v rámci allIds', () => {
    const s = createStorage(fakeBackend());
    const q = createQueue(s);
    q.markSolved('a');
    q.markSolved('a');
    q.markSolved('inde');
    expect(s.get('zapalkovo.solved', [])).toEqual(['a', 'inde']);
    expect(q.solvedCount('cat', IDS)).toBe(1);
  });
});
