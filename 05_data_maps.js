'use strict';
// js/05_data_maps.js — MAPS, MAP_BOSSES, VILLAGE

// ----------------------------------------------------------------------------
// MAPPE — si sbloccano vincendo la precedente (resistendo fino al minuto 7).
// hp/dmg/coin = moltiplicatori sopra la difficoltà; obstacles = ostacoli per blocco di mappa.
// ----------------------------------------------------------------------------
const MAPS = {
  // ISLAND (id 'cripta' per non rompere i salvataggi): un'isola grandissima di rovine, circondata dal mare (ISLAND)
  cripta:     { name: 'Sicilia', short: 'Sicilia',                  floor: 'cripta',     props: ['pl_tuft', 'pl_sprout', 'pl_leaves', 'pl_fern'], obstacle: 'o_col_half', obstacles: 1, obsR: 11, layout: 'ruins', temple: 0.2, stoa: 0.22,
                island: true,
                // SICILIA = muro iniziale: slime simpatici (cute) ma POCHI e CATTIVISSIMI. Le prime partite durano pochi secondi:
                // per andare avanti serve fortuna (jackpot = pioggia di monete rara) e spendere alla Locanda.
                //   spawn = quanti nemici rispetto al normale | mobDmg / mobSpeed = danno e velocità dei nemici normali (non dei boss)
                //   swarmEvery = secondi tra uno sciame di larve e l'altro (normale: SPAWN.swarmEvery = 16)
                //   jackpot: chance = probabilità per uccisione, coins = [min, max] monete che piovono
                // 2026-10-28: lenti e meno numerosi (prima spawn 0.5, mobDmg 4, mobSpeed 1.35, swarm 0.5), ma il morso resta cattivo
                cute: true, spawn: 0.2, mobDmg: 3, mobSpeed: 0.55, swarmEvery: 50, jackpot: { chance: 0.009, coins: [10, 24] },
                hp: 1.0, dmg: 1.0, coin: 1.0, unlock: null,     spitter: 1.0, swarm: 0.3, desc: '"Per me si va ne la città dolente." Un\'isola di rovine: oltre la spiaggia, solo mare.' },
  palude:     { name: 'Sardegna', short: 'Sardegna',                floor: 'palude',     props: ['pl_reed', 'pl_tuft', 'pl_bush', 'pl_fern'], obstacle: 'o_tree',     obstacles: 3, obsR: 16,
                // 2026-10-28: lenti e meno numerosi anche qui (prima niente spawn/mobSpeed e swarm 1.6)
                spawn: 0.45, mobSpeed: 0.6, swarmEvery: 28,
                hp: 1.25, dmg: 1.12, coin: 1.25, unlock: 'cripta', spitter: 1.0, swarm: 0.8, special: 'toxic', specialShare: 0.16,
                desc: '"Fitti nel limo dicon: Tristi fummo."' },
  cattedrale: { name: 'La Cattedrale Sconsacrata', short: 'Cattedrale', floor: 'cattedrale', props: ['pl_sprout', 'pl_tuft', 'pl_leaves'],  obstacle: 'o_col',      obstacles: 4, obsR: 11, layout: 'ruins', temple: 0.32, stoa: 0.25,
                hp: 1.5, dmg: 1.35, coin: 1.5, unlock: 'palude', spitter: 2.0, swarm: 1.2, special: 'ghost', specialShare: 0.22,
                desc: '"Suo cimitero da questa parte hanno con Epicuro tutti suoi seguaci."' },
  // CAMPAGNE DELL'INFERNO (dopo la Cattedrale si scende)
  selva:      { name: 'La Selva Oscura', short: 'Selva', floor: 'selva', props: ['pl_fern', 'pl_bush', 'pl_tuft'], obstacle: 'o_oak', obstacles: 5, obsR: 16,
                hp: 1.7, dmg: 1.45, coin: 1.75, unlock: 'cattedrale', spitter: 1.0, swarm: 1.3, special: 'lupa', specialShare: 0.2,
                desc: '"Nel mezzo del cammin di nostra vita."' },
  dite:       { name: 'La Città di Dite', short: 'Dite', floor: 'dite', props: ['pl_dry_tuft', 'pl_dry_fern'], obstacle: 'o_sarc', obstacles: 3, obsR: 17,
                hp: 1.95, dmg: 1.6, coin: 2.0, unlock: 'selva', spitter: 1.2, swarm: 1.0, special: 'furia', specialShare: 0.2,
                desc: '"Ad ogne man grande campagna, piena di duolo e di tormento rio."' },
  cocito:     { name: 'Il Cocito', short: 'Cocito', floor: 'cocito', props: ['pl_ice_tuft', 'pl_ice_sprout'], obstacle: 'o_ice', obstacles: 4, obsR: 13,
                hp: 2.25, dmg: 1.75, coin: 2.4, unlock: 'dite', spitter: 1.0, swarm: 1.5, special: 'gelido', specialShare: 0.22,
                desc: '"Vexilla regis prodeunt inferni."' },
};
// BOSS DELLE MAPPE — guardiano minore (b2: fulmini su zone segnate) e maggiore (b3: raffiche di proiettili).
// Solo se dopo la vittoria continui (modalità infinita): arrivano in coppia subito (DUO), poi con Flegiàs al minuto 10 (TRIO).
// Stesse regole per tutte le mappe, ma ogni mappa ha i suoi due mostri danteschi.
//   art     = funzione di BossArt che disegna lo sprite (sprite = 'boss_' + art)
//   warn    = avviso qualche secondo prima
//   summon  = chi evoca (id nemico), ogni `every` secondi, `n` alla volta
//   strikes / big = fulmini per raffica normale / grande (b2)
//   burst / arms / speed = proiettili della raggiera, bracci della spirale, velocità (b3)
//   bullet  = sprite dei proiettili (b3); faces: 'left' = lo sprite guarda a sinistra (si gira verso di te)
const MAP_BOSSES = {
  cripta: {
    b2: { name: 'Caronte', art: 'caronte', warn: "Un remo batte sull'acqua nera...", summon: 'drop', every: 9, n: 10 },
    b3: { name: 'Minosse', art: 'minosse', warn: 'Una coda si arrotola nel buio: il giudice ti ha visto.', bullet: 'eb_red', burst: 18, arms: 3, summon: 'elite', every: 10, n: 2 },
  },
  palude: {
    b2: { name: 'Pluto', art: 'pluto', warn: '"Pape Satàn, pape Satàn aleppe!"', summon: 'toxic', every: 8, n: 5 },
    b3: { name: 'Cerbero', art: 'cerbero', warn: 'Tre gole latrano insieme nel fango...', bullet: 'eb_green', burst: 21, arms: 3, summon: 'toxic', every: 9, n: 6 },
  },
  cattedrale: {
    b2: { name: 'Capaneo', art: 'capaneo', warn: 'Qualcuno bestemmia il cielo. Il cielo risponde...', strikes: 4, big: 9 },
    b3: { name: 'Gerione', art: 'gerione', warn: "Dal buio sale una figura con la faccia d'uom giusto...", bullet: 'eb_gold', burst: 16, arms: 4, summon: 'ghost', every: 9, n: 5 },
  },
  selva: {
    b2: { name: 'La Lonza', art: 'lonza', warn: 'Qualcosa dal pelo macolato si muove tra gli alberi...', summon: 'lupa', every: 8, n: 3 },
    b3: { name: 'La Lupa', art: 'lupa', faces: 'left', warn: 'Una magrezza carica di tutte le brame ti fiuta...', bullet: 'eb_grey', burst: 20, arms: 3, summon: 'lupa', every: 8, n: 4 },
  },
  dite: {
    b2: { name: 'Medusa', art: 'medusa', warn: '"Vegna Medusa: sì \'l farem di smalto"', summon: 'furia', every: 9, n: 3 },
    b3: { name: 'Il Minotauro', art: 'minotauro', warn: "L'infamia di Creti sbuffa e scalpita...", bullet: 'eb_fire', burst: 24, arms: 2, speed: 1.12, summon: 'elite', every: 10, n: 2 },
  },
  cocito: {
    b2: { name: 'Anteo', art: 'anteo', warn: 'Un gigante si stacca dal ghiaccio...', strikes: 4, summon: 'gelido', every: 9, n: 3 },
    b3: { name: 'Lucifero', art: 'lucifero', warn: 'Sei ali battono: il vento gela tutto il Cocito.', bullet: 'eb_ice', burst: 24, arms: 3, summon: 'gelido', every: 9, n: 4 },
  },
};
for (const id in MAP_BOSSES) for (const b of ['b2', 'b3']) { const c = MAP_BOSSES[id][b]; c.sprite = 'boss_' + c.art; MAPS[id][b] = c; }

const MAP_CHUNK = 480;    // lato di un blocco di mappa (unità) per decorazioni e ostacoli

// ----------------------------------------------------------------------------
// ISOLE — mappe finite circondate dal mare (Sicilia e lo Scoglio di Scilla). La costa è un cerchio "mosso" attorno a (0, 0).
// Oltre la costa c'è il mare: nessuno ci può entrare (player e dannati vengono tenuti a riva). La mappa ha `isle` = la sua isola.
//   R = raggio medio | wob = onde della costa [ampiezza, frequenza, fase] | N = punti della tabella | beach = spiaggia (unità)
// PONTE (`bridge` sulla mappa): l'unico passaggio sul mare. a = direzione (radianti, y in giù), w = larghezza, len = lunghezza.
// ----------------------------------------------------------------------------
function makeIsle(R, wob, N, beach) {
  const I = { R, wob, N, beach, r: new Float32Array(N), min: Infinity, max: 0 };
  for (let k = 0; k < N; k++) {
    const a = k / N * Math.PI * 2;
    let f = 1;
    for (const w of wob) f += w[0] * Math.sin(a * w[1] + w[2]);
    const r = I.r[k] = R * f;
    if (r < I.min) I.min = r;
    if (r > I.max) I.max = r;
  }
  return I;
}
function isleAt(I, a) { const k = ((a < 0 ? a + Math.PI * 2 : a) / (Math.PI * 2) * I.N) | 0; return I.r[k % I.N]; }
function makeBridge(I, a, w, len) { return { a, w, len, ux: Math.cos(a), uy: Math.sin(a), r0: isleAt(I, a) }; }

// SICILIA (ISLAND): circa 30 s di cammino dal centro alla spiaggia. Il ponte parte in alto a sinistra (nord-ovest).
const ISLAND = makeIsle(4200, [[0.07, 3, 0.5], [0.05, 5, 2.1], [0.025, 11, 1.0], [0.012, 23, 4.0]], 512, 46);
MAPS.cripta.isle = ISLAND;
MAPS.cripta.bridge = makeBridge(ISLAND, -Math.PI * 0.75, 64, 620);
// GOAT: andando molto in alto in Sicilia c'è una figura nera gigantesca (il doppio di un boss). Per ora non fa niente: sta lì.
//   x, y = dove sta (i piedi) | r = ingombro (non la attraversi) | scale = quanto è grande rispetto a un boss
MAPS.cripta.goat = { name: 'Goat', x: 0, y: -3150, r: 120, scale: 2 };

// raggio della costa della mappa in corso nella direzione di (x, y)
function islandR(x, y) { return isleAt(G.map.isle, Math.atan2(y, x)); }
// tiene (x, y) almeno `margin` dentro la costa. Scrive in _isl (x, y, hit). Veloce se lontano dal mare.
const _isl = { x: 0, y: 0, hit: false };
function islandClamp(x, y, margin) {
  _isl.x = x; _isl.y = y; _isl.hit = false;
  const d2 = x * x + y * y, lim0 = G.map.isle.min - margin;
  if (d2 < lim0 * lim0) return _isl;
  const lim = islandR(x, y) - margin, d = Math.sqrt(d2);
  if (d <= lim) return _isl;
  _isl.x = x / d * lim; _isl.y = y / d * lim; _isl.hit = true;
  return _isl;
}
// punto di spawn finito in mare: si specchia dall'altra parte del player (verso l'interno), se serve si riporta a riva
function islandSpawn(x, y) {
  const c = islandClamp(x, y, 30);
  if (!c.hit) return c;
  return islandClamp(2 * Player.x - x, 2 * Player.y - y, 30);
}

// ----------------------------------------------------------------------------
// LO SCOGLIO DI SCILLA — un'isoletta raggiungibile solo dal ponte della Sicilia. Ci vive Scilla, un boss enorme e resistentissimo.
// Entrando il ponte si chiude alle spalle: si torna in Sicilia solo dopo averla battuta.
// Battuta la prima volta: l'Aruspice legge un TERZO omen su ogni oggetto (Save.data.reef).
//   delay = secondi prima che arrivi | hp / dmg = moltiplicatori sopra il guardiano maggiore (b3) | boss = aspetto e attacchi
// ----------------------------------------------------------------------------
const REEF = {
  name: 'Lo Scoglio di Scilla',
  delay: 2.5, hp: 6, dmg: 1.5,
  boss: { name: 'Scilla', art: 'medusa', sprite: 'boss_medusa', bullet: 'eb_red', burst: 30, arms: 4, speed: 1.2, summon: 'elite', every: 9, n: 2 },
};
REEF.isle = makeIsle(820, [[0.06, 4, 1.0], [0.03, 9, 2.0]], 256, 40);
// la mappa dello Scoglio: come la Sicilia (nemici, boss della modalità infinita) ma pavimento di pietra bruciata, niente rovine.
// Il suo ponte (il ritorno) sta a sud-est, dalla parte della Sicilia.
const REEF_MAP = Object.assign({}, MAPS.cripta, {
  name: REEF.name, short: 'Scoglio', floor: 'dite', props: ['pl_dry_tuft', 'pl_dry_fern'], obstacle: 'o_sarc', obstacles: 0, layout: null,
  isle: REEF.isle, bridge: makeBridge(REEF.isle, Math.PI * 0.25, 64, 260), reef: true, goat: null,
});

// ----------------------------------------------------------------------------
// SBLOCCHI SEGRETI — resisti fino a `time` (secondi) su `map`: in pratica in modalità infinita, dopo la vittoria.
// Restano sbloccati per sempre (Save.data.unlocks). L'arma segreta ha `secret: <id>` in WEAPON_DEFS.
// ----------------------------------------------------------------------------
const UNLOCKS = {
  wisps:    { map: 'cripta', time: 660, name: 'Linguae Ignis', kind: 'Arma segreta', hint: "resisti fino all'11:00 in Sicilia",
              desc: 'Ora può uscire nelle carte del level up.' },
  // dal 2026-10-28 il teletrasporto NON si sblocca col tempo (map: null): servono TELE_UNLOCK.arrows frecce schivate (countDodge)
  teleport: { map: null, time: Infinity, name: 'Teletrasporto', kind: 'Abilità', hint: '100 frecce schivate',
              desc: 'Tasto E (sul telefono il tasto TELE): ti sposta di colpo di qualche passo dove vai.' },
  facile:   { map: 'cattedrale', time: 660, name: 'Modalità Facile', kind: 'Modalità', hint: "resisti fino all'11:00 nella Cattedrale",
              desc: 'Solo nel Cocito: la scegli dalla scheda della mappa. Facile per modo di dire: dannati 10 volte più forti.' },
};

// IL MAGISTER — ha lasciato il Villaggio: studia tra le rovine della Cattedrale, a destra della partenza
// (circa un minuto di cammino). Parlandoci in partita si apre la sua Schola (studi delle passive + ricette di fusione).
//   clearR = niente ostacoli attorno | talkR = distanza per parlarci | hintR = da qui freccia sul bordo e avviso
const MAGISTER_CAMP = { map: 'cattedrale', x: 9000, y: 0, clearR: 230, talkR: 62, hintR: 3400 };

// ----------------------------------------------------------------------------
// VILLAGGIO — scena tra una partita e l'altra
// ----------------------------------------------------------------------------
const VILLAGE = { w: 1000, h: 660, talkR: 56 };
