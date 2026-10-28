'use strict';
// js/18_bosses.js — Boss (fino a 4 insieme), fulmini del boss 2

// ---------------------------------------------------------------------------
// BOSS — possono essercene più insieme (al minuto 10 arrivano in tre).
// Boss.list[0..n) = indici nel pool dei boss vivi; Boss.slots[k] = stato del boss list[k].
// Boss.active / Boss.idx / Boss.kind restano per comodità (c'è almeno un boss / il primo).
//  Flegiàs (5:00): cammina, preavviso rosso + carica, evoca gocce.
//  Guardiano minore della mappa (b2): fulmini su zone segnate e/o evoca servi.
//  Guardiano maggiore della mappa (b3): raggiere e spirali di proiettili.
// La partita si VINCE resistendo fino a WIN.time (7:00). Se continui: subito i due guardiani della mappa (DUO),
// al minuto 10 tutti e tre (TRIO).
// ---------------------------------------------------------------------------
const Boss = {
  MAX: 5,                                         // 4 boss + il corpo della Morte
  n: 0, list: new Int32Array(5), slots: [],
  active: false, idx: -1, kind: -1,
  spawned1: false, warned1: false, spawnedTrio: false, warnedTrio: false, warnedWin: false,
  duoT: 0, spawnedDuo: false, warnedDuo: false,   // duoT = secondo di arrivo dei due guardiani (lo fissa continueEndless)
  trialT: 0, trialWarned: false,                   // Custode delle fusioni: quando arriva il prossimo (TRIAL)
  endlessT: 0, endlessN: 0,
  hp: 0, maxHp: 1,
  reset() {
    this.n = 0; this.sync();
    this.spawned1 = this.warned1 = this.spawnedTrio = this.warnedTrio = this.warnedWin = false;
    this.duoT = 0; this.spawnedDuo = this.warnedDuo = false;
    this.endlessT = 0; this.endlessN = 0;
    this.trialT = TRIAL.time; this.trialWarned = false;
    Strikes.n = 0;
  },
  // aggiorna i campi di comodo dopo ogni cambio della lista
  sync() {
    this.active = this.n > 0;
    this.idx = this.n > 0 ? this.list[0] : -1;
    this.kind = this.n > 0 ? this.slots[0].kind : -1;
  },
  // stato del boss con indice i (null se non è un boss vivo)
  slotOf(i) {
    for (let k = 0; k < this.n; k++) if (this.list[k] === i) return this.slots[k];
    return null;
  },
  // c'è un boss di questo tipo? (i Custodi delle fusioni non contano: non sono il boss vero)
  has(type) {
    for (let k = 0; k < this.n; k++) if (this.slots[k].kind === type && !this.slots[k].trial) return true;
    return false;
  },
  // boss "veri" vivi (senza i Custodi)
  main() { let c = 0; for (let k = 0; k < this.n; k++) if (!this.slots[k].trial) c++; return c; },
  // Custodi vivi
  trials() { return this.n - this.main(); },
  // vita sommata di tutti i boss vivi (per la barra)
  sumHp() {
    const E = Enemies;
    let h = 0, m = 0;
    for (let k = 0; k < this.n; k++) { const i = this.list[k]; h += Math.max(0, E.hp[i]); m += E.maxHp[i]; }
    this.hp = h; this.maxHp = m || 1;
  },
  // dopo Enemies.compact gli indici cambiano
  remap(map) { for (let k = 0; k < this.n; k++) this.list[k] = map[this.list[k]]; this.sync(); },
};
for (let k = 0; k < Boss.MAX; k++) Boss.slots.push({ kind: -1, uid: 0, cfg: {}, trial: null, state: 'walk', t: 0, dirX: 0, dirY: 0, summonT: 0, volley: 0, spiralT: 0, spiralA: 0, shotT: 0, arrowT: 0, boltT: 0 });

// boss minore / maggiore della mappa in corso (nome, sprite, varianti); null per Flegiàs
function bossCfg(type) { return type === ET.boss2 ? G.map.b2 : type === ET.boss3 ? G.map.b3 : null; }
function bossName(type) { const c = bossCfg(type); return c ? c.name : ENEMY_DEFS[type].name; }
// nome del boss di uno slot (i Custodi hanno il loro)
function slotName(S) { return S.cfg.name || bossName(S.kind); }
// nomi di tutti i boss vivi ("Flegiàs, Caronte e Minosse")
function bossNames() {
  const B = Boss;
  if (B.n === 0) return bossName(ET.boss);
  let s = '';
  for (let k = 0; k < B.n; k++) s += (k === 0 ? '' : k === B.n - 1 ? ' e ' : ', ') + slotName(B.slots[k]);
  return s;
}

// cfg = aspetto/servi/nome diversi (i Custodi delle fusioni); trial = chiave della ricetta del Custode
function spawnBoss(type, quiet, cfg, trial) {
  if (Boss.n >= Boss.MAX) return -1;
  if (type === ET.boss && !trial) Boss.spawned1 = true;
  const p = ringPoint(ENEMY_DEFS[type].r + 20);
  const i = spawnEnemy(type, p.x, p.y);
  if (i < 0) return -1;
  const S = Boss.slots[Boss.n];
  Boss.list[Boss.n++] = i;
  S.kind = type; S.uid = Enemies.uid[i]; S.cfg = cfg || bossCfg(type) || {}; S.trial = trial || null; S.reef = false;
  S.state = 'walk'; S.volley = 0;
  S.t = type === ET.boss ? BOSS.chargeEvery : type === ET.boss2 ? BOSS2.strikeEvery : BOSS3.burstEvery;
  S.spiralT = 0; S.spiralA = 0; S.shotT = 0;
  S.summonT = (S.cfg.every || BOSS.summonEvery) * 0.5;
  // FURIA: più vita e morso, frecce e fulmini partono dopo un attimo (sfasati tra un boss e l'altro)
  const E = Enemies;
  E.hp[i] *= BOSS_FURY.hp; E.maxHp[i] *= BOSS_FURY.hp; E.dmg[i] *= BOSS_FURY.dmg;
  S.arrowT = 1.5 + Math.random(); S.boltT = 2.5 + Math.random() * 1.5;
  Boss.sync();
  addShake(6);
  Sfx.play('warn');
  if (!quiet) UI.toast(slotName(S), '', 3);
  UI.showBoss(true);
  return i;
}

// CUSTODE di una ricetta di fusione comprata: un Flegiàs più piccolo con l'aspetto e i servi suoi (FUSION_SPECIAL[key].custode)
function spawnTrial(key) {
  const sp = FUSION_SPECIAL[key], c = sp.custode;
  const cfg = { name: c.name, sprite: 'boss_' + c.art, summon: c.summon, faces: c.faces };
  const i = spawnBoss(ET.boss, true, cfg, key);
  if (i < 0) return false;
  const E = Enemies;
  E.hp[i] = E.maxHp[i] = E.maxHp[i] * TRIAL.hp;
  E.dmg[i] *= TRIAL.dmg;
  UI.toast(c.name, '', 3, true);
  return true;
}

// i due guardiani della mappa insieme (subito dopo la vittoria, se continui)
function spawnBossDuo() {
  Boss.spawnedDuo = true;
  spawnBoss(ET.boss2, true); spawnBoss(ET.boss3, true);
  UI.toast(bossName(ET.boss2) + ' · ' + bossName(ET.boss3), '', 3);
}

// i tre boss della mappa insieme (minuto 10, solo in modalità infinita).
// Chi è ancora vivo (es. un guardiano arrivato dopo la vittoria) non viene raddoppiato.
function spawnBossTrio() {
  Boss.spawnedTrio = true;
  for (const type of [ET.boss, ET.boss2, ET.boss3]) if (!Boss.has(type)) spawnBoss(type, true);
  UI.toast(bossNames().replace(/, | e /g, ' · '), '', 3);
}

function onBossKilled(i) {
  const E = Enemies, x = E.x[i], y = E.y[i], type = E.type[i], id = ENEMY_DEFS[type].id;
  let name = bossName(type), trial = null, reef = false;
  // toglie il boss dalla lista (scambio con l'ultimo: anche lo stato segue)
  for (let k = 0; k < Boss.n; k++) {
    if (Boss.list[k] !== i) continue;
    name = slotName(Boss.slots[k]); trial = Boss.slots[k].trial; reef = Boss.slots[k].reef;
    Boss.n--;
    const s = Boss.slots[k];
    Boss.list[k] = Boss.list[Boss.n]; Boss.slots[k] = Boss.slots[Boss.n]; Boss.slots[Boss.n] = s;
    break;
  }
  Boss.sync();
  if (type === ET.death) { Death.killed(x, y); return; }   // LA MORTE battuta
  if (type === ET.boss2 && !Boss.has(ET.boss2)) Strikes.n = 0;
  if (trial) {
    // CUSTODE battuto: la ricetta è sbloccata per sempre (niente forziere né pietra: il premio è la fusione)
    Save.data.recipes[trial] = 2; Save.write();
    Boss.trialT = G.time + TRIAL.gap; Boss.trialWarned = false;
    G.hitStop = 0.3; Sfx.play('bossDie'); Sfx.play('fuse'); addShake(6);
    for (let k = 0; k < 20; k++) { const a = Math.random() * 6.283, d = 20 + Math.random() * 90; spawnGem(x + Math.cos(a) * d, y + Math.sin(a) * d, 5, GK.XP); }
    spawnGem(x, y, CFG.drops.healAmount, GK.HEAL);
    spawnFx(FXK.RING, x, y, 0.6, 160);
    UI.showBoss(Boss.n > 0);
    UI.toast(FUSION_SPECIAL[trial].name, '', 4, true);
    return;
  }
  G.rs.bosses[id] = (G.rs.bosses[id] || 0) + 1;
  G.hitStop = 0.3;
  Sfx.play('bossDie');
  const R = type === ET.boss ? BOSS.reward : BOSS2.reward;
  spawnGem(x, y + 24, 3, GK.CHEST);         // forziere con 3 potenziamenti
  for (let k = 0; k < R.gems; k++) {
    const a = Math.random() * 6.283, d = 20 + Math.random() * 110;
    spawnGem(x + Math.cos(a) * d, y + Math.sin(a) * d, R.gemVal, GK.XP);
  }
  for (let k = 0; k < R.coins * G.diff.coin; k++) {
    const a = Math.random() * 6.283, d = 10 + Math.random() * 90;
    spawnGem(x + Math.cos(a) * d, y + Math.sin(a) * d, 1, GK.COIN);
  }
  spawnGem(x, y, CFG.drops.healAmount * 2, GK.HEAL);
  spawnGem(x + 20, y, 0, GK.VACUUM);
  spawnGem(x - 22, y - 6, 1, GK.STONE);     // Pietra del Fabbro
  for (let k = 0; k < 6; k++) {
    const s = spawnFx(FXK.SPLAT, x + (Math.random() - 0.5) * 160, y + (Math.random() - 0.5) * 120, 0.8, 60);
    if (s >= 0) FX.val[s] = type;
  }
  addShake(6);
  UI.showBoss(Boss.n > 0);
  if (reef) {
    // SCILLA battuta: il ponte si riapre; la prima volta l'Aruspice legge un terzo omen su ogni oggetto
    G.reefDone = true;
    const first = !Save.data.reef;
    if (!G.cheat) { Save.data.reef = (Save.data.reef | 0) + 1; Save.write(); }
    spawnGem(x - 30, y + 24, 3, GK.CHEST);
    Sfx.play('quest');
    UI.toast(name, '', 3, true);
    return;
  }
  UI.toast(name, '', 2);
}

function bossWalk(i, dt, d, dx, dy) {
  const E = Enemies;
  let spd = E.speed[i] * BOSS_FURY.chase;
  if (d > G.viewW * 0.6) spd *= BOSS.catchUp; // non lo semini
  E.x[i] += dx / d * spd * dt;
  E.y[i] += dy / d * spd * dt;
}

// più boss insieme: non si sovrappongono (al massimo 4, costa nulla)
function bossSeparate(i) {
  const E = Enemies;
  for (let k = 0; k < Boss.n; k++) {
    const j = Boss.list[k];
    if (j === i || E.alive[j] === 0) continue;
    const ox = E.x[i] - E.x[j], oy = E.y[i] - E.y[j], rr = (E.r[i] + E.r[j]) * 0.7, d2 = ox * ox + oy * oy;
    if (d2 >= rr * rr) continue;
    const d = Math.sqrt(d2) || 1, push = (rr - d) * 0.5;
    E.x[i] += ox / d * push; E.y[i] += oy / d * push;
  }
}

// FURIA (BOSS_FURY): tutti i boss tirano raffiche di frecce mirate (un po' avanti a dove stai andando)
// e chiamano fulmini su di te; i Custodi più di rado.
function bossFury(i, S, dt, d, dx, dy) {
  const E = Enemies, F = BOSS_FURY, slow = S.trial ? 1 / F.trial : 1;
  if (d > G.viewW * 0.9) return;   // fuori schermo: prima ti raggiunge
  S.arrowT -= dt;
  if (S.arrowT <= 0) {
    S.arrowT = F.arrowEvery * slow * (0.85 + Math.random() * 0.3);
    const lead = d / F.arrowSpeed * Player.speed * 0.6;
    const tx = dx + Input.ax * lead, ty = dy + Input.ay * lead, tl = Math.sqrt(tx * tx + ty * ty) || 1;
    const base = Math.atan2(ty / tl, tx / tl), n = F.arrows, r0 = E.r[i] * 0.6;
    const dmg = F.arrowDmg * CFG.enemyDmgMult(G.time) * G.diff.dmg * G.map.dmg;
    for (let k = 0; k < n; k++) {
      const a = base + (n > 1 ? (k / (n - 1) - 0.5) * 2 * F.arrowSpread : 0), ca = Math.cos(a), sa = Math.sin(a);
      spawnEShot(4, E.x[i] + ca * r0, E.y[i] + sa * r0, ca, sa, F.arrowSpeed, dmg);
    }
    Sfx.play('spit');
  }
  if (E.type[i] === ET.boss2) return;   // i guardiani minori i fulmini li hanno già
  S.boltT -= dt;
  if (S.boltT <= 0) {
    S.boltT = F.boltEvery * slow * (0.85 + Math.random() * 0.3);
    addStrike(Player.x + Input.ax * 45, Player.y + Input.ay * 45);
    for (let k = 1; k < F.bolts; k++) { const a = Math.random() * 6.283, r = 40 + Math.random() * 110; addStrike(Player.x + Math.cos(a) * r, Player.y + Math.sin(a) * r); }
  }
}

function updateBoss(i, dt) {
  const E = Enemies, S = Boss.slotOf(i);
  if (!S || S.kind === ET.death) return;   // la Morte la muove Death.update
  const dx = Player.x - E.x[i], dy = Player.y - E.y[i], d = Math.sqrt(dx * dx + dy * dy) || 1;
  S.t -= dt;
  E.px[i] = E.x[i]; E.py[i] = E.y[i];
  if (Boss.n > 1) bossSeparate(i);
  bossFury(i, S, dt, d, dx, dy);

  if (E.type[i] === ET.boss3) {
    // --- guardiano maggiore: raggiere e spirali di proiettili (bracci e numeri cambiano con la mappa) ---
    const C = S.cfg, arms = C.arms || 3, bsp = BOSS3.bulletSpeed * (C.speed || 1);
    bossWalk(i, dt, d, dx, dy);
    const bx = E.x[i], by = E.y[i];
    if (S.spiralT > 0) {
      S.spiralT -= dt; S.shotT -= dt;
      if (S.shotT <= 0) {
        S.shotT = 0.09 * arms / 3;      // più bracci = colpi più radi: la densità resta la stessa
        S.spiralA += 0.38;
        Sfx.play('pew');
        for (let k = 0; k < arms; k++) {
          const a = S.spiralA + k * 6.2832 / arms;
          spawnEShot(1, bx + Math.cos(a) * 60, by + Math.sin(a) * 60, Math.cos(a), Math.sin(a), bsp * 1.1, bossShotDmg());
        }
      }
    } else if (S.t <= 0) {
      S.volley++;
      S.t = BOSS3.burstEvery;
      if (S.volley % BOSS3.spiralEvery === 0) { S.spiralT = BOSS3.spiralTime; S.t += BOSS3.spiralTime; }
      else {
        const n = C.burst || BOSS3.burstCount, off = Math.random() * 6.283;
        for (let k = 0; k < n; k++) {
          const a = off + k / n * 6.283;
          spawnEShot(1, bx + Math.cos(a) * 60, by + Math.sin(a) * 60, Math.cos(a), Math.sin(a), bsp, bossShotDmg());
        }
        addShake(2);
        Sfx.play('burst');
      }
    }
    S.summonT -= dt;
    if (S.summonT <= 0) {
      S.summonT = C.every || BOSS3.summonEvery;
      const st = ET[C.summon || 'elite'], cnt = C.n || 2;
      for (let k = 0; k < cnt; k++) { const p = ringPoint(30); spawnEnemy(st, p.x, p.y); }
    }
    return;
  }

  if (E.type[i] === ET.boss2) {
    // --- guardiano minore: fulmini su zone segnate, e qualcuno evoca i suoi servi ---
    const C = S.cfg;
    bossWalk(i, dt, d, dx, dy);
    if (C.summon) {
      S.summonT -= dt;
      if (S.summonT <= 0) {
        S.summonT = C.every;
        const st = ET[C.summon], cnt = C.n || 3, rr = E.r[i] + 24;
        for (let k = 0; k < cnt; k++) { const a = k / cnt * 6.283 + Math.random(); spawnEnemy(st, E.x[i] + Math.cos(a) * rr, E.y[i] + Math.sin(a) * rr); }
      }
    }
    if (S.t <= 0 && d < G.viewW * 0.9) {
      S.volley++;
      const big = S.volley % BOSS2.bigEvery === 0;
      S.t = BOSS2.strikeEvery + (big ? 1.2 : 0);
      const n = big ? (C.big || BOSS2.bigCount) : (C.strikes || BOSS2.strikeCount);
      // il primo colpo è dove sei (e dove stai andando), gli altri attorno
      addStrike(Player.x + Input.ax * 40, Player.y + Input.ay * 40);
      for (let k = 1; k < n; k++) {
        const a = Math.random() * 6.283, r = 50 + Math.random() * BOSS2.spread;
        addStrike(Player.x + Math.cos(a) * r, Player.y + Math.sin(a) * r);
      }
    }
    return;
  }

  // --- Flegiàs ---
  if (S.state === 'walk') {
    bossWalk(i, dt, d, dx, dy);
    S.summonT -= dt;
    if (S.summonT <= 0) {
      S.summonT = BOSS.summonEvery;
      const n = S.trial ? BOSS.summonCount >> 1 : BOSS.summonCount, rr = E.r[i] + 24, st = S.cfg.summon ? ET[S.cfg.summon] : ET.drop;
      for (let k = 0; k < n; k++) {
        const a = k / n * 6.283;
        spawnEnemy(st, E.x[i] + Math.cos(a) * rr, E.y[i] + Math.sin(a) * rr);
      }
    }
    if (S.t <= 0 && d < G.viewW * 0.75) { S.state = 'tell'; S.t = BOSS.tell; addShake(2); }
  } else if (S.state === 'tell') {
    // mira continuamente: la direzione si blocca all'ultimo istante
    S.dirX = dx / d; S.dirY = dy / d;
    if (S.t <= 0) { S.state = 'dash'; S.t = BOSS.dashTime; addShake(4); }
  } else {
    E.x[i] += S.dirX * BOSS.dashSpeed * dt;
    E.y[i] += S.dirY * BOSS.dashSpeed * dt;
    if (S.t <= 0) { S.state = 'walk'; S.t = BOSS.chargeEvery; }
  }
}

// ---------------------------------------------------------------------------
// FULMINI del boss 2: zona segnata a terra -> dopo strikeTell colpisce.
// Array fissi preallocati (niente allocazioni nel loop).
// ---------------------------------------------------------------------------
const Strikes = { max: 16, n: 0, x: new Float32Array(16), y: new Float32Array(16), t: new Float32Array(16) };

function addStrike(x, y) {
  const S = Strikes;
  if (S.n >= S.max) return;
  S.x[S.n] = x; S.y[S.n] = y; S.t[S.n] = BOSS2.strikeTell; S.n++;
}

function updateStrikes(dt) {
  const S = Strikes, r = BOSS2.strikeR;
  for (let k = 0; k < S.n; k++) {
    S.t[k] -= dt;
    if (S.t[k] > 0) continue;
    const x = S.x[k], y = S.y[k];
    // COLPO: lampo bianco, fulmine dal cielo, danno se sei dentro
    spawnFx(FXK.BOLT, x, y, 0.28, r * 0.6, x + (Math.random() - 0.5) * 80, y - G.viewH * 0.6);
    spawnFx(FXK.BOOM, x, y, 0.3, r);
    Sfx.play('bolt');
    G.flash = Math.max(G.flash, 0.22);
    addShake(5);
    const dx = Player.x - x, dy = Player.y - y, rr = r + Player.r;
    if (dx * dx + dy * dy < rr * rr) Player.hurt(BOSS2.strikeDmg * CFG.enemyDmgMult(G.time) * G.diff.dmg);
    // rimuovi (swap con l'ultimo)
    S.n--; S.x[k] = S.x[S.n]; S.y[k] = S.y[S.n]; S.t[k] = S.t[S.n]; k--;
  }
}
