// RED SOL service worker: cache what the game uses so it works offline after the first visit.
const CACHE = 'redsol-v1';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icon.svg']).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'cache') e.waitUntil(caches.open(CACHE).then((c) => Promise.all(e.data.urls.map((u) => c.add(u).catch(() => {})))));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; }).catch(() => caches.match(req.url, { ignoreVary: true, ignoreSearch: true }).then((m) => m || (req.mode === 'navigate' ? caches.match('./', { ignoreVary: true }) : Response.error()))));
});
