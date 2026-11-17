import { describe, it, expect } from 'vitest';
import { createStorage } from '../../js/core/storage.js';
import { createQueue } from '../../js/core/queue.js';
import { nextDistinct } from '../../js/ui/game.js';

function memQueue(rng) {
  const m = new Map();
  return createQueue(createStorage({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }), rng);
}

describe('nextDistinct', () => {
  it('nevráti práve zobrazenú úlohu, ktorú fronta nepozná (deep link)', () => {
    // rng () => 0 vyberie prvú neodohranú = 'a', čo je práve zobrazená úloha
    const q = memQueue(() => 0);
    expect(nextDistinct(q, 'cat', ['a', 'b', 'c'], 'a')).not.toBe('a');
  });
  it('pri náhodnom rng nikdy nevráti aktuálnu úlohu', () => {
    for (let i = 0; i < 50; i += 1) {
      const q = memQueue(Math.random);
      expect(nextDistinct(q, 'cat', ['a', 'b', 'c', 'd'], 'b')).not.toBe('b');
    }
  });
  it('aj na konci kola (zostáva iba aktuálna) vyberie inú', () => {
    const q = memQueue(() => 0);
    ['b', 'c'].forEach(() => q.next('cat', ['b', 'c'])); // odohrané b, c
    expect(nextDistinct(q, 'cat', ['a', 'b', 'c'], 'a')).not.toBe('a');
  });
  it('kategória s jedinou úlohou vráti tú istú', () => {
    expect(nextDistinct(memQueue(() => 0), 'cat', ['a'], 'a')).toBe('a');
  });
});
