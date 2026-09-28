const CACHE = 'absensi-harian-v1'; // ponytail: bump manual tiap rilis, auto-hash bila update sering
const ASSETS = ['./', './index.html', './calc.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        const copy = res.clone();
        if (res.ok && new URL(e.request.url).origin === location.origin)
          caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error());
    })
  );
});
