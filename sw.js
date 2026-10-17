'use strict';
// sw.js — Slime Survivors 98: RETE PRIMA, cache solo se sei offline.
// Così gli aggiornamenti arrivano subito e il gioco parte comunque senza connessione.
// Quando vuoi forzare un reset totale delle cache, cambia CACHE (es. v3).
const CACHE = 'slime98-v3';
const FILES = [
  './', 'index.html', 'manifest.json', 'icon-180.png', 'icon-512.png',
  'game.css', 'monsters.png',
  '01_config.js', '02_data_enemies.js', '03_data_weapons.js', '04_data_economy.js',
  '05_data_maps.js', '06_save.js', '07_audio.js', '08_sprites.js', '09_art_eek_frames.js',
  '10_art_characters.js', '11_art_bosses.js', '12_input.js', '13_grid.js', '14_entities.js',
  '15_world.js', '16_player.js', '17_enemies.js', '18_bosses.js', '19_enemy_ai.js',
  '20_weapons.js', '21_upgrades.js', '22_render.js', '23_ui.js', '24_village.js',
  '25_monster_art.js', '26_main.js',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  // un file mancante non deve rompere l'installazione
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(FILES.map((f) => c.add(new Request(f, { cache: 'reload' }))))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;   // font e altro: li gestisce il browser
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')))
  );
});
