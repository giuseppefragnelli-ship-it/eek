'use strict';
// js/04_data_economy.js — monete, negozio, fabbro, missioni, maestrie, presagi, CHARACTERS

// ----------------------------------------------------------------------------
// ECONOMIA — le monete sono rare: ~4-5 a partita in Normale.
// Bonus sopravvivenza a fine partita: perMinute x minuti interi x moltiplicatore difficoltà.
// ----------------------------------------------------------------------------
const COIN = { perMinute: 1 };

// ----------------------------------------------------------------------------
// NEGOZIO — oggetti permanenti. Valore = base + per x livello (livello 0..5 dal fabbro)
// ----------------------------------------------------------------------------
// vendor = chi lo vende nel villaggio: 'weapons' (Armaiolo) | 'armor' (Corazzaio)
// shopLv = livello della bottega necessario per vederlo in vendita
const gearFmt = (id, lead) => (L) => { const s = WEAPON_DEFS[id].levels[L]; return lead + s.dmg + ' danno ogni ' + s.cd.toFixed(2).replace(/0$/, '') + ' s' + (s.amount > 1 ? ' (x' + s.amount + ')' : ''); };
const SHOP_ITEMS = {
  dagger:   { name: 'Pugio',   icon: 'it_dagger',   vendor: 'weapons', shopLv: 0, price: 6,  gear: true, fmtL: gearFmt('dagger', '') },
  spear:    { name: 'Hasta',   icon: 'it_spear',    vendor: 'weapons', shopLv: 1, price: 10, gear: true, fmtL: gearFmt('spear', '') },
  bow:      { name: 'Arcus Chironis', icon: 'it_bow',      vendor: 'weapons', shopLv: 1, price: 10, gear: true, fmtL: gearFmt('bow', '') },
  axe:      { name: 'Bipennis', icon: 'it_axe',      vendor: 'weapons', shopLv: 2, price: 14, gear: true, fmtL: gearFmt('axe', '') },
  shield:   { name: 'Scutum',  icon: 'it_shield',   vendor: 'armor', shopLv: 0, price: 8,  base: 1,    per: 1,    fmt: (v) => '-' + v + ' danno a ogni colpo subito' },
  boots:    { name: 'Caligae', icon: 'it_boots',    vendor: 'armor', shopLv: 0, price: 5,  base: 0.04, per: 0.03, fmt: (v) => '+' + Math.round(v * 100) + '% velocità di movimento' },
  necklace: { name: 'Monile',  icon: 'it_necklace', vendor: 'armor', shopLv: 0, price: 7,  base: 10,   per: 10,   fmt: (v) => '+' + v + ' vita massima' },
  ring:     { name: 'Anulus',  icon: 'it_ring',     vendor: 'armor', shopLv: 1, price: 9,  base: 0.06, per: 0.03, fmt: (v) => '+' + Math.round(v * 100) + '% esperienza' },
  cloak:    { name: 'Pallium', icon: 'it_cloak',   vendor: 'armor', shopLv: 2, price: 12, base: 0.03, per: 0.02, fmt: (v) => '+' + Math.round(v * 100) + '% di schivare i colpi' },
};

// BOTTEGHE — spendi monete per migliorarle: sbloccano oggetti nuovi (il fabbro diventa più bravo)
const SHOP_UPGRADES = {
  weapons: { costs: [12, 22], unlocks: ['Hasta e Arcus Chironis', 'Bipennis'] },
  armor:   { costs: [10, 20], unlocks: ['Anulus (+esperienza)', 'Pallium (+schivata)'] },
  smith:   { costs: [10, 20], unlocks: ['+5% di successo su ogni rafforzamento', '+10% di successo su ogni rafforzamento'], bonus: [0, 0.05, 0.10] },
};

// FABBRO — rafforza da +n a +n+1. Costo = prezzo x costMult^(n+1). Può SEMPRE fallire.
// failPenalty: 'downgrade' = l'oggetto perde un livello | 'break' = l'oggetto si distrugge | 'none' = perdi solo le monete
const SMITH = {
  maxLevel: 5,
  costMult: 1.5,
  success: [0.95, 0.80, 0.65, 0.50, 0.35],   // probabilità per +1, +2, +3, +4, +5
  failPenalty: 'downgrade',
};

// MISSIONI della Bacheca — `check(s)` guarda le statistiche di carriera (Save.data), reward = monete
// Categorie della Bacheca
const QUEST_CATS = {
  caedes: { name: 'Caedes' },     // uccisioni e boss
  iter:   { name: 'Iter' },       // mappe e sopravvivenza
  ars:    { name: 'Ars' },        // botteghe, fabbro, magister, aruspice
  gloria: { name: 'Gloria' },     // difficoltà, infinita, record
};
const _maxRec = (d, diff) => { let m = 0; for (const k in d.records) if (k.endsWith('/' + diff)) m = Math.max(m, d.records[k].t || 0); return m; };
const _winsAll = (d) => { let n = 0; for (const k in d.stats.winsDiff) n += d.stats.winsDiff[k]; return n; };
const _mastSum = (d) => { let n = 0; for (const k in d.mastery) n += d.mastery[k]; return n; };
const _hasDivine = (d) => { for (const k in d.omens) for (const o of d.omens[k]) if (o && o.r === 2) return true; return false; };
const QUESTS = [
  // CAEDES
  { id: 'k500',    cat: 'caedes', name: 'Primi dannati',       desc: 'Uccidi 500 dannati.',                  reward: 3,  check: (d) => d.stats.kills >= 500,  prog: (d) => [d.stats.kills, 500] },
  { id: 'k1000',   cat: 'caedes', name: 'Mille',               desc: 'Uccidi 1.000 dannati.',                reward: 4,  check: (d) => d.stats.kills >= 1000, prog: (d) => [d.stats.kills, 1000] },
  { id: 'k5000',   cat: 'caedes', name: 'Sterminatore',        desc: 'Uccidi 5.000 dannati.',                reward: 8,  check: (d) => d.stats.kills >= 5000, prog: (d) => [d.stats.kills, 5000] },
  { id: 'k20000',  cat: 'caedes', name: 'Strages',             desc: 'Uccidi 20.000 dannati.',               reward: 15, check: (d) => d.stats.kills >= 20000, prog: (d) => [d.stats.kills, 20000] },
  { id: 'k100000', cat: 'caedes', name: 'Ecatombe',            desc: 'Uccidi 100.000 dannati.',              reward: 30, check: (d) => d.stats.kills >= 100000, prog: (d) => [d.stats.kills, 100000] },
  { id: 'elite10', cat: 'caedes', name: 'Venatio',             desc: 'Uccidi 10 Venatores.',                 reward: 4,  check: (d) => d.stats.elites >= 10, prog: (d) => [d.stats.elites, 10] },
  { id: 'elite50', cat: 'caedes', name: 'Venatio Magna',       desc: 'Uccidi 50 Venatores.',                 reward: 10, check: (d) => d.stats.elites >= 50, prog: (d) => [d.stats.elites, 50] },
  { id: 'boss1',   cat: 'caedes', name: 'Corona nera',         desc: 'Uccidi Flegiàs.',                      reward: 5,  check: (d) => (d.stats.bosses.boss || 0) >= 1 },
  { id: 'boss2',   cat: 'caedes', name: 'Parafulmine',         desc: 'Uccidi un guardiano minore.',          reward: 6,  check: (d) => (d.stats.bosses.boss2 || 0) >= 1 },
  { id: 'boss2x10',cat: 'caedes', name: 'Custodes',            desc: 'Uccidi 10 guardiani minori.',          reward: 10, check: (d) => (d.stats.bosses.boss2 || 0) >= 10, prog: (d) => [d.stats.bosses.boss2 || 0, 10] },
  { id: 'boss3x5', cat: 'caedes', name: 'Quinque coronae',     desc: 'Uccidi 5 guardiani maggiori.',         reward: 12, check: (d) => (d.stats.bosses.boss3 || 0) >= 5, prog: (d) => [d.stats.bosses.boss3 || 0, 5] },
  // ITER
  { id: 'surv5',   cat: 'iter',   name: 'Tieni duro',          desc: 'Resisti 5 minuti.',                    reward: 3,  check: (d) => d.bestTime >= 300,    prog: (d) => [Math.floor(d.bestTime / 60), 5] },
  { id: 'surv10',  cat: 'iter',   name: 'Decem minuta',        desc: 'Resisti 10 minuti.',                   reward: 5,  check: (d) => d.bestTime >= 600,    prog: (d) => [Math.floor(d.bestTime / 60), 10] },
  { id: 'runs10',  cat: 'iter',   name: 'Peregrinus',          desc: 'Scendi 10 volte.',                     reward: 3,  check: (d) => d.runs >= 10, prog: (d) => [d.runs, 10] },
  { id: 'runs50',  cat: 'iter',   name: 'Viator',              desc: 'Scendi 50 volte.',                     reward: 10, check: (d) => d.runs >= 50, prog: (d) => [d.runs, 50] },
  { id: 'win1',    cat: 'iter',   name: 'Fine della cripta',   desc: 'Vinci la Cripta.',                     reward: 8,  check: (d) => !!d.wins.cripta },
  { id: 'palude',  cat: 'iter',   name: 'Bonifica',            desc: 'Vinci la Palude Marcia.',              reward: 10, check: (d) => !!d.wins.palude },
  { id: 'catt',    cat: 'iter',   name: 'Sconsacrata',         desc: 'Vinci la Cattedrale Sconsacrata.',     reward: 15, check: (d) => !!d.wins.cattedrale },
  { id: 'selva',   cat: 'iter',   name: 'Nel mezzo del cammin',desc: 'Vinci la Selva Oscura.',               reward: 18, check: (d) => !!d.wins.selva },
  { id: 'dite',    cat: 'iter',   name: 'Le mura di Dite',     desc: 'Vinci la Città di Dite.',              reward: 22, check: (d) => !!d.wins.dite },
  { id: 'cocito',  cat: 'iter',   name: 'E quindi uscimmo',    desc: 'Vinci il Cocito.',                     reward: 30, check: (d) => !!d.wins.cocito },
  { id: 'wins10',  cat: 'iter',   name: 'Decem victoriae',     desc: 'Vinci 10 volte.',                      reward: 15, check: (d) => _winsAll(d) >= 10, prog: (d) => [_winsAll(d), 10] },
  // ARS
  { id: 'chest3',  cat: 'ars',    name: 'Scassinatore',        desc: 'Apri 3 forzieri.',                     reward: 3,  check: (d) => d.stats.chests >= 3, prog: (d) => [d.stats.chests, 3] },
  { id: 'chest25', cat: 'ars',    name: 'Arca',                desc: 'Apri 25 forzieri.',                    reward: 8,  check: (d) => d.stats.chests >= 25, prog: (d) => [d.stats.chests, 25] },
  { id: 'evo1',    cat: 'ars',    name: 'Alchimia proibita',   desc: 'Evolvi un\'arma.',                     reward: 4,  check: (d) => d.stats.evos >= 1 },
  { id: 'evo10',   cat: 'ars',    name: 'Transmutatio',        desc: 'Evolvi 10 armi.',                      reward: 10, check: (d) => d.stats.evos >= 10, prog: (d) => [d.stats.evos, 10] },
  { id: 'smith3',  cat: 'ars',    name: 'Mani d\'oro',         desc: 'Un oggetto a +3.',                     reward: 5,  check: (d) => Object.keys(d.items).some((k) => d.items[k] >= 3) },
  { id: 'smith5',  cat: 'ars',    name: 'Opus perfectum',      desc: 'Un oggetto a +5.',                     reward: 12, check: (d) => Object.keys(d.items).some((k) => d.items[k] >= 5) },
  { id: 'allitems',cat: 'ars',    name: 'Armamentarium',       desc: 'Possiedi tutti gli oggetti.',          reward: 12, check: (d) => Object.keys(SHOP_ITEMS).every((k) => d.items[k] !== undefined), prog: (d) => [Object.keys(d.items).length, Object.keys(SHOP_ITEMS).length] },
  { id: 'mast1',   cat: 'ars',    name: 'Primum studium',      desc: 'Studia dal Magister.',                 reward: 3,  check: (d) => _mastSum(d) >= 1 },
  { id: 'mast10',  cat: 'ars',    name: 'Doctor',              desc: '10 gradi dal Magister.',               reward: 12, check: (d) => _mastSum(d) >= 10, prog: (d) => [_mastSum(d), 10] },
  { id: 'omen1',   cat: 'ars',    name: 'Haruspicina',         desc: 'Fatti leggere un omen.',               reward: 3,  check: (d) => (d.stats.omens || 0) >= 1 },
  { id: 'omen20',  cat: 'ars',    name: 'Extispicium',         desc: 'Leggi 20 omina.',                      reward: 8,  check: (d) => (d.stats.omens || 0) >= 20, prog: (d) => [d.stats.omens || 0, 20] },
  { id: 'omendiv', cat: 'ars',    name: 'Signum divinum',      desc: 'Un omen Divinum.',                     reward: 10, check: (d) => _hasDivine(d) },
  { id: 'chars',   cat: 'ars',    name: 'Locanda piena',       desc: 'Sblocca tutti i personaggi.',          reward: 10, check: (d) => Object.keys(CHARACTERS).every((c) => d.chars.indexOf(c) >= 0) },
  // GLORIA
  { id: 'lv30',    cat: 'gloria', name: 'Ascensio',            desc: 'Livello 30 in una discesa.',           reward: 5,  check: (d) => d.bestLevel >= 30, prog: (d) => [d.bestLevel, 30] },
  { id: 'lv60',    cat: 'gloria', name: 'Apotheosis',          desc: 'Livello 60 in una discesa.',           reward: 12, check: (d) => d.bestLevel >= 60, prog: (d) => [d.bestLevel, 60] },
  { id: 'coins200',cat: 'gloria', name: 'Thesaurus',           desc: '200 monete in carriera.',              reward: 10, check: (d) => d.totalCoins >= 200, prog: (d) => [d.totalCoins, 200] },
  { id: 'hard',    cat: 'gloria', name: 'Nessuna pietà',       desc: 'Vinci una mappa.',                     reward: 12, check: (d) => (d.stats.winsDiff.difficile || 0) + (d.stats.winsDiff.incubo || 0) >= 1 },
  { id: 'night5',  cat: 'gloria', name: 'In tenebris',         desc: 'Resisti 5 minuti a Incubo.',           reward: 10, check: (d) => _maxRec(d, 'incubo') >= 300, prog: (d) => [Math.floor(_maxRec(d, 'incubo') / 60), 5] },
  { id: 'night',   cat: 'gloria', name: 'Incubo',              desc: 'Vinci a Incubo.',                      reward: 25, check: (d) => (d.stats.winsDiff.incubo || 0) >= 1 },
  { id: 'endless', cat: 'gloria', name: 'Oltre la fine',       desc: 'Infinita: minuto 15.',                 reward: 10, check: (d) => d.stats.endlessBest >= 900, prog: (d) => [Math.floor(d.stats.endlessBest / 60), 15] },
  { id: 'endless30',cat: 'gloria',name: 'Aeternitas',          desc: 'Infinita: minuto 30.',                 reward: 20, check: (d) => d.stats.endlessBest >= 1800, prog: (d) => [Math.floor(d.stats.endlessBest / 60), 30] },
];

// MAGISTER — studia le passive: ogni grado = +20% all'effetto per livello (permanente)
const MASTERY = { max: 3, bonus: 0.2, costs: [8, 15, 25], exclude: ['amount'] };
// RICETTE DI FUSIONE — le vende il Magister, una per coppia di FUSION_SPECIAL, UNA volta sola (si possono comprare tutte).
// Comprata = arriva il suo Custode in partita (TRIAL); battuto = fusione sbloccata per sempre.
const RECIPE = { price: 25, icon: 'ico_arcanum' };
// ARCANUM [?] — vecchio consumabile (tolto il 2026-10-22): chi ne aveva viene rimborsato a `price` l'uno (Save.normalize).
const ARCANUM = { name: 'Arcanum [?]', price: 15 };

// ARUSPICE — omina: bonus casuali su armi e armature (2 per oggetto). Le armi contano solo se equipaggiate.
// rarità: 0 Vulgare, 1 Rarum, 2 Divinum
const OMENS = {
  slots: 2,
  read: [5, 9],          // costo per leggere il 1° e il 2° omen di un oggetto
  reroll: 4,             // costo per rileggere un omen
  rarity: [
    { name: 'Vulgare', w: 70, m: 1.0, col: '#a49dbd' },
    { name: 'Rarum',   w: 24, m: 1.7, col: '#4fb3bd' },
    { name: 'Divinum', w: 6,  m: 2.6, col: '#d1a93a' },
  ],
  // on: 'w' armi, 'a' armature, '*' entrambi
  kinds: {
    dmg:    { name: 'Ira',        on: 'w', base: 0.04,  fmt: (v) => '+' + Math.round(v * 100) + '% danno' },
    cd:     { name: 'Celeritas',  on: 'w', base: 0.03,  fmt: (v) => '-' + Math.round(v * 100) + '% ricarica' },
    area:   { name: 'Amplitudo',  on: 'w', base: 0.05,  fmt: (v) => '+' + Math.round(v * 100) + '% area' },
    hp:     { name: 'Robur',      on: 'a', base: 8,     int: true, fmt: (v) => '+' + v + ' vita' },
    regen:  { name: 'Salus',      on: 'a', base: 0.12,  fmt: (v) => '+' + v.toFixed(2) + ' vita/s' },
    speed:  { name: 'Pernicitas', on: 'a', base: 0.03,  fmt: (v) => '+' + Math.round(v * 100) + '% velocità' },
    armor:  { name: 'Firmitas',   on: 'a', base: 0.6,   int: true, fmt: (v) => '-' + v + ' danno subito' },
    dodge:  { name: 'Caligo',     on: 'a', base: 0.012, fmt: (v) => '+' + (v * 100).toFixed(1) + '% schivata' },
    magnet: { name: 'Attractio',  on: '*', base: 0.08,  fmt: (v) => '+' + Math.round(v * 100) + '% magnete' },
    xp:     { name: 'Doctrina',   on: '*', base: 0.04,  fmt: (v) => '+' + Math.round(v * 100) + '% esperienza' },
    coin:   { name: 'Pecunia',    on: '*', base: 0.08,  fmt: (v) => '+' + Math.round(v * 100) + '% monete' },
  },
};

// sostituisce il primo numero di una descrizione ("+10% danno") con il valore moltiplicato
function scaleDesc(desc, mult) {
  if (!mult || mult === 1) return desc;
  return desc.replace(/(\d+(?:\.\d+)?)/, (m) => { const v = parseFloat(m) * mult; return String(Math.round(v * 100) / 100); });
}

// PERSONAGGI — arma di partenza + un'abilità unica
// dodge = probabilità di schivare un colpo | xp = bonus esperienza | regen = vita/s | area = bonus area armi
const CHARACTERS = {
  eek:        { name: 'Eek',          sprite: 'hi_eek',         weapon: 'dart', price: 0,  hp: 0,   speed: 0.03,  dmg: 0,    dodge: 0.12, xp: 0,    regen: 0,   area: 0,
                anim: 'hi_eek', kunai: true,
                desc: 'Kunai · schivata 12%' },
  alchimista: { name: 'Virgilio',     sprite: 'player',         weapon: 'dart', price: 1,  hp: 0,   speed: 0,     dmg: 0,    dodge: 0,    xp: 0.15, regen: 0,   area: 0,
                desc: '"Tu se\' lo mio maestro e \'l mio autore." · Sagitta · +15% esperienza' },
  badessa:    { name: 'Beatrice',     sprite: 'char_badessa',   weapon: 'aura', price: 15, hp: 20,  speed: -0.05, dmg: 0,    dodge: 0,    xp: 0,    regen: 0.3, area: 0,
                desc: '"Amor mi mosse, che mi fa parlare." · Limbus · +20 vita, +0.3 vita/s, -5% velocità' },
  fuochista:  { name: 'Farinata',     sprite: 'char_fuochista', weapon: 'bomb', price: 20, hp: -10, speed: 0,     dmg: 0.10, dodge: 0,    xp: 0,    regen: 0,   area: 0.15,
                desc: '"Ed el s\'ergea col petto e con la fronte." · Ignis · +10% danno, +15% area, -10 vita' },
};
