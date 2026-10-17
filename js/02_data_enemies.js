'use strict';
// js/02_data_enemies.js — ENEMY_DEFS, costanti dei nemici speciali (ELITE, NIGHT, BOSS...), SPAWN

// ----------------------------------------------------------------------------
// NEMICI — indice nell'array = "type" salvato nel pool
// coin = probabilità di lasciare una moneta
// ----------------------------------------------------------------------------
const ENEMY_DEFS = [
  { id: 'heavy',   name: 'Gulosus',           sprite: 'slime_heavy',   hp: 26, speed: 50,  dmg: 10, r: 15, mass: 3.0, xp: 3, coin: 0.022, splat: 'C' },
  { id: 'fast',    name: 'Ignavus',           sprite: 'slime_fast',    hp: 7,  speed: 128, dmg: 6,  r: 9,  mass: 0.7, xp: 1, coin: 0.009, splat: 'B' },
  { id: 'spitter', name: 'Iracundus',         sprite: 'slime_spitter', hp: 14, speed: 60,  dmg: 7,  r: 12, mass: 1.2, xp: 2, coin: 0.015, splat: '8' },
  { id: 'boss',    name: 'Flegiàs', sprite: 'boss_black', hp: 3200, speed: 46, dmg: 28, r: 140, mass: 80, xp: 0, coin: 0, splat: '4', boss: true },
  { id: 'boss2',   name: 'Tifeo', sprite: 'boss_storm', hp: 4400, speed: 36, dmg: 26, r: 140, mass: 80, xp: 0, coin: 0, splat: 'n', boss: true },
  { id: 'elite',   name: 'Venator', sprite: 'slime_elite', hp: 260, speed: 92, dmg: 18, r: 22, mass: 6, xp: 25, coin: 0.15, splat: 'C' },
  { id: 'boss3',   name: 'Chaos', sprite: 'boss_primal', hp: 7000, speed: 30, dmg: 30, r: 150, mass: 80, xp: 0, coin: 0, splat: 't', boss: true },
  { id: 'drop',    name: 'Larva',            sprite: 'slime_drop',    hp: 4,  speed: 82,  dmg: 4,  r: 7,  mass: 0.5, xp: 1, coin: 0.0045, splat: 'e' },
  // nemici speciali delle mappe
  { id: 'toxic',   name: 'Accidiosus',       sprite: 'slime_toxic',   hp: 16, speed: 62,  dmg: 7,  r: 12, mass: 1.2, xp: 2, coin: 0.015, splat: 'e' },
  { id: 'ghost',   name: 'Umbra',            sprite: 'ghost',         hp: 12, speed: 84,  dmg: 8,  r: 11, mass: 0.6, xp: 2, coin: 0.015, splat: '8' },
  { id: 'lupa',    name: 'Lupa',              sprite: 'slime_lupa',    hp: 22, speed: 96,  dmg: 9,  r: 12, mass: 1.0, xp: 3, coin: 0.018, splat: 'C' },
  { id: 'furia',   name: 'Erinys',           sprite: 'slime_furia',   hp: 18, speed: 70,  dmg: 8,  r: 12, mass: 1.0, xp: 3, coin: 0.018, splat: 'D' },
  { id: 'gelido',  name: 'Proditor',         sprite: 'slime_gelido',  hp: 30, speed: 54,  dmg: 9,  r: 13, mass: 2.0, xp: 3, coin: 0.018, splat: 'u' },
];
// LUPA (Selva Oscura): ti punta, si ferma un attimo e balza (come un piccolo Cacciatore)
const LUPA = { chaseTime: 1.7, tell: 0.35, dashSpeed: 330, dashTime: 0.32 };
// FURIA (Città di Dite): tiene le distanze e lancia ventagli di 3 fiammate
const FURIA = { range: 320, cd: 2.8, speed: 165, keepAway: 190, spread: 0.28 };
// TRADITORE GELIDO (Cocito): se ti tocca ti congela le gambe (rallenta)
const FROST = { slowT: 1.6, slow: 0.6 };
// SLIME VELENOSO (Palude): lascia pozze di veleno dove passa
const TOXIC = { every: 1.3, life: 2.6, r: 15, dmg: 5 };
// SPETTRO (Cattedrale): attraversa le colonne, ondeggia e ogni tanto "salta" verso di te
const GHOST = { blinkEvery: 3.6, blinkDist: 90, wave: 0.55 };
// BOSS del minuto 5 — enorme, nero, carica telegrafata ed evoca gocce
// CACCIATORI — mini-boss che ti puntano e caricano (dal minuto 4)
const ELITE = {
  start: 240,             // secondo del primo Cacciatore
  every: 30,              // intervallo iniziale tra un Cacciatore e l'altro
  minEvery: 12,           // intervallo minimo
  faster: 3,              // ogni minuto l'intervallo cala di tot secondi
  chaseTime: 2.6,         // inseguimento prima di caricare
  tell: 0.5,              // preavviso (diventa rosso)
  dashSpeed: 400,
  dashTime: 0.45,
};

// NOTTE — dopo il minuto 6: ogni 60 s, 40 di giorno e 20 di notte
const NIGHT = {
  start: 360, cycle: 60, nightLen: 20,
  lightR: 150,            // raggio (unità di mondo) della luce attorno al personaggio
  dark: 0.9,              // quanto è scuro il mondo fuori dalla luce (0..1)
  fade: 2.5,              // secondi del crepuscolo / dell'alba
  speedMult: 1.25,        // di notte gli slime corrono di più
  dmgMult: 1.3,           // e mordono più forte
};

// VITTORIA — si vince resistendo fino al minuto 7. Poi si può continuare (modalità infinita).
const WIN = { time: 420, warnAt: 405, reward: { coins: 5 } };   // monete x moltiplicatore difficoltà (bonus vittoria)

// SUBITO DOPO LA VITTORIA (se continui): i due guardiani della mappa (b2 + b3) arrivano INSIEME.
// delay = secondi dal "Continua" all'arrivo, warnBefore = avviso quanti secondi prima
const DUO = { delay: 9, warnBefore: 5 };

// MINUTO 10 (solo se continui): i tre boss della mappa arrivano INSIEME e gli slime diventano più forti
const TRIO = { time: 600, warnAt: 590 };
const LATE = { time: 600, hp: 1.5, dmg: 1.3, speed: 1.1 };     // moltiplicatori sugli slime nati dal minuto 10 in poi

// BOSS 2 — guardiano minore della mappa: fulmini su zone segnate a terra e/o servi
const BOSS2 = {
  strikeEvery: 2.4,       // ogni quanto lancia una raffica
  strikeTell: 1.0,        // quanto resta visibile la zona prima del colpo
  strikeR: 56,            // raggio dell'area colpita
  strikeDmg: 45,          // danno se sei dentro (x difficoltà e tempo)
  strikeCount: 3,
  bigEvery: 4,            // ogni N raffiche, una raffica grande
  bigCount: 7,
  spread: 150,            // quanto si allargano i colpi attorno a te
  reward: { gems: 50, gemVal: 7, coins: 3 },
};

// BOSS 3 — guardiano maggiore della mappa: raffiche di proiettili a raggiera e a spirale.
const BOSS3 = {
  burstEvery: 2.3,        // raggiera
  burstCount: 18,
  spiralEvery: 3,         // ogni N raggiere, una spirale
  spiralTime: 2.2,
  bulletSpeed: 135,
  bulletDmg: 22,          // x difficoltà, mappa e tempo
  summonEvery: 10,
};

// SCATTO — abilità di tutti i personaggi: Spazio (PC) o doppio tocco (telefono)
// Breve corsa velocissima e invulnerabile. Eek alla fine lancia un ventaglio di kunai.
const DASH = { cd: 3.5, cdEek: 2.8, time: 0.16, speed: 950, iframes: 0.32, kunai: 5, kunaiDmg: 16, spread: 0.22 };

// ARCIERE (Iracundus, ex Sputacchino) — pochi, ma pericolosi: si ferma, tende l'arco (linea di mira che ti segue,
// poi si blocca e diventa bianca) e scocca UNA freccia grossa e veloce che toglie tanta vita. Le colonne fanno da riparo.
//   share = quota tra gli slime normali (x G.map.spitter) | cd = tempo tra un tiro e l'altro | tell = quanto tende l'arco
//   lock = ultimi secondi del tell con la mira bloccata | dmgMult = danno della freccia rispetto al morso dell'arciere
const SPIT = { share: 0.05, range: 340, cd: 5.0, tell: 0.9, lock: 0.3, speed: 330, life: 2.4, keepAway: 190, dmgMult: 2.8 };

// FORZIERI — li lasciano i Cacciatori (a volte) e i boss (sempre): 1 o 3 potenziamenti
const CHEST = { eliteChance: 0.45, three: 0.3 };

// MODALITÀ INFINITA — dopo la vittoria puoi continuare: al minuto 10 il trio, poi un boss ogni tot secondi
const ENDLESS = { bossEvery: 100 };

// PIETRA DEL FABBRO — la lasciano i boss; usata al fabbro aggiunge probabilità al tentativo
const STONE = { bonus: 0.30 };

const BOSS = {
  time: 300,              // secondo in cui arriva
  warnAt: 290,            // avviso qualche secondo prima
  chargeEvery: 5.5,       // ogni quanto prepara una carica
  tell: 1.0,              // durata del "preavviso" (diventa rosso scuro e trema)
  dashSpeed: 430,
  dashTime: 0.75,
  summonEvery: 8,         // evoca un anello di gocce
  summonCount: 12,
  catchUp: 3.5,           // se lo semini, accelera così tanto
  spawnMult: 0.5,         // mentre c'è il boss, i nemici normali arrivano a metà ritmo
  reward: { gems: 40, gemVal: 6, coins: 2 },   // monete x moltiplicatore difficoltà
};

const ET = {};
ENEMY_DEFS.forEach((d, i) => { ET[d.id] = i; });

// ----------------------------------------------------------------------------
// SPAWN (provvisorio — in fase 3 diventa il sistema a ondate con i boss)
// I valori sono per "Normale", poi moltiplicati da DIFFICULTY.spawn
// ----------------------------------------------------------------------------
const SPAWN = {
  baseRate: 1.6,          // nemici/secondo a t=0
  rateGrowth: 1 / 16,     // +1 nemico/s ogni 16 secondi
  maxAlive: 1200,
  swarmEvery: 16,         // ogni N secondi uno sciame di gocce
  swarmSize: [12, 22],
  firstSwarm: 6,          // il primo sciame arriva presto
};
