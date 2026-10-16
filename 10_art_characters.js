'use strict';
// js/10_art_characters.js — Doll: personaggi e abitanti ad alta risoluzione

// ============================================================================
// DOLL — personaggi ad ALTA RISOLUZIONE (il doppio dei pixel del resto del
// gioco). Invece di disegnarli pixel per pixel, ogni personaggio è un
// "manichino": forme (ellissi, poligoni, arti) disegnate in una posa, poi
// QUANTIZZATE nella palette del gioco (niente sfumature) e contornate.
// Così ogni animazione è solo una posa diversa: angoli di gambe e braccia,
// quanto svolazza il soprabito, dove va la coda di cavallo...
//
// Gli sprite "hi" hanno e.hi = true: Render.present() li disegna sul canvas
// a doppia risoluzione (1 pixel dello sprite = mezzo pixel del gioco).
// ============================================================================

// due toni della pelle in più per i volti grandi
PAL['%'] = '#c79a78';   // pelle in luce
PAL['&'] = '#7d5440';   // pelle in ombra

const Doll = {
  _rgb: {},

  canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.lineCap = 'round'; g.lineJoin = 'round';
    return { c, g };
  },
  col(g, k) { g.fillStyle = PAL[k]; g.strokeStyle = PAL[k]; },
  ell(g, k, x, y, rx, ry, rot) { this.col(g, k); g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); g.fill(); },
  poly(g, k, pts) {
    this.col(g, k); g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath(); g.fill();
  },
  line(g, k, x0, y0, x1, y1, w) { this.col(g, k); g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); },
  // arto a due segmenti: ritorna il punto finale
  limb(g, x, y, a1, l1, a2, l2, w, k1, k2) {
    const kx = x + Math.sin(a1) * l1, ky = y + Math.cos(a1) * l1;
    const ex = kx + Math.sin(a2) * l2, ey = ky + Math.cos(a2) * l2;
    this.line(g, k1, x, y, kx, ky, w);
    this.line(g, k2 || k1, kx, ky, ex, ey, w * 0.9);
    return { kx, ky, ex, ey };
  },

  // canvas -> griglia di chiavi della palette (solo i colori ammessi), poi registrato come sprite
  finish(name, c, keys, opts) {
    const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
    const rgb = keys.map((k) => { const v = PAL[k]; return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)]; });
    const grid = SPR._grid(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 120) continue;
      let best = 0, bd = 1e9;
      for (let q = 0; q < rgb.length; q++) {
        const dr = d[i] - rgb[q][0], dg = d[i + 1] - rgb[q][1], db = d[i + 2] - rgb[q][2], dd = dr * dr * 3 + dg * dg * 4 + db * db * 2;
        if (dd < bd) { bd = dd; best = q; }
      }
      grid[y][x] = keys[best];
    }
    const e = SPR._register(name, grid, Object.assign({ mirror: true, outline2: true }, opts || {}));
    e.hi = true;
    e.hurtImg = SPR._silhouette(e.img, PAL.C);
    e.dashImg = SPR._silhouette(e.img, PAL.o); e.dashMir = SPR._silhouette(e.mir, PAL.o);
    return e;
  },

  // ---------------------------------------------------------------------------
  // EEK — mezzo ninja: coda di cavallo castana, benda grigia, sciarpa viola,
  // soprabito grigio col bordo viola, bende sugli avambracci, kunai.
  // Guarda a destra. p = posa.
  // ---------------------------------------------------------------------------
  eek(name, p) {
    const W = 38, H = 52, { c, g } = this.canvas(W, H);
    const bob = p.bob || 0, lean = p.lean || 0, fl = p.coat || 0;
    const hipX = 18, hipY = 31 + bob, shX = 19 + lean, shY = 19 + bob;
    const hx = 20 + lean, hy = 10 + bob;                                  // centro della testa

    // coda di cavallo (dietro a tutto): ciocca che si assottiglia e ondeggia
    const ta = p.tail || 0;
    const tx0 = hx - 5, ty0 = hy - 4;
    const tx1 = tx0 - 6 - ta * 3, ty1 = ty0 + 4 - ta * 2, tx2 = tx0 - 9 - ta * 5, ty2 = ty0 + 12 - ta * 4;
    this.poly(g, 'g', [tx0, ty0 - 2, tx1, ty1 - 2, tx2, ty2, tx1 + 2, ty1 + 3, tx0 + 1, ty0 + 3]);
    this.line(g, 'X', tx1 + 1, ty1 + 1, tx2 + 1, ty2 - 1, 1.2);
    this.line(g, 'h', tx0 - 1, ty0 - 1, tx1, ty1 - 1, 1);
    // code della benda che svolazzano
    this.line(g, '7', tx0 + 1, hy - 3, tx0 - 6 - ta * 2, hy - 1 + ta, 1.3);
    this.line(g, '6', tx0 + 1, hy - 2, tx0 - 5 - ta * 3, hy + 2 + ta, 1.2);

    // gamba dietro (più scura)
    const lb = p.legB || [0.15, 0.05];
    const LB = this.limb(g, hipX - 1, hipY, lb[0], 8.5, lb[1], 8.5, 4.6, 'v', 'v');
    this.line(g, '5', LB.kx + (LB.ex - LB.kx) * 0.5, LB.ky + (LB.ey - LB.ky) * 0.5, LB.ex, LB.ey - 0.5, 3.6);
    this.ell(g, '3', LB.ex + 1.5, LB.ey + 1, 3, 1.6);
    // braccio dietro
    const ab = p.armB || [-0.25, -0.5];
    const AB = this.limb(g, shX - 2, shY + 1, ab[0], 7, ab[1], 6.5, 4, '3', '6');
    this.ell(g, '&', AB.ex, AB.ey, 1.7, 1.7);

    // soprabito: pannello dietro (svolazza con la corsa)
    const hemY = 43 + bob;
    this.poly(g, '3', [shX - 4, shY - 1, shX + 3, shY - 1, hipX + 3, hipY, hipX + 2, hemY, hipX - 4 - fl * 9, hemY - fl * 5, hipX - 5 - fl * 3, hipY + 2]);
    this.poly(g, '4', [shX - 3, shY, shX + 3, shY, hipX + 2, hipY, hipX + 1, hemY - 1, hipX - 2 - fl * 6, hemY - 1 - fl * 4, hipX - 3 - fl * 2, hipY + 1]);
    this.line(g, 'o', hipX - 4 - fl * 9, hemY - fl * 5, hipX + 2, hemY, 1.6);   // bordo viola sull'orlo
    // busto: maglia scura e cintura
    this.poly(g, '1', [shX - 3, shY, shX + 4, shY, hipX + 4, hipY, hipX - 2, hipY]);
    this.line(g, 'h', hipX - 2, hipY - 2, hipX + 4, hipY - 2, 1.8);

    // gamba davanti
    const lf = p.legF || [-0.1, 0.05];
    const LF = this.limb(g, hipX + 2, hipY, lf[0], 8.5, lf[1], 8.5, 5, 'x', 'x');
    this.line(g, '7', LF.kx + (LF.ex - LF.kx) * 0.5, LF.ky + (LF.ey - LF.ky) * 0.5, LF.ex, LF.ey - 0.5, 3.8);
    this.line(g, '6', LF.kx + (LF.ex - LF.kx) * 0.62, LF.ky + (LF.ey - LF.ky) * 0.62, LF.kx + (LF.ex - LF.kx) * 0.66, LF.ky + (LF.ey - LF.ky) * 0.66, 3.8);
    this.ell(g, '4', LF.ex + 1.8, LF.ey + 1, 3.2, 1.7);
    // lembo davanti del soprabito (copre l'anca) con il bordo viola
    this.poly(g, '5', [shX + 1, shY, shX + 5, shY, hipX + 5, hipY - 1, hipX + 4, hemY - 3 - fl * 2, hipX + 1, hemY - 2 - fl * 2, hipX + 1, hipY]);
    this.line(g, 'p', shX + 5, shY + 1, hipX + 5, hipY - 1, 1.4);
    this.line(g, 'p', hipX + 5, hipY - 1, hipX + 4, hemY - 3 - fl * 2, 1.4);

    // braccio davanti (o teso per il lancio)
    const af = p.armF || [0.25, 0.4];
    const AF = this.limb(g, shX + 2, shY + 1, af[0], 7, af[1], 6.5, 4.2, '5', '8');
    this.line(g, '7', AF.kx + (AF.ex - AF.kx) * 0.5, AF.ky + (AF.ey - AF.ky) * 0.5, AF.kx + (AF.ex - AF.kx) * 0.55, AF.ky + (AF.ey - AF.ky) * 0.55, 3.6);
    this.ell(g, 'S', AF.ex, AF.ey, 1.9, 1.9);
    if (p.kunai) {   // kunai in mano
      this.poly(g, '9', [AF.ex + 1, AF.ey - 1, AF.ex + 7, AF.ey, AF.ex + 1, AF.ey + 1]);
      this.line(g, '6', AF.ex - 2, AF.ey, AF.ex, AF.ey, 1.2);
    }

    // testa: capelli dietro, viso, frangia, benda, occhio, sciarpa
    this.ell(g, 'X', hx - 1.2, hy - 0.5, 7.1, 7.1);
    this.ell(g, 'g', hx - 1, hy - 1, 6.8, 6.7);
    this.ell(g, 'S', hx + 1.8, hy + 1.6, 5.2, 5.3);
    this.ell(g, '%', hx + 3, hy + 0.6, 2.4, 2.8);
    this.poly(g, 'g', [hx - 6, hy - 3, hx - 1, hy - 7.5, hx + 5.5, hy - 5, hx + 6, hy - 1.5, hx + 3.5, hy - 2.6, hx + 2.6, hy + 0.5, hx + 1, hy - 2.5, hx - 1.5, hy + 1, hx - 3, hy + 4]);
    this.line(g, 'h', hx - 3, hy - 5.5, hx + 3.5, hy - 5, 1.2);
    this.line(g, '7', hx - 5.5, hy - 3, hx + 6, hy - 3.6, 2.4);              // benda
    this.line(g, '9', hx - 3, hy - 4, hx + 5.5, hy - 4.4, 0.9);
    this.ell(g, '0', hx + 4, hy + 0.6, 1.1, 1.6);                            // occhio
    this.ell(g, '9', hx + 4.4, hy + 0.1, 0.5, 0.5);
    this.line(g, 'X', hx + 2.6, hy - 1.6, hx + 5.4, hy - 1.9, 0.9);          // sopracciglio
    this.poly(g, 'n', [hx - 1, hy + 3, hx + 6.8, hy + 2.5, hx + 6.2, hy + 6, hx + 2, hy + 7.5, hx - 2, hy + 6]);   // sciarpa sul viso
    this.line(g, 'o', hx - 0.5, hy + 3.4, hx + 6.5, hy + 2.9, 1);
    this.poly(g, 'm', [hx - 3, hy + 5.5, hx + 1, hy + 7.5, hx - 5 - ta * 2, hy + 9 + ta, hx - 7 - ta * 3, hy + 7 + ta]);   // lembo della sciarpa
    return this.finish(name, c, ['0', '1', '3', '4', '5', '6', '7', '8', '9', 'X', 'g', 'h', 'S', '%', '&', 'v', 'x', 'n', 'o', 'p', 'm']);
  },

  // ---------------------------------------------------------------------------
  // ABITANTI DEL VILLAGGIO — Giappone dell'anno Mille (epoca Heian)
  // Guardano a destra. b = respiro (0/1)
  // ---------------------------------------------------------------------------
  // base comune: corpo con veste lunga a maniche larghe
  _robe(g, b, o) {
    const sx = 17, sy = 20 + b;                        // spalle
    // hakama / veste: si allarga verso i piedi
    this.poly(g, o.lowD, [sx - 6, sy + 9, sx + 7, sy + 9, sx + 9, 47, sx - 8, 47]);
    this.poly(g, o.low, [sx - 4, sy + 9, sx + 7, sy + 9, sx + 8, 46, sx - 3, 46]);
    for (let k = 0; k < 3; k++) this.line(g, o.lowD, sx - 2 + k * 3.5, sy + 12, sx - 2 + k * 4, 45, 0.8);   // pieghe
    // piedi (calzature di paglia/legno)
    this.ell(g, '4', sx - 3, 47.5, 3, 1.4); this.ell(g, '5', sx + 5, 47.5, 3, 1.4);
    // busto
    this.poly(g, o.topD, [sx - 6, sy, sx + 6, sy, sx + 7, sy + 11, sx - 7, sy + 11]);
    this.poly(g, o.top, [sx - 3, sy, sx + 6, sy, sx + 7, sy + 11, sx - 2, sy + 11]);
    // colletto a V a strati
    this.poly(g, o.collar2 || '9', [sx - 1, sy - 0.5, sx + 4, sy - 0.5, sx + 1.5, sy + 6]);
    this.poly(g, o.collar || '8', [sx, sy - 0.5, sx + 3, sy - 0.5, sx + 1.5, sy + 3.5]);
    // cintura (obi)
    this.line(g, o.obi, sx - 6, sy + 10, sx + 7, sy + 10, 2.6);
    // manica larga che pende
    if (!o.noSleeve) {
      this.poly(g, o.topD, [sx + 2, sy + 1, sx + 7, sy + 1, sx + 9, sy + 15, sx + 3, sy + 16]);
      this.poly(g, o.top, [sx + 3, sy + 1, sx + 7, sy + 1, sx + 8, sy + 14, sx + 4, sy + 15]);
      this.line(g, o.topD, sx + 3, sy + 15.5, sx + 9, sy + 14.5, 1);
    }
    return { sx, sy };
  },
  _head(g, hx, hy, o) {
    this.ell(g, '&', hx - 0.5, hy + 0.5, 5, 5.4);
    this.ell(g, 'S', hx, hy, 4.8, 5.2);
    this.ell(g, '%', hx + 1.6, hy - 0.8, 2, 2.4);
    this.ell(g, '0', hx + 2.4, hy - 0.2, 0.8, 0.9);                        // occhio
    this.line(g, '&', hx + 3.2, hy + 2.6, hx + 4.4, hy + 2.6, 0.8);        // bocca
    this.line(g, '&', hx + 4.6, hy - 0.2, hx + 5.2, hy + 1.2, 0.8);        // naso
  },

  npcSmith(name, b) {   // FABBRO (kaji): fascia hachimaki, crocchia, barba grigia, maniche legate, grembiule di cuoio, martello
    const { c, g } = this.canvas(34, 50);
    const { sx, sy } = this._robe(g, b, { low: 'v', lowD: '0', top: 'x', topD: 'v', obi: '4', noSleeve: true, collar: '7', collar2: '6' });
    this.poly(g, 'g', [sx - 5, sy + 4, sx + 6, sy + 4, sx + 7, sy + 24, sx - 4, sy + 24]);   // grembiule
    this.line(g, 'f', sx - 4, sy + 23.5, sx + 7, sy + 23.5, 1);
    // braccio nudo muscoloso che regge il martello
    this.line(g, 'x', sx + 4, sy + 1, sx + 7, sy + 6, 4);                     // manica legata (tasuki)
    this.line(g, 'S', sx + 7, sy + 6, sx + 9, sy + 12, 3.6);
    this.line(g, 'h', sx + 10, sy + 14, sx + 10, sy + 1, 1.6);                // manico
    this.poly(g, '6', [sx + 7, sy - 1, sx + 13, sy - 1, sx + 13, sy + 3, sx + 7, sy + 3]);   // testa del martello
    this.line(g, '8', sx + 7, sy - 0.5, sx + 13, sy - 0.5, 0.8);
    this.ell(g, 'S', sx + 9.5, sy + 13, 2, 2);
    const hx = sx + 1, hy = sy - 8;
    this._head(g, hx, hy, {});
    this.ell(g, '1', hx - 1.5, hy - 3.5, 4.8, 2.6);                           // capelli
    this.ell(g, '1', hx - 2.5, hy - 7, 1.8, 1.6);                             // crocchia
    this.line(g, '9', hx - 4.8, hy - 2.2, hx + 4.6, hy - 2.8, 1.8);           // hachimaki
    this.line(g, '9', hx - 4.8, hy - 2.2, hx - 7.5, hy + 0.5, 1);
    this.poly(g, '6', [hx - 1, hy + 2, hx + 4.8, hy + 2.5, hx + 3, hy + 6.5, hx, hy + 6]);     // barba
    this.line(g, '7', hx + 0.5, hy + 3, hx + 4, hy + 3.3, 0.7);
    return this.finish(name, c, ['0', '1', '4', '5', '6', '7', '8', '9', 'S', '%', '&', 'v', 'x', 'g', 'f', 'h']);
  },

  npcWeapons(name, b) {   // ARMAIOLO: eboshi nero alto, hitatare rosso scuro, hakama, tachi alla cintura
    const { c, g } = this.canvas(34, 52);
    const { sx, sy } = this._robe(g, b, { low: 'B', lowD: 'A', top: 'C', topD: 'B', obi: '1', collar: '8', collar2: 'L' });
    // tachi: fodero nero con finiture d'oro, curvo, appeso al fianco
    this.line(g, '1', sx - 7, sy + 13, sx + 2, sy + 9.5, 2.2);
    this.line(g, 'K', sx + 2, sy + 9.5, sx + 4, sy + 8.6, 2.4);
    this.line(g, '4', sx + 4, sy + 8.6, sx + 8, sy + 7, 1.8);                 // impugnatura
    this.ell(g, 'S', sx + 6, sy + 15, 1.8, 1.8);
    const hx = sx + 1, hy = sy - 8;
    this._head(g, hx, hy, {});
    this.ell(g, '0', hx - 1.8, hy - 3, 4.6, 2.6);                             // capelli
    // eboshi: cappello alto e morbido, piegato in avanti
    this.poly(g, '1', [hx - 4.5, hy - 3.5, hx + 3, hy - 3.8, hx + 4.5, hy - 9, hx + 1, hy - 15, hx - 3, hy - 13]);
    this.line(g, '4', hx - 2.5, hy - 12, hx + 2, hy - 8, 0.8);
    this.line(g, '1', hx + 3, hy + 3, hx + 3.6, hy + 5, 0.8);                 // baffetti
    return this.finish(name, c, ['0', '1', '4', '5', '8', '9', 'S', '%', '&', 'A', 'B', 'C', 'K', 'L']);
  },

  npcArmor(name, b) {   // CORAZZAIO: indossa una corazza a lamelle (o-yoroi) verde scuro allacciata d'oro
    const { c, g } = this.canvas(34, 50);
    const { sx, sy } = this._robe(g, b, { low: 'v', lowD: '0', top: 'b', topD: 'a', obi: 'K', collar: '9', collar2: 'C' });
    // lamelle della corazza: righe sul busto e sulla gonnella
    for (let r = 0; r < 4; r++) this.line(g, r & 1 ? 'c' : 'd', sx - 6, sy + 2 + r * 2.5, sx + 7, sy + 2 + r * 2.5, 1.6);
    for (let r = 0; r < 3; r++) this.line(g, r & 1 ? 'c' : 'd', sx - 7, sy + 13 + r * 2.6, sx + 8, sy + 13 + r * 2.6, 2);
    for (let k = 0; k < 5; k++) this.line(g, 'K', sx - 5 + k * 3, sy + 1, sx - 5 + k * 3, sy + 19, 0.5);   // lacci
    // spallaccio (sode)
    this.poly(g, 'c', [sx + 2, sy - 1, sx + 9, sy, sx + 10, sy + 8, sx + 3, sy + 8]);
    for (let r = 0; r < 3; r++) this.line(g, 'b', sx + 3, sy + 1.5 + r * 2.6, sx + 9.5, sy + 1.5 + r * 2.6, 0.7);
    this.ell(g, 'S', sx + 7, sy + 11, 1.8, 1.8);
    const hx = sx + 1, hy = sy - 8;
    this._head(g, hx, hy, {});
    this.ell(g, '6', hx - 1.5, hy - 3.4, 4.8, 2.6);                           // capelli grigi
    this.ell(g, '6', hx - 3, hy - 6.5, 1.6, 1.8);                             // crocchia
    this.line(g, '7', hx + 0.5, hy + 3.5, hx + 4, hy + 3.8, 0.9);             // baffi grigi
    return this.finish(name, c, ['0', '1', '6', '7', '8', '9', 'S', '%', '&', 'v', 'a', 'b', 'c', 'd', 'K', 'C', '4', '5']);
  },

  npcMagister(name, b) {   // MAGISTER: toga bianca col bordo porpora, barba lunga bianca, rotolo in mano
    const { c, g } = this.canvas(34, 50);
    const { sx, sy } = this._robe(g, b, { low: '8', lowD: '6', top: '9', topD: '7', obi: 'o', collar: 'p', collar2: '9' });
    this.line(g, 'o', sx - 6, sy + 2, sx + 6, sy + 18, 1.6);                  // clavus porpora
    this.line(g, 'h', sx + 4, sy + 11, sx + 11, sy + 11, 2.4);                // rotolo
    this.ell(g, 'j', sx + 11, sy + 11, 1.3, 1.6);
    this.ell(g, 'S', sx + 5, sy + 12, 1.7, 1.7);
    const hx = sx + 1, hy = sy - 8;
    this._head(g, hx, hy, {});
    this.ell(g, '8', hx - 2, hy - 3.6, 4.4, 2.2);                             // capelli bianchi
    this.poly(g, '9', [hx - 1.5, hy + 2, hx + 5, hy + 2.5, hx + 3, hy + 11, hx + 0.5, hy + 9]);   // barba lunga
    this.line(g, '8', hx + 0.5, hy + 3, hx + 4.5, hy + 3.3, 0.8);
    this.line(g, 'c', hx - 4.5, hy - 2.5, hx + 3.5, hy - 4, 1.2);             // corona d'alloro
    return this.finish(name, c, ['0', '1', '5', '6', '7', '8', '9', 'S', '%', '&', 'o', 'p', 'h', 'j', 'c']);
  },

  npcHaruspex(name, b) {   // ARUSPICE: tunica scura e cappuccio rosso, mantello, coppa con le viscere
    const { c, g } = this.canvas(34, 50);
    const { sx, sy } = this._robe(g, b, { low: '2', lowD: '1', top: 'B', topD: 'A', obi: 'K', collar: 'C', collar2: '3' });
    this.poly(g, 'A', [sx - 7, sy - 1, sx - 2, sy - 1, sx - 4, sy + 27, sx - 9, sy + 26]);   // mantello dietro
    this.line(g, 'L', sx + 3, sy + 10, sx + 12, sy + 10, 1.4);                // coppa
    this.poly(g, 'K', [sx + 5, sy + 6, sx + 11, sy + 6, sx + 10, sy + 10, sx + 6, sy + 10]);
    this.ell(g, 'D', sx + 8, sy + 6, 2.2, 1.2);                               // fegato
    this.ell(g, 'S', sx + 4, sy + 10.5, 1.7, 1.5);
    const hx = sx + 1, hy = sy - 8;
    this._head(g, hx, hy, {});
    this.poly(g, 'C', [hx - 6, hy + 4, hx - 6, hy - 3, hx - 1, hy - 7.5, hx + 4, hy - 6, hx + 5.5, hy - 2, hx + 2, hy - 3, hx - 2, hy + 1, hx - 3, hy + 6]);   // cappuccio
    this.line(g, 'B', hx - 5, hy + 3, hx - 1, hy - 6, 0.8);
    this.line(g, '1', hx + 2.5, hy + 4, hx + 3.2, hy + 7, 1.1);               // barbetta scura
    return this.finish(name, c, ['0', '1', '2', '3', '4', '5', 'S', '%', '&', 'A', 'B', 'C', 'D', 'K', 'L']);
  },

  npcInn(name, b) {   // LOCANDIERA: kimono a strati (viola, rosso, oro), capelli neri lunghissimi, vassoio col tè
    const { c, g } = this.canvas(34, 50);
    // capelli lunghissimi dietro, fino a terra (stile Heian)
    this.poly(g, '0', [10, 10 + b, 15, 9 + b, 15, 47, 7, 47, 8, 30]);
    this.line(g, '1', 11, 14 + b, 9.5, 44, 1);
    const { sx, sy } = this._robe(g, b, { low: 'o', lowD: 'n', top: 'o', topD: 'n', obi: 'L', collar: 'C', collar2: '9' });
    // strati dell'orlo (jūnihitoe)
    this.line(g, 'C', sx - 8, 46, sx + 9, 46, 1.4);
    this.line(g, 'L', sx - 8, 44.5, sx + 9, 44.5, 0.8);
    // vassoio con la tazza
    this.line(g, 'h', sx + 3, sy + 9, sx + 12, sy + 9, 1.6);
    this.poly(g, '8', [sx + 7, sy + 5, sx + 10, sy + 5, sx + 9.5, sy + 8, sx + 7.5, sy + 8]);
    this.ell(g, 'S', sx + 4, sy + 9.5, 1.7, 1.5);
    const hx = sx + 1, hy = sy - 8;
    this._head(g, hx, hy, {});
    this.ell(g, '0', hx - 1.5, hy - 2.8, 5, 3);                               // capelli con la riga in mezzo
    this.poly(g, '0', [hx + 0.5, hy - 5, hx + 4.5, hy - 2, hx + 2.5, hy - 1.8]);
    this.ell(g, 'C', hx + 3, hy + 2.7, 0.7, 0.4);                             // labbra rosse
    return this.finish(name, c, ['0', '1', '8', '9', 'S', '%', '&', 'n', 'o', 'C', 'L', 'h']);
  },

  // costruisce tutti gli sprite ad alta risoluzione
  init() {
    // EEK ad alta risoluzione (righe in eek_hi.js, contorno già incluso)
    for (const k in EEK_HI) {
      const e = SPR._register(k, SPR._fromRows(EEK_HI[k]), { outline: false, mirror: true });
      e.hi = true;
      e.hurtImg = SPR._silhouette(e.img, PAL.C);
      e.dashImg = SPR._silhouette(e.img, PAL.o); e.dashMir = SPR._silhouette(e.mir, PAL.o);
    }
    // abitanti del villaggio (2 fotogrammi di respiro)
    for (const [n, f] of [['npc_smith', 'npcSmith'], ['npc_weapons', 'npcWeapons'], ['npc_armor', 'npcArmor'], ['npc_inn', 'npcInn'], ['npc_magister', 'npcMagister'], ['npc_haruspex', 'npcHaruspex']]) {
      this[f](n, 0);
      this[f](n + '_b', 1);
    }
  },
};
