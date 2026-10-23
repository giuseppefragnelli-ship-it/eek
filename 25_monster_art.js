'use strict';
// js/25_monster_art.js — MonsterArt: carica assets/monsters.png e rimpiazza gli sprite

// ============================================================================
// MOSTRI DISEGNATI — sostituiscono gli sprite generati da codice di nemici e boss.
// Un solo atlante PNG a DOPPIA risoluzione (2 pixel reali per pixel del gioco, bordo nero incluso).
// MONSTER_RECTS: nome sprite -> [x, y, w, h, guarda a destra (1) / di fronte (0)]
// Se l'immagine non si carica, il gioco usa gli sprite di prima.
// ============================================================================
const MONSTER_ATLAS = 'monsters.png';   // immagine separata (prima era incollata qui come testo)
const MONSTER_RECTS = {"boss_primal":[0,0,286,296,0],"boss_minosse":[287,0,216,296,0],"boss_minotauro":[504,0,248,296,0],"boss_caronte":[753,0,308,284,0],"boss_capaneo":[1062,0,194,284,0],"boss_lonza":[1257,0,222,284,1],"boss_medusa":[1480,0,210,284,0],"boss_anteo":[1691,0,332,284,0],"boss_pluto":[0,297,270,272,0],"boss_lupa":[271,297,332,262,1],"boss_cerbero":[604,297,332,250,1],"boss_storm":[937,297,304,244,0],"boss_lucifero":[1242,297,340,218,0],"boss_gerione":[1583,297,332,210,0],"boss_black":[0,570,304,206,0],"slime_elite":[305,570,74,88,0],"slime_heavy":[380,570,48,72,0],"slime_spitter":[429,570,70,70,1],"slime_gelido":[500,570,50,70,0],"slime_spitter_d":[551,570,44,70,0],"ghost_d":[596,570,78,70,0],"slime_heavy_d":[675,570,68,68,0],"ghost":[744,570,56,64,0],"slime_furia":[801,570,44,64,0],"slime_lupa":[846,570,76,60,1],"slime_fast_d":[923,570,64,48,0],"slime_toxic_d":[988,570,60,48,1],"slime_fast":[1049,570,64,42,0],"slime_toxic":[1114,570,48,34,0],"slime_drop_d":[1163,570,28,32,0],"slime_drop":[1192,570,30,20,0]};
// MOSTRI IN FILE A PARTE (stessa doppia risoluzione): nome sprite -> file. Il TESCHIO viola (Calvaria) arriva dopo il minuto 11.
// La TESTA della Morte (death.png) è ritagliata dal suo ritratto (death_portrait.jpg, si vede quando arriva e quando ti uccide).
const MONSTER_FILES = { mob_skull: 'skull.png', death_head: 'death.png' };
const MonsterArt = {
  img: null,
  files: {},
  load(cb) {
    const names = Object.keys(MONSTER_FILES);
    let left = 1 + names.length, done = false;
    const go = () => { if (!done) { done = true; cb(); } };
    const one = () => { if (--left <= 0) go(); };
    const im = new Image();
    im.onload = () => { this.img = im; one(); };
    im.onerror = one;
    im.src = MONSTER_ATLAS;
    for (const n of names) {
      const f = new Image();
      f.onload = () => { this.files[n] = f; one(); };
      f.onerror = one;
      f.src = MONSTER_FILES[n];
    }
    setTimeout(go, 4000);   // mai bloccare l'avvio
  },
  // fotogramma "schiacciato" (come SPR._squash, ma con i pixel doppi)
  _squash(src) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, -2, 4, src.width + 4, src.height - 4);
    return c;
  },
  // da chiamare dopo SPR.init(): rimpiazza le voci della cache
  apply() {
    const sil = (c, col) => SPR._silhouette(c, col);
    const rects = Object.assign({}, this.img ? MONSTER_RECTS : {});
    for (const n in this.files) rects[n] = [0, 0, this.files[n].width, this.files[n].height, 0];
    for (const name in rects) {
      const [x, y, w, h, face] = rects[name];
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(this.files[name] || this.img, x, y, w, h, 0, 0, w, h);
      // w, h = misura nel gioco (metà dei pixel reali): il canvas a doppia risoluzione li disegna nitidi
      const lw = w >> 1, lh = h >> 1;
      const e = { img: c, w: lw, h: lh, art: true, face: face || 0, flash: sil(c, FLASH) };
      e.img2 = this._squash(c); e.flash2 = sil(e.img2, FLASH);
      e.mir = SPR._mirror(c); e.mir2 = SPR._mirror(e.img2); e.mirFlash = sil(e.mir, PAL.C);
      // versione specchiata (per chi si gira verso di te)
      if (face) e.m = { img: e.mir, img2: e.mir2, flash: sil(e.mir, FLASH), flash2: sil(e.mir2, FLASH), w: lw, h: lh };
      SPR.cache[name] = e;
      SPR.url[name] = c.toDataURL();
    }
    // preavviso della carica (lampeggio rosso)
    for (const [n, col] of [['slime_elite', PAL.D], ['slime_lupa', PAL.D], ['boss_black', '#3a0a12']]) {
      const e = SPR.cache[n];
      if (!e || !e.art) continue;
      e.tell = sil(e.img, col); e.tell2 = sil(e.img2, col);
      if (e.m) { e.m.tell = sil(e.m.img, col); e.m.tell2 = sil(e.m.img2, col); }
    }
    // se skull.png non si carica, il teschio usa lo spettro
    if (!SPR.cache.mob_skull) SPR.cache.mob_skull = SPR.cache.ghost;
    this.cute();
    // GOAT (Sicilia, in alto): la sagoma del Minotauro tutta nera, nient'altro
    const mino = SPR.cache.boss_minotauro;
    if (mino && mino.art) SPR.cache.goat = { img: sil(mino.img, '#000'), w: mino.w, h: mino.h };
    // LA MORTE (minuto 14): la sua testa (death.png); se manca, Caronte sbiancato come un osso
    const head = SPR.cache.death_head, car = SPR.cache.boss_caronte;
    if (head && head.art) SPR.cache.death = { img: head.img, mir: head.mir, w: head.w, h: head.h, head: true };
    else if (car && car.art) {
      const c = document.createElement('canvas'); c.width = car.img.width; c.height = car.img.height;
      const g = c.getContext('2d'); g.drawImage(car.img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
      for (let k = 0; k < p.length; k += 4) {
        const l = p[k] * 0.3 + p[k + 1] * 0.59 + p[k + 2] * 0.11, v = l < 40 ? l * 0.4 : Math.min(255, 70 + l * 1.15);
        p[k] = v; p[k + 1] = v; p[k + 2] = Math.min(255, v + 12);
      }
      g.putImageData(d, 0, 0);
      SPR.cache.death = { img: c, mir: SPR._mirror(c), w: car.w, h: car.h };
    }
  },

  // SLIME SIMPATICI (Sicilia, MAPS.cripta.cute): verdi, occhioni lucidi, guance rosa, sorriso.
  // Disegnati da codice su una griglia (w x h) e ingranditi: 1 pixel della griglia = 2 pixel del gioco.
  // Sprite 'cute_<id nemico>': il disegno li usa al posto di quelli normali quando la mappa ha `cute`.
  //   ramp = [luce, chiaro, medio, scuro] | extra = 'leaf' (fogliolina), 'bow' (fiocco), 'crown' (coroncina gialla)
  CUTE: {
    drop:    { w: 10, h: 9,  ramp: ['#d9ff9c', '#8cf25a', '#46c43c', '#237a2c'] },
    fast:    { w: 12, h: 11, ramp: ['#efffb0', '#b8f54a', '#6fcf2e', '#3b8a22'], extra: 'leaf' },
    heavy:   { w: 20, h: 16, ramp: ['#c4ffa0', '#5fdc58', '#2f9e45', '#17602c'] },
    spitter: { w: 14, h: 13, ramp: ['#c9fff0', '#62e8b0', '#2bb07a', '#156a4a'], extra: 'bow' },
    elite:   { w: 24, h: 20, ramp: ['#d6ff8a', '#7fe03a', '#3fa02a', '#1f5e1a'], extra: 'crown' },
  },
  cute() {
    const OUT = '#0b2a12', EYE = '#ffffff', PUP = '#10140c', CHEEK = '#ff6fae', MOUTH = '#3a0f1c';
    for (const id in this.CUTE) {
      const C = this.CUTE[id], w = C.w, h = C.h, top = C.extra ? 3 : 0, H = h + top;
      const g = []; for (let y = 0; y < H; y++) g.push(new Array(w).fill(null));
      const set = (x, y, c) => { if (x >= 0 && x < w && y >= 0 && y < H) g[y][x] = c; };
      // corpo: cupola morbida con quattro toni (luce in alto a sinistra)
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = (x + 0.5) / w * 2 - 1, t = (h - (y + 0.5)) / (h * 0.95);
        if (u * u + t * t > 1) continue;
        let s = 0.45 - 0.3 * u + 0.5 * t; if (y === h - 1) s -= 0.3;
        set(x, y + top, C.ramp[3 - Math.max(0, Math.min(3, Math.floor(s * 4)))]);
      }
      // riflesso lucido
      const hx = Math.round(w * 0.24), hy = top + Math.round(h * 0.22);
      set(hx, hy, '#ffffff'); set(hx + 1, hy, '#ffffff'); set(hx, hy + 1, '#ffffff');
      // occhioni (2x3 bianchi, pupilla in basso, scintilla) + guance rosa + sorriso
      const ey = top + Math.round(h * 0.45), ex = [Math.round(w * 0.3), Math.round(w * 0.62)];
      for (const x0 of ex) {
        for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 2; dx++) set(x0 + dx, ey + dy, EYE);
        set(x0, ey + 1, PUP); set(x0 + 1, ey + 1, PUP); set(x0, ey + 2, PUP); set(x0 + 1, ey + 2, PUP);
        set(x0 + 1, ey + 1, EYE);
        set(x0 - 1, ey + 3, CHEEK);
      }
      set(ex[1] + 2, ey + 3, CHEEK);
      const my = ey + 3, mx0 = ex[0] + 2, mx1 = ex[1] - 1;
      for (let x = mx0; x <= mx1; x++) set(x, my + (x === mx0 || x === mx1 ? 0 : 1), MOUTH);
      // dettagli: fogliolina, fiocco rosa, coroncina gialla
      const cx = w >> 1;
      if (C.extra === 'leaf') { set(cx, top - 1, '#2f9a3a'); set(cx, top - 2, '#6fcf2e'); set(cx + 1, top - 3, '#b8f54a'); set(cx + 1, top - 2, '#b8f54a'); }
      if (C.extra === 'bow') { for (const [dx, dy] of [[-2, -1], [-1, 0], [0, -1], [1, 0], [2, -1], [-2, 0], [2, 0]]) set(cx + dx, top + dy, '#ff2e88'); set(cx, top, '#ffd1e6'); }
      if (C.extra === 'crown') { for (let x = cx - 3; x <= cx + 3; x++) set(x, top, '#f0ff1a'); for (const dx of [-3, 0, 3]) { set(cx + dx, top - 1, '#f0ff1a'); set(cx + dx, top - 2, '#f0ff1a'); } set(cx, top - 1, '#ff2e88'); }
      // contorno scuro attorno a tutto
      const outl = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) {
        if (g[y][x]) continue;
        if ((x > 0 && g[y][x - 1]) || (x < w - 1 && g[y][x + 1]) || (y > 0 && g[y - 1][x]) || (y < H - 1 && g[y + 1][x])) outl.push([x, y]);
      }
      // canvas a 4 pixel reali per pixel della griglia (= 2 pixel del gioco), con 1 pixel di bordo
      const P = 4, c = document.createElement('canvas'); c.width = (w + 2) * P; c.height = (H + 2) * P;
      const ctx = c.getContext('2d');
      ctx.fillStyle = OUT; for (const [x, y] of outl) ctx.fillRect((x + 1) * P, (y + 1) * P, P, P);
      for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) if (g[y][x]) { ctx.fillStyle = g[y][x]; ctx.fillRect((x + 1) * P, (y + 1) * P, P, P); }
      const sil = (cv, col) => SPR._silhouette(cv, col), lw = c.width >> 1, lh = c.height >> 1;
      const e = { img: c, w: lw, h: lh, art: true, face: 0, flash: sil(c, FLASH) };
      e.img2 = this._squash(c); e.flash2 = sil(e.img2, FLASH);
      e.mir = SPR._mirror(c); e.mir2 = SPR._mirror(e.img2); e.mirFlash = sil(e.mir, PAL.C);
      if (id === 'elite') { e.tell = sil(c, PAL.D); e.tell2 = sil(e.img2, PAL.D); }
      SPR.cache['cute_' + id] = e;
      SPR.url['cute_' + id] = c.toDataURL();
    }
  },
};
