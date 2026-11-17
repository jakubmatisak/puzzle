/**
 * Model hracej plochy: obálka slotov a odkladacia plocha pod nimi.
 */

const HALF = 50; // polovica dĺžky zápalky

/**
 * Obdĺžnik, ktorý obalí koncové body všetkých slotov.
 * @param {{x:number,y:number,angle:number}[]} slots
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}}
 */
function segmentExtent(slots) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of slots) {
    const rad = (s.angle * Math.PI) / 180;
    const dx = HALF * Math.cos(rad);
    const dy = HALF * Math.sin(rad);
    for (const [px, py] of [[s.x - dx, s.y - dy], [s.x + dx, s.y + dy]]) {
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Zostaví dosku: sloty, vyhľadávanie podľa id, hranice a odkladaciu plochu.
 * @param {{id:string,x:number,y:number,angle:number}[]} slots
 * @param {{padding?:number, trayHeight?:number}} [opts] okraj (60) a výška odkladacej plochy (160)
 * @returns {{slots:object[], slotById:Map<string,object>, bounds:object, tray:object}}
 */
export function buildBoard(slots, { padding = 60, trayHeight = 160 } = {}) {
  const e = segmentExtent(slots);
  const bounds = {
    x: e.minX - padding,
    y: e.minY - padding,
    w: e.maxX - e.minX + 2 * padding,
    h: e.maxY - e.minY + 2 * padding,
  };
  const tray = { x: bounds.x, y: bounds.y + bounds.h, w: bounds.w, h: trayHeight };
  return { slots, slotById: new Map(slots.map((s) => [s.id, s])), bounds, tray };
}

/**
 * K-te parkovacie miesto v odkladacej ploche (mriežka po 30 jednotkách).
 * Pri pretečení riadku sa miesta mierne posúvajú v y.
 * @param {{tray:{x:number,y:number,w:number,h:number}}} board
 * @param {number} k poradie miesta od 0
 * @returns {{x:number, y:number}}
 */
export function trayPosition(board, k) {
  const { tray } = board;
  const cols = Math.max(1, Math.floor((tray.w - 40) / 30) + 1);
  return {
    x: tray.x + 20 + (k % cols) * 30,
    y: tray.y + tray.h / 2 + Math.floor(k / cols) * 10,
  };
}
