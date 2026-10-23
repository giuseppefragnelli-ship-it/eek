'use strict';
// js/12_input.js — Input: tastiera + joystick touch

// ============================================================================
// INPUT — tastiera (e.code = posizione fisica del tasto, WASD funziona con
// qualsiasi layout) + joystick virtuale per touch/mouse.
// Il personaggio va SEMPRE a velocità massima: il joystick decide solo la direzione.
// Modalità (Opzioni): 'float' = appare dove tocchi e la base segue il dito;
// 'left'/'right' = base fissa in basso, la direzione si misura dal suo centro.
// ============================================================================

const _jc = { x: 0, y: 0 };

const Input = {
  down: Object.create(null),    // tasti tenuti premuti
  pressed: Object.create(null), // tasti premuti in questo frame (consumati da consume())
  ax: 0, ay: 0,                 // direzione di movimento (lunghezza 0..1)
  isTouch: false,               // true dopo il primo tocco: la UI mostra i suggerimenti touch
  joy: { active: false, id: -1, sx: 0, sy: 0, x: 0, y: 0 }, // coordinate CSS px rispetto al campo
  JOY_R: 42,                    // raggio del joystick (CSS px)
  JOY_DEAD: 6,
  JOY_MODES: { float: 'Mobile: appare dove tocchi', left: 'Fisso in basso a sinistra', right: 'Fisso in basso a destra' },
  stageW: 0, stageH: 0,
  teleReq: false,               // tasto TELE (telefono) = teletrasporto
  skillReq: null,               // tasti IRA / GELO (telefono): 'ira' | 'gelo'

  joyMode() { return (Save.data && Save.data.settings.joy) || 'float'; },

  // centro del joystick fisso (CSS px rispetto al campo di gioco)
  fixedCenter(out) {
    const m = this.joyMode(), pad = this.JOY_R + 28;
    out.x = m === 'right' ? this.stageW - pad : pad;
    out.y = this.stageH - pad - 8;
    return out;
  },

  init() {
    window.addEventListener('keydown', (e) => {
      if (!this.down[e.code]) this.pressed[e.code] = true;
      this.down[e.code] = true;
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.down[e.code] = false; });
    const lost = () => {
      for (const k in this.down) this.down[k] = false;
      this.joy.active = false;
      if (typeof onWindowBlur === 'function') onWindowBlur();
    };
    window.addEventListener('blur', lost);
    document.addEventListener('visibilitychange', () => { if (document.hidden) lost(); });
    // niente zoom col pizzico su iOS
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  },

  // joystick sul campo di gioco
  initPointer(el) {
    const j = this.joy;
    el.addEventListener('pointerdown', (e) => {
      // BUG risolto (joystick bloccato in una direzione): se un rilascio del dito andava perso,
      // j.active restava vero e ogni tocco successivo veniva ignorato. Un tocco "primario"
      // (nessun altro dito sullo schermo) vuol dire che il vecchio dito non c'è più: si riparte.
      if (j.active && e.isPrimary) j.active = false;
      if (j.active || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if (e.pointerType === 'touch' && !this.isTouch) { this.isTouch = true; if (typeof onTouchDetected === 'function') onTouchDetected(); }
      const r = el.getBoundingClientRect();
      this.stageW = r.width; this.stageH = r.height;
      j.active = true; j.id = e.pointerId;
      j.x = e.clientX - r.left; j.y = e.clientY - r.top;
      if (this.joyMode() === 'float') { j.sx = j.x; j.sy = j.y; }
      else this.fixedCenter(_jc), j.sx = _jc.x, j.sy = _jc.y; // fisso: la direzione si misura dal centro fisso, tocchi dove vuoi
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignorato */ }
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (!j.active || e.pointerId !== j.id) return;
      const r = el.getBoundingClientRect();
      j.x = e.clientX - r.left; j.y = e.clientY - r.top;
      // joystick mobile: la base segue il dito oltre il raggio
      if (this.joyMode() === 'float') {
        const dx = j.x - j.sx, dy = j.y - j.sy, d = Math.sqrt(dx * dx + dy * dy);
        if (d > this.JOY_R) { j.sx = j.x - dx / d * this.JOY_R; j.sy = j.y - dy / d * this.JOY_R; }
      }
      e.preventDefault();
    });
    const end = (e) => { if (e.pointerId === j.id) j.active = false; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);   // il sistema ci ha tolto il dito (gesto di sistema, notifica...)
    // rete di sicurezza: nessun dito sullo schermo = joystick spento, qualunque evento sia andato perso
    const allUp = (e) => { if (e.touches && e.touches.length === 0) j.active = false; };
    document.addEventListener('touchend', allUp, { passive: true });
    document.addEventListener('touchcancel', allUp, { passive: true });
  },

  update() {
    const j = this.joy;
    if (j.active) {
      const dx = j.x - j.sx, dy = j.y - j.sy, d = Math.sqrt(dx * dx + dy * dy);
      if (d < this.JOY_DEAD) { this.ax = this.ay = 0; return; }
      // sempre velocità massima: conta solo la direzione
      this.ax = dx / d; this.ay = dy / d;
      return;
    }
    const d = this.down;
    let x = 0, y = 0;
    if (d.KeyA || d.ArrowLeft) x -= 1;
    if (d.KeyD || d.ArrowRight) x += 1;
    if (d.KeyW || d.ArrowUp) y -= 1;
    if (d.KeyS || d.ArrowDown) y += 1;
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    this.ax = x; this.ay = y;
  },

  // true una sola volta per pressione
  consume(code) {
    if (this.pressed[code]) { this.pressed[code] = false; return true; }
    return false;
  },

  clearPressed() { for (const k in this.pressed) this.pressed[k] = false; },
};
