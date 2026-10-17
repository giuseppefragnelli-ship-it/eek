'use strict';
// js/11_art_bosses.js — BossArt: i boss delle mappe disegnati da codice

// ============================================================================
// BOSS DELLE MAPPE — minuto 7 e minuto 10, diversi per ogni mappa.
// Come i personaggi "Doll": forme disegnate su un canvas (ellissi, poligoni,
// curve affusolate), poi QUANTIZZATE nella palette e ombreggiate in automatico
// per materiale (luce in alto a sinistra, ombra in basso a destra).
// ============================================================================

// colori extra solo per i boss
PAL['+'] = '#6f7f68'; PAL['='] = '#465243'; PAL['!'] = '#9aab90';   // pelle di pietra (Medusa)
PAL['('] = '#5b6b80'; PAL[')'] = '#3b4658'; PAL['['] = '#8696ad';   // pelle congelata (Anteo)
PAL['{'] = '#4f8aa0'; PAL['}'] = '#2a4d5e'; PAL[']'] = '#a3d2e0';   // ghiaccio del Cocito
PAL['<'] = '#a89a62'; PAL['>'] = '#6e6236'; PAL['^'] = '#d3c690';   // volto giallastro (Lucifero)

const BossArt = {
  begin(W, H) {
    const o = Doll.canvas(W, H);
    this.c = o.c; this.g = o.g; this.W = W; this.H = H; this.cx = W / 2; this.keys = new Set();
    return this;
  },
  col(k) { this.keys.add(k); this.g.fillStyle = PAL[k]; this.g.strokeStyle = PAL[k]; },
  E(k, x, y, rx, ry, rot) { this.col(k); const g = this.g; g.beginPath(); g.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot || 0, 0, Math.PI * 2); g.fill(); },
  P(k, pts) {
    this.col(k); const g = this.g; g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath(); g.fill();
  },
  L(k, x0, y0, x1, y1, w) { this.col(k); const g = this.g; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); },
  PL(k, pts, w) {
    this.col(k); const g = this.g; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.stroke();
  },
  // arco d'ellisse con spessore w (da a0 ad a1, radianti)
  A(k, x, y, rx, ry, a0, a1, w) { this.col(k); const g = this.g; g.lineWidth = w; g.beginPath(); g.ellipse(x, y, rx, ry, 0, a0, a1); g.stroke(); },
  // curva quadratica affusolata: spessore da w0 a w1 (code, serpenti, corna)
  T(k, x0, y0, cx, cy, x1, y1, w0, w1) {
    this.col(k); const g = this.g, n = 28;
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const x = u * u * x0 + 2 * u * t * cx + t * t * x1, y = u * u * y0 + 2 * u * t * cy + t * t * y1;
      g.beginPath(); g.arc(x, y, Math.max(0.5, (w0 + (w1 - w0) * t) / 2), 0, Math.PI * 2); g.fill();
    }
  },
  // simmetria: fn(s, X) con s = -1 / +1 e X(dx) = centro + s*dx
  sym(fn) { const cx = this.cx; for (const s of [-1, 1]) fn(s, (dx) => cx + s * dx); },

  // canvas -> griglia di chiavi, ombreggiatura per materiale, sprite del gioco
  // ramps: { chiave: [ombra, luce] }
  finish(name, ramps) {
    const W = this.W, H = this.H, d = this.g.getImageData(0, 0, W, H).data;
    const keys = [...this.keys];
    const rgb = keys.map((k) => { const v = PAL[k]; return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)]; });
    const grid = SPR._grid(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] < 120) continue;
      let best = 0, bd = 1e9;
      for (let q = 0; q < rgb.length; q++) {
        const dr = d[i] - rgb[q][0], dg = d[i + 1] - rgb[q][1], db = d[i + 2] - rgb[q][2], dd = dr * dr * 3 + dg * dg * 4 + db * db * 2;
        if (dd < bd) { bd = dd; best = q; }
      }
      grid[y][x] = keys[best];
    }
    if (ramps) {
      const src = grid.map((r) => r.slice());
      const same = (x, y, k) => x >= 0 && y >= 0 && x < W && y < H && src[y][x] === k;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const k = src[y][x], r = k && ramps[k];
        if (!r) continue;
        if (!same(x, y - 1, k) || !same(x - 1, y, k)) grid[y][x] = r[1];                                   // bordo in luce
        else if (((x + y) & 1) && (!same(x, y - 2, k) || !same(x - 2, y, k))) grid[y][x] = r[1];         // luce a retino
        else if (!same(x, y + 1, k) || !same(x + 1, y, k) || !same(x, y + 2, k) || !same(x + 2, y, k)) grid[y][x] = r[0];  // ombra
        else if (((x + y) & 1) && (!same(x, y + 3, k) || !same(x + 3, y, k))) grid[y][x] = r[0];         // ombra a retino
      }
    }
    return SPR._register(name, grid, { squash: true });
  },

  // ---------------------------------------------------------------------------
  // LA CRIPTA
  // ---------------------------------------------------------------------------
  // CARONTE — "Caron dimonio, con occhi di bragia" (Inf. III): traghettatore incappucciato col remo
  caronte(name) {
    const W = 144, H = 132, cx = 72; this.begin(W, H);
    const hem = [];
    for (let k = 0; k <= 10; k++) hem.push(cx + 54 - k * 10.8, H - 3 - (k % 2 ? 10 : 0) - ((k * 7) % 3));
    this.P('3', [cx - 26, 46, cx + 26, 46, cx + 42, 82].concat(hem, [cx - 42, 82]));    // mantello stracciato
    this.E('3', cx, 34, 25, 27);                                                          // cappuccio
    this.P('3', [cx - 16, 16, cx + 6, 1, cx + 15, 18]);
    this.E('0', cx, 41, 16, 19);                                                          // buio del cappuccio
    this.L('4', cx - 30, 54, cx - 15, 88, 14);                                            // maniche
    this.L('4', cx + 30, 54, cx + 21, 62, 14);
    this.E('6', cx, 41, 10, 12);                                                          // volto scavato
    this.E('5', cx - 6, 46, 3, 4); this.E('5', cx + 6, 46, 3, 4);
    this.L('7', cx, 38, cx + 1, 46, 2);
    this.sym((s, X) => {                                                                  // occhi di brace
      this.E('E', X(6), 37, 5, 4); this.E('P', X(6), 37, 3.6, 2.8); this.E('L', X(6), 37, 1.5, 1.3);
      this.L('2', X(11), 31, X(2), 34, 2);
    });
    this.P('8', [cx - 11, 47, cx + 11, 47, cx + 9, 70, cx + 4, 98, cx - 2, 106, cx - 6, 92, cx - 10, 72]);   // barba bianca
    this.P('8', [cx - 9, 47, cx + 9, 47, cx + 11, 53, cx, 50, cx - 11, 53]);
    this.L('1', cx - 4, 52, cx + 4, 52, 1.5);
    this.L('7', cx - 5, 58, cx - 3, 90, 1); this.L('7', cx + 3, 58, cx + 2, 92, 1); this.L('7', cx, 62, cx - 1, 100, 1);
    this.L('h', cx - 40, H - 10, cx + 62, 10, 4);                                         // remo
    this.E('h', cx + 62, 10, 6, 13, 0.73);
    this.L('i', cx - 38, H - 13, cx + 58, 13, 1);
    this.E('7', cx - 11, 90, 5.5, 4.5); this.E('7', cx + 19, 57, 5, 4.5);                 // mani ossute
    this.L('6', cx - 15, 87, cx - 15, 93, 1.2); this.L('6', cx + 15, 54, cx + 15, 60, 1.2);
    return this.finish(name, { '3': ['2', '4'], '4': ['3', '5'], h: ['g', 'i'], 8: ['7', '9'], 6: ['5', '7'], 7: ['6', '8'] });
  },

  // MINOSSE — giudice infernale, la coda gli gira attorno (Inf. V)
  minosse(name) {
    const W = 152, H = 140, cx = 76; this.begin(W, H);
    this.T('5', cx + 40, 76, cx + 76, 40, cx + 52, 10, 12, 5);                            // coda che sale dietro
    this.P('8', [cx + 46, 12, cx + 46, 1, cx + 57, 8]);
    this.sym((s, X) => {                                                                  // gambe
      this.E('B', X(26), H - 18, 18, 15);
      for (let k = 0; k < 3; k++) this.P('8', [X(14 + k * 7), H - 6, X(16 + k * 7), H - 1, X(19 + k * 7), H - 6]);
    });
    this.E('B', cx, 84, 44, 38);                                                          // busto
    this.sym((s, X) => {                                                                  // braccia e artigli
      this.L('B', X(40), 62, X(56), 100, 16);
      this.E('B', X(57), 104, 10, 9);
      for (let k = 0; k < 3; k++) this.P('8', [X(50 + k * 6), 110, X(52 + k * 6), 119, X(55 + k * 6), 110]);
    });
    this.E('B', cx, 42, 26, 23);                                                          // testa
    this.P('B', [cx - 20, 50, cx + 20, 50, cx + 14, 64, cx - 14, 64]);
    this.sym((s, X) => this.T('7', X(18), 28, X(44), 26, X(40), 2, 9, 2));               // corna
    this.P('K', [cx - 22, 30, cx + 22, 30, cx + 22, 21, cx + 15, 26, cx + 11, 13, cx + 5, 24, cx, 9, cx - 5, 24, cx - 11, 13, cx - 15, 26, cx - 22, 21]);   // corona
    this.E('C', cx, 26, 2, 2); this.E('C', cx - 11, 26, 1.5, 1.5); this.E('C', cx + 11, 26, 1.5, 1.5);
    this.sym((s, X) => {                                                                  // occhi
      this.E('L', X(10), 40, 5.5, 3, s * 0.25); this.L('k', X(10), 38, X(10), 42, 1.4);
      this.L('A', X(17), 33, X(4), 37, 2.5);
    });
    this.E('0', cx, 56, 13, 6.5);                                                         // ringhia
    for (let k = -3; k <= 3; k++) { const x = cx + k * 3.6; this.P('9', [x - 1.4, 50.5, x + 1.4, 50.5, x, 55 + (Math.abs(k) === 3 ? 2 : 0)]); }
    for (let k = -2; k <= 2; k++) { const x = cx + k * 3.6; this.P('9', [x - 1.3, 61.5, x + 1.3, 61.5, x, 57.5]); }
    for (const [y, rx] of [[74, 47], [92, 46], [110, 40]]) this.A('5', cx, y, rx, 11, 0.05, Math.PI - 0.05, 8);   // spire della coda
    return this.finish(name, { B: ['A', 'C'], 5: ['4', '6'], K: ['h', 'L'], 7: ['6', '8'] });
  },

  // ---------------------------------------------------------------------------
  // LA PALUDE MARCIA
  // ---------------------------------------------------------------------------
  // PLUTO — "Pape Satàn, pape Satàn aleppe!": il lupo dell'avarizia sul suo mucchio d'oro (Inf. VII)
  pluto(name) {
    const W = 144, H = 132, cx = 72; this.begin(W, H);
    this.E('K', cx, H - 12, 62, 12);                                                      // mucchio di monete
    for (let k = 0; k < 14; k++) { const x = cx - 54 + k * 8.3 + (k % 3) * 2, y = H - 13 - (k % 4) * 3; this.E('L', x, y, 4, 2.5); this.E('h', x, y + 0.8, 2, 1); }
    this.E('R', cx, 80, 46, 36);                                                          // pancione
    this.E('T', cx, 90, 28, 24);
    this.E('Q', cx, 96, 2, 3);
    this.L('R', cx - 38, 66, cx - 52, 98, 14); this.E('R', cx - 53, 104, 9, 8);           // braccio che artiglia l'oro
    for (let k = 0; k < 3; k++) this.P('8', [cx - 60 + k * 6, 109, cx - 58 + k * 6, 116, cx - 56 + k * 6, 109]);
    this.E('g', cx + 54, 98, 13, 15);                                                     // sacco d'oro
    this.P('g', [cx + 47, 84, cx + 61, 84, cx + 58, 76, cx + 50, 76]);
    this.L('h', cx + 47, 85, cx + 61, 85, 2);
    this.E('L', cx + 52, 74, 3, 2); this.E('L', cx + 57, 75, 3, 2); this.E('L', cx + 54, 72, 3, 2);
    this.L('R', cx + 38, 66, cx + 50, 82, 14);                                            // braccio che stringe il sacco
    this.E('R', cx + 51, 84, 8, 7);
    this.L('5', cx - 20, 57, cx, 66, 1.5); this.L('5', cx + 20, 57, cx, 66, 1.5);       // medaglione
    this.E('K', cx, 67, 6, 6); this.E('L', cx, 66, 3.6, 3.6);
    this.sym((s, X) => { this.P('R', [X(10), 24, X(28), 30, X(26), 2]); this.P('B', [X(16), 21, X(24), 25, X(24), 9]); });   // orecchie
    this.E('R', cx, 38, 27, 22);                                                          // testa di lupo
    this.sym((s, X) => this.E('T', X(17), 48, 9, 7));                                     // guance gonfie
    this.E('T', cx, 50, 13, 10);
    this.E('0', cx, 43, 5, 3.5);
    this.L('0', cx - 9, 55, cx + 9, 55, 2);
    this.P('9', [cx - 7, 55, cx - 4, 55, cx - 5.5, 60]); this.P('9', [cx + 4, 55, cx + 7, 55, cx + 5.5, 60]);
    this.sym((s, X) => {
      this.E('U', X(10), 34, 4.5, 2.6, s * 0.3); this.E('0', X(10), 34, 1.3, 2.2);
      this.L('Q', X(16), 28.5, X(4), 31, 2);
    });
    return this.finish(name, { R: ['Q', 'T'], T: ['R', 'U'], K: ['h', 'L'], g: ['f', 'h'] });
  },

  // CERBERO — "con tre gole caninamente latra" (Inf. VI)
  cerbero(name) {
    const W = 152, H = 140, cx = 76; this.begin(W, H);
    this.sym((s, X) => {
      this.E('b', X(32), H - 16, 17, 13);
      for (let k = 0; k < 3; k++) this.P('8', [X(22 + k * 7), H - 6, X(24 + k * 7), H - 1, X(27 + k * 7), H - 6]);
    });
    this.E('b', cx, 90, 52, 40);
    this.E('c', cx, 100, 30, 24);
    const heads = [[cx - 44, 40, -1], [cx + 44, 40, 1], [cx, 27, 0]];
    for (const [x, y] of heads) this.L('b', cx, 72, x, y + 6, 22);                       // colli
    for (const [x, y] of heads) {                                                         // collari chiodati
      const mx = cx + (x - cx) * 0.55, my = 72 + (y + 6 - 72) * 0.55, a = Math.atan2(y + 6 - 72, x - cx) + Math.PI / 2;
      this.E('4', mx, my, 13, 3.6, a);
      for (const o of [-8, 0, 8]) this.E('7', mx + Math.cos(a) * o, my + Math.sin(a) * o, 1.6, 1.6);
    }
    for (const [x, y, d] of heads) {
      this.P('c', [x - 15, y - 4, x - 9, y - 22, x - 2, y - 10]); this.P('c', [x + 15, y - 4, x + 9, y - 22, x + 2, y - 10]);
      this.E('c', x, y, 19, 16);
      this.E('c', x + d * 4, y + 10, 12, 9);
      this.E('0', x + d * 5, y + 6, 4, 3);
      this.E('0', x + d * 4, y + 15, 8, 4);
      this.E('C', x + d * 4, y + 17.5, 3, 1.6);
      for (const e of [-1, 1]) {
        const fx = x + d * 4 + e * 5;
        this.P('9', [fx - 1.3, y + 12, fx + 1.3, y + 12, fx, y + 16.5]);
        this.E('D', x + d * 2 + e * 8, y - 3, 3.4, 2.2, e * 0.35); this.E('9', x + d * 2 + e * 8 + 1, y - 3.6, 0.8, 0.8);
        this.L('a', x + d * 2 + e * 12, y - 8, x + d * 2 + e * 4, y - 6, 2);
      }
      if (d) this.L('U', x + d * 9, y + 18, x + d * 10, y + 26, 1.2);                     // bava
    }
    this.P('1', [cx - 9, 45, cx + 9, 45, cx + 6, 58, cx, 63, cx - 6, 58]);                 // barba unta e atra
    return this.finish(name, { b: ['a', 'c'], c: ['b', 'd'], 4: ['3', '6'] });
  },

  // ---------------------------------------------------------------------------
  // LA CATTEDRALE SCONSACRATA
  // ---------------------------------------------------------------------------
  // CAPANEO — il gigante che sfida Giove anche sotto la pioggia di fuoco (Inf. XIV)
  capaneo(name) {
    const W = 144, H = 132, cx = 72; this.begin(W, H);
    this.P('B', [cx - 34, 48, cx + 34, 48, cx + 58, H - 3, cx - 58, H - 3]);              // mantello
    this.sym((s, X) => { this.L('5', X(15), 92, X(18), H - 12, 18); this.E('4', X(19), H - 8, 12, 6); });   // gambe
    this.P('4', [cx - 26, 94, cx + 26, 94, cx + 31, 109, cx - 31, 109]);                   // lamelle
    this.L('3', cx - 28, 101, cx + 28, 101, 1);
    this.P('5', [cx - 32, 50, cx + 32, 50, cx + 24, 96, cx - 24, 96]);                     // corazza
    this.sym((s, X) => this.A('4', X(10), 64, 10, 7, 0.2, Math.PI - 0.2, 1.4));
    this.L('K', cx - 25, 92, cx + 25, 92, 4);
    this.sym((s, X) => {                                                                  // braccia alzate, pugni chiusi
      this.L('S', X(34), 56, X(52), 32, 12);
      this.L('S', X(52), 32, X(46), 10, 11);
      this.L('5', X(51), 29, X(48), 17, 12.5);
      this.E('5', X(36), 54, 13, 11);
      this.E('S', X(46), 8, 7.5, 7);
      this.L('&', X(42), 5, X(50), 5, 1);
    });
    this.L('S', cx, 44, cx, 54, 10);
    this.E('S', cx, 38, 13, 15);
    this.P('1', [cx - 12, 41, cx + 12, 41, cx + 9, 54, cx, 58, cx - 9, 54]);              // barba
    this.E('A', cx, 46, 4.5, 3.5);                                                        // grida
    this.sym((s, X) => { this.L('w', X(4), 35, X(8), 35.5, 2); this.L('0', X(10), 30, X(3), 33, 2.2); });
    this.L('&', cx, 34, cx + 1, 41, 2);
    this.P('K', [cx - 13, 28, cx + 13, 28, cx + 14, 20, cx + 9, 24, cx + 6, 14, cx + 2, 23, cx, 12, cx - 2, 23, cx - 6, 14, cx - 9, 24, cx - 14, 20]);
    // cicatrici del fulmine
    this.PL('p', [cx - 20, 56, cx - 12, 64, cx - 16, 70, cx - 6, 80, cx - 10, 88], 1.6);
    this.PL('p', [cx + 18, 60, cx + 12, 68, cx + 17, 74, cx + 10, 84], 1.4);
    this.PL('o', [cx + 44, 46, cx + 49, 38, cx + 46, 34, cx + 52, 24], 1.4);
    this.PL('o', [cx - 40, 50, cx - 47, 42, cx - 44, 37, cx - 50, 28], 1.4);
    this.PL('p', [cx + 56, 1, cx + 59, 8, cx + 56, 10, cx + 61, 18], 1.5);              // scintille sui pugni
    this.PL('p', [cx - 57, 2, cx - 60, 9, cx - 57, 11, cx - 62, 18], 1.5);
    return this.finish(name, { 5: ['4', '7'], 4: ['3', '5'], S: ['&', '%'], K: ['h', 'L'], B: ['A', 'C'] });
  },

  // GERIONE — "la faccia d'uom giusto", zampe pelose, schiena dipinta di nodi e rotelle (Inf. XVII)
  gerione(name) {
    const W = 152, H = 140, cx = 76; this.begin(W, H);
    this.T('x', cx + 30, 104, cx + 74, 56, cx + 40, 12, 14, 6);                           // coda di scorpione
    for (const t of [0.2, 0.36, 0.52, 0.68, 0.84]) {
      const u = 1 - t, x = u * u * (cx + 30) + 2 * u * t * (cx + 74) + t * t * (cx + 40), y = u * u * 104 + 2 * u * t * 56 + t * t * 12;
      this.E('v', x, y, 6 - t * 3, 1.2, 0.5 - t);
    }
    this.P('D', [cx + 42, 6, cx + 28, 19, cx + 41, 18]);
    this.E('x', cx, H - 20, 68, 18);                                                      // spire
    this.E('v', cx, H - 24, 44, 8);
    this.A('y', cx, H - 22, 58, 12, 0.15, Math.PI - 0.15, 3);
    this.P('x', [cx - 36, H - 24, cx - 32, 92, cx - 20, 58, cx + 20, 58, cx + 32, 92, cx + 36, H - 24]);   // busto di serpente
    this.P('y', [cx - 10, 62, cx + 10, 62, cx + 15, H - 28, cx - 15, H - 28]);            // ventre a placche
    for (let y = 68; y < H - 28; y += 6) this.L('v', cx - 14, y, cx + 14, y, 1);
    const dots = [[-24, 78], [24, 82], [-28, 100], [28, 104], [-46, H - 20], [-26, H - 10], [26, H - 10], [46, H - 22], [0, H - 6], [-60, H - 26], [60, H - 26]];
    for (const [dx, y] of dots) { this.E('L', cx + dx, y, 3.6, 3); this.E('C', cx + dx, y, 1.6, 1.3); }
    for (const [dx, y] of [[-22, 92], [22, 70], [-36, H - 12], [36, H - 14]]) {          // nodi
      this.L('K', cx + dx - 3, y - 3, cx + dx + 3, y + 3, 1.5); this.L('K', cx + dx + 3, y - 3, cx + dx - 3, y + 3, 1.5);
    }
    this.sym((s, X) => {                                                                  // zampe pelose
      this.L('g', X(20), 62, X(40), 84, 11); this.L('g', X(40), 84, X(46), 106, 10);
      this.E('g', X(47), 110, 9, 6.5);
      for (let k = 0; k < 3; k++) this.P('8', [X(41 + k * 5), 114, X(42.5 + k * 5), 121, X(44 + k * 5), 114]);
      for (let k = 0; k < 4; k++) this.L('f', X(24 + k * 5), 66 + k * 6, X(29 + k * 5), 68 + k * 6, 1);
    });
    this.L('S', cx, 42, cx, 56, 10);
    this.E('f', cx, 30, 15, 15);                                                          // capelli scuri
    this.E('S', cx, 36, 12, 15);                                                          // volto d'uomo giusto
    this.P('f', [cx - 13, 33, cx - 11, 21, cx, 17, cx + 11, 21, cx + 13, 33, cx + 9, 25, cx, 23, cx - 9, 25]);
    this.P('f', [cx - 11, 42, cx + 11, 42, cx + 8, 50, cx, 54, cx - 8, 50]);              // barba curata
    this.A('&', cx, 40, 3.6, 2, 0.3, Math.PI - 0.3, 1.2);                                 // sorriso mite
    this.sym((s, X) => { this.E('0', X(4.5), 34, 1.8, 1.2); this.L('f', X(7.5), 30.5, X(2.5), 31, 1.3); });
    this.L('&', cx, 34, cx + 1, 39, 1.5);
    return this.finish(name, { x: ['v', 'y'], S: ['&', '%'], g: ['f', 'h'], f: ['X', 'g'] });
  },

  // ---------------------------------------------------------------------------
  // LA SELVA OSCURA
  // ---------------------------------------------------------------------------
  // LA LONZA — "leggera e presta molto, che di pel macolato era coverta" (Inf. I)
  lonza(name) {
    const W = 144, H = 132, cx = 72; this.begin(W, H);
    this.T('i', cx + 46, 100, cx + 74, 70, cx + 58, 42, 8, 5);                            // coda
    this.E('1', cx + 58, 42, 3, 3);
    this.E('i', cx, 96, 56, 24);                                                          // corpo acquattato
    this.sym((s, X) => {                                                                  // zampe davanti
      this.E('i', X(26), 84, 15, 14);
      this.L('i', X(24), 86, X(26), H - 12, 15);
      this.E('i', X(27), H - 9, 11, 6);
      for (let k = 0; k < 3; k++) this.P('8', [X(21 + k * 5), H - 5, X(22.5 + k * 5), H - 1, X(24 + k * 5), H - 5]);
    });
    this.sym((s, X) => { this.E('i', X(22), 30, 8, 8); this.E('g', X(22), 31, 4, 4); }); // orecchie tonde
    this.E('i', cx, 52, 30, 25);                                                          // testa grande
    this.E('j', cx, 64, 15, 11);                                                          // muso chiaro
    this.sym((s, X) => this.E('j', X(8), 66, 7, 6));
    this.P('1', [cx - 5, 58, cx + 5, 58, cx, 63]);
    this.L('1', cx, 63, cx, 67, 1.2);
    this.E('0', cx, 71, 8, 3.6);
    this.sym((s, X) => {
      this.P('9', [X(6.5), 68.5, X(3.8), 68.5, X(5), 74]);
      this.E('U', X(11), 49, 5, 3.2, -s * 0.25); this.L('0', X(11), 46.4, X(11), 51.8, 1.5); this.E('9', X(12), 48, 0.7, 0.7);
      this.L('1', X(8), 53, X(7), 60, 1.4);                                               // segni "lacrima"
      this.L('1', X(16), 44, X(4), 45, 1.4);
      for (let k = 0; k < 3; k++) this.L('8', X(14), 64 + k * 2, X(26), 62 + k * 3, 0.6); // baffi
    });
    const spots = [[-42, 92], [-28, 104], [-10, 92], [10, 102], [28, 92], [44, 102], [-52, 104], [52, 90], [-16, 112], [16, 114], [-26, 120], [26, 120], [-20, 36], [20, 36], [0, 31], [-10, 33], [10, 33], [-25, 48], [25, 48]];
    for (const [dx, y] of spots) { this.E('1', cx + dx, y, 2.4, 2); this.E('h', cx + dx, y, 1, 0.8); }
    return this.finish(name, { i: ['h', 'j'], j: ['i', 'P'] });
  },

  // LA LUPA — "che di tutte brame sembiava carca ne la sua magrezza" (Inf. I)
  lupa(name) {
    const W = 152, H = 140, cx = 76; this.begin(W, H);
    // di profilo, rivolta a sinistra: magra, costole in vista, testa bassa che ringhia
    this.T('4', cx + 46, 62, cx + 70, 70, cx + 66, 104, 9, 4);                            // coda che pende
    this.L('4', cx + 30, 78, cx + 44, 98, 11); this.L('4', cx + 44, 98, cx + 34, 114, 8);  // zampe di dietro (lontana)
    this.L('4', cx + 34, 114, cx + 38, H - 8, 7); this.E('3', cx + 40, H - 6, 7, 3.5);
    this.L('4', cx - 28, 80, cx - 22, H - 8, 8); this.E('3', cx - 22, H - 6, 7, 3.5);        // zampa davanti (lontana)
    const fur = [cx - 42, 60];                                                            // pelo irto sul dorso
    for (let k = 0; k <= 10; k++) fur.push(cx - 40 + k * 8.6, k % 2 ? 36 + Math.abs(4 - k) * 1.6 : 48);
    fur.push(cx + 48, 60);
    this.P('5', fur);
    this.E('5', cx - 18, 68, 26, 22);                                                     // torace profondo
    this.P('5', [cx - 10, 50, cx + 34, 52, cx + 46, 62, cx + 34, 74, cx + 10, 76, cx - 10, 88]);   // fianco scavato
    this.E('5', cx + 32, 62, 17, 15);                                                     // anche
    for (let k = 0; k < 5; k++) this.A('3', cx - 14 + k * 6, 66, 6, 16, -0.4, 1.2, 1.4);  // costole
    this.L('5', cx + 34, 70, cx + 50, 96, 12); this.L('5', cx + 50, 96, cx + 40, 114, 9);   // zampa di dietro
    this.L('5', cx + 40, 114, cx + 46, H - 8, 8); this.E('4', cx + 48, H - 6, 8, 4);
    this.L('5', cx - 34, 80, cx - 40, H - 8, 9); this.E('4', cx - 42, H - 6, 8, 4);        // zampa davanti
    for (let k = 0; k < 3; k++) this.P('8', [cx - 49 + k * 4, H - 4, cx - 48 + k * 4, H, cx - 46 + k * 4, H - 4]);
    this.L('5', cx - 34, 58, cx - 50, 70, 18);                                            // collo basso
    this.P('5', [cx - 46, 50, cx - 42, 30, cx - 36, 50]); this.P('3', [cx - 44, 48, cx - 42, 36, cx - 39, 48]);   // orecchie
    this.P('5', [cx - 38, 52, cx - 32, 34, cx - 28, 54]);
    this.E('5', cx - 50, 66, 16, 13);                                                     // testa
    this.P('6', [cx - 58, 62, cx - 74, 74, cx - 70, 79, cx - 52, 76]);                    // muso
    this.E('0', cx - 73, 74, 2.6, 2.2);
    this.P('0', [cx - 70, 79, cx - 54, 77, cx - 50, 82, cx - 66, 86]);                   // fauci aperte
    for (let k = 0; k < 4; k++) this.P('9', [cx - 68 + k * 4, 79, cx - 66 + k * 4, 79, cx - 67 + k * 4, 82.5]);
    for (let k = 0; k < 3; k++) this.P('9', [cx - 64 + k * 4, 85, cx - 62 + k * 4, 85, cx - 63 + k * 4, 82]);
    this.E('C', cx - 60, 84, 3, 1.4);
    this.L('8', cx - 64, 87, cx - 64, 96, 1); this.L('8', cx - 58, 86, cx - 58, 92, 1);   // bava
    this.E('D', cx - 54, 63, 4.5, 2, -0.35); this.E('w', cx - 55.5, 62.6, 0.9, 0.8);       // occhio affamato
    this.L('3', cx - 62, 58, cx - 47, 61, 2);
    return this.finish(name, { 5: ['4', '6'], 6: ['5', '7'], 4: ['3', '5'] });
  },

  // ---------------------------------------------------------------------------
  // LA CITTÀ DI DITE
  // ---------------------------------------------------------------------------
  _flames(cx, y0, n, step, h) {
    for (let k = 0; k < n; k++) {
      const x = cx - (n - 1) * step / 2 + k * step;
      const t = y0 - h - (k % 2) * 12, lean = (k % 3 - 1) * 4;
      this.P('G', [x - 10, y0, x - 8, y0 - h * 0.4, x - 3 + lean, y0 - h * 0.7, x + lean, t, x + 4, y0 - h * 0.6, x + 8, y0 - h * 0.35, x + 10, y0]);
      this.P('P', [x - 5, y0, x - 3 + lean * 0.5, y0 - h * 0.45, x + lean * 0.6, y0 - h * 0.65 - (k % 2) * 6, x + 4, y0 - h * 0.3, x + 5, y0]);
    }
  },
  // MEDUSA — la Gorgone sulle mura di Dite (Inf. IX)
  medusa(name) {
    const W = 144, H = 132, cx = 72; this.begin(W, H);
    this._flames(cx, H - 3, 8, 18, 30);                                                   // tombe infuocate di Dite
    this.P('B', [cx - 30, 84, cx + 30, 84, cx + 50, H - 3, cx - 50, H - 3]);              // veste lunga
    this.sym((s, X) => { this.E('B', X(30), 90, 13, 11); this.L('+', X(36), 94, X(44), 120, 8); this.E('+', X(45), 122, 5, 4); });   // spalle e braccia
    this.A('K', cx, 86, 18, 8, 0.2, Math.PI - 0.2, 2);                                    // collana
    this.L('+', cx, 70, cx, 86, 13);
    const sn = [-2.2, -1.75, -1.3, -0.85, -0.42, 0, 0.42, 0.85, 1.3, 1.75, 2.2];          // serpenti a S
    sn.forEach((a, k) => {
      const len = 26 + (k % 3) * 5, ux = Math.sin(a), uy = -Math.cos(a), px = -uy, py = ux;
      const sx = cx + ux * 16, sy = 52 + uy * 19;
      const mx = sx + ux * len * 0.5, my = sy + uy * len * 0.5, ex = sx + ux * len, ey = sy + uy * len;
      const w = k % 2 ? 7 : -7;
      this.T('d', sx, sy, (sx + mx) / 2 + px * w, (sy + my) / 2 + py * w, mx, my, 8, 6);
      this.T('d', mx, my, (mx + ex) / 2 - px * w, (my + ey) / 2 - py * w, ex, ey, 6, 4);
      this.E('d', ex + ux * 2, ey + uy * 2, 4, 3, Math.atan2(uy, ux));
      this.E('D', ex + ux * 2.4 + px * 1.4, ey + uy * 2.4 + py * 1.4, 0.8, 0.8);
      this.L('C', ex + ux * 5, ey + uy * 5, ex + ux * 8, ey + uy * 8, 0.8);
    });
    this.E('+', cx, 54, 20, 23);                                                          // volto di pietra
    this.A('d', cx, 50, 19, 20, Math.PI * 1.05, Math.PI * 1.95, 7);
    this.sym((s, X) => {
      this.E('w', X(8), 54, 4.4, 2.6); this.E('9', X(8), 54, 2, 1.6);                     // sguardo che pietrifica
      this.L('=', X(14), 48, X(3), 50, 1.8);
      this.L('=', X(13), 60, X(9), 64, 1);
    });
    this.L('=', cx, 54, cx + 1.5, 62, 1.6);
    this.E('B', cx, 67, 5, 2);
    return this.finish(name, { '+': ['=', '!'], d: ['c', 'e'], B: ['A', 'C'], G: ['F', 'P'] });
  },

  // MINOTAURO — "l'infamïa di Creti", furia cieca (Inf. XII)
  minotauro(name) {
    const W = 152, H = 140, cx = 76; this.begin(W, H);
    this._flames(cx, H - 4, 8, 19, 34);
    this.sym((s, X) => {                                                                  // gambe e zoccoli
      this.L('g', X(22), 96, X(24), H - 14, 18);
      this.E('1', X(25), H - 8, 11, 6); this.L('0', X(25), H - 12, X(25), H - 3, 1.2);
    });
    this.P('C', [cx - 30, 94, cx + 30, 94, cx + 26, 114, cx, 121, cx - 26, 114]);         // perizoma
    this.L('K', cx - 30, 95, cx + 30, 95, 3.5);
    this.P('g', [cx - 50, 50, cx + 50, 50, cx + 28, 98, cx - 28, 98]);                    // busto
    this.sym((s, X) => this.A('f', X(13), 63, 13, 7, 0.1, Math.PI - 0.1, 1.6));
    this.sym((s, X) => { this.L('f', X(5), 76, X(6), 80, 1.2); this.L('f', X(5), 84, X(6), 88, 1.2); });
    this.sym((s, X) => {                                                                  // braccia
      this.E('g', X(48), 58, 15, 13);
      this.L('g', X(50), 62, X(60), 92, 17); this.L('g', X(60), 92, X(58), 110, 15);
      this.E('g', X(58), 114, 11, 10);
      this.L('K', X(53), 101, X(64), 99, 4);
    });
    this.sym((s, X) => { this.T('8', X(16), 26, X(54), 26, X(56), 2, 10, 2); this.E('g', X(28), 37, 9, 4.5, s * 0.3); });   // corna, orecchie
    this.E('g', cx, 36, 22, 20);
    this.P('f', [cx - 10, 17, cx + 10, 17, cx + 4, 28, cx, 24, cx - 4, 28]);
    this.E('h', cx, 51, 15, 11);                                                          // muso
    this.sym((s, X) => this.E('0', X(6), 50, 2.6, 3.4, s * 0.3));
    this.L('f', cx - 8, 58.5, cx + 8, 58.5, 1.2);
    this.A('K', cx, 54, 3.5, 4.5, 0.2, Math.PI - 0.2, 1.8);                               // anello al naso
    this.sym((s, X) => {
      this.E('D', X(11), 34, 4, 2.4, s * 0.4); this.E('P', X(11), 34, 1.6, 1.2);
      this.L('f', X(17), 28, X(5), 31, 2.5);
    });
    return this.finish(name, { g: ['f', 'h'], h: ['g', 'i'], 8: ['7', '9'], C: ['B', 'D'], G: ['F', 'P'] });
  },

  // ---------------------------------------------------------------------------
  // IL COCITO
  // ---------------------------------------------------------------------------
  _ice(cx, y, rx, ry, n) {
    this.E('{', cx, y, rx, ry);
    for (let k = 0; k < n; k++) {
      const x = cx - rx + 8 + k * (rx * 2 - 16) / (n - 1), h = 12 + (k * 7) % 13;
      this.P('{', [x - 7, y - ry + 6, x + (k % 2 ? 2 : -2), y - ry + 6 - h, x + 7, y - ry + 6]);
      this.L(']', x - 2, y - ry + 4, x + (k % 2 ? 1 : -2), y - ry + 10 - h, 1.2);
    }
    this.PL('}', [cx - rx * 0.6, y, cx - rx * 0.4, y + 4, cx - rx * 0.2, y + 2, cx, y + 7], 1);
    this.PL('}', [cx + rx * 0.7, y - 2, cx + rx * 0.45, y + 3, cx + rx * 0.3, y + 1], 1);
  },
  // ANTEO — il gigante che posa Dante e Virgilio sul fondo (Inf. XXXI)
  anteo(name) {
    const W = 144, H = 132, cx = 72; this.begin(W, H);
    this.P('(', [cx - 46, 112, cx - 52, 66, cx - 34, 42, cx + 34, 42, cx + 52, 66, cx + 46, 112]);   // busto
    this.sym((s, X) => this.A(')', X(14), 60, 14, 8, 0.15, Math.PI - 0.15, 1.6));
    this.L(')', cx, 66, cx, 100, 1.4);
    this.L('(', cx - 46, 56, cx - 62, 86, 15); this.L('(', cx - 62, 86, cx - 50, 106, 13);   // braccio appoggiato
    this.E('(', cx - 48, 108, 9, 7);
    this.L('(', cx + 46, 56, cx + 62, 32, 15); this.L('(', cx + 62, 32, cx + 54, 13, 13);    // braccio alzato
    this.E('(', cx + 53, 10, 8, 7);
    for (let k = 0; k < 4; k++) this.L('(', cx + 47 + k * 4, 8, cx + 45 + k * 5, 2, 3);
    this.E('5', cx, 22, 20, 18);                                                          // capelli
    this.E('(', cx, 26, 15, 17);
    this.P('5', [cx - 15, 31, cx + 15, 31, cx + 12, 46, cx + 4, 56, cx - 4, 56, cx - 12, 46]);   // barba
    for (let k = 0; k < 4; k++) this.P(']', [cx - 9 + k * 6, 48 + (k % 2) * 4, cx - 7 + k * 6, 48 + (k % 2) * 4, cx - 8 + k * 6, 56 + (k % 2) * 4]);   // ghiaccioli
    this.E('0', cx, 37, 5, 2.4);
    this.sym((s, X) => { this.E('9', X(6), 24, 2.4, 1.6); this.E('1', X(6), 24, 0.9, 0.9); this.L('5', X(11), 19.5, X(2), 21, 2.6); });
    this.L(')', cx, 22, cx + 1, 30, 2.4);
    this.E('[', cx - 30, 50, 6, 3); this.E('[', cx + 24, 46, 5, 2.5);                     // brina
    this._ice(cx, H - 14, 70, 16, 9);
    return this.finish(name, { '(': [')', '['], '{': ['}', ']'], 5: ['4', '6'] });
  },

  // LUCIFERO — "Lo 'mperador del doloroso regno": tre facce, sei ali, nel ghiaccio fino al petto (Inf. XXXIV)
  lucifero(name) {
    const W = 152, H = 140, cx = 76; this.begin(W, H);
    this.sym((s, X) => {                                                                  // sei ali di pipistrello (tre lobi per lato)
      const S = [X(22), 62], F = [[70, 2], [76, 40], [74, 78], [50, 104]];
      for (let j = 0; j < 3; j++) {
        const a = F[j], b = F[j + 1], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const qx = mx + (22 - mx) * 0.32, qy = my + (62 - my) * 0.32;
        this.P(j === 1 ? '3' : '4', [S[0], S[1], X(a[0]), a[1], X((a[0] + qx) / 2 + 2), (a[1] + qy) / 2, X(qx), qy, X((b[0] + qx) / 2 + 2), (b[1] + qy) / 2, X(b[0]), b[1]]);
      }
      for (const f of F) this.L('7', S[0], S[1], X(f[0]), f[1], 1.6);
      this.E('7', X(22), 62, 4, 4);
    });
    this.P('2', [cx - 30, 58, cx + 30, 58, cx + 36, 112, cx - 36, 112]);                  // busto peloso
    for (const [x, k] of [[cx - 29, '1'], [cx + 29, '<']]) {                              // facce laterali
      this.T('8', x - 7, 38, x - 13, 30, x - 9, 22, 4, 1); this.T('8', x + 7, 38, x + 13, 30, x + 9, 22, 4, 1);
      this.E(k, x, 50, 14, 16);
      this.E('w', x - 4, 47, 2, 1.3); this.E('w', x + 4, 47, 2, 1.3);
      this.L('u', x - 4, 49, x - 4, 56, 1); this.L('u', x + 4, 49, x + 4.5, 55, 1);
      this.E('0', x, 57, 5, 3);
      this.L('v', x - 1, 58, x - 3, 67, 1.6); this.L('v', x + 1, 58, x + 2, 67, 1.6);    // il peccatore maciullato
    }
    this.sym((s, X) => this.T('8', X(9), 28, X(28), 22, X(22), 2, 7, 2));                // corna
    this.E('C', cx, 40, 19, 21);                                                          // faccia centrale, vermiglia
    this.sym((s, X) => {
      this.E('w', X(6), 37, 3, 1.8); this.E('L', X(6), 37, 1.2, 1.2);
      this.L('A', X(12), 32, X(3), 34, 2);
      this.L('u', X(6), 39, X(6.5), 48, 1.2);                                              // piange con sei occhi
    });
    this.E('0', cx, 50, 8, 4.5);
    this.sym((s, X) => this.P('9', [X(6), 47, X(3.5), 47, X(4.8), 51.5]));
    this.L('v', cx - 2, 52, cx - 5, 63, 2); this.L('v', cx + 2, 52, cx + 4, 63, 2);       // Giuda
    this.E('3', cx - 5, 64, 2, 1.2); this.E('3', cx + 4, 64, 2, 1.2);
    this._ice(cx, H - 16, 74, 22, 10);
    return this.finish(name, { 2: ['1', '3'], 4: ['3', '5'], 3: ['2', '4'], C: ['B', 'D'], 1: ['0', '4'], '<': ['>', '^'], '{': ['}', ']'], 8: ['7', '9'] });
  },

  init() {
    for (const id in MAPS) for (const b of ['b2', 'b3']) {
      const c = MAPS[id][b];
      if (!c || !this[c.art]) continue;
      const e = this[c.art](c.sprite);
      if (c.faces) { e.mir = SPR._mirror(e.img); e.mir2 = SPR._mirror(e.img2); }
    }
    // proiettili del boss finale, tinti per mappa
    for (const [n, f, l, d] of [['eb_red', 'D', '9', 'C'], ['eb_green', 'T', 'U', 'R'], ['eb_gold', 'L', '9', 'K'], ['eb_grey', '7', 'w', '5'], ['eb_fire', 'P', '9', 'G'], ['eb_ice', ']', 'w', '{']]) {
      SPR.fromFn(n, 6, 6, SPR.circleFn(6, f, l, d));
    }
  },
};
