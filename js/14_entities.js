'use strict';
// js/14_entities.js — Pool (Struct of Arrays), G (stato partita), helper spawn/danno

// ============================================================================
// ENTITIES — pool "Struct of Arrays" preallocati + stato globale della partita.
//
// Ogni campo è un Float32Array lungo `max`. Un'entità è solo un indice.
// - spawn(): prende lo slot `count` (O(1)), azzera i campi
// - le entità morte hanno alive=0 e vengono compattate a fine step,
//   così gli indici restano stabili durante tutto lo step (grid compresa).
// Niente oggetti per entità => niente garbage collector durante il gioco.
// ============================================================================

function Pool(max, fields) {
  this.max = max;
  this.count = 0;
  this.arrs = [];
  for (let i = 0; i < fields.length; i++) {
    const a = new Float32Array(max);
    this[fields[i]] = a;
    this.arrs.push(a);
  }
}
Pool.prototype.spawn = function () {
  if (this.count >= this.max) return -1;
  const i = this.count++;
  const arrs = this.arrs;
  for (let k = 0; k < arrs.length; k++) arrs[k][i] = 0;
  return i;
};
// remap (opzionale): remap[vecchioIndice] = nuovoIndice (-1 se morto). Serve a chi tiene
// in mano indici di nemici tra uno step e l'altro (fuochi fatui, boss).
Pool.prototype.compact = function (remap) {
  const alive = this.alive, arrs = this.arrs, n = this.count, na = arrs.length;
  let w = 0;
  for (let r = 0; r < n; r++) {
    if (remap) remap[r] = alive[r] === 0 ? -1 : w;
    if (alive[r] === 0) continue;
    if (w !== r) for (let k = 0; k < na; k++) arrs[k][w] = arrs[k][r];
    w++;
  }
  this.count = w;
};
Pool.prototype.clear = function () { this.count = 0; };
// copia posizione corrente -> precedente (per l'interpolazione del rendering)
Pool.prototype.savePrev = function () {
  const x = this.x, y = this.y, px = this.px, py = this.py, n = this.count;
  for (let i = 0; i < n; i++) { px[i] = x[i]; py[i] = y[i]; }
};

// ---------------------------------------------------------------------------
// Pool
// ---------------------------------------------------------------------------
const Enemies = new Pool(CFG.MAX_ENEMIES, [
  'alive', 'uid', 'type',
  'x', 'y', 'px', 'py',
  'kx', 'ky',            // velocità di knockback (decade)
  'hp', 'maxHp', 'r', 'speed', 'dmg', 'mass', 'xp',
  'flash',               // timer del lampo bianco quando colpito
  'atkCd',               // cooldown del danno da contatto
  'phase',               // offset per l'animazione "molle"
  'orbCd',               // cooldown colpi delle Ampolle Orbitanti su questo nemico
  'slowT',               // timer di rallentamento (Sale Consacrato)
  'big',                 // 1 = boss: troppo grande per la grid, collisioni gestite a parte
  'aiT', 'aiS', 'ddx', 'ddy', // IA: timer, stato (Cacciatori: 0 insegue, 1 preavviso, 2 carica), direzione carica
  'dAcc', 'dT',          // numeri del danno: danno accumulato e timer (un numero sommato ogni 0.35 s)
  'frz', 'frzM',         // Gelo / Flagello: durata e moltiplicatore di velocità (0 = fermo)
]);

const Projectiles = new Pool(CFG.MAX_PROJ, [
  'alive', 'kind',
  'x', 'y', 'px', 'py', 'vx', 'vy', 'dx', 'dy', 'rot',
  'dmg', 'r', 'size', 'life', 'life0', 'pierce', 'kb',
  'aoe', 'split',        // granate: raggio esplosione, numero di schegge | fiale: durata pozza
  'src',                 // indice dell'arma che l'ha sparato (per il resoconto danni)
  'tgt',                 // fuochi fatui: nemico inseguito | falce: già tornata indietro
  'h0', 'h1', 'h2', 'h3', 'hn', // ultimi uid colpiti (un proiettile perforante non colpisce due volte lo stesso)
  'evo',                 // 1 = sparato da un'arma evoluta (contorno neon)
]);

const Gems = new Pool(CFG.MAX_GEMS, [
  'alive', 'kind', 'x', 'y', 'val', 'mag', 'spd',   // kind: 0 = gemma XP, 1 = moneta
]);

// Effetti visivi (fulmini, esplosioni) — solo grafica, nessuna logica
const FX = new Pool(CFG.MAX_FX, [
  'alive', 'kind', 'x', 'y', 'x2', 'y2', 'life', 'life0', 'r', 'seed', 'val',
  'evo',      // 1 = effetto di un'arma evoluta (fulmini, esplosioni, sferzate, onde: contorno neon)
]);
const FXK = { BOLT: 0, BOOM: 1, SPLAT: 2, NUM: 3, SLASH: 4, PUFF: 5, RING: 6, THRUST: 7, SPARK: 8, WHIP: 9, NOVA: 10 };

// Proiettili dei nemici (palle di melma degli Sputacchini, raffiche del boss finale) + pozze di veleno (kind 2)
const EShots = new Pool(CFG.MAX_ESHOTS, ['alive', 'kind', 'x', 'y', 'px', 'py', 'vx', 'vy', 'life', 'dmg', 'r']);
// Pozze acide (Fiala Acida): danno a intervalli a chi ci sta dentro
const Zones = new Pool(CFG.MAX_ZONES, ['alive', 'x', 'y', 'r', 'life', 'life0', 'tick', 'dmg', 'slow', 'src']);
const GK = { XP: 0, COIN: 1, HEAL: 2, VACUUM: 3, STONE: 4, CHEST: 5 }; // tipi di oggetti a terra (pool Gems)

// buffer riutilizzabili per le query della grid (uno per uso, così le query non si pestano)
const QBUF_PROJ = new Int32Array(1024);
const QBUF_SEP = new Int32Array(256);
const QBUF_PLAYER = new Int32Array(512);
const ENEMY_REMAP = new Int32Array(CFG.MAX_ENEMIES);

// ---------------------------------------------------------------------------
// Stato della partita
// ---------------------------------------------------------------------------
const G = {
  state: 'menu',     // 'menu' | 'play' | 'levelup' | 'paused' | 'dead'
  time: 0,           // secondi di gioco
  kills: 0,
  runCoins: 0,
  diff: DIFFICULTY[DEFAULT_DIFFICULTY],
  diffId: DEFAULT_DIFFICULTY,
  pendingLevels: 0,
  rerolls: 0,        // rilanci delle carte rimasti in questa partita
  slowFactor: 1,
  shake: 0,
  flash: 0,          // lampo bianco a tutto schermo (fulmini del boss 2)
  night: false,
  nightK: 0,         // quanto è buio (0 giorno .. 1 notte piena): sale e scende piano (crepuscolo/alba)
  mergeT: 0,
  map: MAPS.cripta, mapId: 'cripta',
  src: null,         // arma che sta infliggendo danno in questo momento (resoconto danni)
  victory: false, victoryT: 0,
  won: false, endless: false,   // vittoria ottenuta / modalità infinita in corso
  hitStop: 0,                   // micro-pausa d'impatto (secondi reali)
  lvlT: 0,                      // breve attesa prima delle carte del level up (onda d'urto)
  chestQueue: [], chestSeen: false, dyingT: 0,  // forzieri raccolti da aprire, primo forziere della partita già visto
  rs: { elites: 0, chests: 0, evos: 0, bosses: {} },  // statistiche della partita (sommate alla carriera a fine partita)
  nextUid: 1,
  viewW: 1280, viewH: CFG.VIEW_H,
  camX: 0, camY: 0,
  debug: false,
  god: false,
  banner: '', bannerT: 0,
  stats: { upd: 0, rnd: 0, fps: 60 },
};

// ---------------------------------------------------------------------------
// Helper di gioco condivisi
// ---------------------------------------------------------------------------
function spawnEnemy(type, x, y) {
  const i = Enemies.spawn();
  if (i < 0) return -1;
  const d = ENEMY_DEFS[type];
  const E = Enemies;
  E.alive[i] = 1;
  E.uid[i] = G.nextUid++;
  E.type[i] = type;
  E.x[i] = E.px[i] = x;
  E.y[i] = E.py[i] = y;
  const late = !d.boss && G.time >= LATE.time;   // dal minuto 10 gli slime sono più forti
  E.hp[i] = E.maxHp[i] = d.hp * (d.boss ? CFG.bossHpMult(G.time) : CFG.enemyHpMult(G.time)) * G.diff.hp * G.map.hp * (late ? LATE.hp : 1);
  E.r[i] = d.r;
  E.speed[i] = d.speed * G.diff.speed * (0.9 + Math.random() * 0.2) * (late ? LATE.speed : 1);
  E.dmg[i] = d.dmg * CFG.enemyDmgMult(G.time) * G.diff.dmg * G.map.dmg * (late ? LATE.dmg : 1);
  E.mass[i] = d.mass;
  E.xp[i] = d.xp;
  E.phase[i] = Math.random() * 6.283;
  E.big[i] = d.boss ? 1 : 0;
  E.aiT[i] = type === ET.spitter ? SPIT.cd * Math.random() : type === ET.furia ? FURIA.cd * Math.random() : type === ET.toxic ? TOXIC.every * Math.random()
    : type === ET.ghost ? GHOST.blinkEvery * (0.5 + Math.random()) : type === ET.lupa ? LUPA.chaseTime * (0.5 + Math.random())
    : ELITE.chaseTime * (0.5 + Math.random() * 0.5);
  E.aiS[i] = 0;
  return i;
}

// Infligge danno al nemico i. (kx,ky) = direzione del colpo (normalizzata), kb = forza knockback.
function damageEnemy(i, dmg, kx, ky, kb) {
  const E = Enemies;
  if (E.alive[i] === 0) return;
  const real = dmg < E.hp[i] ? dmg : E.hp[i];
  if (G.src) G.src.dealt += real;           // resoconto: danno fatto da ogni arma
  E.hp[i] -= dmg;
  Sfx.play('hit');
  E.flash[i] = 0.09;
  const k = kb / E.mass[i];
  E.kx[i] += kx * k;
  E.ky[i] += ky * k;
  // numeri del danno SOMMATI: al massimo uno ogni 0.35 s per nemico
  E.dAcc[i] += real;
  if (E.dT[i] <= 0) { flushDamageNumber(i); E.dT[i] = 0.35; }
  if (E.hp[i] <= 0) killEnemy(i);
}

function flushDamageNumber(i) {
  const E = Enemies;
  if (E.dAcc[i] >= 1 && CFG.damageNumbers && FX.count < CFG.MAX_FX - 200) {
    const n = spawnFx(FXK.NUM, E.x[i] + (Math.random() - 0.5) * 8, E.y[i] - E.r[i], 0.6, 0);
    if (n >= 0) FX.val[n] = E.dAcc[i];
  }
  E.dAcc[i] = 0;
}

function killEnemy(i) {
  const E = Enemies;
  E.alive[i] = 0;
  G.kills++;
  flushDamageNumber(i);
  if (E.big[i]) { onBossKilled(i); return; }
  const d = ENEMY_DEFS[E.type[i]], x = E.x[i], y = E.y[i], type = E.type[i];
  Sfx.play('kill');
  spawnGem(x, y, E.xp[i], GK.XP);
  if (type === ET.elite) {
    // Cacciatore: a volte lascia un forziere (il primo della partita sempre)
    G.rs.elites++;
    if (!G.chestSeen || Math.random() < CHEST.eliteChance) { G.chestSeen = true; spawnGem(x, y - 10, 0, GK.CHEST); }
    G.hitStop = Math.max(G.hitStop, 0.07); addShake(3);
  } else if (type === ET.toxic) {
    spawnHazard(x, y, TOXIC.r * 1.5, TOXIC.life * 1.3, E.dmg[i] * 0.7);   // scoppia in una pozza
  }
  const cc = d.coin * G.diff.coin * G.map.coin * Player.coinMult * (type === ET.elite ? 1 : CFG.coinDecay(G.time));
  if (Math.random() < cc) spawnGem(x + 6, y - 4, 1, GK.COIN);
  const rare = E.type[i] === ET.heavy ? 3 : 1;
  if (Math.random() < CFG.drops.heal * rare) spawnGem(x - 6, y + 4, CFG.drops.healAmount, GK.HEAL);
  else if (Math.random() < CFG.drops.vacuum * rare) spawnGem(x - 6, y + 4, 0, GK.VACUUM);
  const s = spawnFx(FXK.SPLAT, x, y, 0.45, E.r[i]);
  if (s >= 0) FX.val[s] = E.type[i];
}

// kind 0 = gemma XP, 1 = moneta
function spawnGem(x, y, val, kind) {
  let i = Gems.spawn();
  if (i < 0) {
    if (kind === GK.COIN) { Player.gainCoins(val); return; } // le monete non si perdono mai
    if (kind !== GK.XP) return;
    // pool pieno: l'XP confluisce in una gemma esistente (che diventa più "grossa")
    i = (Math.random() * Gems.count) | 0;
    if (Gems.kind[i] === 0) Gems.val[i] += val;
    return;
  }
  Gems.alive[i] = 1;
  Gems.kind[i] = kind;
  Gems.x[i] = x + (Math.random() - 0.5) * 6;
  Gems.y[i] = y + (Math.random() - 0.5) * 6;
  Gems.val[i] = val;
}

function spawnProjectile(kind, x, y, dx, dy, speed, dmg, r, size, life, pierce, kb) {
  const i = Projectiles.spawn();
  if (i < 0) return -1;
  const P = Projectiles;
  P.alive[i] = 1; P.kind[i] = kind;
  P.x[i] = P.px[i] = x; P.y[i] = P.py[i] = y;
  P.dx[i] = dx; P.dy[i] = dy;
  P.rot[i] = ((Math.atan2(dy, dx) / (Math.PI * 2) * 16 + 16.5) | 0) & 15; // indice rotazione sprite (16 direzioni)
  P.vx[i] = dx * speed; P.vy[i] = dy * speed;
  P.dmg[i] = dmg; P.r[i] = r; P.size[i] = size;
  P.life[i] = P.life0[i] = life; P.pierce[i] = pierce; P.kb[i] = kb;
  P.src[i] = G.src ? G.src.slot : -1;
  P.evo[i] = G.src && G.src.evolved ? 1 : 0;
  return i;
}

function spawnFx(kind, x, y, life, r, x2, y2) {
  const i = FX.spawn();
  if (i < 0) return -1;
  FX.alive[i] = 1; FX.kind[i] = kind; FX.x[i] = x; FX.y[i] = y;
  FX.x2[i] = x2 === undefined ? x : x2; FX.y2[i] = y2 === undefined ? y : y2;
  FX.life[i] = FX.life0[i] = life; FX.r[i] = r; FX.seed[i] = (Math.random() * 1000) | 0;
  FX.evo[i] = G.src && G.src.evolved ? 1 : 0;
  return i;
}

// Tremolio dello schermo (in pixel di gioco), decade da solo
function addShake(a) {
  if (CFG.screenShake && a > G.shake) G.shake = Math.min(6, a);
}

function updateFx(dt) {
  for (let i = 0; i < FX.count; i++) {
    if (FX.alive[i] === 0) continue;
    if ((FX.life[i] -= dt) <= 0) FX.alive[i] = 0;
  }
}

// Danno ad area (esplosioni, fulmini, aura). Ritorna quanti nemici ha colpito.
const QBUF_AOE = new Int32Array(2048);
function damageArea(x, y, radius, dmg, kb, slowT) {
  const E = Enemies;
  const n = Grid.query(x, y, radius + CFG.MAX_ENEMY_R, QBUF_AOE);
  let hits = 0;
  for (let k = 0; k < n; k++) {
    const j = QBUF_AOE[k];
    if (E.alive[j] === 0) continue;
    const dx = E.x[j] - x, dy = E.y[j] - y, rr = radius + E.r[j];
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) continue;
    const d = Math.sqrt(d2) || 1;
    if (slowT) E.slowT[j] = slowT;
    damageEnemy(j, dmg, dx / d, dy / d, kb);
    hits++;
  }
  // i boss non sono nella grid: controllo a parte (all'indietro: se uno muore la lista si accorcia)
  for (let q = Boss.n - 1; q >= 0; q--) {
    const b = Boss.list[q];
    if (E.alive[b] !== 0) {
      const dx = E.x[b] - x, dy = E.y[b] - y, rr = radius + E.r[b];
      if (dx * dx + dy * dy < rr * rr) { damageEnemy(b, dmg, 0, 0, 0); hits++; }
    }
  }
  return hits;
}
