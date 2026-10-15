// Browser preview only. The app's on-device database (SQLite in the browser) needs the page to be
// "cross-origin isolated", which takes two response headers. GitHub Pages can't send them, so this service worker
// adds them to every response from this folder. The page registers it and reloads once (see src/app/+html.tsx).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
  event.respondWith(fetch(req).then(res => {
    if (res.status === 0) return res;
    const headers = new Headers(res.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  }));
});
