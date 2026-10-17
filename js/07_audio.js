'use strict';
// js/07_audio.js — Sfx + SFX_DEFS (suoni generati con Web Audio)

// ============================================================================
// SFX — effetti sonori generati da codice (Web Audio), niente file audio.
// Ogni suono è una piccola ricetta di oscillatori e rumore filtrato.
// - `gap`: distanza minima tra due suoni uguali (con 300 slime colpiti al
//   secondo non vogliamo 300 suoni: ne basta uno ogni tanto)
// - massimo MAX_VOICES suoni contemporanei
// Su iPhone l'audio parte solo dopo il primo tocco (sblocco in init()).
// ============================================================================

const Sfx = {
  ctx: null, master: null, noiseBuf: null,
  last: Object.create(null),
  voices: 0, MAX_VOICES: 20,
  gemCombo: 0, gemT: 0,
  VOL: { low: 0.22, mid: 0.45, high: 0.8 },

  init() {
    const unlock = () => this.unlock();
    ['pointerdown', 'touchend', 'keydown', 'click'].forEach((ev) => document.addEventListener(ev, unlock, { passive: true }));
  },

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      // 1 secondo di rumore bianco riutilizzato da tutti i suoni "sporchi"
      const n = this.ctx.sampleRate, buf = this.ctx.createBuffer(1, n, n), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.setVol();
    }
    // iPhone: dopo una chiamata o tornando dall'app lo stato è 'interrupted' (non 'suspended')
    if (this.ctx.state !== 'running') { try { this.ctx.resume(); } catch (e) { /* ignorato */ } }
  },

  setVol() {
    if (!this.master) return;
    const st = Save.data.settings;
    this.master.gain.value = st.sfx ? (this.VOL[st.vol] || this.VOL.mid) : 0;
  },

  play(name, arg) {
    const c = this.ctx;
    if (!c || c.state !== 'running' || !Save.data.settings.sfx) return;
    const def = SFX_DEFS[name];
    if (!def) return;
    const now = c.currentTime;
    if (def.gap && now - (this.last[name] || -9) < def.gap) return;
    if (this.voices >= this.MAX_VOICES && !def.important) return;
    this.last[name] = now;
    def.fn(this, now, arg);
  },

  // ---- mattoncini -------------------------------------------------------------
  _end(node, t) {
    this.voices++;
    node.onended = () => { this.voices--; };
  },
  // nota: forma d'onda, frequenza iniziale -> finale, durata, volume
  tone(t, type, f0, f1, dur, vol, attack) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const a = attack || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
    this._end(o);
  },
  // rumore filtrato (colpi, esplosioni, fruscii)
  noise(t, dur, vol, ftype, f0, f1, q) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf;
    f.type = ftype || 'lowpass';
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    f.Q.value = q || 1;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    this._end(s);
  },
  // arpeggio: note in Hz una dopo l'altra
  arp(t, type, notes, step, dur, vol) {
    for (let k = 0; k < notes.length; k++) this.tone(t + k * step, type, notes[k], notes[k], dur, vol);
  },
};

const SFX_DEFS = {
  // combattimento
  hit:    { gap: 0.045, fn: (s, t) => s.noise(t, 0.035, 0.16, 'bandpass', 2200, 1200, 1.5) },
  kill:   { gap: 0.035, fn: (s, t) => s.tone(t, 'square', 420 + Math.random() * 120, 140, 0.07, 0.045) },
  slash:  { gap: 0.05,  fn: (s, t) => s.noise(t, 0.11, 0.13, 'bandpass', 3200, 700, 2) },
  thrust: { gap: 0.05,  fn: (s, t) => { s.noise(t, 0.09, 0.12, 'bandpass', 900, 3200, 2); s.tone(t, 'triangle', 260, 520, 0.06, 0.05); } },
  bow:    { gap: 0.05,  fn: (s, t) => { s.tone(t, 'triangle', 980, 320, 0.08, 0.07); s.noise(t, 0.05, 0.05, 'highpass', 3000, 3000); } },
  axe:    { gap: 0.06,  fn: (s, t) => s.noise(t, 0.16, 0.1, 'bandpass', 500, 1400, 1.2) },
  zap:    { gap: 0.07,  fn: (s, t) => { s.noise(t, 0.12, 0.12, 'highpass', 2500, 5000); s.tone(t, 'square', 1400, 300, 0.08, 0.035); } },
  boom:   { gap: 0.06,  fn: (s, t) => { s.noise(t, 0.35, 0.28, 'lowpass', 1100, 90); s.tone(t, 'sine', 120, 40, 0.3, 0.12); } },
  spit:   { gap: 0.12,  fn: (s, t) => s.tone(t, 'sine', 340, 180, 0.08, 0.05) },
  pew:    { gap: 0.08,  fn: (s, t) => s.tone(t, 'square', 700, 380, 0.05, 0.025) },
  burst:  { gap: 0.2,   fn: (s, t) => { s.tone(t, 'sawtooth', 300, 90, 0.25, 0.07); s.noise(t, 0.2, 0.1, 'lowpass', 1600, 200); } },
  bolt:   { gap: 0.06, important: true, fn: (s, t) => { s.noise(t, 0.4, 0.3, 'highpass', 4000, 600); s.tone(t, 'square', 90, 40, 0.35, 0.1); } },
  hurt:   { gap: 0.1, important: true, fn: (s, t) => { s.tone(t, 'square', 200, 70, 0.14, 0.12); s.noise(t, 0.08, 0.12, 'lowpass', 900, 200); } },
  dash:   { important: true, fn: (s, t) => { s.noise(t, 0.2, 0.16, 'bandpass', 600, 4500, 1.2); s.tone(t, 'sine', 300, 900, 0.12, 0.05); } },
  dodge:  { gap: 0.1,   fn: (s, t) => s.noise(t, 0.14, 0.09, 'bandpass', 1200, 4000, 1) },
  whip:   { gap: 0.06,  fn: (s, t) => { s.noise(t, 0.06, 0.16, 'highpass', 3500, 6000); s.tone(t, 'square', 1800, 600, 0.04, 0.03); } },
  storm:  { gap: 0.2,   fn: (s, t) => s.noise(t, 0.5, 0.1, 'bandpass', 300, 1200, 0.8) },
  helix:  { gap: 0.2,   fn: (s, t) => { s.arp(t, 'triangle', [440, 712, 1152], 0.05, 0.12, 0.03); } },
  frost:  { gap: 0.15,  fn: (s, t) => { s.noise(t, 0.3, 0.12, 'highpass', 5000, 2500); s.arp(t, 'triangle', [1568, 2093, 2637], 0.04, 0.1, 0.035); } },
  // raccolta
  gem:    { gap: 0.03,  fn: (s, t) => {
    const now = performance.now();
    s.gemCombo = now - s.gemT < 400 ? Math.min(s.gemCombo + 1, 14) : 0; s.gemT = now;
    const f = 660 * Math.pow(1.06, s.gemCombo);
    s.tone(t, 'triangle', f, f * 1.2, 0.05, 0.05);
  } },
  coin:   { gap: 0.05, important: true, fn: (s, t) => { s.tone(t, 'square', 988, 988, 0.06, 0.06); s.tone(t + 0.06, 'square', 1319, 1319, 0.12, 0.06); } },
  heal:   { important: true, fn: (s, t) => s.arp(t, 'triangle', [523, 659, 784, 1047], 0.06, 0.12, 0.09) },
  magnet: { important: true, fn: (s, t) => s.tone(t, 'sine', 200, 1200, 0.45, 0.1, 0.05) },
  chest:  { important: true, fn: (s, t) => s.arp(t, 'triangle', [392, 523, 659, 784, 1047], 0.07, 0.16, 0.1) },
  level:  { important: true, fn: (s, t) => { s.arp(t, 'square', [523, 659, 784, 1047], 0.065, 0.1, 0.06); s.noise(t, 0.3, 0.06, 'highpass', 2000, 6000); } },
  // boss e mondo
  warn:   { important: true, fn: (s, t) => { for (let k = 0; k < 3; k++) { s.tone(t + k * 0.36, 'square', 220, 220, 0.18, 0.07); s.tone(t + k * 0.36 + 0.18, 'square', 165, 165, 0.18, 0.07); } } },
  bossDie:{ important: true, fn: (s, t) => { s.noise(t, 1.3, 0.35, 'lowpass', 2000, 60); s.tone(t, 'sawtooth', 220, 30, 1.2, 0.12); } },
  night:  { important: true, fn: (s, t) => { s.tone(t, 'sine', 110, 55, 1.1, 0.12, 0.2); s.tone(t, 'triangle', 116, 58, 1.1, 0.05, 0.2); } },
  portal: { important: true, fn: (s, t) => s.tone(t, 'sine', 180, 900, 0.5, 0.09, 0.05) },
  death:  { important: true, fn: (s, t) => { s.tone(t, 'square', 440, 50, 1.0, 0.1); s.noise(t + 0.2, 0.9, 0.2, 'lowpass', 1500, 80); } },
  victory:{ important: true, fn: (s, t) => { s.arp(t, 'square', [523, 659, 784, 1047], 0.13, 0.22, 0.07); s.tone(t + 0.55, 'triangle', 1047, 1047, 0.7, 0.08); s.tone(t + 0.55, 'triangle', 784, 784, 0.7, 0.06); } },
  // interfaccia
  click:  { gap: 0.03,  important: true, fn: (s, t) => s.tone(t, 'square', 1500, 1500, 0.018, 0.03) },
  buy:    { important: true, fn: (s, t) => { s.tone(t, 'square', 1047, 1047, 0.06, 0.06); s.tone(t + 0.07, 'square', 1568, 1568, 0.14, 0.06); } },
  anvil:  { important: true, fn: (s, t) => { s.tone(t, 'square', 1568, 1500, 0.35, 0.06); s.tone(t, 'triangle', 2093, 2000, 0.4, 0.05); s.noise(t, 0.06, 0.15, 'highpass', 3000, 3000); } },
  crack:  { important: true, fn: (s, t) => { s.noise(t, 0.25, 0.25, 'bandpass', 1800, 300, 0.8); s.tone(t, 'square', 140, 60, 0.25, 0.08); } },
  quest:  { important: true, fn: (s, t) => s.arp(t, 'triangle', [659, 784, 988, 1319], 0.08, 0.18, 0.09) },
};
