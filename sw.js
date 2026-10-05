const CACHE = 'absensi-harian-v1'; // nama tetap: update otomatis via network-first + revalidasi, tanpa bump manual
const ASSETS = ['./', './index.html', './calc.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return;
  // Navigasi (index.html): network-first agar update web otomatis masuk saat online, cache saat offline
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  // Aset lain (calc.js, ikon): stale-while-revalidate — saji cache instan, segarkan di belakang layar
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      const segar = fetch(e.request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => null);
      if (hit) return hit;
      return segar.then(res => res || Response.error());
    })
  );
});
