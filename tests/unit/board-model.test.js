import { describe, it, expect } from 'vitest';
import { buildBoard, trayPosition } from '../../js/core/board-model.js';
import { gridSlots } from '../../js/core/lattice.js';

describe('buildBoard', () => {
  const board = buildBoard(gridSlots(2, 2));
  it('má slotById a všetky sloty', () => {
    expect(board.slots.length).toBe(12);
    expect(board.slotById.get('h0-0').x).toBe(50);
  });
  it('bounds = obálka koncových bodov + padding', () => {
    expect(board.bounds.x).toBeCloseTo(-60);
    expect(board.bounds.y).toBeCloseTo(-60);
    expect(board.bounds.w).toBeCloseTo(320);
    expect(board.bounds.h).toBeCloseTo(320);
  });
  it('odkladacia plocha je pod hracou plochou', () => {
    expect(board.tray.x).toBeCloseTo(board.bounds.x);
    expect(board.tray.y).toBeCloseTo(board.bounds.y + board.bounds.h);
    expect(board.tray.w).toBeCloseTo(board.bounds.w);
    expect(board.tray.h).toBe(160);
  });
  it('rešpektuje vlastný padding a trayHeight', () => {
    const b = buildBoard(gridSlots(1, 1), { padding: 10, trayHeight: 50 });
    expect(b.bounds.w).toBeCloseTo(120);
    expect(b.tray.h).toBe(50);
  });
});

describe('trayPosition', () => {
  const board = buildBoard(gridSlots(2, 2));
  it('k-ta pozícia v mriežke po 30', () => {
    const p0 = trayPosition(board, 0);
    const p1 = trayPosition(board, 1);
    expect(p0.x).toBeCloseTo(board.tray.x + 20);
    expect(p0.y).toBeCloseTo(board.tray.y + 80);
    expect(p1.x - p0.x).toBe(30);
    expect(p1.y).toBe(p0.y);
  });
  it('pri pretečení riadku posunie y', () => {
    const cols = Math.floor((board.tray.w - 40) / 30) + 1;
    const p = trayPosition(board, cols);
    expect(p.x).toBeCloseTo(board.tray.x + 20);
    expect(p.y).toBeCloseTo(board.tray.y + 80 + 10);
  });
});
