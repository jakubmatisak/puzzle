const ROMAN_RE = /^(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
const VALUES = { I: 1, V: 5, X: 10, L: 50, C: 100 };

/**
 * Prevedie rímske číslo (I, V, X, L, C) na celé číslo.
 * Prijíma iba správny zápis (napr. IIII alebo VV sú neplatné).
 * @param {string} s rímske číslo
 * @returns {number|null} hodnota alebo null pri neplatnom/prázdnom vstupe
 */
export function romanToInt(s) {
  if (typeof s !== 'string' || s === '' || !ROMAN_RE.test(s)) return null;
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = VALUES[s[i]];
    const next = VALUES[s[i + 1]] ?? 0;
    total += v < next ? -v : v;
  }
  return total;
}
