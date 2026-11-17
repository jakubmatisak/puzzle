/**
 * Mriežky pre logické úlohy: štvorcová a trojuholníková sieť zápaliek
 * a počítanie útvarov (štvorcov, trojuholníkov) zložených z obsadených hrán.
 */

const STEP = 100;
const ROW_H = 86.6;

/**
 * Sloty štvorcovej mriežky rows x cols (vodorovné h, zvislé v).
 * @param {number} rows počet riadkov buniek
 * @param {number} cols počet stĺpcov buniek
 * @returns {{id:string,x:number,y:number,angle:number}[]}
 */
export function gridSlots(rows, cols) {
  const slots = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push({ id: `h${r}-${c}`, x: c * STEP + 50, y: r * STEP, angle: 0 });
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols; c++) {
      slots.push({ id: `v${r}-${c}`, x: c * STEP, y: r * STEP + 50, angle: 90 });
    }
  }
  return slots;
}

/**
 * Vrchol trojuholníkovej siete v riadku r na pozícii i.
 * @param {number} n veľkosť siete
 * @param {number} r riadok vrcholu
 * @param {number} i poradie vrcholu v riadku
 * @returns {{x:number,y:number}}
 */
function vertex(n, r, i) {
  return { x: (n - r) * 50 + i * STEP, y: r * ROW_H };
}

/**
 * Slot hrany medzi dvoma vrcholmi (stred úsečky).
 * @param {string} id
 * @param {{x:number,y:number}} p
 * @param {{x:number,y:number}} q
 * @param {number} angle
 */
function edgeSlot(id, p, q, angle) {
  return { id, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, angle };
}

/**
 * Sloty trojuholníkovej siete veľkosti n (a = vodorovné, l = doľava dole, r = doprava dole).
 * @param {number} n počet riadkov trojuholníkov
 * @returns {{id:string,x:number,y:number,angle:number}[]}
 */
export function triSlots(n) {
  const slots = [];
  for (let r = 1; r <= n; r++) {
    for (let i = 0; i < r; i++) {
      slots.push(edgeSlot(`a${r}-${i}`, vertex(n, r, i), vertex(n, r, i + 1), 0));
    }
  }
  for (let r = 0; r < n; r++) {
    for (let i = 0; i <= r; i++) {
      slots.push(edgeSlot(`l${r}-${i}`, vertex(n, r, i), vertex(n, r + 1, i), 120));
      slots.push(edgeSlot(`r${r}-${i}`, vertex(n, r, i), vertex(n, r + 1, i + 1), 60));
    }
  }
  return slots;
}

/**
 * Overí, či sú všetky hrany obsadené.
 * @param {Set<string>} occ
 * @param {string[]} edges
 * @returns {boolean}
 */
function allIn(occ, edges) {
  return edges.every((e) => occ.has(e));
}

/**
 * Nájde všetky štvorce (každej veľkosti) s úplným obvodom v occ.
 * @param {Set<string>} occ obsadené sloty
 * @param {number} rows
 * @param {number} cols
 * @returns {string[][]} zoznam štvorcov, každý ako zoznam hrán
 */
export function findSquares(occ, rows, cols) {
  const found = [];
  for (let k = 1; k <= Math.min(rows, cols); k++) {
    for (let r = 0; r + k <= rows; r++) {
      for (let c = 0; c + k <= cols; c++) {
        const edges = [];
        for (let j = 0; j < k; j++) {
          edges.push(`h${r}-${c + j}`, `h${r + k}-${c + j}`);
          edges.push(`v${r + j}-${c}`, `v${r + j}-${c + k}`);
        }
        if (allIn(occ, edges)) found.push(edges);
      }
    }
  }
  return found;
}

/**
 * Nájde všetky trojuholníky (hore aj dole otočené, každej veľkosti) s úplným obvodom v occ.
 * @param {Set<string>} occ obsadené sloty
 * @param {number} n veľkosť siete
 * @returns {string[][]} zoznam trojuholníkov, každý ako zoznam hrán
 */
export function findTriangles(occ, n) {
  const found = [];
  for (let k = 1; k <= n; k++) {
    for (let r = 0; r + k <= n; r++) {
      for (let i = 0; i <= r; i++) {
        const up = [];
        for (let j = 0; j < k; j++) {
          up.push(`l${r + j}-${i}`, `r${r + j}-${i + j}`, `a${r + k}-${i + j}`);
        }
        if (allIn(occ, up)) found.push(up);
      }
      if (r < 1) continue;
      for (let i = 0; i + k <= r; i++) {
        const down = [];
        for (let j = 0; j < k; j++) {
          down.push(`a${r}-${i + j}`, `r${r + j}-${i + j}`, `l${r + j}-${i + k}`);
        }
        if (allIn(occ, down)) found.push(down);
      }
    }
  }
  return found;
}

/**
 * Splní obsadenie cieľ? Počet útvarov sa musí rovnať a pri noLoose
 * musí každá obsadená hrana patriť aspoň jednému útvaru.
 * @param {Set<string>} occ obsadené sloty
 * @param {{type:string,rows?:number,cols?:number,n?:number}} boardDef
 * @param {{shape:string,count:number,noLoose:boolean}} goal
 * @returns {boolean}
 */
export function checkShapes(occ, boardDef, goal) {
  const shapes = boardDef.type === 'grid'
    ? findSquares(occ, boardDef.rows, boardDef.cols)
    : findTriangles(occ, boardDef.n);
  if (shapes.length !== goal.count) return false;
  if (!goal.noLoose) return true;
  const used = new Set(shapes.flat());
  return [...occ].every((e) => used.has(e));
}
