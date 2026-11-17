// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { svgEl, SVG_NS } from '../../js/ui/svg.js';

describe('svgEl', () => {
  it('vytvorí SVG prvok v správnom mennom priestore s atribútmi', () => {
    const el = svgEl('line', { x1: 1, class: 'slot' });
    expect(el.namespaceURI).toBe(SVG_NS);
    expect(el.tagName).toBe('line');
    expect(el.getAttribute('x1')).toBe('1');
    expect(el.getAttribute('class')).toBe('slot');
  });
});
