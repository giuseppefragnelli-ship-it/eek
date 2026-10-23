'use strict';
// js/26_main.js — stati, startRun, step, game loop (FPS_CAP), boot

// ============================================================================
// MAIN — stati di gioco + game loop a timestep fisso (60 Hz) con
// accumulatore e rendering interpolato.
// Ordine dello step:
//   ostacoli -> player -> spawn -> grid -> nemici -> armi/proiettili ->
//   pozze -> contatti -> proiettili nemici -> gemme -> effetti -> compattazione
// Scene (G.scene): 'menu' (sfondo), 'run' (partita), 'village' (villaggio)
// ============================================================================

function setState(s) {
  G.state = s;
  UI.applyState(s);
}

function startRun() {
  UI.syncFast();
  abandonRun();   // "Ricomincia" dalla pausa: la partita lasciata conta comunque
  G.mapId = Save.mapUnlocked(Save.data.map) ? Save.data.map : 'cripta';
  G.map = MAPS[G.mapId];
  G.diffId = Save.diffFor(G.mapId);          // Facile solo sul Cocito (e solo se sbloccata)
  G.diff = DIFFICULTY[G.diffId];
  MapGen.reset(G.mapId);
  Enemies.clear(); Projectiles.clear(); Gems.clear(); FX.clear(); EShots.clear(); Zones.clear();
  Obs.n = 0;
  G.time = 0; G.kills = 0; G.nextUid = 1; G.runCoins = 0; G.runBonus = 0;
  G.pendingLevels = 0; G.rerolls = REROLL.perRun; G.slowFactor = 1; G.shake = 0; G.mergeT = 1; G.flash = 0; G.night = false; G.nightK = 0; G.eternal = false;
  G.reefT = 0; G.reefDone = false; G.reefWarned = false; G.killedBy = null;
  G.victory = false; G.victoryT = 0; G.src = null;
  G.won = false; G.endless = false; G.hitStop = 0; G.lvlT = 0; G.dyingT = 0;
  G.chestQueue.length = 0; G.chestSeen = false;
  G.rs = { elites: 0, chests: 0, evos: 0, bosses: {} };
  G.paidMin = 0; G.killsC = 0; G.committed = false;
  G.cheat = G.god;   // trucchi del debug usati (anche l'invincibilità rimasta accesa): la partita non conta
  G.scene = 'run';
  nextUnlockTime();
  Camp.reset();
  Player.reset();
  Spawner.reset();
  UI.showBoss(false);
  UI.villagePrompt(null);
  UI.refreshSlots();
  acc = 0;
  setState('play');
  Sfx.play('portal');
  UI.toast(G.map.name, '', 2);
}

// abbandono di una partita in corso (dalla pausa): conta comunque
function abandonRun() {
  if (G.state === 'paused' || (G.state === 'options' && UI.optReturn === 'paused')) commitRun();
}

function goToMenu() {
  abandonRun(); // abbandono: conta comunque come partita
  Boss.reset(); UI.showBoss(false); UI.villagePrompt(null);
  Enemies.clear(); Projectiles.clear(); Gems.clear(); FX.clear(); EShots.clear(); Zones.clear();
  Obs.n = 0;
  // BUG risolto: uscendo durante la notte (o un lampo) il menu restava buio
  G.night = false; G.flash = 0; G.shake = 0; G.victory = false; Strikes.n = 0;
  G.scene = 'menu';
  Player.reset();
  menuMapId = null;
  setState('menu');
}

// ---------------------------------------------------------------------------
// SFONDO DEL MENU: la mappa scelta, la camera che scorre piano e qualche slime che vaga
// ---------------------------------------------------------------------------
let menuMapId = null;
function setMenuBackdrop(id) {
  if (G.scene !== 'menu' || menuMapId === id) return;
  menuMapId = id;
  G.mapId = id; G.map = MAPS[id]; MapGen.reset(id);
  G.diff = DIFFICULTY[DEFAULT_DIFFICULTY]; G.night = false;
  Enemies.clear(); FX.clear(); Gems.clear();
  const types = ['drop', 'fast', 'heavy', 'spitter', 'drop'];
  if (G.map.special) types.push(G.map.special, G.map.special);
  const E = Enemies;
  for (let k = 0; k < 28; k++) {
    const i = spawnEnemy(ET[types[k % types.length]], Player.x + (Math.random() - 0.5) * G.viewW * 1.3, Player.y + (Math.random() - 0.5) * G.viewH * 1.3);
    if (i >= 0) { E.aiT[i] = Math.random() * 6.283; E.speed[i] *= 0.3; }
  }
}
function tickMenuBackdrop(dt) {
  G.time += dt;
  Player.px = Player.x; Player.py = Player.y;
  Player.x += 18 * dt; Player.y += 7 * dt;
  const E = Enemies, hw = G.viewW * 0.65, hh = G.viewH * 0.65;
  for (let i = 0; i < E.count; i++) {
    E.aiT[i] += (Math.random() - 0.5) * dt * 2;
    E.x[i] += Math.cos(E.aiT[i]) * E.speed[i] * dt; E.y[i] += Math.sin(E.aiT[i]) * E.speed[i] * dt;
    if (E.x[i] < Player.x - hw) E.x[i] += hw * 2; else if (E.x[i] > Player.x + hw) E.x[i] -= hw * 2;
    if (E.y[i] < Player.y - hh) E.y[i] += hh * 2; else if (E.y[i] > Player.y + hh) E.y[i] -= hh * 2;
    E.px[i] = E.x[i]; E.py[i] = E.y[i];
  }
}

function goToVillage() {
  abandonRun();
  Boss.reset(); UI.showBoss(false);
  Enemies.clear(); Projectiles.clear(); Gems.clear(); FX.clear(); EShots.clear(); Zones.clear();
  G.scene = 'village';
  Village.enter();
}

// Chiude i conti della partita: bonus sopravvivenza (solo i minuti non ancora pagati),
// record e statistiche di carriera. Si può chiamare più volte (vittoria e poi modalità infinita).
function commitRun() {
  // partita coi trucchi del debug: niente bonus, record, statistiche né missioni
  if (G.cheat) { G.committed = true; G.killsC = G.kills; G.rs = { elites: 0, chests: 0, evos: 0, bosses: {} }; return null; }
  const mins = Math.floor(G.time / 60);
  const nb = Math.max(0, mins - G.paidMin) * COIN.perMinute * G.diff.coin;
  G.paidMin = mins;
  if (nb > 0) { G.runBonus += nb; Save.addCoins(nb); }
  const rs = { kills: G.kills - G.killsC, elites: G.rs.elites, chests: G.rs.chests, evos: G.rs.evos, bosses: G.rs.bosses };
  const record = Save.endRun({ time: G.time, kills: G.kills, level: Player.level, map: G.mapId, diff: G.diffId,
    win: G.won, endless: G.endless, newRun: !G.committed, rs });
  G.committed = true; G.killsC = G.kills;
  G.rs = { elites: 0, chests: 0, evos: 0, bosses: {} };
  return record;
}

function step(dt) {
  collectObstacles();
  Player.update(dt);
  Camp.update();                 // il Magister nella Cattedrale: sei vicino?
  Enemies.savePrev();
  Projectiles.savePrev();
  EShots.savePrev();

  G.time += dt;
  if (G.time >= G.unlockT) checkUnlocks();
  if (G.reefT > 0 && (G.reefT -= dt) <= 0) spawnReefBoss();   // Scilla emerge poco dopo che sei entrato
  Spawner.update(dt);
  Grid.build(Enemies, Player.x, Player.y);
  updateEnemies(dt);
  updateWeapons(dt);
  updateProjectiles(dt);
  updateZones(dt);
  updatePlayerContacts(dt);
  updateStrikes(dt);
  updateEShots(dt);
  if (Death.on && G.state === 'play') Death.update(dt);   // LA MORTE (minuto 14)
  if (G.state !== 'play') return;
  updateGems(dt);
  updateFx(dt);
  G.mergeT -= dt;
  if (G.mergeT <= 0) { G.mergeT = 1; mergeFarGems(); }
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 18);
  if (G.flash > 0) G.flash -= dt;

  // BUG risolto: dopo la compattazione gli indici dei nemici cambiano; i fuochi fatui
  // inseguivano per un attimo il nemico sbagliato. Ora i bersagli vengono rimappati.
  Enemies.compact(ENEMY_REMAP);
  for (let i = 0; i < Projectiles.count; i++) {
    if (Projectiles.alive[i] !== 0 && Projectiles.kind[i] === PK.WISP && Projectiles.tgt[i] >= 0) Projectiles.tgt[i] = ENEMY_REMAP[Projectiles.tgt[i]];
  }
  if (Boss.n > 0) Boss.remap(ENEMY_REMAP);
  Projectiles.compact();
  Gems.compact();
  FX.compact();
  EShots.compact();
  Zones.compact();

  // vittoria: qualche secondo di respiro prima della schermata
  if (G.victory) {
    G.victoryT -= dt;
    if (G.victoryT <= 0) { onVictory(); return; }
  }

  // forzieri raccolti: si aprono subito (prima delle carte del level up)
  if (G.chestQueue.length > 0) { setState('chest'); UI.openChest(G.chestQueue.shift()); return; }
  if (G.pendingLevels > 0) {
    if (G.lvlT > 0) G.lvlT -= dt;          // l'onda d'urto si gode per un attimo
    else { setState('levelup'); UI.openLevelUp(); }
  }
}

// LO SCOGLIO DI SCILLA (REEF): dal ponte della Sicilia si passa sull'isoletta del boss, e da lì (dopo averla battuta) si torna.
// Si cambia solo G.map (G.mapId resta Sicilia: record, sblocchi e vittoria contano per Island). I nemici restano di là.
function swapIsle(map) {
  G.map = map; MapGen.reset(map === REEF_MAP ? 'reef' : G.mapId);
  Enemies.clear(); Projectiles.clear(); EShots.clear(); Zones.clear(); Gems.clear(); FX.clear();
  Boss.n = 0; Boss.sync(); Strikes.n = 0; UI.showBoss(false);
  Obs.n = 0; collectObstacles();
  if (Death.on) Death.place();   // la Morte ti segue anche di là
  G.flash = 0.1; addShake(4); Sfx.play('portal');
}
function enterReef() {
  if (G.state !== 'play') return;
  swapIsle(REEF_MAP);
  G.reefDone = false; G.reefWarned = false; G.reefT = REEF.delay;
  Player.placeOnBridge(40);
  UI.toast(REEF.name, '', 3, true);
}
function leaveReef() {
  if (G.state !== 'play') return;
  swapIsle(MAPS[G.mapId]);
  Player.placeOnBridge(40);
  UI.toast(G.map.name, '', 2);
}
function spawnReefBoss() {
  const R = REEF, i = spawnBoss(ET.boss3, true, R.boss, null);
  if (i < 0) return;
  const E = Enemies, S = Boss.slotOf(i);
  S.reef = true;
  E.x[i] = E.px[i] = 0; E.y[i] = E.py[i] = 0;             // sale dal centro dello scoglio
  E.hp[i] = E.maxHp[i] = E.maxHp[i] * R.hp; E.dmg[i] *= R.dmg;
  UI.toast(R.boss.name, '', 3, true);
}

// SBLOCCHI SEGRETI (UNLOCKS): G.unlockT = il prossimo tempo utile su questa mappa (Infinity se non c'è niente da sbloccare),
// così lo step fa un solo confronto.
function nextUnlockTime() {
  G.unlockT = Infinity;
  for (const id in UNLOCKS) { const u = UNLOCKS[id]; if (u.map === G.mapId && !Save.unlocked(id) && u.time < G.unlockT) G.unlockT = u.time; }
}
function checkUnlocks() {
  if (G.cheat) { G.unlockT = Infinity; return; }   // i segreti non si sbloccano coi trucchi
  for (const id in UNLOCKS) {
    const u = UNLOCKS[id];
    if (u.map !== G.mapId || Save.unlocked(id) || G.time < u.time) continue;
    Save.data.unlocks[id] = true;
    Save.write();
    if (id === 'teleport') { Player.tele = true; Player.teleCd = 0; document.body.classList.add('has-tele'); }
    spawnFx(FXK.RING, Player.x, Player.y, 0.6, 160);
    Sfx.play('quest');
    UI.toast(u.name, '', 4, true);
  }
  nextUnlockTime();
}

// dopo il forziere: altri forzieri, poi le carte, poi si riprende
function afterChest() {
  if (G.chestQueue.length > 0) { UI.openChest(G.chestQueue.shift()); return; }
  if (G.pendingLevels > 0) { setState('levelup'); UI.openLevelUp(); }
  else setState('play');
}

// MORTE: il personaggio lampeggia ed esplode, lo schermo si tinge di rosso, poi il resoconto
function onPlayerDeath() {
  setState('dying');
  G.dyingT = 1.6; G.hitStop = 0;
  Sfx.play('death');
  addShake(6);
  EShots.clear();
}

function finishDeath() {
  const record = commitRun();
  UI.showEnd(G.endless ? 'endless' : 'dead', record, null);
  setState('dead');
  G.deadAt = performance.now();
}

// VITTORIA: hai resistito fino al minuto 7. Due secondi (invulnerabile) e poi la schermata.
function winRun() {
  G.victory = true; G.victoryT = 2.2;
  EShots.clear(); Strikes.n = 0;
  addShake(4);
  UI.toast('Vittoria', '', 3);
}

function onVictory() {
  // bonus vittoria + sblocco della mappa successiva
  G.won = true;
  Player.gainCoins(WIN.reward.coins * G.diff.coin);
  const before = Object.keys(MAPS).filter((id) => Save.mapUnlocked(id));
  if (!G.cheat) { Save.data.wins[G.mapId] = true; Save.write(); }   // coi trucchi la mappa dopo non si sblocca
  const unlocked = Object.keys(MAPS).filter((id) => Save.mapUnlocked(id) && before.indexOf(id) < 0);
  // abilità sbloccata da questa mappa (Dite, Cocito)
  for (const id in SKILLS) {
    if (SKILLS[id].win !== G.mapId || Player.skill[id] || !Save.skillOpen(id)) continue;
    Player.skill[id] = true; Player.skillCd[id] = 0; UI.refreshSkills();
    UI.toast(SKILLS[id].name, '', 4, true);
  }
  const record = commitRun();
  Sfx.play('victory');
  UI.showEnd('win', record, unlocked.length ? MAPS[unlocked[0]].name : null);
  setState('dead');
  G.deadAt = performance.now();
}

// MODALITÀ INFINITA: dopo la vittoria si continua, coi boss che tornano
function continueEndless() {
  if (G.state !== 'dead' || !G.won || G.endless) return;
  G.endless = true; G.victory = false;
  if (!Boss.spawnedDuo) Boss.duoT = G.time + DUO.delay;   // i due guardiani della mappa arrivano tra poco
  UI.showBoss(Boss.active);
  EShots.clear();
  Player.invT = 2;
  acc = 0;
  setState('play');
  UI.toast('Modalità infinita', '', 2);
}

// opzioni salvate -> configurazione attiva
function applySettings() {
  const st = Save.data.settings;
  CFG.screenShake = !!st.shake;
  CFG.damageNumbers = !!st.numbers;
  CFG.flashes = !!st.flash;
  Sfx.setVol();
}

function onTouchDetected() {
  document.body.classList.add('touch');
}

function onWindowBlur() {
  if (G.state === 'play') setState('paused');
}

function handleKeys() {
  const s = G.state;
  if (Input.consume('Escape')) {
    if (s === 'play') setState('paused');
    else if (s === 'paused') setState('play');
    else if (s === 'records') goToMenu();
    else if (s === 'shop') UI.closeShop();
    else if (s === 'options') UI.closeOptions();
    else if (s === 'village') goToMenu();
  }
  if (Input.consume('KeyO')) { G.debug = !G.debug; UI.setDebug(G.debug); }
  if (s === 'play' && Input.consume('KeyF')) UI.toggleFast();
  if (s === 'play') {
    // vicino al Magister E/Invio parlano con lui; altrimenti Spazio/E/Q = teletrasporto
    if (Camp.near && (Input.consume('KeyE') || Input.consume('Enter'))) Camp.talk();
    else if (Input.consume('Space') || Input.consume('KeyE') || Input.consume('KeyQ') || Input.teleReq) { Input.teleReq = false; Player.tryTeleport(); }
    // abilità: 1/Z = Ira di Dite, 2/X = Gelo di Cocito (sul telefono i loro tasti)
    if (Input.consume('Digit1') || Input.consume('KeyZ') || Input.skillReq === 'ira') Player.trySkill('ira');
    if (Input.consume('Digit2') || Input.consume('KeyX') || Input.skillReq === 'gelo') Player.trySkill('gelo');
    Input.skillReq = null;
    // trucchi: solo con la finestra debug aperta (tasto O), e la partita non conta più
    if (G.debug) {
      if (Input.consume('KeyI')) { G.god = !G.god; G.cheat = true; }
      if (Input.consume('KeyP')) { debugSpawn(300); G.cheat = true; }
      if (Input.consume('KeyB')) { debugBoss(); G.cheat = true; }
    }
  }
  if (s === 'village' && (Input.consume('KeyE') || Input.consume('Enter') || Input.consume('Space'))) Village.talk();
  if (s === 'menu' && Input.consume('Enter')) UI.action('play');
  if (s === 'menu' && (Input.consume('ArrowLeft') || Input.consume('KeyA'))) UI.action('map-prev');
  if (s === 'menu' && (Input.consume('ArrowRight') || Input.consume('KeyD'))) UI.action('map-next');
  if (s !== 'play') { Input.teleReq = false; Input.skillReq = null; }
  if (s === 'levelup') UI.levelUpKeys();
  if (s === 'chest' && (Input.consume('Enter') || Input.consume('Space') || Input.consume('KeyE'))) UI.closeChest();
  if (s === 'dead' && performance.now() - G.deadAt > 600) {
    if (Input.consume('KeyC') && G.won && !G.endless) continueEndless();
    else if (Input.consume('KeyR') || Input.consume('Enter')) startRun();
    else if (Input.consume('KeyV')) goToVillage();
    else if (Input.consume('KeyM')) goToMenu();
  }
}

// ---------------------------------------------------------------------------
let acc = 0, last = 0, fpsAcc = 0, fpsFrames = 0;
// LIMITE FPS: il gioco disegna al massimo 28 volte al secondo (il telefono scalda meno).
// La simulazione resta a passo fisso 1/60 s, quindi velocità e danni non cambiano: cambia solo quanto spesso si ridisegna.
const FPS_CAP = 28, FRAME_MS = 1000 / FPS_CAP;
let nextT = 0;

function frame(now) {
  requestAnimationFrame(frame);
  if (now < nextT - 1) return;                       // troppo presto: salta questo giro dello schermo
  nextT += FRAME_MS;
  if (nextT < now) nextT = now + FRAME_MS;           // rimasti indietro (scheda in pausa, lag): riparti da adesso
  let dtReal = (now - last) / 1000;
  last = now;
  if (dtReal > 0.25) dtReal = 0.25;

  fpsAcc += dtReal; fpsFrames++;
  if (fpsAcc >= 0.5) { G.stats.fps = fpsFrames / fpsAcc; fpsAcc = 0; fpsFrames = 0; }

  Input.update();
  handleKeys();

  const t0 = performance.now();
  // micro-pausa d'impatto: la simulazione si ferma per qualche centesimo di secondo
  if (G.hitStop > 0 && G.state === 'play') { G.hitStop -= dtReal; acc = 0; }
  // morte: solo gli effetti vanno avanti, poi il resoconto
  if (G.state === 'dying') {
    updateFx(dtReal);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dtReal * 10);
    G.dyingT -= dtReal;
    if (G.dyingT <= 0) finishDeath();
  }
  const running = (G.state === 'play' && G.hitStop <= 0) || G.state === 'village';
  if (running) {
    const fast = G.state === 'play' && Save.data.settings.fast ? 2 : 1;   // VELOCITÀ x2: il doppio dei passi a parità di tempo vero
    acc += dtReal * fast;
    let steps = 0;
    while (acc >= CFG.DT && steps < CFG.MAX_STEPS * fast) {
      const scene = G.scene;
      if (G.state === 'village') Village.step(CFG.DT); else step(CFG.DT);
      if (G.scene !== scene) { acc = 0; break; }   // BUG risolto: entrando nel portale acc diventava negativo
      acc -= CFG.DT;
      steps++;
      if (G.state !== 'play' && G.state !== 'village') break;
    }
    if (steps >= CFG.MAX_STEPS * fast) acc = 0;
  }
  if (G.scene === 'menu') { tickMenuBackdrop(dtReal); if (G.state === 'menu') UI.tickMenu(dtReal); }
  const t1 = performance.now();
  const alpha = (G.state === 'play' || G.state === 'village') ? acc / CFG.DT : 1;
  if (G.scene === 'village') Village.draw(alpha); else Render.draw(alpha);
  Render.present();
  const t2 = performance.now();
  UI.update(dtReal);

  G.stats.upd = G.stats.upd * 0.9 + (t1 - t0) * 0.1;
  G.stats.rnd = G.stats.rnd * 0.9 + (t2 - t1) * 0.1;

  Input.clearPressed();
}

function boot() {
  Save.load();
  Sfx.init();
  applySettings();
  SPR.init();
  MonsterArt.apply();   // mostri disegnati al posto degli slime generati
  Grid.init();
  Input.init();
  UI.init();
  Render.init($('game'));
  Input.initPointer($('stage'));
  // dispositivo touch: mostra subito i comandi giusti (anche prima del primo tocco sul campo)
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (coarse || navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches) { Input.isTouch = true; onTouchDetected(); }
  document.addEventListener('touchstart', () => { if (!Input.isTouch) { Input.isTouch = true; onTouchDetected(); } }, { once: true, passive: true });
  G.scene = 'menu';
  Player.reset();
  UI.setDebug(G.debug);
  setState('menu');
  Cloud.init(); // salvataggio online (solo dal link di claude.ai)
  const flushSave = () => { if (Save.data) { Save._local(); Cloud.flush(); } };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
  window.addEventListener('pagehide', flushSave);
  installWebApp();
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
}

// WEB APP (icona in Home sull'iPhone):
//  - service worker (sw.js): copia i file sul telefono, così il gioco parte anche offline.
//    In locale (localhost) è spento per non tenersi file vecchi mentre lo modifichi: per provarlo apri con ?sw=1
//  - salvataggio persistente: chiede al browser di non cancellare il localStorage quando manca spazio
function installWebApp() {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && (!local || /[?&]sw=1/.test(location.search))) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* senza offline si gioca lo stesso */ });
  }
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persisted().then((p) => p || navigator.storage.persist()).catch(() => {});
  }
}

MonsterArt.load(boot);
