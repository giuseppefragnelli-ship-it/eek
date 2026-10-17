'use strict';
// js/06_save.js — Save (localStorage) + Cloud (salvataggio online)

// ============================================================================
// SAVE — salvataggio permanente.
//  1. localStorage del browser (sempre, immediato)
//  2. SALVATAGGIO ONLINE (Cloud): quando il gioco è aperto dal link di
//     claude.ai, i dati vengono copiati anche nel tuo spazio privato della
//     pagina, così telefono e PC condividono monete e progressi. All'avvio
//     vince il salvataggio più recente.
//  3. CODICE DI SALVATAGGIO: esporta/importa tutto come testo (funziona
//     ovunque, anche aprendo il file dal PC).
// ============================================================================

const Save = {
  KEY: 'slimeSurvivors98.save.v1',
  data: null,

  defaults() {
    return {
      coins: 0,             // monete in banca
      totalCoins: 0,        // monete raccolte in tutta la carriera
      runs: 0,
      bestTime: 0,
      bestKills: 0,
      bestLevel: 0,
      difficulty: DEFAULT_DIFFICULTY,
      items: {},            // oggetti: id -> livello fabbro (0..5); assente = non posseduto
      chars: ['eek'],       // personaggi sbloccati
      char: 'eek',          // personaggio scelto
      stones: 0,            // Pietre del Fabbro
      wins: {},             // mappe vinte: id -> true
      map: 'cripta',        // mappa scelta
      savedAt: 0,           // ms dell'ultimo salvataggio (per scegliere il più recente tra telefono e PC)
      migr: 3,              // versione dei dati salvati
      gear: 'dagger',       // arma dell'Armaiolo che porti in partita
      shops: { weapons: 0, armor: 0, smith: 0 },   // livello delle botteghe
      mastery: {},          // Magister: passiva -> grado (0..3)
      omens: {},            // Aruspice: oggetto -> [omen|null, omen|null], omen = { k, v, r }
      quests: {},           // missioni riscosse: id -> true
      stats: { kills: 0, bosses: {}, elites: 0, chests: 0, evos: 0, winsDiff: {}, endlessBest: 0, omens: 0 },
      records: {},          // 'mappa/difficoltà' -> { t, k, lv, win, endless }
      tips: {},             // consigli già visti
      settings: { joy: 'float', shake: true, numbers: true, flash: true, sfx: true, vol: 'mid' }, // joy: 'float' | 'left' | 'right'
    };
  },

  // mette in ordine dati vecchi o importati
  normalize(raw) {
    const d = this.defaults();
    const saved = raw || {};
    if (!saved.migr) saved.migr = 0;
    Object.assign(d, saved);
    if (!DIFFICULTY[d.difficulty]) d.difficulty = DEFAULT_DIFFICULTY;
    const def = this.defaults();
    d.settings = Object.assign(def.settings, d.settings || {});
    d.shops = Object.assign(def.shops, d.shops || {});
    d.stats = Object.assign(def.stats, d.stats || {});
    d.stats.bosses = d.stats.bosses || {}; d.stats.winsDiff = d.stats.winsDiff || {};
    d.items = d.items || {}; d.wins = d.wins || {}; d.quests = d.quests || {}; d.records = d.records || {}; d.tips = d.tips || {};
    for (const id in d.items) if (!SHOP_ITEMS[id]) delete d.items[id];
    d.mastery = d.mastery || {}; d.omens = d.omens || {};
    for (const id in d.mastery) if (!PASSIVE_DEFS[id]) delete d.mastery[id];
    for (const id in d.omens) if (!SHOP_ITEMS[id] || !Array.isArray(d.omens[id])) delete d.omens[id];
    if (!SHOP_ITEMS[d.gear] || !SHOP_ITEMS[d.gear].gear) d.gear = 'dagger';
    if (!Array.isArray(d.chars)) d.chars = ['eek'];
    // v1: l'Alchimista era gratis, ora si compra
    if (!d.migr) { d.chars = d.chars.filter((c) => c !== 'alchimista'); d.migr = 1; }
    // v2: il Vagabondo è stato sostituito da Eek
    if (d.migr < 2) { d.chars = d.chars.filter((c) => c !== 'vagabondo'); if (d.char === 'vagabondo') d.char = 'eek'; d.migr = 2; }
    // v3: statistiche di carriera (partono dai record che c'erano già)
    if (d.migr < 3) { d.stats.kills = Math.max(d.stats.kills, d.bestKills || 0); d.tips.intro = d.runs > 0; d.migr = 3; }
    if (d.chars.indexOf('eek') < 0) d.chars.unshift('eek');
    if (!CHARACTERS[d.char] || d.chars.indexOf(d.char) < 0) d.char = 'eek';
    if (!MAPS[d.map] || !this.mapUnlocked(d.map, d)) d.map = 'cripta';
    return d;
  },

  load() {
    let raw = null;
    try { const s = localStorage.getItem(this.KEY); if (s) raw = JSON.parse(s); } catch (e) { /* si gioca senza salvataggio */ }
    this.data = this.normalize(raw);
    return this.data;
  },

  write() {
    this.data.savedAt = Date.now();
    this._local();
    Cloud.schedule();
  },
  _local() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* ignorato */ }
  },

  // sostituisce i dati (dal salvataggio online o da un codice) e aggiorna il gioco
  adopt(raw, keepTime) {
    const t = raw && raw.savedAt;
    this.data = this.normalize(JSON.parse(JSON.stringify(raw)));
    if (keepTime && t) { this.data.savedAt = t; this._local(); } else this.write();
    applySettings();
    if (G.state === 'menu') { Player.reset(); UI.refreshMenu(); }
  },

  addCoins(n) {
    this.data.coins += n;
    this.data.totalCoins += n;
    this.write();
  },

  // fine partita: record generali + record per mappa/difficoltà + statistiche di carriera.
  // r = { time, kills, level, map, diff, win, endless, newRun, rs (statistiche della partita da sommare) }
  endRun(r) {
    const d = this.data;
    if (r.newRun) d.runs++;
    if (r.time > d.bestTime) d.bestTime = r.time;
    if (r.kills > d.bestKills) d.bestKills = r.kills;
    if (r.level > d.bestLevel) d.bestLevel = r.level;
    const key = r.map + '/' + r.diff;
    const rec = d.records[key] || (d.records[key] = { t: 0, k: 0, lv: 0, win: 0, endless: 0 });
    const newRec = r.time > rec.t;
    if (r.time > rec.t) rec.t = r.time;
    if (r.kills > rec.k) rec.k = r.kills;
    if (r.level > rec.lv) rec.lv = r.level;
    if (r.win && r.newRun) rec.win++;
    if (r.endless && r.time > rec.endless) rec.endless = r.time;
    // statistiche di carriera
    const st = d.stats, rs = r.rs;
    st.kills += rs.kills; st.elites += rs.elites; st.chests += rs.chests; st.evos += rs.evos;
    for (const b in rs.bosses) st.bosses[b] = (st.bosses[b] || 0) + rs.bosses[b];
    if (r.win && r.newRun) st.winsDiff[r.diff] = (st.winsDiff[r.diff] || 0) + 1;
    if (r.endless && r.time > st.endlessBest) st.endlessBest = r.time;
    this.write();
    return newRec;
  },

  // ---- missioni ----------------------------------------------------------------
  questDone(q) { return !this.data.quests[q.id] && q.check(this.data); },
  questsReady() { let n = 0; for (const q of QUESTS) if (this.questDone(q)) n++; return n; },
  claimQuest(id) {
    const q = QUESTS.find((x) => x.id === id);
    if (!q || !this.questDone(q)) return false;
    this.data.quests[id] = true;
    this.addCoins(q.reward);
    return true;
  },

  // ---- botteghe ------------------------------------------------------------------
  shopLevel(v) { return this.data.shops[v] || 0; },
  shopUpCost(v) { const u = SHOP_UPGRADES[v], L = this.shopLevel(v); return u && L < u.costs.length ? u.costs[L] : 0; },
  upgradeShop(v) {
    const c = this.shopUpCost(v);
    if (!c || !this.spend(c)) return false;
    this.data.shops[v] = this.shopLevel(v) + 1;
    this.write();
    return true;
  },
  // arma dell'Armaiolo da portare in partita (se posseduta)
  gearId() {
    const d = this.data;
    if (this.itemLevel(d.gear) >= 0) return d.gear;
    for (const id in SHOP_ITEMS) if (SHOP_ITEMS[id].gear && this.itemLevel(id) >= 0) return id;
    return null;
  },

  // ---- mappe ------------------------------------------------------------------
  mapUnlocked(id, d) {
    d = d || this.data;
    const m = MAPS[id];
    return !!m && (!m.unlock || !!(d.wins && d.wins[m.unlock]));
  },

  // ---- negozio --------------------------------------------------------------
  itemLevel(id) { const v = this.data.items[id]; return v === undefined ? -1 : v; },
  itemValue(id) {
    const L = this.itemLevel(id), d = SHOP_ITEMS[id];
    return L < 0 || d.gear ? 0 : d.base + d.per * L;
  },
  spend(n) {
    if (this.data.coins < n) return false;
    this.data.coins -= n;
    this.write();
    return true;
  },
  buyItem(id) {
    if (this.itemLevel(id) >= 0 || !this.spend(SHOP_ITEMS[id].price)) return false;
    this.data.items[id] = 0;
    if (SHOP_ITEMS[id].gear) this.data.gear = id;   // l'arma appena comprata viene equipaggiata
    this.write();
    return true;
  },
  smithCost(id) {
    const L = this.itemLevel(id);
    return Math.ceil(SHOP_ITEMS[id].price * Math.pow(SMITH.costMult, L + 1));
  },
  smithChance(id, useStone) {
    const L = this.itemLevel(id);
    if (L < 0 || L >= SMITH.maxLevel) return 0;
    return Math.min(1, SMITH.success[L] + SHOP_UPGRADES.smith.bonus[this.shopLevel('smith')] + (useStone ? STONE.bonus : 0));
  },
  // ritorna 'ok' | 'fail' | 'broken' | 'nomoney' | 'max'
  smith(id, useStone) {
    const L = this.itemLevel(id);
    if (L < 0) return 'nomoney';
    if (L >= SMITH.maxLevel) return 'max';
    useStone = useStone && this.data.stones > 0;
    const chance = this.smithChance(id, useStone);
    if (!this.spend(this.smithCost(id))) return 'nomoney';
    if (useStone) this.data.stones--;
    if (Math.random() < chance) { this.data.items[id] = L + 1; this.write(); return 'ok'; }
    if (SMITH.failPenalty === 'break') { delete this.data.items[id]; this.write(); return 'broken'; }
    if (SMITH.failPenalty === 'downgrade' && L > 0) this.data.items[id] = L - 1;
    this.write();
    return 'fail';
  },
  // ---- Magister --------------------------------------------------------------
  masteryRank(id) { return (this.data && this.data.mastery[id]) || 0; },
  masteryMult(id) { return MASTERY.exclude.indexOf(id) >= 0 ? 1 : 1 + MASTERY.bonus * this.masteryRank(id); },
  masteryCost(id) { const r = this.masteryRank(id); return r < MASTERY.max ? MASTERY.costs[r] : 0; },
  buyMastery(id) {
    const c = this.masteryCost(id);
    if (!c || MASTERY.exclude.indexOf(id) >= 0 || !this.spend(c)) return false;
    this.data.mastery[id] = this.masteryRank(id) + 1;
    this.write();
    return true;
  },

  // ---- Aruspice --------------------------------------------------------------
  omenList(id) { const o = this.data.omens[id]; return o || [null, null]; },
  omenKinds(id) {
    const want = SHOP_ITEMS[id].gear ? 'w' : 'a', out = [];
    for (const k in OMENS.kinds) { const on = OMENS.kinds[k].on; if (on === want || on === '*') out.push(k); }
    return out;
  },
  _rollOmen(id, avoid) {
    let kinds = this.omenKinds(id).filter((k) => k !== avoid);
    const k = kinds[(Math.random() * kinds.length) | 0];
    let t = Math.random() * 100, r = 0;
    for (; r < OMENS.rarity.length - 1; r++) { t -= OMENS.rarity[r].w; if (t < 0) break; }
    const K = OMENS.kinds[k];
    let v = K.base * OMENS.rarity[r].m * (0.8 + Math.random() * 0.4);
    v = K.int ? Math.max(1, Math.round(v)) : Math.round(v * 1000) / 1000;
    return { k, v, r };
  },
  omenReadCost(id) { const n = this.omenList(id).filter(Boolean).length; return n < OMENS.slots ? OMENS.read[n] : 0; },
  // legge l'omen nel primo posto libero (slot < 0) oppure rilegge lo slot indicato
  readOmen(id, slot) {
    if (this.itemLevel(id) < 0) return null;
    const list = this.omenList(id).slice();
    if (slot < 0) slot = list.indexOf(null);
    if (slot < 0 || slot >= OMENS.slots) return null;
    const cost = list[slot] ? OMENS.reroll : this.omenReadCost(id);
    if (!this.spend(cost)) return null;
    const other = list[1 - slot];
    list[slot] = this._rollOmen(id, other ? other.k : null);
    this.data.omens[id] = list;
    this.data.stats.omens = (this.data.stats.omens || 0) + 1;
    this.write();
    return list[slot];
  },
  // somma di un tipo di omen su tutto ciò che porti (armature possedute + arma equipaggiata)
  omen(k) {
    const d = this.data;
    if (!d) return 0;
    const gear = this.gearId();
    let t = 0;
    for (const id in d.omens) {
      if (this.itemLevel(id) < 0) continue;
      if (SHOP_ITEMS[id].gear && id !== gear) continue;
      for (const o of d.omens[id]) if (o && o.k === k) t += o.v;
    }
    return t;
  },

  buyChar(id) {
    if (this.data.chars.indexOf(id) >= 0 || !this.spend(CHARACTERS[id].price)) return false;
    this.data.chars.push(id); this.data.char = id; this.write();
    return true;
  },

  // ---- codice di salvataggio ---------------------------------------------------
  exportCode() {
    const json = JSON.stringify(this.data);
    return 'SS98-' + btoa(unescape(encodeURIComponent(json)));
  },
  importCode(code) {
    code = (code || '').trim().replace(/\s+/g, '');
    if (code.indexOf('SS98-') === 0) code = code.slice(5);
    let raw;
    try { raw = JSON.parse(decodeURIComponent(escape(atob(code)))); } catch (e) { return false; }
    if (!raw || typeof raw !== 'object' || typeof raw.coins !== 'number') return false;
    this.adopt(raw, false);
    return true;
  },

  reset() {
    this.data = this.defaults();
    this.write();
  },
};

// ---------------------------------------------------------------------------
// SALVATAGGIO ONLINE — solo quando la pagina è aperta da claude.ai
// (capacità `db` + `user` della pagina pubblicata). Un documento privato
// per persona: data/users/<id>/save = { t: savedAt, save: {...} }.
// ---------------------------------------------------------------------------
const Cloud = {
  ref: null,
  status: 'off',      // 'off' (non disponibile) | 'wait' | 'on' | 'error'
  lastSync: 0,
  busy: false, dirty: false, timer: 0,

  async init() {
    if (!window.claude || typeof window.claude.use !== 'function') { this.status = 'off'; UI.refreshCloud(); return; }
    this.status = 'wait'; UI.refreshCloud();
    try {
      const db = await window.claude.use('db');
      const user = await window.claude.use('user');
      const id = user ? await user.id() : null;
      if (!db || !id) { this.status = 'off'; UI.refreshCloud(); return; }
      this.ref = db.doc('data/users/' + id + '/save');
      const snap = await this.ref.get();
      const cloud = snap.exists ? snap.data() : null;
      const localT = Save.data.savedAt || 0, cloudT = cloud ? (cloud.t || 0) : 0;
      if (cloud && cloud.save && cloudT > localT) {
        Save.adopt(cloud.save, true);
        UI.toast('Salvataggio online', 'Caricati i progressi più recenti (' + Save.data.coins + ' monete).', 4);
      } else if (!cloud || localT > cloudT) {
        await this.push();
      }
      this.status = 'on'; this.lastSync = Date.now();
    } catch (e) {
      this.status = 'error';
    }
    UI.refreshCloud();
  },

  // app chiusa / telefono bloccato: salva subito quello che era in attesa
  flush() {
    if (!this.ref || !this.dirty) return;
    clearTimeout(this.timer);
    this.push();
  },

  // salva online qualche secondo dopo l'ultima modifica (una scrittura alla volta)
  schedule() {
    if (!this.ref) return;
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.push(), 2500);
  },

  async push() {
    if (!this.ref) return;
    if (this.busy) { this.dirty = true; return; }
    this.busy = true; this.dirty = false;
    try {
      await this.ref.set({ t: Save.data.savedAt || Date.now(), save: JSON.parse(JSON.stringify(Save.data)) });
      this.status = 'on'; this.lastSync = Date.now();
    } catch (e) {
      this.status = 'error';
    }
    this.busy = false;
    UI.refreshCloud();
    if (this.dirty) this.schedule();
  },
};
