'use strict';
// js/16_player.js — Player: movimento, statistiche, danno, XP, gemme

// ============================================================================
// PLAYER — movimento, statistiche (base + passive), danno, esperienza, monete.
// ============================================================================

const Player = {
  x: 0, y: 0, px: 0, py: 0,
  r: CFG.player.r,
  hp: 100, maxHp: 100,
  speed: CFG.player.speed,
  magnet: CFG.player.magnet,
  pickup: CFG.player.pickup,
  regen: 0,
  dmgMult: 1, cdMult: 1, areaMult: 1, xpMult: 1, coinMult: 1,
  armor: 0,        // danno tolto a ogni colpo (Scudo + Lorica)
  amount: 0,       // proiettili in più per tutte le armi (Gemelli)
  sprite: 'player',
  facing: 1,
  view: 'f',       // vista dello sprite animato: f fronte, s lato (3/4), b retro
  idleT: 0,        // da quanto è fermo (dopo un attimo torna a guardare verso di te)
  dirX: 1, dirY: 0,     // ultima direzione di movimento (per il fendente dei pugnali)
  lungeT: 0, lungeX: 0, lungeY: 0,
  moving: false,
  hurtT: 0,
  invT: 0,         // invulnerabilità residua dopo un colpo
  slowT: 0,        // gambe congelate (Traditore Gelido)
  throwT: 0,       // fotogramma del lancio (kunai)
  dashT: 0, dashCd: 0, dashX: 1, dashY: 0,   // SCATTO: durata residua, ricarica, direzione
  tele: false, teleCd: 0,                    // TELETRASPORTO: sbloccato (UNLOCKS.teleport), ricarica
  trailN: 0, trailX: new Float32Array(8), trailY: new Float32Array(8), trailT: new Float32Array(8), trailF: new Int8Array(8),
  level: 1, xp: 0, xpNext: CFG.xpToNext(1),
  weapons: [],     // { id, def, level, evolved, timer, burst, burstT, angle, targets }
  passives: [],    // { id, def, level }

  reset() {
    this.x = this.y = this.px = this.py = 0;
    this.facing = 1; this.view = 'f'; this.idleT = 0; this.hurtT = 0; this.invT = 0;
    this.dirX = 1; this.dirY = 0; this.lungeT = 0; this.slowT = 0; this.throwT = 0;
    this.dashT = 0; this.dashCd = 0; this.trailN = 0;
    this.tele = Save.unlocked('teleport'); this.teleCd = 0;
    this.level = 1; this.xp = 0; this.xpNext = CFG.xpToNext(1);
    this.weapons.length = 0;
    this.passives.length = 0;
    const ch = CHARACTERS[Save.data.char] || CHARACTERS.eek;
    this.sprite = ch.sprite;
    this.anim = ch.anim || null;      // prefisso dei fotogrammi animati (solo Eek per ora)
    this.kunai = !!ch.kunai;
    this.maxHp = 0;
    this.recalcStats();
    this.hp = this.maxHp;
    addWeapon(ch.weapon);
    // arma dell'Armaiolo: extra, fuori dalle 6 slot, livello = fabbro
    const gid = Save.gearId();
    if (gid) { const w = addWeapon(gid); w.level = Save.itemLevel(gid) + 1; }
  },

  passiveLevel(id) {
    for (let i = 0; i < this.passives.length; i++) if (this.passives[i].id === id) return this.passives[i].level;
    return 0;
  },

  // Statistiche finali = base * passive. Chiamata solo quando cambia qualcosa (non a ogni frame).
  recalcStats() {
    const P = PASSIVE_DEFS, L = (id) => this.passiveLevel(id) * Save.masteryMult(id), O = (k) => Save.omen(k);
    const oldMax = this.maxHp;
    const ch = CHARACTERS[Save.data.char] || CHARACTERS.eek;
    // passive della partita + oggetti del negozio + personaggio
    this.dmgMult  = 1 + P.might.per * L('might') + ch.dmg + O('dmg');
    this.speed    = CFG.player.speed * (1 + P.speed.per * L('speed') + Save.itemValue('boots') + ch.speed + O('speed'));
    this.maxHp    = CFG.player.hp + P.maxhp.per * L('maxhp') + Save.itemValue('necklace') + ch.hp + O('hp');
    this.armor    = Save.itemValue('shield') + P.armor.per * L('armor') + O('armor');
    this.regen    = P.regen.per * L('regen') + (ch.regen || 0) + O('regen');
    this.magnet   = CFG.player.magnet * (1 + P.magnet.per * L('magnet') + O('magnet'));
    this.xpMult   = 1 + P.xp.per * L('xp') + (ch.xp || 0) + Save.itemValue('ring') + O('xp');
    this.cdMult   = Math.max(0.4, 1 - P.cooldown.per * L('cooldown') - O('cd'));
    this.areaMult = 1 + (ch.area || 0) + P.area.per * L('area') + O('area');
    this.amount   = P.amount.per * L('amount');
    this.dodge    = Math.min(0.6, (ch.dodge || 0) + Save.itemValue('cloak') + O('dodge'));
    this.coinMult = 1 + P.greed.per * L('greed') + O('coin');
    if (this.maxHp > oldMax && oldMax > 0) this.hp += this.maxHp - oldMax; // la vita guadagnata si riempie subito
  },

  update(dt) {
    this.px = this.x; this.py = this.y;
    const ax = Input.ax, ay = Input.ay;
    this.moving = ax !== 0 || ay !== 0;
    let spd = this.speed;
    if (this.slowT > 0) { this.slowT -= dt; spd *= FROST.slow; }
    if (this.throwT > 0) this.throwT -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.teleCd > 0) this.teleCd -= dt;
    // copie sbiadite dello scatto: invecchiano
    for (let k = 0; k < this.trailN; k++) this.trailT[k] -= dt;
    while (this.trailN > 0 && this.trailT[0] <= 0) { this.trailN--; for (let k = 0; k < this.trailN; k++) { this.trailX[k] = this.trailX[k + 1]; this.trailY[k] = this.trailY[k + 1]; this.trailT[k] = this.trailT[k + 1]; this.trailF[k] = this.trailF[k + 1]; } }
    if (this.dashT > 0) {
      // SCATTO: corsa velocissima in linea retta
      this.dashT -= dt;
      this.x += this.dashX * DASH.speed * dt;
      this.y += this.dashY * DASH.speed * dt;
      if (this.trailN < 8) { const k = this.trailN++; this.trailX[k] = this.x; this.trailY[k] = this.y; this.trailT[k] = 0.3; this.trailF[k] = this.facing; }
      if (this.dashT <= 0) this.endDash();
    } else {
      this.x += ax * spd * dt;
      this.y += ay * spd * dt;
    }
    if (this.moving) { const l = Math.sqrt(ax * ax + ay * ay); this.dirX = ax / l; this.dirY = ay / l; }
    // ostacoli della mappa: ci scivoli attorno
    if (Obs.n > 0) { const pp = pushOutOfObstacles(this.x, this.y, this.r); if (pp.hit) { this.x = pp.x; this.y = pp.y; } }
    if (ax > 0) this.facing = 1; else if (ax < 0) this.facing = -1;
    // vista: conta l'asse dominante (in diagonale prevale il lato, così si vede la corsa di profilo)
    if (this.moving || this.dashT > 0) {
      const mx = this.moving ? ax : this.dashX, my = this.moving ? ay : this.dashY;
      this.view = Math.abs(my) > Math.abs(mx) * 1.3 ? (my > 0 ? 'f' : 'b') : 's';
      this.idleT = 0;
    } else if ((this.idleT += dt) > 0.6) this.view = 'f';   // fermo: si gira verso di te
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.invT > 0) this.invT -= dt;
    if (this.regen > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
  },

  // SCATTO (Spazio / doppio tocco)
  tryDash() {
    if (this.dashCd > 0 || this.dashT > 0 || G.state !== 'play') return;
    const ax = Input.ax, ay = Input.ay, l = Math.sqrt(ax * ax + ay * ay);
    this.dashX = l > 0 ? ax / l : this.dirX; this.dashY = l > 0 ? ay / l : this.dirY;
    this.dashT = DASH.time;
    this.dashCd = (this.kunai ? DASH.cdEek : DASH.cd) * this.cdMult;
    this.invT = Math.max(this.invT, DASH.iframes);
    spawnFx(FXK.PUFF, this.x, this.y + 6, 0.3, 16);
    Sfx.play('dash');
  },
  // TELETRASPORTO (E/Q o il tasto TELE): sparisci e ricompari TELEPORT.dist più in là, dove stai andando
  // (fermo: nell'ultima direzione). Scavalca i nemici; se atterri su un ostacolo lo step dopo ti spinge fuori.
  tryTeleport() {
    if (!this.tele || this.teleCd > 0 || G.state !== 'play') return;
    const ax = Input.ax, ay = Input.ay, l = Math.sqrt(ax * ax + ay * ay);
    const dx = l > 0 ? ax / l : this.dirX, dy = l > 0 ? ay / l : this.dirY, D = TELEPORT.dist;
    spawnFx(FXK.PUFF, this.x, this.y + 4, 0.35, 18);
    // copie sbiadite lungo il salto (la stessa scia dello scatto)
    this.trailN = 0;
    for (let k = 0; k < TELEPORT.ghosts && k < 8; k++) {
      const f = k / TELEPORT.ghosts;
      this.trailX[k] = this.x + dx * D * f; this.trailY[k] = this.y + dy * D * f;
      this.trailT[k] = 0.12 + 0.2 * f; this.trailF[k] = this.facing;
      this.trailN++;
    }
    this.dashT = 0;
    this.x += dx * D; this.y += dy * D;
    this.px = this.x; this.py = this.y;   // niente interpolazione: sparisce e ricompare
    this.dirX = dx; this.dirY = dy;
    if (dx > 0.2) this.facing = 1; else if (dx < -0.2) this.facing = -1;
    this.teleCd = TELEPORT.cd * this.cdMult;
    this.invT = Math.max(this.invT, TELEPORT.iframes);
    spawnFx(FXK.RING, this.x, this.y, 0.3, 36);
    spawnFx(FXK.PUFF, this.x, this.y + 4, 0.3, 14);
    Sfx.play('tele');
  },
  endDash() {
    if (!this.kunai) return;
    // Eek: ventaglio di kunai nella direzione dello scatto
    const a0 = Math.atan2(this.dashY, this.dashX), n = DASH.kunai, w = findWeapon('dart');
    G.src = w;
    for (let k = 0; k < n; k++) {
      const a = a0 + (k - (n - 1) / 2) * DASH.spread;
      spawnProjectile(PK.SALT, this.x, this.y, Math.cos(a), Math.sin(a), 560, DASH.kunaiDmg * this.dmgMult, 6, 1, 0.8, 2, 60);
    }
    G.src = null;
    this.throwT = 0.18;
    Sfx.play('bow');
  },

  // fotogramma da disegnare (animazione del personaggio)
  frame(rt) {
    if (!this.anim) return SPR.cache[this.sprite] || SPR.cache.char_eek;
    const C = SPR.cache, b = this.anim, v = this.view === 'f' ? b : b + '_' + this.view;
    const f = (s) => C[v + s] || C[b + s] || C[b];   // se manca la vista, ripiega sul fronte
    if (this.throwT > 0) return f('_t');
    if (this.moving || this.dashT > 0) return f('_r' + (((rt * 9) | 0) & 3));
    const i = ((rt * 2.6) | 0) & 3;                    // respiro lento su 4 fotogrammi
    return i ? f('_i' + i) : (C[v] || C[b]);
  },

  hurt(dmg) {
    if (G.god || G.victory || this.invT > 0) return;
    // abilità di Eek: schivata (breve invulnerabilità, nessun danno)
    if (this.dodge > 0 && Math.random() < this.dodge) {
      this.invT = 0.2;
      spawnFx(FXK.PUFF, this.x, this.y - 4, 0.3, 14);
      Sfx.play('dodge');
      return;
    }
    this.hp -= Math.max(1, dmg - this.armor);
    this.hurtT = 0.15;
    this.invT = CFG.player.iframes;
    addShake(3);
    G.hitStop = Math.max(G.hitStop, 0.045);
    Sfx.play('hurt');
    if (this.hp <= 0) { this.hp = 0; onPlayerDeath(); }
  },

  gainXp(v) {
    this.xp += v * this.xpMult;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = CFG.xpToNext(this.level);
      if (G.pendingLevels === 0) levelUpWave();
      G.pendingLevels++;
    }
  },

  gainCoins(n) {
    G.runCoins += n;
    Save.addCoins(n);
  },
};

// Danno da contatto: i nemici sovrapposti al player colpiscono, ognuno col suo cooldown.
function updatePlayerContacts(dt) {
  if (Player.invT > 0) return; // durante l'invulnerabilità nessuno colpisce
  const E = Enemies;
  const nightDmg = G.night ? NIGHT.dmgMult : 1;
  for (let q = 0; q < Boss.n; q++) {
    const b = Boss.list[q];
    if (E.alive[b] !== 0) {
      const dx = E.x[b] - Player.x, dy = E.y[b] - Player.y, rr = E.r[b] * 0.85 + Player.r;
      if (dx * dx + dy * dy < rr * rr) { Player.hurt(E.dmg[b] * (Boss.slots[q].state === 'dash' ? 1.5 : 1) * nightDmg); return; }
    }
  }
  const n = Grid.query(Player.x, Player.y, Player.r + CFG.MAX_ENEMY_R, QBUF_PLAYER);
  for (let k = 0; k < n; k++) {
    const i = QBUF_PLAYER[k];
    if (E.alive[i] === 0 || E.atkCd[i] > 0) continue;
    const dx = E.x[i] - Player.x, dy = E.y[i] - Player.y, rr = E.r[i] + Player.r - 3;
    if (dx * dx + dy * dy < rr * rr) {
      Player.hurt(E.dmg[i] * nightDmg * (E.aiS[i] === 2 ? 1.4 : 1)); // la carica del Cacciatore fa più male
      if (E.type[i] === ET.gelido && Player.invT > 0.3) Player.slowT = FROST.slowT;  // ti congela (se il colpo è arrivato)
      E.atkCd[i] = CFG.contactCooldown;
      return; // un colpo alla volta
    }
  }
}

function pickUp(i) {
  const M = Gems, k = M.kind[i];
  M.alive[i] = 0;
  if (k === GK.XP) { Player.gainXp(M.val[i]); Sfx.play('gem'); }
  else if (k === GK.COIN) { Player.gainCoins(M.val[i]); Sfx.play('coin'); }
  else if (k === GK.CHEST) {
    // forziere: si apre a fine step (val = numero di potenziamenti garantiti, 0 = a sorte)
    G.chestQueue.push(M.val[i]);
    Sfx.play('chest');
  } else if (k === GK.HEAL) {
    Sfx.play('heal');
    Player.hp = Math.min(Player.maxHp, Player.hp + M.val[i]);
    const n = spawnFx(FXK.NUM, Player.x, Player.y - 20, 0.9, 1);
    if (n >= 0) FX.val[n] = M.val[i];
  } else if (k === GK.STONE) {
    Save.data.stones = (Save.data.stones || 0) + 1; Save.write();
    Sfx.play('chest');
    UI.toast('Oggetto trovato', 'Pietra del Fabbro', 3);
  } else if (k === GK.VACUUM) {
    // attira tutte le gemme XP e le monete della mappa
    for (let j = 0; j < M.count; j++) {
      if (M.alive[j] !== 0 && M.kind[j] <= GK.COIN && M.mag[j] === 0) { M.mag[j] = 1; M.spd[j] = 250; }
    }
    addShake(2);
    Sfx.play('magnet');
  }
}

// Oggetti a terra: XP e monete attirate dal magnete; cure e calamita vanno raccolte a piedi.
function updateGems(dt) {
  const M = Gems, px = Player.x, py = Player.y;
  const mag2 = Player.magnet * Player.magnet, pick2 = Player.pickup * Player.pickup;
  for (let i = 0; i < M.count; i++) {
    if (M.alive[i] === 0) continue;
    const dx = px - M.x[i], dy = py - M.y[i];
    const d2 = dx * dx + dy * dy;
    if (d2 < pick2) { pickUp(i); continue; }
    if (M.mag[i] === 0 && d2 < mag2 && M.kind[i] <= GK.COIN) { M.mag[i] = 1; M.spd[i] = -60; }
    if (M.mag[i] !== 0) {
      M.spd[i] += 900 * dt;
      const d = Math.sqrt(d2) || 1;
      const s = M.spd[i] * dt;
      if (s >= d) { M.x[i] = px; M.y[i] = py; }
      else { M.x[i] += (dx / d) * s; M.y[i] += (dy / d) * s; }
    }
  }
}

// Troppe gemme a terra: quelle fuori schermo (non già attirate) si fondono in una sola.
function mergeFarGems() {
  const M = Gems;
  if (M.count < CFG.GEM_MERGE_AT) return;
  const fx = G.viewW * 0.5 + 60, fy = G.viewH * 0.5 + 60;
  let target = -1;
  for (let i = 0; i < M.count; i++) {
    if (M.alive[i] === 0 || M.kind[i] !== GK.XP || M.mag[i] !== 0) continue;
    const dx = M.x[i] - Player.x, dy = M.y[i] - Player.y;
    if (dx < fx && dx > -fx && dy < fy && dy > -fy) continue;
    if (target < 0) { target = i; continue; }
    M.val[target] += M.val[i];
    M.alive[i] = 0;
  }
}

// Level up: onda d'urto che allontana gli slime vicini + anello luminoso, poi (dopo un attimo) le carte
const QBUF_WAVE = new Int32Array(1024);
function levelUpWave() {
  G.lvlT = 0.32;
  spawnFx(FXK.RING, Player.x, Player.y, 0.45, 150);
  Sfx.play('level');
  const E = Enemies, n = Grid.query(Player.x, Player.y, 150 + CFG.MAX_ENEMY_R, QBUF_WAVE);
  for (let k = 0; k < n; k++) {
    const j = QBUF_WAVE[k];
    if (E.alive[j] === 0) continue;
    const dx = E.x[j] - Player.x, dy = E.y[j] - Player.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d > 150) continue;
    const f = (1 - d / 150) * 520 / E.mass[j];
    E.kx[j] += dx / d * f; E.ky[j] += dy / d * f;
  }
}
