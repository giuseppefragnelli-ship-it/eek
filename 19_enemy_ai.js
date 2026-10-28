'use strict';
// js/19_enemy_ai.js — cacciatori, notte, updateEnemies (IA + separazione), proiettili nemici

// ---------------------------------------------------------------------------
// CACCIATORI e NOTTE (gestiti dallo Spawner)
// ---------------------------------------------------------------------------
function updateNight() {
  const t = G.time;
  let night = false;
  if (t >= NIGHT.forever) {
    night = true;
    if (!G.eternal) { G.eternal = true; UI.toast('Nox aeterna', '', 3, true); Sfx.play('night'); }
  } else if (t >= NIGHT.start) night = ((t - NIGHT.start) % NIGHT.cycle) >= NIGHT.cycle - NIGHT.nightLen;
  if (night !== G.night) {
    G.night = night;
    if (night) { UI.toast('Nox', '', 2); Sfx.play('night'); }
    else UI.toast('Aurora', '', 2);
  }
  // il buio arriva e se ne va in NIGHT.fade secondi (lo usa solo il disegno)
  const k = CFG.DT / NIGHT.fade;
  G.nightK = night ? Math.min(1, G.nightK + k) : Math.max(0, G.nightK - k);
}

// Debug: evoca subito il prossimo boss (B): Flegiàs, poi il trio del minuto 10
function debugBoss() {
  if (Boss.active) return;
  if (!Boss.spawned1) { Boss.warned1 = true; spawnBoss(ET.boss); }
  else if (!Boss.spawnedTrio) { Boss.warnedTrio = true; spawnBossTrio(); }
  else spawnBoss(ET.boss3);
}

function updateEnemies(dt) {
  const E = Enemies, n = E.count;
  const X = E.x, Y = E.y, R = E.r;
  const px = Player.x, py = Player.y;
  const farX = G.viewW * 0.5 + 360, farY = G.viewH * 0.5 + 360;
  const kbDecay = Math.exp(-10 * dt);
  const maxN = CFG.SEPARATION_MAX_NEIGHBORS;
  const slowFactor = G.slowFactor;
  const nightSpd = G.night ? NIGHT.speedMult : 1;
  const FOSSOR_T = ET.fossor, ELITE_T = ET.elite, SPITTER_T = ET.spitter, TOXIC_T = ET.toxic, GHOST_T = ET.ghost, LUPA_T = ET.lupa, FURIA_T = ET.furia, hasObs = Obs.n > 0;
  const nearX = G.viewW * 0.6, t = G.time;
  const island = !!G.map.isle, isl2 = island ? (G.map.isle.min - CFG.MAX_ENEMY_R) * (G.map.isle.min - CFG.MAX_ENEMY_R) : 0;
  // CALORE: la separazione (ogni slime controlla i vicini) era quasi tutto il costo della simulazione.
  // Ora si calcola a turni: metà degli slime a ogni passo, un quarto per quelli fuori schermo.
  const tick = G.sepTick = ((G.sepTick | 0) + 1) & 1023, farSepX = G.viewW * 0.55, farSepY = G.viewH * 0.55;

  for (let i = 0; i < n; i++) {
    if (E.alive[i] === 0) continue;
    if (E.flash[i] > 0) E.flash[i] -= dt;
    if (E.atkCd[i] > 0) E.atkCd[i] -= dt;
    if (E.orbCd[i] > 0) E.orbCd[i] -= dt;
    if (E.big[i] !== 0) {
      updateBoss(i, dt);
      if (island && E.alive[i] !== 0) { const c = islandClamp(X[i], Y[i], R[i] * 0.4); X[i] = c.x; Y[i] = c.y; }
      continue;
    }
    let spd = E.speed[i] * nightSpd;
    if (E.slowT[i] > 0) { E.slowT[i] -= dt; spd *= slowFactor; }

    let dx = px - X[i], dy = py - Y[i];

    // troppo lontano (il player l'ha seminato): riappare dalla parte opposta, appena fuori schermo
    if (dx > farX || dx < -farX || dy > farY || dy < -farY) {
      const p = ringPoint(40);
      // sceglie il lato verso cui il player si sta muovendo, se si muove
      if (Player.moving) {
        p.x = px + Input.ax * (G.viewW * 0.5 + 40) + (Math.random() - 0.5) * G.viewW * 0.6 * Math.abs(Input.ay);
        p.y = py + Input.ay * (G.viewH * 0.5 + 40) + (Math.random() - 0.5) * G.viewH * 0.6 * Math.abs(Input.ax);
      }
      if (island) { const q = islandSpawn(p.x, p.y); p.x = q.x; p.y = q.y; }
      X[i] = E.px[i] = p.x; Y[i] = E.py[i] = p.y;
      continue;
    }

    // inseguimento
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    let vx = (dx / d) * spd, vy = (dy / d) * spd;

    // Cacciatore (e Lupa, più piccola): insegue -> preavviso (fermo, rosso) -> carica in linea retta
    if (E.type[i] === ELITE_T || E.type[i] === LUPA_T) {
      const C = E.type[i] === ELITE_T ? ELITE : LUPA;
      E.aiT[i] -= dt;
      const st = E.aiS[i];
      if (st === 0) {
        if (E.aiT[i] <= 0 && d < G.viewW * 0.6) { E.aiS[i] = 1; E.aiT[i] = C.tell; }
      } else if (st === 1) {
        vx = vy = 0;
        E.ddx[i] = dx / d; E.ddy[i] = dy / d;
        if (E.aiT[i] <= 0) { E.aiS[i] = 2; E.aiT[i] = C.dashTime; }
      } else {
        vx = E.ddx[i] * C.dashSpeed * nightSpd; vy = E.ddy[i] * C.dashSpeed * nightSpd;
        if (E.aiT[i] <= 0) { E.aiS[i] = 0; E.aiT[i] = C.chaseTime * (0.7 + Math.random() * 0.6); }
      }
    }

    // Arciere: tiene le distanze, poi si ferma e tende l'arco (aiS = 1, mira in ddx/ddy: segue te, poi si blocca)
    // e scocca una freccia sola, grossa e letale. Il disegno mostra la linea di mira (Render.draw).
    else if (E.type[i] === SPITTER_T) {
      E.aiT[i] -= dt;
      if (E.aiS[i] === 1) {
        vx = vy = 0;
        if (E.aiT[i] > SPIT.lock) { E.ddx[i] = dx / d; E.ddy[i] = dy / d; }
        if (E.aiT[i] <= 0) {
          E.aiS[i] = 0; E.aiT[i] = SPIT.cd * (0.8 + Math.random() * 0.4);
          spawnEShot(4, X[i], Y[i], E.ddx[i], E.ddy[i], SPIT.speed, E.dmg[i] * SPIT.dmgMult * (G.night ? NIGHT.dmgMult : 1));
          if (d < nearX) Sfx.play('spit');
        }
      } else {
        if (d < SPIT.keepAway) { vx = -vx * 0.6; vy = -vy * 0.6; }
        else if (d < SPIT.range * 0.85) { vx *= 0.15; vy *= 0.15; }
        if (E.aiT[i] <= 0 && d < SPIT.range) { E.aiS[i] = 1; E.aiT[i] = SPIT.tell; E.ddx[i] = dx / d; E.ddy[i] = dy / d; }
      }
    }

    // Furia (ventaglio di 3 fiammate): tiene le distanze e spara
    else if (E.type[i] === FURIA_T) {
      const C = FURIA;
      if (d < C.keepAway) { vx = -vx * 0.6; vy = -vy * 0.6; }
      else if (d < C.range * 0.85) { vx *= 0.15; vy *= 0.15; }
      E.aiT[i] -= dt;
      if (E.aiT[i] <= 0 && d < C.range) {
        E.aiT[i] = C.cd * (0.8 + Math.random() * 0.4);
        const dm = E.dmg[i] * (G.night ? NIGHT.dmgMult : 1), ux = dx / d, uy = dy / d;
        for (let k = -1; k <= 1; k++) {
          const a = k * C.spread, ca = Math.cos(a), sa = Math.sin(a);
          spawnEShot(3, X[i], Y[i], ux * ca - uy * sa, ux * sa + uy * ca, C.speed, dm);
        }
        if (d < nearX) Sfx.play('spit');
      }
    }

    // Slime Velenoso: lascia una pozza tossica dove passa (solo vicino a te)
    else if (E.type[i] === TOXIC_T) {
      E.aiT[i] -= dt;
      if (E.aiT[i] <= 0) {
        E.aiT[i] = TOXIC.every * (0.85 + Math.random() * 0.3);
        if (d < nearX) spawnHazard(X[i], Y[i], TOXIC.r, TOXIC.life, TOXIC.dmg * CFG.enemyDmgMult(t) * G.diff.dmg * G.map.dmg);
      }
    }

    // Spettro: ondeggia, attraversa le colonne e ogni tanto "salta" verso di te
    else if (E.type[i] === GHOST_T) {
      const w = Math.sin(t * 3 + E.phase[i]) * GHOST.wave;
      const ux = dx / d, uy = dy / d;
      vx = (ux - uy * w) * spd; vy = (uy + ux * w) * spd;
      E.aiT[i] -= dt;
      if (E.aiT[i] <= 0 && d > 70 && d < nearX) {
        E.aiT[i] = GHOST.blinkEvery * (0.8 + Math.random() * 0.4);
        spawnFx(FXK.PUFF, X[i], Y[i], 0.3, 16);
        const j = Math.min(GHOST.blinkDist, d - 50);
        X[i] += ux * j; Y[i] += uy * j; E.px[i] = X[i]; E.py[i] = Y[i];
        spawnFx(FXK.PUFF, X[i], Y[i], 0.3, 16);
      }
    }

    // Scavatore: si avvicina, si ferma a scavare (aiS = 1, sbuffi di terra) e apre un buco sotto di te
    else if (E.type[i] === FOSSOR_T) {
      E.aiT[i] -= dt;
      if (E.aiS[i] === 1) {
        vx = vy = 0;
        if (((t * 8 + i) | 0) % 3 === 0 && d < nearX) spawnFx(FXK.PUFF, X[i] + (Math.random() - 0.5) * 20, Y[i] + 8, 0.3, 8);
        if (E.aiT[i] <= 0) {
          E.aiS[i] = 0; E.aiT[i] = FOSSOR.cd * (0.8 + Math.random() * 0.4);
          addPit(px + Input.ax * FOSSOR.lead, py + Input.ay * FOSSOR.lead, E.dmg[i] / ENEMY_DEFS[FOSSOR_T].dmg);
        }
      } else if (E.aiT[i] <= 0 && d < FOSSOR.range) { E.aiS[i] = 1; E.aiT[i] = FOSSOR.dig; }
    }

    // Gelo / Flagello: rallentato o fermo
    if (E.frz[i] > 0) { E.frz[i] -= dt; vx *= E.frzM[i]; vy *= E.frzM[i]; }

    // separazione: spinge via dai vicini sovrapposti (pesata sulla massa)
    const ri = R[i], mi = E.mass[i];
    const offScreen = dx > farSepX || dx < -farSepX || dy > farSepY || dy < -farSepY;
    const sepNow = ((i + tick) & (offScreen ? 3 : 1)) === 0;
    const c = sepNow ? Grid.query(X[i], Y[i], ri + 16, QBUF_SEP) : 0;
    let sx = 0, sy = 0, checked = 0;
    for (let k = 0; k < c && checked < maxN; k++) {
      const j = QBUF_SEP[k];
      if (j === i || E.alive[j] === 0) continue;
      checked++;
      const ox = X[i] - X[j], oy = Y[i] - Y[j];
      const rr = ri + R[j];
      const d2 = ox * ox + oy * oy;
      if (d2 >= rr * rr) continue;
      if (d2 < 0.0001) { sx += Math.random() - 0.5; sy += Math.random() - 0.5; continue; }
      const dd = Math.sqrt(d2);
      const push = (rr - dd) / dd * (E.mass[j] / (mi + E.mass[j]));
      sx += ox * push; sy += oy * push;
    }

    X[i] += vx * dt + sx * 0.5 + E.kx[i] * dt;
    Y[i] += vy * dt + sy * 0.5 + E.ky[i] * dt;
    E.kx[i] *= kbDecay; E.ky[i] *= kbDecay;
    // ostacoli: gli slime ci scivolano attorno
    if (hasObs && E.type[i] !== GHOST_T && !(offScreen && ((i + tick) & 1))) { const pp = pushOutOfObstacles(X[i], Y[i], ri * 0.8); if (pp.hit) { X[i] = pp.x; Y[i] = pp.y; } }
    // Sicilia: anche i dannati restano a riva (il confronto veloce scarta chi è lontano dal mare)
    if (island && X[i] * X[i] + Y[i] * Y[i] > isl2) { const c = islandClamp(X[i], Y[i], ri); X[i] = c.x; Y[i] = c.y; }
  }
}

// ---------------------------------------------------------------------------
// BUCHI E BRACCIA (Scavatore): array fissi. t = tempo dall'apertura; il braccio esce a FOSSOR.tell,
// resta su FOSSOR.up e rientra in 0.35 s. mult = forza (il danno segue quello dello Scavatore: tempo, mappa, notte...).
// hit = già colpito (un colpo per braccio).
// ---------------------------------------------------------------------------
const Pits = { max: 24, n: 0, x: new Float32Array(24), y: new Float32Array(24), t: new Float32Array(24), mult: new Float32Array(24), hit: new Uint8Array(24), side: new Int8Array(24) };
const PIT_END = FOSSOR.tell + FOSSOR.up + 0.35;
function addPit(x, y, mult) {
  const P = Pits;
  if (P.n >= P.max) return;
  if (G.map.isle) { const c = islandClamp(x, y, FOSSOR.r); x = c.x; y = c.y; }
  const k = P.n++;
  P.x[k] = x; P.y[k] = y; P.t[k] = 0; P.mult[k] = mult; P.hit[k] = 0; P.side[k] = Math.random() < 0.5 ? -1 : 1;
  Sfx.play('spit');
}
function updatePits(dt) {
  const P = Pits, F = FOSSOR;
  for (let k = 0; k < P.n; k++) {
    const was = P.t[k];
    P.t[k] += dt;
    if (was < F.tell && P.t[k] >= F.tell) { addShake(3); Sfx.play('boom'); spawnFx(FXK.PUFF, P.x[k], P.y[k], 0.4, 26); }
    if (P.t[k] >= F.tell + F.rise * 0.5 && P.t[k] < F.tell + F.up && !P.hit[k]) {   // colpisce quando il braccio è quasi fuori
      const dx = Player.x - P.x[k], dy = Player.y - P.y[k], rr = F.r + Player.r;
      if (dx * dx + dy * dy < rr * rr) { P.hit[k] = 1; Player.hurt(F.dmg * P.mult[k] * CFG.enemyDmgMult(G.time) * G.diff.dmg * G.map.dmg); }
    }
    if (P.t[k] >= PIT_END) {
      P.n--; P.x[k] = P.x[P.n]; P.y[k] = P.y[P.n]; P.t[k] = P.t[P.n]; P.mult[k] = P.mult[P.n]; P.hit[k] = P.hit[P.n]; P.side[k] = P.side[P.n]; k--;
    }
  }
}

// ---------------------------------------------------------------------------
// PROIETTILI DEI NEMICI
// kind 0 = palla di melma (non più usata dagli arcieri), 1 = proiettile del guardiano maggiore,
// 2 = pozza di veleno, 3 = fiammata della Furia, 4 = freccia dell'Arciere (grossa, veloce, fa male)
// ---------------------------------------------------------------------------
function bossShotDmg() { return BOSS3.bulletDmg * CFG.enemyDmgMult(G.time) * G.diff.dmg * G.map.dmg; }

function spawnEShot(kind, x, y, dx, dy, speed, dmg) {
  const i = EShots.spawn();
  if (i < 0) return;
  const S = EShots;
  S.alive[i] = 1; S.kind[i] = kind;
  S.x[i] = S.px[i] = x; S.y[i] = S.py[i] = y;
  S.vx[i] = dx * speed; S.vy[i] = dy * speed;
  S.life[i] = kind === 1 ? 6 : kind === 4 ? SPIT.life : 3.2; S.dmg[i] = dmg; S.r[i] = kind === 1 || kind === 4 ? 7 : 6;
}

// pozza di veleno (ferma, fa male finché ci stai sopra; i colpi arrivano a intervalli grazie all'invulnerabilità)
function spawnHazard(x, y, r, life, dmg) {
  const i = EShots.spawn();
  if (i < 0) return;
  const S = EShots;
  S.alive[i] = 1; S.kind[i] = 2;
  S.x[i] = S.px[i] = x; S.y[i] = S.py[i] = y;
  S.life[i] = life; S.dmg[i] = dmg; S.r[i] = r;
}

function updateEShots(dt) {
  const S = EShots, px = Player.x, py = Player.y, pr = Player.r;
  for (let i = 0; i < S.count; i++) {
    if (S.alive[i] === 0) continue;
    if ((S.life[i] -= dt) <= 0) { S.alive[i] = 0; continue; }
    if (S.kind[i] === 2) {
      const dx = S.x[i] - px, dy = S.y[i] - py, rr = S.r[i] + pr * 0.5;
      if (Player.invT <= 0 && dx * dx + dy * dy < rr * rr) { Player.hurt(S.dmg[i]); if (G.state !== 'play') return; }
      continue;
    }
    S.x[i] += S.vx[i] * dt; S.y[i] += S.vy[i] * dt;
    if (Obs.n > 0 && pointInObstacle(S.x[i], S.y[i])) { S.alive[i] = 0; spawnFx(FXK.PUFF, S.x[i], S.y[i], 0.2, 8); continue; } // le colonne fanno da riparo
    const dx = S.x[i] - px, dy = S.y[i] - py, rr = S.r[i] + pr - 2, d2 = dx * dx + dy * dy;
    if (d2 < rr * rr) {
      S.alive[i] = 0;
      if (S.kind[i] === 4 && Player.teleInvT > 0) countDodge(S.x[i], S.y[i]);   // passata attraverso durante il teletrasporto: schivata
      Player.hurt(S.dmg[i]);
      if (G.state !== 'play') {
        // ucciso da una freccia: il conto per il teletrasporto riparte da zero
        if (S.kind[i] === 4 && !Player.tele && Save.data.arrowStreak > 0) { Save.data.arrowStreak = 0; Save.write(); }
        return;
      }
      continue;
    }
    // FRECCE SCHIVATE: una freccia che ti passa vicino e poi si allontana senza colpirti
    if (S.kind[i] === 4 && S.near[i] !== 2) {
      if (S.near[i] === 0) { if (d2 < DODGE.r * DODGE.r) S.near[i] = 1; }
      else if (dx * S.vx[i] + dy * S.vy[i] > 0) { S.near[i] = 2; countDodge(S.x[i], S.y[i]); }
    }
  }
}

// una freccia schivata. Senza teletrasporto: conto per sbloccarlo (Save.data.arrowStreak, TELE_UNLOCK).
// Col teletrasporto: conto per sempre (Save.data.dodges); a TELE_UP.dodges il teletrasporto si potenzia
function countDodge(x, y) {
  if (G.cheat) return;
  spawnFx(FXK.GLINT, x, y, 0.3, 10);
  if (!Player.tele) {
    const s = ++Save.data.arrowStreak;
    if (s >= TELE_UNLOCK.arrows) {
      Save.data.unlocks.teleport = true; Save.write();
      Player.tele = true; Player.teleCd = 0; document.body.classList.add('has-tele');
      spawnFx(FXK.RING, Player.x, Player.y, 0.6, 160);
      Sfx.play('quest');
      UI.toast(UNLOCKS.teleport.name, '', 4, true);
    } else if (s % TELE_UNLOCK.toastEvery === 0) UI.toast('Frecce schivate', s + ' / ' + TELE_UNLOCK.arrows, 2);
    return;
  }
  const d = ++Save.data.dodges;
  if (d === TELE_UP.dodges) {
    Player.teleUp = true;
    Save.write();
    spawnFx(FXK.RING, Player.x, Player.y, 0.6, 160);
    Sfx.play('quest');
    UI.toast('TELE+', '', 4, true);
  } else if (d < TELE_UP.dodges && d % 10 === 0) {
    UI.toast('Frecce schivate', d + ' / ' + TELE_UP.dodges, 2);
  }
  UI.refreshDodges();
}
