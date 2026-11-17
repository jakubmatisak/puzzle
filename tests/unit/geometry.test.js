import { describe, it, expect } from 'vitest';
import { normAngle, angleDiff, rotateStep, distance, findSnapSlot } from '../../js/core/geometry.js';

describe('normAngle', () => {
  it('normalizuje uhly modulo 180', () => {
    expect(normAngle(180)).toBe(0);
    expect(normAngle(-45)).toBe(135);
    expect(normAngle(270)).toBe(90);
  });
});

describe('angleDiff', () => {
  it('vracia najmensi rozdiel 0-90', () => {
    expect(angleDiff(0, 170)).toBe(10);
    expect(angleDiff(45, 135)).toBe(90);
  });
});

describe('rotateStep', () => {
  it('otaca o krok 45 stupnov', () => {
    expect(rotateStep(0)).toBe(45);
    expect(rotateStep(70)).toBe(90);
    expect(rotateStep(135)).toBe(0);
  });
});

describe('distance', () => {
  it('euklidovska vzdialenost', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('findSnapSlot', () => {
  const slot = { id: 'a', x: 0, y: 0, angle: 90 };
  const none = new Set();

  it('najde slot v polomere so zhodnou orientaciou', () => {
    expect(findSnapSlot({ x: 30, y: 10, angle: 90 }, [slot], none)).toBe(slot);
  });
  it('odmietne inu orientaciu', () => {
    expect(findSnapSlot({ x: 30, y: 10, angle: 0 }, [slot], none)).toBeNull();
  });
  it('odmietne vzdialenost 50', () => {
    expect(findSnapSlot({ x: 50, y: 0, angle: 90 }, [slot], none)).toBeNull();
  });
  it('preskoci obsadeny slot', () => {
    expect(findSnapSlot({ x: 30, y: 10, angle: 90 }, [slot], new Set(['a']))).toBeNull();
  });
  it('vyberie blizsi z dvoch slotov', () => {
    const far = { id: 'far', x: 40, y: 0, angle: 90 };
    const near = { id: 'near', x: 10, y: 0, angle: 90 };
    expect(findSnapSlot({ x: 0, y: 0, angle: 90 }, [far, near], none)).toBe(near);
  });
  it('pri rovnakej vzdialenosti vyberie prvy v poradi', () => {
    const s1 = { id: 's1', x: 10, y: 0, angle: 90 };
    const s2 = { id: 's2', x: -10, y: 0, angle: 90 };
    expect(findSnapSlot({ x: 0, y: 0, angle: 90 }, [s1, s2], none)).toBe(s1);
  });
  it('uhol 70 vs 90 (rozdiel 20) zaskoci', () => {
    expect(findSnapSlot({ x: 0, y: 0, angle: 70 }, [slot], none)).toBe(slot);
  });
  it('uhol 45 vs 70 (rozdiel 25) nezaskoci', () => {
    const s = { id: 'b', x: 0, y: 0, angle: 70 };
    expect(findSnapSlot({ x: 0, y: 0, angle: 45 }, [s], none)).toBeNull();
  });
});
