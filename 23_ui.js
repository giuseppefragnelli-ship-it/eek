'use strict';
// js/23_ui.js — UI: menu, carte, pausa, morte, HUD, negozio

// ============================================================================
// UI — interfaccia HTML stile Windows 98 (menu, carte, pausa, morte, HUD,
// taskbar). Il DOM si tocca solo quando un valore cambia, mai "a vuoto".
// ============================================================================

const $ = (id) => document.getElementById(id);

const UI = {
  _xp: -1, _lvl: -1, _sec: -1, _kills: -1, _coins: -1, _clock: '',
  cardEls: [], sel: 0, lvlOpenAt: 0,
  dbgT: 0,

  init() {
    // tutte le <img data-spr="..."> prendono lo sprite generato da codice
    document.querySelectorAll('img[data-spr]').forEach((img) => { img.src = SPR.url[img.dataset.spr] || ''; });

    // bottoni con data-act
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      Sfx.unlock(); Sfx.play('click');
      this.action(el.dataset.act);
    });
    document.querySelectorAll('.dicon[data-act]').forEach((el) => el.addEventListener('dblclick', () => this.action(el.dataset.act)));

    // mappa: scorri anche con lo swipe sulla scheda
    let sx = null;
    $('map-card').addEventListener('pointerdown', (e) => { sx = e.clientX; });
    $('map-card').addEventListener('pointerup', (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) > 30) this.action(dx < 0 ? 'map-next' : 'map-prev');
    });
    // tasto TELE (telefono, solo dopo lo sblocco del teletrasporto): risponde al tocco subito, anche con l'altro dito sul joystick
    const tb = $('telebtn');
    tb.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      Sfx.unlock();
      if (G.state === 'play') Input.teleReq = true;
      tb.classList.add('hit'); setTimeout(() => tb.classList.remove('hit'), 120);
    });
    tb.addEventListener('contextmenu', (e) => e.preventDefault());
    // tasti delle ABILITÀ (IRA, GELO)
    document.querySelectorAll('.skbtn').forEach((b) => {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        Sfx.unlock();
        if (G.state === 'play') Input.skillReq = b.dataset.skill;
        b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 120);
      });
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  // la UI scala con l'altezza della finestra (pixel "grossi" come il gioco)
  resize() {
    const z = Math.max(1, Math.min(2.5, window.innerHeight / 620, window.innerWidth / 700));
    document.documentElement.style.setProperty('--ui-zoom', z.toFixed(3));
    if (Render.ctx) Render.resize();
  },

  action(a) {
    switch (a) {
      case 'play': if ((G.state === 'menu' || G.state === 'records') && Save.mapUnlocked(this.mapView || Save.data.map)) startRun(); break;
      case 'records': this.showRecords(); break;
      case 'options': this.openOptions(); break;
      case 'options-close': this.closeOptions(); break;
      case 'village': case 'shop': goToVillage(); break;
      case 'shop-close': this.closeShop(); break;
      case 'talk': if (G.state === 'village') Village.talk(); else if (G.state === 'play') Camp.talk(); break;
      case 'menu': goToMenu(); break;
      case 'resume': if (G.state === 'paused') setState('play'); break;
      case 'restart': startRun(); break;
      case 'continue': continueEndless(); break;
      case 'reroll': this.reroll(); break;
      case 'chest-close': this.closeChest(); break;
      case 'map-prev': this.stepMap(-1); break;
      case 'map-next': this.stepMap(1); break;
      case 'mode-incubo': case 'mode-facile': this.setMode(a.slice(5)); break;
      case 'chars': if (G.state === 'menu') this.openShop('inn', 'menu'); break;
      case 'shop-up': this.shopAction('shopup', this.shopVendor); break;
      case 'save-export': this.saveExport(); break;
      case 'save-import': this.saveImportShow(); break;
      case 'save-import-go': this.saveImport(); break;
      case 'fast': this.toggleFast(); break;
      case 'start':
        if (G.state === 'play') setState('paused');
        else if (G.state === 'paused') setState('play');
        else if (G.state === 'village') goToMenu();
        break;
    }
  },

  // LA MORTE: il suo ritratto a tutto schermo per `secs` secondi (arriva al minuto 14)
  reaper(secs) {
    const el = $('reaper');
    el.classList.remove('show'); void el.offsetWidth;   // riparte l'animazione
    el.classList.add('show');
    clearTimeout(this._reaperT);
    this._reaperT = setTimeout(() => el.classList.remove('show'), secs * 1000);
  },

  // tasto TELE: frecce schivate (x / 50), poi TELE+ potenziato
  refreshDodges() {
    const d = Save.data.dodges, up = d >= TELE_UP.dodges;
    if (d === this._dodges) return;
    this._dodges = d;
    $('tele-n').textContent = up ? 'MAX' : d + '/' + TELE_UP.dodges;
    $('tele-label').textContent = up ? 'TELE+' : 'TELE';
    $('telebtn').classList.toggle('up', up);
  },

  // tasti delle abilità: visibili solo se sbloccate (Player.skill), dal lato opposto al joystick fisso
  refreshSkills() {
    const bc = document.body.classList, left = Save.data.settings.joy === 'right';
    for (const id in SKILLS) {
      bc.toggle('has-' + id, !!Player.skill[id]);
      $('sk-' + id).classList.toggle('left', left);
    }
  },

  // mostra/nasconde i pannelli in base allo stato
  applyState(s) {
    // classe sul body con lo stato (es. il tasto TELE si vede solo in partita)
    const bc = document.body.classList;
    for (const c of Array.from(bc)) if (c.indexOf('st-') === 0) bc.remove(c);
    bc.add('st-' + s);
    $('telebtn').classList.toggle('left', Save.data.settings.joy === 'right');
    bc.toggle('has-tele', Save.unlocked('teleport'));
    this.refreshDodges();
    this.refreshSkills();
    $('m-menu').classList.toggle('show', s === 'menu');
    $('m-records').classList.toggle('show', s === 'records');
    $('m-shop').classList.toggle('show', s === 'shop');
    $('m-options').classList.toggle('show', s === 'options');
    const inVillage = s === 'village' || (s === 'shop' && this.shopReturn === 'village') || (s === 'options' && this.optReturn === 'village');
    $('desktop').classList.toggle('show', s === 'menu' || s === 'records' || (s === 'options' && this.optReturn === 'menu'));
    if (s === 'village') { if (Village.near) $('vprompt').classList.add('show'); }
    else if (s === 'play' && G.scene === 'run' && Camp.near) this.runPrompt(true);   // il Magister nella Cattedrale
    else $('vprompt').classList.remove('show');
    $('m-levelup').classList.toggle('show', s === 'levelup');
    $('m-pause').classList.toggle('show', s === 'paused');
    $('m-chest').classList.toggle('show', s === 'chest');
    $('m-dead').classList.toggle('show', s === 'dead');
    $('hud').classList.toggle('show', s === 'play' || s === 'levelup' || s === 'paused' || s === 'chest' || s === 'dying' || (s === 'options' && this.optReturn === 'paused') || (s === 'shop' && this.shopReturn === 'run'));
    if (s === 'paused') this.renderBuild();
    $('startbtn').classList.toggle('pressed', s === 'paused');
    if (s === 'menu') this.refreshMenu();
  },

  // ---- MENU PRINCIPALE ------------------------------------------------------------
  mapView: null,       // mappa mostrata nel carosello (può essere bloccata: la si vede ma non si gioca)
  _thumbs: {},

  refreshMenu() {
    const d = Save.data;
    $('menu-coins').textContent = d.coins;
    $('menu-stones').textContent = d.stones || 0;
    // personaggio (Eek respira: due fotogrammi, vedi tickMenu)
    const ch = CHARACTERS[d.char];
    $('menu-char').textContent = ch.name;
    $('menu-char-desc').textContent = ch.desc;
    $('menu-char-img').src = SPR.url[ch.sprite];
    const gid = Save.gearId();
    $('menu-gear').innerHTML = gid ? '<img src="' + SPR.url[SPR.itemIcon(gid, Save.itemLevel(gid))] + '"><span></span>' : '<span></span>';
    $('menu-gear').querySelector('span').textContent = gid ? SHOP_ITEMS[gid].name + ' +' + Save.itemLevel(gid) + " dall'Armaiolo" : "Nessuna arma dell'Armaiolo";
    // mappa
    if (!this.mapView || !MAPS[this.mapView]) this.mapView = d.map;
    this.renderMap();
    $('quest-dot').hidden = Save.questsReady() === 0;
    this.refreshMenuSave();
    this._coins = -1;
  },

  stepMap(dir) {
    const ids = Object.keys(MAPS);
    let k = ids.indexOf(this.mapView || Save.data.map);
    k = (k + dir + ids.length) % ids.length;
    this.mapView = ids[k];
    if (Save.mapUnlocked(this.mapView) && Save.data.map !== this.mapView) { Save.data.map = this.mapView; Save.write(); }
    this.renderMap();
  },

  renderMap() {
    const d = Save.data, id = this.mapView, m = MAPS[id], open = Save.mapUnlocked(id), ids = Object.keys(MAPS);
    $('map-card').classList.toggle('locked', !open);
    $('map-thumb').src = this.mapThumb(id);
    $('map-name').textContent = m.name;
    $('map-lock').textContent = open ? '' : '🔒 Vinci ' + MAPS[m.unlock].name + ' per entrare';
    $('map-count').textContent = (ids.indexOf(id) + 1) + ' / ' + ids.length;
    $('map-desc').textContent = m.desc + (open && m.b2 ? ' — X: Flegiàs, ' + m.b2.name + ', ' + m.b3.name : '');
    // etichette: vinta, record, forza degli slime, monete
    const tags = [];
    if (d.wins[id]) tags.push(['won', '✓ vinta']);
    const df = Save.diffFor(id), rec = d.records[id + '/' + df];
    if (df !== DEFAULT_DIFFICULTY) tags.push(['danger', DIFFICULTY[df].label.toUpperCase() + ' · dannati x10']);
    if (open && rec && rec.t > 0) tags.push(['rec', 'record ' + fmtTime(rec.endless || rec.t)]);
    if (m.hp > 1) tags.push(['danger', 'hostes x' + m.hp]);
    if (m.coin > 1) tags.push(['coin', 'monete x' + m.coin]);
    if (!tags.length) tags.push(['', 'la prima discesa']);
    const tb = $('map-tags');
    tb.innerHTML = '';
    for (const [c, t] of tags) { const s = document.createElement('span'); s.className = 'tag ' + c; s.textContent = t; tb.appendChild(s); }
    // pallini: uno per mappa
    $('map-dots').innerHTML = ids.map((k) => '<i class="' + (k === id ? 'on ' : '') + (d.wins[k] ? 'won' : Save.mapUnlocked(k) ? '' : 'locked') + '"></i>').join('');
    // tasto Gioca
    const pb = $('play-btn');
    pb.disabled = !open;
    $('play-label').textContent = open ? (df !== DEFAULT_DIFFICULTY ? 'GIOCA (' + DIFFICULTY[df].label + ')' : 'GIOCA') : '🔒 Mappa bloccata';
    // MODALITÀ: dove vale la Facile (solo il Cocito, dopo lo sblocco) si sceglie qui
    const fd = DIFFICULTY.facile, mm = $('map-mode'), canF = open && id === fd.map && Save.unlocked(fd.unlock);
    mm.hidden = !canF;
    if (canF) mm.innerHTML = '<span>Modalità</span><button class="btn mini' + (df === 'facile' ? '' : ' on') + '" data-act="mode-incubo">Incubo</button>' +
      '<button class="btn mini' + (df === 'facile' ? ' on' : '') + '" data-act="mode-facile">Facile</button>';
    // lo sfondo del menu mostra la mappa scelta
    setMenuBackdrop(id);
  },

  // sceglie la modalità (vale solo dove la Facile è ammessa: vedi Save.diffFor)
  setMode(id) {
    if (!DIFFICULTY[id] || (DIFFICULTY[id].unlock && !Save.unlocked(DIFFICULTY[id].unlock))) return;
    Save.data.difficulty = id; Save.write();
    this.renderMap();
  },

  // anteprima della mappa: pavimento + ostacoli + i suoi slime (generata una volta sola)
  mapThumb(id) {
    if (this._thumbs[id]) return this._thumbs[id];
    const m = MAPS[id], W = 160, H = 80, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = g.createPattern(SPR.floors[m.floor], 'repeat'); g.fillRect(0, 0, W, H);
    let seed = id.length * 131 + id.charCodeAt(0);
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const put = (name, x, y, base) => { const s = SPR.cache[name]; if (s) g.drawImage(s.img, Math.round(x - s.w / 2), Math.round(base ? y - s.h : y - s.h / 2), s.w, s.h); };
    for (let k = 0; k < 9; k++) put(m.props[(rnd() * m.props.length) | 0], rnd() * W, rnd() * H);
    if (m.layout === 'ruins') { put('d_drum', 30, 66); for (const [x, y, s] of [[20, 40, 'o_col'], [48, 40, 'o_col_half'], [126, 46, 'o_col'], [150, 46, 'o_col_stump'], [104, 76, 'o_wall']]) put(s, x, y, true); }
    else for (const [x, y] of [[22, 36], [140, 40], [118, 78], [38, 80]]) put(m.obstacle, x, y, true);
    // slime: quelli tipici della mappa al centro
    const sp = m.special ? ENEMY_DEFS[ET[m.special]].sprite : 'slime_heavy';
    put('slime_drop', 64, 58); put('slime_fast', 98, 62); put(sp, 82, 46); put(sp, 58, 34); put('slime_heavy', 104, 30);
    // vignetta scura ai bordi
    const vg = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.65)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    return (this._thumbs[id] = c.toDataURL());
  },

  // riga del salvataggio in fondo al menu
  refreshMenuSave() {
    const st = Cloud.status, el = $('menu-save'), dot = $('menu-save-dot');
    if (!el) return;
    dot.className = 'dot ' + st;
    el.textContent = st === 'on' ? 'Progressi salvati online: li ritrovi su telefono e PC'
      : st === 'wait' ? 'Collegamento al salvataggio online...'
      : st === 'error' ? 'Salvataggio online non raggiungibile: salvo su questo dispositivo'
      : 'Progressi salvati su questo dispositivo';
  },

  // animazione del personaggio nel menu (respiro)
  _charT: 0, _charF: 0,
  tickMenu(dt) {
    const ch = CHARACTERS[Save.data.char];
    if (!ch.anim) return;
    this._charT += dt;
    const f = ((this._charT * 1.6) | 0) & 1;
    if (f !== this._charF) { this._charF = f; $('menu-char-img').src = SPR.url[f ? ch.anim + '_i1' : ch.sprite]; }
  },

  showRecords() {
    const d = Save.data, st = d.stats;
    const pad = (t, n) => (t + '                         ').slice(0, n);
    let txt = 'RECORD PER MAPPA  (tempo · ★ = vittorie · ∞ = infinita)\n';
    txt += '=========================================================\n';
    txt += pad('', 15);
    txt += pad('Incubo', 14);
    txt += '\n';
    for (const m in MAPS) {
      txt += pad(MAPS[m].short, 15);
      for (const k of [DEFAULT_DIFFICULTY]) {
        const r = d.records[m + '/' + k];
        let c = '--';
        if (r && r.t > 0) c = fmtTime(r.endless || r.t) + (r.win ? ' ★' + (r.win > 1 ? r.win : '') : '') + (r.endless ? '∞' : '');
        if (!Save.mapUnlocked(m)) c = '(bloccata)';
        txt += pad(c, 14);
      }
      txt += '\n';
    }
    // Facile: una riga sola (vale solo su una mappa)
    const FD = DIFFICULTY.facile;
    if (Save.unlocked(FD.unlock)) {
      const r = d.records[FD.map + '/facile'];
      txt += pad(MAPS[FD.map].short + ' Facile', 15) + (r && r.t > 0 ? fmtTime(r.endless || r.t) + (r.win ? ' ★' + (r.win > 1 ? r.win : '') : '') + (r.endless ? '∞' : '') : '--') + '\n';
    }
    txt += '\nCARRIERA\n========\n';
    txt += pad('Partite giocate', 22) + d.runs + '\n';
    txt += pad('Dannati uccisi', 22) + st.kills.toLocaleString('it-IT') + '\n';
    txt += pad('Cacciatori eliminati', 22) + st.elites + '\n';
    txt += pad('Boss sconfitti', 22) + Object.keys(st.bosses).reduce((n, k) => n + st.bosses[k], 0) + '\n';
    txt += pad('Forzieri aperti', 22) + st.chests + '\n';
    txt += pad('Armi evolute', 22) + st.evos + '\n';
    txt += pad('Livello massimo', 22) + d.bestLevel + '\n';
    txt += pad('Missioni completate', 22) + Object.keys(d.quests).length + ' / ' + QUESTS.length + '\n';
    txt += pad('Monete totali', 22) + d.totalCoins + '\n';
    { let nr = 0; for (const k in FUSION_SPECIAL) if (Save.recipeOpen(k)) nr++; txt += pad('Fusioni sbloccate', 22) + nr + ' / ' + Object.keys(FUSION_SPECIAL).length + '\n'; }
    // sblocchi segreti: cosa serve per averli
    txt += '\nSEGRETI\n=======\n';
    for (const id in UNLOCKS) {
      const u = UNLOCKS[id], got = Save.unlocked(id);
      txt += pad(got ? u.name : '???', 22) + (got ? u.kind + ' — sbloccato' : u.hint) + '\n';
    }
    // fusioni (le uniche coppie che si fondono): ricetta dal Magister -> Custode in partita -> sbloccata
    txt += '\nFUSIONI (ricette del Magister)\n==============================\n';
    for (const k in FUSION_SPECIAL) {
      const ids = k.split('+'), pair = WEAPON_DEFS[ids[0]].name + ' + ' + WEAPON_DEFS[ids[1]].name, st = Save.recipeState(k);
      txt += pad(FUSION_SPECIAL[k].name, 22) + pair + ' — ' + (st === 2 ? 'sbloccata' : st === 1 ? 'batti ' + FUSION_SPECIAL[k].custode.name : 'ricetta dal Magister') + '\n';
    }
    $('records-text').textContent = txt;
    setState('records');
  },

  // ---- opzioni ------------------------------------------------------------------
  optReturn: 'menu',
  _optInit: false,

  openOptions() {
    if (!this._optInit) {
      this._optInit = true;
      const box = $('opt-joy');
      for (const id in Input.JOY_MODES) {
        const d = document.createElement('div');
        d.className = 'radio'; d.dataset.joy = id;
        d.innerHTML = '<i></i><span>' + Input.JOY_MODES[id] + '</span>';
        d.addEventListener('click', () => { Save.data.settings.joy = id; Save.write(); this.renderOptions(); });
        box.appendChild(d);
      }
      document.querySelectorAll('#m-options .check').forEach((el) => el.addEventListener('click', () => {
        const k = el.dataset.opt;
        Save.data.settings[k] = !Save.data.settings[k];
        Save.write(); applySettings(); this.renderOptions();
        if (k === 'sfx') { Sfx.unlock(); Sfx.play('coin'); }
      }));
      const vb = $('opt-vol');
      for (const id of ['low', 'mid', 'high']) {
        const d = document.createElement('div');
        d.className = 'radio'; d.dataset.vol = id;
        d.innerHTML = '<i></i><span>' + { low: 'Basso', mid: 'Medio', high: 'Alto' }[id] + '</span>';
        d.addEventListener('click', () => { Save.data.settings.vol = id; Save.write(); applySettings(); this.renderOptions(); Sfx.unlock(); Sfx.play('coin'); });
        vb.appendChild(d);
      }
    }
    this.optReturn = G.state === 'paused' || G.state === 'village' ? G.state : 'menu';
    $('save-code').hidden = true; $('save-import-row').hidden = true; $('save-msg').textContent = '';
    setState('options');
    this.renderOptions();
    this.refreshCloud();
  },

  renderOptions() {
    const st = Save.data.settings;
    document.querySelectorAll('#opt-joy .radio').forEach((el) => el.classList.toggle('on', el.dataset.joy === st.joy));
    document.querySelectorAll('#m-options .check, #m-tip .check').forEach((el) => el.classList.toggle('on', !!st[el.dataset.opt]));
    document.querySelectorAll('#opt-vol .radio').forEach((el) => el.classList.toggle('on', el.dataset.vol === st.vol));
  },

  closeOptions() {
    if (G.state !== 'options') return;
    setState(this.optReturn);
  },

  // ---- salvataggio ---------------------------------------------------------------
  refreshCloud() {
    this.refreshMenuSave();
    const el = $('cloud-status'), dot = $('cloud-dot');
    if (!el) return;
    const st = Cloud.status;
    dot.className = 'dot ' + st;
    if (st === 'on') {
      const d = new Date(Cloud.lastSync || Date.now());
      el.textContent = 'Salvataggio online attivo: telefono e PC condividono i progressi (ultimo ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ').';
    } else if (st === 'wait') el.textContent = 'Collegamento al salvataggio online...';
    else if (st === 'error') el.textContent = 'Salvataggio online non raggiungibile ora: i dati restano su questo dispositivo, riprovo al prossimo salvataggio.';
    else el.textContent = 'Salvataggio solo su questo dispositivo (aprendo il gioco dal link di claude.ai si attiva quello online). Puoi usare il codice per spostare i progressi.';
  },

  saveExport() {
    const ta = $('save-code');
    ta.hidden = false; $('save-import-row').hidden = true;
    ta.value = Save.exportCode();
    ta.select();
    const msg = $('save-msg');
    const done = () => { msg.textContent = 'Codice copiato. Incollalo con "Importa codice" sull\'altro dispositivo.'; };
    try {
      navigator.clipboard.writeText(ta.value).then(done, () => { msg.textContent = 'Seleziona il codice e copialo a mano.'; });
    } catch (e) { msg.textContent = 'Seleziona il codice e copialo a mano.'; }
  },

  saveImportShow() {
    const ta = $('save-code');
    ta.hidden = false; ta.value = ''; ta.focus();
    $('save-import-row').hidden = false;
    $('save-msg').textContent = 'Incolla qui il codice (inizia con SS98-) e premi Carica. Sostituisce i progressi di questo dispositivo.';
  },

  saveImport() {
    const ok = Save.importCode($('save-code').value);
    $('save-msg').textContent = ok ? 'Progressi caricati! Monete: ' + Save.data.coins + '.' : 'Codice non valido: controlla di averlo copiato tutto.';
    if (ok) { $('save-import-row').hidden = true; this.renderOptions(); }
  },

  // ---- villaggio -------------------------------------------------------------------
  villagePrompt(npc) {
    const el = $('vprompt');
    if (!npc || G.state !== 'village') { el.classList.remove('show'); return; }
    $('vprompt-text').textContent = (npc.verb || 'Parla con') + ' ' + npc.name;
    el.classList.add('show');
  },

  // prompt "Parla con il Magister" in partita (Cattedrale)
  runPrompt(on) {
    const el = $('vprompt');
    if (!on || G.state !== 'play') { el.classList.remove('show'); return; }
    $('vprompt-text').textContent = 'Parla con il Magister';
    el.classList.add('show');
  },

  // ---- negozio: finestre dei venditori del villaggio ------------------------------
  shopTab: 'items',
  shopVendor: 'weapons',
  shopReturn: 'village',
  _shopInit: false,
  VENDORS: {
    weapons:  { tab: 'items',   title: "Bottega dell'Armaiolo",  ico: 'it_dagger',  say: '"Arma virumque cano."' },
    armor:    { tab: 'items',   title: 'Bottega del Corazzaio',  ico: 'it_shield',  say: '"Si vis pacem, para bellum."' },
    smith:    { tab: 'smith',   title: 'Fucina del Fabbro',      ico: 'ico_anvil',  say: '"Labor omnia vincit improbus."' },
    inn:      { tab: 'traits',  title: 'Locanda',                ico: 'ico_mug',    say: '"Fatti non foste a viver come bruti, ma per seguir virtute e canoscenza."' },
    board:    { tab: 'quests',  title: 'Tabula',                 ico: 'board',      say: '"Fortes fortuna adiuvat."' },
    magister: { tab: 'mastery', title: 'Schola del Magister',    ico: 'ico_book',   say: '"Nulla dies sine linea."' },
    magister_away: { tab: 'away', title: 'Schola del Magister',  ico: 'ico_book',   say: '"Torno subito." — c\'è scritto sulla porta.' },
    haruspex: { tab: 'omens',   title: "Templum dell'Aruspice",  ico: 'ico_greed',  say: '"Alea iacta est."' },
  },

  closeShop() {
    if (G.state !== 'shop') return;
    if (this.shopReturn === 'village') { setState('village'); this.villagePrompt(Village.near); }
    else if (this.shopReturn === 'run') { Player.invT = Math.max(Player.invT, 1.2); acc = 0; setState('play'); }   // dal Magister nella Cattedrale: si riprende
    else goToMenu();
  },

  openShop(tab, ret) {
    const V = this.VENDORS[tab];
    if (V) { this.shopVendor = tab; tab = V.tab; $('shop-title').textContent = V.title; $('shop-ico').src = SPR.url[V.ico]; $('shop-say').textContent = V.say; }
    this.shopReturn = ret || 'village';
    if (!this._shopInit) {
      this._shopInit = true;
      document.querySelectorAll('#shop-tabs .tab').forEach((b) => b.addEventListener('click', () => { this.shopTab = b.dataset.tab; this.shopMsg(''); this.renderShop(); }));
      $('shop-panel').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-buy]');
        if (b && !b.disabled) this.shopAction(b.dataset.buy, b.dataset.id);
      });
    }
    this.shopTab = tab || this.shopTab;
    this.shopMsg('');
    setState('shop');
    this.renderShop();
  },

  price(n) { return '<span class="pricetag"><img src="' + SPR.url.coin + '">' + n + '</span>'; },

  renderShop() {
    const d = Save.data, P = $('shop-panel');
    $('shop-coins').textContent = d.coins;
    document.querySelectorAll('#shop-tabs .tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.shopTab));
    let h = '';
    if (this.shopTab === 'items') {
      const sl = Save.shopLevel(this.shopVendor);
      for (const id in SHOP_ITEMS) {
        if (SHOP_ITEMS[id].vendor !== this.shopVendor) continue;
        const it = SHOP_ITEMS[id], L = Save.itemLevel(id), owned = L >= 0, avail = (it.shopLv || 0) <= sl;
        const val = owned ? Save.itemValue(id) : it.base;
        const desc = it.fmtL ? it.fmtL(Math.max(0, L)) : it.fmt(val);
        const equipped = it.gear && owned && Save.gearId() === id;
        let btn;
        if (!avail) btn = '<button class="btn" disabled>Bottega Lv ' + it.shopLv + '</button>';
        else if (it.gear && owned) btn = equipped ? '<button class="btn" disabled>Equipaggiato</button>' : '<button class="btn" data-buy="equip" data-id="' + id + '">Equipaggia</button>';
        else if (owned) btn = '<button class="btn" disabled>Posseduto</button>';
        else btn = '<button class="btn" data-buy="item" data-id="' + id + '"' + (d.coins < it.price ? ' disabled' : '') + '>Compra ' + this.price(it.price) + '</button>';
        h += '<div class="srow' + (owned ? '' : ' locked') + (equipped ? ' sel' : '') + (avail ? '' : ' unavail') + '"><div class="simg sunken"><img src="' + SPR.url[SPR.itemIcon(id, L)] + '"></div>' +
          '<div><span class="sname">' + (avail ? it.name : '???') + '</span>' + (owned && avail ? '<span class="slv">+' + L + '</span>' : '') +
          '<div class="sdesc">' + (avail ? desc : 'Migliora la bottega per vederlo in vendita.') + '</div></div>' + btn + '</div>';
      }
      h = this.shopUpBar(this.shopVendor) + h;
    } else if (this.shopTab === 'quests') {
      // linguette delle categorie (con il numero di missioni da riscuotere)
      if (!QUEST_CATS[this.questCat]) this.questCat = 'caedes';
      let tabs = '<div class="qcats">';
      for (const c in QUEST_CATS) {
        let ready = 0, tot = 0, got = 0;
        for (const q of QUESTS) if (q.cat === c) { tot++; if (d.quests[q.id]) got++; else if (q.check(d)) ready++; }
        tabs += '<button class="tab' + (c === this.questCat ? ' on' : '') + '" data-buy="qcat" data-id="' + c + '">' + QUEST_CATS[c].name +
          ' <small>' + got + '/' + tot + '</small>' + (ready ? '<i class="qdot">' + ready + '</i>' : '') + '</button>';
      }
      h += tabs + '</div>';
      for (const q of QUESTS) {
        if (q.cat !== this.questCat) continue;
        const claimed = !!d.quests[q.id], done = !claimed && q.check(d);
        let prog = '';
        if (!claimed && !done && q.prog) { const pr = q.prog(d); prog = ' (' + Math.min(pr[0], pr[1]).toLocaleString('it-IT') + ' / ' + pr[1].toLocaleString('it-IT') + ')'; }
        h += '<div class="srow qrow' + (claimed ? ' claimed' : done ? ' ready' : '') + '"><div class="simg sunken"><img src="' + SPR.url[claimed ? 'ico_check' : done ? 'coin' : 'ico_scroll'] + '"></div>' +
          '<div><span class="sname">' + q.name + '</span><div class="sdesc">' + q.desc + prog + '</div></div>' +
          (claimed ? '<button class="btn" disabled>Riscossa</button>'
                   : done ? '<button class="btn default" data-buy="quest" data-id="' + q.id + '">Riscuoti ' + this.price(q.reward) + '</button>'
                          : '<button class="btn" disabled>' + this.price(q.reward) + '</button>') + '</div>';
      }
    } else if (this.shopTab === 'away') {
      // il Magister non c'è più: è sceso nella Cattedrale (MAGISTER_CAMP)
      const open = Save.mapUnlocked(MAGISTER_CAMP.map);
      h = '<div class="hint" style="padding:10px;line-height:1.5">"' + MAPS[MAGISTER_CAMP.map].short + '. A destra. La lanterna."<br>— il Magister</div>';
    } else if (this.shopTab === 'mastery') {
      // RICETTE DI FUSIONE: si comprano una volta sola; poi in partita arriva il Custode (TRIAL), battuto = sbloccata per sempre
      for (const k in FUSION_SPECIAL) {
        const sp = FUSION_SPECIAL[k], ids = k.split('+'), st = Save.recipeState(k);
        const pair = WEAPON_DEFS[ids[0]].name + ' + ' + WEAPON_DEFS[ids[1]].name;
        h += '<div class="srow arow"><div class="simg sunken"><img src="' + SPR.url[RECIPE.icon] + '"></div>' +
          '<div><span class="sname">' + sp.name + '</span> <span class="slv">' + pair + '</span>' +
          '<div class="sdesc">' + sp.desc + (st === 1 ? ' <b>Custode: ' + sp.custode.name + ', arriva al ' + fmtTime(TRIAL.time) + '.</b>' : '') + '</div></div>' +
          (st === 2 ? '<button class="btn" disabled>Sbloccata</button>'
           : st === 1 ? '<button class="btn" disabled>Da battere</button>'
           : '<button class="btn" data-buy="recipe" data-id="' + k + '"' + (d.coins < RECIPE.price ? ' disabled' : '') + '>Compra ' + this.price(RECIPE.price) + '</button>') + '</div>';
      }
      for (const id in PASSIVE_DEFS) {
        if (MASTERY.exclude.indexOf(id) >= 0) continue;
        const p = PASSIVE_DEFS[id], r = Save.masteryRank(id), max = r >= MASTERY.max, cost = Save.masteryCost(id);
        let pips = '';
        for (let k = 0; k < MASTERY.max; k++) pips += '<i class="' + (k < r ? 'on' : '') + '"></i>';
        const now = scaleDesc(p.desc, Save.masteryMult(id)), next = scaleDesc(p.desc, 1 + MASTERY.bonus * (r + 1));
        h += '<div class="srow"><div class="simg sunken"><img src="' + SPR.url[p.icon] + '"></div>' +
          '<div><span class="sname">' + p.name + '</span> <span class="uppips">' + pips + '</span>' +
          '<div class="sdesc">' + now + (max ? '' : ' → ' + (next.match(/[+-]?\d+(?:\.\d+)?%?/) || [''])[0]) + '</div></div>' +
          (max ? '<button class="btn" disabled>Perfecta</button>'
               : '<button class="btn" data-buy="mastery" data-id="' + id + '"' + (d.coins < cost ? ' disabled' : '') + '>Studia ' + this.price(cost) + '</button>') + '</div>';
      }
    } else if (this.shopTab === 'omens') {
      let any = false;
      const gear = Save.gearId();
      for (const id in SHOP_ITEMS) {
        const it = SHOP_ITEMS[id], L = Save.itemLevel(id);
        if (L < 0) continue;
        any = true;
        const list = Save.omenList(id), off = it.gear && id !== gear;
        let lines = '';
        for (let k = 0; k < Save.omenSlots(); k++) {
          const o = list[k];
          if (o) {
            const R = OMENS.rarity[o.r], K = OMENS.kinds[o.k];
            lines += '<div class="omen"><span style="color:' + R.col + '"><b>' + K.name + '</b> ' + K.fmt(o.v) + '</span>' +
              '<button class="btn mini" data-buy="omen" data-id="' + id + ':' + k + '"' + (d.coins < OMENS.reroll ? ' disabled' : '') + '>↻ ' + this.price(OMENS.reroll) + '</button></div>';
          } else {
            const first = list.indexOf(null) === k, cost = Save.omenReadCost(id);
            lines += '<div class="omen empty"><span>· · ·</span>' + (first ? '<button class="btn mini" data-buy="omen" data-id="' + id + ':' + k + '"' + (d.coins < cost ? ' disabled' : '') + '>Leggi ' + this.price(cost) + '</button>' : '') + '</div>';
          }
        }
        h += '<div class="srow orow' + (off ? ' off' : '') + '"><div class="simg sunken"><img src="' + SPR.url[SPR.itemIcon(id, L)] + '"></div>' +
          '<div class="ocol"><span class="sname">' + it.name + '</span><span class="slv">+' + L + '</span>' + (off ? '<span class="slv">non equipaggiato</span>' : '') + lines + '</div></div>';
      }
      if (!any) h = '<div class="hint" style="padding:10px">"Nihil video."</div>';
    } else if (this.shopTab === 'smith') {
      let any = false;
      for (const id in SHOP_ITEMS) {
        const it = SHOP_ITEMS[id], L = Save.itemLevel(id);
        if (L < 0) continue;
        any = true;
        const max = L >= SMITH.maxLevel;
        const cost = max ? 0 : Save.smithCost(id);
        const odds = max ? '' : Math.round(Save.smithChance(id, this.useStone) * 100) + '%';
        h += '<div class="srow"><div class="simg sunken"><img src="' + SPR.url[SPR.itemIcon(id, L)] + '"></div>' +
          '<div><span class="sname">' + it.name + '</span><span class="slv">+' + L + (max ? ' (MAX)' : ' → +' + (L + 1)) + '</span>' +
          '<div class="sdesc">' + (it.fmtL ? it.fmtL(L) + (max ? '' : ' → ' + it.fmtL(L + 1).replace(/^[^:]*: /, '')) : it.fmt(Save.itemValue(id)) + (max ? '' : ' → ' + it.fmt(it.base + it.per * (L + 1)))) + '</div>' +
          (max ? '' : '<div class="sodds">' + odds + '</div>') + '</div>' +
          (max ? '<button class="btn" disabled>Al massimo</button>'
               : '<button class="btn" data-buy="smith" data-id="' + id + '"' + (d.coins < cost ? ' disabled' : '') + '>Rafforza ' + this.price(cost) + '</button>') +
          '</div>';
      }
      if (!any) h = '<div class="hint" style="padding:10px">"Non hai niente da farmi battere."</div>';
      // Pietre del Fabbro
      const st = d.stones || 0;
      if (this.useStone && st <= 0) this.useStone = false;
      h = this.shopUpBar('smith') + '<div class="stonebar"><div class="check' + (this.useStone ? ' on' : '') + (st > 0 ? '' : ' off') + '" id="use-stone"><i></i><span>Usa una Pietra del Fabbro (+' +
        Math.round(STONE.bonus * 100) + '% di successo)</span></div><span class="stones"><img src="' + SPR.url.stone + '">' + st + '</span></div>' + h;
    } else {
      // LOCANDA: potenziamenti permanenti di Eek (TRAITS) + le abilità e come si sbloccano
      for (const id in TRAITS) {
        const t = TRAITS[id], L = Save.traitLevel(id), max = L >= t.costs.length, cost = Save.traitCost(id);
        let pips = '';
        for (let k = 0; k < t.costs.length; k++) pips += '<i class="' + (k < L ? 'on' : '') + '"></i>';
        h += '<div class="srow trow"><div class="simg sunken"><img src="' + SPR.url[t.icon] + '"></div>' +
          '<div><span class="sname">' + t.name + '</span> <span class="uppips">' + pips + '</span>' +
          '<div class="sdesc">' + (L ? t.fmt(L) : 'Niente, per ora.') + (max ? '' : ' → ' + t.fmt(L + 1)) + '</div></div>' +
          (max ? '<button class="btn" disabled>Al massimo</button>'
               : '<button class="btn" data-buy="trait" data-id="' + id + '"' + (d.coins < cost ? ' disabled' : '') + '>Compra ' + this.price(cost) + '</button>') + '</div>';
      }
      for (const id in SKILLS) {
        const k = SKILLS[id], open = Save.skillOpen(id);
        h += '<div class="srow skrow' + (open ? '' : ' locked') + '"><div class="simg sunken"><b class="sklbl">' + k.label + '</b></div>' +
          '<div><span class="sname">' + k.name + '</span><div class="sdesc">' + (open ? k.desc : 'Abilità: si sblocca vincendo ' + MAPS[k.win].name + '.') + '</div></div>' +
          '<button class="btn" disabled>' + (open ? 'Sbloccata' : 'Bloccata') + '</button></div>';
      }
    }
    P.innerHTML = h;
    const us = $('use-stone');
    if (us) us.addEventListener('click', () => { if ((Save.data.stones || 0) > 0) { this.useStone = !this.useStone; this.renderShop(); } });
  },
  useStone: false,
  questCat: 'caedes',

  // barra "migliora bottega" in cima alla finestra del venditore
  shopUpBar(v) {
    const U = SHOP_UPGRADES[v];
    if (!U) return '';
    const L = Save.shopLevel(v), max = L >= U.costs.length, cost = Save.shopUpCost(v);
    let pips = '';
    for (let k = 0; k < U.costs.length; k++) pips += '<i class="' + (k < L ? 'on' : '') + '"></i>';
    return '<div class="upbar"><div><b>Bottega Lv ' + L + '</b> <span class="uppips">' + pips + '</span>' +
      '<div class="sdesc">' + (max ? 'Bottega al massimo.' : 'Prossimo livello: ' + U.unlocks[L] + '.') + '</div></div>' +
      (max ? '' : '<button class="btn" data-act="shop-up"' + (Save.data.coins < cost ? ' disabled' : '') + '>Migliora ' + this.price(cost) + '</button>') + '</div>';
  },

  shopMsg(t, cls) {
    const m = $('shop-msg');
    m.textContent = t;
    m.className = 'shop-msg' + (cls ? ' ' + cls + ' anim' : '');
  },

  shopAction(kind, id) {
    if (kind === 'item') {
      if (Save.buyItem(id)) { Sfx.play('buy'); this.shopMsg(SHOP_ITEMS[id].name + ' comprato!' + (SHOP_ITEMS[id].gear ? ' Equipaggiato.' : '') + ' Il Fabbro può rafforzarlo.', 'ok'); }
    } else if (kind === 'equip') {
      Save.data.gear = id; Save.write(); Sfx.play('buy');
      this.shopMsg(SHOP_ITEMS[id].name + ' equipaggiato: lo porti nella prossima partita.', 'ok');
    } else if (kind === 'shopup') {
      if (Save.upgradeShop(id)) { Sfx.play('anvil'); this.shopMsg('Bottega migliorata! ' + SHOP_UPGRADES[id].unlocks[Save.shopLevel(id) - 1] + '.', 'ok'); }
    } else if (kind === 'qcat') {
      this.questCat = id;
    } else if (kind === 'recipe') {
      if (Save.buyRecipe(id)) { Sfx.play('buy'); this.shopMsg('Ricetta di ' + FUSION_SPECIAL[id].name + ' comprata! Nella prossima discesa ti aspetta ' + FUSION_SPECIAL[id].custode.name + ': battilo.', 'ok'); }
    } else if (kind === 'mastery') {
      if (Save.buyMastery(id)) { if (G.scene === 'run') Player.recalcStats(); Sfx.play('quest'); this.shopMsg(PASSIVE_DEFS[id].name + ' ' + 'I II III'.split(' ')[Save.masteryRank(id) - 1] + '.', 'ok'); }
    } else if (kind === 'omen') {
      const [item, sl] = id.split(':'), o = Save.readOmen(item, +sl);
      if (o) {
        const R = OMENS.rarity[o.r], K = OMENS.kinds[o.k];
        Sfx.play(o.r === 2 ? 'quest' : 'buy');
        this.shopMsg(R.name + ': ' + K.name + ' ' + K.fmt(o.v), o.r ? 'ok' : '');
      }
    } else if (kind === 'quest') {
      const q = QUESTS.find((x) => x.id === id);
      if (Save.claimQuest(id)) { Sfx.play('quest'); this.shopMsg('Missione "' + q.name + '" riscossa: +' + q.reward + ' monete!', 'ok'); }
    } else if (kind === 'smith') {
      const name = SHOP_ITEMS[id].name, r = Save.smith(id, this.useStone), L = Save.itemLevel(id);
      if ((Save.data.stones || 0) <= 0) this.useStone = false;
      if (r === 'ok') { Sfx.play('anvil'); this.shopMsg('Colpo perfetto! ' + name + ' +' + L + '.', 'ok'); }
      else if (r === 'fail') { Sfx.play('crack'); this.shopMsg('Il ferro si è incrinato... ' + name + ' resta a +' + L + '.', 'bad'); }
      else if (r === 'broken') { Sfx.play('crack'); this.shopMsg('Crack! ' + name + ' si è rotto.', 'bad'); }
    } else if (kind === 'trait') {
      if (Save.buyTrait(id)) { if (G.scene === 'run') Player.recalcStats(); Sfx.play('quest'); this.shopMsg(TRAITS[id].name + ' Lv ' + Save.traitLevel(id) + ': ' + TRAITS[id].fmt(Save.traitLevel(id)) + '.', 'ok'); }
    }
    this.renderShop();
  },

  // ---- level up ---------------------------------------------------------------
  openLevelUp() { this.showCards(Upgrades.roll()); },

  // rilancia le 3 carte (REROLL.perRun a partita): escono prima carte diverse da quelle appena viste
  reroll() {
    if (G.state !== 'levelup' || G.rerolls <= 0) return;
    G.rerolls--;
    Sfx.play('click');
    this.showCards(Upgrades.roll(Upgrades.options));
  },

  showCards(opts) {
    const rb = $('reroll-btn');
    $('reroll-n').textContent = G.rerolls;
    rb.disabled = G.rerolls <= 0;
    const box = $('cards');
    box.innerHTML = '';
    this.cardEls = [];
    $('lvl-title').textContent = 'Level Up! — Livello ' + (Player.level - G.pendingLevels + 1);
    opts.forEach((o, i) => {
      const d = Upgrades.describe(o);
      const b = document.createElement('button');
      b.className = 'btn card' + (d.evo ? ' evo' : '') + (d.fuse ? ' fuse' : '') + (d.secret ? ' secret' : '');
      // fusione: le due armi una sopra l'altra + lo scrigno [?] nell'angolo
      const img = d.fuse ? '<img class="f1" src="' + iconUrl(weaponIcon(d.fw[0]), d.fw[0].evolved) + '"><img class="f2" src="' + iconUrl(weaponIcon(d.fw[1]), d.fw[1].evolved) + '"><img class="fq" src="' + SPR.url[d.icon] + '">'
        : '<img src="' + ((d.evo ? SPR.neonUrl(d.icon) : SPR.url[d.icon]) || '') + '">';
      b.innerHTML =
        '<div class="ch"><div class="cimg sunken' + (d.fuse ? ' fimg' : '') + '">' + img + '</div>' +
        '<div><div class="cname"></div><div class="ckind"></div></div></div>' +
        '<div class="badge"></div><div class="cdesc"></div><div class="ckey">[' + (i + 1) + ']</div>';
      b.querySelector('.cname').textContent = d.name;
      b.querySelector('.ckind').textContent = d.kind;
      b.querySelector('.badge').textContent = d.badge;
      b.querySelector('.cdesc').textContent = d.desc;
      b.addEventListener('click', () => this.pick(i));
      b.addEventListener('mouseenter', () => this.select(i));
      box.appendChild(b);
      this.cardEls.push(b);
    });
    this.select(-1);
    this.lvlOpenAt = performance.now();
  },

  select(i) {
    this.sel = i;
    this.cardEls.forEach((el, k) => el.classList.toggle('sel', k === i));
  },

  pick(i) {
    if (G.state !== 'levelup') return;
    if (performance.now() - this.lvlOpenAt < 350) return; // evita scelte involontarie mentre stavi premendo tasti
    const o = Upgrades.options[i];
    if (!o) return;
    Upgrades.apply(o);
    G.pendingLevels--;
    this.refreshSlots();
    if (G.pendingLevels > 0) this.openLevelUp();
    else setState('play');
  },

  levelUpKeys() {
    if (Input.consume('Digit1') || Input.consume('Numpad1')) this.pick(0);
    else if (Input.consume('Digit2') || Input.consume('Numpad2')) this.pick(1);
    else if (Input.consume('Digit3') || Input.consume('Numpad3')) this.pick(2);
    else if (Input.consume('KeyR')) this.reroll();
    else if (Input.consume('ArrowLeft') || Input.consume('KeyA')) this.select(this.sel <= 0 ? 2 : this.sel - 1);
    else if (Input.consume('ArrowRight') || Input.consume('KeyD')) this.select(this.sel >= 2 ? 0 : this.sel + 1);
    else if ((Input.consume('Enter') || Input.consume('Space')) && this.sel >= 0) this.pick(this.sel);
  },

  // ---- HUD --------------------------------------------------------------------
  refreshSlots() {
    const mk = (row, items, max, isW) => {
      const box = $(row);
      box.innerHTML = '';
      for (let i = 0; i < max; i++) {
        const it = items[i];
        const s = document.createElement('div');
        s.className = 'slot sunken' + (it ? '' : ' empty') + (it && isW && it.evolved ? ' evo' : '');
        if (it) {
          const lvMax = isW ? it.def.levels.length : pMax(it.id);
          const icon = isW && it.evolved ? it.def.evo.icon : it.def.icon;
          s.title = (isW && it.evolved ? it.def.evo.name : it.def.name) + ' — Lv ' + it.level;
          let pips = '';
          for (let k = 0; k < lvMax; k++) pips += '<i class="' + (k < it.level ? 'on' : '') + '"></i>';
          s.innerHTML = '<img src="' + ((isW && it.evolved ? SPR.neonUrl(icon) : SPR.url[icon]) || '') + '"><div class="pips">' + pips + '</div>';
        }
        box.appendChild(s);
      }
    };
    mk('wslots', Player.weapons.filter((w) => !w.gear && !w.fusedInto), CFG.MAX_WEAPONS, true);
    // armi fuse: un posto solo con le due icone e il bordo magenta
    const wb = $('wslots').children;
    let k = 0;
    for (const w of Player.weapons) {
      if (w.gear || w.fusedInto) continue;
      const el = wb[k++];
      if (!w.fusedWith || !el) continue;
      el.classList.add('fuse');
      el.title = fuseName(w, w.fusedWith) + ' (fuse)';
      el.innerHTML = '<img class="f1" src="' + iconUrl(weaponIcon(w), w.evolved) + '"><img class="f2" src="' + iconUrl(weaponIcon(w.fusedWith), w.fusedWith.evolved) + '">';
    }
    const gear = Player.weapons.find((w) => w.gear);
    if (gear) {
      const s = document.createElement('div');
      s.className = 'slot sunken gear';
      s.title = weaponName(gear) + " (dall'Armaiolo)";
      let pips = '';
      for (let k = 0; k < gear.def.levels.length; k++) pips += '<i class="' + (k < gear.level ? 'on' : '') + '"></i>';
      s.innerHTML = '<img src="' + SPR.url[weaponIcon(gear)] + '"><div class="pips">' + pips + '</div>';
      $('wslots').appendChild(s);
    }
    mk('pslots', Player.passives, CFG.MAX_PASSIVES, false);
  },

  update(dtReal) {
    const xp = Math.min(100, (Player.xp / Player.xpNext) * 100) | 0;
    if (xp !== this._xp) { this._xp = xp; $('xpfill').style.width = xp + '%'; }
    if (Player.level !== this._lvl) { this._lvl = Player.level; $('lvl').textContent = 'LV ' + Player.level; }
    if (G.kills !== this._kills) { this._kills = G.kills; $('t-kills').textContent = G.kills; }

    const inMenu = G.state === 'menu' || G.state === 'records' || (G.state === 'shop' && this.shopReturn !== 'run') || G.state === 'village' || (G.state === 'options' && this.optReturn !== 'paused');
    const coins = inMenu ? Save.data.coins : G.runCoins;
    if (coins !== this._coins) { this._coins = coins; $('t-coins').textContent = coins; }

    // orologio: tempo di gioco durante la partita, ora reale nel menu (come Win98)
    if (inMenu) {
      const d = new Date(), c = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      if (c !== this._clock) { this._clock = c; $('t-clock').textContent = c; }
      this._sec = -1;
    } else {
      const sec = G.time | 0;
      if (sec !== this._sec) { this._sec = sec; this._clock = ''; $('t-clock').textContent = fmtTime(sec); }
    }

    // tasti TELE e abilità: anello di ricarica
    if (G.state === 'play' && Input.isTouch) {
      for (const id in SKILLS) {
        if (!Player.skill[id]) continue;
        const c = Player.skillCd[id], q = c > 0 ? Math.round(Math.max(0, Math.min(1, 1 - c / Player.skillCdMax(id))) * 40) / 40 : 1;
        if (q !== this['_skQ' + id]) {
          this['_skQ' + id] = q;
          const b = $('sk-' + id);
          b.style.setProperty('--cd', q);
          b.classList.toggle('ready', q >= 1);
        }
      }
      if (Player.tele) {
        const tcd = Player.teleCdMax();
        const rt = Player.teleCd > 0 ? Math.max(0, Math.min(1, 1 - Player.teleCd / tcd)) : 1, qt = Math.round(rt * 40) / 40;
        if (qt !== this._teleQ) {
          this._teleQ = qt;
          const b = $('telebtn');
          b.style.setProperty('--cd', qt);
          b.classList.toggle('ready', qt >= 1);
        }
      }
    }

    if (Boss.active) {
      Boss.sumHp();
      const pct = Math.max(0, Math.ceil(Boss.hp / Boss.maxHp * 100));
      if (pct !== this._bossPct) { this._bossPct = pct; $('boss-fill').style.width = pct + '%'; }
    }

    if (G.debug) {
      this.dbgT -= dtReal;
      if (this.dbgT <= 0) {
        this.dbgT = 0.25;
        $('dbg').textContent =
          'FPS        ' + G.stats.fps.toFixed(0) + '\n' +
          'update     ' + G.stats.upd.toFixed(2) + ' ms\n' +
          'render     ' + G.stats.rnd.toFixed(2) + ' ms\n' +
          'nemici     ' + Enemies.count + '\n' +
          'proiettili ' + Projectiles.count + '\n' +
          'gemme      ' + Gems.count + '\n' +
          'canvas     ' + Render.W + 'x' + Render.H + ' x' + Render.zoom +
          (G.god ? '\n[INVINCIBILE]' : '');
      }
    }
  },

  // ---- boss e avvisi -------------------------------------------------------------
  _bossPct: -1,
  // VELOCITÀ x2 (tasto F o il bottone x2 nella HUD): la partita corre al doppio, resta accesa finché non la spegni
  toggleFast(on) {
    const S = Save.data.settings;
    S.fast = on === undefined ? !S.fast : !!on;
    Save.write();
    this.syncFast();
    if (G.state === 'play') this.toast(S.fast ? 'x2' : 'x1', '', 1.2);
  },
  syncFast() { const b = $('fastbtn'); if (b) b.classList.toggle('on', !!Save.data.settings.fast); },

  showBoss(on) {
    $('bossbar').classList.toggle('show', on);
    if (on) $('boss-name').textContent = bossNames();
    this._bossPct = -1;
  },

  _toastTimer: 0, _toastHold: 0, _toastNext: null,
  // important = resta su per tutti i suoi secondi: gli avvisi normali arrivati nel frattempo aspettano la fine
  // (es. lo sblocco segreto all'11:00 cade proprio sull'"Aurora" della notte)
  toast(title, msg, secs, important) {
    const now = performance.now();
    if (!important && now < this._toastHold) { this._toastNext = [title, msg, secs]; return; }
    this._toastHold = important ? now + (secs || 4) * 1000 : 0;
    $('toast-title').textContent = title;
    $('toast-msg').textContent = msg || '';
    const el = $('toast');
    el.classList.toggle('bare', !msg);   // senza testo: solo il nome
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      el.classList.remove('show');
      const n = this._toastNext; this._toastNext = null;
      if (n && important) setTimeout(() => this.toast(n[0], n[1], n[2]), 250);
    }, (secs || 4) * 1000);
  },

  setDebug(on) { $('w-debug').classList.toggle('show', on); },

  // schermata finale: GAME OVER (rosso e bianco) oppure VITTORIA, con resoconto nero
  // mode: 'win' | 'dead' | 'endless' (morto in modalità infinita dopo aver vinto)
  showEnd(mode, record, unlocked) {
    const victory = mode === 'win';
    const t = fmtTime(G.time), ch = CHARACTERS[Save.data.char];
    $('m-dead').classList.toggle('win', victory);
    $('end-continue').hidden = !victory;
    $('end-title').innerHTML = victory ? '<span class="w">VIT</span><span class="r">TORIA</span>' : '<span class="w">GAME</span> <span class="r">OVER</span>';
    $('end-sub').innerHTML = '';
    const sub = document.createElement('span');
    sub.textContent = victory ? ch.name + ' ha resistito all\'Inferno per '
      : mode === 'endless' ? 'Vittoria, poi modalità infinita: ' + ch.name + ' ha resistito fino a ' : ch.name + ' è stato dissolto in ';
    const b = document.createElement('b'); b.id = 'd-time'; b.textContent = t;
    $('end-sub').appendChild(sub); $('end-sub').appendChild(b);
    $('d-time2').textContent = t;
    $('d-map').textContent = G.map.name;
    $('d-kills').textContent = G.kills;
    $('d-level').textContent = Player.level;
    $('d-coins').textContent = '+' + G.runCoins;
    $('d-bonus').textContent = '+' + (G.runBonus || 0) + '  (' + COIN.perMinute * G.diff.coin + '/min)';
    $('d-bank').textContent = Save.data.coins;
    // danno per arma, dalla più forte (due armi fuse = una riga sola)
    const ws = weaponRows().sort((a, c) => c.dealt - a.dealt);
    const tot = ws.reduce((n, r) => n + r.dealt, 0) || 1;
    let h = '';
    for (const r of ws) {
      const w = r.w, pct = Math.round(r.dealt / tot * 100);
      h += '<div class="wrow' + (w.evolved ? ' evo' : '') + (r.f ? ' fuse' : '') + '"><img src="' + iconUrl(weaponIcon(w), w.evolved) + '"><span class="wn"></span><span class="wd">' + Math.round(r.dealt).toLocaleString('it-IT') +
        '</span><div class="wbar"><i style="width:' + pct + '%"></i></div></div>';
    }
    $('d-weapons').innerHTML = h || '<div class="hint">Nessun danno.</div>';
    $('d-weapons').querySelectorAll('.wn').forEach((el, k) => { el.textContent = ws[k].name; });
    const r = Save.data.records[G.mapId + '/' + G.diffId];
    let rec = record ? 'NUOVO RECORD per ' + G.map.short + '!' : 'Record su questa mappa: ' + fmtTime(r ? (r.endless || r.t) : 0);
    if (victory) rec = 'Mappa completata!' + (unlocked ? ' Hai sbloccato: ' + unlocked + '.' : '') + ' +' + WIN.reward.coins * G.diff.coin + ' monete.';
    if (G.cheat) rec = 'Partita coi trucchi del debug: non conta (niente monete, record, sblocchi né missioni).';
    // presa dalla MORTE (minuto 14): il suo ritratto sopra al titolo
    const reaped = G.killedBy === 'death' && !victory;
    $('m-dead').classList.toggle('reaped', reaped);
    $('end-reaper').hidden = !reaped;
    if (reaped) {
      $('end-title').innerHTML = '<span class="w">LA</span> <span class="r">MORTE</span>';
      sub.textContent = 'La Morte ha preso ' + ch.name + ' a ';
    }
    $('d-record').textContent = rec;
    $('d-quests').hidden = true;
  },

  // ---- forziere -------------------------------------------------------------------
  openChest(n) {
    const list = Upgrades.openChest(n);
    $('chest-title').textContent = list.length > 1 ? 'Forziere pieno! ' + list.length + ' potenziamenti' : 'Hai aperto un forziere!';
    let h = '';
    for (const d of list) {
      h += '<div class="crow' + (d.evo ? ' evo' : '') + '"><img src="' + ((d.evo ? SPR.neonUrl(d.icon) : SPR.url[d.icon]) || '') + '"><div><b></b><span class="cb"></span><div class="cd"></div></div></div>';
    }
    const box = $('chest-list');
    box.innerHTML = h;
    box.querySelectorAll('.crow').forEach((el, k) => {
      el.querySelector('b').textContent = list[k].name;
      el.querySelector('.cb').textContent = list[k].badge;
      el.querySelector('.cd').textContent = list[k].desc;
      el.style.animationDelay = (k * 0.18) + 's';
    });
    this.refreshSlots();
    this.chestAt = performance.now();
  },
  closeChest() {
    if (G.state !== 'chest' || performance.now() - this.chestAt < 400) return;
    afterChest();
  },

  // ---- pausa: la build della partita ----------------------------------------------
  renderBuild() {
    const P = Player;
    let h = '<div class="build"><div><div class="end-h2">Armi</div>';
    for (const r of weaponRows()) {
      h += '<div class="brow' + (r.f ? ' fuse' : '') + '"><img src="' + SPR.url[weaponIcon(r.w)] + '"><span>' + esc(r.name) + '</span><b>' + Math.round(r.dealt).toLocaleString('it-IT') + '</b></div>';
    }
    h += '<div class="end-h2" style="margin-top:6px">Passive</div>';
    if (!P.passives.length) h += '<div class="hint">Nessuna.</div>';
    for (const p of P.passives) h += '<div class="brow"><img src="' + SPR.url[p.def.icon] + '"><span>' + esc(p.def.name) + '</span><b>Lv ' + p.level + '</b></div>';
    const pct = (v) => (v >= 0 ? '+' : '') + Math.round(v * 100) + '%';
    const rows = [
      ['Vita', Math.ceil(P.hp) + ' / ' + P.maxHp], ['Danno', pct(P.dmgMult - 1)], ['Ricarica', pct(P.cdMult - 1)], ['Area', pct(P.areaMult - 1)],
      ['Velocità', Math.round(P.speed)], ['Armatura', '-' + P.armor], ['Rigenera', P.regen.toFixed(2) + '/s'], ['Magnete', Math.round(P.magnet)],
      ['Esperienza', pct(P.xpMult - 1)], ['Schivata', Math.round(P.dodge * 100) + '%'],
      ['Proiettili', '+' + P.amount], ['Monete', pct(P.coinMult - 1)],
    ];
    h += '</div><div><div class="end-h2">Statistiche</div><table class="bstats">';
    for (const r of rows) h += '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>';
    h += '</table><div class="hint">' + esc(G.map.name) + ' · ' + G.diff.label + ' · ' + fmtTime(G.time) + (G.endless ? ' · infinita' : '') + '</div></div></div>';
    $('pause-build').innerHTML = h;
  },

  tipIdx: 0,

};

function fmtTime(sec) {
  sec = sec | 0;
  const m = (sec / 60) | 0, s = sec % 60;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

// nome e icona di un'arma come la vede il giocatore
function weaponName(w) {
  if (w.gear) return SHOP_ITEMS[w.id].name + ' +' + (w.level - 1);
  return w.evolved ? w.def.evo.name : w.def.name + ' L' + w.level;
}
function weaponIcon(w) {
  if (w.gear) return SPR.itemIcon(w.id, w.level - 1);
  return w.evolved ? w.def.evo.icon : w.def.icon;
}
function iconUrl(name, neon) { return (neon ? SPR.neonUrl(name) : SPR.url[name]) || ''; }
// righe "armi" per pausa e resoconto: due armi fuse diventano una riga sola (nome doppio, danno sommato)
function weaponRows() {
  const out = [];
  for (const w of Player.weapons) {
    if (w.fusedInto) continue;
    const f = w.fusedWith || null;
    out.push({ w, f, name: f ? fuseName(w, f) : weaponName(w), dealt: w.dealt + (f ? f.dealt : 0) });
  }
  return out;
}
function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
