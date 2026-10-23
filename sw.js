// Offline support: cache-first so the app opens instantly even on weak gym signal.
// Each request also refreshes the cache in the background. When a newer index.html arrives, every
// file the app needs is fetched again before open pages are told they can reload, so a reload never
// mixes old and new files.
const CACHE = 'recomp-v8';
// Every file the app needs offline. Add new files here.
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './styles/base.css',
  './styles/history-progress.css',
  './styles/motion.css',
  './styles/navigation.css',
  './styles/setup-plan.css',
  './styles/sheets.css',
  './styles/themes/classic.css',
  './styles/themes/themes.css',
  // The default theme's fonts; other themes' fonts are cached the first time they're used
  './fonts/CormorantGaramond_600SemiBold.woff2',
  './fonts/SpaceGrotesk_400Regular.woff2',
  './fonts/SpaceGrotesk_700Bold.woff2',
  './fonts/JetBrainsMono_400Regular.woff2',
  './fonts/JetBrainsMono_700Bold.woff2',
  './styles/workout.css',
  './js/data/default-plan.js',
  './js/data/exercises.js',
  './js/data/plans.js',
  './js/state.js',
  './js/helpers.js',
  './js/ui.js',
  './js/storage.js',
  './js/workout-data.js',
  './js/add-exercise.js',
  './js/workout.js',
  './js/warmup-editor.js',
  './js/rest-timer.js',
  './js/sound.js',
  './js/records.js',
  './js/navigation.js',
  './js/history.js',
  './js/progress.js',
  './js/charts.js',
  './js/backup.js',
  './js/profile.js',
  './js/plan.js',
  './js/ai-plan.js',
  './js/settings.js',
  './js/themes.js',
  './js/setup.js',
  './js/tips.js',
  './js/plan-editor.js',
  './js/app.js',
  './images/icons/icon-180.png',
  './images/icons/icon-192.png',
  './images/icons/icon-512.png',
  './images/icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const stale = (await caches.keys()).filter(k => k !== CACHE);
    await Promise.all(stale.map(k => caches.delete(k)));
    await self.clients.claim();
    // An older version was installed, so pages still showing it should offer a reload.
    if (stale.length) notifyUpdate();
  })());
});

// The page's update check asks for every file to be fetched again
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'refresh') event.waitUntil(refreshAll().then(notifyUpdate));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // The new app's browser preview (preview/) is a separate app with its own service worker
  if (url.pathname.includes('/preview/')) return;
  // The page's own update check asks for the latest version straight from the network
  if (req.cache === 'no-store') return;
  event.respondWith(cacheFirst(event));
});

async function refreshAll() {
  const cache = await caches.open(CACHE);
  await Promise.all(ASSETS.map(async url => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) await cache.put(url, res);
    } catch (e) {}
  }));
}

async function cacheFirst(event) {
  const req = event.request;
  const cache = await caches.open(CACHE);
  const cached = (await cache.match(req, { ignoreSearch: true })) ||
    (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
  // The cached body is handed to the page, so compare against a copy.
  const cachedCopy = cached && req.mode === 'navigate' ? cached.clone() : null;

  const refresh = fetch(req, { cache: 'no-cache' }).then(async res => {
    if (!res.ok) return res;
    if (cachedCopy) {
      const [oldText, newText] = await Promise.all([cachedCopy.text(), res.clone().text()]);
      if (oldText !== newText) {
        await refreshAll();
        notifyUpdate();
        return res;
      }
    }
    await cache.put(req, res.clone());
    return res;
  });

  if (!cached) return refresh;
  event.waitUntil(refresh.catch(() => {}));
  return cached;
}

async function notifyUpdate() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  windows.forEach(client => client.postMessage({ type: 'update-available' }));
}
