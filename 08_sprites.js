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

PAL['~'] = EVO_NEON;   // verde evidenziatore: SOLO il contorno delle armi evolute (vedi SPR.neon)

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
    // Linguae Ignis: fiamma NERA, GIALLA e BIANCA (bordo quasi nero, corpo giallo, cuore bianco); evoluta: bordo bianco
    this.fromRows('wisp', ['...1...', '..11...', '..1Y1..', '.1YY1..', '.1YZY1.', '1YZwZY1', '1YwwwY1', '.1YZY1.', '..111..']);
    this.fromRows('wisp_evo', ['...w...', '..ww...', '..wYw..', '.wYYw..', '.wYZYw.', 'wYZwZYw', 'wYwwwYw', '.wYZYw.', '..www..']);
    for (const [ico, src] of [['ico_scythe', 'proj_scythe'], ['ico_acid', 'flask'], ['ico_wisp', 'wisp']]) { this.cache[ico] = this.cache[src]; this.url[ico] = this.url[src]; }
    this.fromFn('glob', 5, 5, this.circleFn(5, 'n', 'p', 'm'));
    this.fromFn('ebullet', 6, 6, this.circleFn(6, 'u', '9', 't'));

    // BOSS FINALE
    this.fromFn('boss_primal', 152, 140, this.bossFn(152, 140, { eye: 'u', eyeCore: '9', mouth: 's', rim: 't', veins: 'r' }), { squash: true });

    // VILLAGGIO: abitanti, pozzo, lanterne (le case sono in initVillage)
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
    // freccia dell'Arciere nemico: grossa, impennaggio rosso, punta bianca (deve vedersi da lontano)
    this.fromRows('eb_arrow', ['DDD............9......', '.DDD...........999....', '..DDD..........99999..', '..C8888888888889wwwwww', '..DDD..........99999..', '.DDD...........999....', 'DDD............9......'], { rotate: true });
    // Rota Fortunae: ruota d'oro con i raggi (16 rotazioni: gira su se stessa)
    this.fromRows('proj_wheel', ['...LLL...', '.LL.K.LL.', '.L.KKK.L.', 'L.K.K.K.L', 'LKKKwKKKL', 'L.K.K.K.L', '.L.KKK.L.', '.LL.K.LL.', '...LLL...'], { rotate: true });
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
    // CASE GIAPPONESI (2026-10-17, al posto delle casette a punta): tetti di coppi scuri con la gronda all'insù,
    // legno, carta di riso accesa, lanterne. Il colore del mestiere sta su drappi, stendardi o tetti.
    // Ogni edificio salva sullo sprite (coordinate dello sprite, contorno compreso):
    //   e.sign  = [x, y, standing]  centro dell'insegna con l'icona (standing = su un palo, sennò appesa)
    //   e.smoke = [x, y] | null      da dove esce il fumo
    //   e.lamps = [[x, y], ...]      lanterne che fanno l'alone caldo
    const COL = { magister: ['s', 't', 'u'], smith: ['B', 'C', 'D'], weapons: ['x', 'y', 'z'], armor: ['b', 'c', 'd'], inn: ['m', 'n', 'o'], haruspex: ['F', 'G', 'P'] };
    const jp = (W, H) => {
      const o = mk(W, H), { set, rect } = o;
      o.lamps = [];
      // tetto: x0..x1 = larghezza alla gronda (riga y1), rientro `inset` al colmo (riga y0); i fianchi curvano verso l'interno
      o.roof = (x0, x1, y0, y1, inset, tile, rim) => {
        const [T0, T1, T2] = tile || ['2', '3', '4'], RIM = rim || '6', mid = x0 + (x1 - x0) * 0.6;
        for (let y = y0; y <= y1; y++) {
          const t = (y - y0) / Math.max(1, y1 - y0), a = Math.round(inset * (1 - t * t)), L = x0 + a, R = x1 - a;
          for (let x = L; x <= R; x++) {
            let c = x < mid ? (x % 2 ? T1 : T2) : (x % 2 ? T0 : T1);       // file di coppi, luce da sinistra
            if (x === L || x === R || y === y0 || y === y1 - 1) c = T0;
            if (y === y1) c = RIM;
            set(x, y, c);
          }
        }
        set(x0 - 1, y1 - 1, RIM); set(x1 + 1, y1 - 1, RIM);                  // punte all'insù
      };
      // frontone triangolare con la base sulla riga yb
      o.gable = (x0, x1, yb, face, trim) => {
        const h = (x1 - x0) >> 1;
        for (let k = 0; k <= h; k++) for (let x = x0 + k; x <= x1 - k; x++) set(x, yb - k, x === x0 + k || x === x1 - k ? trim : face);
      };
      o.planks = (x0, y0, x1, y1, a, b) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, x % 3 === 0 ? a : b); };
      o.plaster = (x0, y0, x1, y1) => { rect(x0, y0, x1, y1, '7'); rect(x0, y0, x1, y0, '5'); };
      // finestra di carta accesa, con la grata
      o.win = (x0, y0, x1, y1) => {
        rect(x0, y0, x1, y1, 'f');
        for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++)
          set(x, y, (x - x0) % 3 === 0 || (y - y0) % 3 === 0 ? 'F' : (x + y) % 4 === 0 ? 'P' : 'G');
      };
      // lanterna di carta (3x4) appesa per il gancio in (x+1, y)
      o.lamp = (x, y, paper) => {
        set(x + 1, y, 'g'); rect(x, y + 1, x + 2, y + 2, paper || 'G'); set(x + 1, y + 1, 'P'); set(x + 1, y + 2, 'P'); set(x + 1, y + 3, 'F');
        o.lamps.push([x + 1, y + 2]);
      };
      // stemma bianco (mon) 3x3 centrato in (x, y)
      o.mon = (x, y, bg) => { set(x, y - 1, '9'); set(x - 1, y, '9'); set(x + 1, y, '9'); set(x, y + 1, '9'); set(x, y, bg); };
      // tenda (noren) del colore del mestiere, divisa in teli, con lo stemma
      o.noren = (x0, y0, x1, y1, col) => {
        const [c0, c1, c2] = col;
        rect(x0 - 1, y0, x1 + 1, y0, 'g');
        for (let y = y0 + 1; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          if ((x - x0) % 4 === 3 && y > y0 + 2) continue;                    // spacchi tra i teli
          set(x, y, y === y1 ? c0 : x === x0 ? c2 : c1);
        }
        o.mon((x0 + x1) >> 1, y0 + 3, c0);
      };
      // stendardo verticale con lo stemma e la coda a punte
      o.banner = (x0, y0, x1, y1, col) => {
        const [c0, c1, c2] = col;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          if (y === y1 && (x - x0) % 2 === 1) continue;
          set(x, y, y === y0 ? c0 : x === x0 ? c2 : x === x1 ? c0 : c1);
        }
        o.mon((x0 + x1) >> 1, y0 + 4, c0);
      };
      o.stone = (x0, y0, x1, y1) => {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const row = ((y - y0) / 3) | 0;
          set(x, y, (y - y0) % 3 === 2 || (x + (row & 1) * 3) % 6 === 0 ? '2' : (x * 5 + y * 3) % 11 === 0 ? '4' : '3');
        }
      };
      o.line = (xa, ya, xb, yb, c) => {
        const n = Math.max(Math.abs(xb - xa), Math.abs(yb - ya));
        for (let i = 0; i <= n; i++) set(Math.round(xa + (xb - xa) * i / n), Math.round(ya + (yb - ya) * i / n), c);
      };
      o.done = (name, sign, smoke) => {
        const e = this._register(name, o.g);
        e.sign = [sign[0] + 1, sign[1] + 1, !!sign[2]];
        e.smoke = smoke ? [smoke[0] + 1, smoke[1] + 1] : null;
        e.lamps = o.lamps.map(([x, y]) => [x + 1, y + 1]);
        return e;
      };
      return o;
    };

    // LOCANDA: due piani di legno, finestre lunghe accese, noren viola e lanterne rosse
    {
      const o = jp(52, 48), { set, rect } = o;
      o.roof(5, 46, 1, 9, 12);
      set(17, 0, '3'); set(34, 0, '3');
      o.planks(9, 10, 42, 19, 'g', 'h'); rect(9, 10, 42, 10, '1'); rect(9, 10, 9, 19, 'f'); rect(42, 10, 42, 19, 'f');
      o.win(12, 12, 39, 18);
      o.roof(2, 49, 20, 24, 3);
      o.planks(5, 25, 46, 42, 'g', 'h'); rect(5, 25, 46, 25, '1'); rect(5, 25, 5, 42, 'f'); rect(46, 25, 46, 42, 'f');
      rect(20, 28, 31, 42, 'E'); rect(21, 33, 30, 42, 'F');
      o.noren(20, 28, 31, 35, COL.inn);
      o.win(8, 29, 16, 37); o.win(35, 29, 43, 37);
      o.lamp(17, 25, 'D'); o.lamp(32, 25, 'D');
      o.stone(3, 43, 48, 45); rect(21, 44, 30, 45, '4'); rect(22, 46, 29, 47, '3');
      o.done('h_inn', [26, 15]);
    }
    // FORGIA: tetto basso con lo sfiato da cui esce il fumo, bocca del fuoco accesa, muro di pietra
    {
      const o = jp(50, 42), { set, rect } = o;
      rect(22, 1, 27, 3, '3'); rect(21, 0, 28, 0, '2');                          // sfiato sul colmo
      o.roof(3, 46, 3, 13, 15);
      o.planks(5, 14, 44, 26, 'f', 'g'); rect(5, 14, 44, 14, '1');
      o.stone(5, 27, 44, 35);
      rect(7, 17, 20, 35, 'f'); rect(8, 18, 19, 35, 'A');                         // bocca della forgia
      for (let y = 25; y <= 35; y++) for (let x = 8; x <= 19; x++) {
        const k = y - 25 + ((x * 7) % 3);
        set(x, y, k > 8 ? ((x + y) % 2 ? 'P' : 'G') : k > 5 ? ((x + y) % 3 ? 'G' : 'D') : k > 2 ? 'D' : 'C');
      }
      rect(9, 31, 18, 31, '6'); rect(10, 32, 17, 35, '5');                        // incudine davanti al fuoco
      rect(23, 21, 30, 35, 'f'); o.planks(24, 22, 29, 35, 'g', 'h');
      o.noren(23, 20, 30, 26, COL.smith);
      o.win(34, 17, 41, 24);
      o.lamp(31, 15);
      o.stone(3, 36, 46, 39); rect(23, 40, 30, 41, '4');
      o.done('h_smith', [38, 31], [24, 0]);
    }
    // ARMAIOLO: torre di guardia di legno, tetto di paglia, stendardo blu, barili ai piedi
    {
      const o = jp(34, 56), { set, rect } = o;
      for (const [xa, xb] of [[7, 10], [11, 8], [26, 23], [22, 25]]) o.line(xa, 0, xb, 3, 'g');   // pali incrociati sul colmo
      o.roof(2, 31, 3, 12, 9, ['h', 'i', 'j'], 'i');
      for (let y = 4; y <= 10; y++) for (let x = 3; x <= 30; x++)                 // paglia a fasce, non coppi
        if ('ij'.includes(o.g[y][x])) set(x, y, (x * 3 + y * 7) % 5 === 0 ? 'h' : y % 3 === 1 ? 'i' : 'j');
      for (let x = 2; x <= 31; x += 3) set(x, 13, 'h');                           // frangia di paglia
      rect(7, 14, 26, 20, '1');
      o.lamp(15, 14);
      rect(5, 13, 6, 21, 'f'); rect(27, 13, 28, 21, 'f');
      rect(5, 17, 28, 17, 'h'); for (let x = 8; x <= 25; x += 3) rect(x, 18, x, 20, 'g');
      rect(3, 21, 30, 22, 'g'); rect(3, 21, 30, 21, 'h');
      rect(12, 23, 13, 52, 'g'); rect(20, 23, 21, 52, 'g');                       // gambe dietro
      for (let y = 23; y <= 52; y++) {                                            // gambe davanti (divaricate)
        const d = Math.round((y - 23) * 3 / 29);
        set(6 - d, y, 'h'); set(7 - d, y, 'f'); set(27 + d, y, 'f'); set(26 + d, y, 'h');
      }
      o.line(7, 24, 26, 37, 'h'); o.line(26, 24, 7, 37, 'h'); rect(6, 37, 27, 37, 'g');
      o.line(6, 38, 27, 51, 'h'); o.line(27, 38, 6, 51, 'h');
      o.banner(18, 23, 24, 35, COL.weapons);
      for (const bx of [1, 7]) {                                                  // barili
        rect(bx, 47, bx + 5, 53, 'h'); rect(bx + 1, 47, bx + 4, 53, 'i');
        rect(bx, 48, bx + 5, 48, '4'); rect(bx, 52, bx + 5, 52, '4'); rect(bx + 1, 46, bx + 4, 46, 'g');
      }
      rect(2, 54, 31, 55, '3'); rect(2, 55, 31, 55, '2');
      o.done('h_weapons', [17, 43]);
    }
    // CORAZZAIO: piccolo castello a tre tetti, mura chiare, basamento di pietra e stendardi verdi
    {
      const o = jp(48, 58), { set, rect } = o;
      o.roof(14, 33, 2, 8, 5);
      set(19, 1, 'L'); set(18, 0, 'K'); set(28, 1, 'L'); set(29, 0, 'K');        // pesci d'oro sul colmo
      o.plaster(16, 9, 31, 14); rect(19, 11, 21, 13, 'f'); set(20, 12, 'G'); rect(26, 11, 28, 13, 'f'); set(27, 12, 'G');
      o.roof(8, 39, 15, 20, 6);
      o.gable(19, 28, 18, '6', '3'); set(23, 14, 'L'); set(24, 14, 'L');
      o.plaster(11, 21, 36, 28);
      for (const wx of [14, 22, 30]) { rect(wx, 23, wx + 3, 26, 'f'); rect(wx + 1, 24, wx + 2, 25, 'G'); }
      o.roof(3, 44, 29, 34, 6);
      o.plaster(7, 35, 40, 39);
      for (let y = 40; y <= 44; y++) for (let x = 7; x <= 40; x++) set(x, y, x % 2 ? '1' : '2');   // assi scure in basso
      rect(10, 36, 13, 38, 'f'); rect(11, 37, 12, 37, 'G'); rect(34, 36, 37, 38, 'f'); rect(35, 37, 36, 37, 'G');
      rect(20, 37, 27, 44, 'f'); o.planks(21, 38, 26, 44, 'g', 'h'); set(22, 41, 'K'); set(25, 41, 'K');
      o.lamp(16, 35); o.lamp(29, 35);
      for (let y = 45; y <= 55; y++) {                                            // basamento a scarpa
        const a = Math.round((55 - y) * 4 / 10), row = ((y - 45) / 3) | 0;
        for (let x = 1 + a; x <= 46 - a; x++) set(x, y, (y - 45) % 3 === 2 || (x + (row & 1) * 4) % 8 === 0 ? '2' : x < 12 ? '4' : '3');
      }
      for (let y = 45; y <= 57; y++) { const a = Math.max(0, 57 - y) >> 2; rect(19 - (3 - a), y, 28 + (3 - a), y, y % 2 ? '5' : '4'); }   // scalinata
      for (const [px, fx] of [[0, 1], [47, 43]]) {                                // stendardi
        rect(px, 30, px, 55, 'g'); set(px, 29, 'K');
        o.banner(fx, 31, fx + 3, 41, COL.armor);
      }
      o.done('h_armor', [38, 50]);
    }
    // MAGISTER: pagoda a tre tetti di rame verde, pilastri rossi, guglia d'oro
    {
      const o = jp(34, 58), { set, rect } = o;
      const TEAL = ['r', 's', 't'];
      rect(16, 1, 17, 10, 'K'); for (const y of [3, 5, 7]) rect(15, y, 18, y, 'L'); rect(16, 0, 17, 0, 'L');
      o.roof(8, 25, 10, 15, 5, TEAL, 'u');
      rect(11, 16, 22, 20, 'h'); rect(11, 16, 11, 20, 'C'); rect(22, 16, 22, 20, 'C'); o.win(14, 16, 19, 20); rect(11, 16, 22, 16, '1');
      o.roof(5, 28, 21, 26, 5, TEAL, 'u');
      rect(9, 27, 24, 31, 'h'); rect(9, 27, 9, 31, 'C'); rect(24, 27, 24, 31, 'C'); o.win(12, 27, 21, 31); rect(9, 27, 24, 27, '1');
      o.roof(1, 32, 32, 38, 6, TEAL, 'u');
      o.planks(5, 39, 28, 50, 'g', 'h'); rect(5, 39, 28, 40, '1');
      rect(5, 39, 6, 50, 'C'); set(5, 41, 'D'); rect(5, 42, 5, 50, 'D'); rect(27, 39, 28, 50, 'C');
      o.win(11, 42, 22, 50);
      o.lamp(7, 39, 'D'); o.lamp(24, 39, 'D');
      o.stone(3, 51, 30, 54); rect(12, 55, 21, 55, '4'); rect(13, 56, 20, 57, '3');
      o.done('h_magister', [-6, 46, true]);
    }
    // ARUSPICE: santuario con pilastri rossi, corda sacra, frontone curvo d'oro e due lanterne di pietra
    {
      const o = jp(56, 46), { set, rect } = o;
      o.roof(5, 50, 2, 15, 16);
      set(21, 1, 'L'); set(20, 0, 'K'); set(34, 1, 'L'); set(35, 0, 'K'); rect(27, 1, 28, 1, 'L');
      for (let x = 19; x <= 36; x++) {                                            // frontone curvo
        const top = 14 - Math.round(4 * Math.sin(Math.PI * (x - 19) / 17));
        for (let y = top; y <= 14; y++) set(x, y, y === top ? 'L' : y === top + 1 ? 'K' : y % 2 ? 'C' : 'B');
      }
      rect(9, 16, 46, 36, '1');
      rect(7, 16, 48, 17, 'C'); for (let x = 9; x <= 46; x += 6) set(x, 16, 'L');
      o.planks(11, 18, 17, 36, 'f', 'g'); o.planks(38, 18, 44, 36, 'f', 'g');
      o.win(21, 24, 34, 36);
      for (const px of [9, 18, 36, 45]) { rect(px, 18, px + 1, 36, 'D'); rect(px + 1, 18, px + 1, 36, 'C'); }
      o.lamp(13, 20, 'D'); o.lamp(40, 20, 'D');
      for (let x = 15; x <= 40; x++) {                                            // corda sacra con le strisce di carta
        const sag = x > 21 && x < 34 ? 1 : 0;
        set(x, 19 + sag, (x + sag) % 2 ? 'j' : 'K'); set(x, 20 + sag, (x + sag) % 2 ? 'K' : 'i');
      }
      for (const zx of [20, 27, 34]) { set(zx, 22, '9'); set(zx + 1, 23, '9'); set(zx, 24, '9'); set(zx + 1, 25, '8'); }
      rect(6, 37, 49, 38, 'g'); rect(6, 37, 49, 37, 'h');
      o.stone(5, 39, 50, 41);
      rect(22, 39, 33, 40, '5'); rect(21, 41, 34, 42, '4'); rect(20, 43, 35, 44, '3'); rect(20, 45, 35, 45, '2');
      for (const lx of [0, 51]) {                                                 // lanterne di pietra
        rect(lx + 1, 27, lx + 3, 27, '5'); rect(lx, 28, lx + 4, 28, '5');
        rect(lx + 1, 29, lx + 3, 31, '4'); set(lx + 2, 29, 'G'); set(lx + 2, 30, 'P');
        rect(lx, 32, lx + 4, 32, '4'); rect(lx + 2, 33, lx + 2, 41, '4'); rect(lx + 1, 33, lx + 1, 41, '5');
        rect(lx, 42, lx + 4, 44, '3'); rect(lx, 42, lx + 4, 42, '4');
        o.lamps.push([lx + 2, 30]);
      }
      o.done('h_haruspex', [27, 21]);
    }
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
    } else if (kind === 'grass') {
      // ERBA VERDE SCURO (la Cripta, 2026-10-17): chiazze più scure, fili d'erba a due toni, punte chiare, sassolini
      const pw = (col, x, y, w, h) => px(col, ((x % T) + T) % T, ((y % T) + T) % T, w, h);   // si ripete senza giunte
      f.fillStyle = '#1a2b15'; f.fillRect(0, 0, T, T);
      for (let i = 0; i < 26; i++) {
        const cx = rnd() * T, cy = rnd() * T, r = 4 + rnd() * 9;
        for (let k = 0; k < r * 4; k++) pw('#15240f', cx + (rnd() - 0.5) * r * 2, cy + (rnd() - 0.5) * r, 2, 1);
      }
      for (let i = 0; i < 520; i++) pw(rnd() < 0.5 ? '#203519' : '#243b1c', rnd() * T, rnd() * T, 1, 2);
      for (let i = 0; i < 140; i++) pw('#2c4722', rnd() * T, rnd() * T, 1, 1);
      for (let i = 0; i < 18; i++) pw(rnd() < 0.5 ? '#2a2618' : '#24221a', rnd() * T, rnd() * T, 2, 1);
      for (let i = 0; i < 8; i++) pw(rnd() < 0.5 ? '#3d3350' : '#4d4526', rnd() * T, rnd() * T, 1, 1);
    } else if (kind === 'village') {
      f.fillStyle = '#0a0c08'; f.fillRect(0, 0, T, T);
      for (let i = 0; i < 420; i++) px(rnd() < 0.5 ? '#121a0e' : '#0e140b', rnd() * T, rnd() * T, 1, 1 + (rnd() * 2 | 0)); // erba scura
      for (let i = 0; i < 30; i++) px('#1d2a14', rnd() * T, rnd() * T);
      for (let i = 0; i < 10; i++) px(rnd() < 0.5 ? '#2a1530' : '#2e2612', rnd() * T, rnd() * T);                   // fiorellini
    }
    return c;
  },

  // CONTORNO NEON (armi evolute): i pixel neri del bordo esterno diventano verde evidenziatore, l'interno resta scuro
  _neonize(src) {
    const W = src.width, H = src.height, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    const img = g.getImageData(0, 0, W, H), d = img.data, mark = new Uint8Array(W * H);
    const clear = (x, y) => x < 0 || y < 0 || x >= W || y >= H || d[(y * W + x) * 4 + 3] === 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] === 0 || d[i] || d[i + 1] || d[i + 2]) continue;     // solo i pixel neri
      if (clear(x - 1, y) || clear(x + 1, y) || clear(x, y - 1) || clear(x, y + 1)) mark[y * W + x] = 1;
    }
    const nr = parseInt(EVO_NEON.slice(1, 3), 16), ng = parseInt(EVO_NEON.slice(3, 5), 16), nb = parseInt(EVO_NEON.slice(5, 7), 16);
    for (let k = 0; k < W * H; k++) if (mark[k]) { d[k * 4] = nr; d[k * 4 + 1] = ng; d[k * 4 + 2] = nb; }
    g.putImageData(img, 0, 0);
    return c;
  },
  // versione neon di uno sprite (e delle sue 16 rotazioni): e.neon, e.neonRot. Si prepara una volta sola.
  neon(name) {
    const e = this.cache[name];
    if (!e || e.neon) return e;
    e.neon = this._neonize(e.img);
    if (e.rot) e.neonRot = e.rot.map((r) => this._neonize(r));
    return e;
  },
  // icona neon per la UI (HUD, carte, resoconto)
  neonUrl(name) {
    const e = this.neon(name);
    return e ? (e.neonUrl || (e.neonUrl = e.neon.toDataURL())) : '';
  },

  // schiarisce un pavimento già disegnato (il giorno è un po' più luminoso): ogni canale x mul + add
  lighten(c, mul, add) {
    const g = c.getContext('2d'), img = g.getImageData(0, 0, c.width, c.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 3; j++) d[i + j] = Math.min(255, d[i + j] * mul + add);
    g.putImageData(img, 0, 0);
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
    // STELLE DI COCITO: stella di ghiaccio a 4 punte in ALTA RISOLUZIONE (e.hi: 2 pixel del gioco = 1 pixel qui),
    // due fotogrammi che si alternano (punte dritte / punte in diagonale) = scintilla
    const ICE = { w: '#f2efff', a: '#a3d2e0', b: '#4f8aa0', c: '#2a4d5e' };
    for (const k in ICE) if (!PAL['ice_' + k]) PAL['ice_' + k] = ICE[k];
    const star = (rot, R, R2) => (x, y) => {
      const dx0 = x - 11, dy0 = y - 11, d = Math.sqrt(dx0 * dx0 + dy0 * dy0);
      // stella grande a 4 punte + stellina piccola ruotata di 45° dietro (8 punte in tutto)
      const pt = (dx, dy, RR) => Math.sqrt(Math.abs(dx)) + Math.sqrt(Math.abs(dy)) <= Math.sqrt(RR);
      let dx = dx0, dy = dy0;
      if (rot) { dx = (dx0 + dy0) * 0.7071; dy = (dx0 - dy0) * 0.7071; }
      const big = pt(dx, dy, R), small = pt((dx + dy) * 0.7071, (dx - dy) * 0.7071, R2);
      if (!big && !small) return d < 4.6 ? 'ice_b' : null;            // alone tondo attorno al cuore
      if (d < 3.2) return 'ice_w';
      if (big) return Math.abs(dx) < 0.8 || Math.abs(dy) < 0.8 ? 'ice_w' : 'ice_a';   // nervatura bianca, punte azzurro chiaro
      return d < 5 ? 'ice_a' : 'ice_b';
    };
    for (const [n, rot] of [['star_ice', false], ['star_ice2', true]]) { const e = this.fromFn(n, 23, 23, star(rot, 11, 5)); e.hi = true; }
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
    this.fromRows('ico_wheel', ['...LLL...', '.LLKKKLL.', '.LwLKLKL.', 'LKLKKKLKL', 'LKKKwKKKL', 'LKLKKKLKL', '.LKLKLKL.', '.LLKKKLL.', '...LLL...']);
    this.fromRows('ico_caltrop', ['....9....', '....8....', '....7....', '9.67876.9', '.8778778.', '..67876..', '...6.6...', '..6...6..', '.5.....5.']);
    this.fromRows('ico_area', ['7.......7', '.7.....7.', '..8...8..', '...999...', '...9w9...', '...999...', '..8...8..', '.7.....7.', '7.......7']);
    this.fromRows('ico_twins', ['.w....w.', 'w9w..w9w', '.w....w.', '.7....7.', '.777777.', '.7....7.', '.7....7.']);
    // Arcanum [?] del Magister: scrigno viola col punto di domanda (fusione delle armi)
    this.fromRows('ico_arcanum', ['.ppppppp.', 'pnnnnnnnp', 'pnnZZZnnp', 'pnZnnnZnp', 'pnnnnnZnp', 'pnnnZZnnp', 'pnnnZnnnp', 'pnnnnnnnp', 'pnnnZnnnp', '.ppppppp.']);
    this.fromRows('ico_greed', ['..hhh..', '...h...', '.ggggg.', 'gggLggg', 'ggLLLgg', 'gggLggg', '.ggggg.']);
    this.fromRows('ico_armor', ['.6.....6.', '6666.6666', '677777776', '.6777776.', '.6787876.', '.6777776.', '..67776..', '...666...']);
    // lama del Pugio per il fendente (16 rotazioni)
    this.fromRows('fx_pugio', ['....77.........', 'hhih7789999999w', 'hhih7788888889.', '....77.........'], { rotate: true });

    this.initWorld();
    this.initVillage();
    Doll.init();   // personaggi ad alta risoluzione (Eek, abitanti del villaggio)
    BossArt.init(); // boss del minuto 7 e 10 di ogni mappa

    // PAVIMENTO DELLA CRIPTA: erba verde scuro (prima erano lastre quasi nere: di notte non si notava la differenza)
    this.floor = this.makeFloor('grass');
    // pattern per i dither (trasparenze "finte")
    this.dither = this.makeDither(PAL.o);
    this.floors = { cripta: this.floor, village: this.makeFloor('village') };
    for (const k of ['palude', 'cattedrale', 'selva', 'dite', 'cocito', 'slab', 'plaza']) this.floors[k] = this.makeFloor(k);
    // versioni col contorno neon degli sprite che le armi evolute lanciano
    for (const n of ['proj_salt', 'proj_kunai', 'orb', 'proj_scythe', 'bomb', 'flask', 'proj_wheel']) this.neon(n);   // Linguae Ignis evoluta usa wisp_evo
    // giorno un po' più chiaro sulle altre mappe (il villaggio resta com'è)
    for (const k of ['palude', 'cattedrale', 'selva', 'dite', 'cocito', 'slab']) this.lighten(this.floors[k], DAY_LIFT.mul, DAY_LIFT.add);
  },
};
