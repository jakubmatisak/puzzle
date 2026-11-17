/**
 * Service worker Zápalkovo: pri inštalácii uloží celú aplikáciu do cache,
 * potom odpovedá "najprv sieť, potom cache" – online je všetko čerstvé, offline hra funguje.
 */
const CACHE = 'zapalkovo-v1';
const CACHE_PREFIX = 'zapalkovo-';

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
  './js/ui/recorder.js',
  './js/ui/recording-ui.js',
  './js/ui/router.js',
  './js/ui/install-button.js',
  './js/ui/sw-register.js',
  './js/ui/sensors.js',
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

/** Uloží čerstvú odpoveď (len úspešnú) do cache. */
async function updateCache(request, response) {
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

/** Najprv sieť (a aktualizuj cache); pri výpadku odpoveď z cache, pre navigáciu index.html. */
async function networkFirst(request) {
  try {
    return await updateCache(request, await fetch(request));
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
