import { describe, it, expect } from 'vitest';
import { CELL, ENCODE, cellTypeOf, cellSlots, layoutEquation, encodeText } from '../../js/core/glyphs.js';

describe('cellTypeOf', () => {
  it('rozpozná typy znakov', () => {
    expect(cellTypeOf('7')).toBe('digit');
    expect(cellTypeOf('×')).toBe('op');
    expect(cellTypeOf('-')).toBe('op');
    expect(cellTypeOf('<')).toBe('rel');
    expect(cellTypeOf('V')).toBe('roman');
    expect(cellTypeOf(' ')).toBe(null);
  });
});

describe('layoutEquation', () => {
  it('9+4=5 má typy a súradnice', () => {
    const { types, slots, width } = layoutEquation(['9+4=5']);
    expect(types).toEqual(['digit', 'op', 'digit', 'rel', 'digit']);
    expect(slots.find((s) => s.id === 'c1.v').x).toBe(160 + 50);
    expect(width).toBe(160 + 140 + 160 + 140 + 160);
  });
  it('rímske číslice s medzerami', () => {
    expect(layoutEquation(['VII ', 'VI I']).types).toEqual(['roman', 'roman', 'roman', 'roman']);
  });
  it('hádže pri kolízii typov, dĺžkach a medzere všade', () => {
    expect(() => layoutEquation(['1+', '12'])).toThrow();
    expect(() => layoutEquation(['1+', '1'])).toThrow();
    expect(() => layoutEquation(['1 ', '1 ', ' ']) ).toThrow();
    expect(() => layoutEquation(['1 ', '  '])).toThrow();
  });
});

describe('encodeText', () => {
  it('1 obsadí b,c', () => {
    expect(encodeText('1', ['digit'])).toEqual(new Set(['c0.b', 'c0.c']));
  });
  it('medzera nič, nezhoda typu hádže', () => {
    expect(encodeText('1 ', ['digit', 'digit']).size).toBe(2);
    expect(() => encodeText('+', ['digit'])).toThrow();
  });
  it('ENCODE má všetky znaky', () => {
    expect(ENCODE.digit['8']).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect(CELL.roman.advance).toBe(80);
  });
});

describe('geometria slotov', () => {
  const end = (s, sign) => {
    const r = (s.angle * Math.PI) / 180;
    return { x: s.x + sign * 50 * Math.cos(r), y: s.y + sign * 50 * Math.sin(r) };
  };
  it('ramená V sa stretnú dole', () => {
    const slots = cellSlots('roman', 0, 0);
    const vl = slots.find((s) => s.id === 'c0.vl');
    const vr = slots.find((s) => s.id === 'c0.vr');
    const bl = [end(vl, 1), end(vl, -1)].sort((p, q) => q.y - p.y)[0];
    const br = [end(vr, 1), end(vr, -1)].sort((p, q) => q.y - p.y)[0];
    expect(Math.hypot(bl.x - br.x, bl.y - br.y)).toBeLessThan(3);
  });
  it('ox sa pripočíta k x', () => {
    expect(cellSlots('digit', 2, 300).find((s) => s.id === 'c2.a')).toEqual({ id: 'c2.a', x: 350, y: 0, angle: 0 });
  });
});
