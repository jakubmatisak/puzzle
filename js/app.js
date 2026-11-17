/**
 * Vstupný bod aplikácie: preklady, prepínanie jazyka, router, domovská obrazovka
 * a zatiaľ jednoduché otvorenie úlohy podľa ID (#/play/<kategória>?puzzle=<id>).
 */
import { createStorage } from './core/storage.js';
import { createI18n } from './core/i18n.js';
import { createQueue } from './core/queue.js';
import { loadPuzzles } from './core/puzzles.js';
import { createState, movesUsed } from './core/puzzle-state.js';
import { startRouter } from './ui/router.js';
import { createBoard } from './ui/board.js';

const VIEWS = ['home', 'play', 'help'];
const SVG_NS = 'http://www.w3.org/2000/svg';

const storage = createStorage();
const i18n = createI18n(storage);
const queue = createQueue(storage);

let data = null;
let loadFailed = false;
let currentRoute = { view: 'home' };
let firstRoute = true;
let puzzle = null; // práve otvorená úloha
let board = null;

const TIP_KEY = 'zapalkovo.rotateTipDismissed';
const WIDE_RATIO = 2.5; // od tohto pomeru šírka/výška je úloha „široká“

/** Rozloží zápis „attr:kľúč;attr2:kľúč2“ na dvojice [atribút, kľúč]. */
function parseAttrSpec(spec) {
  return spec.split(';')
    .map((part) => part.split(':').map((s) => s.trim()))
    .filter(([attr, key]) => attr && key);
}

/** Prečíta parametre prekladu z data-i18n-params (JSON); chybný JSON = žiadne parametre. */
function readParams(el) {
  try {
    return JSON.parse(el.dataset.i18nParams || '{}');
  } catch {
    return {};
  }
}

/** Preloží všetky prvky s data-i18n (text) a data-i18n-attr (atribúty). */
function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = i18n.t(el.dataset.i18n, readParams(el));
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    parseAttrSpec(el.dataset.i18nAttr).forEach(([attr, key]) => el.setAttribute(attr, i18n.t(key)));
  });
  document.documentElement.lang = i18n.lang;
}

/** Vytvorí SVG prvok s atribútmi. */
function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  return el;
}

/** Jedna zápalka (palička + hlavička) so stredom v (x, y) a uhlom v stupňoch. */
function matchShape(x, y, angle, extraClass = '') {
  const g = svgEl('g', { transform: `translate(${x} ${y}) rotate(${angle})`, class: `art-match ${extraClass}`.trim() });
  g.append(
    svgEl('rect', { x: -50, y: -6, width: 88, height: 12, rx: 5, class: 'art-stick' }),
    svgEl('ellipse', { cx: 40, cy: 0, rx: 13, ry: 10, class: 'art-head' }),
  );
  return g;
}

/** Zápalky ilustrácie pre každú kategóriu: [x, y, uhol, trieda?]. */
const ART = {
  // „1+1=2“
  numbers: {
    viewBox: '-20 -20 540 270',
    ghost: [380, 150, 90],
    matches: [
      [20, 50, 90], [20, 150, 90],
      [110, 100, 0], [110, 100, 90],
      [200, 50, 90], [200, 150, 90],
      [290, 80, 0], [290, 120, 0],
      [430, 0, 0], [480, 50, 90], [430, 100, 0], [430, 200, 0],
      [300, 225, -8, 'is-lifted'],
    ],
  },
  // „XIV“
  roman: {
    viewBox: '-10 20 300 160',
    ghost: [125, 100, 90],
    matches: [
      [50, 100, 62], [50, 100, 118],
      [170, 100, 75], [196, 100, 105],
      [245, 150, -35, 'is-lifted'],
    ],
  },
  // mriežka 2×2 bez jednej zápalky
  logic: {
    viewBox: '-20 -20 300 240',
    ghost: [150, 100, 0],
    matches: [
      [50, 0, 0], [150, 0, 0], [50, 100, 0], [50, 200, 0], [150, 200, 0],
      [0, 50, 90], [100, 50, 90], [200, 50, 90],
      [0, 150, 90], [100, 150, 90], [200, 150, 90],
      [240, 112, -20, 'is-lifted'],
    ],
  },
};

/** Ilustrácia karty kategórie: zápalky a prerušovaná stopa po „zdvihnutej“ zápalke. */
function categoryArt(categoryId) {
  const art = ART[categoryId] ?? ART.logic;
  const svg = svgEl('svg', { viewBox: art.viewBox, class: 'card-art-svg', 'aria-hidden': 'true', focusable: 'false' });
  const [gx, gy, ga] = art.ghost;
  svg.append(svgEl('rect', {
    x: -50, y: -6, width: 100, height: 12, rx: 5, class: 'art-ghost',
    transform: `translate(${gx} ${gy}) rotate(${ga})`,
  }));
  art.matches.forEach(([x, y, a, cls]) => svg.append(matchShape(x, y, a, cls)));
  return svg;
}

/** Rad malých zápaliek: rozsvietené = vyriešené úlohy. */
function tally(solved, total) {
  const row = document.createElement('span');
  row.className = 'tally';
  row.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < total; i += 1) {
    const stick = document.createElement('span');
    stick.className = i < solved ? 'tally-match is-lit' : 'tally-match';
    row.append(stick);
  }
  return row;
}

/** Vytvorí prvok s triedou a textom. */
function textEl(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

/** Jedna karta kategórie ako odkaz na #/play/<id>. */
function categoryCard(category, index) {
  const ids = data.puzzles.filter((p) => p.category === category.id).map((p) => p.id);
  const solved = queue.solvedCount(category.id, ids);
  const link = document.createElement('a');
  link.className = 'category-card';
  link.href = `#/play/${encodeURIComponent(category.id)}`;
  link.dataset.category = category.id;

  const art = document.createElement('span');
  art.className = 'card-art';
  art.append(categoryArt(category.id));

  const progress = document.createElement('span');
  progress.className = 'card-progress';
  progress.append(
    tally(solved, ids.length),
    textEl('span', 'card-progress-text', i18n.t('home.solved', { n: solved, total: ids.length })),
  );

  const cta = textEl('span', 'card-cta', i18n.t('home.play'));
  cta.append(svgIcon('i-next', 'card-cta-arrow'));

  link.append(
    textEl('span', 'card-no', i18n.t('home.cardNo', { n: index + 1 })),
    art,
    textEl('span', 'card-title', i18n.pick(category.name)),
    textEl('span', 'card-desc', i18n.pick(category.description)),
    progress,
    cta,
  );
  const item = document.createElement('li');
  item.append(link);
  return item;
}

/** Ikona zo sprite cez <use>. */
function svgIcon(id, extraClass = '') {
  const svg = svgEl('svg', { class: `icon ${extraClass}`.trim(), 'aria-hidden': 'true', focusable: 'false' });
  svg.append(svgEl('use', { href: `#${id}` }));
  return svg;
}

/** Vykreslí karty kategórií (alebo stav načítania / chybu). */
function renderHome() {
  const list = document.getElementById('categories');
  const status = document.getElementById('categories-status');
  if (!data) {
    status.dataset.i18n = loadFailed ? 'home.error' : 'home.loading';
    status.textContent = i18n.t(status.dataset.i18n);
    status.hidden = false;
    list.replaceChildren();
    return;
  }
  status.hidden = true;
  list.replaceChildren(...data.categories.map((c, i) => categoryCard(c, i)));
}

/** Nadpis hernej obrazovky: názov kategórie, ak je známa. */
function renderPlayTitle() {
  const title = document.getElementById('play-title');
  const category = data?.categories.find((c) => c.id === currentRoute.category);
  title.textContent = category ? i18n.pick(category.name) : i18n.t('game.title');
}

/** Aktualizuje počítadlo ťahov „Ťahy: n / max“. */
function renderMoves() {
  const moves = document.getElementById('moves');
  const params = { n: puzzle ? movesUsed(board.getState(), puzzle) : 0, max: puzzle ? puzzle.moves : '–' };
  moves.dataset.i18nParams = JSON.stringify(params);
  moves.textContent = i18n.t('game.moves', params);
}

/** Zobrazí text zadania úlohy (alebo „Načítavam úlohu…“). */
function renderTask() {
  const task = document.getElementById('task-text');
  if (puzzle) {
    delete task.dataset.i18n;
    task.textContent = i18n.pick(puzzle.task);
  } else {
    task.dataset.i18n = 'game.loading';
    task.textContent = i18n.t('game.loading');
  }
}

/** Zobrazí hlášku pod doskou (prázdny kľúč = vymaže ju). */
function showMessage(key) {
  document.getElementById('message').textContent = key ? i18n.t(key) : '';
}

/** Tip „otoč telefón“ pre široké úlohy; CSS ho ukáže iba na úzkom displeji na výšku. */
function renderRotateTip() {
  const { w, h } = puzzle.board.bounds;
  document.getElementById('rotate-tip').hidden = storage.get(TIP_KEY, false) || w / h <= WIDE_RATIO;
}

/** Zavrie tip a zapamätá si to. */
function dismissRotateTip() {
  storage.set(TIP_KEY, true);
  document.getElementById('rotate-tip').hidden = true;
}

/** Otvorí úlohu podľa ID z trasy; neznáme ID vedie na domov. */
function openPuzzle(route) {
  if (!data || !route.puzzleId || puzzle?.id === route.puzzleId) return;
  const found = data.puzzles.find((p) => p.id === route.puzzleId);
  if (!found) {
    window.location.hash = '#/';
    return;
  }
  puzzle = found;
  board.load(puzzle, createState(puzzle));
  renderTask();
  renderMoves();
  renderRotateTip();
  showMessage('');
}

/** Zobrazí práve jednu obrazovku podľa trasy a označí aktívny odkaz v navigácii. */
function showView(route) {
  currentRoute = route;
  VIEWS.forEach((name) => {
    document.getElementById(`view-${name}`).hidden = name !== route.view;
  });
  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === route.view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (route.view === 'play') {
    renderPlayTitle();
    openPuzzle(route);
  }
  if (!firstRoute) focusHeading(route.view);
  firstRoute = false;
}

/** Po prechode na inú obrazovku presunie fokus na jej viditeľný nadpis h1. */
function focusHeading(view) {
  const heading = [...document.querySelectorAll(`#view-${view} h1`)]
    .find((h) => h.getClientRects().length > 0);
  window.scrollTo(0, 0);
  heading?.focus({ preventScroll: true });
}

/** Prepne jazyk SK ↔ EN a prekreslí texty. */
function toggleLanguage() {
  i18n.setLang(i18n.lang === 'sk' ? 'en' : 'sk');
  applyTranslations();
  renderHome();
  if (currentRoute.view === 'play') renderPlayTitle();
  if (puzzle) {
    renderTask();
    board.setState(board.getState());
  }
}

/** Spustí aplikáciu. */
async function init() {
  applyTranslations();
  document.getElementById('lang-toggle').addEventListener('click', toggleLanguage);
  document.querySelectorAll('[data-action="print"]').forEach((btn) => {
    btn.addEventListener('click', () => window.print());
  });
  board = createBoard(document.getElementById('board'), {
    onChange: () => {
      showMessage('');
      renderMoves();
    },
    onHint: showMessage,
    t: i18n.t,
  });
  // Testovací háčik pre E2E testy (napr. animatePlan); na verejnom serveri neexistuje.
  if (window.location.hostname === 'localhost') window.__zapalkovoBoard = board;
  document.querySelector('[data-action="rotate"]').addEventListener('click', () => board.rotateSelected());
  document.querySelector('.rotate-tip-close').addEventListener('click', dismissRotateTip);
  startRouter(showView);
  try {
    data = await loadPuzzles();
  } catch (error) {
    loadFailed = true;
    console.error(error);
  }
  renderHome();
  if (currentRoute.view === 'play') {
    renderPlayTitle();
    openPuzzle(currentRoute);
  }
}

init();
