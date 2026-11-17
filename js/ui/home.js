/**
 * Domovská obrazovka: karty kategórií s ilustráciou a počtom vyriešených úloh.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

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

/** Ikona zo sprite cez <use>. */
function svgIcon(id, extraClass = '') {
  const svg = svgEl('svg', { class: `icon ${extraClass}`.trim(), 'aria-hidden': 'true', focusable: 'false' });
  svg.append(svgEl('use', { href: `#${id}` }));
  return svg;
}

/** Jedna karta kategórie ako odkaz na #/play/<id>. */
function categoryCard(category, index, { data, queue, i18n }) {
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

/**
 * Vykreslí karty kategórií (alebo stav načítania / chybu).
 * @param {{list:HTMLElement, status:HTMLElement, data:object|null, loadFailed:boolean,
 *   queue:object, i18n:object}} opts list = zoznam kariet, status = text načítania,
 *   data = normalizované úlohy (null = ešte sa načítavajú)
 */
export function renderHome({ list, status, data, loadFailed, queue, i18n }) {
  if (!data) {
    status.dataset.i18n = loadFailed ? 'home.error' : 'home.loading';
    status.textContent = i18n.t(status.dataset.i18n);
    status.hidden = false;
    list.replaceChildren();
    return;
  }
  status.hidden = true;
  list.replaceChildren(...data.categories.map((c, i) => categoryCard(c, i, { data, queue, i18n })));
}
