'use strict';
// js/13_grid.js — Grid: griglia spaziale per trovare i vicini

// ============================================================================
// SPATIAL GRID — liste concatenate in due Int32Array, ricostruita ogni step.
//
// head[cella] = primo nemico della cella (-1 se vuota)
// next[i]     = nemico successivo nella stessa cella
//
// Costo: build O(n), query O(nemici nelle celle toccate). Zero allocazioni.
// La grid segue la camera (il mondo è infinito): copre vista + margine.
// I nemici fuori dall'area coperta non vengono inseriti (sono lontani dal
// giocatore e vengono comunque riposizionati da enemies.js).
// ============================================================================

const Grid = {
  cell: CFG.GRID_CELL,
  inv: 1 / CFG.GRID_CELL,
  cols: 0, rows: 0,
  ox: 0, oy: 0,                        // angolo in alto a sinistra in coordinate mondo
  MAX_CELLS: 128 * 64,
  head: null,
  next: null,

  init() {
    this.head = new Int32Array(this.MAX_CELLS).fill(-1);   // vuota (0 sarebbe "il nemico 0")
    this.next = new Int32Array(CFG.MAX_ENEMIES).fill(-1);
  },

  // Chiamata a ogni resize: dimensiona la grid sulla vista.
  resize(viewW, viewH) {
    const m = CFG.GRID_MARGIN * 2;
    this.cols = Math.min(128, Math.ceil((viewW + m) / this.cell) + 1);
    this.rows = Math.min(64, Math.ceil((viewH + m) / this.cell) + 1);
  },

  build(E, cx, cy) {
    const cell = this.cell, inv = this.inv, cols = this.cols, rows = this.rows;
    // origine allineata alla cella (evita "tremolio" delle assegnazioni)
    this.ox = Math.floor((cx - (cols * cell) * 0.5) * inv) * cell;
    this.oy = Math.floor((cy - (rows * cell) * 0.5) * inv) * cell;
    const head = this.head, next = this.next, ox = this.ox, oy = this.oy;
    head.fill(-1, 0, cols * rows);
    const X = E.x, Y = E.y, A = E.alive, BIG = E.big, n = E.count;
    for (let i = 0; i < n; i++) {
      if (A[i] === 0 || BIG[i] !== 0) continue;
      const gx = ((X[i] - ox) * inv) | 0;
      const gy = ((Y[i] - oy) * inv) | 0;
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows || X[i] < ox || Y[i] < oy) { next[i] = -1; continue; }
      const c = gy * cols + gx;
      next[i] = head[c];
      head[c] = i;
    }
  },

  // Riempie `out` con gli indici dei nemici nelle celle toccate dal quadrato
  // centrato in (x,y) con semilato r. NON filtra per distanza: lo fa il chiamante.
  // Ritorna il numero di candidati.
  query(x, y, r, out) {
    const inv = this.inv, cols = this.cols, rows = this.rows;
    let x0 = ((x - r - this.ox) * inv) | 0, x1 = ((x + r - this.ox) * inv) | 0;
    let y0 = ((y - r - this.oy) * inv) | 0, y1 = ((y + r - this.oy) * inv) | 0;
    if (x - r < this.ox) x0 = 0;
    if (y - r < this.oy) y0 = 0;
    if (x1 >= cols) x1 = cols - 1;
    if (y1 >= rows) y1 = rows - 1;
    if (x0 > x1 || y0 > y1) return 0;
    const head = this.head, next = this.next, cap = out.length;
    let n = 0;
    for (let gy = y0; gy <= y1; gy++) {
      const row = gy * cols;
      for (let gx = x0; gx <= x1; gx++) {
        for (let i = head[row + gx]; i !== -1; i = next[i]) {
          if (n < cap) out[n++] = i;
        }
      }
    }
    return n;
  },
};
