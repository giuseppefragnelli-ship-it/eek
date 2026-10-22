'use strict';
// js/01_config.js — CFG (tutti i numeri globali) e DIFFICULTY

// ============================================================================
// CONFIG — tutti i numeri di bilanciamento stanno qui.
// Per ritoccare il gioco di solito basta questo file:
//   - DIFFICULTY  : una sola modalità, Incubo (niente scelta nel menu)
//   - SPAWN       : quanti nemici e quanto velocemente cresce il flusso
//   - ENEMY_DEFS  : vita / velocità / danno / drop di ogni slime
//   - WEAPON_DEFS : statistiche delle armi per livello (+ evoluzione)
//   - PASSIVE_DEFS: effetto per livello delle passive
// ============================================================================

const CFG = {
  PIX_TARGET: 440,        // pixel "veri" desiderati sul lato corto dello schermo (più alto = più risoluzione)
  VIEW_MIN: 720,          // quante unità di mondo si vedono sul lato corto (lo "zoom" della partita, uguale su tutti gli schermi)
  UNIT: 2,                // unità di mondo per pixel: la calcola Render.resize() = VIEW_MIN / pixel del lato corto
  DT: 1 / 60,             // timestep fisso della simulazione
  MAX_STEPS: 5,

  MAX_ENEMIES: 3000,
  MAX_PROJ: 2000,
  MAX_GEMS: 2500,
  MAX_FX: 1500,
  MAX_ESHOTS: 600,        // proiettili dei nemici (Sputacchini, boss finale)
  MAX_ZONES: 64,          // pozze acide

  GRID_CELL: 64,
  GRID_MARGIN: 320,
  MAX_ENEMY_R: 64,        // raggio massimo dei nemici NORMALI (il boss è gestito a parte, fuori dalla grid)
  SEPARATION_MAX_NEIGHBORS: 14,

  MAX_WEAPONS: 6,
  MAX_PASSIVES: 6,

  player: {
    speed: 150,
    hp: 100,
    r: 10,
    magnet: 70,
    pickup: 16,
    iframes: 0.35,        // invulnerabilità dopo un colpo (secondi): il danno arriva a "colpi", non a pioggia
  },

  // Oggetti rari lasciati dagli slime (probabilità per uccisione; i Pesanti x3)
  drops: {
    heal: 0.004,          // Ampolla di cura
    healAmount: 30,
    vacuum: 0.0015,       // Calamita: attira tutte le gemme della mappa
  },

  GEM_MERGE_AT: 250,      // oltre queste gemme a terra, quelle fuori schermo si fondono in una sola

  // Effetti
  screenShake: true,
  damageNumbers: true,

  // Esperienza necessaria per passare dal livello L al L+1
  xpToNext(level) {
    return Math.floor(3 + level * 2.4 + level * level * 0.35);
  },

  // Crescita dei nemici col tempo (secondi), poi moltiplicata per la difficoltà
  enemyHpMult(t) { return 1 + (t / 60) * 0.35; },
  bossHpMult(t) { return 1 + t / 240; },          // i boss crescono più piano degli slime normali
  // le monete diventano più rare col passare dei minuti (sennò le partite lunghe fanno piovere soldi)
  coinDecay(t) { return 1 / (1 + t / 30); },
  enemyDmgMult(t) { return 1 + (t / 60) * 0.10; },

  contactCooldown: 0.5,   // ogni nemico colpisce il player al massimo ogni X secondi
};

// LUCE DEL GIORNO: i pavimenti delle mappe (tranne la Cripta, che è d'erba) vengono schiariti così:
// colore = colore x mul + add. La notte (NIGHT in 02_data_enemies.js) stende sopra un velo scuro.
const DAY_LIFT = { mul: 1.6, add: 3 };

// ----------------------------------------------------------------------------
// DIFFICOLTÀ — moltiplicatori applicati sopra ai valori base.
// coin = moltiplicatore probabilità di drop monete (più difficile = più soldi)
// ----------------------------------------------------------------------------
const DIFFICULTY = {
  // Normale e Difficile tolte il 2026-10-16: si gioca solo a Incubo. I salvataggi vecchi passano qui da soli (Save.load).
  incubo:    { label: 'Incubo',    spawn: 2.4,  hp: 1.6,  dmg: 2.0,  speed: 1.25, coin: 5, desc: '"Non ragioniam di lor, ma guarda e passa." · Monete x5' },
  // FACILE (per modo di dire): si sblocca resistendo fino all'11:00 nella Cattedrale (UNLOCKS.facile) e vale SOLO
  // sulla mappa `map` (l'ultima, il Cocito): dannati e boss 10 volte più forti di Incubo, sia di vita che di morso.
  facile:    { label: 'Facile',    spawn: 2.4,  hp: 16,   dmg: 20,   speed: 1.25, coin: 5, map: 'cocito', unlock: 'facile', desc: '"Facile." Solo nel Cocito: dannati 10 volte più forti.' },
};
const DEFAULT_DIFFICULTY = 'incubo';
