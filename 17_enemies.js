'use strict';
// js/17_enemies.js — Spawner + scelta del tipo di nemico

// ============================================================================
// ENEMIES — spawn ai bordi, inseguimento, separazione, knockback,
// riposizionamento di chi resta troppo indietro.
// ============================================================================

const Spawner = {
  acc: 0,          // nemici "accumulati" da spawnare (frazionari)
  swarmT: 0,

  eliteT: 0, eliteFirst: true,

  reset() { this.acc = 0; this.swarmT = SPAWN.firstSwarm; this.eliteT = 0; this.eliteFirst = true; this.skulled = false; Boss.reset(); Death.reset(); },

  // Fase 1: spawn continuo con rateo crescente + sciami periodici.
  // In fase 3 verrà sostituito dalla tabella delle ondate.
  update(dt) {
    const t = G.time;
    // boss del minuto 5
    if (!Boss.warned1 && t >= BOSS.warnAt) {
      Boss.warned1 = true;
      UI.toast(bossName(ET.boss), '', 3);
    }
    if (!Boss.spawned1 && Boss.main() === 0 && t >= BOSS.time) spawnBoss(ET.boss);
    // CUSTODE di una ricetta comprata dal Magister: uno alla volta (TRIAL)
    if (Boss.trials() === 0 && t >= Boss.trialT - TRIAL.warnBefore) {
      const key = Save.pendingRecipe();
      if (key) {
        if (!Boss.trialWarned) Boss.trialWarned = true;
        if (t >= Boss.trialT && !spawnTrial(key)) Boss.trialT = t + 5;   // pieno di boss: riprova tra poco
      }
    }
    // VITTORIA al minuto 7: basta resistere
    if (!G.won && !G.victory) {
      if (!Boss.warnedWin && t >= WIN.warnAt) Boss.warnedWin = true;
      if (t >= WIN.time) winRun();
    }
    // solo se hai continuato: subito i due guardiani della mappa, al minuto 10 tutti e tre (e slime più forti)
    if (G.endless) {
      if (Boss.duoT > 0 && !Boss.spawnedDuo) {
        if (!Boss.warnedDuo && t >= Boss.duoT - DUO.warnBefore) Boss.warnedDuo = true;
        if (t >= Boss.duoT) spawnBossDuo();
      }
      if (!Boss.warnedTrio && t >= TRIO.warnAt) {
        Boss.warnedTrio = true;
      }
      if (!Boss.spawnedTrio && t >= TRIO.time) {
        spawnBossTrio();
        Boss.endlessT = t + ENDLESS.bossEvery;
      }
      // poi tornano uno alla volta, quando non ce n'è nessuno in giro (sempre più forti col tempo)
      if (Boss.spawnedTrio && Boss.main() === 0 && t >= Boss.endlessT) {
        Boss.endlessT = t + ENDLESS.bossEvery;
        spawnBoss([ET.boss, ET.boss2, ET.boss3][Boss.endlessN++ % 3]);
      }
    }

    // MINUTO 11: i dannati ancora in giro diventano teschi (senza lasciare gemme)
    if (!this.skulled && t >= SKULLS.time) {
      this.skulled = true;
      const E = Enemies, n = E.count;
      for (let i = 0; i < n; i++) {
        if (E.alive[i] === 0 || E.big[i] !== 0 || E.type[i] === ET.skull) continue;
        const x = E.x[i], y = E.y[i];
        E.alive[i] = 0;
        spawnEnemy(ET.skull, x, y);
        if ((i & 7) === 0) spawnFx(FXK.PUFF, x, y, 0.4, 18);
      }
      UI.toast(ENEMY_DEFS[ET.skull].name, '', 3);
    }
    // LA MORTE al minuto 14
    if (!Death.warned && t >= DEATH.warnAt) { Death.warned = true; Sfx.play('warn'); }
    if (!Death.on && t >= DEATH.time) Death.spawn();

    // Cacciatori dal minuto 4
    if (t >= ELITE.start && t < SKULLS.time) {
      this.eliteT -= dt;
      if (this.eliteT <= 0) {
        const mins = (t - ELITE.start) / 60;
        this.eliteT = Math.max(ELITE.minEvery, ELITE.every - mins * ELITE.faster);
        const n = t >= 660 ? 3 : t >= 480 ? 2 : 1;
        for (let k = 0; k < n; k++) spawnOnRing(ET.elite);
        if (this.eliteFirst) { this.eliteFirst = false; UI.toast(ENEMY_DEFS[ET.elite].name, '', 3); }
      }
    }
    updateNight();

    if (Enemies.count < SPAWN.maxAlive) {
      const mult = Boss.active ? BOSS.spawnMult : 1;
      this.acc += (SPAWN.baseRate + t * SPAWN.rateGrowth) * G.diff.spawn * mult * (G.map.spawn || 1) * dt;
      while (this.acc >= 1) {
        this.acc -= 1;
        spawnOnRing(pickEnemyType(t));
      }
    }
    this.swarmT -= dt;
    if (this.swarmT <= 0) {
      this.swarmT = SPAWN.swarmEvery;
      spawnSwarm(t >= SKULLS.time ? ET.skull : ET.drop, Math.round((SPAWN.swarmSize[0] + Math.random() * (SPAWN.swarmSize[1] - SPAWN.swarmSize[0])) * Math.sqrt(G.diff.spawn) * G.map.swarm));
    }
  },
};

// LA MORTE: fuori dal pool dei nemici (le armi non la vedono), una sola, ti insegue e ti uccide al tocco
const Death = {
  on: false, warned: false, x: 0, y: 0, px: 0, py: 0, t: 0, face: 1,
  reset() { this.on = false; this.warned = false; this.t = 0; },
  // appare appena fuori dalla vista (anche passando da un'isola all'altra)
  place() { const p = ringPoint(120); this.x = this.px = p.x; this.y = this.py = p.y; },
  spawn() {
    this.on = true; this.t = 0; this.place();
    addShake(6); Sfx.play('night');
    UI.reaper(DEATH.portrait); G.hitStop = Math.max(G.hitStop, DEATH.portrait);   // il ritratto a tutto schermo: il gioco si ferma un attimo
  },
  update(dt) {
    this.t += dt;
    this.px = this.x; this.py = this.y;
    const dx = Player.x - this.x, dy = Player.y - this.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    const spd = Player.speed * Math.min(DEATH.max, DEATH.speed + DEATH.accel * this.t);
    const s = Math.min(d, spd * dt);
    this.x += dx / d * s; this.y += dy / d * s;
    if (dx > 2) this.face = 1; else if (dx < -2) this.face = -1;
    const rr = DEATH.r + Player.r;
    if (d < rr && !G.god && G.state === 'play') {
      // un colpo solo: niente schivata, armatura o invulnerabilità
      Player.hp = 0; Player.hurtT = 0.3; addShake(8); G.killedBy = 'death';
      onPlayerDeath();
    }
  },
};

function pickEnemyType(t) {
  if (t >= SKULLS.time) return ET.skull;   // dopo l'11:00 solo teschi
  // nemico speciale della mappa (Slime Velenoso nella Palude, Spettro nella Cattedrale)
  if (t >= 60 && G.map.special && Math.random() < G.map.specialShare) return ET[G.map.special];
  const r = Math.random();
  if (t < 30) return r < 0.55 ? ET.drop : r < 0.8 ? ET.heavy : ET.fast;
  if (t < 90) return r < 0.4 ? ET.drop : r < 0.7 ? ET.heavy : ET.fast;
  const sp = SPIT.share * G.map.spitter;   // quota Arcieri (più alta nella Cattedrale)
  return r < sp ? ET.spitter : r < sp + 0.33 ? ET.drop : r < sp + 0.58 ? ET.heavy : ET.fast;
}

// Punto casuale sul perimetro di un rettangolo appena fuori dalla vista.
const _ring = { x: 0, y: 0 };
function ringPoint(margin) {
  const hw = G.viewW * 0.5 + margin, hh = G.viewH * 0.5 + margin;
  const per = 4 * (hw + hh);
  let p = Math.random() * per;
  if (p < 2 * hw) { _ring.x = -hw + p; _ring.y = -hh; }
  else if ((p -= 2 * hw) < 2 * hh) { _ring.x = hw; _ring.y = -hh + p; }
  else if ((p -= 2 * hh) < 2 * hw) { _ring.x = hw - p; _ring.y = hh; }
  else { p -= 2 * hw; _ring.x = -hw; _ring.y = hh - p; }
  _ring.x += Player.x; _ring.y += Player.y;
  return _ring;
}

function spawnOnRing(type) {
  const p = ringPoint(40 + Math.random() * 60);
  return spawnEnemy(type, p.x, p.y);
}

function spawnSwarm(type, n) {
  const p = ringPoint(80);
  const cx = p.x, cy = p.y;
  for (let k = 0; k < n; k++) {
    const a = Math.random() * 6.283, d = Math.random() * 50;
    spawnEnemy(type, cx + Math.cos(a) * d, cy + Math.sin(a) * d);
  }
}

// Debug: riempie lo schermo di nemici per il test di performance.
function debugSpawn(n) {
  for (let k = 0; k < n; k++) {
    const p = ringPoint(Math.random() * 300);
    spawnEnemy(pickEnemyType(200), p.x, p.y);
  }
}
