import { describe, it, expect } from 'vitest';
import { romanToInt } from '../../js/core/roman.js';

describe('romanToInt', () => {
  it('parses valid numerals', () => {
    expect(romanToInt('VIII')).toBe(8);
    expect(romanToInt('IX')).toBe(9);
    expect(romanToInt('XIX')).toBe(19);
  });
  it('rejects invalid numerals', () => {
    expect(romanToInt('IIII')).toBeNull();
    expect(romanToInt('VV')).toBeNull();
    expect(romanToInt('')).toBeNull();
  });
});
