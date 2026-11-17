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

describe('createShakeDetector (dávky)', () => {
  // Oscilujúci otras: striedanie 20/0 po 50 ms od t0 do t1 (vrátane).
  function shake(d, t0, t1) {
    let r = false;
    for (let t = t0, i = 0; t <= t1; t += 50, i++) {
      if (d.update(i % 2 === 0 ? 20 : 0, t)) r = true;
    }
    return r;
  }
  function quiet(d, t0, t1) {
    let r = false;
    for (let t = t0; t <= t1; t += 50) if (d.update(0, t)) r = true;
    return r;
  }

  it('(a) jeden fyzický otras (oscilácia) nespustí', () => {
    const d = createShakeDetector();
    expect(shake(d, 0, 400)).toBe(false);
    expect(quiet(d, 450, 2000)).toBe(false);
  });
  it('(b) dva otrasy s pokojom medzi nimi spustia na začiatku druhého', () => {
    const d = createShakeDetector();
    expect(shake(d, 0, 200)).toBe(false);
    expect(quiet(d, 250, 450)).toBe(false);
    expect(d.update(20, 500)).toBe(true);
  });
  it('(c) dávky 1300 ms od seba nespustia', () => {
    const d = createShakeDetector();
    d.update(20, 0);
    quiet(d, 50, 1250);
    expect(d.update(20, 1300)).toBe(false);
  });
  it('(d) hodnoty medzi rearm a threshold dávku neukončia', () => {
    const d = createShakeDetector();
    d.update(20, 0);
    for (let t = 50; t <= 600; t += 50) d.update(10, t);
    expect(d.update(20, 700)).toBe(false);
    quiet(d, 750, 1000);
    // 700 nebol začiatok dávky, takže prvá dávka ostala jediná
    expect(d.update(20, 1100)).toBe(true); // druhá dávka, 1100 od začiatku prvej
  });
  it('(e) cooldown: nová dvojica do 1500 ms nespustí, po ňom áno', () => {
    const d = createShakeDetector();
    d.update(20, 0);
    quiet(d, 50, 450);
    expect(d.update(20, 500)).toBe(true);
    quiet(d, 550, 650);
    expect(d.update(20, 700)).toBe(false); // ignorovaná dávka
    quiet(d, 750, 900);
    expect(d.update(20, 1000)).toBe(false); // ignorovaná dávka
    quiet(d, 1050, 2050);
    expect(d.update(20, 2100)).toBe(false); // prvá nová dávka
    quiet(d, 2150, 2450);
    expect(d.update(20, 2500)).toBe(true);
  });
  it('(f) presné hranice: quietMs ukončí dávku, window ešte spustí', () => {
    const d = createShakeDetector();
    d.update(20, 0);
    d.update(0, 100);
    d.update(0, 250); // presne 150 ms ticha -> dávka skončila
    expect(d.update(20, 1200)).toBe(true); // presne window po začiatku
    const e = createShakeDetector();
    e.update(20, 0);
    e.update(0, 100);
    e.update(0, 249); // 149 ms -> dávka trvá
    expect(e.update(20, 300)).toBe(false);
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
