'use strict';
// js/20_weapons.js — armi: WEAPON_LOGIC, proiettili, zone

// ============================================================================
// WEAPONS — istanze nelle slot del player + logica di fuoco + proiettili.
// Ogni arma ha una funzione in WEAPON_LOGIC; le statistiche stanno in
// WEAPON_DEFS (config.js). wStats(w) restituisce quelle del livello attuale
// (o dell'evoluzione).
// ============================================================================

const PK = { SALT: 0, BOMB: 1, SCYTHE: 2, ACID: 3, WISP: 4, ARROW: 5, AXE: 6, STORM: 7, HELIX: 8 };
const PROJ_SPRITE = ['proj_salt', 'bomb', 'proj_scythe', 'flask', 'wisp', 'proj_arrow', 'proj_axe', null, null];

const QBUF_ORB = new Int32Array(512);

function addWeapon(id) {
  const def = WEAPON_DEFS[id];
  const w = { id, def, level: 1, evolved: false, gear: !!def.gear, timer: 0.3, burst: 0, burstT: 0, angle: 0, pulse: 0, targets: new Float32Array(8),
    slot: Player.weapons.length, dealt: 0 };
  Player.weapons.push(w);
  return w;
}

function findWeapon(id) {
  for (let i = 0; i < Player.weapons.length; i++) if (Player.weapons[i].id === id) return Player.weapons[i];
  return null;
}

function wStats(w) { return w.evolved ? w.def.evo.stats : w.def.levels[w.level - 1]; }
// quanti proiettili spara l'arma: livello + Gemelli
function amt(st) { return st.amount + Player.amount; }
function wMaxed(w) { return w.evolved || w.level >= w.def.levels.length; }
function canEvolve(w) { return !w.gear && !!w.def.evo && !w.evolved && w.level >= w.def.levels.length && Player.passiveLevel(w.def.evo.passive) > 0; }
// armi "normali" (le 6 slot): l'arma dell'Armaiolo non conta
function slotWeaponCount() { let n = 0; for (const w of Player.weapons) if (!w.gear) n++; return n; }

function levelUpWeapon(w) { if (w.level < w.def.levels.length) w.level++; }
function evolveWeapon(w) {
  w.evolved = true;
  w.timer = 0.2;
  const st = w.def.evo.stats;
  if (st.slow) G.slowFactor = st.slow;
}

// Nemico vivo più vicino entro `range`, escludendo gli uid in `excl[0..exclN)`.
function nearestEnemy(x, y, range, excl, exclN) {
  const E = Enemies, n = E.count;
  let best = -1, bd = range * range;
  for (let i = 0; i < n; i++) {
    if (E.alive[i] === 0) continue;
    const dx = E.x[i] - x, dy = E.y[i] - y;
    let d2 = dx * dx + dy * dy;
    if (E.big[i] !== 0) { const d = Math.sqrt(d2) - E.r[i] * 0.8; d2 = d > 0 ? d * d : 0; } // il boss conta dal bordo, non dal centro
    if (d2 >= bd) continue;
    let skip = false;
    for (let k = 0; k < exclN; k++) if (excl[k] === E.uid[i]) { skip = true; break; }  // exclN = 0 -> excl ignorato
    if (skip) continue;
    bd = d2; best = i;
  }
  return best;
}

// Il boss più vicino il cui bordo è entro `range` da (x,y); altrimenti -1
function bossInRange(x, y, range) {
  const E = Enemies;
  let best = -1, bd = range;
  for (let q = 0; q < Boss.n; q++) {
    const b = Boss.list[q];
    if (E.alive[b] === 0) continue;
    const dx = E.x[b] - x, dy = E.y[b] - y, d = Math.sqrt(dx * dx + dy * dy) - E.r[b] * 0.8;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

// Nemico vivo casuale entro un rettangolo attorno al player (tentativi limitati, niente allocazioni)
function randomEnemyNear(hw, hh) {
  const E = Enemies, n = E.count;
  if (n === 0) return -1;
  // il boss (se è in vista) viene scelto spesso: è il bersaglio che conta
  if (Boss.n > 0 && Math.random() < 0.35) {
    const b = Boss.list[(Math.random() * Boss.n) | 0], dx = E.x[b] - Player.x, dy = E.y[b] - Player.y, r = E.r[b];
    if (E.alive[b] !== 0 && dx > -hw - r && dx < hw + r && dy > -hh - r && dy < hh + r) return b;
  }
  for (let t = 0; t < 16; t++) {
    const i = (Math.random() * n) | 0;
    if (E.alive[i] === 0) continue;
    const dx = E.x[i] - Player.x, dy = E.y[i] - Player.y;
    if (dx > -hw && dx < hw && dy > -hh && dy < hh) return i;
  }
  return -1;
}

// Lancio a parabola (granate, fiale): atterra in (tx,ty) dopo `flight` secondi
function spawnLob(kind, x, y, tx, ty, flight, dmg, area, extra) {
  let dx = tx - x, dy = ty - y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= d; dy /= d;
  const i = spawnProjectile(kind, x, y, dx, dy, d / flight, dmg, 0, 1, flight, 0, 0);
  if (i >= 0) { Projectiles.aoe[i] = area; Projectiles.split[i] = extra; }
}
function spawnBomb(x, y, tx, ty, flight, dmg, area, split) { spawnLob(PK.BOMB, x, y, tx, ty, flight, dmg, area, split); }

function spawnZone(x, y, r, dur, dmg, slow) {
  const i = Zones.spawn();
  if (i < 0) return;
  const Z = Zones;
  Z.alive[i] = 1; Z.x[i] = x; Z.y[i] = y; Z.r[i] = r; Z.life[i] = Z.life0[i] = dur;
  Z.tick[i] = 0; Z.dmg[i] = dmg; Z.slow[i] = slow ? 1 : 0; Z.src[i] = G.src ? G.src.slot : -1;
}

function updateZones(dt) {
  const Z = Zones, tick = WEAPON_DEFS.acid.tick;
  for (let i = 0; i < Z.count; i++) {
    if (Z.alive[i] === 0) continue;
    if ((Z.life[i] -= dt) <= 0) { Z.alive[i] = 0; continue; }
    Z.tick[i] -= dt;
    if (Z.tick[i] > 0) continue;
    Z.tick[i] = tick;
    G.src = Z.src[i] >= 0 ? Player.weapons[Z.src[i]] : null;
    damageArea(Z.x[i], Z.y[i], Z.r[i], Z.dmg[i], 0, Z.slow[i] ? 0.6 : 0);
  }
  G.src = null;
}

const QBUF_SLASH = new Int32Array(1024);

// Direzione di mira delle armi dell'Armaiolo: verso lo slime più vicino a tiro (anche il boss),
// altrimenti dove stai andando. Scrive in _aim.
const _aim = { x: 1, y: 0 };
function aimDir(range) {
  let t = bossInRange(Player.x, Player.y, range * 0.9);
  if (t < 0) t = nearestEnemy(Player.x, Player.y, range, null, 0);
  if (t >= 0) {
    const dx = Enemies.x[t] - Player.x, dy = Enemies.y[t] - Player.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    _aim.x = dx / d; _aim.y = dy / d;
  } else { _aim.x = Player.dirX; _aim.y = Player.dirY; }
  return _aim;
}

const WEAPON_LOGIC = {
  // Pugnale: fendente ad arco verso lo slime più vicino (se nessuno è a tiro, davanti a te).
  dagger(w, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const st = wStats(w);
    w.timer = st.cd * Player.cdMult;
    // combo di 3: i primi due fendenti alternano il verso, il terzo è un fendente pieno (più largo e forte)
    w.combo = ((w.combo || 0) + 1) % 3;
    const fin = w.combo === 0, arc = st.arc * (fin ? 1.3 : 1);
    const R = st.range * Player.areaMult * (fin ? 1.1 : 1), aim = aimDir(R + 30), dx = aim.x, dy = aim.y;
    const cosHalf = Math.cos(arc * 0.5), dmg = st.dmg * Player.dmgMult * (fin ? 1.35 : 1);
    const E = Enemies;
    let sparks = 0;
    const n = Grid.query(Player.x, Player.y, R + CFG.MAX_ENEMY_R, QBUF_SLASH);
    for (let k = 0; k < n; k++) {
      const j = QBUF_SLASH[k];
      if (E.alive[j] === 0) continue;
      const ex = E.x[j] - Player.x, ey = E.y[j] - Player.y, d = Math.sqrt(ex * ex + ey * ey) || 1;
      if (d > R + E.r[j]) continue;
      if ((ex * dx + ey * dy) / d < cosHalf && d > E.r[j] + Player.r) continue; // fuori dall'arco (ma chi ti è addosso lo prendi)
      if (sparks < 5) { sparks++; spawnFx(FXK.SPARK, E.x[j] - ex / d * E.r[j] * 0.5, E.y[j] - ey / d * E.r[j] * 0.5, 0.16, 0); }
      damageEnemy(j, dmg, dx, dy, st.kb * (fin ? 1.4 : 1));
    }
    for (let q = Boss.n - 1; q >= 0; q--) {
      const b = Boss.list[q];
      if (E.alive[b] !== 0) {
        const ex = E.x[b] - Player.x, ey = E.y[b] - Player.y, d = Math.sqrt(ex * ex + ey * ey) || 1;
        if (d < R + E.r[b]) { damageEnemy(b, dmg, 0, 0, 0); spawnFx(FXK.SPARK, Player.x + dx * R * 0.8, Player.y + dy * R * 0.8, 0.16, 0); }
      }
    }
    // effetto: la lama del Pugio gira attorno a te lasciando una mezzaluna (val = arco con il verso, seed 1 = fendente pieno)
    const f = spawnFx(FXK.SLASH, Player.x, Player.y, fin ? 0.28 : 0.24, R, dx, dy);
    if (f >= 0) { FX.val[f] = arc * (w.combo === 2 ? -1 : 1); FX.seed[f] = fin ? 1 : 0; }
    if (fin) addShake(1.5);
    Sfx.play('slash');
  },

  // Lancia: affondo lungo e stretto verso lo slime più vicino, colpisce tutta la fila.
  spear(w, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const st = wStats(w);
    w.timer = st.cd * Player.cdMult;
    const R = st.range * Player.areaMult, hw = st.width * Player.areaMult, aim = aimDir(R + 20), dx = aim.x, dy = aim.y;
    const dmg = st.dmg * Player.dmgMult, E = Enemies;
    const mx = Player.x + dx * R * 0.5, my = Player.y + dy * R * 0.5;
    const n = Grid.query(mx, my, R * 0.5 + hw + CFG.MAX_ENEMY_R, QBUF_SLASH);
    for (let k = 0; k < n; k++) {
      const j = QBUF_SLASH[k];
      if (E.alive[j] === 0) continue;
      const ex = E.x[j] - Player.x, ey = E.y[j] - Player.y;
      const along = ex * dx + ey * dy, side = Math.abs(ex * -dy + ey * dx);
      if (along < -E.r[j] || along > R + E.r[j] || side > hw + E.r[j]) continue;
      damageEnemy(j, dmg, dx, dy, st.kb);
    }
    for (let q = Boss.n - 1; q >= 0; q--) {
      const b = Boss.list[q];
      if (E.alive[b] !== 0) {
        const ex = E.x[b] - Player.x, ey = E.y[b] - Player.y;
        const along = ex * dx + ey * dy, side = Math.abs(ex * -dy + ey * dx);
        if (along > -E.r[b] && along < R + E.r[b] && side < hw + E.r[b]) damageEnemy(b, dmg, 0, 0, 0);
      }
    }
    const f = spawnFx(FXK.THRUST, Player.x, Player.y, 0.2, R, dx, dy);
    if (f >= 0) FX.val[f] = hw;
    Sfx.play('thrust');
  },

  // Arco: frecce perforanti verso lo slime più vicino (a ventaglio dal livello +2).
  bow(w, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const st = wStats(w);
    w.timer = st.cd * Player.cdMult;
    const aim = aimDir(st.speed * w.def.life), a0 = Math.atan2(aim.y, aim.x), sp = w.def.spread;
    for (let k = 0; k < amt(st); k++) {
      const a = a0 + (k - (amt(st) - 1) / 2) * sp;
      spawnProjectile(PK.ARROW, Player.x, Player.y, Math.cos(a), Math.sin(a), st.speed, st.dmg * Player.dmgMult, 6 * Player.areaMult, 1, w.def.life, st.pierce, 50);
    }
    Sfx.play('bow');
  },

  // Ascia: lanciata verso l'alto (un po' in avanti), ricade per la gravità colpendo tutto.
  axe(w, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const st = wStats(w);
    w.timer = st.cd * Player.cdMult;
    for (let k = 0; k < amt(st); k++) {
      const side = amt(st) === 1 ? Player.facing : (k - (amt(st) - 1) / 2);
      const vx = side * (70 + Math.random() * 40) + Player.dirX * 40;
      const sz = st.size * Player.areaMult;
      const i = spawnProjectile(PK.AXE, Player.x, Player.y - 6, 0, -1, 0, st.dmg * Player.dmgMult, 12 * sz, sz, w.def.life, 999, 70);
      if (i >= 0) { Projectiles.vx[i] = vx; Projectiles.vy[i] = -w.def.up * (0.9 + Math.random() * 0.2); Projectiles.dx[i] = vx > 0 ? 0.3 : -0.3; Projectiles.dy[i] = 1; }
    }
    Sfx.play('axe');
  },

  // Falce di Luna: vola verso lo slime più vicino (o davanti a te), rallenta, torna indietro.
  scythe(w, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const st = wStats(w);
    w.timer = st.cd * Player.cdMult;
    const t = nearestEnemy(Player.x, Player.y, 420, w.targets, 0);
    let a0 = t >= 0 ? Math.atan2(Enemies.y[t] - Player.y, Enemies.x[t] - Player.x) : Math.atan2(Player.dirY, Player.dirX);
    const spread = 0.5;
    for (let k = 0; k < amt(st); k++) {
      const a = amt(st) >= 5 ? a0 + k / amt(st) * 6.283 : a0 + (k - (amt(st) - 1) / 2) * spread;
      const sz = st.size * Player.areaMult;
      const i = spawnProjectile(PK.SCYTHE, Player.x, Player.y, Math.cos(a), Math.sin(a), st.speed, st.dmg * Player.dmgMult, 11 * sz, sz, st.life, 999, 30);
      if (i >= 0) Projectiles.tgt[i] = 0;
    }
  },

  // Fiala Acida: lanciata su uno slime, lascia una pozza che brucia.
  acid(w, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const st = wStats(w);
    w.timer = st.cd * Player.cdMult;
    const r = w.def.range;
    for (let s = 0; s < amt(st); s++) {
      let tx, ty;
      const t = randomEnemyNear(r, r);
      if (t >= 0) { tx = Enemies.x[t]; ty = Enemies.y[t]; }
      else { const a = Math.random() * 6.283, d = 80 + Math.random() * 100; tx = Player.x + Math.cos(a) * d; ty = Player.y + Math.sin(a) * d; }
      spawnLob(PK.ACID, Player.x, Player.y, tx, ty, w.def.flight, st.dmg * Player.dmgMult, st.area * Player.areaMult, st.dur);
    }
  },

  // Fuochi Fatui: fiammelle che inseguono lo slime più vicino.
  wisps(w, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const st = wStats(w);
    w.timer = st.cd * Player.cdMult;
    for (let k = 0; k < amt(st); k++) {
      const a = Math.random() * 6.283;
      const i = spawnProjectile(PK.WISP, Player.x, Player.y, Math.cos(a), Math.sin(a), st.speed, st.dmg * Player.dmgMult, 6, 1, w.def.life, st.pierce, 30);
      if (i >= 0) { Projectiles.aoe[i] = 0; Projectiles.split[i] = st.speed; }
    }
  },

  // Dardo di Sale: raffica di `amount` cristalli, ognuno verso un bersaglio diverso.
  dart(w, dt) {
    const st = wStats(w);
    if (w.burst > 0) {
      w.burstT -= dt;
      if (w.burstT <= 0) {
        const shot = amt(st) - w.burst;
        // il primo cristallo di ogni raffica va sul boss (se è a tiro), gli altri sui più vicini
        let t = shot === 0 ? bossInRange(Player.x, Player.y, w.def.range) : -1;
        if (t < 0) t = nearestEnemy(Player.x, Player.y, w.def.range, w.targets, shot);
        if (t >= 0) {
          w.targets[shot] = Enemies.uid[t];
          let dx = Enemies.x[t] - Player.x, dy = Enemies.y[t] - Player.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          dx /= d; dy /= d;
          spawnProjectile(PK.SALT, Player.x, Player.y, dx, dy, st.speed, st.dmg * Player.dmgMult,
            6 * Player.areaMult, Player.areaMult, w.def.life, st.pierce, st.kb);
          Player.throwT = 0.12;                    // fotogramma del lancio
        }
        w.burst--;
        w.burstT = w.def.burstDelay;
      }
      return;
    }
    w.timer -= dt;
    if (w.timer <= 0) {
      if (nearestEnemy(Player.x, Player.y, w.def.range, w.targets, 0) < 0) { w.timer = 0.1; return; }
      w.timer = st.cd * Player.cdMult;
      w.burst = amt(st);
      w.burstT = 0;
    }
  },

  // Cerchio di Sale: impulso di danno a tutti i nemici nel raggio.
  aura(w, dt) {
    const st = wStats(w);
    if (w.pulse > 0) w.pulse -= dt;
    w.timer -= dt;
    if (w.timer > 0) return;
    w.timer = st.cd * Player.cdMult;
    w.pulse = 0.12;
    damageArea(Player.x, Player.y, st.radius * Player.areaMult, st.dmg * Player.dmgMult, st.kb, st.slow ? 0.5 : 0);
  },

  // Ampolle Orbitanti: ogni ampolla colpisce i nemici che tocca (cooldown per nemico).
  orbit(w, dt) {
    const st = wStats(w), E = Enemies;
    w.angle += st.spin * dt;
    const n = amt(st), R = st.radius * Player.areaMult, sz = st.size * Player.areaMult;
    const step = Math.PI * 2 / n, dmg = st.dmg * Player.dmgMult, hitCd = w.def.hitCd;
    for (let k = 0; k < n; k++) {
      const a = w.angle + k * step;
      const ox = Player.x + Math.cos(a) * R, oy = Player.y + Math.sin(a) * R;
      const c = Grid.query(ox, oy, sz + CFG.MAX_ENEMY_R, QBUF_ORB);
      for (let q = 0; q < c; q++) {
        const j = QBUF_ORB[q];
        if (E.alive[j] === 0 || E.orbCd[j] > 0) continue;
        const dx = E.x[j] - ox, dy = E.y[j] - oy, rr = sz + E.r[j];
        if (dx * dx + dy * dy >= rr * rr) continue;
        E.orbCd[j] = hitCd;
        const px = E.x[j] - Player.x, py = E.y[j] - Player.y, d = Math.sqrt(px * px + py * py) || 1;
        damageEnemy(j, dmg, px / d, py / d, st.kb);
      }
      for (let q = Boss.n - 1; q >= 0; q--) {
        const b = Boss.list[q];
        if (E.alive[b] !== 0 && E.orbCd[b] <= 0) {
          const dx = E.x[b] - ox, dy = E.y[b] - oy, rr = sz + E.r[b];
          if (dx * dx + dy * dy < rr * rr) { E.orbCd[b] = hitCd / amt(st); damageEnemy(b, dmg, 0, 0, 0); }
        }
      }
    }
  },

  // Scarica Voltaica: fulmini su nemici casuali sullo schermo (+ catena se evoluta).
  lightning(w, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const st = wStats(w);
    w.timer = st.cd * Player.cdMult;
    const hw = G.viewW * 0.5, hh = G.viewH * 0.5;
    const dmg = st.dmg * Player.dmgMult, area = st.area * Player.areaMult;
    for (let s = 0; s < amt(st); s++) {
      const t = randomEnemyNear(hw, hh);
      if (t < 0) break;
      let x = Enemies.x[t], y = Enemies.y[t];
      spawnFx(FXK.BOLT, x, y, 0.2, area, x + (Math.random() - 0.5) * 60, y - hh - 40);
      Sfx.play('zap');
      damageArea(x, y, area, dmg, 30, 0);
      // catena: salta sui nemici vicini
      let nx = 0;
      w.targets[nx++] = Enemies.uid[t];
      for (let c = 0; c < st.chain; c++) {
        const j = nearestEnemy(x, y, 170, w.targets, nx);
        if (j < 0) break;
        if (nx < 8) w.targets[nx++] = Enemies.uid[j];
        const jx = Enemies.x[j], jy = Enemies.y[j];
        spawnFx(FXK.BOLT, jx, jy, 0.2, area * 0.8, x, y);
        damageArea(jx, jy, area * 0.8, dmg * 0.7, 20, 0);
        x = jx; y = jy;
      }
    }
  },

  // Granata Alchemica: lanciata su un nemico, esplode all'atterraggio.
  bomb(w, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const st = wStats(w);
    w.timer = st.cd * Player.cdMult;
    const r = w.def.range;
    for (let s = 0; s < amt(st); s++) {
      let tx, ty;
      const t = randomEnemyNear(r, r);
      if (t >= 0) { tx = Enemies.x[t]; ty = Enemies.y[t]; }
      else { const a = Math.random() * 6.283, d = 100 + Math.random() * 100; tx = Player.x + Math.cos(a) * d; ty = Player.y + Math.sin(a) * d; }
      spawnBomb(Player.x, Player.y, tx, ty, w.def.flight, st.dmg * Player.dmgMult, st.area * Player.areaMult, st.split);
    }
  },

  // Flagello: raffica di sferzate (una ogni `gap` secondi), alternando i lati.
  whip(w, dt) {
    const st = wStats(w);
    if (w.burst > 0) {
      w.burstT -= dt;
      if (w.burstT <= 0) { whipLash(st, amt(st) - w.burst); w.burst--; w.burstT = w.def.gap; }
      return;
    }
    w.timer -= dt;
    if (w.timer > 0) return;
    w.timer = st.cd * Player.cdMult;
    w.burst = amt(st); w.burstT = 0;
  },

  // Bufera: lancia `amount` turbini a raggiera che poi vagano da soli.
  storm(w, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const st = wStats(w);
    w.timer = st.cd * Player.cdMult;
    const n = amt(st), a0 = Math.random() * 6.283, sz = st.size * Player.areaMult;
    for (let k = 0; k < n; k++) {
      const a = a0 + k / n * 6.283;
      const i = spawnProjectile(PK.STORM, Player.x + Math.cos(a) * 16, Player.y + Math.sin(a) * 16, Math.cos(a), Math.sin(a), st.speed, st.dmg * Player.dmgMult, sz, sz / 22, st.life, 999, st.kb);
      if (i >= 0) { Projectiles.aoe[i] = 0; Projectiles.tgt[i] = a; Projectiles.split[i] = st.speed; }
    }
    Sfx.play('storm');
  },

  // Lume: raggi che ruotano; ogni nemico viene colpito una volta per ogni passaggio di ogni raggio.
  beam(w, dt) {
    const st = wStats(w), n = amt(st);
    if (w.last === undefined) w.last = w.angle;
    w.angle += st.spin * dt;
    w.pulse += dt;
    if (w.pulse < 0.05) return;            // il controllo gira a scatti di 0.05 s sull'arco spazzato nel frattempo
    w.pulse = 0;
    const from = w.last, sweep = w.angle - w.last;
    w.last = w.angle;
    const R = st.range * Player.areaMult, dmg = st.dmg * Player.dmgMult, E = Enemies, step = 6.2832 / n, TAU = 6.2832;
    const hit = (j, r) => {
      const dx = E.x[j] - Player.x, dy = E.y[j] - Player.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > R + r) return false;
      // finestre contigue: ognuno preso una volta sola per passaggio (se ci sei dentro, ogni raggio lo prende a ogni giro)
      const tol = d <= r + 4 ? Math.PI : Math.atan2(r + 4, d), ang = Math.atan2(dy, dx) + tol;
      for (let k = 0; k < n; k++) {
        let rel = (ang - from - k * step) % TAU; if (rel < 0) rel += TAU;
        if (rel < sweep) return true;
      }
      return false;
    };
    const c = Grid.query(Player.x, Player.y, R + CFG.MAX_ENEMY_R, QBUF_AOE);
    for (let q = 0; q < c; q++) {
      const j = QBUF_AOE[q];
      if (E.alive[j] === 0 || !hit(j, E.r[j])) continue;
      const dx = E.x[j] - Player.x, dy = E.y[j] - Player.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      damageEnemy(j, dmg, dx / d, dy / d, st.kb);
    }
    for (let q = Boss.n - 1; q >= 0; q--) { const b = Boss.list[q]; if (E.alive[b] !== 0 && hit(b, E.r[b] * 0.8)) damageEnemy(b, dmg, 0, 0, 0); }
  },

  // Vite Aerea: `amount` lame a raggiera che si avvitano verso l'esterno (evoluta: metà gira al contrario).
  helix(w, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const st = wStats(w);
    w.timer = st.cd * Player.cdMult;
    const n = amt(st), a0 = Math.random() * 6.2832, D = w.def, sz = st.size * Player.areaMult;
    for (let k = 0; k < n; k++) {
      const a = a0 + k / n * 6.2832, dir = st.twin && (k & 1) ? -1 : 1;
      const i = spawnProjectile(PK.HELIX, Player.x + Math.cos(a) * D.r0, Player.y + Math.sin(a) * D.r0, Math.cos(a), Math.sin(a), 0, st.dmg * Player.dmgMult, sz, sz, 6, 999, st.kb);
      if (i < 0) break;
      const P = Projectiles;
      P.tgt[i] = a; P.aoe[i] = a; P.split[i] = st.speed * dir; P.vx[i] = st.reach * Player.areaMult; P.vy[i] = 0;
    }
    Sfx.play('helix');
  },

  // Gelo: `amount` onde di ghiaccio, una ogni `gap` secondi.
  frost(w, dt) {
    const st = wStats(w);
    if (w.burst > 0) {
      w.burstT -= dt;
      if (w.burstT <= 0) { frostNova(st); w.burst--; w.burstT = w.def.gap; }
      return;
    }
    w.timer -= dt;
    if (w.timer > 0) return;
    w.timer = st.cd * Player.cdMult;
    w.burst = amt(st); w.burstT = 0;
  },
};

// Una sferzata del Flagello. k = numero della sferzata nella raffica:
// 0 dalla parte in cui guardi, 1 dietro, 2 e 3 sopra/sotto (davanti e dietro), e così via.
function whipLash(st, k) {
  const side = (k & 1 ? -1 : 1) * Player.facing;
  const hh = st.height * Player.areaMult, R = st.range * Player.areaMult;
  const yOff = k < 2 ? 0 : (((k >> 1) & 1) ? 1 : -1) * (k & 1 ? -1 : 1) * hh * 1.6;
  const cy = Player.y + yOff, dmg = st.dmg * Player.dmgMult, E = Enemies;
  const n = Grid.query(Player.x + side * R * 0.5, cy, R * 0.5 + hh + CFG.MAX_ENEMY_R, QBUF_SLASH);
  for (let q = 0; q < n; q++) {
    const j = QBUF_SLASH[q];
    if (E.alive[j] === 0) continue;
    const ex = (E.x[j] - Player.x) * side, ey = E.y[j] - cy;
    if (ex < -E.r[j] - 6 || ex > R + E.r[j] || Math.abs(ey) > hh + E.r[j]) continue;
    if (st.stun) { E.frz[j] = st.stun; E.frzM[j] = 0; }
    damageEnemy(j, dmg, side, 0, st.kb);
  }
  for (let q = Boss.n - 1; q >= 0; q--) {
    const b = Boss.list[q];
    if (E.alive[b] !== 0) {
      const ex = (E.x[b] - Player.x) * side, ey = E.y[b] - cy;
      if (ex > -E.r[b] && ex < R + E.r[b] * 0.8 && Math.abs(ey) < hh + E.r[b] * 0.8) damageEnemy(b, dmg, 0, 0, 0);
    }
  }
  const f = spawnFx(FXK.WHIP, Player.x, cy, 0.28, R, side, yOff);
  if (f >= 0) FX.val[f] = hh;
  Sfx.play('whip');
}

// Onda del Gelo: danno + rallenta (o congela) tutti nel raggio
function frostNova(st) {
  const R = st.radius * Player.areaMult, dmg = st.dmg * Player.dmgMult, E = Enemies, kb = WEAPON_DEFS.frost.kb;
  const n = Grid.query(Player.x, Player.y, R + CFG.MAX_ENEMY_R, QBUF_AOE);
  for (let q = 0; q < n; q++) {
    const j = QBUF_AOE[q];
    if (E.alive[j] === 0) continue;
    const dx = E.x[j] - Player.x, dy = E.y[j] - Player.y, rr = R + E.r[j], d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) continue;
    const d = Math.sqrt(d2) || 1;
    if (!(E.frz[j] > 0 && E.frzM[j] < st.slow)) { E.frz[j] = st.dur; E.frzM[j] = st.slow; }
    damageEnemy(j, dmg, dx / d, dy / d, kb);
  }
  for (let q = Boss.n - 1; q >= 0; q--) {
    const b = Boss.list[q];
    if (E.alive[b] !== 0) { const dx = E.x[b] - Player.x, dy = E.y[b] - Player.y, rr = R + E.r[b]; if (dx * dx + dy * dy < rr * rr) damageEnemy(b, dmg, 0, 0, 0); }
  }
  spawnFx(FXK.NOVA, Player.x, Player.y, 0.34, R);
  Sfx.play('frost');
}

function updateWeapons(dt) {
  const ws = Player.weapons;
  for (let i = 0; i < ws.length; i++) { G.src = ws[i]; WEAPON_LOGIC[ws[i].id](ws[i], dt); }
  G.src = null;
}

function explodeBomb(i) {
  const P = Projectiles, x = P.x[i], y = P.y[i], aoe = P.aoe[i], dmg = P.dmg[i], split = P.split[i];
  damageArea(x, y, aoe, dmg, 90, 0);
  spawnFx(FXK.BOOM, x, y, 0.35, aoe);
  Sfx.play('boom');
  addShake(split > 0 || aoe > 60 ? 2.5 : 1.5);
  if (split > 0) {
    const step = Math.PI * 2 / split;
    for (let k = 0; k < split; k++) {
      const a = k * step + 0.785;
      spawnBomb(x, y, x + Math.cos(a) * aoe * 1.3, y + Math.sin(a) * aoe * 1.3, 0.35, dmg * 0.5, aoe * 0.6, 0);
    }
  }
}

// Movimento + collisioni dei proiettili del giocatore.
function updateProjectiles(dt) {
  const P = Projectiles, E = Enemies, n = P.count;
  const qR = CFG.MAX_ENEMY_R;
  for (let i = 0; i < n; i++) {
    if (P.alive[i] === 0) continue;
    G.src = P.src[i] >= 0 ? Player.weapons[P.src[i]] : null;
    const kind = P.kind[i];
    P.life[i] -= dt;

    if (kind === PK.STORM) {
      // turbine: vaga curvando piano (se si allontana troppo torna verso di te) e ogni `tick` colpisce chi ha dentro
      const D = WEAPON_DEFS.storm;
      P.tgt[i] += Math.sin(P.life[i] * 2.3 + i) * 1.8 * dt;
      let hx = Math.cos(P.tgt[i]), hy = Math.sin(P.tgt[i]);
      const dxp = Player.x - P.x[i], dyp = Player.y - P.y[i], dp = Math.sqrt(dxp * dxp + dyp * dyp) || 1;
      if (dp > D.leash) {
        hx += dxp / dp * 4 * dt; hy += dyp / dp * 4 * dt;
        const l = Math.sqrt(hx * hx + hy * hy) || 1; hx /= l; hy /= l; P.tgt[i] = Math.atan2(hy, hx);
      }
      P.vx[i] = hx * P.split[i]; P.vy[i] = hy * P.split[i];
      P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt;
      P.aoe[i] -= dt;
      if (P.aoe[i] <= 0) { P.aoe[i] = D.tick; damageArea(P.x[i], P.y[i], P.r[i], P.dmg[i], P.kb[i], 0); }
      if (P.life[i] <= 0) P.alive[i] = 0;
      continue;
    } else if (kind === PK.SCYTHE) {
      // andata: rallenta fino a fermarsi; ritorno: accelera verso di te (e può ricolpire tutti)
      const e = P.life0[i] - P.life[i], half = P.life0[i] * 0.5;
      if (e < half) {
        const f = 1 - e / half;
        P.x[i] += P.vx[i] * f * dt; P.y[i] += P.vy[i] * f * dt;
      } else {
        if (P.tgt[i] === 0) { P.tgt[i] = 1; P.h0[i] = P.h1[i] = P.h2[i] = P.h3[i] = 0; P.hn[i] = 0; }
        const dx = Player.x - P.x[i], dy = Player.y - P.y[i], d = Math.sqrt(dx * dx + dy * dy) || 1;
        const sp = Math.sqrt(P.vx[i] * P.vx[i] + P.vy[i] * P.vy[i]) * Math.min(1.7, 0.2 + (e - half) / half * 1.6);
        P.x[i] += dx / d * sp * dt; P.y[i] += dy / d * sp * dt;
        if (d < 18) { P.alive[i] = 0; continue; }
      }
      if (P.life[i] <= -1.5) { P.alive[i] = 0; continue; }
    } else if (kind === PK.HELIX) {
      const D = WEAPON_DEFS.helix, sp = P.split[i], dir = sp < 0 ? -1 : 1;
      let r = D.r0 * Math.pow(D.phi, Math.abs(P.tgt[i] - P.aoe[i]) * 0.63662);
      P.tgt[i] += dir * Math.abs(sp) * dt / Math.max(r, D.r0) * 0.95;
      r = D.r0 * Math.pow(D.phi, Math.abs(P.tgt[i] - P.aoe[i]) * 0.63662);
      const ca = Math.cos(P.tgt[i]), sa = Math.sin(P.tgt[i]);
      P.x[i] = Player.x + ca * r; P.y[i] = Player.y + sa * r;
      P.dx[i] = ca; P.dy[i] = sa;
      if (r > P.vx[i]) { P.alive[i] = 0; continue; }
    } else if (kind === PK.WISP) {
      // ogni 0.15 s cerca lo slime più vicino e curva verso di lui
      P.aoe[i] -= dt;
      if (P.aoe[i] <= 0) {
        P.aoe[i] = 0.15;
        // metà delle fiammelle preferisce il boss, le altre lo slime più vicino
        let t = (i & 1) ? bossInRange(P.x[i], P.y[i], 380) : -1;
        if (t < 0) t = nearestEnemy(P.x[i], P.y[i], 380, null, 0);
        P.tgt[i] = t;
      }
      const t = P.tgt[i];
      if (t >= 0 && t < Enemies.count && Enemies.alive[t] !== 0) {
        const dx = Enemies.x[t] - P.x[i], dy = Enemies.y[t] - P.y[i], d = Math.sqrt(dx * dx + dy * dy) || 1;
        const sp = P.split[i], turn = WEAPON_DEFS.wisps.turn * dt;
        let vx = P.vx[i] + dx / d * sp * turn, vy = P.vy[i] + dy / d * sp * turn;
        const v = Math.sqrt(vx * vx + vy * vy) || 1;
        P.vx[i] = vx / v * sp; P.vy[i] = vy / v * sp;
      }
      P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt;
    } else {
      if (kind === PK.AXE) P.vy[i] += WEAPON_DEFS.axe.grav * dt;   // l'ascia ricade
      P.x[i] += P.vx[i] * dt;
      P.y[i] += P.vy[i] * dt;
    }

    if (kind === PK.BOMB || kind === PK.ACID) {
      if (P.life[i] <= 0) {
        if (kind === PK.BOMB) explodeBomb(i);
        else {
          const w = G.src, slow = w && w.evolved && w.def.evo.stats.slow;
          spawnZone(P.x[i], P.y[i], P.aoe[i], P.split[i], P.dmg[i], slow);
          spawnFx(FXK.PUFF, P.x[i], P.y[i], 0.25, P.aoe[i] * 0.6);
        }
        P.alive[i] = 0;
      }
      continue;
    }
    if (kind !== PK.SCYTHE && P.life[i] <= 0) { P.alive[i] = 0; continue; }

    const x = P.x[i], y = P.y[i], r = P.r[i];
    const c = Grid.query(x, y, r + qR, QBUF_PROJ);
    for (let k = 0; k < c; k++) {
      if (projHit(i, QBUF_PROJ[k], x, y, r)) break;
    }
    for (let q = Boss.n - 1; q >= 0 && P.alive[i] !== 0; q--) projHit(i, Boss.list[q], x, y, r);
  }
  G.src = null;
}

// Il proiettile i tocca il nemico j? Applica il colpo. Ritorna true se il proiettile è finito.
function projHit(i, j, x, y, r) {
  const P = Projectiles, E = Enemies;
  if (E.alive[j] === 0) return false;
  const dx = E.x[j] - x, dy = E.y[j] - y, rr = E.r[j] + r;
  if (dx * dx + dy * dy >= rr * rr) return false;
  const uid = E.uid[j];
  if (P.h0[i] === uid || P.h1[i] === uid || P.h2[i] === uid || P.h3[i] === uid) return false;
  const slot = P.hn[i] & 3;
  if (slot === 0) P.h0[i] = uid; else if (slot === 1) P.h1[i] = uid; else if (slot === 2) P.h2[i] = uid; else P.h3[i] = uid;
  P.hn[i]++;
  damageEnemy(j, P.dmg[i], P.dx[i], P.dy[i], P.kb[i]);
  if (--P.pierce[i] <= 0) { P.alive[i] = 0; return true; }
  return false;
}
