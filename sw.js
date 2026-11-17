/**
 * Service worker Zápalkovo: pri inštalácii uloží celú aplikáciu do cache,
 * potom odpovedá "najprv sieť, potom cache" – online je všetko čerstvé, offline hra funguje.
 */
const CACHE = 'zapalkovo-v1';
const CACHE_PREFIX = 'zapalkovo-';
const NETWORK_TIMEOUT_MS = 4000;

/** Všetky statické súbory aplikácie (relatívne cesty, aby appka bežala v ľubovoľnom podpriečinku). */
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './css/base.css',
  './css/board.css',
  './css/layout.css',
  './css/print.css',
  './css/tokens.css',
  './js/app.js',
  './js/core/board-model.js',
  './js/core/decode.js',
  './js/core/expression.js',
  './js/core/geometry.js',
  './js/core/glyphs.js',
  './js/core/i18n.js',
  './js/core/lattice.js',
  './js/core/puzzle-state.js',
  './js/core/puzzles.js',
  './js/core/queue.js',
  './js/core/roman.js',
  './js/core/sensors-logic.js',
  './js/core/solver.js',
  './js/core/storage.js',
  './js/core/strings.js',
  './js/core/validator.js',
  './js/ui/board.js',
  './js/ui/canvas-renderer.js',
  './js/ui/game.js',
  './js/ui/home.js',
  './js/ui/install-button.js',
  './js/ui/recorder.js',
  './js/ui/recording-ui.js',
  './js/ui/router.js',
  './js/ui/sensors.js',
  './js/ui/svg.js',
  './js/ui/sw-register.js',
  './data/puzzles.json',
];

/** Inštalácia: predčasne načíta celú aplikáciu do cache a hneď sa aktivuje. */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

/** Aktivácia: zmaže staré cache Zápalkova a prevezme už otvorené stránky. */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

/** Uloží čerstvú odpoveď (len status 200) do cache; chyba pri ukladaní sa ignoruje. */
async function updateCache(request, response) {
  if (response.status === 200) {
    try {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    } catch {
      // ukladanie sa nepodarilo (plná cache…) – dobrú odpoveď aj tak vrátime
    }
  }
  return response;
}

/** Sieťová požiadavka, ktorá sa po NETWORK_TIMEOUT_MS preruší (pomalé pripojenie → cache). */
async function fetchWithTimeout(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Najprv sieť (a aktualizuj cache); pri výpadku odpoveď z cache, pre navigáciu index.html. */
async function networkFirst(request) {
  try {
    return await updateCache(request, await fetchWithTimeout(request));
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const page = await caches.match('./index.html');
      if (page) return page;
    }
    throw error;
  }
}

/** Zachytáva len GET požiadavky na ten istý pôvod; ostatné nechá prehliadaču. */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});
