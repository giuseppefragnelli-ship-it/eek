'use strict';
// js/24_village.js — Village: la scena tra le partite

// ============================================================================
// VILLAGGIO — scena tra una partita e l'altra. Ci cammini col joystick
// (o WASD), ti avvicini a un abitante e parli con lui:
//   Magister    -> non c'è più: sulla porta un biglietto (è nella Cattedrale, vedi Camp in fondo)
//   Fabbro      -> rafforza gli oggetti
//   Armaiolo    -> armi
//   Corazzaio   -> armature e gioielli
//   Locandiera  -> potenziamenti permanenti (Forza, Destrezza, Vita, Magia)
//   Bacheca     -> missioni
// Sotto la piazza ci sono due giardini; in fondo al sentiero il portale.
//
// Il villaggio è più ZOOMATO della partita: si disegna su un canvas piccolo
// e poi lo si ingrandisce 2x o 3x (pixel netti). Scala fissa: 1 px del
// villaggio = 2 unità di mondo.
// Coordinate in unità di mondo, centro (0,0); y cresce verso il basso.
// ============================================================================

const Village = {
  VS: 0.5,                           // pixel del villaggio per unità di mondo
  W: 1500, H: 820,                   // dimensioni del villaggio
  houseY: -170,                      // linea dei piedi delle case (porte)
  npcs: [
    // il Magister è sceso nella Cattedrale (MAGISTER_CAMP): resta la casa con un biglietto sulla porta
    { id: 'magister', name: 'il biglietto del Magister', verb: 'Leggi', away: true, x: -625, house: 'h_magister', sprite: 'npc_magister', sign: 'ico_book' },
    { id: 'smith',   name: 'il Fabbro',     x: -375, house: 'h_smith',   sprite: 'npc_smith',   sign: 'ico_anvil', extra: 'v_anvil' },
    { id: 'weapons', name: "l'Armaiolo",    x: -125, house: 'h_weapons', sprite: 'npc_weapons', sign: 'it_dagger', extra: 'v_rack' },
    { id: 'armor',   name: 'il Corazzaio',  x: 125,  house: 'h_armor',   sprite: 'npc_armor',   sign: 'it_shield' },
    { id: 'inn',     name: 'la Locandiera', x: 375,  house: 'h_inn',     sprite: 'npc_inn',     sign: 'ico_mug',   extra: 'v_barrel' },
    { id: 'haruspex', name: "l'Aruspice",   x: 625,  house: 'h_haruspex', sprite: 'npc_haruspex', sign: 'ico_greed' },
    { id: 'board',   name: 'la Bacheca',    x: -290, y: -40, sprite: 'board', verb: 'Leggi' },
  ],
  well: { x: 0, y: -70, r: 26 },
  portal: { x: 0, y: 340, r: 26 },
  near: null,
  _lastNear: undefined,
  cv: null, vctx: null,
  objs: null,        // oggetti statici ordinati per profondità (disegno)
  rects: null,       // ostacoli rettangolari [x0,y0,x1,y1]
  circles: null,     // ostacoli circolari [x,y,r]

  // costruisce disposizione, ostacoli e oggetti da disegnare (una volta sola)
  build() {
    if (this.objs) return;
    const O = this.objs = [], RC = this.rects = [], CI = this.circles = [];
    const add = (spr, x, y, opts) => O.push(Object.assign({ spr, x, y }, opts || {}));   // x,y = piedi dello sprite
    const box = (x0, y0, x1, y1) => RC.push([x0, y0, x1, y1]);
    // case + abitanti + arredi
    for (const n of this.npcs) {
      if (!n.house) { n.y = n.y || 0; add(n.sprite, n.x, n.y + 14, { npc: n }); CI.push([n.x, n.y, 18]); continue; }
      n.y = this.houseY + 22;
      n.x0 = n.x; n.x = n.x + 40;                          // l'abitante sta accanto alla porta
      add(n.house, n.x0, this.houseY, { house: n });
      const hw = ((SPR.cache[n.house].w >> 1) - 3) / this.VS;    // le case hanno larghezze diverse
      box(n.x0 - hw, this.houseY - 100, n.x0 + hw, this.houseY - 4);
      if (n.away) continue;                                // non c'è nessuno: solo il biglietto sulla porta
      add(n.sprite, n.x, n.y + 14, { npc: n });
      CI.push([n.x, n.y, 10]);
      if (n.extra) { const ex = n.x0 - 44, ey = this.houseY + 26; add(n.extra, ex, ey); CI.push([ex, ey - 6, 12]); }
    }
    add('v_barrel', 420, this.houseY + 22); CI.push([420, this.houseY + 16, 10]);
    // pozzo, panchine, lanterne
    add('well', this.well.x, this.well.y + 16); CI.push([this.well.x, this.well.y, this.well.r]);
    add('v_bench', -150, -10); add('v_bench', 150, -10);
    for (const [x, y] of [[-240, 0], [240, 0], [-70, 140], [70, 140], [-70, 280], [70, 280]]) { add('lantern', x, y, { lamp: true }); CI.push([x, y - 4, 6]); }
    // giardini (sinistra e destra del sentiero)
    for (const side of [-1, 1]) {
      const xin = side * 110, xout = side * 470, x0 = Math.min(xin, xout), x1 = Math.max(xin, xout);
      // staccionata in alto (con un varco verso il sentiero) e sul lato esterno
      for (let x = x0; x < x1 - 30; x += 30) {
        if ((side < 0 && x > x1 - 110) || (side > 0 && x < x0 + 80)) continue;
        add('g_fence', x + 15, 66);
      }
      box(side < 0 ? x0 : x0 + 80, 52, side < 0 ? x1 - 110 : x1, 68);
      for (let y = 90; y < 330; y += 24) add('g_fenceV', side < 0 ? x0 : x1, y + 24);
      box(side < 0 ? x0 - 6 : x1 - 6, 70, side < 0 ? x0 + 6 : x1 + 6, 330);
      // aiuole fiorite (piatte) e siepi
      for (let r = 0; r < 3; r++) {
        const by = 120 + r * 72, bx = side * 210, bx2 = side * 330;
        O.push({ spr: 'g_bed', x: bx, y: by, flat: true }); O.push({ spr: 'g_bed', x: bx2, y: by, flat: true });
        box(bx - 28, by - 12, bx + 28, by + 12); box(bx2 - 28, by - 12, bx2 + 28, by + 12);
      }
      add('g_hedge', side * 400, 330); box(side * 400 - 30, 312, side * 400 + 30, 332);
      add('g_hedge', side * 160, 330); box(side * 160 - 30, 312, side * 160 + 30, 332);
      add('g_tree', side * 440, 120); CI.push([side * 440, 112, 14]);
      add('g_tree', side * 140, 250); CI.push([side * 140, 242, 14]);
    }
    // alberi scuri attorno al villaggio
    for (const [x, y] of [[-720, -340], [-720, -100], [-720, 150], [-720, 380], [720, -340], [720, -100], [720, 150], [720, 380], [-560, 220], [560, 220], [-600, 400], [600, 400], [-300, 400], [300, 400], [-180, 400], [180, 400]]) {
      add('o_oak', x, y); CI.push([x, y - 6, 16]);
    }
  },

  enter() {
    this.build();
    Player.reset();
    Player.x = Player.px = 0; Player.y = Player.py = 60;
    Obs.n = 0;
    this.near = null; this._lastNear = undefined;
    setState('village');
    UI.villagePrompt(null);

  },

  _collide() {
    const P = Player, r = P.r;
    for (const c of this.circles) {
      const dx = P.x - c[0], dy = P.y - c[1], rr = c[2] + r, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 0.01;
      P.x = c[0] + dx / d * rr; P.y = c[1] + dy / d * rr;
    }
    for (const b of this.rects) {
      const x0 = b[0] - r, y0 = b[1] - r, x1 = b[2] + r, y1 = b[3] + r;
      if (P.x <= x0 || P.x >= x1 || P.y <= y0 || P.y >= y1) continue;
      // esce dal lato più vicino
      const dl = P.x - x0, dr = x1 - P.x, dt = P.y - y0, db = y1 - P.y, m = Math.min(dl, dr, dt, db);
      if (m === dl) P.x = x0; else if (m === dr) P.x = x1; else if (m === dt) P.y = y0; else P.y = y1;
    }
    const hw = this.W / 2 - 20, hh = this.H / 2 - 20;
    if (P.x < -hw) P.x = -hw; if (P.x > hw) P.x = hw;
    if (P.y < -hh) P.y = -hh; if (P.y > hh) P.y = hh;
  },

  step(dt) {
    Player.update(dt);
    this._collide();
    G.time += dt; // anima lanterne e portale
    let best = null, bd = 60 * 60;
    for (const n of this.npcs) {
      const dx = Player.x - n.x, dy = Player.y - n.y, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = n; }
    }
    this.near = best;
    if (best !== this._lastNear) { this._lastNear = best; UI.villagePrompt(best); }
    const dx = Player.x - this.portal.x, dy = Player.y - this.portal.y;
    if (dx * dx + dy * dy < this.portal.r * this.portal.r) startRun();
  },

  // personaggi ad alta risoluzione sopra il villaggio ingrandito (posizioni in pixel del villaggio)
  present() {
    const K = this.K, list = this._hi;
    if (!list) return;
    list.sort((a, b) => a.d - b.d);
    for (const q of list) Render.hiSprite(q.e, q.img, q.x * K, q.y * K, K);
  },

  talk() {
    if (!this.near) return;
    UI.openShop(this.near.away ? this.near.id + '_away' : this.near.id, 'village');
  },

  draw(alpha) {
    this.build();
    const R = Render, main = R.ctx;
    // canvas del villaggio a risoluzione ridotta, poi ingrandito di K pixel del gioco (a passi di 0.5: il canvas vero
    // è 2x, quindi ogni pixel del villaggio resta un quadrato netto di 2K pixel reali).
    // Dal 2026-10-28 ~260 pixel del villaggio sul lato corto (erano ~170): pixel più fini, si vede più villaggio.
    const K = this.K = Math.max(1.5, Math.round(Math.min(R.W, R.H) / 260 * 2) / 2);
    const VW = Math.ceil(R.W / K), VH = Math.ceil(R.H / K);
    if (!this.cv) { this.cv = document.createElement('canvas'); this.vctx = this.cv.getContext('2d', { alpha: false }); }
    if (this.cv.width !== VW || this.cv.height !== VH) { this.cv.width = VW; this.cv.height = VH; this.vctx.imageSmoothingEnabled = false; }
    const ctx = this.vctx;
    R.ctx = ctx;   // le primitive di Render disegnano qui
    try { this._draw(ctx, VW, VH, alpha); } finally { R.ctx = main; }
    main.imageSmoothingEnabled = false;
    main.drawImage(this.cv, 0, 0, VW * K, VH * K);
    R.drawJoystick();
  },

  _draw(ctx, VW, VH, alpha) {
    const R = Render, S = this.VS, ia = 1 - alpha, rt = performance.now() / 1000;
    let camX = Player.px * ia + Player.x * alpha, camY = Player.py * ia + Player.y * alpha - 30;   // un po' più in alto: si vedono i tetti
    // la camera non esce dal villaggio (se la vista è più piccola del villaggio)
    const hvw = VW / S / 2, hvh = VH / S / 2;
    if (hvw < this.W / 2) camX = Math.max(-this.W / 2 + hvw, Math.min(this.W / 2 - hvw, camX)); else camX = 0;
    if (hvh < this.H / 2) camY = Math.max(-this.H / 2 + hvh, Math.min(this.H / 2 - hvh, camY)); else camY = 0;
    const ox = (VW >> 1) - Math.round(camX * S), oy = (VH >> 1) - Math.round(camY * S);
    const X = (x) => Math.round(x * S) + ox, Y = (y) => Math.round(y * S) + oy;
    const fillW = (pat, x0, y0, x1, y1) => {   // rettangolo in coordinate di mondo con pattern ancorato
      ctx.setTransform(1, 0, 0, 1, ox, oy); ctx.fillStyle = pat;
      ctx.fillRect(Math.round(x0 * S), Math.round(y0 * S), Math.round((x1 - x0) * S), Math.round((y1 - y0) * S));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };

    // fuori dal villaggio: buio; poi erba, piazza, sentiero, terra dei giardini
    ctx.fillStyle = '#030305'; ctx.fillRect(0, 0, VW, VH);
    fillW(R.floorPats.village, -this.W / 2, -this.H / 2, this.W / 2, this.H / 2);
    fillW(R.floorPats.plaza, -720, -185, 720, 20);
    fillW(R.floorPats.plaza, -40, 20, 40, 330);
    ctx.fillStyle = '#1c1925';
    ctx.fillRect(X(-720), Y(-185), Math.round(1440 * S), 1); ctx.fillRect(X(-720), Y(20), Math.round(680 * S), 1); ctx.fillRect(X(40), Y(20), Math.round(680 * S), 1);
    // bordo del villaggio che sfuma nel buio
    ctx.fillStyle = R.pat(PAL.k);
    const bx0 = X(-this.W / 2), by0 = Y(-this.H / 2), bw = Math.round(this.W * S), bh = Math.round(this.H * S);
    ctx.fillRect(bx0, by0, bw, 8); ctx.fillRect(bx0, by0 + bh - 8, bw, 8); ctx.fillRect(bx0, by0, 8, bh); ctx.fillRect(bx0 + bw - 8, by0, 8, bh);

    // portale (anelli viola che pulsano)
    const pxp = X(this.portal.x), pyp = Y(this.portal.y), pr = Math.round(this.portal.r * S) + 2;
    ctx.globalAlpha = 0.5; R.ditherDisk(pxp, pyp, pr + 2, R.pat(PAL.m)); ctx.globalAlpha = 1;
    for (let k = 0; k < 3; k++) R.circle(pxp, pyp, Math.max(2, Math.round(pr * (((rt * 0.8 + k / 3) % 1)))), k === 0 ? PAL[9] : PAL.p);

    // oggetti piatti (aiuole), poi tutto il resto ordinato per profondità (personaggio compreso)
    const list = this._list || (this._list = []);
    list.length = 0;
    for (const o of this.objs) {
      if (o.flat) { const s = SPR.cache[o.spr]; ctx.drawImage(s.img, X(o.x) - (s.w >> 1), Y(o.y) - (s.h >> 1)); continue; }
      list.push(o);
    }
    const me = this._me || (this._me = { player: true, x: 0, y: 0 });
    me.y = Player.py * ia + Player.y * alpha + 8; me.px = Player.px * ia + Player.x * alpha;  // y = piedi
    list.push(me);
    list.sort((a, b) => a.y - b.y);
    const ready = Save.questsReady() > 0;
    const hi = this._hi || (this._hi = []);
    hi.length = 0;

    for (const o of list) {
      if (o.player) {
        // il personaggio si disegna dopo, in alta risoluzione (qui solo l'ombra)
        const ps = Player.frame(rt);
        const bob = !Player.anim && Player.moving && (((rt * 8) | 0) & 1) ? 1 : 0;
        const ppx = X(o.px), ppy = Y(o.y - 8);
        ctx.globalAlpha = 0.5; ctx.fillStyle = PAL.k; ctx.fillRect(ppx - 6, ppy + 9, 12, 2); ctx.globalAlpha = 1;
        hi.push({ e: ps, img: Player.facing < 0 ? ps.mir : ps.img, x: ppx, y: ppy - bob + (ps.hi ? -1 : 0), d: o.y });
        continue;
      }
      const s = SPR.cache[o.spr], sx = X(o.x), sy = Y(o.y);
      if (o.lamp) {   // lanterna con alone caldo che tremola
        ctx.globalAlpha = 0.16 + 0.05 * Math.sin(rt * 3 + o.x); R.ditherDisk(sx, sy - 11, 13, R.pat(PAL.G)); ctx.globalAlpha = 1;
      }
      if (o.npc && o.npc.house) {
        // abitante in alta risoluzione: respira (2 fotogrammi) e si gira verso di te
        const n = o.npc, face = Player.x < n.x, br = ((rt * 1.3 + n.x * 0.01) | 0) & 1;
        const e = SPR.cache[br ? o.spr + '_b' : o.spr] || s;
        ctx.globalAlpha = 0.5; ctx.fillStyle = PAL.k; ctx.fillRect(sx - 6, sy - 1, 12, 2); ctx.globalAlpha = 1;
        hi.push({ e, img: face ? e.mir : e.img, x: sx, y: sy - (e.hi ? e.h / 4 : e.h / 2), d: o.y });
      } else {
        ctx.globalAlpha = 0.45; ctx.fillStyle = PAL.k; ctx.fillRect(sx - (s.w >> 1) + 2, sy - 2, s.w - 4, 3); ctx.globalAlpha = 1;
        ctx.drawImage(s.img, sx - (s.w >> 1), sy - s.h);
      }
      if (o.house) {
        // alone delle lanterne, insegna di legno con l'icona del mestiere, fumo (solo dove c'è uno sfiato)
        // posizioni dentro lo sprite: s.lamps, s.sign = [x, y, su un palo], s.smoke (vedi SPR.initVillage)
        const n = o.house, hx = sx - (s.w >> 1), hy = sy - s.h, sg = SPR.cache[n.sign];
        for (const L of s.lamps) {
          ctx.globalAlpha = 0.14 + 0.05 * Math.sin(rt * 3 + L[0] + n.x0); R.ditherDisk(hx + L[0], hy + L[1], 7, R.pat(PAL.G)); ctx.globalAlpha = 1;
        }
        const qx = hx + s.sign[0] - 5, qy = hy + s.sign[1] - 5;
        ctx.fillStyle = PAL.g;
        if (s.sign[2]) ctx.fillRect(qx + 5, qy + 10, 1, sy - qy - 10);             // palo fino a terra
        else { ctx.fillRect(qx + 2, qy - 2, 1, 2); ctx.fillRect(qx + 8, qy - 2, 1, 2); }   // cordini
        ctx.fillStyle = PAL.f; ctx.fillRect(qx - 1, qy - 1, 13, 12);
        ctx.fillStyle = PAL[2]; ctx.fillRect(qx, qy, 11, 10); ctx.fillStyle = PAL[5]; ctx.fillRect(qx, qy, 11, 1);
        ctx.drawImage(sg.img, qx + 5 - (sg.w >> 1), qy + 5 - (sg.h >> 1));
        if (s.smoke) for (let k = 0; k < 4; k++) {
          const p = ((rt * 0.35 + k / 4 + n.x0 * 0.01) % 1);
          const fx = hx + s.smoke[0] + Math.round(Math.sin(p * 6 + k) * 2 + p * 6), fy = hy + s.smoke[1] - Math.round(p * 18);
          ctx.globalAlpha = 0.45 * (1 - p); R.ditherDisk(fx, fy, 1 + Math.round(p * 3), R.pat(n.id === 'smith' ? PAL.F : PAL[5])); ctx.globalAlpha = 1;
        }
      }
      // "!" su chi è vicino, o sulla bacheca se ci sono missioni da riscuotere
      const n = o.npc;
      if (n && (this.near === n || (n.id === 'board' && ready))) {
        const top = (n.house && s.hi ? sy - (s.h >> 1) : sy - s.h) - 9 - (((rt * 4) | 0) & 1);
        ctx.fillStyle = PAL.k; ctx.fillRect(sx - 2, top - 1, 5, 9);
        ctx.fillStyle = this.near === n ? PAL.w : PAL.Y; ctx.fillRect(sx - 1, top, 3, 5); ctx.fillRect(sx - 1, top + 6, 3, 2);
      }
    }
  },
};

// ============================================================================
// IL MAGISTER NELLA CATTEDRALE — un piccolo accampamento tra le rovine (MAGISTER_CAMP in 05_data_maps.js):
// tappeto, libri, una lanterna e il Magister. Ci arrivi camminando verso destra (circa un minuto);
// quando sei vicino appare "Parla con il Magister" (o Invio / E) e si apre la sua Schola, a partita ferma.
// ============================================================================
const Camp = {
  near: false, seen: false,
  _hd: { e: null, img: null, x: 0, y: 0 },

  here() { return G.scene === 'run' && G.mapId === MAGISTER_CAMP.map; },
  reset() { this.near = false; this.seen = false; },

  // ogni step: sei abbastanza vicino per parlarci? (e la prima volta che ti avvicini, un avviso)
  update() {
    if (G.mapId !== MAGISTER_CAMP.map) return;
    const C = MAGISTER_CAMP, dx = Player.x - C.x, dy = Player.y - C.y, d2 = dx * dx + dy * dy;
    const near = d2 < C.talkR * C.talkR;
    if (near !== this.near) { this.near = near; UI.runPrompt(near); }
    if (!this.seen && d2 < C.hintR * C.hintR) this.seen = true;
  },

  talk() {
    if (!this.near || G.state !== 'play') return;
    UI.openShop('magister', 'run');
  },

  _vis(S, ox, oy) {   // l'accampamento è (quasi) in vista?
    const C = MAGISTER_CAMP, x = Math.round(C.x * S) + ox, y = Math.round(C.y * S) + oy;
    return x > -80 && x < Render.W + 80 && y > -80 && y < Render.H + 80;
  },

  // per terra (sotto ai dannati, di notte nel buio): tappeto rosso, pila di libri, barile
  drawGround(ctx, S, ox, oy, rt) {
    if (!this._vis(S, ox, oy)) return;
    const C = MAGISTER_CAMP, x = Math.round(C.x * S) + ox, y = Math.round(C.y * S) + oy;
    // il Magister sta in piedi in mezzo al tappeto
    ctx.fillStyle = PAL.k; ctx.fillRect(x - 19, y - 7, 38, 13);
    ctx.fillStyle = PAL.B; ctx.fillRect(x - 18, y - 6, 36, 11);
    ctx.fillStyle = PAL.C; ctx.fillRect(x - 16, y - 4, 32, 7);
    ctx.fillStyle = PAL.K; for (let q = -14; q <= 14; q += 4) { ctx.fillRect(x + q, y - 6, 1, 1); ctx.fillRect(x + q, y + 4, 1, 1); }
    const br = SPR.cache.v_barrel, bk = SPR.cache.ico_book;
    if (br) ctx.drawImage(br.img, x + 24 - (br.w >> 1), y + 6 - br.h);
    if (bk) { ctx.drawImage(bk.img, x - 30 - (bk.w >> 1), y + 6 - bk.h); ctx.drawImage(bk.img, x - 29 - (bk.w >> 1), y + 1 - bk.h); }
  },

  // la lanterna e il suo alone (sopra al velo della notte: di notte l'accampamento si vede da lontano)
  drawLit(ctx, S, ox, oy, rt) {
    if (!this._vis(S, ox, oy)) return;
    const C = MAGISTER_CAMP, x = Math.round(C.x * S) + ox, y = Math.round(C.y * S) + oy, lx = x - 16, ly = y - 4;
    ctx.globalAlpha = 0.16 + 0.05 * Math.sin(rt * 3) + 0.16 * G.nightK;   // di notte l'alone si allarga: un faro tra le rovine
    Render.ditherDisk(lx, ly - 10, 26 + Math.round(20 * G.nightK), Render.pat(PAL.G));
    ctx.globalAlpha = 1;
    const ln = SPR.cache.lantern;
    if (ln) ctx.drawImage(ln.img, lx - (ln.w >> 1), ly - ln.h + 4);
  },

  // il Magister in alta risoluzione (lo disegna Render.present): respira e si gira verso di te
  hd(S, ox, oy, rt) {
    if (!this._vis(S, ox, oy)) return null;
    const C = MAGISTER_CAMP, br = ((rt * 1.3) | 0) & 1, e = SPR.cache[br ? 'npc_magister_b' : 'npc_magister'] || SPR.cache.npc_magister;
    if (!e) return null;
    const H = this._hd, face = Player.x < C.x;
    H.e = e; H.img = face ? e.mir : e.img;
    H.x = Math.round(C.x * S) + ox; H.y = Math.round(C.y * S) + oy - (e.hi ? e.h / 4 : e.h / 2);
    return H;
  },
};
