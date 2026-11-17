import { describe, it, expect } from 'vitest';
import { layoutEquation, encodeText } from '../../js/core/glyphs.js';
import {
  decodeCell, decodeBoard, isTrueEquation, isTrueText, normalizeText,
} from '../../js/core/decode.js';

// Prázdny stĺpec potrebuje druhý, vyplnený tvar rovnice (ako v dátach úloh).
const LAYOUTS = {
  'VII +I=VIII': ['VII +I=VIII', 'VII+ I=VIII'],
  'X =VIII+II': ['X =VIII+II', 'X-=VIII+II'],
  'II×III=VI ': ['II×III=VI ', 'II×III=VII'],
};

function board(text) {
  const { types } = layoutEquation(LAYOUTS[text] ?? [text]);
  return { types, occupied: encodeText(text, types) };
}

describe('decodeCell', () => {
  it('digit {e,f} je 1', () => expect(decodeCell('digit', new Set(['e', 'f']))).toBe('1'));
  it('alternatívy číslic', () => {
    expect(decodeCell('digit', new Set(['a', 'b', 'c', 'f']))).toBe('7');
    expect(decodeCell('digit', new Set(['a', 'b', 'c', 'f', 'g']))).toBe('9');
    expect(decodeCell('digit', new Set(['c', 'd', 'e', 'f', 'g']))).toBe('6');
  });
  it('prázdna sada je prázdny reťazec', () => expect(decodeCell('op', new Set())).toBe(''));
  it('neplatná sada je null', () => expect(decodeCell('op', new Set(['v']))).toBeNull());
});

describe('decodeBoard', () => {
  it('9+4=5', () => {
    const { types, occupied } = board('9+4=5');
    expect(decodeBoard(types, occupied)).toBe('9+4=5');
  });
  it('rímske s prázdnou bunkou', () => {
    const { types, occupied } = board('VII +I=VIII');
    expect(decodeBoard(types, occupied)).toBe('VII +I=VIII');
  });
  it('operátor iba v -> null', () => {
    const { types } = layoutEquation(['9+4=5']);
    expect(decodeBoard(types, new Set(['c1.v']))).toBeNull();
  });
});

describe('isTrueEquation', () => {
  it.each([['5+4=9', true], ['9+4=5', false], ['X =VIII+II', true], ['II×III=VI ', true]])(
    '%s', (text, expected) => {
      const { types, occupied } = board(text);
      expect(isTrueEquation(types, occupied)).toBe(expected);
    },
  );
  it('neplatná doska je false', () => {
    const { types } = layoutEquation(['9+4=5']);
    expect(isTrueEquation(types, new Set(['c1.v']))).toBe(false);
  });
});

describe('normalizeText', () => {
  it('removes all spaces', () => {
    expect(normalizeText('VII +I=VIII')).toBe('VII+I=VIII');
    expect(normalizeText(' 5 ')).toBe('5');
  });
});

describe('isTrueText', () => {
  it('vyhodnotí dekódovaný text podľa typov buniek', () => {
    const types = ['digit', 'op', 'digit', 'rel', 'digit'];
    expect(isTrueText('5+4=9', types)).toBe(true);
    expect(isTrueText('9+4=5', types)).toBe(false);
  });
});
