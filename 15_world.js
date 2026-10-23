'use strict';
// js/15_world.js — MapGen (mondo infinito a blocchi) + Obs (ostacoli)

// ============================================================================
// MAPS — il mondo è infinito: viene diviso in blocchi (MAP_CHUNK x MAP_CHUNK)
// e ogni blocco genera SEMPRE le stesse cose (generatore con seme =
// coordinate del blocco + mappa).
//
// - decorazioni (props): solo grafica, scure (piantine, rocchi caduti)
// - basamenti (plats): pavimenti di pietra dei templi, solo grafica
// - ostacoli (obs): cerchi che bloccano player, slime e proiettili nemici
//   (i tuoi proiettili li attraversano: è magia). Ognuno ha il suo sprite.
//
// Layout 'ruins' (Cripta, Cattedrale): una città antica distrutta — templi
// a metà con le colonne in fila sul basamento, portici, muri diroccati.
// Layout normale: ostacoli sparsi (alberi, tombe, ghiaccio).
//
// Ogni step gli ostacoli vicini finiscono in Obs, divisi in celle: ogni
// collisione guarda solo le 9 celle attorno al punto.
// ============================================================================

const MapGen = {
  cache: new Map(),        // chiave numerica del blocco -> { props, plats, obs }
  mapIdx: 0,

  reset(mapId) {
    this.cache.clear();
    this.mapId = mapId;
    this.mapIdx = Object.keys(MAPS).indexOf(mapId);
  },

  // generatore deterministico (mulberry32)
  _rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  chunk(cx, cy) {
    const key = (cx + 5000) * 10007 + (cy + 5000);
    let c = this.cache.get(key);
    if (c) return c;
    if (this.cache.size > 600) this.cache.clear();
    const m = G.map, S = MAP_CHUNK;
    const rnd = this._rng((cx * 73856093) ^ (cy * 19349663) ^ (this.mapIdx * 83492791));
    c = { props: [], plats: [], obs: [] };
    // piantine scure
    const np = 6 + ((rnd() * 5) | 0);
    for (let k = 0; k < np; k++) {
      c.props.push({ x: cx * S + rnd() * S, y: cy * S + rnd() * S, spr: m.props[(rnd() * m.props.length) | 0] });
    }
    if (m.layout === 'ruins') this._ruins(c, cx, cy, rnd, m);
    else {
      for (let k = 0; k < m.obstacles; k++) {
        const x = cx * S + 40 + rnd() * (S - 80), y = cy * S + 40 + rnd() * (S - 80);
        if (x * x + y * y < 200 * 200) continue;   // mai vicino al punto di partenza
        c.obs.push({ x, y, r: m.obsR, spr: m.obstacle });
      }
    }
    // isole: niente rovine né piante in mare o sulla spiaggia
    if (m.isle) {
      const I = m.isle, inside = (x, y, mg) => x * x + y * y < (I.min - mg) * (I.min - mg) || Math.sqrt(x * x + y * y) < isleAt(I, Math.atan2(y, x)) - mg;
      c.props = c.props.filter((p) => inside(p.x, p.y, I.beach + 20));
      c.obs = c.obs.filter((o) => inside(o.x, o.y, I.beach + 30));
      c.plats = c.plats.filter((p) => inside(p.x, p.y, I.beach + 30) && inside(p.x + p.w, p.y + p.h, I.beach + 30));
    }
    // Goat: attorno alla figura nera niente rovine né piante
    if (m.goat) {
      const g = m.goat, far = (x, y) => (x - g.x) * (x - g.x) + (y - g.y) * (y - g.y) > 360 * 360;
      c.props = c.props.filter((p) => far(p.x, p.y)); c.obs = c.obs.filter((o) => far(o.x, o.y));
      c.plats = c.plats.filter((p) => far(p.x + p.w / 2, p.y + p.h / 2));
    }
    // accampamento del Magister: lo spiazzo attorno resta sgombro
    const MC = MAGISTER_CAMP;
    if (this.mapId === MC.map) c.obs = c.obs.filter((o) => (o.x - MC.x) * (o.x - MC.x) + (o.y - MC.y) * (o.y - MC.y) > MC.clearR * MC.clearR);
    this.cache.set(key, c);
    return c;
  },

  // ---- città distrutta ----------------------------------------------------------
  _ruins(c, cx, cy, rnd, m) {
    const S = MAP_CHUNK, x0 = cx * S, y0 = cy * S;
    const SX = 62, SY = 94;                           // passo tra le colonne (in verticale più largo: le colonne sono alte)
    const free = (x, y) => x * x + y * y > 230 * 230; // la partenza resta sgombra
    // una colonna: in piedi, spezzata, mozzicone o crollata (con il rocchio a terra)
    const column = (x, y, standing) => {
      if (!free(x, y)) return;
      const r = rnd();
      if (r < standing) c.obs.push({ x, y, r: 11, spr: 'o_col' });
      else if (r < standing + 0.22) c.obs.push({ x, y, r: 10, spr: 'o_col_half' });
      else if (r < standing + 0.36) c.obs.push({ x, y, r: 9, spr: 'o_col_stump' });
      else if (r < standing + 0.5) c.props.push({ x: x + (rnd() - 0.5) * 30, y: y + 8 + rnd() * 14, spr: rnd() < 0.7 ? 'd_drum' : 'd_capital' });
    };
    const wall = (x, y) => { if (free(x, y)) c.obs.push({ x, y, r: 12, spr: 'o_wall' }); };
    const plat = (x, y, w, h) => { c.plats.push({ x, y, w, h }); };

    const roll = rnd();
    const mx = x0 + S / 2 + (rnd() - 0.5) * 60, my = y0 + S / 2 + (rnd() - 0.5) * 60;
    if (roll < m.temple) {
      // TEMPIO a metà: peristilio di colonne sul basamento + cella con i muri crollati
      const nx = 4 + ((rnd() * 2) | 0), ny = 4 + ((rnd() * 2) | 0);
      const w = (nx - 1) * SX, h = (ny - 1) * SY, left = mx - w / 2, top = my - h / 2;
      plat(left - 26, top - 26, w + 52, h + 52);
      const standing = 0.32 + rnd() * 0.25;          // quanto è conservato
      for (let i = 0; i < nx; i++) column(left + i * SX, top, standing);
      for (let j = 1; j < ny - 1; j++) { column(left, top + j * SY, standing); column(left + w, top + j * SY, standing); }
      for (let i = 0; i < nx; i++) column(left + i * SX, top + h, standing);
      // cella: due muri lunghi interrotti
      if (nx >= 5 && ny >= 5) {
        for (let j = 1; j < ny - 1; j++) {
          const y = top + j * SY;
          if (rnd() < 0.55) wall(left + SX * 1.5, y);
          if (rnd() < 0.55) wall(left + w - SX * 1.5, y);
        }
      }
      for (let k = 0; k < 2; k++) c.props.push({ x: left + rnd() * w, y: top + rnd() * h, spr: 'd_drum' });
    } else if (roll < m.temple + m.stoa) {
      // PORTICO (stoà): una o due file di colonne su una striscia di basamento
      const horiz = rnd() < 0.6, n = horiz ? 5 + ((rnd() * 3) | 0) : 4 + ((rnd() * 2) | 0), rows = rnd() < 0.4 ? 2 : 1;
      const SP = horiz ? SX : SY, SQ = horiz ? SY : SX, L = (n - 1) * SP;
      const sx = horiz ? mx - L / 2 : mx - (rows - 1) * SQ / 2, sy = horiz ? my - (rows - 1) * SQ / 2 : my - L / 2;
      if (horiz) plat(sx - 24, sy - 24, L + 48, (rows - 1) * SQ + 48); else plat(sx - 24, sy - 24, (rows - 1) * SQ + 48, L + 48);
      const standing = 0.4 + rnd() * 0.25;
      for (let rI = 0; rI < rows; rI++) for (let i = 0; i < n; i++) {
        column(horiz ? sx + i * SP : sx + rI * SQ, horiz ? sy + rI * SQ : sy + i * SP, standing);
      }
      // muro di fondo diroccato
      if (rnd() < 0.6) for (let i = 0; i < n; i++) {
        if (rnd() < 0.5) wall(horiz ? sx + i * SP + SP / 2 : sx - 40, horiz ? sy - 40 : sy + i * SP + SP / 2);
      }
    } else if (roll < m.temple + m.stoa + 0.3) {
      // macerie sparse: qualche colonna rimasta in piedi e pezzi a terra
      const n = 2 + ((rnd() * 3) | 0);
      for (let k = 0; k < n; k++) column(x0 + 50 + rnd() * (S - 100), y0 + 50 + rnd() * (S - 100), 0.25);
      if (rnd() < 0.4) { const wx = x0 + 60 + rnd() * (S - 160), wy = y0 + 60 + rnd() * (S - 120); for (let k = 0; k < 3; k++) if (rnd() < 0.7) wall(wx + k * 30, wy); }
    } else {
      // spiazzo libero: solo qualche rocchio a terra
      for (let k = 0; k < 2; k++) if (rnd() < 0.6) c.props.push({ x: x0 + rnd() * S, y: y0 + rnd() * S, spr: rnd() < 0.7 ? 'd_drum' : 'd_capital' });
    }
  },
};

// ---------------------------------------------------------------------------
// Ostacoli attivi vicino alla vista: array fissi + celle (liste concatenate)
// ---------------------------------------------------------------------------
const Obs = {
  max: 1024, n: 0,
  x: new Float32Array(1024), y: new Float32Array(1024), r: new Float32Array(1024),
  CELL: 96, cols: 0, rows: 0, ox: 0, oy: 0,
  head: new Int32Array(64 * 64).fill(-1), next: new Int32Array(1024).fill(-1),
};

function collectObstacles() {
  Obs.n = 0;
  const S = MAP_CHUNK, mx = G.viewW * 0.5 + 400, my = G.viewH * 0.5 + 400;
  // celle che coprono l'area raccolta
  Obs.ox = Player.x - mx; Obs.oy = Player.y - my;
  Obs.cols = Math.min(64, Math.ceil(mx * 2 / Obs.CELL) + 1);
  Obs.rows = Math.min(64, Math.ceil(my * 2 / Obs.CELL) + 1);
  Obs.head.fill(-1, 0, Obs.cols * Obs.rows);
  if (G.map.obstacles <= 0 && G.map.layout !== 'ruins') return;
  const x0 = Math.floor((Player.x - mx) / S), x1 = Math.floor((Player.x + mx) / S);
  const y0 = Math.floor((Player.y - my) / S), y1 = Math.floor((Player.y + my) / S);
  const inv = 1 / Obs.CELL;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const obs = MapGen.chunk(cx, cy).obs;
    for (let k = 0; k < obs.length && Obs.n < Obs.max; k++) {
      const o = obs[k];
      const gx = ((o.x - Obs.ox) * inv) | 0, gy = ((o.y - Obs.oy) * inv) | 0;
      if (o.x < Obs.ox || o.y < Obs.oy || gx >= Obs.cols || gy >= Obs.rows) continue;
      const i = Obs.n++;
      Obs.x[i] = o.x; Obs.y[i] = o.y; Obs.r[i] = o.r;
      const c = gy * Obs.cols + gx;
      Obs.next[i] = Obs.head[c]; Obs.head[c] = i;
    }
  }
}

// Spinge fuori dagli ostacoli un cerchio (x,y,r). Scrive il risultato in _push.
const _push = { x: 0, y: 0, hit: false };
function pushOutOfObstacles(x, y, r) {
  _push.x = x; _push.y = y; _push.hit = false;
  if (Obs.n === 0) return _push;
  const inv = 1 / Obs.CELL;
  const gx = ((x - Obs.ox) * inv) | 0, gy = ((y - Obs.oy) * inv) | 0;
  if (x < Obs.ox || y < Obs.oy || gx >= Obs.cols || gy >= Obs.rows) return _push;
  for (let yy = gy - 1; yy <= gy + 1; yy++) {
    if (yy < 0 || yy >= Obs.rows) continue;
    for (let xx = gx - 1; xx <= gx + 1; xx++) {
      if (xx < 0 || xx >= Obs.cols) continue;
      for (let k = Obs.head[yy * Obs.cols + xx]; k !== -1; k = Obs.next[k]) {
        const dx = _push.x - Obs.x[k], dy = _push.y - Obs.y[k], rr = r + Obs.r[k];
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.01;
        _push.x = Obs.x[k] + dx / d * rr;
        _push.y = Obs.y[k] + dy / d * rr;
        _push.hit = true;
      }
    }
  }
  return _push;
}

function pointInObstacle(x, y) {
  if (Obs.n === 0) return false;
  const inv = 1 / Obs.CELL;
  const gx = ((x - Obs.ox) * inv) | 0, gy = ((y - Obs.oy) * inv) | 0;
  if (x < Obs.ox || y < Obs.oy || gx >= Obs.cols || gy >= Obs.rows) return false;
  for (let yy = gy - 1; yy <= gy + 1; yy++) {
    if (yy < 0 || yy >= Obs.rows) continue;
    for (let xx = gx - 1; xx <= gx + 1; xx++) {
      if (xx < 0 || xx >= Obs.cols) continue;
      for (let k = Obs.head[yy * Obs.cols + xx]; k !== -1; k = Obs.next[k]) {
        const dx = x - Obs.x[k], dy = y - Obs.y[k];
        if (dx * dx + dy * dy < Obs.r[k] * Obs.r[k]) return true;
      }
    }
  }
  return false;
}

// Disegna basamenti + decorazioni (sotto) o ostacoli (sopra al pavimento, sotto agli slime)
function drawMapLayer(which) {
  const ctx = Render.ctx, S = 1 / CFG.UNIT, CH = MAP_CHUNK;
  const mx = G.viewW * 0.5 + 60, my = G.viewH * 0.5 + 60;
  const x0 = Math.floor((G.camX - mx - 200) / CH), x1 = Math.floor((G.camX + mx + 200) / CH);
  const y0 = Math.floor((G.camY - my - 200) / CH), y1 = Math.floor((G.camY + my + 200) / CH);
  const ox = Render.ox, oy = Render.oy;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const c = MapGen.chunk(cx, cy);
    if (which === 'props') {
      // basamenti dei templi: lastre di pietra con un gradino scuro attorno
      for (let k = 0; k < c.plats.length; k++) {
        const p = c.plats[k];
        if (p.x > G.camX + mx || p.x + p.w < G.camX - mx || p.y > G.camY + my || p.y + p.h < G.camY - my) continue;
        const px = Math.round(p.x * S) + ox, py = Math.round(p.y * S) + oy, pw = Math.round(p.w * S), ph = Math.round(p.h * S);
        ctx.fillStyle = '#050407'; ctx.fillRect(px - 3, py - 2, pw + 6, ph + 5);          // gradino
        ctx.setTransform(2, 0, 0, 2, ox * 2, oy * 2);
        ctx.fillStyle = Render.floorPats.slab;
        ctx.fillRect(px - ox, py - oy, pw, ph);
        ctx.setTransform(2, 0, 0, 2, 0, 0);
        ctx.fillStyle = '#17141d'; ctx.fillRect(px, py, pw, 1);                           // spigolo in luce
        // bordo sbocconcellato
        ctx.fillStyle = '#050407';
        for (let q = 0; q < pw; q += 7) if (((q * 13 + px) & 7) < 2) ctx.fillRect(px + q, py + ph - 1, 3, 1);
      }
      for (let k = 0; k < c.props.length; k++) {
        const p = c.props[k], s = SPR.cache[p.spr];
        if (!s) continue;
        if (p.x < G.camX - mx || p.x > G.camX + mx || p.y < G.camY - my || p.y > G.camY + my) continue;
        ctx.drawImage(s.img, Math.round(p.x * S) + ox - (s.w >> 1), Math.round(p.y * S) + oy - (s.h >> 1));
      }
    } else {
      for (let k = 0; k < c.obs.length; k++) {
        const o = c.obs[k], s = SPR.cache[o.spr] || SPR.cache[G.map.obstacle];
        if (o.x < G.camX - mx || o.x > G.camX + mx || o.y < G.camY - my - 80 || o.y > G.camY + my) continue;
        const sx = Math.round(o.x * S) + ox, sy = Math.round(o.y * S) + oy;
        // ombra alla base + sprite appoggiato sul cerchio di collisione
        ctx.globalAlpha = 0.55; ctx.fillStyle = PAL.k;
        ctx.fillRect(sx - (s.w >> 1) + 1, sy + 2, s.w - 2, 3);
        ctx.globalAlpha = 1;
        ctx.drawImage(s.img, sx - (s.w >> 1), sy - s.h + 5);
      }
    }
  }
}
