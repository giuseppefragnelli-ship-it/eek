// >>> A OGNI AGGIORNAMENTO CAMBIA QUESTO NUMERO <<<
const VERSIONE = 'v1';
const CACHE = 'slime98-' + VERSIONE;
const FILES = ['./', 'index.html', 'manifest.json', 'icon-180.png', 'icon-512.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(r => r || fetch(e.request).then(res => {
    const copia = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return res;
  }).catch(() => caches.match('index.html'))));
});
