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
const MonsterArt = {
  img: null,
  load(cb) {
    const im = new Image();
    let done = false;
    const go = () => { if (!done) { done = true; cb(); } };
    im.onload = () => { this.img = im; go(); };
    im.onerror = go;
    setTimeout(go, 4000);   // mai bloccare l'avvio
    im.src = MONSTER_ATLAS;
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
    if (!this.img) return;
    const sil = (c, col) => SPR._silhouette(c, col);
    for (const name in MONSTER_RECTS) {
      const [x, y, w, h, face] = MONSTER_RECTS[name];
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(this.img, x, y, w, h, 0, 0, w, h);
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
  },
};
