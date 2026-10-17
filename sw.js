// Service worker: appka musí jet i bez sítě.
// Při změně souborů zvedni VERSION – stará cache se pak smaže.
const VERSION = 'v1.0.0';
const CACHE = `mistryimpostor-${VERSION}`;

// Cesty jsou relativní ke sw.js, takže fungují i na podcestě (GitHub Pages).
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'styles/main.css',

  'src/main.js',
  'src/pwa.js',
  'src/game/content.js',
  'src/game/engine.js',
  'src/local/local.js',
  'src/local/persist.js',
  'src/ui/confetti.js',
  'src/ui/dom.js',
  'src/ui/haptics.js',
  'src/ui/holdcard.js',
  'src/ui/router.js',
  'src/ui/sound.js',
  'src/ui/timer.js',
  'src/ui/wakelock.js',

  'content/words.json',
  'content/questions.json',

  'fonts/unbounded-latin-wght-normal.woff2',
  'fonts/unbounded-latin-ext-wght-normal.woff2',
  'fonts/onest-latin-wght-normal.woff2',
  'fonts/onest-latin-ext-wght-normal.woff2',

  'icons/favicon.svg',
  'icons/favicon-32.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS.map((path) => new URL(path, self.registration.scope).toString()));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('mistryimpostor-') && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Nová verze čeká, dokud uživatel neklepne na „Obnovit" v aplikaci.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigace: vždy uložená stránka appky (app shell). Nezávisí to na tom,
  // jestli je síť pomalá nebo úplně pryč; novou verzi přinese až nový worker.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const shell = (await cache.match(new URL('index.html', self.registration.scope).toString()))
        ?? (await cache.match(new URL('./', self.registration.scope).toString()));
      if (shell) return shell;
      try {
        return await fetch(request);
      } catch {
        return Response.error();
      }
    })());
    return;
  }

  // Ostatní: cache first, ze sítě doplníme, co v precache nebylo.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') cache.put(request, response.clone());
      return response;
    } catch (err) {
      throw err;
    }
  })());
});
