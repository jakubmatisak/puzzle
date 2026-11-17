import { describe, it, expect } from 'vitest';
import { evaluate, tokenize } from '../../js/core/expression.js';

const cells = (type, s) => [...s].map((ch) => ({ type, ch }));

describe('evaluate', () => {
  it('true equations', () => {
    expect(evaluate([5, '+', 4, '=', 9])).toBe(true);
    expect(evaluate([2, '-', 5, '<', 9])).toBe(true);
    expect(evaluate([2, '+', 3, '×', 2, '=', 8])).toBe(true);
    expect(evaluate([3, '>', 2])).toBe(true);
  });
  it('false or malformed', () => {
    expect(evaluate([3, '+', 4])).toBe(false);
    expect(evaluate(['+', 3, '=', 3])).toBe(false);
    expect(evaluate([1, '=', 1, '=', 2])).toBe(false);
    expect(evaluate([1, 2, '=', 3])).toBe(false);
    expect(evaluate([1, '+', '=', 1])).toBe(false);
    expect(evaluate([1, '=', 1, '+'])).toBe(false);
    expect(evaluate([])).toBe(false);
  });
  it('chained relations', () => {
    expect(evaluate([1, '<', 2, '<', 3])).toBe(true);
  });
});

describe('tokenize', () => {
  it('digits', () => {
    expect(tokenize(cells('digit', '06'))).toBeNull();
    expect(tokenize(cells('digit', '13'))).toEqual([13]);
    expect(tokenize([...cells('digit', '1'), ...cells('digit', ' '), ...cells('digit', '3')])).toEqual([13]);
    expect(tokenize(cells('digit', '0'))).toEqual([0]);
  });
  it('roman', () => {
    expect(tokenize([...cells('roman', 'X'), ...cells('roman', ' '), ...cells('roman', 'I')])).toEqual([11]);
    expect(tokenize(cells('roman', 'IIII'))).toBeNull();
  });
  it('mixed', () => {
    const t = [...cells('digit', '5'), ...cells('op', '+'), ...cells('digit', '4'), ...cells('rel', '='), ...cells('digit', '9')];
    expect(tokenize(t)).toEqual([5, '+', 4, '=', 9]);
    expect(tokenize(cells('op', '?'))).toBeNull();
  });
});
