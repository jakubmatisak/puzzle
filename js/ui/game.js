/**
 * Herný tok: výber úlohy z fronty, panel so zadaním a počítadlom ťahov,
 * nápoveda, animované riešenie (aj viac riešení), reset, rozpoznanie úspechu
 * a ďalšia úloha. Hraciu plochu (board.js) dostane hotovú zvonka.
 */
import { createState, movesUsed, solutionPlan } from '../core/puzzle-state.js';
import { isSolved } from '../core/validator.js';

const TIP_KEY = 'zapalkovo.rotateTipDismissed';
const WIDE_RATIO = 2.5; // od tohto pomeru šírka/výška je úloha „široká“

/**
 * Ďalšia úloha z fronty, ale nie tá, ktorá je práve zobrazená (napr. otvorená cez
 * deep link, o ktorej fronta nevie). Prvé volanie ju už zapísalo medzi odohrané,
 * takže druhé vyberie inú.
 * @param {{next:Function}} queue fronta úloh
 * @param {string} categoryId
 * @param {string[]} ids ID úloh kategórie
 * @param {string|null} currentId práve zobrazená úloha
 * @returns {string|null}
 */
export function nextDistinct(queue, categoryId, ids, currentId) {
  const id = queue.next(categoryId, ids);
  if (id === currentId && ids.length > 1) return queue.next(categoryId, ids);
  return id;
}

/**
 * Vytvorí ovládač hry nad obrazovkou #view-play.
 * Po vyriešení vyšle na `root` udalosť `solved` (detail: {puzzle}).
 * @param {{root:HTMLElement, board:object, queue:object, i18n:object,
 *   puzzles:{categories:object[], puzzles:object[]}, storage?:{get:Function, set:Function}}} opts
 *   root = obrazovka hry, board = API z createBoard, queue = fronta úloh,
 *   puzzles = normalizované úlohy, storage = úložisko (pre zavretý tip „otoč telefón“)
 * @returns {object} API hry (open, showHint, showSolution, nextSolution, reset, next,
 *   getCurrent, relabel, onBoardChange, onBoardHint)
 */
export function createGame({ root, board, queue, i18n, puzzles, storage = null }) {
  const $ = (selector) => root.querySelector(selector);
  const ui = {
    title: $('#play-title'),
    task: $('#task-text'),
    moves: $('#moves'),
    message: $('#message'),
    success: $('#success'),
    successNext: $('#success [data-action="next"]'),
    nextSolution: $('#controls [data-action="next-solution"]'),
    rotate: $('#controls [data-action="rotate"]'),
    rotateTip: $('#rotate-tip'),
  };

  let puzzle = null; // práve otvorená úloha
  let message = null; // {key, params} – hláška pod doskou
  let revealed = false; // hráč si pozrel riešenie → nezapočíta sa
  let solved = false;
  let solutionIndex = 0;
  let animating = false;
  let relabelPending = false; // preklad dosky počká na koniec animácie
  let token = 0; // zvýšenie = bežiace riešenie už nič nedokončí

  // ---------- pomocné ----------

  /** ID úloh danej kategórie (v poradí zo súboru). */
  function idsOf(categoryId) {
    return puzzles.puzzles.filter((p) => p.category === categoryId).map((p) => p.id);
  }

  /** Úloha podľa ID. */
  function byId(id) {
    return puzzles.puzzles.find((p) => p.id === id);
  }

  /** Parametre hlášky: objekty {sk, en} sa preložia do aktuálneho jazyka. */
  function translateParams(params = {}) {
    return Object.fromEntries(Object.entries(params)
      .map(([k, v]) => [k, typeof v === 'object' && v !== null ? i18n.pick(v) : v]));
  }

  /** Adresa bez ?puzzle=, aby obnovenie stránky pokračovalo cez frontu. */
  function updateUrl(categoryId) {
    const hash = `#/play/${encodeURIComponent(categoryId)}`;
    if (window.location.hash !== hash) window.history.replaceState(window.history.state, '', hash);
  }

  // ---------- kreslenie panelu ----------

  /** Nadpis: názov kategórie. */
  function renderTitle() {
    const category = puzzles.categories.find((c) => c.id === puzzle?.category);
    if (category) ui.title.textContent = i18n.pick(category.name);
  }

  /** Text zadania. */
  function renderTask() {
    delete ui.task.dataset.i18n;
    ui.task.textContent = i18n.pick(puzzle.task);
  }

  /** Počítadlo „Ťahy: n / max“; prekročenie limitu pridá triedu .is-over. */
  function renderMoves() {
    const n = movesUsed(board.getState(), puzzle);
    const params = { n, max: puzzle.moves };
    ui.moves.dataset.i18nParams = JSON.stringify(params);
    ui.moves.textContent = i18n.t('game.moves', params);
    ui.moves.classList.toggle('is-over', n > puzzle.moves);
  }

  /** Hláška pod doskou (aria-live). */
  function renderMessage() {
    ui.message.textContent = message ? i18n.t(message.key, translateParams(message.params)) : '';
  }

  /** Viditeľnosť „Ďalšie riešenie“ a dostupnosť „Otočiť“. */
  function renderButtons() {
    ui.nextSolution.hidden = !(revealed && puzzle.solutions.length > 1);
    ui.rotate.disabled = !board.getSelected() || animating || solved;
  }

  /** Tip „otoč telefón“ pre široké úlohy; CSS ho ukáže iba na úzkom displeji na výšku. */
  function renderRotateTip() {
    const { w, h } = puzzle.board.bounds;
    const dismissed = storage ? storage.get(TIP_KEY, false) : false;
    ui.rotateTip.hidden = dismissed || w / h <= WIDE_RATIO;
  }

  /** Nastaví hlášku a zobrazí ju (null = vymaže). */
  function setMessage(next) {
    message = next;
    renderMessage();
  }

  /** Prekreslí celý panel úlohy. */
  function renderAll() {
    renderTitle();
    renderTask();
    renderMoves();
    renderMessage();
    renderButtons();
    renderRotateTip();
  }

  // ---------- úspech ----------

  /** Skryje panel úspechu; ak bol fokus v ňom, presunie ho na nadpis hry. */
  function hideSuccess() {
    if (ui.success.hidden) return;
    const hadFocus = ui.success.contains(document.activeElement);
    ui.success.hidden = true;
    if (hadFocus) ui.title.focus({ preventScroll: true });
  }

  /** Úloha vyriešená: zápis do fronty, zamknutie dosky, oslava a fokus na „Ďalšia úloha“. */
  function succeed() {
    solved = true;
    queue.markSolved(puzzle.id);
    queue.clearCurrent(puzzle.category); // R12: vyriešená úloha sa už neobnoví
    board.setInteractive(false);
    setMessage({ key: 'game.solved' }); // oznámi úspech aj čítačke obrazovky
    renderButtons();
    ui.success.hidden = false;
    ui.successNext.focus();
    root.dispatchEvent(new CustomEvent('solved', { detail: { puzzle } }));
  }

  // ---------- načítanie úlohy ----------

  /** Načíta úlohu do dosky a vynuluje stav hry. */
  function load(next) {
    token += 1;
    puzzle = next;
    message = null;
    revealed = false;
    solved = false;
    animating = false;
    solutionIndex = 0;
    board.load(puzzle, createState(puzzle));
    board.setInteractive(true);
    hideSuccess();
    renderAll();
    updateUrl(puzzle.category);
  }

  /** Preloží popisy v doske (odkladacia plocha). */
  function relabelBoard() {
    relabelPending = false;
    board.setState(board.getState());
  }

  // ---------- verejné API ----------

  /**
   * Otvorí kategóriu: s platným puzzleId priamo danú úlohu (fronta sa nemení),
   * inak aktuálnu úlohu z fronty alebo ďalšiu. Neznáma kategória/úloha vedie domov.
   * @param {string} categoryId
   * @param {string} [puzzleId]
   */
  function open(categoryId, puzzleId) {
    const ids = idsOf(categoryId);
    if (ids.length === 0 || (puzzleId && !ids.includes(puzzleId))) {
      window.location.hash = '#/';
      return;
    }
    const id = puzzleId || (queue.current(categoryId, ids) ?? queue.next(categoryId, ids));
    if (puzzle?.id === id) {
      updateUrl(categoryId);
      return;
    }
    load(byId(id));
  }

  /** Ďalšia úloha tej istej kategórie z fronty. */
  function next() {
    if (!puzzle) return;
    const id = nextDistinct(queue, puzzle.category, idsOf(puzzle.category), puzzle.id);
    load(byId(id));
  }

  /** Zobrazí nápovedu úlohy. */
  function showHint() {
    if (puzzle) setMessage({ key: 'game.hintText', params: { text: puzzle.hint } });
  }

  /**
   * Vráti úlohu na štart a animovane ukáže riešenie č. solutionIndex.
   * Úloha sa potom nezapočíta medzi vyriešené (až do resetu).
   * @returns {Promise<void>}
   */
  async function showSolution() {
    if (!puzzle) return;
    token += 1;
    const myToken = token;
    revealed = true;
    solved = false;
    hideSuccess();
    board.setState(createState(puzzle));
    board.setInteractive(false); // pred animáciou – počas nej by ju zastavilo
    animating = true;
    setMessage({ key: 'game.revealed' });
    renderMoves();
    renderButtons();
    await board.animatePlan(solutionPlan(puzzle, solutionIndex));
    if (myToken !== token) return; // medzitým reset / iná úloha
    animating = false;
    board.setInteractive(true);
    if (relabelPending) relabelBoard();
    renderButtons();
  }

  /** Prepne na ďalšie riešenie (ak ich má úloha viac) a ukáže ho. */
  function nextSolution() {
    if (!puzzle || puzzle.solutions.length < 2) return Promise.resolve();
    solutionIndex = (solutionIndex + 1) % puzzle.solutions.length;
    return showSolution();
  }

  /** Vráti všetky zápalky na štart a zruší stav „odhalené“. */
  function reset() {
    if (!puzzle) return;
    token += 1;
    revealed = false;
    solved = false;
    animating = false;
    board.setState(createState(puzzle));
    board.setInteractive(true);
    hideSuccess();
    setMessage(null);
    renderMoves();
    renderButtons();
  }

  /** Po zmene jazyka preloží nadpis, zadanie, počítadlo, hlášku aj dosku. */
  function relabel() {
    if (!puzzle) return;
    renderTitle();
    renderTask();
    renderMoves();
    renderMessage();
    if (animating) relabelPending = true;
    else relabelBoard();
  }

  /** Volá doska po každej zmene stavu: počítadlo a kontrola úspechu. */
  function onBoardChange(state) {
    if (!puzzle) return;
    renderMoves();
    if (message?.key === 'game.needRotate') setMessage(null);
    if (!revealed && !solved && isSolved(state, puzzle)) succeed();
  }

  /** Volá doska s kľúčom krátkej rady (napr. „najprv otoč“). */
  function onBoardHint(key) {
    setMessage({ key });
  }

  // Tlačidlá ovládania
  const actions = {
    hint: showHint,
    solution: showSolution,
    'next-solution': nextSolution,
    reset,
    rotate: () => board.rotateSelected(),
    next,
  };
  root.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    const action = button && actions[button.dataset.action];
    if (action) action();
  });
  // Výber zápalky sa mení na doske → tlačidlo „Otočiť“ podľa toho.
  ['pointerdown', 'pointerup', 'focusin', 'focusout', 'keyup'].forEach((type) => {
    root.addEventListener(type, () => {
      if (puzzle) renderButtons();
    });
  });
  ui.rotateTip.querySelector('button').addEventListener('click', () => {
    storage?.set(TIP_KEY, true);
    ui.rotateTip.hidden = true;
  });

  return {
    open,
    showHint,
    showSolution,
    nextSolution,
    reset,
    next,
    /** Práve otvorená úloha (alebo null). */
    getCurrent: () => puzzle,
    relabel,
    onBoardChange,
    onBoardHint,
  };
}
