import { describe, it, expect } from 'vitest';
import {
  effectiveRoll,
  createTiltDetector,
  createShakeDetector,
  motionMagnitude,
} from '../../js/core/sensors-logic.js';

describe('effectiveRoll', () => {
  it('portrait (0) používa gamma', () => {
    expect(effectiveRoll(10, -30, 0)).toBe(-30);
  });
  it('landscape 90 používa -beta', () => {
    expect(effectiveRoll(-40, 0, 90)).toBe(40);
    expect(effectiveRoll(40, 0, 90)).toBe(-40);
  });
  it('270 a -90 používajú beta', () => {
    expect(effectiveRoll(25, 0, 270)).toBe(25);
    expect(effectiveRoll(25, 0, -90)).toBe(25);
  });
  it('180 používa -gamma', () => {
    expect(effectiveRoll(0, 20, 180)).toBe(-20);
  });
  it('null/undefined sa berie ako 0', () => {
    expect(effectiveRoll(null, undefined, 0)).toBe(0);
    expect(effectiveRoll(undefined, null, 90)).toBe(0);
  });
});

describe('createTiltDetector', () => {
  it('spustí po 300 ms držania a len raz', () => {
    const d = createTiltDetector();
    for (let t = 0; t < 300; t += 10) expect(d.update(-40, t)).toBe(false);
    expect(d.update(-40, 300)).toBe(true);
    expect(d.update(-40, 310)).toBe(false);
    expect(d.update(-40, 2000)).toBe(false);
  });
  it('re-arm po návrate nad release', () => {
    const d = createTiltDetector();
    d.update(-40, 0);
    expect(d.update(-40, 300)).toBe(true);
    expect(d.update(-20, 400)).toBe(false); // ešte nie re-arm
    expect(d.update(-40, 500)).toBe(false);
    expect(d.update(-10, 600)).toBe(false); // re-arm
    expect(d.update(-40, 700)).toBe(false);
    expect(d.update(-40, 1000)).toBe(true);
  });
  it('krátky náklon (200 ms) nespustí', () => {
    const d = createTiltDetector();
    expect(d.update(-40, 0)).toBe(false);
    expect(d.update(-40, 200)).toBe(false);
    expect(d.update(-10, 250)).toBe(false);
    expect(d.update(-40, 300)).toBe(false);
    expect(d.update(-40, 500)).toBe(false);
    expect(d.update(-40, 600)).toBe(true);
  });
});

describe('createShakeDetector', () => {
  it('dva vrcholy v okne spustia', () => {
    const d = createShakeDetector();
    expect(d.update(20, 0)).toBe(false);
    d.update(0, 100);
    expect(d.update(20, 400)).toBe(true);
  });
  it('vrcholy ďaleko od seba (1200 ms) nespustia', () => {
    const d = createShakeDetector();
    d.update(20, 0);
    d.update(0, 600);
    expect(d.update(20, 1200)).toBe(false);
  });
  it('vrchol bližšie ako minGap sa nepočíta', () => {
    const d = createShakeDetector();
    d.update(20, 0);
    d.update(0, 50);
    expect(d.update(20, 100)).toBe(false);
  });
  it('trvalé vysoké hodnoty sú jeden vrchol', () => {
    const d = createShakeDetector();
    for (let t = 0; t < 1000; t += 50) expect(d.update(20, t)).toBe(false);
  });
  it('po spustení sa vrcholy počas cooldownu ignorujú', () => {
    const d = createShakeDetector();
    d.update(20, 0);
    d.update(0, 100);
    expect(d.update(20, 400)).toBe(true);
    d.update(0, 500);
    expect(d.update(20, 600)).toBe(false);
    d.update(0, 700);
    expect(d.update(20, 800)).toBe(false);
    d.update(0, 900);
    expect(d.update(20, 1000)).toBe(false);
  });
  it('po cooldowne funguje znova', () => {
    const d = createShakeDetector();
    d.update(20, 0);
    d.update(0, 100);
    d.update(20, 400);
    d.update(0, 500);
    expect(d.update(20, 2000)).toBe(false); // prvý vrchol nového páru
    d.update(0, 2100);
    expect(d.update(20, 2400)).toBe(true);
  });
});

describe('motionMagnitude', () => {
  it('norma bez gravitácie', () => {
    expect(motionMagnitude({ x: 3, y: 4, z: 0 }, false)).toBe(5);
  });
  it('s gravitáciou odpočíta 9.81', () => {
    expect(motionMagnitude({ x: 0, y: 0, z: 19.81 }, true)).toBeCloseTo(10, 5);
  });
  it('nikdy záporná', () => {
    expect(motionMagnitude({ x: 0, y: 0, z: 9 }, true)).toBe(0);
  });
  it('null hodnoty = 0', () => {
    expect(motionMagnitude({ x: null, y: undefined, z: 2 }, false)).toBe(2);
    expect(motionMagnitude(null, false)).toBe(0);
  });
});
