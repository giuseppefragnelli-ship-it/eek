'use strict';
// js/22_render.js — Render: disegno della partita

// ============================================================================
// RENDER — pixel art. Il canvas ha una risoluzione bassa (≈360 px di altezza)
// e viene ingrandito dal CSS con un fattore INTERO e `image-rendering:
// pixelated`, così ogni pixel resta un quadratino netto.
// Tutto viene disegnato a coordinate intere: niente sbavature.
// ============================================================================

// EFFETTI DELLE ABILITÀ (Ira di Dite, Gelo di Cocito) — dal 2026-10-28 disegnati a risoluzione PIENA (mezzi pixel del
// gioco = pixel veri del canvas 2x), con forme lisce invece dei soliti anelli a pixel. Pochi alla volta, niente allocazioni:
// slot fissi e particelle precalcolate al lancio.
//   dur = durata (s) | n = lingue di fuoco / cristalli | p = braci / scintille
const SKILL_FX = { ira: { dur: 0.75, n: 28, p: 44 }, gelo: { dur: 1.0, n: 20, p: 34 } };
// BAGLIORI DELLE ARMI (Render.weaponGlow), per tipo di proiettile (PK): c = colore, evo = colore da evoluta
//   tail: scia lunga `len` pixel | spin: vortice di raggio `r` pixel (x grandezza) a velocità `spin` | flame: fiamma
const WEAPON_GLOW = [];
WEAPON_GLOW[0] = { t: 'tail', c: '#9fe6ff', evo: '#ff5fe0', len: 14 };   // SALT: Sagitta / kunai
WEAPON_GLOW[5] = { t: 'tail', c: '#ffcf6a', evo: '#ffcf6a', len: 18 };   // ARROW: Arcus
WEAPON_GLOW[2] = { t: 'spin', c: '#c9b8ff', evo: '#ff5fe0', r: 9, spin: 14 };   // SCYTHE: Falx Lunae
WEAPON_GLOW[6] = { t: 'spin', c: '#ff9a4a', evo: '#ff9a4a', r: 8, spin: 11 };   // AXE: Bipennis
WEAPON_GLOW[9] = { t: 'spin', c: '#ffe066', evo: '#ff5fe0', r: 9, spin: 18 };   // WHEEL
WEAPON_GLOW[4] = { t: 'flame', c: '#ff7a1f', evo: '#9fe6ff' };                  // WISP: Linguae Ignis

const SkillFx = {
  MAX: 4, PN: 48,
  slot: [],
  init() {
    for (let k = 0; k < this.MAX; k++) this.slot.push({ on: false, kind: '', x: 0, y: 0, r: 0, t0: 0, a: new Float32Array(this.PN), v: new Float32Array(this.PN), s: new Float32Array(this.PN) });
  },
  add(kind, x, y, r) {
    if (!this.slot.length) this.init();
    let f = this.slot[0];
    for (const q of this.slot) if (!q.on) { f = q; break; } else if (q.t0 < f.t0) f = q;
    f.on = true; f.kind = kind; f.x = x; f.y = y; f.r = r; f.t0 = G.time;
    for (let k = 0; k < this.PN; k++) { f.a[k] = Math.random() * 6.2832; f.v[k] = 0.4 + Math.random() * 0.6; f.s[k] = Math.random(); }
  },
  clear() { for (const q of this.slot) q.on = false; },
};

const Render = {
  canvas: null, ctx: null,
  W: 0, H: 0,          // dimensioni del canvas in pixel di gioco
  zoom: 1, dpr: 1,
  floorPat: null, ditherPat: null,
  pats: {},            // pattern a retino per colore (creati una volta sola)
  ox: 0, oy: 0,        // offset schermo: pxSchermo = round(xMondo / UNIT) + ox

  // Due canvas sovrapposti: `game` (risoluzione del gioco, ci si disegna tutto) e sopra `hi`
  // (trasparente, doppia risoluzione) solo per i personaggi ad alta risoluzione (sprite e.hi).
  // Su `hi` si cancellano solo i rettangoli disegnati il frame prima: costa pochissimo.
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.hiCanvas = document.getElementById('hi');
    this.hctx = this.hiCanvas.getContext('2d');
    this.resize(); // i resize successivi li inoltra UI.resize (prima aggiorna lo zoom della UI)
  },

  resize() {
    const stage = this.canvas.parentElement;
    const cssW = stage.clientWidth, cssH = stage.clientHeight;
    this.dpr = window.devicePixelRatio || 1;
    const devW = cssW * this.dpr, devH = cssH * this.dpr;
    // Zoom calcolato sul lato corto. Schermi normali: zoom intero (pixel tutti uguali).
    // Schermi densi (telefono, retina): zoom libero, così si arriva a ~440 pixel di risoluzione
    // (le minime differenze tra un pixel e l'altro lì non si vedono).
    const devMin = Math.min(devW, devH);
    this.zoom = this.dpr >= 2 ? Math.max(1, devMin / CFG.PIX_TARGET) : Math.max(1, Math.round(devMin / CFG.PIX_TARGET));
    this.W = Math.ceil(devW / this.zoom);
    this.H = Math.ceil(devH / this.zoom);
    // stessa porzione di mondo visibile su ogni schermo
    CFG.UNIT = CFG.VIEW_MIN / Math.min(this.W, this.H);
    // DOPPIA RISOLUZIONE: il canvas ha 2x2 pixel reali per ogni pixel del gioco. Si continua a disegnare
    // in pixel del gioco (scala 2 di base): la pixel art resta a blocchi, i mostri disegnati usano tutti i pixel.
    this.canvas.width = this.W * 2; this.canvas.height = this.H * 2;
    this.canvas.style.width = (this.W * this.zoom / this.dpr) + 'px';
    this.canvas.style.height = (this.H * this.zoom / this.dpr) + 'px';
    this.hiCanvas.width = this.W * 2; this.hiCanvas.height = this.H * 2;
    this.hiCanvas.style.width = this.canvas.style.width; this.hiCanvas.style.height = this.canvas.style.height;
    this.hctx.imageSmoothingEnabled = false;
    this.dirtyN = 0;
    const ctx = this.ctx;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.imageSmoothingEnabled = false;
    this.floorPats = {};
    for (const k in SPR.floors) this.floorPats[k] = this.mkPat(SPR.floors[k]);
    this.floorPat = this.floorPats[G.map ? G.map.floor : 'cripta'];
    this.ditherPat = this.mkPat(SPR.dither);
    this.pats = {};
    G.viewW = this.W * CFG.UNIT;
    G.viewH = this.H * CFG.UNIT;
    Grid.resize(G.viewW, G.viewH);
  },

  // ---- primitive pixel ------------------------------------------------------
  // cerchio (solo bordo) con l'algoritmo del punto medio
  circle(cx, cy, r, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    let x = r, y = 0, err = 1 - r;
    while (x >= y) {
      ctx.fillRect(cx + x, cy + y, 1, 1); ctx.fillRect(cx - x, cy + y, 1, 1);
      ctx.fillRect(cx + x, cy - y, 1, 1); ctx.fillRect(cx - x, cy - y, 1, 1);
      ctx.fillRect(cx + y, cy + x, 1, 1); ctx.fillRect(cx - y, cy + x, 1, 1);
      ctx.fillRect(cx + y, cy - x, 1, 1); ctx.fillRect(cx - y, cy - x, 1, 1);
      y++;
      if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
    }
  },

  // pattern nitido su qualsiasi canvas: la mattonella viene raddoppiata a blocchi e il pattern ridotto
  // a metà, così non serve mai interpolare (niente sfocature, neanche su Safari)
  mkPat(src) {
    const c = document.createElement('canvas');
    c.width = src.width * 2; c.height = src.height * 2;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, c.width, c.height);
    const p = this.ctx.createPattern(c, 'repeat');
    try { p.setTransform(new DOMMatrix([0.5, 0, 0, 0.5, 0, 0])); } catch (e) { /* browser vecchio: pattern doppio */ }
    return p;
  },

  // pattern a scacchi di un colore (cache)
  pat(color) {
    let p = this.pats[color];
    if (!p) p = this.pats[color] = this.mkPat(SPR.makeDither(color));
    return p;
  },

  // disco pieno con retino a scacchi (trasparenza "finta" anni '90)
  ditherDisk(cx, cy, r, style) {
    const ctx = this.ctx;
    ctx.fillStyle = style || this.ditherPat;
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.floor(Math.sqrt(r * r - dy * dy));
      ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
    }
  },

  // joystick virtuale (touch) — in partita e nel villaggio
  drawJoystick() {
    const ctx = this.ctx;
    const j = Input.joy, fixed = Input.joyMode() !== 'float';
    if ((G.state === 'play' || G.state === 'village') && (j.active || (fixed && Input.isTouch))) {
      const k = this.dpr / this.zoom;
      let bxC, byC;
      if (fixed) { Input.stageW = this.canvas.parentElement.clientWidth; Input.stageH = this.canvas.parentElement.clientHeight; Input.fixedCenter(_jc); bxC = _jc.x; byC = _jc.y; }
      else { bxC = j.sx; byC = j.sy; }
      const bx2 = Math.round(bxC * k), by2 = Math.round(byC * k), R = Math.round(Input.JOY_R * k), kr = Math.max(3, (R * 0.4) | 0);
      ctx.globalAlpha = j.active ? 0.35 : 0.25; this.ditherDisk(bx2, by2, R, PAL.k); ctx.globalAlpha = 1;
      this.circle(bx2, by2, R, j.active ? PAL[6] : PAL[4]);
      // pomello: sul bordo nella direzione del dito (velocità sempre massima)
      let kx = bx2, ky = by2;
      if (j.active) {
        const dx = j.x - bxC, dy = j.y - byC, d = Math.sqrt(dx * dx + dy * dy);
        if (d >= Input.JOY_DEAD) { kx = bx2 + Math.round(dx / d * (R - kr)); ky = by2 + Math.round(dy / d * (R - kr)); }
      }
      this.ditherDisk(kx, ky, kr, this.pat(j.active ? PAL[7] : PAL[5]));
      this.circle(kx, ky, kr, j.active ? PAL[9] : PAL[6]);
    }

  },

  // anello pieno (da r0 a r1) con retino
  ditherRing(cx, cy, r0, r1, color) {
    const ctx = this.ctx;
    ctx.fillStyle = this.pat(color);
    for (let dy = -r1; dy <= r1; dy++) {
      const ho = Math.floor(Math.sqrt(r1 * r1 - dy * dy));
      const hi = Math.abs(dy) < r0 ? Math.floor(Math.sqrt(r0 * r0 - dy * dy)) : -1;
      if (hi < 0) ctx.fillRect(cx - ho, cy + dy, ho * 2 + 1, 1);
      else { ctx.fillRect(cx - ho, cy + dy, ho - hi, 1); ctx.fillRect(cx + hi + 1, cy + dy, ho - hi, 1); }
    }
  },

  // SICILIA (ISLAND): spiaggia + mare oltre la costa + schiuma. Si disegna solo quando la costa entra nella vista.
  // La costa è il poligono di G.map.isle.r: sabbia = tratto largo sulla costa, poi il mare copre tutto ciò che sta fuori.
  drawSea(S, ox, oy, camX, camY, rt) {
    const ctx = this.ctx, W = this.W, H = this.H, U = CFG.UNIT, I = G.map.isle, N = I.N;
    const reach = Math.sqrt(W * W + H * H) * 0.5 * U + I.beach + 40;
    if (Math.sqrt(camX * camX + camY * camY) + reach < I.min) return;
    if (!this.seaPat) {
      // mattonella del mare 32x32: blu-nero con increspature chiare (pixel art)
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d');
      g.fillStyle = '#071b27'; g.fillRect(0, 0, 32, 32);
      g.fillStyle = '#0a2433';
      for (let y = 0; y < 32; y++) for (let x = (y & 1); x < 32; x += 2) if (((x * 7 + y * 13) % 11) < 4) g.fillRect(x, y, 1, 1);
      g.fillStyle = '#16465c'; g.fillRect(3, 5, 5, 1); g.fillRect(19, 12, 6, 1); g.fillRect(9, 21, 4, 1); g.fillRect(24, 27, 5, 1);
      g.fillStyle = '#2a6e86'; g.fillRect(4, 4, 3, 1); g.fillRect(20, 11, 3, 1); g.fillRect(25, 26, 2, 1);
      this.seaPat = ctx.createPattern(c, 'repeat');
      this.seaMat = typeof DOMMatrix !== 'undefined' ? new DOMMatrix() : null;
    }
    const path = (f) => {
      ctx.beginPath();
      for (let k = 0; k < N; k++) {
        const a = k / N * Math.PI * 2, r = I.r[k] * f * S, x = Math.cos(a) * r + ox, y = Math.sin(a) * r + oy;
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
    };
    // spiaggia: sabbia chiara verso il mare, più scura (bagnata) sul bordo
    path(1);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#7d6c45'; ctx.lineWidth = I.beach * 2 * S; ctx.stroke();
    ctx.strokeStyle = '#9c8957'; ctx.lineWidth = I.beach * 1.2 * S; ctx.stroke();
    // mare: rettangolo della vista meno l'isola (evenodd), con il motivo che scorre piano (onde)
    ctx.rect(-4, -4, W + 8, H + 8);
    if (this.seaMat) { this.seaMat.e = ox + ((rt * 6) % 32); this.seaMat.f = oy + Math.sin(rt * 0.8) * 2; this.seaPat.setTransform(this.seaMat); }
    ctx.fillStyle = this.seaPat; ctx.fill('evenodd');
    // schiuma sulla riva + un'onda più al largo, tratteggiate e in movimento
    ctx.setLineDash([3, 4]);
    ctx.lineDashOffset = -rt * 8;
    ctx.strokeStyle = 'rgba(214,236,232,.75)'; ctx.lineWidth = 1; path(1); ctx.stroke();
    ctx.lineDashOffset = rt * 5;
    ctx.strokeStyle = 'rgba(120,180,190,.35)'; path(1 + (6 + Math.sin(rt * 1.3) * 3) / I.R); ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
    // PONTE di legno sul mare (l'unico): ombra sull'acqua, assi, parapetti, pali; in fondo la porta verso l'altra isola
    const B = G.map.bridge;
    if (B) {
      const t0 = B.r0 - I.beach, L = Math.round((B.len + I.beach) * S), w = Math.round(B.w * S), hw = w >> 1;
      ctx.save();
      ctx.translate(B.ux * t0 * S + ox, B.uy * t0 * S + oy); ctx.rotate(B.a);
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(3, -hw + 4, L, w);
      ctx.fillStyle = '#2a1a0e'; for (let q = 14; q < L; q += 24) { ctx.fillRect(q, -hw - 3, 3, 4); ctx.fillRect(q, hw - 1, 3, 4); }
      ctx.fillStyle = '#6b4a2b'; ctx.fillRect(0, -hw, L, w);
      ctx.fillStyle = '#563a20'; for (let q = 0; q < L; q += 5) ctx.fillRect(q, -hw, 1, w);
      ctx.fillStyle = '#82603a'; for (let q = 2; q < L; q += 15) ctx.fillRect(q, -hw + 3, 2, 1);
      ctx.fillStyle = '#3a2513'; ctx.fillRect(0, -hw, L, 2); ctx.fillRect(0, hw - 2, L, 2);
      ctx.restore();
      const te = B.r0 + B.len, gx = Math.round(B.ux * te * S) + ox, gy = Math.round(B.uy * te * S) + oy;
      if (!G.map.reef || G.reefDone) {
        // porta aperta: un anello giallo fluo che pulsa (con un filo di rosa)
        const pr = hw + 2 + Math.round(Math.sin(rt * 4) * 2);
        ctx.globalAlpha = 0.35; this.ditherDisk(gx, gy, pr + 4, this.pat(PAL.K)); ctx.globalAlpha = 1;
        this.circle(gx, gy, pr, '#f0ff1a'); this.circle(gx, gy, pr - 3, '#ff2e88');
      } else {
        // sbarrato finché Scilla è viva: travi incrociate sul ponte
        const bx = Math.round(B.ux * (B.r0 + 8) * S) + ox, by = Math.round(B.uy * (B.r0 + 8) * S) + oy;
        ctx.strokeStyle = '#5a1018'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(bx - hw, by - hw); ctx.lineTo(bx + hw, by + hw); ctx.moveTo(bx + hw, by - hw); ctx.lineTo(bx - hw, by + hw); ctx.stroke();
      }
    }
  },

  // linea pixel (Bresenham)
  line(x0, y0, x1, y1) {
    const ctx = this.ctx;
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 2000; guard++) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  },

  // segni sopra un nemico rallentato dal Gelo (azzurro), congelato (ghiaccio pieno) o stordito dal Flagello (stelline)
  frozen(wx, wy, r, m, rt) {
    const ctx = this.ctx, x = Math.round(wx / CFG.UNIT) + this.ox, y = Math.round(wy / CFG.UNIT) + this.oy, h = Math.max(3, Math.round(r / CFG.UNIT));
    if (m > 0 && m < 0.01) {
      // BLOCCO DI GHIACCIO (fusioni uniche: Vento di Lucifero, Stelle di Cocito): cristallo azzurro con spigoli e riflessi
      const hw = h + 1, hh = h + 2;
      ctx.globalAlpha = 0.55; this.ditherDisk(x, y - 1, hw, this.pat(PAL[']'])); ctx.globalAlpha = 1;
      ctx.fillStyle = PAL['{'];
      ctx.fillRect(x - hw, y - hh + 2, 1, hh * 2 - 3); ctx.fillRect(x + hw, y - hh + 3, 1, hh * 2 - 4);
      ctx.fillRect(x - hw + 2, y - hh, hw * 2 - 3, 1); ctx.fillRect(x - hw + 1, y + hh - 1, hw * 2 - 1, 1);
      ctx.fillStyle = PAL.w;
      ctx.fillRect(x - hw + 2, y - hh + 2, 1, 3); ctx.fillRect(x - hw + 3, y - hh + 2, 2, 1);   // riflesso in alto a sinistra
      if (((rt * 3 + x) | 0) % 4 === 0) ctx.fillRect(x + hw - 2, y + hh - 3, 1, 1);             // luccichio
      ctx.fillStyle = PAL[']']; ctx.fillRect(x - 1, y - hh - 1, 1, 2); ctx.fillRect(x + 2, y - hh, 1, 1);   // punte
      return;
    }
    if (m === 0) {
      ctx.fillStyle = PAL[9];
      for (let k = 0; k < 3; k++) { const b = rt * 7 + k * 2.094; ctx.fillRect(x + Math.round(Math.cos(b) * (h + 1)), y - h - 2 + Math.round(Math.sin(b) * 1.5), 1, 1); }
      return;
    }
    if (m < 0.2) { ctx.globalAlpha = 0.5; this.ditherDisk(x, y, h - 1, this.pat(PAL[']'])); ctx.globalAlpha = 1; }
    ctx.fillStyle = m < 0.2 ? PAL.w : PAL[']'];
    ctx.fillRect(x - h + 1, y - 1, 1, 1); ctx.fillRect(x + h - 2, y - h + 2, 1, 1); ctx.fillRect(x, y + h - 2, 1, 1);
  },

  // TRIBOLI: tre chiodi a quattro punte grigio ferro; evoluti (Pegola Spessa) affondano in una pozza di pece che bolle
  caltrop(x, y, r, fade, evo, seed) {
    const ctx = this.ctx;
    if (evo) {
      ctx.globalAlpha = 0.85 * fade; this.ditherDisk(x, y, r, this.pat(PAL[1]));
      ctx.globalAlpha = 0.7 * fade; this.ditherDisk(x, y, Math.max(1, (r * 0.6) | 0), this.pat(PAL[3])); ctx.globalAlpha = fade;
      this.circle(x, y, r, PAL['~']);
      const t = (performance.now() * 0.002 + seed * 0.37) % 1;   // bolla che sale e scoppia
      ctx.fillStyle = PAL[5]; ctx.fillRect(x + ((seed * 5) % (r + 1)) - (r >> 1), y - Math.round(t * 2), 1, 1);
    } else {
      ctx.globalAlpha = 0.35 * fade; this.ditherDisk(x, y, r, this.pat(PAL[2])); ctx.globalAlpha = fade;
    }
    const n = 3, d = Math.max(1, r - 3);
    for (let q = 0; q < n; q++) {
      const a = q * 2.094 + seed * 1.3, cx = x + Math.round(Math.cos(a) * d * 0.6), cy = y + Math.round(Math.sin(a) * d * 0.5);
      ctx.fillStyle = PAL[5]; ctx.fillRect(cx - 1, cy + 1, 3, 1);                     // ombra
      ctx.fillStyle = PAL[7]; ctx.fillRect(cx - 1, cy, 3, 1); ctx.fillRect(cx, cy - 1, 1, 3);
      ctx.fillStyle = (q + seed) & 1 ? PAL[8] : PAL[9]; ctx.fillRect(cx, cy - 2, 1, 1);  // punta in alto che luccica
    }
    ctx.globalAlpha = 1;
  },

  // pozza di fuoco del Sabbione Ardente: brace scura, bordo arancio, fiammelle che salgono e scintille
  firePool(x, y, r, fade, rt, seed) {
    const ctx = this.ctx;
    ctx.globalAlpha = 0.85 * fade; this.ditherDisk(x, y, r, this.pat(PAL.E));
    ctx.globalAlpha = 0.75 * fade; this.ditherDisk(x, y, Math.max(1, (r * 0.75) | 0), this.pat(PAL.F));
    ctx.globalAlpha = 0.6 * fade; this.ditherDisk(x, y, Math.max(1, (r * 0.4) | 0), this.pat(PAL.G)); ctx.globalAlpha = fade;
    this.circle(x, y, r, (((rt * 6 + seed) | 0) & 1) ? PAL.G : PAL.P);
    if (r > 4) this.circle(x, y, r - 1, PAL.F);
    const n = Math.max(4, Math.round(r * 1.1));
    for (let q = 0; q < n; q++) {
      const a = q * 2.399 + seed, d = (q * 37 % 100) / 100 * (r - 2), fx = x + Math.round(Math.cos(a) * d), fy = y + Math.round(Math.sin(a) * d * 0.7);
      const t = (rt * 2.2 + q * 0.37 + seed * 0.1) % 1, hgt = 2 + ((q * 7) % 3);
      ctx.fillStyle = t < 0.5 ? PAL.P : PAL.G; ctx.fillRect(fx, fy - Math.round(t * 5), 1, hgt);
      if (t < 0.25) { ctx.fillStyle = PAL.Y; ctx.fillRect(fx, fy - Math.round(t * 5) - 1, 1, 1); }
      if (q % 3 === 0 && t > 0.6) { ctx.fillStyle = PAL.Z; ctx.fillRect(fx + 1, fy - 4 - Math.round(t * 6), 1, 1); }   // scintille che volano
    }
    ctx.globalAlpha = 1;
  },

  // turbine del Vento di Lucifero: vortice di ghiaccio azzurro/bianco con fiocchi che girano e brina alla base
  iceStorm(sx, sy, r, spin, fade, i, rt) {
    const ctx = this.ctx;
    ctx.globalAlpha = 0.45 * fade; this.ditherDisk(sx, sy + Math.round(r * 0.35), Math.max(2, Math.round(r * 0.9)), this.pat(PAL[']'])); ctx.globalAlpha = fade;
    for (let j = 0; j < 6; j++) {
      const f = j / 5, rx = r * (0.25 + 0.75 * f), ry = Math.max(1, rx * 0.3);
      const cy = sy + r * 0.35 - f * r * 1.4, cx = sx + Math.round(Math.sin(spin * 0.5 + j * 0.9) * (1 + f * 2));
      const N = Math.max(10, Math.round(rx * 3));
      for (let q = 0; q < N; q++) {
        const a = q / N * 6.2832 + spin * (1 + f * 0.5), front = Math.sin(a) > 0;
        if (!front && (q & 1)) continue;
        ctx.fillStyle = front ? (j === 5 || j === 0 ? PAL.w : j > 2 ? PAL[']'] : PAL['{']) : PAL['}'];
        ctx.fillRect(cx + Math.round(Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
      }
    }
    // fiocchi di neve: piccole croci bianche che girano attorno
    for (let q = 0; q < 4; q++) {
      const a = spin * 1.1 + q * 1.571, fx = sx + Math.round(Math.cos(a) * r * 0.8), fy = sy - Math.round(r * (0.15 + 0.3 * q)) + Math.round(Math.sin(a) * r * 0.25);
      ctx.fillStyle = PAL.w; ctx.fillRect(fx - 1, fy, 3, 1); ctx.fillRect(fx, fy - 1, 1, 3);
      ctx.fillStyle = PAL[']']; ctx.fillRect(fx - 1, fy - 1, 1, 1); ctx.fillRect(fx + 1, fy + 1, 1, 1);
    }
  },

  // ARMI IN ALTA RISOLUZIONE (2026-10-28): sopra agli sprite a pixel, scie e bagliori lisci a mezzi pixel (canvas 2x),
  // sommati alla luce ('lighter'). Dardi/frecce: scia affusolata | falci, asce, ruote: vortice | fuochi fatui: fiamma |
  // sfere: arco luminoso | raggi del Lume: fascio a strati.
  weaponGlow(P, ia, alpha, S, ox, oy, L, R, T, B, rt, camX, camY, ppx, ppy) {
    const ctx = this.ctx, TAU = 6.2832, WG = WEAPON_GLOW;
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 0; i < P.count; i++) {
      const kd = P.kind[i];
      if (P.alive[i] === 0) continue;
      const g = WG[kd];
      if (!g) continue;
      const x = P.px[i] * ia + P.x[i] * alpha, y = P.py[i] * ia + P.y[i] * alpha;
      if (x < L || x > R || y < T || y > B) continue;
      const sx = x * S + ox, sy = y * S + oy, col = P.evo[i] ? g.evo : g.c;
      const v = Math.sqrt(P.vx[i] * P.vx[i] + P.vy[i] * P.vy[i]) || 1, ux = P.vx[i] / v, uy = P.vy[i] / v;
      if (g.t === 'tail') {
        // scia affusolata dietro al proiettile: larga e tenue, poi stretta e chiara
        const len = g.len * (P.evo[i] ? 1.4 : 1);
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.28; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - ux * len, sy - uy * len); ctx.stroke();
        ctx.globalAlpha = 0.55; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - ux * len * 0.6, sy - uy * len * 0.6); ctx.stroke();
        ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(sx + ux, sy + uy); ctx.lineTo(sx - ux * len * 0.3, sy - uy * len * 0.3); ctx.stroke();
      } else if (g.t === 'spin') {
        // vortice: due archi che inseguono la rotazione dell'arma
        const rr = g.r * P.size[i], a = rt * g.spin * (kd === PK.AXE && P.vx[i] < 0 ? -1 : 1) + i;
        ctx.strokeStyle = col;
        for (let q = 0; q < 2; q++) {
          const a0 = a + q * Math.PI;
          ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, rr, a0 - 1.6, a0); ctx.stroke();
          ctx.globalAlpha = 0.85; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx, sy, rr, a0 - 0.6, a0); ctx.stroke();
        }
        ctx.globalAlpha = 0.18; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx, sy, rr * 1.15, 0, TAU); ctx.fill();
      } else if (g.t === 'flame') {
        // fuoco fatuo: fiamma a palline che si rimpiccioliscono all'indietro, sfarfalla
        ctx.fillStyle = col;
        for (let q = 0; q < 6; q++) {
          const d = q * 2.2, j = Math.sin(rt * 30 + i + q * 1.7) * 0.8 * q / 6;
          ctx.globalAlpha = 0.55 * (1 - q / 6);
          ctx.beginPath(); ctx.arc(sx - ux * d - uy * j, sy - uy * d + ux * j, 3.2 - q * 0.45, 0, TAU); ctx.fill();
        }
      }
    }
    // sfere orbitanti: arco luminoso dietro a ognuna
    for (let i = 0; i < Player.weapons.length; i++) {
      const w = Player.weapons[i];
      if (w.id !== 'orbit' || (w.special && w.special.fx === 'stelle')) continue;
      const st = wStats(w), no = amt(st), step = TAU / no, R2 = st.radius * Player.areaMult * S;
      const cx = camX * S + ox, cy = camY * S + oy;
      ctx.strokeStyle = w.evolved ? '#ff5fe0' : '#7fd7ff';
      for (let k = 0; k < no; k++) {
        const a = w.angle + k * step;
        ctx.globalAlpha = 0.25; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R2, a - 0.7, a); ctx.stroke();
        ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R2, a - 0.35, a); ctx.stroke();
        ctx.globalAlpha = 0.35; ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R2, cy + Math.sin(a) * R2, 6, 0, TAU); ctx.fill();
      }
    }
    // raggi del Lume: fascio liscio a strati sopra a quello a pixel
    for (let i = 0; i < Player.weapons.length; i++) {
      const w = Player.weapons[i];
      if (w.id !== 'beam') continue;
      const st = wStats(w), nb = amt(st), Rb = st.range * Player.areaMult * S, step = TAU / nb, fl = 0.85 + 0.15 * Math.sin(rt * 40);
      for (let k = 0; k < nb; k++) {
        const a = w.angle + k * step, ex = ppx + Math.cos(a) * Rb, ey = ppy + Math.sin(a) * Rb, bx = ppx + Math.cos(a) * 7, by = ppy + Math.sin(a) * 7;
        ctx.strokeStyle = w.evolved ? '#ff5fe0' : '#ffc94a';
        ctx.globalAlpha = 0.22 * fl; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.globalAlpha = 0.45 * fl; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'butt'; ctx.globalCompositeOperation = 'source-over';
  },

  // BUCHI E BRACCIA (Pits, Scavatore) in alta risoluzione. layer 0 = il buco (sotto), 1 = il braccio (sopra).
  // Il buco si apre con le crepe e un bordo che lampeggia (avviso); il braccio sale dritto, la mano artigliata si apre e
  // colpisce, poi rientra.
  drawPits(S, ox, oy, layer, rt) {
    const P = Pits, F = FOSSOR;
    if (P.n === 0) return;
    const ctx = this.ctx, TAU = 6.2832;
    for (let k = 0; k < P.n; k++) {
      const t = P.t[k], x = P.x[k] * S + ox, y = P.y[k] * S + oy, R = F.r * S;
      const open = Math.min(1, t / (F.tell * 0.6)), close = t > PIT_END - 0.35 ? (PIT_END - t) / 0.35 : 1;
      if (layer === 0) {
        const rw = R * open * (0.4 + 0.6 * close), rh = rw * 0.5;
        // crepe che si allargano
        ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 1; ctx.globalAlpha = 0.8 * close;
        ctx.beginPath();
        for (let c = 0; c < 6; c++) { const a = c * 1.05 + k, l = R * (0.9 + 0.5 * open); ctx.moveTo(x + Math.cos(a) * rw * 0.8, y + Math.sin(a) * rh * 0.8); ctx.lineTo(x + Math.cos(a + 0.2) * l, y + Math.sin(a + 0.2) * l * 0.5); }
        ctx.stroke();
        // bordo di terra e buco nero
        ctx.globalAlpha = close; ctx.fillStyle = '#4a3420'; ctx.beginPath(); ctx.ellipse(x, y, rw + 2.5, rh + 1.5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#050304'; ctx.beginPath(); ctx.ellipse(x, y, rw, rh, 0, 0, TAU); ctx.fill();
        // avviso: anello rosso che lampeggia finché il braccio non esce
        if (t < F.tell) {
          ctx.globalAlpha = 0.5 + 0.5 * ((((rt * 10) | 0) & 1)); ctx.strokeStyle = '#ff3b1f'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.5, 0, 0, TAU); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        continue;
      }
      if (t < F.tell) continue;
      // BRACCIO (2026-10-28, rifatto): esce piano (FOSSOR.rise) da un buco, braccio di cadavere muscoloso e piegato,
      // mano a 5 dita con nocche e artigli neri che si apre, resta, poi si chiude ad afferrare e rientra.
      const u = t - F.tell, r0 = Math.min(1, u / F.rise), rise = 1 - (1 - r0) * (1 - r0) * (1 - r0);
      const h = R * 3.6 * rise * close, sd = P.side[k], sway = Math.sin(u * 4 + k) * R * 0.06 * sd;
      const w = R * 0.5, wx = x + sway + sd * h * 0.16, wy = y - h;          // polso
      const ex = x + sd * w * 0.9 + sway * 0.5, ey = y - h * 0.5;            // gomito (piega verso il lato)
      const grab = u > F.up * 0.75 ? Math.min(1, (u - F.up * 0.75) / (F.up * 0.25)) : 0;   // alla fine stringe il pugno
      const op = Math.min(1, Math.max(0, (u - F.rise * 0.6) / 0.25)) * (1 - grab);         // quanto è aperta la mano
      ctx.save();
      ctx.beginPath(); ctx.rect(x - R * 3, y - R * 7, R * 6, R * 7 + 1); ctx.clip();   // il braccio sparisce sotto il bordo del buco
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // contorno scuro, poi carne, poi lato in ombra e luce: braccio come una linea spessa che si assottiglia
      for (let pass = 0; pass < 3; pass++) {
        ctx.strokeStyle = pass === 0 ? '#1c1418' : pass === 1 ? '#7d6e74' : '#9e9095';
        const bw = pass === 0 ? 2.2 : pass === 1 ? 1.7 : 0.7;
        ctx.lineWidth = w * bw;
        ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.quadraticCurveTo(ex, ey, wx, wy + w * 0.4);
        if (pass === 2) { ctx.lineWidth = w * 0.35; ctx.strokeStyle = '#b5a9ad'; ctx.beginPath(); ctx.moveTo(x - sd * w * 0.35, y); ctx.quadraticCurveTo(ex - sd * w * 0.45, ey, wx - sd * w * 0.3, wy + w * 0.6); }
        ctx.stroke();
      }
      // ombra sul lato esterno + tendini e una vena
      ctx.strokeStyle = '#4e4249'; ctx.lineWidth = w * 0.45;
      ctx.beginPath(); ctx.moveTo(x + sd * w * 0.55, y + 2); ctx.quadraticCurveTo(ex + sd * w * 0.5, ey, wx + sd * w * 0.45, wy + w * 0.7); ctx.stroke();
      ctx.strokeStyle = '#5f3f55'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(x - sd * w * 0.1, y - 2); ctx.quadraticCurveTo(ex - sd * w * 0.2, ey + w, wx - sd * w * 0.1, wy + w * 1.2); ctx.stroke();
      // palmo
      ctx.fillStyle = '#1c1418'; ctx.beginPath(); ctx.ellipse(wx, wy - w * 0.15, w * 1.05, w * 0.85, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#857679'; ctx.beginPath(); ctx.ellipse(wx, wy - w * 0.15, w * 0.88, w * 0.7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#a3969a'; ctx.beginPath(); ctx.ellipse(wx - sd * w * 0.25, wy - w * 0.3, w * 0.4, w * 0.3, 0, 0, TAU); ctx.fill();
      // 5 dita: 2 falangi ciascuna (si aprono a ventaglio, poi si chiudono), nocca, artiglio nero ricurvo
      for (let f = 0; f < 5; f++) {
        const thumb = f === 0, fi = thumb ? -2.4 : f - 2.5;
        const a = -Math.PI / 2 + fi * (0.2 + 0.2 * op) * (thumb ? 0.9 : 1) * -sd;
        const l1 = w * (thumb ? 0.8 : f === 2 || f === 3 ? 1.15 : 0.95), l2 = l1 * 0.8;
        const bx = wx + Math.cos(a) * w * 0.75, by = wy - w * 0.15 + Math.sin(a) * w * 0.55;
        const a2 = a + (0.5 + 0.9 * grab - 0.35 * op) * sd;   // la seconda falange si piega (artiglia)
        const mx = bx + Math.cos(a) * l1, my = by + Math.sin(a) * l1, tx = mx + Math.cos(a2) * l2, ty = my + Math.sin(a2) * l2;
        ctx.strokeStyle = '#1c1418'; ctx.lineWidth = w * 0.5;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(mx, my); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.strokeStyle = '#857679'; ctx.lineWidth = w * 0.32;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(mx, my); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = '#a3969a'; ctx.beginPath(); ctx.arc(mx, my, w * 0.13, 0, TAU); ctx.fill();   // nocca
        const a3 = a2 + 0.7 * sd, cl = w * 0.55;
        ctx.strokeStyle = '#0d0809'; ctx.lineWidth = w * 0.2;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a2) * cl * 0.7, ty + Math.sin(a2) * cl * 0.7, tx + Math.cos(a3) * cl, ty + Math.sin(a3) * cl); ctx.stroke();
        ctx.strokeStyle = '#6e5a60'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + Math.cos(a2) * cl * 0.5, ty + Math.sin(a2) * cl * 0.5); ctx.stroke();
      }
      ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
      ctx.restore();
      // bordo davanti del buco sopra al braccio: zolle di terra
      ctx.fillStyle = '#4a3420';
      ctx.beginPath(); ctx.ellipse(x, y, R + 2.5, R * 0.5 + 1.5, 0, 0, Math.PI); ctx.ellipse(x, y + 1, R * 0.92, R * 0.42, 0, Math.PI, 0, true); ctx.fill();
      ctx.fillStyle = '#6a4c2e';
      for (let c = 0; c < 5; c++) { const a = 0.35 + c * 0.6, zx = x + Math.cos(a) * R, zy = y + Math.sin(a) * R * 0.5; ctx.beginPath(); ctx.arc(zx, zy, 1.6 + (c & 1), 0, TAU); ctx.fill(); }
      // terra che schizza all'uscita
      if (u < 0.35) {
        ctx.fillStyle = '#5a4028'; ctx.globalAlpha = 1 - u / 0.35;
        for (let c = 0; c < 10; c++) { const a = c * 0.628 + k, d = R * (0.6 + u * 4); ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.5 - u * 40 + u * u * 120, 1.2 + (c % 3) * 0.5, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
    }
  },

  // bottiglia lanciata (Ignis: fire = true; Aqua Stygia: fire = false). sx/sy = punto a terra, h = altezza in pixel
  bottle(sx, sy, h, p, fire, evo, rt, i) {
    const ctx = this.ctx, TAU = 6.2832, by = sy - h;
    // ombra
    ctx.globalAlpha = 0.45; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(sx, sy + 2, 3 + h * 0.04, 1.4 + h * 0.015, 0, 0, TAU); ctx.fill();
    // scia: scintille (Ignis) o gocce (Aqua) che cadono dietro
    const liq = fire ? (evo ? '#ff5fe0' : '#ff7a1f') : (evo ? '#ff3a3a' : '#7dff4a');
    ctx.globalCompositeOperation = fire ? 'lighter' : 'source-over'; ctx.fillStyle = liq;
    for (let q = 1; q <= 4; q++) {
      const ph = (rt * 6 + q * 0.27 + i * 0.13) % 1;
      ctx.globalAlpha = 0.7 * (1 - ph);
      ctx.beginPath(); ctx.arc(sx + Math.sin(i + q * 2.1) * 3, by + 3 + ph * 8 + q, fire ? 0.9 : 0.8 + (1 - ph) * 0.6, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    // la bottiglia gira
    ctx.save(); ctx.translate(sx, by); ctx.rotate(p * 12.566 * ((i & 1) ? 1 : -1));
    if (fire) {
      // fiasca tonda di vetro scuro, fuoco dentro, collo, tappo e miccia
      ctx.fillStyle = '#140a08'; ctx.beginPath(); ctx.arc(0, 1, 5, 0, TAU); ctx.fill(); ctx.fillRect(-1.8, -6.5, 3.6, 4);
      ctx.fillStyle = evo ? '#7a1a5a' : '#8a2a0a'; ctx.beginPath(); ctx.arc(0, 1, 4, 0, TAU); ctx.fill();
      const fl = 0.75 + 0.25 * Math.sin(rt * 25 + i);
      ctx.fillStyle = evo ? '#ff5fe0' : '#ff8a1f'; ctx.beginPath(); ctx.arc(0, 2, 3 * fl, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(0.3, 2.4, 1.4 * fl, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.ellipse(-1.8, -0.6, 1, 1.6, 0.5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;   // riflesso
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-1.2, -7.5, 2.4, 1.6);   // tappo
      ctx.strokeStyle = '#c8b090'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(0, -7.5); ctx.quadraticCurveTo(2, -9, 1.5, -10.5); ctx.stroke();   // miccia
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#fff2a0';
      for (let q = 0; q < 3; q++) { const a = rt * 30 + q * 2.1; ctx.beginPath(); ctx.arc(1.5 + Math.cos(a) * 1.4, -10.5 + Math.sin(a) * 1.4, 0.6, 0, TAU); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // ampolla alta: pancia, collo lungo, liquido che si muove, bolle
      ctx.fillStyle = '#0a160a';
      ctx.beginPath(); ctx.moveTo(-1.6, -7); ctx.lineTo(1.6, -7); ctx.lineTo(1.6, -2.5); ctx.lineTo(4.8, 3); ctx.quadraticCurveTo(5, 5.5, 2.5, 5.5); ctx.lineTo(-2.5, 5.5); ctx.quadraticCurveTo(-5, 5.5, -4.8, 3); ctx.lineTo(-1.6, -2.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = evo ? '#a0141c' : '#2f9a22';
      ctx.beginPath(); ctx.moveTo(-3.2, 1 + Math.sin(rt * 9 + i) * 0.5); ctx.lineTo(3.2, 1 - Math.sin(rt * 9 + i) * 0.5); ctx.lineTo(3.9, 3.2); ctx.quadraticCurveTo(4, 4.6, 2.2, 4.6); ctx.lineTo(-2.2, 4.6); ctx.quadraticCurveTo(-4, 4.6, -3.9, 3.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = liq; ctx.beginPath(); ctx.arc(-1, 2.8, 0.7, 0, TAU); ctx.arc(1.4, 3.4, 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.6; ctx.fillRect(-1, -6, 0.7, 3.5); ctx.globalAlpha = 1;   // riflesso sul vetro
      ctx.fillStyle = '#d8b04a'; ctx.fillRect(-2, -8.2, 4, 1.4);   // tappo con sigillo d'oro
    }
    ctx.restore();
  },

  // POZZA ACIDA (Aqua Stygia) in alta risoluzione: bordo che ondeggia, liquido a strati, riflesso e bolle che scoppiano.
  // kind 0 = acido verde, 1 = pozza che rallenta (azzurra), 2 = evoluta Flegetonte (sangue che bolle)
  acidPool(x, y, r, fade, rt, i, kind) {
    const ctx = this.ctx, TAU = 6.2832;
    const c0 = kind === 2 ? '#3a0608' : kind === 1 ? '#0e2a44' : '#123a0c', c1 = kind === 2 ? '#a0141c' : kind === 1 ? '#2f7fc0' : '#3fae2a';
    const c2 = kind === 2 ? '#ff5a3a' : kind === 1 ? '#9fdcff' : '#b6ff5a';
    // bordo mosso: 10 cerchietti che respirano attorno + il disco
    ctx.globalAlpha = 0.6 * fade; ctx.fillStyle = c0;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    for (let q = 0; q < 10; q++) { const a = q * 0.628 + i, rr = r * (0.22 + 0.06 * Math.sin(rt * 3 + q * 1.7 + i)); ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85, rr, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 0.55 * fade; ctx.fillStyle = c1;
    ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, TAU); ctx.fill();
    // riflesso lucido
    ctx.globalAlpha = 0.35 * fade; ctx.fillStyle = c2;
    ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.16, -0.6, 0, TAU); ctx.fill();
    // bolle: nascono, crescono e scoppiano (anellino)
    for (let q = 0; q < 4; q++) {
      const ph = (rt * (0.9 + q * 0.23) + i * 0.37 + q * 0.25) % 1, a = q * 1.9 + i * 2.3, d = r * (0.2 + 0.45 * ((q * 37 + i * 11) % 10) / 10);
      const bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d;
      if (ph < 0.8) { ctx.globalAlpha = 0.8 * fade; ctx.strokeStyle = c2; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(bx, by, 0.6 + ph * 2.2, 0, TAU); ctx.stroke(); }
      else { ctx.globalAlpha = (1 - (ph - 0.8) / 0.2) * fade; ctx.strokeStyle = c2; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(bx, by, 2.4 + (ph - 0.8) * 15, 0, TAU); ctx.stroke(); }
    }
    // fumo leggero che sale (acido/sangue che bolle)
    if (kind !== 1) { ctx.fillStyle = c1; for (let q = 0; q < 2; q++) { const ph = (rt * 0.6 + q * 0.5 + i * 0.13) % 1; ctx.globalAlpha = 0.25 * (1 - ph) * fade; ctx.beginPath(); ctx.arc(x + (q ? r * 0.3 : -r * 0.2), y - ph * r * 0.9, 1.5 + ph * 3, 0, TAU); ctx.fill(); } }
    ctx.globalAlpha = 1;
  },

  // PIOGGIA DI METEORE (Meteors): segno rosso a terra che si stringe + sasso infuocato che cade in diagonale con la scia
  drawMeteors(S, ox, oy, rt) {
    const M = Meteors;
    if (M.n === 0) return;
    const ctx = this.ctx, TAU = 6.2832;
    for (let k = 0; k < M.n; k++) {
      const p = 1 - M.t[k] / M.t0[k], tx = M.x[k] * S + ox, ty = M.y[k] * S + oy, rr = M.r[k] * S;
      // segno a terra
      ctx.globalAlpha = 0.15 + 0.25 * p; ctx.fillStyle = '#ff3b1f';
      ctx.beginPath(); ctx.ellipse(tx, ty, rr, rr * 0.55, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.5 + 0.5 * p; ctx.strokeStyle = (((rt * 12) | 0) & 1) ? '#ffd25a' : '#ff3b1f'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(tx, ty, rr * (1.4 - 0.4 * p), rr * 0.55 * (1.4 - 0.4 * p), 0, 0, TAU); ctx.stroke();
      // la meteora: arriva dall'alto a sinistra
      const q = 1 - p, mx = tx - 70 * q, my = ty - 170 * q, z = 3.5 + M.r[k] * S * 0.08 + (M.fire[k] ? 1.5 : 0);
      const ux = 70 / 184, uy = 170 / 184, len = 26 + 20 * q;
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.strokeStyle = '#ff5a1a'; ctx.globalAlpha = 0.35; ctx.lineWidth = z * 2.4;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx - ux * len, my - uy * len); ctx.stroke();
      ctx.strokeStyle = '#ffb347'; ctx.globalAlpha = 0.6; ctx.lineWidth = z * 1.3;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx - ux * len * 0.65, my - uy * len * 0.65); ctx.stroke();
      ctx.strokeStyle = '#fff2c0'; ctx.globalAlpha = 0.9; ctx.lineWidth = z * 0.5;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx - ux * len * 0.3, my - uy * len * 0.3); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt'; ctx.globalAlpha = 1;
      ctx.fillStyle = '#3a1410'; ctx.beginPath(); ctx.arc(mx, my, z, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff7a1f'; ctx.beginPath(); ctx.arc(mx - z * 0.25, my - z * 0.25, z * 0.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(mx - z * 0.35, my - z * 0.35, z * 0.28, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  // EFFETTI DELLE ABILITÀ (SkillFx): forme lisce a mezzi pixel (il canvas è 2x)
  drawSkillFx(S, ox, oy) {
    if (!SkillFx.slot.length) return;
    const ctx = this.ctx, TAU = 6.2832;
    for (const f of SkillFx.slot) {
      if (!f.on) continue;
      const D = SKILL_FX[f.kind], p = (G.time - f.t0) / D.dur;
      if (p >= 1 || p < 0) { f.on = false; continue; }
      const q = 1 - p, e = 1 - q * q * q, cx = f.x * S + ox, cy = f.y * S + oy, R = f.r * S * e;
      if (f.kind === 'ira') {
        // bagliore a terra
        ctx.globalAlpha = 0.28 * q; ctx.fillStyle = '#ff4a12';
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.22 * q; ctx.fillStyle = '#ffb347';
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.6, 0, TAU); ctx.fill();
        // lampo bianco iniziale
        if (p < 0.18) { ctx.globalAlpha = 1 - p / 0.18; ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(cx, cy, 10 + R * 0.35, 0, TAU); ctx.fill(); }
        // lingue di fuoco sul fronte dell'onda (rosse fuori, gialle dentro)
        for (let k = 0; k < D.n; k++) {
          const a = k / D.n * TAU + f.a[0] * 0.2, ux = Math.cos(a), uy = Math.sin(a), wx = -uy, wy = ux;
          const L = R * (0.18 + 0.22 * f.v[k]) * q, b = R * 0.07 + 1.5, r0 = R * 0.9;
          ctx.globalAlpha = q; ctx.fillStyle = '#e8321a';
          ctx.beginPath(); ctx.moveTo(cx + ux * r0 + wx * b, cy + uy * r0 + wy * b); ctx.lineTo(cx + ux * (r0 + L), cy + uy * (r0 + L)); ctx.lineTo(cx + ux * r0 - wx * b, cy + uy * r0 - wy * b); ctx.fill();
          ctx.fillStyle = '#ffd25a';
          ctx.beginPath(); ctx.moveTo(cx + ux * r0 + wx * b * 0.5, cy + uy * r0 + wy * b * 0.5); ctx.lineTo(cx + ux * (r0 + L * 0.6), cy + uy * (r0 + L * 0.6)); ctx.lineTo(cx + ux * r0 - wx * b * 0.5, cy + uy * r0 - wy * b * 0.5); ctx.fill();
        }
        // anello dell'onda d'urto
        ctx.globalAlpha = q; ctx.strokeStyle = '#ffe7a0'; ctx.lineWidth = 1 + 4 * q;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#ff6a1f'; ctx.lineWidth = 1 + 2 * q;
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.82, 0, TAU); ctx.stroke();
        // braci che volano via
        for (let k = 0; k < D.p; k++) {
          const d = f.r * S * (0.2 + 1.1 * f.v[k]) * e, a = f.a[k];
          ctx.globalAlpha = q * (0.6 + 0.4 * f.s[k]); ctx.fillStyle = f.s[k] > 0.5 ? '#ffe08a' : '#ff7a1f';
          const z = 0.5 + f.s[k] * 1.2;
          ctx.fillRect(cx + Math.cos(a) * d - z / 2, cy + Math.sin(a) * d - z / 2 - p * 8 * f.v[k], z, z);
        }
      } else {
        // disco di brina
        ctx.globalAlpha = 0.2 * q; ctx.fillStyle = '#9fdcff';
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
        // cristalli di ghiaccio: rombi allungati che spuntano dal terreno, puntati verso l'esterno
        for (let k = 0; k < D.n; k++) {
          const a = k / D.n * TAU + f.a[1], ux = Math.cos(a), uy = Math.sin(a), wx = -uy, wy = ux;
          const rr = R * (0.45 + 0.5 * f.v[k]), L = (10 + 14 * f.s[k]) * Math.min(1, p * 4), b = 2.5 + 2 * f.s[k];
          const bx = cx + ux * rr, by = cy + uy * rr;
          ctx.globalAlpha = Math.min(1, q * 1.5); ctx.fillStyle = '#cfefff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(bx - ux * L * 0.3, by - uy * L * 0.3); ctx.lineTo(bx + wx * b, by + wy * b); ctx.lineTo(bx + ux * L, by + uy * L); ctx.lineTo(bx - wx * b, by - wy * b); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#5fb8ff'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + ux * L, by + uy * L); ctx.lineTo(bx - wx * b * 0.5, by - wy * b * 0.5); ctx.closePath(); ctx.fill();
        }
        // anelli gelati
        ctx.globalAlpha = q; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1 + 2.5 * q;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#5fb8ff'; ctx.lineWidth = 1 + q;
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.92, 0, TAU); ctx.stroke();
        // grande fiocco di neve al centro (6 bracci con rametti), gira piano
        const fl = (24 + 14 * e) * (p < 0.15 ? p / 0.15 : 1), rot = p * 1.2;
        ctx.globalAlpha = q; ctx.strokeStyle = '#eaf8ff'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = rot + k * TAU / 6, ux = Math.cos(a), uy = Math.sin(a);
          ctx.moveTo(cx, cy); ctx.lineTo(cx + ux * fl, cy + uy * fl);
          for (let mi = 0; mi < 2; mi++) {
            const m = mi ? 0.72 : 0.45, mx = cx + ux * fl * m, my = cy + uy * fl * m, br = fl * (0.95 - m) * 0.7;
            ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(a + 0.8) * br, my + Math.sin(a + 0.8) * br);
            ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(a - 0.8) * br, my + Math.sin(a - 0.8) * br);
          }
        }
        ctx.stroke(); ctx.lineCap = 'butt';
        // scintille che brillano
        ctx.fillStyle = '#ffffff';
        for (let k = 0; k < D.p; k++) {
          const d = f.r * S * f.v[k] * e, a = f.a[k], tw = 0.5 + 0.5 * Math.sin(p * 20 + f.s[k] * 9);
          ctx.globalAlpha = q * tw; const sx = cx + Math.cos(a) * d, sy = cy + Math.sin(a) * d, z = 1 + f.s[k] * 1.5;
          ctx.fillRect(sx - z, sy - 0.25, z * 2, 0.5); ctx.fillRect(sx - 0.25, sy - z, 0.5, z * 2);
        }
      }
    }
    ctx.globalAlpha = 1;
  },

  spr(s, img, wx, wy) {
    this.ctx.drawImage(img, Math.round(wx / CFG.UNIT) + this.ox - (s.w >> 1), Math.round(wy / CFG.UNIT) + this.oy - (s.h >> 1), s.w, s.h);
  },

  // ---- frame -----------------------------------------------------------------
  draw(alpha) {
    const ctx = this.ctx, W = this.W, H = this.H, U = CFG.UNIT, S = 1 / U;
    const ia = 1 - alpha, t = G.time, rt = performance.now() / 1000;

    const camX = Player.px * ia + Player.x * alpha;
    const camY = Player.py * ia + Player.y * alpha;
    G.camX = camX; G.camY = camY;
    const cpx = Math.round(camX * S), cpy = Math.round(camY * S);
    let shx = 0, shy = 0;
    if (G.shake > 0 && (G.state === 'play' || G.state === 'dying')) {
      const a = Math.ceil(G.shake);
      shx = ((Math.random() * (2 * a + 1)) | 0) - a;
      shy = ((Math.random() * (2 * a + 1)) | 0) - a;
    }
    const ox = this.ox = (W >> 1) - cpx + shx, oy = this.oy = (H >> 1) - cpy + shy;

    // pavimento (pattern ancorato al mondo) + decorazioni della mappa
    this.floorPat = this.floorPats[G.map.floor];
    ctx.setTransform(2, 0, 0, 2, ox * 2, oy * 2);
    ctx.fillStyle = this.floorPat;
    ctx.fillRect(cpx - (W >> 1) - 1, cpy - (H >> 1) - 1, W + 2, H + 2);
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    drawMapLayer('props');
    drawMapLayer('obstacles');
    if (G.map.isle) this.drawSea(S, ox, oy, camX, camY, rt);
    // GOAT (Sicilia, in alto): sagoma tutta nera, il doppio di un boss, ferma
    const goat = G.map.goat, goatS = SPR.cache.goat;
    if (goat && goatS) {
      const gw = goatS.w * goat.scale, gh = goatS.h * goat.scale, gx = Math.round(goat.x * S) + ox, gy = Math.round(goat.y * S) + oy;
      if (gx + gw > 0 && gx - gw < W && gy > -20 && gy - gh < H + 20) {
        ctx.globalAlpha = 0.5; ctx.fillStyle = '#000'; ctx.fillRect(gx - (gw >> 1) + 6, gy - 3, gw - 12, 6); ctx.globalAlpha = 1;
        ctx.drawImage(goatS.img, gx - (gw >> 1), gy - gh + 4, gw, gh);
      }
    }   // Sicilia: spiaggia e mare oltre la costa
    const camp = Camp.here();
    if (camp) Camp.drawGround(ctx, S, ox, oy, rt);   // accampamento del Magister (Cattedrale)

    // culling in unità mondo
    const mx = (W * 0.5 + 24) * U, my = (H * 0.5 + 24) * U;
    const L = camX - mx, R = camX + mx, T = camY - my, B = camY + my;
    const ppx = cpx + ox, ppy = cpy + oy; // player a schermo

    // aura (sotto a tutto)
    for (let i = 0; i < Player.weapons.length; i++) {
      const w = Player.weapons[i];
      if (w.id !== 'aura') continue;
      const r = Math.round(wStats(w).radius * Player.areaMult * S);
      ctx.globalAlpha = w.pulse > 0 ? 0.6 : 0.3;
      this.ditherDisk(ppx, ppy, r, this.pat(w.evolved ? PAL.n : PAL.m));
      ctx.globalAlpha = w.pulse > 0 ? 1 : 0.7;
      this.circle(ppx, ppy, r, w.evolved ? PAL['~'] : PAL.p);
      ctx.globalAlpha = 1;
    }

    // pozze acide
    for (let i = 0; i < Zones.count; i++) {
      if (Zones.alive[i] === 0) continue;
      const zx = Math.round(Zones.x[i] * S) + ox, zy = Math.round(Zones.y[i] * S) + oy;
      const zr = Math.round(Zones.r[i] * S), fade = Zones.life[i] < 0.5 ? Zones.life[i] * 2 : 1;
      const zw = Zones.src[i] >= 0 ? Player.weapons[Zones.src[i]] : null;
      if (zw && zw.special && zw.special.fx === 'sabbione' && zw.id === 'bomb') { this.firePool(zx, zy, zr, fade, rt, i); continue; }
      if (zw && zw.id === 'caltrops') { this.caltrop(zx, zy, zr, fade, zw.evolved, i); continue; }
      if (zw && zw.id === 'meteor') { this.firePool(zx, zy, zr, fade, rt, i); continue; }   // Stelle Cadenti: terra in fiamme
      this.acidPool(Zones.x[i] * S + ox, Zones.y[i] * S + oy, Zones.r[i] * S, fade, rt, i, zw && zw.evolved ? 2 : Zones.slow[i] ? 1 : 0);
    }

    // pozze di veleno (Slime Velenoso)
    const ES0 = EShots;
    for (let i = 0; i < ES0.count; i++) {
      if (ES0.alive[i] === 0 || ES0.kind[i] !== 2) continue;
      const zx = Math.round(ES0.x[i] * S) + ox, zy = Math.round(ES0.y[i] * S) + oy, zr = Math.round(ES0.r[i] * S);
      if (zx < -zr || zx > W + zr || zy < -zr || zy > H + zr) continue;
      const fade = ES0.life[i] < 0.6 ? ES0.life[i] / 0.6 : 1;
      ctx.globalAlpha = 0.6 * fade; this.ditherDisk(zx, zy, zr, this.pat(PAL.R)); ctx.globalAlpha = 0.8 * fade;
      this.circle(zx, zy, zr, PAL.T);
      const b = ((rt * 4 + i * 3) | 0) % 6;
      ctx.fillStyle = PAL.U;
      ctx.fillRect(zx + ((b * 5) % (zr + 1)) - (zr >> 1), zy + ((b * 3) % (zr + 1)) - (zr >> 1), 1, 1);
      ctx.globalAlpha = 1;
    }

    // gemme e monete
    const M = Gems, gs = SPR.cache.gem_s, gm = SPR.cache.gem_m, gl = SPR.cache.gem_l, cs = SPR.cache.coin, hs = SPR.cache.potion, vs = SPR.cache.vacuum;
    const blink = ((rt * 6) | 0) & 1;
    for (let i = 0; i < M.count; i++) {
      if (M.alive[i] === 0) continue;
      const x = M.x[i], y = M.y[i];
      if (x < L || x > R || y < T || y > B) continue;
      const kind = M.kind[i];
      if (kind === GK.XP) {
        const v = M.val[i], s = v >= 20 ? gl : v >= 5 ? gm : gs;
        this.spr(s, s.img, x, y);
      } else if (kind === GK.COIN) {
        this.spr(cs, cs.img, x, y);
      } else {
        // oggetti rari: lampeggiano con un anello attorno per farsi notare
        const s = kind === GK.HEAL ? hs : kind === GK.STONE ? SPR.cache.stone : kind === GK.CHEST ? SPR.cache.chest : vs;
        const sx = Math.round(x * S) + ox, sy = Math.round(y * S) + oy;
        const ring = kind === GK.HEAL ? (blink ? PAL.H : PAL.C) : kind === GK.STONE ? (blink ? PAL.p : PAL.n) : kind === GK.CHEST ? (blink ? PAL.L : PAL.K) : (blink ? PAL.M : PAL.t);
        if (kind === GK.CHEST) { // fascio di luce dorata: si vede da lontano
          ctx.globalAlpha = 0.35; ctx.fillStyle = this.pat(PAL.K); ctx.fillRect(sx - 3, sy - 40, 7, 34); ctx.globalAlpha = 1;
        }
        this.circle(sx, sy, 8 + (((rt * 4) | 0) & 1), ring);
        this.spr(s, s.img, x, y);
      }
    }

    // NOTTE (dal 2026-10-28): niente buio né cerchio di luce, si vede tutto. Il mondo (terreno, ostacoli, pozze, gemme)
    // prende solo colori freddi e scuri: moltiplica per un blu (NIGHT.tint) e poi una velatura blu-notte leggera (NIGHT.haze).
    // I dannati e i boss si disegnano SOPRA, coi loro sprite notturni, così risaltano.
    if (G.nightK > 0) {
      const k = G.nightK;
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = k;
      ctx.fillStyle = NIGHT.tint; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = NIGHT.haze * k;
      ctx.fillStyle = NIGHT.hazeColor; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // nemici: 2 frame di animazione "molle", sagoma bianca quando colpiti
    const E = Enemies, n = E.count, night = G.night, eliteT = ET.elite, ghostT = ET.ghost, cute = !!G.map.cute;
    // zone dei fulmini (sotto ai nemici)
    for (let k = 0; k < Strikes.n; k++) {
      const sx = Math.round(Strikes.x[k] * S) + ox, sy = Math.round(Strikes.y[k] * S) + oy;
      const r = Math.round(BOSS2.strikeR * S), p = 1 - Strikes.t[k] / BOSS2.strikeTell;
      ctx.globalAlpha = 0.25 + p * 0.45; this.ditherDisk(sx, sy, Math.max(1, Math.round(r * p)), this.pat(PAL.n)); ctx.globalAlpha = 1;
      this.circle(sx, sy, r, (((rt * (6 + p * 14)) | 0) & 1) ? PAL[9] : PAL.p);
    }
    this.drawPits(S, ox, oy, 0, rt);   // buchi degli Scavatori (sotto ai nemici)
    // ombre degli slime (passata separata, tutte sotto ai corpi)
    ctx.fillStyle = PAL.k; ctx.globalAlpha = 0.5;
    for (let i = 0; i < n; i++) {
      if (E.alive[i] === 0 || E.big[i] !== 0) continue;
      const x = E.x[i], y = E.y[i];
      if (x < L || x > R || y < T || y > B) continue;
      const rw = Math.round(E.r[i] * S * 0.9);
      ctx.fillRect(Math.round(x * S) + ox - rw, Math.round((y + E.r[i] * 0.7) * S) + oy, rw * 2, 2);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < n; i++) {
      if (E.alive[i] === 0 || E.big[i] !== 0) continue;
      const x = E.px[i] * ia + E.x[i] * alpha, y = E.py[i] * ia + E.y[i] * alpha;
      if (x < L || x > R || y < T || y > B) continue;
      const type = E.type[i], name = ENEMY_DEFS[type].sprite;
      // Sicilia (mappa `cute`): gli slime simpatici verdi, anche di notte
      const s0 = (cute && SPR.cache['cute_' + ENEMY_DEFS[type].id]) || (night && SPR.cache[name + '_d']) || SPR.cache[name];
      const s = s0.m && ((Player.x < x) === (s0.face > 0)) ? s0.m : s0;   // si gira verso di te
      const f = ((t * 5 + E.phase[i]) | 0) & 1;
      let img = E.flash[i] > 0 ? (f ? s.flash2 : s.flash) : (f ? s.img2 : s.img);
      if (s.tell && E.aiS[i] === 1 && (((rt * 16) | 0) & 1)) img = f ? s.tell2 : s.tell; // preavviso carica (Cacciatore, Lupa)
      // mostri disegnati: i piedi poggiano sull'ombra (lo sprite è più alto del cerchio di collisione)
      const ly = s0.art ? y + Math.min(0, Math.round(E.r[i] * 0.7 * S) + 2 - (s.h >> 1)) * U : y;
      if (type === ghostT) { ctx.globalAlpha = 0.55 + 0.25 * Math.sin(rt * 5 + E.phase[i]); this.spr(s, img, x, ly - 4); ctx.globalAlpha = 1; continue; }
      this.spr(s, img, x, ly);
      if (E.frz[i] > 0) this.frozen(x, y, E.r[i], E.frzM[i], rt);
    }
    if (Boss.active) this.drawBoss(alpha, rt);
    this.drawPits(S, ox, oy, 1, rt);   // braccia che escono dai buchi (sopra ai nemici)
    this.drawSkillFx(S, ox, oy);

    // BOTTIGLIE IN VOLO (2026-10-28, alta risoluzione): Ignis = fiasca col fuoco dentro e la miccia accesa,
    // Aqua Stygia = ampolla verde che gocciola. Girano su se stesse lungo la parabola; l'ombra a terra si stringe all'arrivo.
    const P = Projectiles;
    for (let i = 0; i < P.count; i++) {
      const kd = P.kind[i];
      if (P.alive[i] === 0 || (kd !== PK.BOMB && kd !== PK.ACID)) continue;
      const x = P.px[i] * ia + P.x[i] * alpha, y = P.py[i] * ia + P.y[i] * alpha;
      if (x < L || x > R || y < T || y > B) continue;
      const p = 1 - P.life[i] / P.life0[i], hgt = Math.sin(Math.PI * p) * 40, evo = P.evo[i];
      this.bottle(x * S + ox, y * S + oy, hgt * S, p, kd === PK.BOMB, evo, rt, i);
    }

    if (camp) Camp.drawLit(ctx, S, ox, oy, rt);
    // LA MORTE (minuto 14): bianca come un osso, alone nero, sempre sopra al buio
    const ds = SPR.cache.death;
    if (Death.on && G.scene === 'run') {
      const dx0 = Math.round((Death.px * ia + Death.x * alpha) * S) + ox, dy0 = Math.round((Death.py * ia + Death.y * alpha) * S) + oy;
      const sc = ds && ds.head ? DEATH.scale : 1.15;   // la testa è piccola: si disegna grande
      const dw = ds ? Math.round(ds.w * sc) : 30, dh = ds ? Math.round(ds.h * sc) : 40;
      if (dx0 + dw > 0 && dx0 - dw < W && dy0 + dh > 0 && dy0 - dh < H) {
        // alone di fuoco rosa-rosso che pulsa (la testa resta leggibile su qualunque terreno, anche di notte)
        ctx.globalAlpha = 0.45 + 0.15 * Math.sin(rt * 5); this.ditherDisk(dx0, dy0 - 6, Math.round(DEATH.r * S * 2.4), this.pat('#a0123f')); ctx.globalAlpha = 1;
        // la testa fluttua (su e giù) centrata sul punto; la vecchia figura invece poggia i piedi
        const top = ds && ds.head ? dy0 - (dh >> 1) - 6 + Math.round(Math.sin(rt * 2.4) * 3) : dy0 - dh + Math.round(DEATH.r * S);
        ctx.globalAlpha = 0.85 + 0.15 * Math.sin(rt * 9);
        if (ds) ctx.drawImage(Death.face < 0 ? ds.mir : ds.img, dx0 - (dw >> 1), top, dw, dh);
        else this.circle(dx0, dy0, 14, PAL.w);
        // colpita: lampeggia di luce (prende danni dal 2026-10-28)
        const dbi = Death.idx();
        if (ds && dbi >= 0 && Enemies.flash[dbi] > 0) {
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7;
          ctx.drawImage(Death.face < 0 ? ds.mir : ds.img, dx0 - (dw >> 1), top, dw, dh);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.globalAlpha = 1;
      }
    }       // la lanterna del Magister si vede anche di notte

    // ARCIERI che tendono l'arco: linea di mira tratteggiata (rossa mentre ti segue, bianca e fitta quando è bloccata).
    // Sta sopra al velo della notte: il pericolo si vede sempre.
    {
      const SPT = ET.spitter, len = Math.round(SPIT.range * 1.15 * S);
      for (let i = 0; i < n; i++) {
        if (E.alive[i] === 0 || E.type[i] !== SPT || E.aiS[i] !== 1) continue;
        const ax = Math.round((E.px[i] * ia + E.x[i] * alpha) * S) + ox, ay = Math.round((E.py[i] * ia + E.y[i] * alpha) * S) + oy;
        if (ax < -len || ax > W + len || ay < -len || ay > H + len) continue;
        const locked = E.aiT[i] <= SPIT.lock, ux = E.ddx[i], uy = E.ddy[i];
        // trattini da 2 pixel con l'ombra nera (si leggono anche sull'erba); bloccata = bianca e fitta
        const gap = locked ? 3 : 5, off = locked ? 0 : ((rt * 20) | 0) % gap;   // i trattini scorrono verso di te
        for (let q = 10 + off; q <= len; q += gap) {
          const x1 = ax + Math.round(ux * q), y1 = ay + Math.round(uy * q), x2 = ax + Math.round(ux * (q + 1)), y2 = ay + Math.round(uy * (q + 1));
          ctx.fillStyle = PAL.k; ctx.fillRect(x1 + 1, y1 + 1, 1, 1); ctx.fillRect(x2 + 1, y2 + 1, 1, 1);
          ctx.fillStyle = locked ? PAL.w : PAL.D; ctx.fillRect(x1, y1, 1, 1); ctx.fillRect(x2, y2, 1, 1);
        }
        // la corda che si tende: un puntino che arretra verso l'arciere
        const p = 1 - Math.max(0, E.aiT[i]) / SPIT.tell;
        ctx.fillStyle = PAL.P; ctx.fillRect(ax + Math.round(ux * (10 - p * 6)) - 1, ay + Math.round(uy * (10 - p * 6)) - 1, 2, 2);
      }
    }

    // player
    const ps = Player.frame(rt);
    const bob = !Player.anim && Player.moving && (((rt * 8) | 0) & 1) ? 1 : 0;   // chi non ha la corsa animata "saltella"
    // il personaggio (e le copie del teletrasporto) si disegnano dopo, in alta risoluzione: qui si prepara la richiesta
    const PD = this.pd;
    PD.n = 0; PD.trail = 0;
    for (let k = 0; k < Player.trailN; k++) {
      PD.tx[k] = Math.round(Player.trailX[k] * S) + ox; PD.ty[k] = Math.round(Player.trailY[k] * S) + oy;
      PD.ta[k] = Math.max(0, Player.trailT[k] / 0.3) * 0.55; PD.tf[k] = Player.trailF[k];
    }
    PD.trail = Player.trailN; PD.e = ps;
    PD.npc = camp ? Camp.hd(S, ox, oy, rt) : null;   // il Magister (alta risoluzione, sotto al personaggio)
    PD.starN = 0;                                     // stelle di Cocito (le riempie il disegno delle ampolle qui sotto)
    const left = Player.facing < 0, hurt = Player.hurtT > 0;
    // nel menu la camera scorre da sola sulla mappa: niente personaggio
    const showMe = G.scene !== 'menu';
    // alone scuro: stacca l'alchimista dagli slime attorno
    if (showMe) {
      ctx.globalAlpha = 0.6;
      this.ditherDisk(ppx, ppy + 2, 12, PAL.k);
      ctx.globalAlpha = 1;
      this.circle(ppx, ppy + 2, 13, Player.slowT > 0 ? ((((rt * 6) | 0) & 1) ? PAL.z : PAL.y) : PAL[4]); // gambe congelate: anello azzurro
    }
    // durante l'invulnerabilità lampeggia; morendo diventa una sagoma chiara e poi esplode
    const dying = G.state === 'dying' || (G.state === 'dead' && !G.won);
    const invBlink = Player.invT > 0 && !hurt && Player.trailN === 0 && (((rt * 20) | 0) & 1);  // durante il teletrasporto niente lampeggio
    if (dying) {
      if (G.state === 'dying' && G.dyingT > 1.15) { PD.n = 1; PD.img = (((rt * 14) | 0) & 1) ? ps.flash : (left ? ps.mirFlash : ps.hurtImg); PD.x = ppx; PD.y = ppy; }
      else if (!this._burst && G.state === 'dying') {
        this._burst = true;
        for (let q = 0; q < 8; q++) { const f = spawnFx(FXK.SPLAT, Player.x + (Math.random() - 0.5) * 20, Player.y + (Math.random() - 0.5) * 20, 0.9, 30); if (f >= 0) FX.val[f] = -1; }
        spawnFx(FXK.RING, Player.x, Player.y, 0.6, 90);
      }
    } else {
      this._burst = false;
      if (!invBlink) { PD.n = 1; PD.img = left ? (hurt ? ps.mirFlash : ps.mir) : (hurt ? ps.hurtImg : ps.img); PD.x = ppx; PD.y = ppy - bob; }
    }
    if (!showMe) { PD.n = 0; PD.trail = 0; }

    // ampolle orbitanti
    const os = SPR.cache.orb;
    for (let i = 0; i < Player.weapons.length; i++) {
      const w = Player.weapons[i];
      if (w.id !== 'orbit') continue;
      // BUG risolto: si disegnavano st.amount ampolle, ma ne colpiscono amt(st) (Gemelli): quelle in più erano invisibili
      const st = wStats(w), no = amt(st), step = Math.PI * 2 / no, R2 = st.radius * Player.areaMult;
      if (w.special && w.special.fx === 'stelle') {
        // STELLE DI COCITO: stelle di ghiaccio in alta risoluzione (le disegna present) + scia di brina
        const PD0 = this.pd;
        for (let k = 0; k < no && PD0.starN < 16; k++) {
          const a = w.angle + k * step;
          for (let q = 1; q <= 4; q++) {
            const b = a - q * 0.09;
            ctx.fillStyle = q < 3 ? PAL[']'] : PAL['{'];
            ctx.fillRect(Math.round((camX + Math.cos(b) * R2) * S) + ox, Math.round((camY + Math.sin(b) * R2) * S) + oy, q < 2 ? 2 : 1, q < 2 ? 2 : 1);
          }
          PD0.sx[PD0.starN] = Math.round((camX + Math.cos(a) * R2) * S) + ox; PD0.sy[PD0.starN] = Math.round((camY + Math.sin(a) * R2) * S) + oy;
          PD0.starN++;
        }
        PD0.starF = ((rt * 5) | 0) & 1;
        continue;
      }
      for (let k = 0; k < no; k++) {
        const a = w.angle + k * step;
        if (w.evolved) { // scia
          ctx.fillStyle = PAL.s;
          const a2 = a - 0.25;
          ctx.fillRect(Math.round((camX + Math.cos(a2) * R2) * S) + ox, Math.round((camY + Math.sin(a2) * R2) * S) + oy, 2, 2);
        }
        this.spr(os, w.evolved ? os.neon : os.img, camX + Math.cos(a) * R2, camY + Math.sin(a) * R2);
      }
    }

    // raggi del Lume: nucleo bianco, alone dorato, scia a retino appena dietro
    for (let i = 0; i < Player.weapons.length; i++) {
      const w = Player.weapons[i];
      if (w.id !== 'beam') continue;
      const st = wStats(w), nb = amt(st), Rb = Math.round(st.range * Player.areaMult * S), step = Math.PI * 2 / nb;
      for (let k = 0; k < nb; k++) {
        const a = w.angle + k * step, ca = Math.cos(a), sa = Math.sin(a), nx = -Math.round(sa), ny = Math.round(ca);
        ctx.fillStyle = PAL.K;
        for (let q = 9; q < Rb; q += 3) { const b = a - 0.1 - (q & 1) * 0.04; ctx.fillRect(ppx + Math.round(Math.cos(b) * q), ppy + Math.round(Math.sin(b) * q), 1, 1); }
        for (let q = 7; q <= Rb; q++) {
          const x = ppx + Math.round(ca * q), y = ppy + Math.round(sa * q);
          if (w.evolved) { ctx.fillStyle = PAL['~']; ctx.fillRect(x + nx, y + ny, 1, 1); ctx.fillRect(x - nx, y - ny, 1, 1); }   // evoluta: bordi neon su tutti e due i lati
          else { ctx.fillStyle = PAL.L; ctx.fillRect(x + nx, y + ny, 1, 1); if (q & 1) ctx.fillRect(x - nx, y - ny, 1, 1); }
          ctx.fillStyle = w.evolved ? PAL[4] : q > Rb - 4 ? PAL.w : PAL[9]; ctx.fillRect(x, y, 1, 1);   // evoluta: nucleo scuro tra i due bordi neon
        }
        const tx = ppx + Math.round(ca * Rb), ty = ppy + Math.round(sa * Rb);
        ctx.fillStyle = w.evolved ? PAL['~'] : PAL.w; ctx.fillRect(tx - 1, ty, 3, 1); ctx.fillRect(tx, ty - 1, 1, 3);
      }
    }

    // cristalli di sale e frecce (sprite pre-ruotati in 16 direzioni)
    const ss = Player.kunai ? SPR.cache.proj_kunai : SPR.cache.proj_salt, ars = SPR.cache.proj_arrow;
    for (let i = 0; i < P.count; i++) {
      const kd = P.kind[i];
      if (P.alive[i] === 0 || (kd !== PK.SALT && kd !== PK.ARROW)) continue;
      const x = P.px[i] * ia + P.x[i] * alpha, y = P.py[i] * ia + P.y[i] * alpha;
      if (x < L || x > R || y < T || y > B) continue;
      const img = kd === PK.SALT ? (P.evo[i] ? ss.neonRot : ss.rot)[P.rot[i]] : ars.rot[P.rot[i]];
      ctx.drawImage(img, Math.round(x * S) + ox - (img.width >> 1), Math.round(y * S) + oy - (img.height >> 1));
    }
    // falci di luna e asce (girano su se stesse) e fuochi fatui (con scia)
    const sc = SPR.cache.proj_scythe, wsp = SPR.cache.wisp, wse = SPR.cache.wisp_evo, axs = SPR.cache.proj_axe, whl = SPR.cache.proj_wheel;
    for (let i = 0; i < P.count; i++) {
      const kd = P.kind[i];
      if (P.alive[i] === 0 || (kd !== PK.SCYTHE && kd !== PK.WISP && kd !== PK.AXE && kd !== PK.WHEEL)) continue;
      const x = P.px[i] * ia + P.x[i] * alpha, y = P.py[i] * ia + P.y[i] * alpha;
      if (x < L || x > R || y < T || y > B) continue;
      const sx = Math.round(x * S) + ox, sy = Math.round(y * S) + oy;
      if (kd === PK.SCYTHE || kd === PK.AXE || kd === PK.WHEEL) {
        const spin = kd === PK.AXE ? (P.vx[i] > 0 ? 18 : -18) : kd === PK.WHEEL ? 30 : 24;
        const src = kd === PK.AXE ? axs.rot : kd === PK.WHEEL ? (P.evo[i] ? whl.neonRot : whl.rot) : P.evo[i] ? sc.neonRot : sc.rot;
        const img = src[((((rt * spin) | 0) + i) % 16 + 16) & 15], sz = P.size[i];
        const w = Math.round(img.width * sz), h = Math.round(img.height * sz);
        ctx.drawImage(img, sx - (w >> 1), sy - (h >> 1), w, h);
      } else {
        // Linguae Ignis: scia di fumo nero e una scintilla gialla (bianca se evoluta) che sfarfalla
        const v = Math.sqrt(P.vx[i] * P.vx[i] + P.vy[i] * P.vy[i]) || 1, ux = P.vx[i] / v, uy = P.vy[i] / v;
        ctx.fillStyle = PAL[1]; ctx.fillRect(sx - Math.round(ux * 4), sy - Math.round(uy * 4), 2, 2);
        if (((rt * 16 + i) | 0) & 1) { ctx.fillStyle = P.evo[i] ? PAL.w : PAL.Y; ctx.fillRect(sx - Math.round(ux * 7), sy - Math.round(uy * 7), 1, 1); }
        const fs = P.evo[i] ? wse : wsp;
        ctx.drawImage(fs.img, sx - (fs.w >> 1), sy - (fs.h >> 1) - (((rt * 10 + i) | 0) & 1));
      }
    }
    this.weaponGlow(P, ia, alpha, S, ox, oy, L, R, T, B, rt, camX, camY, ppx, ppy);
    this.drawMeteors(S, ox, oy, rt);
    // Vite Aerea: scia dorata lungo la spirale (punteggiata) + elica a due pale che gira
    for (let i = 0; i < P.count; i++) {
      if (P.alive[i] === 0 || P.kind[i] !== PK.HELIX) continue;
      const x = P.px[i] * ia + P.x[i] * alpha, y = P.py[i] * ia + P.y[i] * alpha;
      if (x < L || x > R || y < T || y > B) continue;
      const sx = Math.round(x * S) + ox, sy = Math.round(y * S) + oy, D = WEAPON_DEFS.helix;
      const dir = P.split[i] < 0 ? -1 : 1, th = P.tgt[i], th0 = P.aoe[i];
      const hx = sx - Math.round((Player.px * ia + Player.x * alpha) * S) - ox, hy = sy - Math.round((Player.py * ia + Player.y * alpha) * S) - oy;
      const rh = Math.sqrt(hx * hx + hy * hy) || 1, stepA = 3 / rh; // un puntino ogni ~3 px di spirale
      for (let q = 1; q <= 12; q++) {
        const tq = th - dir * q * stepA;
        if ((tq - th0) * dir < 0) break;
        if (q > 6 && (q & 1)) continue;
        const rq = D.r0 * Math.pow(D.phi, Math.abs(tq - th0) * 0.63662) * S;
        ctx.fillStyle = q < 4 ? PAL.L : q < 8 ? PAL.K : PAL.h;
        ctx.fillRect(sx - hx + Math.round(Math.cos(tq) * rq), sy - hy + Math.round(Math.sin(tq) * rq), q < 4 ? 2 : 1, q < 4 ? 2 : 1);
      }
      // elica: due pale con contorno nero, mozzo bianco
      const l = Math.max(3, Math.round(P.size[i] * S * 0.9)), spin = rt * 22 * dir + i;
      const bx = Math.cos(spin), by = Math.sin(spin) * 0.6;
      ctx.fillStyle = P.evo[i] ? PAL['~'] : PAL.k;   // evoluta: il contorno delle pale è neon
      for (let q = -l - 1; q <= l + 1; q++) ctx.fillRect(sx + Math.round(bx * q) - 1, sy + Math.round(by * q) - 1, 3, 3);
      for (let q = -l; q <= l; q++) {
        ctx.fillStyle = Math.abs(q) >= l - 1 ? PAL.w : (q > 0 ? PAL.L : PAL.K);
        ctx.fillRect(sx + Math.round(bx * q), sy + Math.round(by * q), 1, 2);
      }
      ctx.fillStyle = PAL.w; ctx.fillRect(sx, sy, 1, 1);
    }

    // turbini della Bufera: anelli di vento che girano, più larghi in alto, con le anime trascinate
    for (let i = 0; i < P.count; i++) {
      if (P.alive[i] === 0 || P.kind[i] !== PK.STORM) continue;
      const x = P.px[i] * ia + P.x[i] * alpha, y = P.py[i] * ia + P.y[i] * alpha;
      if (x < L - 60 || x > R + 60 || y < T - 60 || y > B + 60) continue;
      const sx = Math.round(x * S) + ox, sy = Math.round(y * S) + oy, r = P.r[i] * S;
      const fade = Math.min(1, P.life[i] / 0.4, (P.life0[i] - P.life[i]) / 0.2);
      ctx.globalAlpha = 0.35 * fade; this.ditherDisk(sx, sy + Math.round(r * 0.35), Math.max(2, Math.round(r * 0.8)), this.pat(PAL.k));
      ctx.globalAlpha = fade;
      const spin = rt * 9 + i, evo = P.evo[i];   // evoluta: bordo in cima e in fondo neon, il vortice resta scuro
      const sw = P.src[i] >= 0 ? Player.weapons[P.src[i]] : null;
      if (sw && sw.special && sw.special.fx === 'lucifero') { this.iceStorm(sx, sy, r, spin, fade, i, rt); ctx.globalAlpha = 1; continue; }
      for (let j = 0; j < 6; j++) {
        const f = j / 5, rx = r * (0.25 + 0.75 * f), ry = Math.max(1, rx * 0.3);
        const cy = sy + r * 0.35 - f * r * 1.4, cx = sx + Math.round(Math.sin(spin * 0.5 + j * 0.9) * (1 + f * 2));
        const N = Math.max(10, Math.round(rx * 3));
        for (let q = 0; q < N; q++) {
          const a = q / N * 6.2832 + spin * (1 + f * 0.5), front = Math.sin(a) > 0;
          if (!front && (q & 1)) continue;
          ctx.fillStyle = evo ? (front && (j === 0 || j === 5) ? PAL['~'] : front ? PAL[7] : PAL[5]) : front ? (j > 3 ? PAL[9] : PAL[8]) : PAL[6];
          ctx.fillRect(cx + Math.round(Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
        }
      }
      ctx.fillStyle = P.kb[i] < 0 ? PAL.p : PAL.n;
      for (let q = 0; q < 3; q++) { const a = spin * 1.3 + q * 2.1; ctx.fillRect(sx + Math.round(Math.cos(a) * r * 0.7), sy - Math.round(r * (0.1 + 0.35 * q)) + Math.round(Math.sin(a) * r * 0.2), 2, 2); }
      ctx.globalAlpha = 1;
    }

    // proiettili dei nemici
    const gl1 = SPR.cache.glob, eb = SPR.cache[G.map.b3 && G.map.b3.bullet] || SPR.cache.ebullet, fb = SPR.cache.fireball, ES = EShots;
    for (let i = 0; i < ES.count; i++) {
      if (ES.alive[i] === 0) continue;
      const x = ES.px[i] * ia + ES.x[i] * alpha, y = ES.py[i] * ia + ES.y[i] * alpha;
      if (x < L || x > R || y < T || y > B) continue;
      if (ES.kind[i] === 2) continue; // pozze: disegnate sotto
      if (ES.kind[i] === 4) {   // freccia dell'Arciere: alone rosso, scia, sprite grosso ruotato
        const sx = Math.round(x * S) + ox, sy = Math.round(y * S) + oy, v = Math.sqrt(ES.vx[i] * ES.vx[i] + ES.vy[i] * ES.vy[i]) || 1;
        const ux = ES.vx[i] / v, uy = ES.vy[i] / v;
        ctx.globalAlpha = 0.5; this.ditherDisk(sx, sy, 8, this.pat(PAL.C)); ctx.globalAlpha = 1;
        for (let q = 8; q <= 26; q += 2) { ctx.fillStyle = q < 16 ? PAL.D : PAL.B; ctx.fillRect(sx - Math.round(ux * q), sy - Math.round(uy * q), 1, 1); }
        const img = SPR.cache.eb_arrow.rot[((Math.atan2(uy, ux) / 6.2832 * 16 + 16.5) | 0) & 15];
        ctx.drawImage(img, sx - (img.width >> 1), sy - (img.height >> 1));
        continue;
      }
      const sp = ES.kind[i] === 1 ? eb : ES.kind[i] === 3 ? fb : gl1;
      this.spr(sp, sp.img, x, y);
    }

    // effetti
    for (let i = 0; i < FX.count; i++) {
      if (FX.alive[i] === 0) continue;
      const k = FX.kind[i], p = 1 - FX.life[i] / FX.life0[i];
      const x = Math.round(FX.x[i] * S) + ox, y = Math.round(FX.y[i] * S) + oy;
      if (k === FXK.BOLT) {
        if (p > 0.6 && (((rt * 30) | 0) & 1)) continue; // sfarfallio finale
        const bs = FX.val[i];
        this.bolt(Math.round(FX.x2[i] * S) + ox, Math.round(FX.y2[i] * S) + oy, x, y, FX.seed[i], FX.evo[i], bs, p);
        if (p < 0.5) { ctx.globalAlpha = 0.6; this.ditherDisk(x, y, Math.round(FX.r[i] * S), this.pat(bs === 1 ? PAL[1] : bs === 2 ? PAL.K : PAL.n)); ctx.globalAlpha = 1; }
      } else if (k === FXK.SLASH) {
        // fendente del Pugio: la lama gira attorno a te (con due copie sbiadite) e lascia una mezzaluna tagliente.
        // I colpi alternano il verso; il terzo della combo è più largo, con doppia scia e lampo sulla punta.
        const R = FX.r[i] * S, a0 = Math.atan2(FX.y2[i], FX.x2[i]), arc = Math.abs(FX.val[i]), dir = FX.val[i] < 0 ? -1 : 1, fin = FX.seed[i] === 1;
        const px0 = Math.round(Player.x * S) + ox, py0 = Math.round(Player.y * S) + oy; // segue il personaggio
        const sw = Math.min(1, p / 0.55), head = 1 - (1 - sw) * (1 - sw) * (1 - sw);   // la lama scatta e frena
        const tail = p < 0.55 ? Math.max(0, head - 0.6) : head - 0.6 * (1 - (p - 0.55) / 0.45);
        const ang = (f) => a0 + dir * (-arc * 0.5 + arc * f);
        const steps = Math.max(16, Math.ceil(arc * R * 1.4));   // un passo per pixel d'arco: niente "raggi" vuoti
        for (let q = 0; q <= steps; q++) {
          const f = q / steps;
          if (f > head || f < tail) continue;
          const a = ang(f), age = Math.min(1, (head - f) / 0.6), ca = Math.cos(a), sa = Math.sin(a);
          const thick = Math.max(1, (1 - age) * R * 0.24 + 1);
          for (let r = R - thick; r <= R + 0.5; r += 1) {
            const edge = r > R - 1.2;
            if (!edge && (age > 0.3 || r < R - 3) && ((q + (r | 0)) & 1)) continue;   // dentro e in coda la scia è a retino
            ctx.fillStyle = edge ? (age < 0.35 ? PAL.w : PAL[9]) : (age < 0.3 ? PAL[9] : age < 0.65 ? PAL[7] : PAL[5]);
            ctx.fillRect(px0 + Math.round(ca * r), py0 + Math.round(sa * r), 1, 1);
          }
          if (fin && age < 0.75 && (q % 3) === 0) {                            // seconda scia interna
            ctx.fillStyle = age < 0.3 ? PAL[9] : PAL[7];
            ctx.fillRect(px0 + Math.round(ca * R * 0.62), py0 + Math.round(sa * R * 0.62), 1, 1);
          }
        }
        if (head > tail) {                                                      // mezzaluna liscia in alta risoluzione sopra al retino
          const a1 = ang(tail), a2 = ang(head), ccw = dir < 0, th = R * (fin ? 0.3 : 0.22) * (1 - p * 0.6);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.35 * (1 - p); ctx.fillStyle = '#dff4ff';
          ctx.beginPath(); ctx.arc(px0, py0, R + 0.5, a1, a2, ccw); ctx.arc(px0, py0, R - th, a2, a1, !ccw); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 0.9 * (1 - p); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(px0, py0, R, a1 + (a2 - a1) * 0.5, a2, ccw); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        }
        if (p < 0.8) {                                                          // la lama e le sue copie sbiadite
          const bs = SPR.cache.fx_pugio, dist = Math.max(4, R - 7);
          for (let g = 2; g >= 0; g--) {
            const f = head - g * 0.1;
            if (f < 0) continue;
            const a = ang(f), img = bs.rot[((a / (Math.PI * 2) * 16 + 16.5) | 0) & 15];
            ctx.globalAlpha = (g === 0 ? 1 : g === 1 ? 0.45 : 0.2) * (p > 0.6 ? 1 - (p - 0.6) / 0.2 : 1);
            ctx.drawImage(img, px0 + Math.round(Math.cos(a) * dist) - (img.width >> 1), py0 + Math.round(Math.sin(a) * dist) - (img.height >> 1));
          }
          ctx.globalAlpha = 1;
        }
        if (p < 0.5) {                                                          // bagliore sulla punta
          const a = ang(head), hx = px0 + Math.round(Math.cos(a) * R), hy = py0 + Math.round(Math.sin(a) * R), l = fin ? 3 : 2;
          ctx.fillStyle = PAL.w;
          ctx.fillRect(hx - l, hy, l * 2 + 1, 1); ctx.fillRect(hx, hy - l, 1, l * 2 + 1);
        }
      } else if (k === FXK.SPARK) {
        // scintilla dove la lama morde
        const l = Math.round(3 * (1 - p)) + 1;
        ctx.fillStyle = p < 0.4 ? PAL.w : PAL[9];
        ctx.fillRect(x - l, y, 2 * l + 1, 1); ctx.fillRect(x, y - l, 1, 2 * l + 1);
        if (p < 0.5) { ctx.fillStyle = PAL[8]; ctx.fillRect(x - 2, y - 2, 1, 1); ctx.fillRect(x + 2, y + 2, 1, 1); ctx.fillRect(x + 2, y - 2, 1, 1); ctx.fillRect(x - 2, y + 2, 1, 1); }
      } else if (k === FXK.WHIP) {
        // sferzata: la frusta si srotola di lato, un'onda le corre lungo fino alla punta, poi lo schiocco
        const side = FX.x2[i], R = FX.r[i] * S, hh = FX.val[i] * S;
        const px0 = Math.round(Player.x * S) + ox, py0 = Math.round((Player.y + FX.y2[i]) * S) + oy;
        // 2026-10-28: rifatta in alta risoluzione. Cuoio intrecciato che si assottiglia, scia del colpo, schiocco con raggi e onda.
        const ext = p < 0.35 ? 1 - Math.pow(1 - p / 0.35, 3) : 1, len = R * ext, evo = FX.evo[i];
        const amp = (2 + hh * 0.4) * (1 - p * 0.8), fade = p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1;
        // scia del colpo: ventaglio chiaro dietro alla frusta
        if (p < 0.35) {
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.22 * (1 - p / 0.35); ctx.fillStyle = evo ? '#ff5fe0' : '#ffd9a0';
          ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px0 + side * len, py0 - hh); ctx.lineTo(px0 + side * len, py0 + hh); ctx.closePath(); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
        // la frusta: 28 tratti sempre più sottili (contorno scuro, cuoio, riflesso)
        const N = 28; ctx.lineCap = 'round';
        for (let pass = 0; pass < 3; pass++) {
          ctx.strokeStyle = pass === 0 ? '#1a0e08' : pass === 1 ? (evo ? '#5a1a4a' : '#7a4528') : (evo ? '#ff5fe0' : '#c08850');
          ctx.globalAlpha = fade * (pass === 2 ? 0.8 : 1);
          let lx = px0, ly = py0;
          for (let q = 1; q <= N; q++) {
            const f = q / N, d = len * f, wy = py0 + Math.sin(d * 0.2 - p * 18) * amp * f, nx = px0 + side * d;
            const th = 3.2 * (1 - f * 0.8);
            ctx.lineWidth = pass === 0 ? th + 1.2 : pass === 1 ? th : th * 0.35;
            ctx.beginPath(); ctx.moveTo(lx, ly - (pass === 2 ? th * 0.25 : 0)); ctx.lineTo(nx, wy - (pass === 2 ? th * 0.25 : 0)); ctx.stroke();
            if (pass === 1 && (q & 1) && f < 0.8) { ctx.save(); ctx.strokeStyle = '#3a1e10'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(nx - th * 0.4, wy - th * 0.4); ctx.lineTo(nx + th * 0.2, wy + th * 0.4); ctx.stroke(); ctx.restore(); }   // intreccio
            lx = nx; ly = wy;
          }
        }
        // impugnatura
        ctx.globalAlpha = fade; ctx.fillStyle = '#2a1a10'; ctx.fillRect(px0 - 2, py0 - 2, 4, 4);
        ctx.fillStyle = evo ? '#ff5fe0' : '#d8b04a'; ctx.fillRect(px0 - 1, py0 - 1, 2, 2);
        ctx.lineCap = 'butt'; ctx.globalAlpha = 1;
        // SCHIOCCO sulla punta: lampo, 8 raggi e un'onda che si allarga
        if (p > 0.28 && p < 0.7) {
          const c = (p - 0.28) / 0.42, tx = px0 + side * len, ty = py0 + Math.sin(len * 0.2 - p * 18) * amp;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 1 - c; ctx.strokeStyle = evo ? '#ff5fe0' : '#fff2c0'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(tx, ty, 3 + c * 14, 0, 6.2832); ctx.stroke();
          ctx.lineWidth = 1; ctx.beginPath();
          for (let q = 0; q < 8; q++) { const a = q * 0.785 + 0.39, r1 = 2 + c * 4, r2 = 6 + c * 10 - (q & 1) * 3; ctx.moveTo(tx + Math.cos(a) * r1, ty + Math.sin(a) * r1); ctx.lineTo(tx + Math.cos(a) * r2, ty + Math.sin(a) * r2); }
          ctx.stroke();
          if (c < 0.4) { ctx.globalAlpha = 1 - c / 0.4; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(tx, ty, 3.5, 0, 6.2832); ctx.fill(); }
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        }
      } else if (k === FXK.NOVA) {
        // onda di gelo: anello azzurro che si allarga con le schegge di ghiaccio
        const e = 1 - (1 - p) * (1 - p), r = Math.max(2, Math.round(FX.r[i] * S * e));
        const px0 = Math.round(Player.x * S) + ox, py0 = Math.round(Player.y * S) + oy;
        if (p < 0.6) { ctx.globalAlpha = 0.3 * (1 - p / 0.6); this.ditherDisk(px0, py0, r, this.pat(PAL['{'])); }
        ctx.globalAlpha = 1 - p * 0.7;
        this.circle(px0, py0, r, FX.evo[i] ? PAL['~'] : PAL[']']);
        if (r > 3) this.circle(px0, py0, r - 1, PAL['{']);
        ctx.fillStyle = PAL.w;
        for (let q = 0; q < 12; q++) { const a = q * 0.5236 + FX.seed[i]; ctx.fillRect(px0 + Math.round(Math.cos(a) * r), py0 + Math.round(Math.sin(a) * r), 2, 2); }
        ctx.globalAlpha = 1;
      } else if (k === FXK.THRUST) {
        // affondo di lancia: asta che scatta in avanti e torna, con scia chiara
        const dx = FX.x2[i], dy = FX.y2[i], R = FX.r[i] * S, hw = Math.max(1, Math.round(FX.val[i] * S * 0.35));
        const px0 = Math.round(Player.x * S) + ox, py0 = Math.round(Player.y * S) + oy;
        const ext = p < 0.35 ? p / 0.35 : 1 - (p - 0.35) / 0.65 * 0.6;
        const len = Math.round(R * ext);
        for (let q = 4; q <= len; q++) {
          const cx = px0 + Math.round(dx * q), cy = py0 + Math.round(dy * q);
          ctx.fillStyle = q > len - 5 ? PAL.w : (p < 0.4 ? PAL[9] : PAL[7]);
          ctx.fillRect(cx, cy, 1, 1);
          if (q > len - 6 && q < len - 1) { ctx.fillRect(cx - Math.round(dy * 2), cy + Math.round(dx * 2), 1, 1); ctx.fillRect(cx + Math.round(dy * 2), cy - Math.round(dx * 2), 1, 1); }
          if (p < 0.3 && (q & 1)) { ctx.fillStyle = PAL[6]; ctx.fillRect(cx - Math.round(dy * hw), cy + Math.round(dx * hw), 1, 1); ctx.fillRect(cx + Math.round(dy * hw), cy - Math.round(dx * hw), 1, 1); }
        }
      } else if (k === FXK.RING) {
        // onda del level up: anello chiaro che si allarga e si sgrana
        const r = Math.max(2, Math.round(FX.r[i] * S * (0.15 + 0.85 * Math.sqrt(p))));
        ctx.globalAlpha = 1 - p;
        this.circle(x, y, r, p < 0.4 ? PAL.w : PAL[9]);
        if (r > 4) this.circle(x, y, r - 2, PAL.u);
        if (p < 0.5) { ctx.globalAlpha = 0.35 * (1 - p * 2); this.ditherDisk(x, y, r, this.pat(PAL.u)); }
        ctx.globalAlpha = 1;
      } else if (k === FXK.PUFF) {
        // sbuffo grigio (schivata, pozza che si apre, colpo su colonna)
        const r = Math.max(1, Math.round(FX.r[i] * S * (0.5 + p)));
        ctx.globalAlpha = 1 - p; this.circle(x, y, r, PAL[7]);
        if (r > 3) this.circle(x, y, r - 2, PAL[5]);
        ctx.globalAlpha = 1;
      } else if (k === FXK.SPLAT) {
        // schizzi di slime: 7 gocce che volano via e si rimpiccioliscono
        const col = FX.val[i] < 0 ? (FX.seed[i] & 1 ? PAL.L : PAL[5]) : PAL[ENEMY_DEFS[FX.val[i]].splat], seed = FX.seed[i];
        const dist = (FX.r[i] * S * 0.6 + 7) * (1 - (1 - p) * (1 - p));
        const sz = p < 0.5 ? 2 : 1;
        ctx.fillStyle = col;
        for (let q = 0; q < 7; q++) {
          const a = seed * 0.37 + q * 0.898;
          const dd = dist * (0.6 + ((seed + q * 37) % 10) * 0.05);
          ctx.fillRect(x + Math.round(Math.cos(a) * dd), y + Math.round(Math.sin(a) * dd + p * p * 4), sz, sz);
        }
        if (p < 0.25) { ctx.fillStyle = PAL[7]; ctx.fillRect(x - 1, y - 1, 3, 3); }
      } else if (k === FXK.NUM) {
        if (p > 0.75 && (((rt * 24) | 0) & 1)) continue;
        this.number(x, y - Math.round(p * 10), FX.val[i], FX.r[i] === 1);
      } else if (k === FXK.GLINT) {
        // impatto degli Strali di Giove: anello d'oro che si allarga + stella a 8 raggi + lampo bianco
        const r = Math.max(2, Math.round(FX.r[i] * S * (0.35 + 0.9 * p))), rr = Math.round(r * (1.4 - p * 0.6));
        if (p < 0.3) { ctx.globalAlpha = 0.5; this.ditherDisk(x, y, Math.round(r * 0.8), this.pat(PAL.Z)); ctx.globalAlpha = 1; }
        this.circle(x, y, r, p < 0.5 ? PAL.L : PAL.K);
        if (p < 0.7) {
          ctx.fillStyle = p < 0.35 ? PAL.w : PAL.Z;
          ctx.fillRect(x - rr, y, rr * 2 + 1, 1); ctx.fillRect(x, y - rr, 1, rr * 2 + 1);
          const d = Math.round(rr * 0.55);
          for (let q = 1; q <= d; q += 2) { ctx.fillRect(x + q, y + q, 1, 1); ctx.fillRect(x - q, y - q, 1, 1); ctx.fillRect(x + q, y - q, 1, 1); ctx.fillRect(x - q, y + q, 1, 1); }
        }
        if (p < 0.2) { ctx.fillStyle = PAL.w; ctx.fillRect(x - 1, y - 1, 3, 3); }
      } else if (k === FXK.FLARE) {
        // scoppio di Linguae Ignis: fumo nero, anello giallo, lampo bianco al centro
        const r = Math.max(1, Math.round(FX.r[i] * S * (0.45 + 0.55 * p)));
        if (p < 0.55) { ctx.globalAlpha = 0.75; this.ditherDisk(x, y, r, this.pat(PAL[1])); ctx.globalAlpha = 1; }
        this.circle(x, y, r, p < 0.6 ? PAL.Y : PAL[3]);
        if (p < 0.4) this.circle(x, y, Math.max(1, (r * 0.45) | 0), PAL.w);
      } else if (k === FXK.BOOM) {
        // ESPLOSIONE (2026-10-28, alta risoluzione): lampo, palla di fuoco a strati, onda d'urto, schegge, fumo che sale
        const R0 = FX.r[i] * S, e = 1 - (1 - p) * (1 - p), fx = FX.x[i] * S + ox, fy = FX.y[i] * S + oy, sd = FX.seed[i], evo = FX.evo[i];
        const TAU = 6.2832;
        // fumo (sotto): 5 sbuffi grigi che salgono e si allargano
        if (p > 0.2) {
          ctx.fillStyle = '#2a2224';
          for (let q = 0; q < 5; q++) { const a = sd + q * 1.256, d = R0 * 0.45 * e; ctx.globalAlpha = 0.45 * (1 - p); ctx.beginPath(); ctx.arc(fx + Math.cos(a) * d, fy + Math.sin(a) * d * 0.6 - p * R0 * 0.5, R0 * (0.2 + 0.25 * p), 0, TAU); ctx.fill(); }
        }
        ctx.globalCompositeOperation = 'lighter';
        // palla di fuoco: rosso scuro fuori, arancio, giallo dentro (si spegne dal centro)
        const fr = R0 * (0.35 + 0.65 * e);
        ctx.globalAlpha = 0.55 * (1 - p); ctx.fillStyle = evo ? '#8a1a6a' : '#a8240c'; ctx.beginPath(); ctx.arc(fx, fy, fr, 0, TAU); ctx.fill();
        if (p < 0.75) { ctx.globalAlpha = 0.7 * (1 - p / 0.75); ctx.fillStyle = evo ? '#ff5fe0' : '#ff7a1f'; ctx.beginPath(); ctx.arc(fx, fy, fr * 0.72, 0, TAU); ctx.fill(); }
        if (p < 0.45) { ctx.globalAlpha = 0.9 * (1 - p / 0.45); ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(fx, fy, fr * 0.45, 0, TAU); ctx.fill(); }
        if (p < 0.12) { ctx.globalAlpha = 1 - p / 0.12; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(fx, fy, R0 * 0.5, 0, TAU); ctx.fill(); }
        // onda d'urto
        ctx.globalAlpha = 0.8 * (1 - p); ctx.strokeStyle = evo ? '#ff9af0' : '#ffd8a0'; ctx.lineWidth = 0.6 + 2 * (1 - p);
        ctx.beginPath(); ctx.arc(fx, fy, R0 * (0.5 + 0.8 * e), 0, TAU); ctx.stroke();
        // schegge incandescenti
        ctx.fillStyle = '#ffd25a';
        for (let q = 0; q < 10; q++) { const a = sd * 0.7 + q * 0.628 + (q & 1) * 0.3, d = R0 * (0.4 + 0.9 * e) * (0.7 + 0.3 * ((q * 7 + sd) % 3) / 2); ctx.globalAlpha = 1 - p; ctx.fillRect(fx + Math.cos(a) * d - 0.6, fy + Math.sin(a) * d - 0.6 + p * p * 6, 1.2, 1.2); }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
    }

    if (showMe) {
    // barra vita sotto al player
    const pfe = Player.frame(rt), bw = 16, bx = ppx - (bw >> 1), by = ppy + Math.round(pfe.hi ? pfe.h / 4 : pfe.h / 2) + 1;
    const lowHp = Player.hp < Player.maxHp * 0.3;
    ctx.fillStyle = PAL.k; ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
    ctx.fillStyle = PAL.A; ctx.fillRect(bx, by, bw, 2);
    ctx.fillStyle = lowHp && (((rt * 8) | 0) & 1) ? PAL.I : PAL.D;
    ctx.fillRect(bx, by, Math.ceil(bw * Player.hp / Player.maxHp), 2);
    // ricarica del teletrasporto: barretta sotto la vita (chiara = pronto)
    if (Player.tele) {
      const tcd = Player.teleCdMax(), dr = Player.teleCd > 0 ? 1 - Player.teleCd / tcd : 1;
      ctx.fillStyle = PAL.k; ctx.fillRect(bx - 1, by + 3, bw + 2, 2);
      ctx.fillStyle = dr >= 1 ? PAL[9] : PAL.n; ctx.fillRect(bx, by + 3, Math.round(bw * dr), 1);
    }

    }
    this.drawJoystick();

    // buio ai bordi mentre c'è il boss
    if (Boss.active) {
      const bp = this.pat(PAL.k);
      ctx.fillStyle = bp;
      const e1 = 34, e2 = 16;
      ctx.fillRect(0, 0, W, e1); ctx.fillRect(0, H - e1, W, e1);
      ctx.fillRect(0, e1, e1, H - 2 * e1); ctx.fillRect(W - e1, e1, e1, H - 2 * e1);
      ctx.fillStyle = PAL.k;
      ctx.fillRect(0, 0, W, e2); ctx.fillRect(0, H - e2, W, e2);
      ctx.fillRect(0, e2, e2, H - 2 * e2); ctx.fillRect(W - e2, e2, e2, H - 2 * e2);
    }

    // notte: bordi blu gelo (erano rosso sangue)
    if (G.night) {
      ctx.fillStyle = this.pat(NIGHT.edge);
      const e = 22;
      ctx.fillRect(0, 0, W, e); ctx.fillRect(0, H - e, W, e); ctx.fillRect(0, e, e, H - 2 * e); ctx.fillRect(W - e, e, e, H - 2 * e);
    }

    // BUSSOLA: frecce ai bordi verso il boss e i forzieri che non si vedono
    if (G.scene === 'run' && (G.state === 'play' || G.state === 'paused')) {
      for (let q = 0; q < Boss.n; q++) {
        const bi = Boss.list[q];
        if (Enemies.alive[bi] === 0) continue;
        this.pointer(Math.round((Enemies.px[bi] * ia + Enemies.x[bi] * alpha) * S) + ox, Math.round((Enemies.py[bi] * ia + Enemies.y[bi] * alpha) * S) + oy, PAL.H, PAL.I, rt, 1);
      }
      const Gm = Gems;
      for (let i = 0, shown = 0; i < Gm.count && shown < 3; i++) {
        if (Gm.alive[i] === 0 || Gm.kind[i] !== GK.CHEST) continue;
        if (this.pointer(Math.round(Gm.x[i] * S) + ox, Math.round(Gm.y[i] * S) + oy, PAL.O, PAL.Y, rt, 0)) shown++;
      }
      // il Magister: freccia dorata, da quando hai visto la sua lanterna
      if (Camp.seen && G.mapId === MAGISTER_CAMP.map) this.pointer(Math.round(MAGISTER_CAMP.x * S) + ox, Math.round(MAGISTER_CAMP.y * S) + oy, PAL.K, PAL.Z, rt, 0);
      // LA MORTE: freccia bianca grande, sempre
      if (Death.on) this.pointer(Math.round(Death.x * S) + ox, Math.round(Death.y * S) + oy, PAL.w, PAL.k, rt, 1);
      // il PONTE: freccia quando sei vicino alla costa da quella parte (sullo Scoglio solo quando è aperto)
      const Bq = G.map.bridge;
      if (Bq && (!G.map.reef || G.reefDone)) {
        const bx = Bq.ux * Bq.r0, by = Bq.uy * Bq.r0, ddx = bx - Player.x, ddy = by - Player.y;
        if (ddx * ddx + ddy * ddy < 2600 * 2600) this.pointer(Math.round(bx * S) + ox, Math.round(by * S) + oy, PAL.K, PAL.L, rt, 0);
      }
    }

    // vita bassa: bordi rossi che pulsano
    if (Player.hp < Player.maxHp * 0.3 && G.state === 'play') {
      const pulse = 0.35 + 0.35 * Math.sin(rt * 7);
      ctx.globalAlpha = pulse; ctx.fillStyle = this.pat(PAL.C);
      const e = 18;
      ctx.fillRect(0, 0, W, e); ctx.fillRect(0, H - e, W, e); ctx.fillRect(0, e, e, H - 2 * e); ctx.fillRect(W - e, e, e, H - 2 * e);
      ctx.globalAlpha = 1;
    }

    // LAMPO del fulmine: lo schermo diventa bianco per un istante
    if (G.flash > 0 && CFG.flashes && G.state === 'play') {
      ctx.globalAlpha = G.flash > 0.15 ? 1 : G.flash / 0.15;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // morte: lo schermo si tinge di rosso sangue
    if (G.state === 'dying') {
      const k = Math.min(1, (1.6 - G.dyingT) / 1.4);
      ctx.globalAlpha = k * 0.85; ctx.fillStyle = this.pat(PAL.B); ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = k * 0.45; ctx.fillStyle = '#120306'; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // lampo rosso quando colpito
    if (Player.hurtT > 0) {
      ctx.globalAlpha = Player.hurtT * 1.6;
      ctx.fillStyle = this.pat(PAL.C);
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  },

  // ---- alta risoluzione ----------------------------------------------------------
  pd: { n: 0, e: null, img: null, x: 0, y: 0, npc: null, starN: 0, starF: 0, sx: new Float32Array(16), sy: new Float32Array(16), trail: 0, tx: new Float32Array(8), ty: new Float32Array(8), ta: new Float32Array(8), tf: new Int8Array(8) },
  // disegna uno sprite sul canvas visibile: (x,y) = centro in pixel del gioco; k = ingrandimento extra (villaggio)
  hiSprite(e, img, x, y, k) {
    const h = this.hctx, sc = (e.hi ? 1 : 2) * (k || 1);
    const w = e.w * sc, hh = e.h * sc, x0 = Math.round(x * 2) - (w >> 1), y0 = Math.round(y * 2) - (hh >> 1);
    h.drawImage(img, x0, y0, w, hh);
    if (this.dirtyN < 64) { const d = this.dirty, k2 = this.dirtyN++ * 4; d[k2] = x0 - 1; d[k2 + 1] = y0 - 1; d[k2 + 2] = w + 2; d[k2 + 3] = hh + 2; }
  },
  dirty: new Int32Array(256), dirtyN: 0,
  present() {
    const h = this.hctx, d = this.dirty;
    for (let k = 0; k < this.dirtyN; k++) h.clearRect(d[k * 4], d[k * 4 + 1], d[k * 4 + 2], d[k * 4 + 3]);
    this.dirtyN = 0;
    h.imageSmoothingEnabled = false;
    if (G.scene === 'village') { Village.present(); return; }
    const PD = this.pd, e = PD.e;
    if (!e) return;
    if (PD.npc) this.hiSprite(PD.npc.e, PD.npc.img, PD.npc.x, PD.npc.y);
    if (PD.starN) { const st = SPR.cache[PD.starF ? 'star_ice2' : 'star_ice']; for (let k = 0; k < PD.starN; k++) this.hiSprite(st, st.img, PD.sx[k], PD.sy[k]); }
    for (let k = 0; k < PD.trail; k++) {
      h.globalAlpha = PD.ta[k];
      this.hiSprite(e, PD.tf[k] < 0 ? (e.dashMir || e.mir) : (e.dashImg || e.img), PD.tx[k], PD.ty[k]);
    }
    h.globalAlpha = 1;
    if (PD.n) this.hiSprite(e, PD.img, PD.x, PD.y);
  },

  // Il boss: enorme, nero. Durante il preavviso lampeggia rosso scuro e mostra la traiettoria.
  // Freccia sul bordo dello schermo verso (tx, ty) in pixel schermo; non fa nulla se il punto si vede.
  // Ritorna true se l'ha disegnata. big = 1 per il boss (più grande, pulsa più forte).
  pointer(tx, ty, col, hi, rt, big) {
    const ctx = this.ctx, W = this.W, H = this.H, m = 10;
    // in alto ci sono la barra XP e (col boss) la sua barra vita: le frecce restano sotto
    const css = Boss.active ? (innerWidth <= 600 ? 140 : 86) : 40, mt = Math.ceil(css * H / (innerHeight || H));
    if (tx > m && tx < W - m && ty > mt && ty < H - m) return false;
    const cx = W >> 1, cy = (H + mt - m) >> 1, dx = tx - cx, dy = ty - cy;
    const k = Math.min((cx - m) / (Math.abs(dx) || 1e-3), (dy < 0 ? cy - mt : H - m - cy) / (Math.abs(dy) || 1e-3));
    const d = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / d, uy = dy / d;
    const bob = (((rt * (big ? 6 : 3)) | 0) & 1);
    const px = cx + dx * k - ux * bob, py = cy + dy * k - uy * bob, len = big ? 12 : 9;
    for (let pass = 0; pass < 2; pass++) {
      for (let q = 0; q <= len; q++) {
        const hw = (len - q) * 0.62 + (pass ? 0 : 1), x0 = px + ux * (q - len * 0.5), y0 = py + uy * (q - len * 0.5);
        ctx.fillStyle = pass === 0 ? PAL.k : (q >= len - 1 || bob ? hi : col);
        for (let s = -Math.ceil(hw); s <= Math.ceil(hw); s++) ctx.fillRect(Math.round(x0 - uy * s), Math.round(y0 + ux * s), 1, 1);
      }
    }
    return true;
  },

  drawBoss(alpha, rt) {
    const E = Enemies, ctx = this.ctx, S = 1 / CFG.UNIT, ia = 1 - alpha;
    for (let i = 0; i < E.count; i++) {
      if (E.alive[i] === 0 || E.big[i] === 0 || E.type[i] === ET.death) continue;   // la Morte si disegna a parte
      const x = E.px[i] * ia + E.x[i] * alpha, y = E.py[i] * ia + E.y[i] * alpha;
      const B = Boss.slotOf(i), cfg = (B && (B.trial || B.reef)) ? B.cfg : bossCfg(E.type[i]);   // i Custodi e Scilla hanno il loro aspetto
      const s = (cfg && SPR.cache[cfg.sprite]) || SPR.cache[ENEMY_DEFS[E.type[i]].sprite];
      const sx = Math.round(x * S) + this.ox, sy = Math.round(y * S) + this.oy;
      const flip = s.face ? ((Player.x < x) === (s.face > 0)) : (cfg && cfg.faces === 'left' && s.mir && Player.x > x);   // si gira verso di te
      // ombra
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = PAL.k;
      for (let dy = -6; dy <= 6; dy++) {
        const hw = Math.floor(Math.sqrt(1 - (dy * dy) / 36) * s.w * 0.55);
        ctx.fillRect(sx - hw, sy + (s.h >> 1) - 4 + dy, hw * 2, 1);
      }
      ctx.globalAlpha = 1;
      let tx = 0;
      const telling = !!B && B.state === 'tell' && E.type[i] === ET.boss;
      if (telling) {
        tx = (((rt * 40) | 0) & 1) ? 1 : -1; // trema
        // traiettoria della carica
        ctx.fillStyle = PAL.C;
        for (let k = 4; k < 60; k += 2) {
          ctx.fillRect(sx + Math.round(B.dirX * k * 4), sy + Math.round(B.dirY * k * 4), 2, 2);
        }
      }
      const f = ((G.time * 3) | 0) & 1;
      const tell = telling && !!s.tell && (((rt * 12) | 0) & 1);   // i Custodi non hanno il lampeggio rosso: solo il tremolio
      const img = tell ? (f ? s.tell2 : s.tell) : flip ? (f ? s.mir2 : s.mir) : (f ? s.img2 : s.img);
      ctx.drawImage(img, sx - (s.w >> 1) + tx, sy - (s.h >> 1), s.w, s.h);
    }
  },

  // numero pixel centrato (cifre 3x5 con bordo nero); heal = "+N" bianco
  number(x, y, v, heal) {
    const ctx = this.ctx;
    v = Math.round(v);
    if (v < 1) v = 1;
    const set = heal ? SPR.digitsH : v >= 40 ? SPR.digitsW : SPR.digits;
    let digits = v >= 1000 ? 4 : v >= 100 ? 3 : v >= 10 ? 2 : 1;
    let w = digits * 4 + (heal ? 4 : 0);
    let cx = x - (w >> 1) + (digits - 1) * 4 + (heal ? 4 : 0);
    for (let k = 0; k < digits; k++) {
      ctx.drawImage(set[v % 10], cx - 1, y - 3);
      v = (v / 10) | 0;
      cx -= 4;
    }
    if (heal) ctx.drawImage(SPR.plus, cx - 1, y - 2);
  },

  // fulmine a zig-zag deterministico (stesso seed = stessa forma per tutta la durata)
  // style: 0 normale | 1 Fulmini di Capaneo (bordo nero spesso, corpo giallo, cuore bianco, scintille)
  //        2 Strali di Giove (oro: alone largo, cuore bianco, rami laterali) — vedi BOLT_STYLE
  bolt(x0, y0, x1, y1, seed, evo, style, p) {
    if (style) { this.boltFancy(x0, y0, x1, y1, seed, style, p || 0); return; }
    const ctx = this.ctx, N = 7;
    let px = x0, py = y0;
    const nx = -(y1 - y0), ny = x1 - x0, nl = Math.sqrt(nx * nx + ny * ny) || 1;
    for (let k = 1; k <= N; k++) {
      const f = k / N;
      let jx = x0 + (x1 - x0) * f, jy = y0 + (y1 - y0) * f;
      if (k < N) {
        const j = (((seed * 7919 + k * 104729) % 15) - 7);
        jx += nx / nl * j; jy += ny / nl * j;
      }
      jx = Math.round(jx); jy = Math.round(jy);
      if (evo) { ctx.fillStyle = PAL['~']; this.line(px - 1, py, jx - 1, jy); this.line(px + 1, py, jx + 1, jy); }
      else { ctx.fillStyle = PAL.o; this.line(px + 1, py, jx + 1, jy); }
      ctx.fillStyle = evo ? PAL[8] : PAL[9]; this.line(px, py, jx, jy);
      px = jx; py = jy;
    }
  },
  boltFancy(x0, y0, x1, y1, seed, style, p) {
    const ctx = this.ctx, gold = style === 2, N = gold ? 10 : 7, amp = gold ? 9 : 6;
    const nx = -(y1 - y0), ny = x1 - x0, nl = Math.sqrt(nx * nx + ny * ny) || 1, ux = nx / nl, uy = ny / nl;
    const P = this._boltPts || (this._boltPts = new Float32Array(32));
    P[0] = x0; P[1] = y0;
    for (let k = 1; k <= N; k++) {
      const f = k / N, j = k < N ? (((seed * 7919 + k * 104729 + ((p * 3) | 0) * 31) % (amp * 2 + 1)) - amp) : 0;   // tremola un po' mentre vive
      P[k * 2] = Math.round(x0 + (x1 - x0) * f + ux * j); P[k * 2 + 1] = Math.round(y0 + (y1 - y0) * f + uy * j);
    }
    // 3 passate: alone/bordo, corpo, cuore
    const outer = gold ? PAL.K : PAL[1], mid = gold ? PAL.L : PAL.Y, core = p > 0.6 ? (gold ? PAL.Z : PAL.Z) : PAL.w;
    for (let pass = 0; pass < 3; pass++) {
      ctx.fillStyle = pass === 0 ? outer : pass === 1 ? mid : core;
      const off = pass === 0 ? 1 : 0;
      for (let k = 1; k <= N; k++) {
        const ax = P[k * 2 - 2], ay = P[k * 2 - 1], bx = P[k * 2], by = P[k * 2 + 1];
        if (pass === 0) { this.line(ax - 1, ay, bx - 1, by); this.line(ax + 1, ay, bx + 1, by); this.line(ax, ay - 1, bx, by - 1); if (gold) this.line(ax + 2, ay, bx + 2, by); }
        else if (pass === 1) { this.line(ax, ay, bx, by); this.line(ax + 1, ay, bx + 1, by); }
        else if (off === 0) this.line(ax, ay, bx, by);
      }
    }
    // rami laterali (Giove) e scintille (Capaneo)
    for (let k = 2; k < N; k += 2) {
      const bx = P[k * 2], by = P[k * 2 + 1], s = ((seed + k * 13) % 2) ? 1 : -1, l = gold ? 7 : 4;
      if (gold) { ctx.fillStyle = PAL.L; this.line(bx, by, bx + Math.round(ux * l * s + (x1 - x0) / nl * 2), by + Math.round(uy * l * s + 3)); }
      else if (((seed + k) & 1) === 0) { ctx.fillStyle = PAL.Y; ctx.fillRect(bx + s * 2, by - 1, 1, 1); ctx.fillStyle = PAL.w; ctx.fillRect(bx - s * 2, by + 1, 1, 1); }
    }
  },
};
