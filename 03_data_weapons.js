'use strict';
// js/03_data_weapons.js — WEAPON_DEFS, PASSIVE_DEFS, carte di riempimento

// ----------------------------------------------------------------------------
// ARMI — 5 livelli + evoluzione. `evo.passive` = passiva richiesta per evolvere
// (l'arma deve essere al livello 5 e la passiva posseduta).
// ----------------------------------------------------------------------------
const WEAPON_DEFS = {
  // ARMI DELL'ARMAIOLO (gear: non compaiono nelle carte, se ne porta una alla volta).
  // Il livello dipende dal fabbro (+0..+5 -> indici 0..5).
  dagger: {
    name: 'Pugio', icon: 'it_dagger', gear: true,
    desc: '"Tu quoque, Brute, fili mi?"',
    levels: [
      { dmg: 14, cd: 1.00, range: 62, arc: 1.9, kb: 90 },
      { dmg: 20, cd: 0.95, range: 66, arc: 1.9, kb: 95 },
      { dmg: 26, cd: 0.90, range: 70, arc: 2.0, kb: 100 },
      { dmg: 33, cd: 0.85, range: 74, arc: 2.0, kb: 105 },
      { dmg: 41, cd: 0.80, range: 78, arc: 2.1, kb: 110 },
      { dmg: 50, cd: 0.70, range: 84, arc: 2.2, kb: 120 },
    ],
  },
  // LANCIA — affondo lungo e stretto nella direzione in cui vai: trapassa tutta la fila
  spear: {
    name: 'Hasta', icon: 'it_spear', gear: true,
    desc: '"Vae victis!"',
    levels: [
      { dmg: 20, cd: 1.25, range: 120, width: 13, kb: 120 },
      { dmg: 25, cd: 1.20, range: 126, width: 13, kb: 125 },
      { dmg: 31, cd: 1.15, range: 134, width: 14, kb: 130 },
      { dmg: 38, cd: 1.10, range: 142, width: 15, kb: 135 },
      { dmg: 46, cd: 1.00, range: 152, width: 16, kb: 140 },
      { dmg: 56, cd: 0.90, range: 166, width: 18, kb: 150 },
    ],
  },
  // ARCO — frecce perforanti nella direzione in cui vai
  bow: {
    name: 'Arcus Chironis', icon: 'it_bow', gear: true,
    desc: '"Chirón prese uno strale."',
    levels: [
      { dmg: 11, cd: 0.85, amount: 1, speed: 560, pierce: 3 },
      { dmg: 14, cd: 0.80, amount: 1, speed: 580, pierce: 3 },
      { dmg: 14, cd: 0.80, amount: 2, speed: 580, pierce: 4 },
      { dmg: 18, cd: 0.75, amount: 2, speed: 600, pierce: 4 },
      { dmg: 18, cd: 0.70, amount: 3, speed: 620, pierce: 5 },
      { dmg: 23, cd: 0.60, amount: 3, speed: 650, pierce: 6 },
    ],
    life: 0.9, spread: 0.16,
  },
  // ASCIA — lanciata in alto, ricade spaccando tutto quello che incontra
  axe: {
    name: 'Bipennis', icon: 'it_axe', gear: true,
    desc: '"Carthago delenda est."',
    levels: [
      { dmg: 26, cd: 1.60, amount: 1, size: 1.0 },
      { dmg: 32, cd: 1.55, amount: 1, size: 1.0 },
      { dmg: 32, cd: 1.50, amount: 2, size: 1.1 },
      { dmg: 40, cd: 1.45, amount: 2, size: 1.15 },
      { dmg: 40, cd: 1.35, amount: 3, size: 1.2 },
      { dmg: 50, cd: 1.20, amount: 3, size: 1.3 },
    ],
    life: 1.5, up: 340, grav: 640,
  },

  dart: {
    name: 'Sagitta', icon: 'ico_dart',
    desc: '"Volat irrevocabile verbum."',
    levels: [
      { dmg: 10, cd: 0.90, amount: 1, speed: 420, pierce: 1, kb: 60 },
      { dmg: 10, cd: 0.90, amount: 2, speed: 420, pierce: 1, kb: 60 },
      { dmg: 14, cd: 0.85, amount: 2, speed: 450, pierce: 2, kb: 70 },
      { dmg: 14, cd: 0.75, amount: 3, speed: 450, pierce: 2, kb: 70 },
      { dmg: 20, cd: 0.60, amount: 4, speed: 500, pierce: 3, kb: 80 },
    ],
    upDesc: ['', '+1 cristallo', '+danno, perfora 2', '+1 cristallo, ricarica più veloce', '+danno, +1 cristallo, perfora 3'],
    evo: {
      passive: 'cooldown', name: 'Piova Etterna', icon: 'ico_dart',
      desc: '"Piova etterna, maladetta, fredda e greve."',
      stats: { dmg: 22, cd: 0.10, amount: 1, speed: 580, pierce: 5, kb: 40 },
    },
    burstDelay: 0.07, range: 520, life: 1.6,
  },

  aura: {
    name: 'Limbus', icon: 'ico_aura',
    desc: '"Che \'n quel limbo eran sospesi."',
    levels: [
      { dmg: 5,  cd: 0.60, radius: 55, kb: 20 },
      { dmg: 6,  cd: 0.60, radius: 66, kb: 20 },
      { dmg: 8,  cd: 0.50, radius: 72, kb: 25 },
      { dmg: 10, cd: 0.50, radius: 82, kb: 25 },
      { dmg: 13, cd: 0.45, radius: 96, kb: 30 },
    ],
    upDesc: ['', '+raggio', '+danno, più frequente', '+danno, +raggio', '+danno, +raggio'],
    evo: {
      passive: 'maxhp', name: 'Nove Cerchi', icon: 'ico_aura',
      desc: '"Così discesi del cerchio primaio giù nel secondo."',
      stats: { dmg: 20, cd: 0.35, radius: 130, kb: 50, slow: 0.55 },
    },
  },

  orbit: {
    name: 'Sphaerae', icon: 'ico_orb',
    desc: '"La gloria di colui che tutto move."',
    levels: [
      { dmg: 8,  amount: 2, radius: 60, spin: 3.2, size: 9,  kb: 40 },
      { dmg: 8,  amount: 3, radius: 60, spin: 3.2, size: 9,  kb: 40 },
      { dmg: 11, amount: 3, radius: 70, spin: 3.4, size: 10, kb: 45 },
      { dmg: 11, amount: 4, radius: 72, spin: 3.8, size: 10, kb: 45 },
      { dmg: 15, amount: 5, radius: 80, spin: 4.0, size: 11, kb: 50 },
    ],
    upDesc: ['', '+1 ampolla', '+danno, +raggio', '+1 ampolla, più veloci', '+danno, +1 ampolla'],
    evo: {
      passive: 'speed', name: 'Primo Mobile', icon: 'ico_orb',
      desc: '"Per l\'universo penetra, e risplende."',
      stats: { dmg: 22, amount: 7, radius: 96, spin: 4.6, size: 12, kb: 60 },
    },
    hitCd: 0.45,
  },

  lightning: {
    name: 'Fulmen', icon: 'ico_bolt',
    desc: '"Qual io fui vivo, tal son morto."',
    levels: [
      { dmg: 18, cd: 2.2, amount: 1, area: 24, chain: 0 },
      { dmg: 18, cd: 2.2, amount: 2, area: 24, chain: 0 },
      { dmg: 24, cd: 2.1, amount: 2, area: 30, chain: 0 },
      { dmg: 24, cd: 1.9, amount: 3, area: 30, chain: 0 },
      { dmg: 32, cd: 1.6, amount: 4, area: 36, chain: 0 },
    ],
    upDesc: ['', '+1 fulmine', '+danno, +area', '+1 fulmine, più frequente', '+danno, +1 fulmine'],
    evo: {
      passive: 'magnet', name: 'Iuppiter Tonans', icon: 'ico_bolt',
      desc: '"Caelo tonantem credidimus Iovem regnare."',
      stats: { dmg: 40, cd: 1.2, amount: 5, area: 40, chain: 3 },
    },
  },

  bomb: {
    name: 'Ignis', icon: 'ico_bomb',
    desc: '"Ignis aurum probat."',
    levels: [
      { dmg: 22, cd: 2.6, amount: 1, area: 48, split: 0 },
      { dmg: 22, cd: 2.6, amount: 2, area: 48, split: 0 },
      { dmg: 30, cd: 2.5, amount: 2, area: 56, split: 0 },
      { dmg: 30, cd: 2.2, amount: 3, area: 58, split: 0 },
      { dmg: 40, cd: 1.9, amount: 3, area: 66, split: 0 },
    ],
    upDesc: ['', '+1 granata', '+danno, +area', '+1 granata, più frequente', '+danno, +area'],
    evo: {
      passive: 'might', name: 'Falde di Fuoco', icon: 'ico_bomb',
      desc: '"Piovean di foco dilatate falde."',
      stats: { dmg: 50, cd: 1.6, amount: 4, area: 76, split: 4 },
    },
    flight: 0.6, range: 320,
  },

  scythe: {
    name: 'Falx Lunae', icon: 'ico_scythe',
    desc: '"Tempus edax rerum."',
    levels: [
      { dmg: 12, cd: 1.8, amount: 1, speed: 360, life: 1.2, size: 1.0 },
      { dmg: 12, cd: 1.8, amount: 2, speed: 360, life: 1.2, size: 1.0 },
      { dmg: 17, cd: 1.7, amount: 2, speed: 380, life: 1.3, size: 1.15 },
      { dmg: 17, cd: 1.5, amount: 3, speed: 380, life: 1.3, size: 1.15 },
      { dmg: 24, cd: 1.3, amount: 3, speed: 400, life: 1.4, size: 1.3 },
    ],
    upDesc: ['', '+1 falce', '+danno, più grande', '+1 falce, più frequente', '+danno, più grande'],
    evo: {
      passive: 'xp', name: 'Eclipsis', icon: 'ico_scythe',
      desc: '"Sic transit gloria mundi."',
      stats: { dmg: 34, cd: 1.0, amount: 5, speed: 430, life: 1.5, size: 1.6 },
    },
  },

  acid: {
    name: 'Aqua Stygia', icon: 'ico_acid',
    desc: '"Una palude fa, c\'ha nome Stige."',
    levels: [
      { dmg: 6,  cd: 3.0, amount: 1, area: 36, dur: 2.5 },
      { dmg: 6,  cd: 3.0, amount: 2, area: 36, dur: 2.5 },
      { dmg: 8,  cd: 2.8, amount: 2, area: 42, dur: 3.0 },
      { dmg: 8,  cd: 2.5, amount: 3, area: 44, dur: 3.0 },
      { dmg: 12, cd: 2.2, amount: 3, area: 50, dur: 3.5 },
    ],
    upDesc: ['', '+1 fiala', '+danno, pozze più larghe e lunghe', '+1 fiala, più frequente', '+danno, pozze più larghe'],
    evo: {
      passive: 'regen', name: 'Flegetonte', icon: 'ico_acid',
      desc: '"La riviera del sangue in la qual bolle."',
      stats: { dmg: 16, cd: 2.0, amount: 4, area: 72, dur: 5.0, slow: 0.5 },
    },
    flight: 0.5, range: 260, tick: 0.5,
  },

  // ARMA SEGRETA e la PIÙ FORTE del gioco: non esce nelle carte finché non resisti fino all'11:00 nella Cripta
  // (UNLOCKS in 05_data_maps.js). Fiamme nere, gialle e bianche che inseguono e a ogni colpo SCOPPIANO:
  //   splash = raggio dello scoppio (x area) | splashDmg = quota del danno che fa lo scoppio a chi è attorno
  // Danno triplicato rispetto alla vecchia versione normale (il 2026-10-22).
  wisps: {
    name: 'Linguae Ignis', icon: 'ico_wisp', secret: 'wisps',
    desc: '"Ogni fiamma un peccatore invola." Fiamme che inseguono e scoppiano.',
    levels: [
      { dmg: 42, cd: 1.6, amount: 2, speed: 220, pierce: 1, splash: 30 },
      { dmg: 42, cd: 1.6, amount: 3, speed: 220, pierce: 1, splash: 30 },
      { dmg: 57, cd: 1.5, amount: 3, speed: 240, pierce: 1, splash: 34 },
      { dmg: 57, cd: 1.3, amount: 4, speed: 240, pierce: 2, splash: 40 },
      { dmg: 72, cd: 1.2, amount: 5, speed: 260, pierce: 3, splash: 48 },
    ],
    upDesc: ['', '+1 fiammella', '+danno, più veloci, scoppio più largo', '+1 fiammella, perforano', '+danno, +1 fiammella, perforano di più, scoppio più largo'],
    evo: {
      passive: 'cooldown', name: 'Folle Volo', icon: 'ico_wisp',
      desc: '"De\' remi facemmo ali al folle volo."',
      stats: { dmg: 90, cd: 1.0, amount: 8, speed: 290, pierce: 3, splash: 50 },
    },
    life: 3.0, turn: 7, splashDmg: 0.6,
  },

  // FLAGELLO — sferzate orizzontali: prima dalla parte in cui guardi, poi dietro, poi sopra e sotto
  whip: {
    name: 'Flagellum', icon: 'ico_whip',
    desc: '"Ahi come facean lor levar le berze!"',
    levels: [
      { dmg: 13, cd: 1.35, amount: 1, range: 110, height: 20, kb: 70 },
      { dmg: 13, cd: 1.35, amount: 2, range: 110, height: 20, kb: 70 },
      { dmg: 18, cd: 1.25, amount: 2, range: 126, height: 22, kb: 80 },
      { dmg: 18, cd: 1.10, amount: 3, range: 132, height: 24, kb: 80 },
      { dmg: 25, cd: 1.00, amount: 3, range: 146, height: 26, kb: 90 },
    ],
    upDesc: ['', '+1 sferzata (anche dietro)', '+danno, più lunga', '+1 sferzata, più frequente', '+danno, più lunga e larga'],
    evo: {
      passive: 'area', name: 'Malebolge', icon: 'ico_whip',
      desc: '"Luogo è in inferno detto Malebolge."',
      stats: { dmg: 36, cd: 0.85, amount: 4, range: 180, height: 32, kb: 110, stun: 0.6 },
    },
    gap: 0.12,             // secondi tra una sferzata e l'altra
  },

  // BUFERA — turbini che vagano attorno a te e colpiscono di continuo chi c'è dentro
  storm: {
    name: 'Procella', icon: 'ico_storm',
    desc: '"La bufera infernal, che mai non resta."',
    levels: [
      { dmg: 7,  cd: 3.2, amount: 1, speed: 80, life: 3.0, size: 22, kb: 30 },
      { dmg: 7,  cd: 3.2, amount: 2, speed: 80, life: 3.0, size: 22, kb: 30 },
      { dmg: 10, cd: 3.0, amount: 2, speed: 85, life: 3.5, size: 26, kb: 35 },
      { dmg: 10, cd: 2.7, amount: 3, speed: 85, life: 3.5, size: 26, kb: 35 },
      { dmg: 14, cd: 2.5, amount: 3, speed: 90, life: 4.0, size: 30, kb: 40 },
    ],
    upDesc: ['', '+1 turbine', '+danno, più grandi e lunghi', '+1 turbine, più frequenti', '+danno, più grandi'],
    evo: {
      passive: 'greed', name: 'Bufera Infernale', icon: 'ico_storm',
      desc: '"Di qua, di là, di giù, di sù li mena."',
      stats: { dmg: 20, cd: 2.2, amount: 4, speed: 95, life: 5.0, size: 40, kb: -70 },
    },
    tick: 0.3, leash: 230,  // ogni quanto colpisce | quanto si allontana prima di tornare verso di te
  },

  // LUME — raggi di luce che ti girano attorno come un faro: colpiscono tutto quello che spazzano
  beam: {
    name: 'Lumen', icon: 'ico_beam',
    desc: '"Luce intellettual, piena d\'amore."',
    levels: [
      { dmg: 14, spin: 2.6, amount: 1, range: 120, kb: 25 },
      { dmg: 18, spin: 2.6, amount: 1, range: 126, kb: 25 },
      { dmg: 18, spin: 2.8, amount: 2, range: 132, kb: 30 },
      { dmg: 24, spin: 2.8, amount: 2, range: 144, kb: 30 },
      { dmg: 30, spin: 3.0, amount: 3, range: 156, kb: 35 },
    ],
    upDesc: ['', '+danno', '+1 raggio, più veloce', '+danno, più lungo', '+danno, +1 raggio'],
    evo: {
      passive: 'amount', name: 'Candida Rosa', icon: 'ico_beam',
      desc: '"In forma dunque di candida rosa."',
      stats: { dmg: 30, spin: 3.2, amount: 5, range: 180, kb: 40 },
    },
  },

  // GELO — onda di ghiaccio attorno a te: danno + rallentamento (l'evoluzione congela)
  frost: {
    name: 'Gelu', icon: 'ico_frost',
    desc: '"Lo \'mperador del doloroso regno."',
    levels: [
      { dmg: 14, cd: 3.4, amount: 1, radius: 95,  slow: 0.5,  dur: 1.4 },
      { dmg: 14, cd: 3.4, amount: 1, radius: 110, slow: 0.5,  dur: 1.6 },
      { dmg: 20, cd: 3.2, amount: 1, radius: 115, slow: 0.45, dur: 1.8 },
      { dmg: 20, cd: 2.9, amount: 2, radius: 125, slow: 0.45, dur: 1.8 },
      { dmg: 28, cd: 2.7, amount: 2, radius: 140, slow: 0.4,  dur: 2.0 },
    ],
    upDesc: ['', '+raggio, rallenta più a lungo', '+danno, rallenta di più', '+1 onda, più frequente', '+danno, +raggio'],
    evo: {
      passive: 'armor', name: 'Giudecca', icon: 'ico_frost',
      desc: '"Là dove l\'ombre tutte eran coperte."',
      stats: { dmg: 40, cd: 2.4, amount: 2, radius: 175, slow: 0.05, dur: 1.4 },
    },
    gap: 0.35, kb: 40,
  },

  // VITE AEREA — lame che si avvitano verso l'esterno lungo una spirale aurea (il raggio cresce di φ a ogni quarto di giro)
  helix: {
    name: 'Helix Aerea', icon: 'ico_helix',
    desc: '"Qual è \'l geomètra che tutto s\'affige per misurar lo cerchio."',
    levels: [
      { dmg: 12, cd: 2.2, amount: 2, speed: 260, reach: 170, size: 7, kb: 40 },
      { dmg: 12, cd: 2.2, amount: 3, speed: 260, reach: 170, size: 7, kb: 40 },
      { dmg: 16, cd: 2.0, amount: 3, speed: 280, reach: 190, size: 8, kb: 45 },
      { dmg: 16, cd: 1.8, amount: 4, speed: 280, reach: 200, size: 8, kb: 45 },
      { dmg: 22, cd: 1.6, amount: 5, speed: 300, reach: 220, size: 9, kb: 50 },
    ],
    upDesc: ['', '+1 lama', '+danno, spirale più ampia', '+1 lama, più frequente', '+danno, +1 lama'],
    evo: {
      passive: 'speed', name: 'Grande Nibbio', icon: 'ico_helix',
      desc: '"Piglierà il primo volo il grande uccello." Spirali in due sensi.',
      stats: { dmg: 30, cd: 1.3, amount: 6, speed: 320, reach: 260, size: 10, kb: 60, twin: 1 },
    },
    r0: 14, phi: 1.6180339887,
  },
};

// ----------------------------------------------------------------------------
// PASSIVE — 5 livelli, `per` = effetto per livello
// ----------------------------------------------------------------------------
const PASSIVE_DEFS = {
  might:    { name: 'Virtus',            icon: 'ico_might',   per: 0.10, desc: '+10% danno' },
  speed:    { name: 'Ali di Gerione',    icon: 'ico_speed',  per: 0.08, desc: '+8% velocità di movimento' },
  maxhp:    { name: 'Cor Fortis',        icon: 'ico_heart',  per: 20,   desc: '+20 vita massima' },
  regen:    { name: 'Acqua del Lete',    icon: 'ico_regen',  per: 0.25, desc: '+0.25 vita al secondo' },
  magnet:   { name: 'Amor che move',     icon: 'ico_magnet', per: 0.30, desc: '+30% raggio magnete' },
  xp:       { name: 'Sapientia',         icon: 'ico_book',    per: 0.10, desc: '+10% esperienza' },
  cooldown: { name: 'Tempus Fugit',      icon: 'ico_hourglass', per: 0.06, desc: '-6% tempo di ricarica' },
  area:     { name: 'Statura di Anteo',  icon: 'ico_area',    per: 0.10, desc: '+10% area di tutte le armi' },
  amount:   { name: 'Gemelli',           icon: 'ico_twins',   per: 1,    max: 2, desc: '+1 proiettile a tutte le armi (max Lv 2)' },
  greed:    { name: 'Fortuna',           icon: 'ico_greed',   per: 0.25, desc: '+25% monete' },
  armor:    { name: 'Lorica',            icon: 'ico_armor',   per: 1,    desc: '-1 danno a ogni colpo subito' },
};
const PASSIVE_MAX = 5;
// livello massimo di una passiva (Gemelli si ferma a 2)
function pMax(id) { return PASSIVE_DEFS[id].max || PASSIVE_MAX; }

// EVOLUZIONI: contorno verde evidenziatore su tutto ciò che disegnano (proiettili, aure, raggi, esplosioni,
// icone nella HUD e nelle carte). Solo il contorno: l'interno resta scuro. In PAL è il colore '~'.
const EVO_NEON = '#c8ff1e';

// RILANCIO — nel level up puoi rilanciare le 3 carte se non ti piacciono (tasto R o il bottone). Tot per partita.
const REROLL = { perRun: 3 };

// FUSIONE — con un Arcanum [?] (lo vende il Magister) due armi al massimo (Lv 5 o evolute) si fondono in una:
// occupano UN solo posto (se ne libera uno), sparano entrambe e diventano più forti. La carta esce nel level up.
//   dmg / cd = moltiplicatori su danno e ricarica | area = su raggio, gittata, area e grandezza | amount = colpi in più
const FUSION = { dmg: 1.5, cd: 0.8, area: 1.15, amount: 1, areaKeys: ['radius', 'range', 'area', 'size', 'reach', 'width', 'height', 'splash'] };
const FUSE_NEON = '#ff4fd8';   // magenta: bordo delle armi fuse (HUD, carte, resoconto)

// FUSIONI UNICHE — 5 coppie, oltre ai potenziamenti normali, hanno un nome e un effetto tutto loro.
// Chiave = i due id in ordine alfabetico (fuseKey). `fx` = quale effetto (lo leggono i ganci in 20_weapons.js).
const FUSION_SPECIAL = {
  'lightning+wisps': { name: 'Fulmini di Capaneo', fx: 'capaneo', chain: 3, chainDmg: 0.6, every: 0.12,
    desc: '"Qual io fui vivo, tal son morto." Ogni scoppio di fiamma lancia un fulmine a catena.' },
  'frost+storm':     { name: 'Vento di Lucifero', fx: 'lucifero', freeze: 1.0,
    desc: '"Quindi Cocito tutto s\'aggelava." I turbini congelano chi trascinano.' },
  'acid+bomb':       { name: 'Sabbione Ardente', fx: 'sabbione', dur: 2.5, dmgK: 0.35, rK: 0.85,
    desc: '"Sovra tutto \'l sabbion, d\'un cader lento." Ogni esplosione lascia una pozza di fuoco.' },
  'dart+lightning':  { name: 'Strali di Giove', fx: 'giove', chance: 0.25, dmgK: 1.0, area: 34,
    desc: '"Folgore e saetta." Un cristallo su quattro chiama un fulmine sul bersaglio.' },
  'frost+orbit':     { name: 'Stelle di Cocito', fx: 'stelle', freeze: 0.8,
    desc: '"E quindi uscimmo a riveder le stelle." Le ampolle congelano chi toccano.' },
};
function fuseKey(a, b) { return a < b ? a + '+' + b : b + '+' + a; }
// ghiaccio delle fusioni uniche: frzM quasi zero (fermo come lo stordimento, ma Render lo disegna come un blocco di ghiaccio)
const FUSE_ICE = 0.001;
// stili dei fulmini (FX.val dei FXK.BOLT): 0 normale, 1 Capaneo (nero/giallo/bianco), 2 Giove (oro)
const BOLT_STYLE = { normal: 0, capaneo: 1, giove: 2 };

// Carte "di riserva" quando tutto è al massimo
const FILLER_CARDS = {
  heal:  { name: 'Manna',              icon: 'ico_heart', desc: 'Recupera 30 vita.' },
  coins: { name: 'Obolo di Caronte', icon: 'coin', desc: '+1 moneta.' },
};
