// Offline support: cache-first so the app opens instantly even on weak gym signal.
// Each request also refreshes the cache in the background; when a newer index.html
// arrives, open pages are told so they can offer a reload.
const CACHE = 'recomp-v2';
const ASSETS = ['./', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png'];

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

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(cacheFirst(event));
});

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
        await cache.put(req, res.clone());
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
