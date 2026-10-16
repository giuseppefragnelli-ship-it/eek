'use strict';
// js/22_render.js — Render: disegno della partita

// ============================================================================
// RENDER — pixel art. Il canvas ha una risoluzione bassa (≈360 px di altezza)
// e viene ingrandito dal CSS con un fattore INTERO e `image-rendering:
// pixelated`, così ogni pixel resta un quadratino netto.
// Tutto viene disegnato a coordinate intere: niente sbavature.
// ============================================================================

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
    if (m === 0) {
      ctx.fillStyle = PAL[9];
      for (let k = 0; k < 3; k++) { const b = rt * 7 + k * 2.094; ctx.fillRect(x + Math.round(Math.cos(b) * (h + 1)), y - h - 2 + Math.round(Math.sin(b) * 1.5), 1, 1); }
      return;
    }
    if (m < 0.2) { ctx.globalAlpha = 0.5; this.ditherDisk(x, y, h - 1, this.pat(PAL[']'])); ctx.globalAlpha = 1; }
    ctx.fillStyle = m < 0.2 ? PAL.w : PAL[']'];
    ctx.fillRect(x - h + 1, y - 1, 1, 1); ctx.fillRect(x + h - 2, y - h + 2, 1, 1); ctx.fillRect(x, y + h - 2, 1, 1);
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
    // notte: il pavimento sprofonda nel buio, tranne un cerchio di luce attorno a te
    if (G.night) {
      ctx.globalAlpha = 0.75; ctx.fillStyle = this.pat(PAL.k); ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.25; ctx.fillStyle = PAL.k; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      // luce: ridisegna il pavimento dentro il cerchio (a righe = bordo pixel netto), poi un anello a retino
      const LR = Math.round(NIGHT.lightR * S), lx = (W >> 1) + shx, ly = (H >> 1) + shy;
      ctx.setTransform(2, 0, 0, 2, ox * 2, oy * 2);
      ctx.fillStyle = this.floorPat;
      for (let dy = -LR; dy <= LR; dy++) {
        const hw = Math.floor(Math.sqrt(LR * LR - dy * dy));
        ctx.fillRect(lx - hw - ox, ly + dy - oy, hw * 2 + 1, 1);
      }
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.globalAlpha = 0.45; this.ditherRing(lx, ly, LR - 10, LR, PAL.k); ctx.globalAlpha = 1;
    }
    drawMapLayer('obstacles');

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
      this.circle(ppx, ppy, r, w.evolved ? PAL[9] : PAL.p);
      ctx.globalAlpha = 1;
    }

    // pozze acide
    for (let i = 0; i < Zones.count; i++) {
      if (Zones.alive[i] === 0) continue;
      const zx = Math.round(Zones.x[i] * S) + ox, zy = Math.round(Zones.y[i] * S) + oy;
      const zr = Math.round(Zones.r[i] * S), fade = Zones.life[i] < 0.5 ? Zones.life[i] * 2 : 1;
      ctx.globalAlpha = 0.55 * fade; this.ditherDisk(zx, zy, zr, this.pat(Zones.slow[i] ? PAL.e : PAL.d)); ctx.globalAlpha = 1;
      this.circle(zx, zy, zr, Zones.slow[i] ? PAL.e : PAL.c);
      const b = ((rt * 3 + i) | 0) % 5;
      ctx.fillStyle = PAL.e;
      ctx.fillRect(zx + ((b * 7) % (zr + 1)) - (zr >> 1), zy + ((b * 5) % (zr + 1)) - (zr >> 1), 1, 1);
      ctx.fillRect(zx - ((b * 3) % (zr + 1)) + (zr >> 2), zy - ((b * 11) % (zr + 1)) + (zr >> 2), 1, 1);
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

    // nemici: 2 frame di animazione "molle", sagoma bianca quando colpiti
    const E = Enemies, n = E.count, night = G.night, eliteT = ET.elite, ghostT = ET.ghost;
    // zone dei fulmini (sotto ai nemici)
    for (let k = 0; k < Strikes.n; k++) {
      const sx = Math.round(Strikes.x[k] * S) + ox, sy = Math.round(Strikes.y[k] * S) + oy;
      const r = Math.round(BOSS2.strikeR * S), p = 1 - Strikes.t[k] / BOSS2.strikeTell;
      ctx.globalAlpha = 0.25 + p * 0.45; this.ditherDisk(sx, sy, Math.max(1, Math.round(r * p)), this.pat(PAL.n)); ctx.globalAlpha = 1;
      this.circle(sx, sy, r, (((rt * (6 + p * 14)) | 0) & 1) ? PAL[9] : PAL.p);
    }
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
      const s0 = (night && SPR.cache[name + '_d']) || SPR.cache[name];
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

    // granate (in volo con parabola) + ombra
    const P = Projectiles, bs = SPR.cache.bomb;
    for (let i = 0; i < P.count; i++) {
      const kd = P.kind[i];
      if (P.alive[i] === 0 || (kd !== PK.BOMB && kd !== PK.ACID)) continue;
      const x = P.px[i] * ia + P.x[i] * alpha, y = P.py[i] * ia + P.y[i] * alpha;
      if (x < L || x > R || y < T || y > B) continue;
      const p = 1 - P.life[i] / P.life0[i];
      const h = Math.sin(Math.PI * p) * 40;
      ctx.fillStyle = PAL.k;
      ctx.fillRect(Math.round(x * S) + ox - 2, Math.round(y * S) + oy + 2, 5, 2);
      const sp = kd === PK.BOMB ? bs : SPR.cache.flask;
      this.spr(sp, sp.img, x, y - h);
    }

    // player
    const ps = Player.frame(rt);
    const bob = !Player.anim && Player.moving && (((rt * 8) | 0) & 1) ? 1 : 0;   // chi non ha la corsa animata "saltella"
    // il personaggio (e le copie dello scatto) si disegnano dopo, in alta risoluzione: qui si prepara la richiesta
    const PD = this.pd;
    PD.n = 0; PD.trail = 0;
    for (let k = 0; k < Player.trailN; k++) {
      PD.tx[k] = Math.round(Player.trailX[k] * S) + ox; PD.ty[k] = Math.round(Player.trailY[k] * S) + oy;
      PD.ta[k] = Math.max(0, Player.trailT[k] / 0.3) * 0.55; PD.tf[k] = Player.trailF[k];
    }
    PD.trail = Player.trailN; PD.e = ps;
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
    const invBlink = Player.invT > 0 && !hurt && Player.dashT <= 0 && Player.trailN === 0 && (((rt * 20) | 0) & 1);  // durante lo scatto niente lampeggio
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
      const st = wStats(w), step = Math.PI * 2 / st.amount, R2 = st.radius * Player.areaMult;
      for (let k = 0; k < st.amount; k++) {
        const a = w.angle + k * step;
        if (w.evolved) { // scia
          ctx.fillStyle = PAL.s;
          const a2 = a - 0.25;
          ctx.fillRect(Math.round((camX + Math.cos(a2) * R2) * S) + ox, Math.round((camY + Math.sin(a2) * R2) * S) + oy, 2, 2);
        }
        this.spr(os, os.img, camX + Math.cos(a) * R2, camY + Math.sin(a) * R2);
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
          ctx.fillStyle = PAL.L; ctx.fillRect(x + nx, y + ny, 1, 1); if (q & 1) ctx.fillRect(x - nx, y - ny, 1, 1);
          ctx.fillStyle = q > Rb - 4 || w.evolved ? PAL.w : PAL[9]; ctx.fillRect(x, y, 1, 1);
        }
        const tx = ppx + Math.round(ca * Rb), ty = ppy + Math.round(sa * Rb);
        ctx.fillStyle = PAL.w; ctx.fillRect(tx - 1, ty, 3, 1); ctx.fillRect(tx, ty - 1, 1, 3);
      }
    }

    // cristalli di sale e frecce (sprite pre-ruotati in 16 direzioni)
    const ss = Player.kunai ? SPR.cache.proj_kunai : SPR.cache.proj_salt, ars = SPR.cache.proj_arrow;
    for (let i = 0; i < P.count; i++) {
      const kd = P.kind[i];
      if (P.alive[i] === 0 || (kd !== PK.SALT && kd !== PK.ARROW)) continue;
      const x = P.px[i] * ia + P.x[i] * alpha, y = P.py[i] * ia + P.y[i] * alpha;
      if (x < L || x > R || y < T || y > B) continue;
      const img = (kd === PK.SALT ? ss : ars).rot[P.rot[i]];
      ctx.drawImage(img, Math.round(x * S) + ox - (img.width >> 1), Math.round(y * S) + oy - (img.height >> 1));
    }
    // falci di luna e asce (girano su se stesse) e fuochi fatui (con scia)
    const sc = SPR.cache.proj_scythe, wsp = SPR.cache.wisp, axs = SPR.cache.proj_axe;
    for (let i = 0; i < P.count; i++) {
      const kd = P.kind[i];
      if (P.alive[i] === 0 || (kd !== PK.SCYTHE && kd !== PK.WISP && kd !== PK.AXE)) continue;
      const x = P.px[i] * ia + P.x[i] * alpha, y = P.py[i] * ia + P.y[i] * alpha;
      if (x < L || x > R || y < T || y > B) continue;
      const sx = Math.round(x * S) + ox, sy = Math.round(y * S) + oy;
      if (kd === PK.SCYTHE || kd === PK.AXE) {
        const spin = kd === PK.AXE ? (P.vx[i] > 0 ? 18 : -18) : 24;
        const img = (kd === PK.AXE ? axs : sc).rot[((((rt * spin) | 0) + i) % 16 + 16) & 15], sz = P.size[i];
        const w = Math.round(img.width * sz), h = Math.round(img.height * sz);
        ctx.drawImage(img, sx - (w >> 1), sy - (h >> 1), w, h);
      } else {
        ctx.fillStyle = PAL.n;
        const v = Math.sqrt(P.vx[i] * P.vx[i] + P.vy[i] * P.vy[i]) || 1;
        ctx.fillRect(sx - Math.round(P.vx[i] / v * 4), sy - Math.round(P.vy[i] / v * 4), 2, 2);
        ctx.drawImage(wsp.img, sx - (wsp.w >> 1), sy - (wsp.h >> 1) - (((rt * 10 + i) | 0) & 1));
      }
    }
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
      ctx.fillStyle = PAL.k;
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
      const spin = rt * 9 + i;
      for (let j = 0; j < 6; j++) {
        const f = j / 5, rx = r * (0.25 + 0.75 * f), ry = Math.max(1, rx * 0.3);
        const cy = sy + r * 0.35 - f * r * 1.4, cx = sx + Math.round(Math.sin(spin * 0.5 + j * 0.9) * (1 + f * 2));
        const N = Math.max(10, Math.round(rx * 3));
        for (let q = 0; q < N; q++) {
          const a = q / N * 6.2832 + spin * (1 + f * 0.5), front = Math.sin(a) > 0;
          if (!front && (q & 1)) continue;
          ctx.fillStyle = front ? (j > 3 ? PAL[9] : PAL[8]) : PAL[6];
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
        this.bolt(Math.round(FX.x2[i] * S) + ox, Math.round(FX.y2[i] * S) + oy, x, y, FX.seed[i]);
        if (p < 0.5) { ctx.globalAlpha = 0.6; this.ditherDisk(x, y, Math.round(FX.r[i] * S), this.pat(PAL.n)); ctx.globalAlpha = 1; }
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
        const ext = p < 0.35 ? 1 - Math.pow(1 - p / 0.35, 3) : 1, len = Math.round(R * ext);
        if (p < 0.3) {
          ctx.globalAlpha = 0.3 * (1 - p / 0.3); ctx.fillStyle = this.pat(PAL.B);
          ctx.fillRect(side > 0 ? px0 : px0 - len, py0 - Math.round(hh), len, Math.round(hh * 2)); ctx.globalAlpha = 1;
        }
        const amp = (2 + hh * 0.35) * (1 - p * 0.8), wave = (q) => Math.round(Math.sin(q * 0.2 - p * 18) * amp * (q / Math.max(1, R)));
        for (let q = 4; q <= len; q++) {
          if (p > 0.6 && ((q + ((rt * 30) | 0)) & 1)) continue;
          const f = q / Math.max(1, R);
          ctx.fillStyle = q > len - 3 ? PAL.w : f < 0.22 ? PAL.h : p < 0.4 ? PAL[8] : PAL[6];
          ctx.fillRect(px0 + side * q, py0 + wave(q), 1, f < 0.5 ? 2 : 1);
        }
        if (p > 0.3 && p < 0.6) {
          const tx = px0 + side * len, ty = py0 + wave(len);
          ctx.fillStyle = PAL.w; ctx.fillRect(tx - 2, ty, 5, 1); ctx.fillRect(tx, ty - 2, 1, 5);
          ctx.fillStyle = PAL.D; ctx.fillRect(tx - 2, ty - 2, 1, 1); ctx.fillRect(tx + 2, ty + 2, 1, 1); ctx.fillRect(tx + 2, ty - 2, 1, 1); ctx.fillRect(tx - 2, ty + 2, 1, 1);
        }
      } else if (k === FXK.NOVA) {
        // onda di gelo: anello azzurro che si allarga con le schegge di ghiaccio
        const e = 1 - (1 - p) * (1 - p), r = Math.max(2, Math.round(FX.r[i] * S * e));
        const px0 = Math.round(Player.x * S) + ox, py0 = Math.round(Player.y * S) + oy;
        if (p < 0.6) { ctx.globalAlpha = 0.3 * (1 - p / 0.6); this.ditherDisk(px0, py0, r, this.pat(PAL['{'])); }
        ctx.globalAlpha = 1 - p * 0.7;
        this.circle(px0, py0, r, PAL[']']);
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
      } else if (k === FXK.BOOM) {
        const r = Math.max(1, Math.round(FX.r[i] * S * (0.4 + 0.6 * p)));
        if (p < 0.35) { ctx.globalAlpha = 0.85; this.ditherDisk(x, y, r, this.pat(PAL.F)); ctx.globalAlpha = 1; }
        this.circle(x, y, r, p < 0.5 ? PAL.P : PAL.F);
        if (p < 0.7) this.circle(x, y, Math.max(1, (r * 0.6) | 0), PAL.G);
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
    // ricarica dello scatto: barretta viola sotto la vita (chiara = pronto)
    const dcd = (Player.kunai ? DASH.cdEek : DASH.cd) * Player.cdMult, dr = Player.dashCd > 0 ? 1 - Player.dashCd / dcd : 1;
    ctx.fillStyle = PAL.k; ctx.fillRect(bx - 1, by + 3, bw + 2, 2);
    ctx.fillStyle = dr >= 1 ? PAL[9] : PAL.n; ctx.fillRect(bx, by + 3, Math.round(bw * dr), 1);

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

    // notte: bordi rosso sangue
    if (G.night) {
      ctx.fillStyle = this.pat(PAL.A);
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
  pd: { n: 0, e: null, img: null, x: 0, y: 0, trail: 0, tx: new Float32Array(8), ty: new Float32Array(8), ta: new Float32Array(8), tf: new Int8Array(8) },
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
      if (E.alive[i] === 0 || E.big[i] === 0) continue;
      const x = E.px[i] * ia + E.x[i] * alpha, y = E.py[i] * ia + E.y[i] * alpha;
      const cfg = bossCfg(E.type[i]);
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
      const B = Boss.slotOf(i), telling = !!B && B.state === 'tell' && E.type[i] === ET.boss;
      if (telling) {
        tx = (((rt * 40) | 0) & 1) ? 1 : -1; // trema
        // traiettoria della carica
        ctx.fillStyle = PAL.C;
        for (let k = 4; k < 60; k += 2) {
          ctx.fillRect(sx + Math.round(B.dirX * k * 4), sy + Math.round(B.dirY * k * 4), 2, 2);
        }
      }
      const f = ((G.time * 3) | 0) & 1;
      const tell = telling && (((rt * 12) | 0) & 1);
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
  bolt(x0, y0, x1, y1, seed) {
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
      ctx.fillStyle = PAL.o; this.line(px + 1, py, jx + 1, jy);
      ctx.fillStyle = PAL[9]; this.line(px, py, jx, jy);
      px = jx; py = jy;
    }
  },
};
