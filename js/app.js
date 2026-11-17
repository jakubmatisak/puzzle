/**
 * Vstupný bod aplikácie: vytvorí služby (úložisko, preklady, fronta), hraciu plochu
 * a hru, prekladá statické texty a podľa trasy prepína obrazovky.
 */
import { createStorage } from './core/storage.js';
import { createI18n } from './core/i18n.js';
import { createQueue } from './core/queue.js';
import { loadPuzzles } from './core/puzzles.js';
import { startRouter } from './ui/router.js';
import { createBoard } from './ui/board.js';
import { createGame } from './ui/game.js';
import { renderHome } from './ui/home.js';
import { initSensors } from './ui/sensors.js';
import { createRecordingUi } from './ui/recording-ui.js';
import { registerServiceWorker } from './ui/sw-register.js';
import { initInstallButton } from './ui/install-button.js';

const VIEWS = ['home', 'play', 'help'];

const storage = createStorage();
const i18n = createI18n(storage);
const queue = createQueue(storage);

let data = null;
let loadFailed = false;
let currentRoute = { view: 'home' };
let firstRoute = true;
let board = null;
let game = null; // vznikne po načítaní úloh
let recording = null; // ovládanie nahrávania videa

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

/** Prekreslí karty kategórií (aj počty vyriešených). */
function showHome() {
  renderHome({
    list: document.getElementById('categories'),
    status: document.getElementById('categories-status'),
    data,
    loadFailed,
    queue,
    i18n,
  });
}

/** Na hernej obrazovke otvorí kategóriu (a prípadne konkrétnu úlohu). */
function showPlay(route) {
  if (!game) return; // úlohy sa ešte načítavajú; otvorí sa po načítaní
  if (route.puzzleId) game.open(route.category, route.puzzleId);
  else game.open(route.category);
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
  if (route.view !== 'play') recording?.stop(); // opustenie hry ukončí nahrávanie
  if (route.view === 'home') showHome();
  if (route.view === 'play') showPlay(route);
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
  showHome();
  game?.relabel();
}

/** Spustí aplikáciu. */
async function init() {
  applyTranslations();
  document.getElementById('lang-toggle').addEventListener('click', toggleLanguage);
  document.querySelectorAll('[data-action="print"]').forEach((btn) => {
    btn.addEventListener('click', () => window.print());
  });
  board = createBoard(document.getElementById('board'), {
    onChange: (state) => game?.onBoardChange(state),
    onHint: (key) => game?.onBoardHint(key),
    t: i18n.t,
  });
  initInstallButton(document.getElementById('install-btn'));
  registerServiceWorker();
  startRouter(showView);
  try {
    data = await loadPuzzles();
  } catch (error) {
    loadFailed = true;
    console.error(error);
  }
  if (data) {
    game = createGame({
      root: document.getElementById('view-play'), board, queue, i18n, puzzles: data, storage,
    });
  }
  if (game) {
    recording = createRecordingUi({ root: document.getElementById('view-play'), game, i18n });
    initSensors({
      onTiltLeft: () => game.showSolution(),
      onDoubleShake: () => game.reset(),
      i18n,
      buttonEl: document.getElementById('sensors-btn'),
      isActive: () => currentRoute.view === 'play',
      onMessage: (key) => game.onBoardHint(key),
    });
  }
  // Testovacie háčiky pre E2E testy; na verejnom serveri neexistujú.
  if (window.location.hostname === 'localhost') {
    window.__zapalkovoBoard = board;
    window.__zapalkovoGame = game;
  }
  showHome();
  if (currentRoute.view === 'play') showPlay(currentRoute);
}

init();
