'use strict';
// js/08_sprites.js — PAL (palette) + SPR (pixel art generata da codice)

// ============================================================================
// SPRITES — pixel art generata da codice, palette nero + giallo fluo.
//
// Ogni sprite è una griglia di caratteri (vedi PAL) oppure una funzione
// (x,y) -> carattere. Il contorno nero viene aggiunto in automatico.
// Le dimensioni sono in PIXEL veri (1 px = CFG.UNIT unità di mondo).
//
// Per sostituire un placeholder con un PNG (pixel art 1:1):
//     SPR.load('slime_heavy', 'img/slime_heavy.png');
// ============================================================================

const PAL = {
  k: '#000000',
  // neutri freddi (grigio-viola): ossa, sale, UI, numeri
  0: '#08070b', 1: '#0e0d13', 2: '#16141d', 3: '#211e2b', 4: '#2f2b3d', 5: '#433d55',
  6: '#5d5673', 7: '#80799a', 8: '#aaa4c2', 9: '#d6d1e6', w: '#f2efff',
  // verde muschio (Slime Pesante)
  a: '#12210f', b: '#1e3818', c: '#2d5223', d: '#426f2f', e: '#5f9440',
  // ambra (Slime Lampo)
  f: '#2a1508', g: '#4a250c', h: '#6e3a12', i: '#94531c', j: '#b8702c',
  // viola (Sputacchino, aura)
  l: '#1c0d27', m: '#2f1645', n: '#472266', o: '#623289', p: '#8248ad',
  // verde acqua (Gocce, gemme, ampolle)
  q: '#0a1d22', r: '#123138', s: '#1c4a52', t: '#2a6870', u: '#3d8c94',
  // blu notte (alchimista)
  v: '#0e1636', x: '#1a2862', y: '#2a3f90', z: '#4560bf',
  // rosso sangue (vita, boss)
  A: '#2a0a10', B: '#4d1019', C: '#7a1a26', D: '#a62a33',
  // arancio brace (granate, esplosioni)
  E: '#3a1a06', F: '#6e3410', G: '#b0581c', P: '#e08a3a',
  // oro spento (capelli di Eek) e pelle
  K: '#9c7a1a', L: '#d1a93a', S: '#a8775c',
  // FLUO — solo per gli oggetti da raccogliere che contano
  H: '#ff1f63', I: '#ff9cbd',       // cuore
  M: '#14f1ff', N: '#b5fcff',       // calamita
  Y: '#ffe81a', Z: '#fff7a6', O: '#d6b000', // monete
  // verde acido spento (Slime Velenoso, pozze di veleno)
  Q: '#2c3a08', R: '#4b5c10', T: '#74861c', U: '#a3b43a',
  // verdi scurissimi (piantine di sfondo) e marrone bruciato
  J: '#070d05', V: '#0b1609', W: '#11200e', X: '#1a1108',
};

// colore del lampo quando un nemico viene colpito (grigio-lilla, non bianco: il gioco resta cupo)
const FLASH = '#8f88a8';

const SPR = {
  cache: {},   // nome -> { img, img2, flash, flash2, mir, mirFlash, rot[], w, h }
  url: {},     // nome -> dataURL (per le icone nella UI HTML)

  // --- costruzione ---------------------------------------------------------
  _grid(w, h) { const g = []; for (let y = 0; y < h; y++) g.push(new Array(w).fill(null)); return g; },

  _fromRows(rows) {
    const h = rows.length, w = rows[0].length, g = this._grid(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      g[y][x] = c === '.' || c === ' ' ? null : c;
    }
    return g;
  },

  _overlay(g, rows, ox, oy) {
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
      const c = rows[y][x];
      if (c !== '.' && g[oy + y] && ox + x < g[0].length) g[oy + y][ox + x] = c;
    }
  },

  // aggiunge 1px di bordo nero attorno alla sagoma
  _outline(g, col) {
    const h = g.length, w = g[0].length, o = this._grid(w + 2, h + 2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y + 1][x + 1] = g[y][x];
    for (let y = 0; y < h + 2; y++) for (let x = 0; x < w + 2; x++) {
      if (o[y][x] !== null) continue;
      const n = (yy, xx) => yy >= 0 && xx >= 0 && yy < h + 2 && xx < w + 2 && o[yy][xx] !== null && o[yy][xx] !== '#';
      if (n(y - 1, x) || n(y + 1, x) || n(y, x - 1) || n(y, x + 1)) o[y][x] = '#';
    }
    for (let y = 0; y < h + 2; y++) for (let x = 0; x < w + 2; x++) if (o[y][x] === '#') o[y][x] = col || 'k';
    return o;
  },

  _paint(g) {
    const h = g.length, w = g[0].length;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x2 = c.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = g[y][x];
      if (ch === null) continue;
      x2.fillStyle = PAL[ch];
      x2.fillRect(x, y, 1, 1);
    }
    return c;
  },

  _silhouette(src, color) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    return c;
  },

  _mirror(src) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
    return c;
  },

  // frame "schiacciato" di 1px per l'animazione molle degli slime
  _squash(src) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, -1, 2, src.width + 2, src.height - 2);
    return c;
  },

  // 16 rotazioni pre-calcolate (i proiettili non vengono ruotati a runtime)
  _rotations(src) {
    const out = [], d = Math.ceil(Math.hypot(src.width, src.height)) | 1;
    for (let i = 0; i < 16; i++) {
      const c = document.createElement('canvas');
      c.width = c.height = d;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.translate(d / 2, d / 2); g.rotate(i / 16 * Math.PI * 2);
      g.drawImage(src, -Math.floor(src.width / 2), -Math.floor(src.height / 2));
      out.push(c);
    }
    return out;
  },

  _register(name, g, opts) {
    opts = opts || {};
    if (opts.outline !== false) g = this._outline(g, opts.outlineColor);
    if (opts.outline2) g = this._outline(g); // bordo nero doppio (il player deve staccare dall'orda)
    const img = this._paint(g);
    const e = { img, w: img.width, h: img.height, flash: this._silhouette(img, FLASH) };
    e.img2 = opts.squash ? this._squash(img) : img;
    e.flash2 = opts.squash ? this._silhouette(e.img2, FLASH) : e.flash;
    if (opts.mirror) { e.mir = this._mirror(img); e.mirFlash = this._silhouette(e.mir, PAL.C); }
    if (opts.rotate) e.rot = this._rotations(img);
    this.cache[name] = e;
    this.url[name] = img.toDataURL();
    return e;
  },

  fromRows(name, rows, opts) { return this._register(name, this._fromRows(rows), opts); },

  fromFn(name, w, h, fn, opts, overlays) {
    const g = this._grid(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y][x] = fn(x, y);
    if (overlays) for (const o of overlays) this._overlay(g, o.rows, o.x, o.y);
    return this._register(name, g, opts);
  },

  // Sostituisce uno sprite con un PNG (stessa scala: 1 px immagine = 1 px gioco)
  load(name, url) {
    const img = new Image();
    img.onload = () => {
      const e = { img, img2: img, w: img.width, h: img.height, flash: this._silhouette(img, PAL.w) };
      e.flash2 = e.flash; e.mir = this._mirror(img); e.mirFlash = this._silhouette(e.mir, PAL.w);
      if (this.cache[name] && this.cache[name].rot) e.rot = this._rotations(img);
      this.cache[name] = e;
    };
    img.src = url;
  },

  // ---- mappe, nuove armi, boss finale, villaggio ---------------------------
  initWorld() {
    // DECORAZIONI DELLE MAPPE: piantine verde scuro, senza contorno (non devono distrarre)
    const GREEN = { a: 'J', b: 'V', c: 'W', d: 'b' };
    const plant = (name, rows) => this.fromRows(name, rows.map((r) => r.replace(/[abcd]/g, (c) => GREEN[c])), { outline: false });
    const plantRaw = (name, rows) => this.fromRows(name, rows, { outline: false });
    plant('pl_tuft',   ['...c...', '.c.c.b.', '.cbcbc.', 'b.cbc.b', '.bbcbb.', '..aaa..']);
    plant('pl_fern',   ['.....c.....', '..c..c..c..', '...c.c.c...', 'c..cbcbc..c', '.cc.bcb.cc.', '...bbcbb...', '....aaa....']);
    plant('pl_bush',   ['...bcc....', '..bcdcb.c.', '.bccccbcc.', 'bcbcdcbccb', 'bbcbbcbbcb', '.abbabbba.', '..aa..aa..']);
    plant('pl_sprout', ['.c.c.', '.cdc.', '..c..', '.bcb.', '..a..']);
    plant('pl_leaves', ['.cc...cc.', 'cddc.cdcc', '.cbcbcbc.', '..bcbcb..', '...aaa...']);
    plant('pl_reed',   ['..c...', '..c.c.', '.cc.c.', '.c.cc.', '.c.c..', '.bcb..', '.bbb..']);
    // stesse piantine secche (Dite) e ghiacciate (Cocito)
    const tint = (rows, map) => rows.map((r) => r.replace(/[abcd]/g, (c) => map[c]));
    const DRY = { a: '0', b: 'X', c: 'E', d: 'f' }, ICE = { a: '0', b: 'q', c: 'r', d: 's' };
    plantRaw('pl_dry_tuft',   tint(['...c...', '.c.c.b.', '.cbcbc.', 'b.cbc.b', '.bbcbb.', '..aaa..'], DRY));
    plantRaw('pl_dry_fern',   tint(['.....c.....', '..c..c..c..', '...c.c.c...', 'c..cbcbc..c', '.cc.bcb.cc.', '...bbcbb...', '....aaa....'], DRY));
    plantRaw('pl_ice_tuft',   tint(['...c...', '.c.c.b.', '.cbcbc.', 'b.cbc.b', '.bbcbb.', '..aaa..'], ICE));
    plantRaw('pl_ice_sprout', tint(['.c.c.', '.cdc.', '..c..', '.bcb.', '..a..'], ICE));

    // OSTACOLI DELLE CAMPAGNE DELL'INFERNO
    // quercia scura (Selva Oscura): chioma tonda verde scurissimo + tronco
    this.fromFn('o_oak', 20, 26, (x, y) => {
      const dx = x - 9.5, dy = y - 8.5, d = Math.sqrt(dx * dx + dy * dy * 1.15);
      if (d < 9.3) { const sh = dx * 0.5 + dy * 0.7; return sh < -4 ? 'b' : sh < 1 ? 'a' : (x * 3 + y * 5) % 7 === 0 ? 'a' : 'J'; }
      if (y >= 15 && x >= 8 && x <= 11) return x === 8 ? 'g' : 'f';
      if (y === 25 && x >= 6 && x <= 13) return 'f';
      return null;
    });
    // ROVINE (Cripta, Cattedrale): colonne doriche, colonne spezzate, rocchi caduti, muri
    const FL = ['5', '4', '5', '4', '4', '3', '4', '3', '3', '2'];        // scanalature: luce a sinistra, ombra a destra
    const shaft = (x, y) => { const v = FL[x - 2]; return (x * 7 + y * 13) % 23 === 0 ? '2' : v; };
    const baseRows = (x, y, H) => {                                      // toro + plinto
      if (y === H - 6 || y === H - 5) return x >= 1 && x <= 12 ? (y === H - 6 ? '4' : '3') : null;
      if (y >= H - 4) return y === H - 1 ? '1' : y === H - 4 ? '3' : '2';
      return undefined;
    };
    this.fromFn('o_col', 14, 40, (x, y) => {
      if (y <= 1) return y === 0 ? '5' : '4';                            // abaco
      if (y <= 3) return x >= 1 && x <= 12 ? (y === 2 ? '4' : '3') : null;  // echino
      const b = baseRows(x, y, 40); if (b !== undefined) return b;
      return x >= 2 && x <= 11 ? shaft(x, y) : null;
    });
    const JAG = [3, 1, 0, 2, 4, 1, 3, 5, 2, 0, 3, 1];
    this.fromFn('o_col_half', 14, 24, (x, y) => {
      const b = baseRows(x, y, 24); if (b !== undefined) return b;
      if (x < 2 || x > 11) return null;
      const top = JAG[x - 2];
      if (y < top) return null;
      return y === top ? '5' : shaft(x, y);
    });
    this.fromFn('o_col_stump', 14, 12, (x, y) => {
      const b = baseRows(x, y, 12); if (b !== undefined) return b;
      if (x < 2 || x > 11) return null;
      const top = JAG[(x + 4) % 12] >> 1;
      if (y < top) return null;
      return y === top ? '4' : shaft(x, y);
    });
    // rocchio di colonna caduto (decorazione)
    this.fromFn('d_drum', 18, 10, (x, y) => {
      const ex = x - 3, ey = y - 4.5;
      if (ex * ex / 9 + ey * ey / 20 <= 1) return ex < 0 ? '4' : '3';    // faccia rotonda
      if (x < 3 || x > 16 || y < 0 || y > 9) return null;
      return y <= 1 ? '4' : y >= 8 ? '2' : (x % 3 === 0 ? '2' : '3');
    });
    this.fromRows('d_capital', ['3444444444443', '.4333333333.', '..3333333...', '.2222222222.']);
    // muro diroccato (blocchi di pietra)
    this.fromFn('o_wall', 18, 18, (x, y) => {
      const top = [4, 2, 2, 1, 0, 0, 1, 3, 5, 6, 4, 2, 1, 0, 0, 2, 3, 5][x];
      if (y < top) return null;
      if (y === top) return '4';
      const row = (y / 4) | 0, off = row & 1 ? 3 : 0;
      if (y % 4 === 0 || (x + off) % 6 === 0) return '2';               // fughe
      return (x + y * 3) % 11 === 0 ? '2' : '3';
    });

    // tomba scoperchiata con il fuoco degli eretici (Città di Dite)
    this.fromRows('o_sarc', ['.333333333333333333.', '34444444444444444443', '34FGFFGFFFGFFGFFGF43', '34FFGFFGFFFGFFFGFF43', '35555555555555555553',
      '34444444444444444443', '34333333333333333343', '34444444444444444443', '34444444444444444443', '33333333333333333333', '.22222222222222222222'.slice(0, 20)]);
    // punta di ghiaccio (Cocito)
    this.fromFn('o_ice', 12, 24, (x, y) => {
      const hw = (y + 1) / 24 * 6;
      if (Math.abs(x - 5.5) > hw) return null;
      if (y >= 22) return 'r';
      const s = (x - 5.5) / Math.max(1, hw);
      return s < -0.4 ? 't' : s < 0.1 ? 's' : s < 0.6 ? 'r' : 'q';
    });

    // NEMICI DELLE CAMPAGNE
    const lupa = this.fromFn('slime_lupa', 16, 15, this._hornsAbove(this.slimeFn(16, 12, ['4', '5', '6', '7'], '8'), [[4, -1], [11, 1]]), { squash: true }, [
      { x: 3, y: 7, rows: ['..........', 'DD....DD..', '.k....k...', '...kk.....', '..wkkw....'] },
    ]);
    lupa.tell = this._silhouette(lupa.img, PAL.D); lupa.tell2 = this._silhouette(lupa.img2, PAL.D);
    this.fromFn('slime_furia', 22, 13, (x, y) => {
      const body = x >= 4 && x < 18 ? this.slimeFn(14, 12, ['A', 'B', 'C', 'D'], 'I')(x - 4, y - 1) : null;
      if (body) return body;
      // ali da pipistrello ai lati
      const wx = x < 4 ? 3 - x : x - 18;
      if (wx >= 0 && wx < 4 && y >= 1 + wx && y <= 7 - (wx >> 1)) return wx === 3 ? 'm' : (y & 1) ? 'n' : 'm';
      return null;
    }, { squash: true }, [{ x: 7, y: 5, rows: ['P....P', 'k....k', '..kk..'] }]);
    this.fromFn('slime_gelido', 14, 13, this.slimeFn(14, 13, ['v', 'x', 'y', 'z'], '9'), { squash: true }, [
      { x: 3, y: 4, rows: ['99....99', '9w....w9', '........', '..kkkk..', '..9.9...'] },
    ]);
    this.fromFn('fireball', 6, 6, this.circleFn(6, 'G', 'P', 'F'));

    // OSTACOLI (la base dello sprite sta sul cerchio di collisione)
    const pillar = (w, h, ramp, broken) => (x, y) => {
      const cap = y >= (broken ? 2 : 0) && y <= (broken ? 4 : 2);
      if (y >= h - 3) return y === h - 1 ? ramp[3] : ramp[2];                  // base
      if (cap) { if (x < 1 || x > w - 2) return null; return y === (broken ? 2 : 0) ? ramp[0] : ramp[1]; }
      if (broken && y < 2) { if (x < 3 || x > w - 4 || (x * 7 + y * 3) % 4 === 0) return null; return ramp[1]; }
      if (x < 2 || x > w - 3) return null;
      if ((x - 2) % 3 === 2) return ramp[2];                                  // scanalature
      return x <= 4 ? ramp[0] : x <= 7 ? ramp[1] : ramp[2];
    };
    this.fromFn('o_pillar', 12, 22, pillar(12, 22, ['4', '3', '2', '1'], true));
    this.fromFn('o_column', 12, 34, pillar(12, 34, ['5', '4', '3', '2'], false));
    this.fromRows('o_tree', ['..h.......h....', '..h....h..h....', '...h...h.h.....', '...hh..hh...h..', '....h..h...h...', '.h...hhh..h....', '..h...hhhh.....',
      '...h..hhh......', '....hhghh......', '......ghh......', '......ghh......', '......ghhh.....', '.....gghh......', '......ghh......', '......ghh......',
      '.....gghhh.....', '....ggghhhh....', '...gg.ghh.hh...'].map((r) => r.replace(/h/g, 'X').replace(/g/g, 'f').replace(/X/g, 'g')));

    // NUOVE ARMI
    this.fromFn('proj_scythe', 11, 11, (x, y) => {
      const d1 = Math.hypot(x - 5, y - 5), d2 = Math.hypot(x - 6.8, y - 3.6);
      if (d1 > 5.3 || d2 < 4.3) return null;
      return d1 > 4.4 ? 'w' : '9';
    }, { rotate: true });
    this.fromRows('flask', ['..4..', '..8..', '.d8d.', 'deeed', 'deeed', 'deeed', '.ddd.']);
    this.fromRows('wisp', ['...p...', '..pp...', '..p9p..', '.p99p..', '.p9w9p.', 'p9www9p', 'p9www9p', '.p999p.', '..ppp..']);
    for (const [ico, src] of [['ico_scythe', 'proj_scythe'], ['ico_acid', 'flask'], ['ico_wisp', 'wisp']]) { this.cache[ico] = this.cache[src]; this.url[ico] = this.url[src]; }
    this.fromFn('glob', 5, 5, this.circleFn(5, 'n', 'p', 'm'));
    this.fromFn('ebullet', 6, 6, this.circleFn(6, 'u', '9', 't'));

    // BOSS FINALE
    this.fromFn('boss_primal', 152, 140, this.bossFn(152, 140, { eye: 'u', eyeCore: '9', mouth: 's', rim: 't', veins: 'r' }), { squash: true });

    // VILLAGGIO: case (tetto colorato per mestiere), abitanti, pozzo, lanterne
    const house = (roof, roofDark) => (x, y) => {
      const W = 44, cx = 21.5;
      if (y < 16) {
        if (x >= 31 && x <= 34 && y >= 1 && y <= 9) return y === 1 ? '4' : '3';   // comignolo
        const hw = (y + 1) / 16 * 22 + 1;
        if (Math.abs(x - cx) > hw) return null;
        if (Math.abs(x - cx) > hw - 1.2 || y === 15) return roofDark;
        return y % 3 === 0 ? roofDark : roof;
      }
      if (x < 3 || x > W - 4) return null;
      if (x >= 18 && x <= 25 && y >= 27) return x === 24 && y === 33 ? 'j' : (y === 27 ? 'g' : 'f');   // porta
      if ((x >= 7 && x <= 13 || x >= 30 && x <= 36) && y >= 21 && y <= 27) {                 // finestre accese
        if (x === 10 || x === 33 || y === 24) return 'f';
        return (x + y) % 5 === 0 ? 'P' : 'G';
      }
      if (y === 39) return '1';
      return (x % 6 === 0) ? '2' : (y % 4 === 0 ? '3' : '4');                               // assi di legno
    };
    this.fromFn('h_smith', 44, 40, house('C', 'B'));
    this.fromFn('h_weapons', 44, 40, house('y', 'x'));
    this.fromFn('h_armor', 44, 40, house('c', 'b'));
    this.fromFn('h_inn', 44, 40, house('n', 'm'));
    this.fromRows('ico_mug', ['.9999..', '.jjjj..', '.jjjjhh', '.jjjj.h', '.jjjjhh', '.jjjj..', '.hhhh..']);
    this.fromRows('npc_smith', ['...SSSSS...', '..SSSSSSS..', '..SkSSSkS..', '..S66666S..', '...66666...', '.SS3hhh3SS.', 'SS33hhh33SS', 'S.33hhh33.S',
      '7.33hhh33.S', '7733hhh33..', '7.33hhh33..', '..3333333..', '..33...33..', '..33...33..', '..44...44..'], { mirror: true });
    this.fromRows('npc_weapons', ['...yyyyy...', '..yyyyyyy..', '..y11111y..', '..y1w1w1y..', '..yy111yy..', '.9yyyyyyy9.', '..9xxxxx9..', '..x9xxx9x..',
      '..xx9x9xx..', '..xxx9xxx..', '..xxFFFxx..', '..xxxxxxx..', '..xx...xx..', '..xx...xx..', '..33...33..'], { mirror: true });
    this.fromRows('npc_armor', ['...77777...', '..7888887..', '..78kkk87..', '..7888887..', '...77777...', '.778888877.', '78888888887', '7.8888888.7',
      '7.8777778.7', '..8888888..', '..7777777..', '..8888888..', '..88...88..', '..77...77..', '..44...44..'], { mirror: true });
    this.fromRows('npc_inn', ['...hhhhh...', '..hhhhhhh..', '..hSSSSSh..', '..hSkSkSh..', '..hSSSSSh..', '.h.nnnnn.h.', '..nnnnnnnjj', '..nn999nnjj',
      '..nn999nn..', '.nnn999nnn.', '.nnnnnnnnn.', 'nnnnnnnnnnn', '.nnnnnnnnn.', '..33...33..', '..44...44..'], { mirror: true });
    // NEMICI DELLE MAPPE
    this.fromFn('slime_toxic', 14, 13, this.slimeFn(14, 13, ['Q', 'R', 'T', 'U'], '9'), { squash: true }, [
      { x: 3, y: 4, rows: ['kk....kk', '.k8..8k.', '........', '..kUUk..', '...UU...', '....U...'] },
    ]);
    this.fromFn('slime_toxic_d', 14, 16, this._hornsAbove(this.slimeFn(14, 13, ['k', 'Q', 'R', 'T'], 'U'), [[4, -1], [9, 1]]), { squash: true }, [
      { x: 3, y: 7, rows: ['DD....DD', 'DI....ID', '........', '..kwwk..', '...UU...', '....U...'] },
    ]);
    const ghostRows = [
      '....8888....',
      '..88999988..',
      '.8999999998.',
      '.89kk99kk98.',
      '899kk99kk998',
      '899999999998',
      '8999978999988'.slice(0, 12),
      '899997799998',
      '889999999988',
      '878989898978',
      '.7.77.77.77.',
    ];
    this.fromRows('ghost', ghostRows, { squash: true });
    this.fromRows('ghost_d', ghostRows.map((r) => r.replace(/9/g, '6').replace(/8/g, '5').replace(/7/g, '4').replace(/k/g, 'D')), { squash: true });

    // FORZIERE (chiuso / aperto), BACHECA, icone
    this.fromRows('chest', ['.hhhhhhhhhhh.', 'hiiiiiiiiiiih', 'hijjjjjjjjjih', 'KKKKKKLKKKKKK', 'hiiiiiLiiiiih', 'hiiiiiKiiiiih', 'hiiiiiiiiiiih', 'hhhhhhhhhhhhh']);
    this.fromRows('chest_open', ['.hhhhhhhhhhh.', 'hiiiiiiiiiiih', 'KKKKKKKKKKKKK', '..w...L...w..', '.L.L.LwL.L.L.', 'hLwLLwLLLwLLh', 'KKKKKKLKKKKKK', 'hiiiiiKiiiiih', 'hiiiiiiiiiiih', 'hhhhhhhhhhhhh']);
    this.fromRows('board', ['.4444444444444444.', '.4hhhhhhhhhhhhhh4.', '.4h9988h999h88hh4.', '.4h9999h989h99hh4.', '.4h9899hhhhh98hh4.', '.4hhhhhh9998hhhh4.',
      '.4hh999h9999hhhh4.', '.4hh989hhhhhhhhh4.', '.4hhhhhhhhhhhhhh4.', '.4444444444444444.', '...4..........4...', '...4..........4...', '...4..........4...', '..444........444..']);
    this.fromRows('ico_bulb', ['..999..', '.9www9.', '9wwLww9', '9wLwLw9', '.9wLw9.', '..9L9..', '..666..', '..777..', '...6...']);
    this.fromRows('ico_check', ['......e', '.....ee', 'e...ee.', 'ee.ee..', '.eee...', '..e....']);
    this.fromRows('ico_scroll', ['.8888888.', '899999998', '.9767679.', '.9999999.', '.9767679.', '.9999999.', '899999998', '.8888888.']);
    this.fromRows('proj_arrow', ['66......9..', 'hhhhhhhh9ww', '66......9..'], { rotate: true });
    this.fromRows('proj_axe', ['..7999...', '.79ww99..', '.79w999h.', '..799.h..', '.....h...', '....h....', '...h.....', '..h......', '.i.......'], { rotate: true });

    this.fromRows('well', ['..6666666666..', '.677777777776.', '67qqqqqqqqqq76', '67qrrrrrrrrq76', '.677777777776.', '.556565656555.', '.565656565655.', '.555555555555.', '..4444444444..']);
    this.fromRows('lantern', ['.444.', '4PGP4', '4GPG4', '.444.', '..4..', '..4..', '..4..', '..4..', '..4..', '..4..', '..4..', '..4..', '.444.']);
  },

  // ---- VILLAGGIO: casette, giardino, arredi ---------------------------------
  initVillage() {
    const mk = (W, H) => {
      const g = this._grid(W, H);
      const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; };
      const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
      return { g, set, rect };
    };
    // CASETTA: tetto a tegole, muri a graticcio, finestre accese con fioriere, porta ad arco, comignolo.
    // roof = [chiaro, medio, scuro]; wall = intonaco; kind = extra del mestiere
    const house = (name, roof, wall, kind) => {
      const W = 60, H = 62, { g, set, rect } = mk(W, H);
      const [R1, R2, R3] = roof;
      // comignolo (dietro al tetto)
      rect(42, 2, 47, 16, kind === 'smith' ? '3' : '4'); rect(41, 1, 48, 2, '5');
      for (let y = 4; y <= 16; y += 3) for (let x = 42; x <= 47; x++) if ((x + y) % 3 === 0) set(x, y, '2');
      // tetto a capanna con tegole a scaglie
      for (let y = 4; y <= 27; y++) {
        const hw = Math.round((y - 4) / 23 * 30) + 1;
        for (let x = 30 - hw; x <= 29 + hw; x++) {
          const row = ((y - 4) / 3) | 0, edge = x === 30 - hw || x === 29 + hw;
          let c = (y - 4) % 3 === 2 ? R3 : ((x + row * 2) % 4 === 0 ? R3 : (x < 30 ? R1 : R2));
          if (edge || y === 27) c = R3;
          set(x, y, c);
        }
      }
      rect(28, 3, 31, 4, R3);                                                // colmo
      // muri
      const stone = kind === 'smith';
      for (let y = 28; y <= 54; y++) for (let x = 4; x <= 55; x++) {
        let c = wall;
        if (stone) { const row = ((y - 28) / 4) | 0; c = (y - 28) % 4 === 3 || (x + (row & 1) * 4) % 8 === 0 ? '2' : ((x * 5 + y * 3) % 13 === 0 ? '4' : '3'); }
        set(x, y, c);
      }
      rect(4, 28, 55, 28, '1');                                              // ombra sotto la gronda
      if (!stone) {
        // graticcio: travi scure
        for (const bx of [4, 5, 29, 30, 54, 55]) rect(bx, 29, bx, 54, 'g');
        rect(4, 41, 55, 41, 'g'); rect(4, 54, 55, 54, 'g');
        for (let k = 0; k < 11; k++) { set(6 + k, 30 + k, 'g'); set(53 - k, 30 + k, 'g'); }
      }
      // finestre accese + scuri + fioriera
      for (const wx of [10, 42]) {
        rect(wx - 1, 31, wx + 8, 39, 'g');
        rect(wx, 32, wx + 7, 38, 'G');
        for (let y = 32; y <= 38; y++) for (let x = wx; x <= wx + 7; x++) if ((x + y) % 4 === 0) set(x, y, 'P');
        rect(wx + 3, 32, wx + 4, 38, 'g'); rect(wx, 35, wx + 7, 35, 'g');
        rect(wx - 3, 31, wx - 2, 39, R2); rect(wx + 9, 31, wx + 10, 39, R2);   // scuri del colore del tetto
        rect(wx - 1, 40, wx + 8, 41, 'f');                                     // fioriera
        for (let x = wx; x <= wx + 7; x += 2) set(x, 39, ['C', 'o', 'L', 'C'][(x >> 1) & 3]);
      }
      // porta ad arco con assi, maniglia e gradini
      for (let y = 43; y <= 56; y++) for (let x = 25; x <= 34; x++) {
        if (y < 46 && Math.abs(x - 29.5) > (y - 42) * 1.6 + 1) continue;
        set(x, y, x === 25 || x === 34 || y === 43 ? 'f' : ((x - 25) % 3 === 0 ? 'g' : 'h'));
      }
      set(32, 50, 'L');
      // fondamenta di pietra
      for (let y = 55; y <= 59; y++) for (let x = 2; x <= 57; x++) set(x, y, (x + ((y & 1) ? 3 : 0)) % 6 === 0 || y === 59 ? '2' : '3');
      rect(23, 57, 36, 58, '4'); rect(24, 59, 35, 60, '3');                  // gradini
      // extra del mestiere
      if (kind === 'smith') { rect(10, 32, 17, 38, 'D'); for (let x = 10; x <= 17; x += 2) set(x, 37, 'P'); }   // fornace che brilla
      if (kind === 'armor') { rect(26, 31, 33, 38, 'y'); rect(27, 32, 32, 36, 'z'); rect(29, 33, 30, 35, 'D'); } // stemma sullo scudo
      if (kind === 'inn') { rect(24, 30, 35, 37, 'f'); rect(25, 31, 34, 36, 'h'); for (let x = 26; x <= 33; x += 2) set(x, 33, 'j'); } // insegna
      if (kind === 'magister') { rect(24, 30, 35, 37, '9'); rect(25, 31, 34, 36, '8'); rect(29, 31, 30, 36, '5'); for (let x = 26; x <= 33; x += 2) if (x !== 30) set(x, 33, '6'); } // libro aperto
      if (kind === 'haruspex') { rect(25, 30, 34, 37, 'B'); rect(26, 31, 33, 36, 'C'); rect(28, 32, 31, 35, 'D'); set(29, 33, 'P'); set(30, 34, 'P'); } // occhio rosso
      if (kind === 'weapons') { for (let k = 0; k < 3; k++) { rect(25 + k * 4, 31, 25 + k * 4, 37, '7'); set(25 + k * 4, 30, '9'); set(24 + k * 4, 36, 'f'); set(26 + k * 4, 36, 'f'); } } // spade incrociate
      this._register(name, g);
    };
    house('h_smith',   ['D', 'C', 'B'], '4', 'smith');
    house('h_weapons', ['z', 'y', 'x'], '5', 'weapons');
    house('h_armor',   ['e', 'd', 'c'], '5', 'armor');
    house('h_inn',     ['p', 'o', 'n'], '5', 'inn');
    house('h_magister', ['u', 't', 's'], '5', 'magister');
    house('h_haruspex', ['G', 'F', 'E'], '4', 'haruspex');
    // arredi
    this.fromRows('v_anvil', ['.777777777..', '78888888887.', '.777777777..', '...6666....', '...6666....', '..666666...', '.33333333..']);
    this.fromRows('v_rack', ['g.........g', 'g.9..9..9.g', 'gg7gg7gg7gg', 'g.7..7..7.g', 'g.7..7..7.g', 'g.7..7..7.g', 'g.f..f..f.g', 'g.f..f..f.g', 'g.........g', 'gg.......gg']);
    this.fromRows('v_barrel', ['.hhhhh.', 'hiiiiih', '4444444', 'hiiiiih', 'hiiiiih', '4444444', 'hiiiiih', '.hhhhh.']);
    this.fromRows('v_bench', ['hhhhhhhhhhhhhh', 'iiiiiiiiiiiiii', 'g.g........g.g', 'g.g........g.g']);
    // giardino
    const G2 = { a: 'J', b: 'V', c: 'W', d: 'a', e: 'b' };
    this.fromFn('g_hedge', 30, 12, (x, y) => {
      const top = 2 + Math.round(Math.sin(x * 0.9) * 1.2);
      if (y < top) return null;
      const sh = (x * 7 + y * 11) % 9;
      return y >= 10 ? 'J' : y === top ? (sh < 4 ? 'b' : 'a') : sh < 2 ? 'a' : sh < 5 ? 'W' : 'V';
    });
    this.fromFn('g_bed', 28, 12, (x, y) => {
      if (y <= 1 || y >= 10 || x <= 1 || x >= 26) return y >= 10 || x <= 0 || x >= 27 ? '3' : '4';     // bordo di pietra
      if ((x + y) % 2 === 0 && y % 3 === 1) return ['C', 'p', 'L', 'D', 'o'][(x * 3 + y) % 5];           // fiori spenti
      if (y % 3 === 2 && x % 2 === 0) return 'W';                                                         // steli
      return (x * 5 + y) % 4 === 0 ? 'X' : 'f';                                                           // terra
    }, { outline: false });
    this.fromFn('g_tree', 22, 26, (x, y) => {
      const dx = x - 10.5, dy = y - 9, d = Math.sqrt(dx * dx + dy * dy * 1.2);
      if (d < 10) {
        if ((x * 5 + y * 3) % 17 === 0 && d < 8) return 'C';                                              // frutti
        const sh = dx * 0.5 + dy * 0.6;
        return sh < -4 ? 'b' : sh < 1 ? 'a' : (x + y) % 5 === 0 ? 'a' : 'J';
      }
      if (y >= 17 && x >= 9 && x <= 12) return x === 9 ? 'g' : 'f';
      return null;
    });
    this.fromRows('g_fence', ['h..h..h..h..h..', 'hhhhhhhhhhhhhhh', 'h..h..h..h..h..', 'hhhhhhhhhhhhhhh', 'f..f..f..f..f..']);
    this.fromRows('g_fenceV', ['h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'f']);
    void G2;
  },

  // Pavimenti delle mappe (tile 128x128 ripetibili)
  makeFloor(kind) {
    const T = 128, c = document.createElement('canvas');
    c.width = c.height = T;
    const f = c.getContext('2d');
    let seed = kind.length * 977 + 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const px = (col, x, y, w, h) => { f.fillStyle = col; f.fillRect(x | 0, y | 0, w || 1, h || 1); };
    if (kind === 'palude') {
      f.fillStyle = '#0b0d07'; f.fillRect(0, 0, T, T);
      for (let i = 0; i < 260; i++) px(rnd() < 0.5 ? '#10140a' : '#0d1008', rnd() * T, rnd() * T, 2 + rnd() * 3, 1);   // fango a strati
      for (let i = 0; i < 40; i++) px(rnd() < 0.5 ? '#16220f' : '#1b2a12', rnd() * T, rnd() * T);                   // muschio
      for (let i = 0; i < 25; i++) px('#05070a', rnd() * T, rnd() * T, 2, 1);                                       // buchi
    } else if (kind === 'cattedrale') {
      for (let y = 0; y < T; y += 16) for (let x = 0; x < T; x += 16) {                                             // scacchiera di marmo
        const dark = ((x + y) / 16) % 2;
        f.fillStyle = dark ? '#0b0910' : '#141019'; f.fillRect(x, y, 16, 16);
        f.fillStyle = dark ? '#100c16' : '#1a1522'; f.fillRect(x, y, 16, 1); f.fillRect(x, y, 1, 16);
      }
      for (let i = 0; i < 30; i++) { const x = rnd() * T, y = rnd() * T; for (let k = 0; k < 4; k++) px('#221c2c', x + k, y + ((k * 3) % 2)); } // venature
      for (let i = 0; i < 12; i++) px('#2a0e14', rnd() * T, rnd() * T);
    } else if (kind === 'selva') {
      f.fillStyle = '#060805'; f.fillRect(0, 0, T, T);
      for (let i = 0; i < 360; i++) px(rnd() < 0.5 ? '#0c110a' : '#0a0e08', rnd() * T, rnd() * T, 1 + (rnd() * 2 | 0), 1);  // foglie marce
      for (let i = 0; i < 14; i++) { const x = rnd() * T, y = rnd() * T; for (let k = 0; k < 6; k++) px('#140e08', x + k, y + ((k * 7) % 3)); } // radici
      for (let i = 0; i < 25; i++) px('#16210f', rnd() * T, rnd() * T);
    } else if (kind === 'dite') {
      f.fillStyle = '#0b0607'; f.fillRect(0, 0, T, T);
      for (let y = 0; y < T; y += 24) for (let x = 0; x < T; x += 24) {                                             // lastre di pietra arse
        f.fillStyle = (x + y) % 48 ? '#100809' : '#0d0708'; f.fillRect(x + 1, y + 1, 22, 22);
      }
      for (let i = 0; i < 18; i++) { const x = rnd() * T, y = rnd() * T; for (let k = 0; k < 5; k++) px(k === 2 ? '#3a1206' : '#1c0a0a', x + k, y + ((k * 5) % 3)); } // crepe con brace
      for (let i = 0; i < 40; i++) px('#161113', rnd() * T, rnd() * T);                                            // cenere
    } else if (kind === 'cocito') {
      f.fillStyle = '#05080d'; f.fillRect(0, 0, T, T);
      for (let i = 0; i < 160; i++) px(rnd() < 0.5 ? '#08101a' : '#0a1420', rnd() * T, rnd() * T, 3 + (rnd() * 4 | 0), 1);   // ghiaccio a strati
      for (let i = 0; i < 16; i++) { let x = rnd() * T, y = rnd() * T; for (let k = 0; k < 9; k++) { px('#132235', x, y); x += rnd() < 0.5 ? 1 : 0; y += 1; } } // crepe
      for (let i = 0; i < 20; i++) px('#1b3048', rnd() * T, rnd() * T);
    } else if (kind === 'slab') {
      // basamento di un tempio: grandi lastre consumate, appena più chiare del pavimento
      f.fillStyle = '#0a090d'; f.fillRect(0, 0, T, T);
      for (let y = 0; y < T; y += 32) for (let x = 0; x < T; x += 32) {
        const o = (y / 32) % 2 ? 16 : 0;
        f.fillStyle = rnd() < 0.5 ? '#100e15' : '#0e0c13'; f.fillRect((x + o) % T + 1, y + 1, 30, 30);
        f.fillStyle = '#16131c'; f.fillRect((x + o) % T + 1, y + 1, 30, 1);
      }
      for (let i = 0; i < 14; i++) { const x = rnd() * T, y = rnd() * T; for (let k = 0; k < 6; k++) px('#07060a', x + k, y + ((k * 3) % 2)); } // crepe
    } else if (kind === 'plaza') {
      // piazza di ciottoli
      f.fillStyle = '#0c0b10'; f.fillRect(0, 0, T, T);
      for (let y = 0; y < T; y += 8) for (let x = ((y / 8) & 1) * 4; x < T; x += 8) {
        f.fillStyle = rnd() < 0.5 ? '#16141d' : '#13111a'; f.fillRect(x + 1, y + 1, 6, 6);
        f.fillStyle = '#1c1925'; f.fillRect(x + 1, y + 1, 6, 1);
      }
    } else if (kind === 'village') {
      f.fillStyle = '#0a0c08'; f.fillRect(0, 0, T, T);
      for (let i = 0; i < 420; i++) px(rnd() < 0.5 ? '#121a0e' : '#0e140b', rnd() * T, rnd() * T, 1, 1 + (rnd() * 2 | 0)); // erba scura
      for (let i = 0; i < 30; i++) px('#1d2a14', rnd() * T, rnd() * T);
      for (let i = 0; i < 10; i++) px(rnd() < 0.5 ? '#2a1530' : '#2e2612', rnd() * T, rnd() * T);                   // fiorellini
    }
    return c;
  },

  // icona di un oggetto del negozio in base al livello del fabbro
  itemIcon(id, lvl) {
    const base = SHOP_ITEMS[id].icon;
    return lvl >= 5 ? base + '_5' : lvl >= 3 ? base + '_3' : base;
  },

  // --- generatori di forme -------------------------------------------------
  slimeFn(w, h, ramp, hl) {
    return (x, y) => {
      const u = (x + 0.5) / w * 2 - 1, t = (h - (y + 0.5)) / (h * 0.96);
      if (u * u + t * t > 1) return null;
      if ((u + 0.42) * (u + 0.42) + (t - 0.62) * (t - 0.62) < 0.02) return hl;
      let s = 0.42 - 0.32 * u + 0.5 * t;
      if (y === h - 1) s -= 0.3;
      let k = Math.floor(s * ramp.length);
      if (k < 0) k = 0; if (k >= ramp.length) k = ramp.length - 1;
      return ramp[k];
    };
  },

  // ramp = [luce, chiaro, medio, scuro]
  diamondFn(w, h, ramp) {
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    return (x, y) => {
      const u = Math.abs(x - cx) / (w / 2), v = Math.abs(y - cy) / (h / 2);
      if (u + v > 1) return null;
      const s = (x - cx) / w + (y - cy) / h;
      return s < -0.25 ? ramp[0] : s < -0.05 ? ramp[1] : s < 0.2 ? ramp[2] : ramp[3];
    };
  },

  makeDither(color) {
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    const g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, 1, 1);
    return c;
  },

  // Re della Melma Nera: enorme, nero, corona di spine, occhi rosso scuro
  // opts: eye/eyeCore (occhi), mouth, rim (luce bordo), veins (venature: colore o null)
  bossFn(W, H, opts) {
    opts = opts || {};
    const EYE = opts.eye || 'C', CORE = opts.eyeCore || 'D', MOUTH = opts.mouth || 'B', RIM = opts.rim || '4', VEIN = opts.veins || null;
    const top = 20;
    const dome = (x, y) => {
      if (y < top - 2 || y >= H || x < 0 || x >= W) return false;
      const u = (x + 0.5) / W * 2 - 1, t = (H - (y + 0.5)) / ((H - top) * 0.98);
      return u * u + t * t <= 1;
    };
    const spikes = [[W * 0.28, 18], [W * 0.39, 26], [W * 0.5, 34], [W * 0.61, 26], [W * 0.72, 18]];
    const spike = (x, y) => {
      const base = top + 10;
      for (const [cx, h] of spikes) {
        const tip = base - h;
        if (y >= tip && y <= base && Math.abs(x + 0.5 - cx) <= (y - tip) / h * 7) return true;
      }
      return false;
    };
    const inside = (x, y) => dome(x, y) || spike(x, y);
    const ex = [W * 0.34, W * 0.66], ey = H * 0.55;
    return (x, y) => {
      if (!inside(x, y)) return null;
      // occhi
      for (const cx of ex) {
        const dx = (x + 0.5 - cx) / 10, dy = (y + 0.5 - ey) / 6;
        const d = dx * dx + dy * dy;
        if (d <= 1) {
          if (Math.abs(x + 0.5 - cx) < 1) return 'k';
          return d < 0.35 ? CORE : EYE;
        }
      }
      // bocca frastagliata
      const my = H * 0.74 + (((x / 5) | 0) % 2) * 3;
      if (x > W * 0.3 && x < W * 0.7 && y >= my && y <= my + 1) return MOUTH;
      // bordo: luce fredda in alto a sinistra, ombra sotto
      if (!inside(x, y - 2) || !inside(x - 2, y)) return RIM;
      if (!inside(x, y - 4) || !inside(x - 4, y)) return '2';
      if (!inside(x + 2, y) || !inside(x, y + 2)) return '1';
      // riflesso "oleoso"
      const u = (x + 0.5) / W * 2 - 1, t = (H - (y + 0.5)) / (H - top);
      if ((u + 0.45) * (u + 0.45) * 4 + (t - 0.72) * (t - 0.72) * 16 < 0.05) return '1';
      // venature elettriche (boss 2): linee a zig-zag
      if (VEIN) {
        const zz = Math.abs(((y * 0.9 + (((x / 9) | 0) % 2 ? x % 9 : 9 - x % 9) * 1.4) % 26) - 13);
        if (zz < 0.8 && y > top + 14) return VEIN;
      }
      return (x * 7 + y * 13) % 11 === 0 ? '0' : 'k';
    };
  },

  circleFn(d, fill, light, dark, ring) {
    const c = (d - 1) / 2, r = d / 2;
    return (x, y) => {
      const dx = x - c, dy = y - c, dd = Math.sqrt(dx * dx + dy * dy);
      if (dd > r - 0.2) return null;
      if (ring && dd > r - 1.3) return ring;
      if (dx + dy < -r * 0.7) return light;
      if (dx + dy > r * 0.6) return dark;
      return fill;
    };
  },

  // --- tutti gli sprite del gioco -----------------------------------------
  init() {
    // SLIME (ognuno con la sua tinta scura) ---------------------------------
    this.fromFn('slime_heavy', 18, 14, this.slimeFn(18, 14, ['a', 'b', 'c', 'd'], 'e'), { squash: true }, [
      { x: 3, y: 4, rows: ['kk........kk', '.kk......kk.', '..88....88..', '..8w....w8..'] },
    ]);
    this.fromFn('slime_fast', 12, 11, this.slimeFn(12, 11, ['g', 'h', 'i', 'j'], 'P'), { squash: true }, [
      { x: 3, y: 5, rows: ['k....k', 'k....k'] },
    ]);
    this.fromFn('slime_spitter', 14, 13, this.slimeFn(14, 13, ['l', 'm', 'n', 'o'], 'p'), { squash: true }, [
      { x: 3, y: 4, rows: ['88....88', '8w....w8', '........', '...kk...', '..kCCk..', '...kk...'] },
    ]);
    this.fromRows('slime_drop', [
      '..uu..',
      '..uu..',
      '.uttt.',
      '.ttts.',
      'utttss',
      'tkssks',
      'sttssr',
      '.ssrr.',
    ], { squash: true });

    // BOSS ----------------------------------------------------------------------
    const boss = this.fromFn('boss_black', 144, 132, this.bossFn(144, 132), { squash: true });
    boss.tell = this._silhouette(boss.img, '#3a0a12');
    boss.tell2 = this._silhouette(boss.img2, '#3a0a12');
    // Signore della Tempesta: stessa mole, occhi elettrici e venature lilla
    this.fromFn('boss_storm', 144, 132, this.bossFn(144, 132, { eye: 'p', eyeCore: '9', mouth: 'o', rim: '5', veins: 'n' }), { squash: true });

    // CACCIATORE (mini-boss): rosso sangue, corna, occhi chiari
    // aggiunge due corna sopra uno slime (lo sprite cresce di 3 px in alto)
    const hornsAbove = this._hornsAbove = (base, horns) => (x, y) => {
      const v = y >= 3 ? base(x, y - 3) : null;
      if (v) return v;
      if (y <= 5) {
        for (const [hx, side] of horns) {
          const xx = Math.round(hx + (5 - y) * side * 0.5);
          if (x === xx || (y >= 3 && x === xx - side)) return '8';
        }
      }
      return null;
    };
    const elite = this.fromFn('slime_elite', 24, 22, hornsAbove(this.slimeFn(24, 19, ['k', 'A', 'B', 'C'], 'D'), [[8, -1], [15, 1]]), { squash: true }, [
      { x: 6, y: 10, rows: ['kk..........', '.k8......8k.', '..8w....w8..', '............', '..kwkwkwkk..'] },
    ]);
    elite.tell = this._silhouette(elite.img, PAL.D);
    elite.tell2 = this._silhouette(elite.img2, PAL.D);

    // VERSIONI DEMONIACHE (notte): più scure, corna, occhi rossi, denti
    this.fromFn('slime_heavy_d', 18, 17, hornsAbove(this.slimeFn(18, 14, ['k', 'A', 'a', 'b'], 'c'), [[5, -1], [12, 1]]), { squash: true }, [
      { x: 3, y: 7, rows: ['kk........kk', '.kk......kk.', '..DD....DD..', '..DI....ID..', '............', '...wkwkwkw..'] },
    ]);
    this.fromFn('slime_fast_d', 12, 14, hornsAbove(this.slimeFn(12, 11, ['k', 'f', 'g', 'h'], 'i'), [[3, -1], [8, 1]]), { squash: true }, [
      { x: 3, y: 8, rows: ['D....D', 'I....I'] },
    ]);
    this.fromFn('slime_spitter_d', 14, 16, hornsAbove(this.slimeFn(14, 13, ['k', 'l', 'm', 'n'], 'o'), [[4, -1], [9, 1]]), { squash: true }, [
      { x: 3, y: 7, rows: ['DD....DD', 'DI....ID', '........', '..kwwk..', '..kCCk..', '...kk...'] },
    ]);
    this.fromRows('slime_drop_d', [
      '..BB..',
      '..BB..',
      '.BAAA.',
      '.AAAk.',
      'BAAAkk',
      'ADkkDk',
      'kAAkkk',
      '.kkkk.',
    ], { squash: true });

    // PIETRA DEL FABBRO
    this.fromRows('stone', ['..444..', '.45554.', '45p5554', '455p554', '4555p54', '.45554.', '..444..']);

    // ALCHIMISTA (blu notte, guarda a destra) --------------------------------
    this._playerRows = [
      '.....yyy.....',
      '...yyyyyyy...',
      '..yzzzzzzzy..',
      '..yz11111zy..',
      '.yyz1w11w1zy.',
      '.yyz111111zyy',
      '.yyyzzzzzzyy.',
      '..yyxxxxxyy..',
      '..yxxxxxxxy..',
      '.yxxxxxxxxxy.',
      '.yxxFFF8Fxxy.',
      '.yxxxxxxxxxy.',
      'yxxxxxxxxxxxy',
      'yxxxxxxxxxxxy',
      'yxxvxxxxxvxxy',
      'yyxxxxxxxxxyy',
      '..33.....33..',
    ];
    this.fromRows('player', this._playerRows, { mirror: true, outline2: true });
    this.cache.player.hurtImg = this._silhouette(this.cache.player.img, PAL.C);
    this.cache.player.dashImg = this._silhouette(this.cache.player.img, PAL.o); this.cache.player.dashMir = this._silhouette(this.cache.player.mir, PAL.o);
    // altri personaggi: stessa sagoma, tinte diverse
    const remap = (rows, map) => rows.map((r) => r.replace(/./g, (c) => map[c] || c));
    const charRows = this._playerRows;
    const mk = (name, map) => {
      this.fromRows(name, remap(charRows, map), { mirror: true, outline2: true });
      this.cache[name].hurtImg = this._silhouette(this.cache[name].img, PAL.C);
      this.cache[name].dashImg = this._silhouette(this.cache[name].img, PAL.o); this.cache[name].dashMir = this._silhouette(this.cache[name].mir, PAL.o);
    };
    // EEK (personaggio iniziale): mezzo ninja con la coda di cavallo, benda grigia sulla fronte,
    // sciarpa viola sul viso e soprabito grigio con il bordo viola. Guarda a destra.
    // Fotogrammi: fermo (2, respiro), corsa (4), lancio del kunai (1).
    const EEK = {
      char_eek: ['........XXXX....', '.......XghhgX...', '..XX..XgghhggX..', '.XgX..Xg7777777.', 'XgX.77X78888887.', 'Xg..7.XgSkSSkS..', 'Xg....XgSSSSSS..', '.X.....XmmmmmX..', '.......Xnmmmn...', '.....44nnnn44...', '....4555p1p554..', '...45555p1p5554.', '...4575.p1p.574.', '...457..p1p..74.', '...4S5..phhp.S4.', '...45..pxxxxp54.', '...45..xx..xx54.', '...4p..xx..xxp4.', '...pp..xx..xx.p.', '.......77..77...', '......444.444...', '......333.333...'],
      char_eek_i1: ['................', '........XXXX....', '.......XghhgX...', '..XX..XgghhggX..', '.XgX..Xg7777777.', 'XgX.77X78888887.', 'Xg..7.XgSkSSkS..', 'Xg....XgSSSSSS..', '.X.....XmmmmmX..', '.......Xnmmmn...', '.....44nnnn44...', '...45555p1p5554.', '...4575.p1p.574.', '...457..p1p..74.', '...4S5..phhp.S4.', '...45..pxxxxp54.', '...45..xx..xx54.', '...4p..xx..xxp4.', '...pp..xx..xx.p.', '.......77..77...', '......444.444...', '......333.333...'],
      char_eek_r0: ['.........XXXX...', '........XghhgX..', '...XX..XgghhggX.', '..XgX..Xg7777777', '.XgX.77X78888887', '.Xg..7.XgSkSSkS.', '.Xg....XgSSSSSS.', '..X.....XmmmmmX.', '........Xnmmmn..', '......44nnnn44..', '....44555p1p554.', '..4455555p1p5S4.', '.44555.75p1p.7..', '4p55...7.p1p....', 'p.p....S.phhp...', '.p..pxxxxxp.....', '......xx..xxx...', '.....xx.....xx..', '....xx......77..', '...77......444..', '..444......333..', '..333...........'],
      char_eek_r1: ['.........XXXX...', '........XghhgX..', '...XX..XgghhggX.', '..XgX..Xg7777777', '.XgX.77X78888887', '.Xg..7.XgSkSSkS.', '.Xg....XgSSSSSS.', '..X.....XmmmmmX.', '........Xnmmmn..', '......44nnnn44..', '....44555p1p554.', '..4455555p1p5S4.', '.44555.75p1p.7..', '4p55...7.p1p....', 'p.p....S.phhp...', '.p..pxxxxp......', '.....xxx.xx.....', '.....xx..xx.....', '.....xx..77.....', '.....77.444.....', '....444.333.....', '....333.........'],
      char_eek_r2: ['.........XXXX...', '........XghhgX..', '...XX..XgghhggX.', '..XgX..Xg7777777', '.XgX.77X78888887', '.Xg..7.XgSkSSkS.', '.Xg....XgSSSSSS.', '..X.....XmmmmmX.', '........Xnmmmn..', '......44nnnn44..', '....44555p1p554.', '..4455555p1p5S4.', '.44555.75p1p.7..', '4p55...7.p1p....', 'p.p....S.phhp...', '.p..pxxxxxp.....', '.....xxx..xx....', '....xx......xx..', '...77.......xx..', '..444.......77..', '..333......444..', '...........333..'],
      char_eek_r3: ['.........XXXX...', '........XghhgX..', '...XX..XgghhggX.', '..XgX..Xg7777777', '.XgX.77X78888887', '.Xg..7.XgSkSSkS.', '.Xg....XgSSSSSS.', '..X.....XmmmmmX.', '........Xnmmmn..', '......44nnnn44..', '....44555p1p554.', '..4455555p1p5S4.', '.44555.75p1p.7..', '4p55...7.p1p....', 'p.p....S.phhp...', '.p..pxxxxp......', '.....xx.xxx.....', '.....xx..xx.....', '.....77..xx.....', '....444..77.....', '....333.444.....', '........333.....'],
      char_eek_t: ['........XXXX....', '.......XghhgX...', '..XX..XgghhggX..', '.XgX..Xg7777777.', 'XgX.77X78888887.', 'Xg..7.XgSkSSkS..', 'Xg....XgSSSSSS..', '.X.....XmmmmmX..', '.......Xnmmmn...', '.....44nnnn44...', '....4555p1p5544.', '...45555p1p5577S', '...4575.p1p.....', '...457..p1p.....', '...4S5..phhp....', '...45..pxxxxp54.', '...45..xx..xx54.', '...4p..xx..xxp4.', '...pp..xx..xx.p.', '.......77..77...', '......444.444...', '......333.333...'],
    };
    for (const k in EEK) {
      const e = this.fromRows(k, EEK[k], { mirror: true, outline2: true });
      e.hurtImg = this._silhouette(e.img, PAL.C);
      e.dashImg = this._silhouette(e.img, PAL.o); e.dashMir = this._silhouette(e.mir, PAL.o);   // copie sbiadite dello scatto
    }
    this.fromRows('proj_kunai', ['.6.....8....', '6.6hhhh8999w', '.6.....8....'], { rotate: true });
    mk('char_badessa', { y: 'n', z: '9', x: 'm', v: 'l', F: '8', 8: 'w' });
    mk('char_fuochista', { y: 'h', z: 'j', x: 'g', v: 'f', F: '4', 8: 'P', w: 'P' });

    // OGGETTI DEL NEGOZIO: 3 versioni (base, +3 bordo viola, +5 bordo rosso)
    const ITEMS = {
      it_dagger: ['..9..', '.989.', '.989.', '.989.', '77777', '..h..', '..h..', '..i..', '.hih.'],
      it_shield: ['zzzzzzzz', 'zyyyyyyz', 'zyyDDyyz', 'zyDDDDyz', 'zyyDDyyz', '.zyyyyz.', '..zyyz..', '...zz...'],
      it_boots: ['..hhh....', '..hih....', '..hih....', '..hih....', '..hiihh..', '.hiiiiih.', '.hhhhhhhh', '.4444444.'],
      it_necklace: ['.j.....j.', '.j.....j.', '..j...j..', '..j...j..', '...j.j...', '....j....', '...DDD...', '...DID...', '....D....'],
      it_spear: ['..9..', '.999.', '.9w9.', '.999.', '..9..', '.777.', '..h..', '..h..', '..h..', '..h..', '..i..', '..h..'],
      it_bow: ['8hh....', '8.ih...', '8..ih..', '8...h..', '8...ih.', '8....h.', '8...ih.', '8...h..', '8..ih..', '8.ih...', '8hh....'],
      it_axe: ['.....h..', '..99.h..', '.9w99h..', '9ww99h..', '9w999h..', '.999.h..', '..9..h..', '.....h..', '.....h..', '.....i..', '.....h..'],
      it_ring: ['..DDD..', '..DID..', '.KKDKK.', 'K.....K', 'L.....K', '.L...K.', '..KKK..'],
      it_cloak: ['...nnn...', '..noKon..', '.nooooon.', '.nooooon.', 'noooooopn', 'noooooopn', 'nooooooon', 'noooooopn', '.nmnmnmn.'],
    };
    for (const k in ITEMS) {
      this.fromRows(k, ITEMS[k]);
      this.fromRows(k + '_3', ITEMS[k], { outlineColor: 'p' });
      this.fromRows(k + '_5', ITEMS[k].map((r) => r.replace(/9/g, 'w')), { outlineColor: 'D' });
    }
    this.fromRows('ico_anvil', ['..77777..', '.7888887.', '7777777..', '...777...', '...777...', '..77777..', '.7777777.']);

    // PROIETTILI / OGGETTI -------------------------------------------------
    this.fromRows('proj_salt', [
      '......9..',
      '5667799w9',
      '......9..',
    ], { rotate: true });
    this.fromFn('orb', 7, 7, this.circleFn(7, 't', '9', 's'));
    this.fromFn('bomb', 9, 11, (x, y) => {
      if (y === 0 && x === 6) return 'P';
      if (y === 1 && (x === 5 || x === 7)) return 'G';
      if (y === 1 && x === 6) return 'P';
      if (y === 2 && x === 5) return '5';
      if (y === 3 && (x === 4 || x === 5)) return '4';
      if (y < 3) return null;
      const f = this.circleFn(8, '3', '6', '1');
      return x < 8 ? f(x, y - 3) : null;
    });
    // gemme XP: scure ma con un punto luce (verde acqua < viola < rosso)
    this.fromFn('gem_s', 5, 7, this.diamondFn(5, 7, ['9', 'u', 't', 's']));
    this.fromFn('gem_m', 7, 9, this.diamondFn(7, 9, ['9', 'p', 'o', 'n']));
    this.fromFn('gem_l', 9, 12, this.diamondFn(9, 12, ['9', 'D', 'C', 'B']));
    // FLUO: monete, cuore, calamita
    this.fromFn('coin', 7, 7, (x, y) => {
      const f = this.circleFn(7, 'Y', 'Z', 'O', 'O')(x, y);
      if (f && x === 3 && y >= 2 && y <= 4) return 'O';
      return f;
    });
    this.fromRows('potion', ['.HH...HH.', 'HIIH.HHHH', 'HIHHHHHHH', 'HHHHHHHHH', '.HHHHHHH.', '..HHHHH..', '...HHH...', '....H....']);
    this.fromRows('vacuum', ['NN...NN', 'MM...MM', 'MM...MM', 'MM...MM', 'MMMMMMM', '.MMMMM.']);
    this.fromRows('dot', ['8'], { outline: false });

    // CIFRE 3x5 per i numeri del danno (grigio chiaro e bianco)
    const DIG = [
      ['888', '8.8', '8.8', '8.8', '888'], ['.8.', '88.', '.8.', '.8.', '888'], ['888', '..8', '888', '8..', '888'],
      ['888', '..8', '.88', '..8', '888'], ['8.8', '8.8', '888', '..8', '..8'], ['888', '8..', '888', '..8', '888'],
      ['888', '8..', '888', '8.8', '888'], ['888', '..8', '..8', '.8.', '.8.'], ['888', '8.8', '888', '8.8', '888'],
      ['888', '8.8', '888', '..8', '888'],
    ];
    this.digits = []; this.digitsW = []; this.digitsH = [];
    for (let i = 0; i < 10; i++) {
      this.digits.push(this.fromRows('dig' + i, DIG[i]).img);
      this.digitsW.push(this.fromRows('digw' + i, DIG[i].map((r) => r.replace(/8/g, 'w'))).img);
      this.digitsH.push(this.fromRows('digh' + i, DIG[i].map((r) => r.replace(/8/g, 'I'))).img);
    }
    this.plus = this.fromRows('plus', ['.I.', 'III', '.I.']).img;

    // ICONE UI (stesse tinte degli oggetti di gioco) --------------------------
    this.fromRows('ico_dart', ['......w', '.....99', '....98.', '...88..', '..77...', '.66....', '5......']);
    this.fromRows('ico_aura', ['..ppp..', '.p...p.', 'p..9..p', 'p.999.p', 'p..9..p', '.p...p.', '..ppp..']);
    this.fromRows('ico_orb', ['...u...', '.......', 'u..9..u', '..tut..', 'u..t..u', '.......', '...u...']);
    this.fromRows('ico_bolt', ['...999.', '..99p..', '.99p...', '9999999', '...p99.', '..p99..', '.99p...', '.9p....', '9......']);
    this.cache.ico_bomb = this.cache.bomb; this.url.ico_bomb = this.url.bomb;
    this.fromRows('ico_might', ['..DDDD..', '.D9CCCD.', 'D9wCCCCD', 'DCCCCCCD', 'DDCCCCDD', '.DDDDDD.', '..DDDD..']);
    this.fromRows('ico_speed', ['uu..uu...', '.uu..uu..', '..uu..uu.', '...uu..uu', '..uu..uu.', '.uu..uu..', 'uu..uu...']);
    this.fromRows('ico_heart', ['.HH...HH.', 'HIIH.HHHH', 'HIHHHHHHH', 'HHHHHHHHH', '.HHHHHHH.', '..HHHHH..', '...HHH...', '....H....']);
    this.fromRows('ico_regen', ['...ddd...', '...ded...', '...ded...', 'ddddedddd', 'deeeeeeed', 'ddddedddd', '...ded...', '...ded...', '...ddd...']);
    this.fromRows('ico_magnet', ['NNN...NNN', 'MMM...MMM', 'MMM...MMM', 'MMM...MMM', 'MMMM.MMMM', '.MMMMMMM.', '..MMMMM..']);
    this.fromRows('ico_book', ['.hhhhhhh', 'hjjjjjjh', 'hjkkkkjh', 'hjjjjjjh', 'hjkkkjjh', 'hjjjjjjh', 'hhhhhhhh', 'h9h9h9h.']);
    this.fromRows('ico_hourglass', ['7777777', '.7jjj7.', '..7j7..', '...7...', '..7.7..', '.7.j.7.', '.7jjj7.', '7777777']);
    this.fromRows('ico_skull', ['.8888.', '888888', '8kk8kk', '888888', '.8k8k.']);
    // armi e passive nuove
    this.fromRows('ico_whip', ['...8888.', '..8....9', '.8......', '.8...9..', '..8.9...', '...h....', '..hh....', '.hh.....']);
    this.fromRows('ico_storm', ['8888888', '.77777.', '..6666.', '..555..', '...44..', '...4...', '..4....']);
    this.fromRows('ico_beam', ['....L....', '.L..9..L.', '..L999L..', '..99w99..', 'LL9www9LL', '..99w99..', '..L999L..', '.L..9..L.', '....L....']);
    this.fromRows('ico_frost', ['...{.{...', '....]....', '.{..]..{.', '..{.].{..', ']]]]w]]]]', '..{.].{..', '.{..]..{.', '....]....', '...{.{...']);
    this.fromRows('ico_helix', ['..LLLLL..', '.L.....L.', 'L..KKK..L', 'L.K...K.L', 'L.K.w.K.L', 'L.K..KK.L', 'L..K....L', '.L..KKKL.', '..L......']);
    this.fromRows('ico_area', ['7.......7', '.7.....7.', '..8...8..', '...999...', '...9w9...', '...999...', '..8...8..', '.7.....7.', '7.......7']);
    this.fromRows('ico_twins', ['.w....w.', 'w9w..w9w', '.w....w.', '.7....7.', '.777777.', '.7....7.', '.7....7.']);
    this.fromRows('ico_greed', ['..hhh..', '...h...', '.ggggg.', 'gggLggg', 'ggLLLgg', 'gggLggg', '.ggggg.']);
    this.fromRows('ico_armor', ['.6.....6.', '6666.6666', '677777776', '.6777776.', '.6787876.', '.6777776.', '..67776..', '...666...']);
    // lama del Pugio per il fendente (16 rotazioni)
    this.fromRows('fx_pugio', ['....77.........', 'hhih7789999999w', 'hhih7788888889.', '....77.........'], { rotate: true });

    this.initWorld();
    this.initVillage();
    Doll.init();   // personaggi ad alta risoluzione (Eek, abitanti del villaggio)
    BossArt.init(); // boss del minuto 7 e 10 di ogni mappa

    // PAVIMENTO DELLA CRIPTA (tile 128x128) ----------------------------------
    const T = 128;
    this.floor = document.createElement('canvas');
    this.floor.width = this.floor.height = T;
    const f = this.floor.getContext('2d');
    let seed = 1337;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    f.fillStyle = '#060509'; f.fillRect(0, 0, T, T);
    for (let ty = 0; ty < T; ty += 32) {
      const off = (ty / 32) % 2 ? 16 : 0;
      for (let tx = -32; tx < T; tx += 32) {
        f.fillStyle = rnd() < 0.5 ? '#0b0a0f' : '#0d0c12';
        f.fillRect(tx + off + 1, ty + 1, 30, 30);
        // luce sul bordo alto-sinistro della lastra
        f.fillStyle = '#16141d';
        f.fillRect(tx + off + 1, ty + 1, 30, 1); f.fillRect(tx + off + 1, ty + 1, 1, 30);
      }
    }
    for (let i = 0; i < 90; i++) {
      const r = rnd();
      f.fillStyle = r < 0.06 ? '#2a0e14' : r < 0.12 ? '#14240f' : r < 0.5 ? '#18161f' : '#030205';
      f.fillRect((rnd() * T) | 0, (rnd() * T) | 0, 1, 1);
    }
    // muschio
    for (let i = 0; i < 4; i++) {
      const cx = rnd() * T, cy = rnd() * T;
      for (let k = 0; k < 14; k++) {
        f.fillStyle = rnd() < 0.3 ? '#1b2e14' : '#122010';
        f.fillRect((cx + (rnd() - 0.5) * 10) | 0, (cy + (rnd() - 0.5) * 6) | 0, 1, 1);
      }
    }
    // pattern per i dither (trasparenze "finte")
    this.dither = this.makeDither(PAL.o);
    this.floors = { cripta: this.floor, village: this.makeFloor('village') };
    for (const k of ['palude', 'cattedrale', 'selva', 'dite', 'cocito', 'slab', 'plaza']) this.floors[k] = this.makeFloor(k);
  },
};
