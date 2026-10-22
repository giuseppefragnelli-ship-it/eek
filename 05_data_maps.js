'use strict';
// js/05_data_maps.js — MAPS, MAP_BOSSES, VILLAGE

// ----------------------------------------------------------------------------
// MAPPE — si sbloccano vincendo la precedente (resistendo fino al minuto 7).
// hp/dmg/coin = moltiplicatori sopra la difficoltà; obstacles = ostacoli per blocco di mappa.
// ----------------------------------------------------------------------------
const MAPS = {
  cripta:     { name: 'La Cripta', short: 'Cripta',                 floor: 'cripta',     props: ['pl_tuft', 'pl_sprout', 'pl_leaves', 'pl_fern'], obstacle: 'o_col_half', obstacles: 1, obsR: 11, layout: 'ruins', temple: 0.2, stoa: 0.22,
                hp: 1.0, dmg: 1.0, coin: 1.0, unlock: null,     spitter: 1.0, swarm: 1.0, desc: '"Per me si va ne la città dolente."' },
  palude:     { name: 'La Palude Marcia', short: 'Palude',          floor: 'palude',     props: ['pl_reed', 'pl_tuft', 'pl_bush', 'pl_fern'], obstacle: 'o_tree',     obstacles: 3, obsR: 16,
                hp: 1.25, dmg: 1.12, coin: 1.25, unlock: 'cripta', spitter: 1.0, swarm: 1.6, special: 'toxic', specialShare: 0.16,
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
// SBLOCCHI SEGRETI — resisti fino a `time` (secondi) su `map`: in pratica in modalità infinita, dopo la vittoria.
// Restano sbloccati per sempre (Save.data.unlocks). L'arma segreta ha `secret: <id>` in WEAPON_DEFS.
// ----------------------------------------------------------------------------
const UNLOCKS = {
  wisps:    { map: 'cripta', time: 660, name: 'Linguae Ignis', kind: 'Arma segreta', hint: "resisti fino all'11:00 nella Cripta",
              desc: 'Ora può uscire nelle carte del level up.' },
  teleport: { map: 'palude', time: 660, name: 'Teletrasporto', kind: 'Abilità', hint: "resisti fino all'11:00 nella Palude",
              desc: 'Tasto E (sul telefono il tasto TELE): ti sposta di colpo di qualche passo dove vai.' },
  facile:   { map: 'cattedrale', time: 660, name: 'Modalità Facile', kind: 'Modalità', hint: "resisti fino all'11:00 nella Cattedrale",
              desc: 'Solo nel Cocito: la scegli dalla scheda della mappa. Facile per modo di dire: dannati 10 volte più forti.' },
};

// IL MAGISTER — ha lasciato il Villaggio: studia tra le rovine della Cattedrale, a destra della partenza
// (circa un minuto di cammino). Parlandoci in partita si apre la sua Schola (studi delle passive + Arcanum [?]).
//   clearR = niente ostacoli attorno | talkR = distanza per parlarci | hintR = da qui freccia sul bordo e avviso
const MAGISTER_CAMP = { map: 'cattedrale', x: 9000, y: 0, clearR: 230, talkR: 62, hintR: 3400 };

// ----------------------------------------------------------------------------
// VILLAGGIO — scena tra una partita e l'altra
// ----------------------------------------------------------------------------
const VILLAGE = { w: 1000, h: 660, talkR: 56 };
