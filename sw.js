'use strict';
// sw.js — SERVICE WORKER: tiene una copia di tutti i file del gioco sul telefono, così parte anche offline.
//
// QUANDO PUBBLICHI UNA VERSIONE NUOVA: cambia VERSION qui sotto (per esempio 'v2', 'v3'...).
// Al primo avvio con internet il telefono scarica i file nuovi; la volta dopo che apri il gioco gira la versione nuova.
// Se aggiungi un file (un nuovo .js, un'immagine), aggiungilo anche a FILES.

const VERSION = 'v9';
const CACHE = 'slime98-' + VERSION;
const FILES = [
  './',
  'index.html',
  'game.css',
  'manifest.webmanifest',
  'monsters.png',
  'skull.png',
  'death.png',
  'death_portrait.jpg',
  'fonts/silkscreen-400.woff2',
  'fonts/silkscreen-700.woff2',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  '01_config.js', '02_data_enemies.js', '03_data_weapons.js', '04_data_economy.js', '05_data_maps.js',
  '06_save.js', '07_audio.js', '08_sprites.js', '09_art_eek_frames.js', '10_art_characters.js',
  '11_art_bosses.js', '12_input.js', '13_grid.js', '14_entities.js', '15_world.js', '16_player.js',
  '17_enemies.js', '18_bosses.js', '19_enemy_ai.js', '20_weapons.js', '21_upgrades.js', '22_render.js',
  '23_ui.js', '24_village.js', '25_monster_art.js', '26_main.js',
];

// installazione: scarica tutto (saltando la cache http del browser, così prende davvero i file nuovi)
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

// attivazione: butta le copie delle versioni vecchie
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('slime98-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// richieste: prima la copia sul telefono, se manca la rete
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
