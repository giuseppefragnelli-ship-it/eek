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

  reset() { this.acc = 0; this.swarmT = SPAWN.firstSwarm; this.eliteT = 0; this.eliteFirst = true; Boss.reset(); },

  // Fase 1: spawn continuo con rateo crescente + sciami periodici.
  // In fase 3 verrà sostituito dalla tabella delle ondate.
  update(dt) {
    const t = G.time;
    // boss del minuto 5
    if (!Boss.warned1 && t >= BOSS.warnAt) {
      Boss.warned1 = true;
      UI.toast('Avviso di sistema', 'Qualcosa di enorme si muove nel buio...', 6);
    }
    if (!Boss.spawned1 && Boss.main() === 0 && t >= BOSS.time) spawnBoss(ET.boss);
    // CUSTODE di una ricetta comprata dal Magister: uno alla volta (TRIAL)
    if (Boss.trials() === 0 && t >= Boss.trialT - TRIAL.warnBefore) {
      const key = Save.pendingRecipe();
      if (key) {
        if (!Boss.trialWarned) { Boss.trialWarned = true; UI.toast('Avviso di sistema', 'Il Magister ti mette alla prova: qualcuno custodisce una fusione...', 5); }
        if (t >= Boss.trialT && !spawnTrial(key)) Boss.trialT = t + 5;   // pieno di boss: riprova tra poco
      }
    }
    // VITTORIA al minuto 7: basta resistere
    if (!G.won && !G.victory) {
      if (!Boss.warnedWin && t >= WIN.warnAt) { Boss.warnedWin = true; UI.toast('Avviso di sistema', "Ancora un poco: l'uscita è vicina...", 5); }
      if (t >= WIN.time) winRun();
    }
    // solo se hai continuato: subito i due guardiani della mappa, al minuto 10 tutti e tre (e slime più forti)
    if (G.endless) {
      if (Boss.duoT > 0 && !Boss.spawnedDuo) {
        if (!Boss.warnedDuo && t >= Boss.duoT - DUO.warnBefore) { Boss.warnedDuo = true; UI.toast('Avviso di sistema', G.map.b3.warn, 5); }
        if (t >= Boss.duoT) spawnBossDuo();
      }
      if (!Boss.warnedTrio && t >= TRIO.warnAt) {
        Boss.warnedTrio = true;
        UI.toast('Avviso di sistema', 'La terra trema. Non ne arriva uno: ne arrivano tre.', 6);
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

    // Cacciatori dal minuto 4
    if (t >= ELITE.start) {
      this.eliteT -= dt;
      if (this.eliteT <= 0) {
        const mins = (t - ELITE.start) / 60;
        this.eliteT = Math.max(ELITE.minEvery, ELITE.every - mins * ELITE.faster);
        const n = t >= 660 ? 3 : t >= 480 ? 2 : 1;
        for (let k = 0; k < n; k++) spawnOnRing(ET.elite);
        if (this.eliteFirst) { this.eliteFirst = false; UI.toast('Avviso di sistema', 'Un Cacciatore ti ha fiutato.', 4); }
      }
    }
    updateNight();

    if (Enemies.count < SPAWN.maxAlive) {
      const mult = Boss.active ? BOSS.spawnMult : 1;
      this.acc += (SPAWN.baseRate + t * SPAWN.rateGrowth) * G.diff.spawn * mult * dt;
      while (this.acc >= 1) {
        this.acc -= 1;
        spawnOnRing(pickEnemyType(t));
      }
    }
    this.swarmT -= dt;
    if (this.swarmT <= 0) {
      this.swarmT = SPAWN.swarmEvery;
      spawnSwarm(ET.drop, Math.round((SPAWN.swarmSize[0] + Math.random() * (SPAWN.swarmSize[1] - SPAWN.swarmSize[0])) * Math.sqrt(G.diff.spawn) * G.map.swarm));
    }
  },
};

function pickEnemyType(t) {
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
