/**
 * Kreslenie scény do <canvas> (na nahrávanie videa). Vzhľad zodpovedá SVG doske
 * (tmavé drevo, zápalky s gradientom a červenou hlavičkou), farby sú pevné
 * v oboch farebných témach. Nezávisí od DOM – dostane iba 2D kontext.
 */
import { segmentEnds } from '../core/geometry.js';

export const CAPTION_H = 56; // výška pruhu s popisom úplne dole
const MIN_H = 360;
const MAX_H = 960;
const FONT = 'system-ui, "Segoe UI", sans-serif';

const COLORS = {
  boardTop: '#3a2a20',
  boardBottom: '#2c1f17',
  guide: 'rgba(255, 240, 210, 0.22)',
  tray: 'rgba(255, 240, 210, 0.04)',
  trayLabel: 'rgba(255, 240, 210, 0.45)',
  caption: 'rgba(0, 0, 0, 0.35)',
  captionText: '#fff0d2',
  ok: '#7bd88f',
};

/**
 * Hranice obrazu v súradniciach dosky: šírka dosky a výška dosky aj s odkladacou plochou.
 * @param {{bounds:{x:number,y:number,w:number,h:number}, tray:{h:number}}} board
 * @returns {{x:number, y:number, w:number, h:number}}
 */
function viewBox(board) {
  const { bounds, tray } = board;
  return { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h + tray.h };
}

/**
 * Mierka a posun, ktorými sa doska s odkladacou plochou vojde do plátna
 * (nad pruhom s popisom), vycentrovaná – rovnaký výpočet ako viewBox v SVG.
 * @param {object} board doska {bounds, tray}
 * @param {number} width šírka plátna
 * @param {number} height výška plátna
 * @returns {{scale:number, tx:number, ty:number}} tx, ty = argumenty setTransform (e, f)
 */
export function fitTransform(board, width, height) {
  const vb = viewBox(board);
  const availH = height - CAPTION_H;
  const scale = Math.min(width / vb.w, availH / vb.h);
  const tx = (width - vb.w * scale) / 2 - vb.x * scale;
  const ty = (availH - vb.h * scale) / 2 - vb.y * scale;
  return { scale, tx, ty };
}

/**
 * Rozmery plátna pre dosku: pevná šírka, výška úmerná doske + pruh s popisom
 * (párne číslo, v rozumných medziach).
 * @param {object} board doska {bounds, tray}
 * @param {number} [width=1280]
 * @returns {{width:number, height:number}}
 */
export function canvasSize(board, width = 1280) {
  const vb = viewBox(board);
  const raw = Math.round((width * vb.h) / vb.w) + CAPTION_H;
  const height = Math.min(MAX_H, Math.max(MIN_H, raw));
  return { width, height: height - (height % 2) };
}

/** Cesta zaobleného obdĺžnika (roundRect, ak ho prehliadač pozná). */
function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Pozadie: drevo s jemným svetlom zhora (v pixeloch plátna). */
function drawBackground(ctx, width, height) {
  const wood = ctx.createLinearGradient(0, 0, width * 0.2, height);
  wood.addColorStop(0, COLORS.boardTop);
  wood.addColorStop(1, COLORS.boardBottom);
  ctx.fillStyle = wood;
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width / 2, 0, 0, width / 2, 0, width * 0.6);
  glow.addColorStop(0, 'rgba(255, 230, 190, 0.10)');
  glow.addColorStop(1, 'rgba(255, 230, 190, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

/** Čiarkované vodiace čiary slotov. */
function drawSlots(ctx, slots) {
  ctx.strokeStyle = COLORS.guide;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.setLineDash([6, 8]);
  slots.forEach((slot) => {
    const [p, q] = segmentEnds(slot);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  });
  ctx.setLineDash([]);
}

/** Odkladacia plocha: čiarkovaný obdĺžnik s popisom. */
function drawTray(ctx, tray, label) {
  roundedRectPath(ctx, tray.x + 8, tray.y + 8, tray.w - 16, tray.h - 16, 16);
  ctx.fillStyle = COLORS.tray;
  ctx.fill();
  ctx.strokeStyle = COLORS.guide;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (label) {
    ctx.fillStyle = COLORS.trayLabel;
    ctx.font = `700 18px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label.toUpperCase(), tray.x + 22, tray.y + 34);
  }
}

/** Jedna zápalka so stredom (x, y) a uhlom: tieň, palička s gradientom, hlavička s odleskom. */
function drawMatch(ctx, { x, y, angle }, lifted) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = lifted ? 10 : 4;
  ctx.shadowOffsetY = lifted ? 10 : 3;

  const stick = ctx.createLinearGradient(0, -5, 0, 5);
  stick.addColorStop(0, '#fbe3b4');
  stick.addColorStop(0.35, '#f0c27b');
  stick.addColorStop(1, '#d59a4f');
  roundedRectPath(ctx, -50, -5, 88, 10, 4);
  ctx.fillStyle = stick;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(90, 50, 20, 0.35)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  const head = ctx.createRadialGradient(36.7, -3.2, 0, 36.7, -3.2, 17);
  head.addColorStop(0, '#f2876d');
  head.addColorStop(0.45, '#d6452b');
  head.addColorStop(1, '#7a1712');
  ctx.beginPath();
  ctx.ellipse(40, 0, 11, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = head;
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 10, 5, 0.5)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(37, -3, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fill();
  ctx.restore();
}

/** Pruh s popisom úlohy (vľavo) a po vyriešení s potvrdením (vpravo), v pixeloch plátna. */
function drawCaption(ctx, scene, width, height) {
  const top = height - CAPTION_H;
  const middle = top + CAPTION_H / 2;
  ctx.fillStyle = COLORS.caption;
  ctx.fillRect(0, top, width, CAPTION_H);
  ctx.textBaseline = 'middle';
  let textWidth = width - 48;
  if (scene.solved && scene.solvedText) {
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.ok;
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(scene.solvedText, width - 24, middle);
    textWidth -= ctx.measureText(scene.solvedText).width + 24;
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.captionText;
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText(scene.title ?? '', 24, middle, textWidth);
}

/**
 * Nakreslí celú scénu: pozadie, sloty, odkladaciu plochu, zápalky (ťahaná posledná)
 * a pruh s popisom. Mierku počíta sama, aby sa doska vošla do plátna.
 * @param {CanvasRenderingContext2D} ctx 2D kontext
 * @param {{board:object, matches:object[], drag:?{matchId:string,x:number,y:number,angle:number},
 *   solved?:boolean, title?:string, solvedText?:string, trayLabel?:string}} scene
 * @param {{width:number, height:number}} size rozmery plátna v pixeloch
 */
export function drawScene(ctx, scene, { width, height }) {
  const { board, matches, drag } = scene;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBackground(ctx, width, height);

  const { scale, tx, ty } = fitTransform(board, width, height);
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, tx, ty);
  drawSlots(ctx, board.slots);
  drawTray(ctx, board.tray, scene.trayLabel);
  matches.filter((m) => m.id !== drag?.matchId).forEach((m) => drawMatch(ctx, m, false));
  if (drag) drawMatch(ctx, drag, true);
  ctx.restore();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawCaption(ctx, scene, width, height);
}
