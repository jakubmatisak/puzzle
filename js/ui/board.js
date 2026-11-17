/**
 * SVG hracia plocha: kreslenie slotov, odkladacej plochy a zápaliek
 * a ich ovládanie myšou, prstom (Pointer Events) aj klávesnicou.
 * Stav úlohy sa mení iba cez funkcie z puzzle-state.js.
 */
import {
  angleDiff, distance, findSnapSlot, rotateStep, segmentDistance,
} from '../core/geometry.js';
import {
  moveToSlot, moveToTray, occupied, rotateMatch, trayMatches, trayPosition,
} from '../core/puzzle-state.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HALF = 50; // polovica dĺžky zápalky
const CLICK_PX = 8; // menší pohyb prsta/myši (v CSS px) je klik, nie ťah
const GRAB_PX = 22; // zápalku chytí stlačenie do 22 CSS px od jej osi
const DOUBLE_CLICK_MS = 300;
const KEY_STEP = 10; // posun šípkou
const SNAP = { radius: 45, maxAngle: 23 };

/** Vytvorí SVG prvok s atribútmi. */
function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  return el;
}

/** Zaokrúhli na 2 desatinné miesta (kratšie atribúty transform). */
function round(n) {
  return Math.round(n * 100) / 100;
}

/** Text atribútu transform pre zápalku so stredom (x, y) a uhlom. */
function transformOf(x, y, angle) {
  return `translate(${round(x)} ${round(y)}) rotate(${round(angle)})`;
}

/** Gradienty paličky a hlavičky zápalky (farby nastavuje CSS cez triedy stop-*). */
function createDefs() {
  const defs = svgEl('defs');
  const stick = svgEl('linearGradient', { id: 'stick', x1: 0, y1: 0, x2: 0, y2: 1 });
  [[0, 'stop-stick-hi'], [0.35, 'stop-stick-1'], [1, 'stop-stick-2']].forEach(([offset, cls]) => {
    stick.append(svgEl('stop', { offset, class: cls }));
  });
  const head = svgEl('radialGradient', { id: 'head', cx: 0.35, cy: 0.3, r: 0.8 });
  [[0, 'stop-head-hi'], [0.45, 'stop-head-1'], [1, 'stop-head-2']].forEach(([offset, cls]) => {
    head.append(svgEl('stop', { offset, class: cls }));
  });
  defs.append(stick, head);
  return defs;
}

/** Prerušovaná čiara slotu (úsečka dĺžky 100 so stredom v slote). */
function createSlot(slot) {
  const rad = (slot.angle * Math.PI) / 180;
  const dx = HALF * Math.cos(rad);
  const dy = HALF * Math.sin(rad);
  return svgEl('line', {
    class: 'slot',
    'data-slot': slot.id,
    x1: round(slot.x - dx), y1: round(slot.y - dy),
    x2: round(slot.x + dx), y2: round(slot.y + dy),
  });
}

/** Skupina zápalky: palička a zaoblená hlavička. */
function createMatch(match) {
  const g = svgEl('g', { class: 'match', 'data-match': match.id, tabindex: 0, role: 'button' });
  g.append(
    svgEl('rect', { class: 'match-stick', x: -50, y: -5, width: 88, height: 10, rx: 4 }),
    svgEl('ellipse', { class: 'match-head', cx: 40, cy: 0, rx: 11, ry: 8 }),
  );
  return g;
}

/** Leží bod vnútri obdĺžnika {x, y, w, h}? */
function insideRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/** Bod posunutý dovnútra odkladacej plochy tak, aby sa zvislá zápalka zmestila. */
function clampToTray(p, tray) {
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  return {
    x: clamp(p.x, tray.x + 20, tray.x + tray.w - 20),
    y: clamp(p.y, tray.y + HALF + 12, tray.y + tray.h - HALF - 12),
  };
}

/** Uhol medzi a a b pre animáciu: ide kratšou cestou (zápalka je symetrická, mod 180). */
function lerpAngle(a, b, t) {
  let d = (((b - a) % 180) + 180) % 180;
  if (d > 90) d -= 180;
  return a + d * t;
}

/** Plynulé spomalenie na konci animácie. */
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

/** Má používateľ zapnuté obmedzenie pohybu? */
function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Vytvorí hraciu plochu v danom <svg>.
 * @param {SVGSVGElement} svg prvok, do ktorého sa kreslí
 * @param {{onChange?:(state:object)=>void, onHint?:(key:string)=>void, t?:(key:string, params?:object)=>string}} [opts]
 *   onChange po každej zmene stavu, onHint s kľúčom hlášky, t na preklad popisov
 * @returns {object} API dosky (load, setState, getState, getSelected, rotateSelected,
 *   animatePlan, getDragInfo, setInteractive)
 */
export function createBoard(svg, { onChange = () => {}, onHint = () => {}, t = (key) => key } = {}) {
  let board = null;
  let state = { matches: [] };
  let selected = null;
  let drag = null; // {matchId, pointerId|null, x, y, angle, offset, start, moved}
  let lastClick = null; // {matchId, time}
  let interactive = true;
  let animating = false;
  let generation = 0; // zvýšenie zastaví bežiacu animáciu riešenia
  const matchEls = new Map();
  const slotEls = new Map();
  const layers = { slots: svgEl('g', { class: 'slots' }), tray: svgEl('g'), matches: svgEl('g', { class: 'matches' }) };

  // ---------- kreslenie ----------

  /** Odkladacia plocha: obdĺžnik s popisom. */
  function drawTray() {
    const { tray } = board;
    const label = svgEl('text', { class: 'tray-label', x: tray.x + 22, y: tray.y + 34 });
    label.textContent = t('board.tray');
    layers.tray.replaceChildren(
      svgEl('rect', {
        class: 'tray', x: tray.x + 8, y: tray.y + 8, width: tray.w - 16, height: tray.h - 16, rx: 16,
      }),
      label,
    );
  }

  /** Nastaví viewBox podľa hraníc dosky a odkladacej plochy. */
  function setViewBox() {
    const { bounds, tray } = board;
    svg.setAttribute('viewBox', [bounds.x, bounds.y, bounds.w, bounds.h + tray.h].map(round).join(' '));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }

  /** Nakreslí celú dosku nanovo (pri načítaní úlohy). */
  function build() {
    setViewBox();
    slotEls.clear();
    layers.slots.replaceChildren(...board.slots.map((s) => {
      const line = createSlot(s);
      slotEls.set(s.id, line);
      return line;
    }));
    drawTray();
    matchEls.clear();
    layers.matches.replaceChildren(...state.matches.map((m) => {
      const g = createMatch(m);
      matchEls.set(m.id, g);
      return g;
    }));
    svg.replaceChildren(createDefs(), layers.slots, layers.tray, layers.matches);
    render();
  }

  /** Prenesie stav do atribútov zápaliek (poloha, slot, popis, výber). */
  function render() {
    state.matches.forEach((m, i) => {
      const g = matchEls.get(m.id);
      const pos = drag?.matchId === m.id ? drag : m;
      g.setAttribute('transform', transformOf(pos.x, pos.y, pos.angle));
      g.setAttribute('data-slot', m.slot ?? '');
      g.setAttribute('aria-label', t('board.match', { n: i + 1 }));
      g.classList.toggle('match-selected', m.id === selected);
      g.classList.toggle('is-dragging', drag?.matchId === m.id && drag.moved);
    });
    highlight(drag?.moved ? candidateSlot() : null);
  }

  /** Zvýrazní cieľový slot počas ťahu (null = žiadny). */
  function highlight(slot) {
    slotEls.forEach((line, id) => line.classList.toggle('slot-target', slot?.id === id));
  }

  /** Presunie zápalku navrch (kreslí sa posledná); fokus jej zostane. */
  function bringToFront(matchId) {
    const g = matchEls.get(matchId);
    if (layers.matches.lastChild === g) return;
    const hadFocus = document.activeElement === g;
    layers.matches.append(g);
    if (hadFocus) g.focus({ preventScroll: true });
  }

  // ---------- stav ----------

  /** Zastaví prípadnú animáciu riešenia (bežiace kroky už nič nezapíšu). */
  function cancelAnimation() {
    generation += 1;
    animating = false;
  }

  /** Nájde zápalku v stave podľa id. */
  function findMatch(matchId) {
    return state.matches.find((m) => m.id === matchId);
  }

  /** Zapíše nový stav, prekreslí a oznámi zmenu. */
  function commit(next) {
    state = next;
    render();
    onChange(state);
  }

  /** Označí zápalku ako vybranú (null = nič). */
  function select(matchId) {
    selected = matchId;
    render();
  }

  /** Otočí zápalku o 45° (rotateMatch) a oznámi zmenu. */
  function rotate(matchId) {
    if (!findMatch(matchId)) return;
    commit(rotateMatch(state, matchId, board));
  }

  // ---------- ťahanie ----------

  /** Koľko CSS px má jedna jednotka SVG (doska sa škáluje rovnako v x aj y). */
  function screenScale() {
    const m = svg.getScreenCTM();
    return Math.hypot(m.a, m.b) || 1;
  }

  /** Najbližšia zápalka do GRAB_PX od bodu; pri zhode vyhrá tá kreslená vyššie. */
  function nearestMatch(p) {
    const limit = GRAB_PX / screenScale();
    let best = null;
    let bestDist = Infinity;
    for (const g of layers.matches.children) {
      const d = segmentDistance(p, findMatch(g.dataset.match), HALF);
      if (d <= limit && d <= bestDist) {
        best = g.dataset.match;
        bestDist = d;
      }
    }
    return best;
  }

  /** Prepočet bodu z obrazovky do súradníc SVG. */
  function toSvgPoint(clientX, clientY) {
    const p = new DOMPoint(clientX, clientY).matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  }

  /** Obsadené sloty okrem slotu ťahanej zápalky. */
  function occupiedByOthers(matchId) {
    const set = occupied(state);
    const own = findMatch(matchId)?.slot;
    if (own) set.delete(own);
    return set;
  }

  /** Slot, do ktorého by ťahaná zápalka práve zapadla (alebo null). */
  function candidateSlot() {
    if (!drag) return null;
    return findSnapSlot(drag, board.slots, occupiedByOthers(drag.matchId), SNAP);
  }

  /** Je v dosahu voľný slot, ktorý má iba inú orientáciu? */
  function needsRotation() {
    const taken = occupiedByOthers(drag.matchId);
    return board.slots.some((s) => !taken.has(s.id)
      && distance(drag, s) <= SNAP.radius && angleDiff(drag.angle, s.angle) > SNAP.maxAngle);
  }

  /** Začne ťah zápalky (pointerId null = klávesnica; client = bod na obrazovke). */
  function startDrag(matchId, pointerId, grab, client) {
    const m = findMatch(matchId);
    drag = {
      matchId, pointerId, x: m.x, y: m.y, angle: m.angle,
      offset: grab ? { x: grab.x - m.x, y: grab.y - m.y } : { x: 0, y: 0 },
      client,
      moved: false,
    };
  }

  /** Posunie ťahanú zápalku na nové miesto. */
  function moveDrag(x, y) {
    if (!drag.moved) {
      drag.moved = true;
      bringToFront(drag.matchId);
    }
    drag.x = x;
    drag.y = y;
    render();
  }

  /** Zruší ťah a vráti zápalku na pôvodné miesto. */
  function revert() {
    if (!drag) return;
    drag = null;
    render();
  }

  /** Pustenie zápalky: slot, odkladacia plocha, alebo návrat späť. */
  function drop() {
    const current = drag;
    const snap = candidateSlot();
    const hint = !snap && needsRotation();
    drag = null;
    const m = findMatch(current.matchId);
    if (snap && snap.id !== m.slot) commit(moveToSlot(state, m.id, snap.id, board));
    else if (!snap && insideRect(current, board.tray)) {
      commit(moveToTray(state, m.id, clampToTray(current, board.tray)));
    } else render();
    if (hint) onHint('game.needRotate');
  }

  /** Klik bez pohybu: dva kliky na tú istú zápalku do 300 ms = otočenie. */
  function click(matchId, time) {
    if (lastClick && lastClick.matchId === matchId && time - lastClick.time <= DOUBLE_CLICK_MS) {
      lastClick = null;
      rotate(matchId);
      return;
    }
    lastClick = { matchId, time };
  }

  // ---------- udalosti ----------

  /** Zápalka pod udalosťou (alebo null). */
  function matchFromEvent(event) {
    const g = event.target.closest?.('.match');
    return g && matchEls.get(g.dataset.match) === g ? g.dataset.match : null;
  }

  /** Smie hráč práve ovládať dosku? */
  function canInteract() {
    return interactive && !animating && board !== null;
  }

  /** Stlačenie kdekoľvek na doske chytí najbližšiu zápalku (tenké zápalky sa chytajú ľahko). */
  function onPointerDown(event) {
    if (!canInteract() || drag) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const p = toSvgPoint(event.clientX, event.clientY);
    const matchId = nearestMatch(p);
    if (!matchId) {
      select(null);
      return;
    }
    matchEls.get(matchId).focus({ preventScroll: true });
    select(matchId);
    startDrag(matchId, event.pointerId, p, { x: event.clientX, y: event.clientY });
    svg.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      revert(); // tlačidlo bolo pustené mimo nás (napr. mimo okna)
      return;
    }
    const moved = distance({ x: event.clientX, y: event.clientY }, drag.client);
    if (!drag.moved && moved < CLICK_PX) return;
    const p = toSvgPoint(event.clientX, event.clientY);
    moveDrag(p.x - drag.offset.x, p.y - drag.offset.y);
  }

  function onPointerUp(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      lastClick = null;
      drop();
      return;
    }
    const { matchId } = drag;
    drag = null;
    click(matchId, event.timeStamp);
  }

  /** pointercancel aj strata zachytenia ukazovateľa = návrat zápalky. */
  function onPointerAbort(event) {
    if (drag && drag.pointerId === event.pointerId) revert();
  }

  /** Šípky posúvajú, Enter pustí, Escape vráti, R otočí. */
  function onKeyDown(event) {
    const matchId = matchFromEvent(event);
    if (!matchId || !canInteract()) return;
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const ownDrag = drag && drag.matchId === matchId;
    if (arrows[event.key]) {
      if (drag && !ownDrag) return;
      if (!drag) startDrag(matchId, null, null, null);
      const [dx, dy] = arrows[event.key];
      moveDrag(drag.x + dx * KEY_STEP, drag.y + dy * KEY_STEP);
    } else if (event.key === 'Enter' && ownDrag && drag.moved) {
      drop();
    } else if (event.key === 'Escape' && drag) {
      revert();
    } else if (event.key === 'r' || event.key === 'R') {
      if (ownDrag) {
        drag.angle = rotateStep(drag.angle);
        render();
      } else if (!drag) rotate(matchId);
    } else return;
    event.preventDefault();
  }

  /** Fokus na zápalke ju vyberie; odchod fokusu zruší rozpracovaný ťah klávesnicou. */
  function onFocusIn(event) {
    const matchId = matchFromEvent(event);
    if (matchId && selected !== matchId) select(matchId);
  }

  function onFocusOut(event) {
    if (drag && drag.pointerId === null && matchFromEvent(event) === drag.matchId) revert();
  }

  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', onPointerUp);
  svg.addEventListener('pointercancel', onPointerAbort);
  svg.addEventListener('lostpointercapture', onPointerAbort);
  svg.addEventListener('keydown', onKeyDown);
  svg.addEventListener('focusin', onFocusIn);
  svg.addEventListener('focusout', onFocusOut);
  svg.addEventListener('dblclick', (event) => event.preventDefault());
  // Okno stratilo fokus alebo sa skrylo: rozpracovaný ťah sa vráti.
  window.addEventListener('blur', revert);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) revert();
  });

  // ---------- animácia riešenia ----------

  /** Plynulo presunie kresbu zápalky; skončí aj vtedy, keď sa zmení token animácie. */
  function tween(matchId, from, to, ms, token) {
    const g = matchEls.get(matchId);
    return new Promise((resolve) => {
      const t0 = performance.now();
      const frame = (now) => {
        if (token !== generation) {
          resolve();
          return;
        }
        const k = easeInOut(Math.min(1, (now - t0) / ms));
        g.setAttribute('transform', transformOf(
          from.x + (to.x - from.x) * k,
          from.y + (to.y - from.y) * k,
          lerpAngle(from.angle, to.angle, k),
        ));
        if (k < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  /** Dá sa krok vykonať? Zastaraný krok (prázdny zdroj, neznámy/obsadený cieľ) vypíše varovanie. */
  function stepMatch(step) {
    const m = state.matches.find((x) => x.slot === step.from);
    const toTray = step.to === 'tray';
    const free = toTray || (board.slotById.has(step.to) && !occupied(state).has(step.to));
    if (m && free) return m;
    console.warn(`animatePlan: preskakujem krok ${step.from} -> ${step.to}`);
    return null;
  }

  /** Jeden krok plánu: animácia a potom zápis do stavu (iba ak animáciu nikto nezastavil). */
  async function playStep(step, trayIndex, ms, token) {
    const m = stepMatch(step);
    if (!m) return false;
    const toTray = step.to === 'tray';
    const target = toTray
      ? { ...trayPosition(board, trayIndex), angle: 90 }
      : board.slotById.get(step.to);
    bringToFront(m.id);
    if (ms > 0 && !prefersReducedMotion()) await tween(m.id, m, target, ms, token);
    if (token !== generation) return false;
    commit(toTray ? moveToTray(state, m.id, target) : moveToSlot(state, m.id, step.to, board));
    return toTray;
  }

  // ---------- verejné API ----------

  return {
    /**
     * Načíta úlohu a jej stav a nakreslí dosku.
     * @param {object} puzzle normalizovaná úloha
     * @param {{matches:object[]}} nextState
     */
    load(puzzle, nextState) {
      cancelAnimation();
      board = puzzle.board;
      state = nextState;
      selected = null;
      drag = null;
      lastClick = null;
      build();
    },
    /** Nastaví nový stav (napr. po resete) a prekreslí; nevolá onChange. */
    setState(nextState) {
      cancelAnimation();
      drag = null;
      const ids = state.matches.map((m) => m.id).join();
      state = nextState;
      if (board && ids !== state.matches.map((m) => m.id).join()) build();
      else if (board) {
        drawTray();
        render();
      }
    },
    /** Aktuálny stav dosky. */
    getState() {
      return state;
    },
    /** Id vybranej zápalky alebo null. */
    getSelected() {
      return selected;
    },
    /** Otočí vybranú zápalku (tlačidlo „Otočiť“). */
    rotateSelected() {
      if (selected && canInteract() && !drag) rotate(selected);
    },
    /**
     * Prehrá plán riešenia: kroky {from: slot, to: slot|'tray'} postupne.
     * Predchádzajúcu animáciu zastaví; load/setState/setInteractive zastavia túto.
     * @param {{from:string, to:string}[]} plan
     * @param {number} [ms] trvanie jedného kroku
     * @returns {Promise<void>}
     */
    async animatePlan(plan, ms = 600) {
      cancelAnimation();
      revert();
      render(); // zahodí rozpracovanú polohu prípadnej zastavenej animácie
      const token = generation;
      animating = true;
      let trayIndex = trayMatches(state).length;
      try {
        for (const step of plan) {
          if (await playStep(step, trayIndex, ms, token)) trayIndex += 1;
          if (token !== generation) return;
        }
      } finally {
        if (token === generation) animating = false;
      }
    },
    /** Poloha práve ťahanej zápalky alebo null. */
    getDragInfo() {
      if (!drag || !drag.moved) return null;
      return { matchId: drag.matchId, x: drag.x, y: drag.y, angle: drag.angle };
    },
    /** Zapne/vypne ovládanie hráčom; zastaví animáciu, vypnutie zruší aj rozpracovaný ťah. */
    setInteractive(on) {
      cancelAnimation();
      interactive = Boolean(on);
      if (!interactive) revert();
    },
  };
}
