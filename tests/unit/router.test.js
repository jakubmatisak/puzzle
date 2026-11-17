import { describe, it, expect } from 'vitest';
import { parseRoute } from '../../js/ui/router.js';

describe('parseRoute', () => {
  it('maps empty and root hashes to home', () => {
    expect(parseRoute('')).toEqual({ view: 'home' });
    expect(parseRoute('#')).toEqual({ view: 'home' });
    expect(parseRoute('#/')).toEqual({ view: 'home' });
  });

  it('maps #/help to help', () => {
    expect(parseRoute('#/help')).toEqual({ view: 'help' });
  });

  it('maps #/play/<id> to play with category', () => {
    expect(parseRoute('#/play/roman')).toEqual({ view: 'play', category: 'roman' });
  });

  it('reads puzzleId from ?puzzle=', () => {
    expect(parseRoute('#/play/numbers?puzzle=num-01'))
      .toEqual({ view: 'play', category: 'numbers', puzzleId: 'num-01' });
  });

  it('ignores an empty puzzle parameter', () => {
    expect(parseRoute('#/play/numbers?puzzle=')).toEqual({ view: 'play', category: 'numbers' });
  });

  it('decodes URI components', () => {
    expect(parseRoute('#/play/a%20b?puzzle=x%2Fy'))
      .toEqual({ view: 'play', category: 'a b', puzzleId: 'x/y' });
  });

  it('falls back to home for unknown or incomplete routes', () => {
    expect(parseRoute('#/nope')).toEqual({ view: 'home' });
    expect(parseRoute('#/play')).toEqual({ view: 'home' });
    expect(parseRoute('#/play/')).toEqual({ view: 'home' });
    expect(parseRoute('#/play/a/b')).toEqual({ view: 'home' });
    expect(parseRoute('#/help/extra')).toEqual({ view: 'home' });
    expect(parseRoute('#/play/%E0%A4%A')).toEqual({ view: 'home' });
  });

  it('tolerates a missing leading slash and trailing slash', () => {
    expect(parseRoute('#help')).toEqual({ view: 'help' });
    expect(parseRoute('#/help/')).toEqual({ view: 'help' });
  });
});
