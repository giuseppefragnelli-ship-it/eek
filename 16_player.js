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
  tele: false, teleCd: 0,                    // TELETRASPORTO: sbloccato (UNLOCKS.teleport), ricarica
  teleUp: false,                             // teletrasporto potenziato (TELE_UP: 50 frecce schivate)
  teleInvT: 0,                               // invulnerabilità data dal teletrasporto (una freccia presa qui = schivata)
  magicPow: 1, magicCd: 1,                   // Magia della Locanda (abilità)
  skill: { ira: false, gelo: false },        // ABILITÀ sbloccate (SKILLS: vinci Dite / Cocito)
  skillCd: { ira: 0, gelo: 0 },              // ricarica residua
  trailN: 0, trailX: new Float32Array(8), trailY: new Float32Array(8), trailT: new Float32Array(8), trailF: new Int8Array(8),
  level: 1, xp: 0, xpNext: CFG.xpToNext(1),
  weapons: [],     // { id, def, level, evolved, timer, burst, burstT, angle, targets }
  passives: [],    // { id, def, level }

  reset() {
    this.x = this.y = this.px = this.py = 0;
    this.facing = 1; this.view = 'f'; this.idleT = 0; this.hurtT = 0; this.invT = 0;
    this.dirX = 1; this.dirY = 0; this.lungeT = 0; this.slowT = 0; this.throwT = 0;
    this.trailN = 0; this.teleInvT = 0; this.onBridge = false;
    this.tele = Save.unlocked('teleport'); this.teleCd = 0;
    this.teleUp = this.tele && Save.data.dodges >= TELE_UP.dodges;
    for (const id in SKILLS) { this.skill[id] = Save.skillOpen(id); this.skillCd[id] = 0; }
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
    // passive della partita + oggetti del negozio + personaggio + Locanda (T = TRAITS)
    const T = (id, k) => Save.trait(id, k);
    this.dmgMult  = 1 + P.might.per * L('might') + ch.dmg + O('dmg') + T('forza', 'dmg');
    this.speed    = CFG.player.speed * (1 + P.speed.per * L('speed') + Save.itemValue('boots') + ch.speed + O('speed'));
    this.maxHp    = CFG.player.hp + P.maxhp.per * L('maxhp') + Save.itemValue('necklace') + ch.hp + O('hp') + T('vita', 'hp');
    this.magicPow = 1 + T('magia', 'power');    // Magia: potenza delle abilità
    this.magicCd  = 1 - T('magia', 'cd');       // Magia: ricarica delle abilità
    this.armor    = Save.itemValue('shield') + P.armor.per * L('armor') + O('armor');
    this.regen    = P.regen.per * L('regen') + (ch.regen || 0) + O('regen');
    this.magnet   = CFG.player.magnet * (1 + P.magnet.per * L('magnet') + O('magnet'));
    this.xpMult   = 1 + P.xp.per * L('xp') + (ch.xp || 0) + Save.itemValue('ring') + O('xp');
    this.cdMult   = Math.max(0.4, 1 - P.cooldown.per * L('cooldown') - O('cd') - T('destrezza', 'cd'));
    this.areaMult = 1 + (ch.area || 0) + P.area.per * L('area') + O('area');
    this.amount   = P.amount.per * L('amount');
    this.dodge    = Math.min(0.6, (ch.dodge || 0) + Save.itemValue('cloak') + O('dodge') + T('destrezza', 'dodge'));
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
    if (this.teleCd > 0) this.teleCd -= dt;
    if (this.teleInvT > 0) this.teleInvT -= dt;
    if (this.skillCd.ira > 0) this.skillCd.ira -= dt;
    if (this.skillCd.gelo > 0) this.skillCd.gelo -= dt;
    // copie sbiadite del teletrasporto: invecchiano
    for (let k = 0; k < this.trailN; k++) this.trailT[k] -= dt;
    while (this.trailN > 0 && this.trailT[0] <= 0) { this.trailN--; for (let k = 0; k < this.trailN; k++) { this.trailX[k] = this.trailX[k + 1]; this.trailY[k] = this.trailY[k + 1]; this.trailT[k] = this.trailT[k + 1]; this.trailF[k] = this.trailF[k + 1]; } }
    this.x += ax * spd * dt;
    this.y += ay * spd * dt;
    if (this.moving) { const l = Math.sqrt(ax * ax + ay * ay); this.dirX = ax / l; this.dirY = ay / l; }
    // ostacoli della mappa: ci scivoli attorno
    if (Obs.n > 0) { const pp = pushOutOfObstacles(this.x, this.y, this.r); if (pp.hit) { this.x = pp.x; this.y = pp.y; } }
    // isole: il mare non si attraversa (nemmeno col teletrasporto: si atterra sulla spiaggia), tranne sul ponte
    if (G.map.isle) this.shore();
    // Goat (Sicilia): non la attraversi
    const gt = G.map.goat;
    if (gt) {
      const gx = this.x - gt.x, gy = this.y - gt.y, rr = gt.r + this.r, g2 = gx * gx + gy * gy;
      if (g2 < rr * rr) { const d = Math.sqrt(g2) || 1; this.x = gt.x + gx / d * rr; this.y = gt.y + gy / d * rr; }
    }
    if (ax > 0) this.facing = 1; else if (ax < 0) this.facing = -1;
    // vista: conta l'asse dominante (in diagonale prevale il lato, così si vede la corsa di profilo)
    if (this.moving) {
      this.view = Math.abs(ay) > Math.abs(ax) * 1.3 ? (ay > 0 ? 'f' : 'b') : 's';
      this.idleT = 0;
    } else if ((this.idleT += dt) > 0.6) this.view = 'f';   // fermo: si gira verso di te
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.invT > 0) this.invT -= dt;
    if (this.regen > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
  },

  // TELETRASPORTO (Spazio/E/Q o il tasto TELE): sparisci e ricompari TELEPORT.dist più in là, dove stai andando
  // (fermo: nell'ultima direzione). Scavalca i nemici; se atterri su un ostacolo lo step dopo ti spinge fuori.
  // Potenziato (TELE_UP, dopo 50 frecce schivate): più lontano, ricarica più breve e un'onda d'urto dove atterri.
  tryTeleport() {
    if (!this.tele || this.teleCd > 0 || G.state !== 'play') return;
    const T = this.teleUp ? TELE_UP : TELEPORT;
    const ax = Input.ax, ay = Input.ay, l = Math.sqrt(ax * ax + ay * ay);
    const dx = l > 0 ? ax / l : this.dirX, dy = l > 0 ? ay / l : this.dirY, D = T.dist * (1 + (this.magicPow - 1) * 0.5);   // Magia: un po' più lontano
    spawnFx(FXK.PUFF, this.x, this.y + 4, 0.35, 18);
    // copie sbiadite lungo il salto
    this.trailN = 0;
    for (let k = 0; k < T.ghosts && k < 8; k++) {
      const f = k / T.ghosts;
      this.trailX[k] = this.x + dx * D * f; this.trailY[k] = this.y + dy * D * f;
      this.trailT[k] = 0.12 + 0.2 * f; this.trailF[k] = this.facing;
      this.trailN++;
    }
    this.x += dx * D; this.y += dy * D;
    this.px = this.x; this.py = this.y;   // niente interpolazione: sparisce e ricompare
    this.dirX = dx; this.dirY = dy;
    if (dx > 0.2) this.facing = 1; else if (dx < -0.2) this.facing = -1;
    this.teleCd = this.teleCdMax();
    this.invT = Math.max(this.invT, T.iframes); this.teleInvT = T.iframes;
    spawnFx(FXK.RING, this.x, this.y, 0.3, 36);
    spawnFx(FXK.PUFF, this.x, this.y + 4, 0.3, 14);
    if (this.teleUp) {   // onda d'urto all'arrivo: danno e spinta a chi ti aspettava
      spawnFx(FXK.RING, this.x, this.y, 0.45, T.blastR);
      damageArea(this.x, this.y, T.blastR, T.blastDmg * this.dmgMult * this.magicPow * CFG.enemyHpMult(G.time), T.blastKb);
      addShake(3);
    }
    Sfx.play('tele');
  },
  // ISOLE: tieni a riva; sul PONTE (G.map.bridge) puoi camminare sul mare, stretto tra i parapetti.
  // In fondo al ponte: dalla Sicilia si entra nello Scoglio di Scilla, dallo Scoglio (dopo averla battuta) si torna.
  onBridge: false,
  shore() {
    const B = G.map.bridge;
    if (B) {
      let t = this.x * B.ux + this.y * B.uy, lat = -this.x * B.uy + this.y * B.ux;
      if (this.onBridge || (t > B.r0 - 70 && lat > -B.w * 0.5 && lat < B.w * 0.5)) {
        if (t < B.r0 - 70) this.onBridge = false;   // tornato a terra
        else {
          this.onBridge = true;
          const lim = B.w * 0.5 - this.r;
          if (lat > lim) lat = lim; else if (lat < -lim) lat = -lim;
          // sullo Scoglio il ponte resta chiuso finché Scilla è viva
          const end = G.map.reef && !G.reefDone ? B.r0 - 20 : B.r0 + B.len;
          if (t > end) { t = end; if (G.map.reef && !G.reefDone && !G.reefWarned) { G.reefWarned = true; UI.toast('Ponte sbarrato', '', 2); } }
          this.x = B.ux * t - B.uy * lat; this.y = B.uy * t + B.ux * lat;
          if (t > B.r0 + B.len - 24) { if (G.map.reef) leaveReef(); else enterReef(); }
          return;
        }
      }
    }
    const c = islandClamp(this.x, this.y, this.r + 4);
    if (c.hit) { this.x = c.x; this.y = c.y; }
  },
  // posto sul ponte, `back` unità prima della fine (si arriva da lì)
  placeOnBridge(back) {
    const B = G.map.bridge, t = B.r0 + B.len - back;
    this.x = this.px = B.ux * t; this.y = this.py = B.uy * t;
    this.dirX = -B.ux; this.dirY = -B.uy; this.onBridge = true; this.trailN = 0;
  },
  teleCdMax() { return (this.teleUp ? TELE_UP.cd : TELEPORT.cd) * this.cdMult * this.magicCd; },

  // ABILITÀ (SKILLS): si sbloccano vincendo Dite (Ira) e Cocito (Gelo). Tasti 1/2 (o Z/X), sul telefono i tasti sopra al TELE.
  // La Magia della Locanda le rende più forti (magicPow) e le ricarica prima (magicCd).
  skillCdMax(id) { return SKILLS[id].cd * this.magicCd; },
  trySkill(id) {
    const K = SKILLS[id];
    if (!this.skill[id] || this.skillCd[id] > 0 || G.state !== 'play') return;
    this.skillCd[id] = this.skillCdMax(id);
    const pw = this.magicPow, dmg = K.dmg * this.dmgMult * pw * CFG.enemyHpMult(G.time), r = K.r * (1 + (pw - 1) * 0.5);
    if (id === 'ira') {
      // IRA DI DITE: le mura infuocate esplodono attorno a te — danno e spinta forte
      SkillFx.add('ira', this.x, this.y, r);
      damageArea(this.x, this.y, r, dmg, K.kb);
      addShake(6);
      Sfx.play('boom');
    } else {
      // GELO DI COCITO: tutto ciò che è vicino resta congelato (fermo) per qualche secondo
      const E = Enemies, n = Grid.query(this.x, this.y, r + CFG.MAX_ENEMY_R, QBUF_SKILL), t = K.time * pw;
      for (let k = 0; k < n; k++) {
        const j = QBUF_SKILL[k];
        if (E.alive[j] === 0) continue;
        const ex = E.x[j] - this.x, ey = E.y[j] - this.y;
        if (ex * ex + ey * ey > r * r) continue;
        E.frz[j] = t; E.frzM[j] = 0;
      }
      SkillFx.add('gelo', this.x, this.y, r);
      damageArea(this.x, this.y, r, dmg, 0);
      Sfx.play('frost');
    }
    this.invT = Math.max(this.invT, 0.3);
  },

  // fotogramma da disegnare (animazione del personaggio)
  frame(rt) {
    if (!this.anim) return SPR.cache[this.sprite] || SPR.cache.char_eek;
    const C = SPR.cache, b = this.anim, v = this.view === 'f' ? b : b + '_' + this.view;
    const f = (s) => C[v + s] || C[b + s] || C[b];   // se manca la vista, ripiega sul fronte
    if (this.throwT > 0) return f('_t');
    if (this.moving) return f('_r' + (((rt * 9) | 0) & 3));
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
    if (!G.cheat) Save.addCoins(n);   // coi trucchi del debug le monete non vanno in banca
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
    UI.toast('Pietra del Fabbro', '', 3);
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
