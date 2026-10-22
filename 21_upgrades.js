'use strict';
// js/21_upgrades.js — Upgrades: carte del level up e forzieri

// ============================================================================
// UPGRADES — generazione delle 3 carte del level up e applicazione della scelta.
// (Gira solo al level up, non nel game loop: qui allocare è innocuo.)
// ============================================================================

const Upgrades = {
  options: [],

  // Restituisce 3 opzioni diverse. Le evoluzioni disponibili hanno la precedenza.
  // avoid = carte appena viste (rilancio): si pescano prima tutte le altre, poi se non bastano anche quelle.
  roll(avoid) {
    const evo = [], pool = [];
    const ws = Player.weapons, ps = Player.passives;

    for (const w of ws) {
      if (w.gear) continue; // il pugnale si potenzia solo dal fabbro
      if (canEvolve(w)) evo.push({ type: 'evo', id: w.id });
      else if (!wMaxed(w)) pool.push({ type: 'wup', id: w.id });
    }
    if (slotWeaponCount() < CFG.MAX_WEAPONS) {
      for (const id in WEAPON_DEFS) if (!WEAPON_DEFS[id].gear && !findWeapon(id) && weaponOpen(id)) pool.push({ type: 'weapon', id });
    }
    for (const p of ps) if (p.level < pMax(p.id)) pool.push({ type: 'pup', id: p.id });
    if (ps.length < CFG.MAX_PASSIVES) {
      for (const id in PASSIVE_DEFS) if (!Player.passiveLevel(id)) pool.push({ type: 'passive', id });
    }

    shuffle(pool);
    if (avoid && avoid.length) {
      const seen = (o) => avoid.some((a) => a.type === o.type && a.id === o.id);
      pool.sort((a, b) => seen(a) - seen(b));   // stabile: le carte nuove restano mescolate davanti
    }
    // FUSIONE: con un Arcanum [?] e due armi al massimo esce SEMPRE una carta di fusione (una coppia per volta;
    // il rilancio prova un'altra coppia)
    let fuse = null;
    if ((Save.data.arcana || 0) > 0) {
      const pairs = fusionPairs();
      if (pairs.length) {
        const seenPair = (p) => avoid && avoid.some((a) => a.type === 'fuse' && ((a.id === p[0].id && a.id2 === p[1].id) || (a.id === p[1].id && a.id2 === p[0].id)));
        const fresh = pairs.filter((p) => !seenPair(p)), from0 = fresh.length ? fresh : pairs;
        const uniq = from0.filter((p) => FUSION_SPECIAL[fuseKey(p[0].id, p[1].id)]), from = uniq.length ? uniq : from0;   // le fusioni uniche prima
        const p = from[(Math.random() * from.length) | 0];
        fuse = { type: 'fuse', id: p[0].id, id2: p[1].id };
      }
    }
    const out = evo.slice(0, fuse ? 2 : 3);
    if (fuse) out.push(fuse);
    for (let i = 0; i < pool.length && out.length < 3; i++) out.push(pool[i]);
    if (out.length < 3) out.push({ type: 'filler', id: 'heal' });
    if (out.length < 3) out.push({ type: 'filler', id: 'coins' });
    this.options = out;
    return out;
  },

  // Dati per disegnare la carta
  describe(o) {
    if (o.type === 'weapon') {
      const d = WEAPON_DEFS[o.id];
      if (d.secret) return { name: d.name, icon: d.icon, badge: 'ARMA SEGRETA', desc: d.desc, kind: 'Arma segreta', secret: true };
      return { name: d.name, icon: d.icon, badge: 'NUOVA ARMA', desc: d.desc, kind: 'Arma' };
    }
    if (o.type === 'fuse') {
      const a = findWeapon(o.id), b = findWeapon(o.id2), F = FUSION, n = Save.data.arcana || 0, sp = FUSION_SPECIAL[fuseKey(a.id, b.id)];
      if (sp) return { name: sp.name, icon: ARCANUM.icon, fw: [a, b], badge: 'FUSIONE UNICA', kind: baseWeaponName(a) + ' + ' + baseWeaponName(b), fuse: true,
        desc: sp.desc + ' In più: un posto libero, +' + Math.round((F.dmg - 1) * 100) + '% danno, ricarica più breve. Usa 1 Arcanum (ne hai ' + n + ').' };
      return { name: fuseName(a, b), icon: ARCANUM.icon, fw: [a, b], badge: 'FUSIONE', kind: 'Arcanum [?]', fuse: true,
        desc: 'Diventano un\'arma sola: si libera un posto, +' + Math.round((F.dmg - 1) * 100) + '% danno, -' + Math.round((1 - F.cd) * 100) + '% ricarica, +area e +1 colpo. Usa 1 Arcanum (ne hai ' + n + ').' };
    }
    if (o.type === 'wup') {
      const w = findWeapon(o.id), d = w.def;
      return { name: d.name, icon: d.icon, badge: 'Lv ' + w.level + ' → ' + (w.level + 1), desc: d.upDesc[w.level], kind: 'Arma' };
    }
    if (o.type === 'evo') {
      const d = WEAPON_DEFS[o.id];
      return { name: d.evo.name, icon: d.evo.icon, badge: 'EVOLUZIONE', desc: d.evo.desc, kind: 'Evoluzione', evo: true };
    }
    if (o.type === 'passive' || o.type === 'pup') {
      const d = PASSIVE_DEFS[o.id], lv = Player.passiveLevel(o.id);
      // quali armi fa evolvere questa passiva (il suggerimento lo prometteva, ma mancava)
      const evos = [];
      for (const id in WEAPON_DEFS) { const wd = WEAPON_DEFS[id]; if (wd.evo && wd.evo.passive === o.id && weaponOpen(id)) evos.push(wd.name); }
      const hint = evos.length ? ' → ' + evos.join(', ') : '';
      return { name: d.name, icon: d.icon, badge: lv ? 'Lv ' + lv + ' → ' + (lv + 1) : 'NUOVA PASSIVA', desc: scaleDesc(d.desc, Save.masteryMult(o.id)) + hint, kind: 'Passiva' };
    }
    const f = FILLER_CARDS[o.id];
    return { name: f.name, icon: f.icon, badge: 'BONUS', desc: f.desc, kind: 'Bonus' };
  },

  apply(o) {
    if (o.type === 'weapon') { if (!findWeapon(o.id) && slotWeaponCount() < CFG.MAX_WEAPONS) addWeapon(o.id); }
    else if (o.type === 'wup') levelUpWeapon(findWeapon(o.id));
    else if (o.type === 'evo') { evolveWeapon(findWeapon(o.id)); G.rs.evos++; }
    else if (o.type === 'fuse') {
      if ((Save.data.arcana || 0) > 0 && fuseWeapons(findWeapon(o.id), findWeapon(o.id2))) { Save.data.arcana--; Save.write(); }
    }
    else if (o.type === 'passive') { if (!Player.passiveLevel(o.id)) Player.passives.push({ id: o.id, def: PASSIVE_DEFS[o.id], level: 1 }); Player.recalcStats(); }
    else if (o.type === 'pup') { for (const p of Player.passives) if (p.id === o.id) p.level++; Player.recalcStats(); }
    else if (o.id === 'heal') Player.hp = Math.min(Player.maxHp, Player.hp + 30);
    else if (o.id === 'coins') Player.gainCoins(1);
  },

  // Forziere: un potenziamento alla volta (evoluzioni prima, poi armi e passive che hai già).
  chestPick() {
    const evo = [], pool = [];
    for (const w of Player.weapons) {
      if (w.gear) continue;
      if (canEvolve(w)) evo.push({ type: 'evo', id: w.id });
      else if (!wMaxed(w)) pool.push({ type: 'wup', id: w.id });
    }
    for (const p of Player.passives) if (p.level < pMax(p.id)) pool.push({ type: 'pup', id: p.id });
    if (evo.length) return evo[0];
    if (pool.length) return pool[(Math.random() * pool.length) | 0];
    return { type: 'filler', id: Player.hp < Player.maxHp ? 'heal' : 'coins' };
  },
  // apre un forziere: n potenziamenti (0 = a sorte: 1 oppure 3). Ritorna le descrizioni da mostrare.
  openChest(n) {
    if (!n) n = Math.random() < CHEST.three ? 3 : 1;
    const out = [];
    for (let k = 0; k < n; k++) {
      const o = this.chestPick();
      out.push(this.describe(o));
      this.apply(o);
    }
    G.rs.chests++;
    return out;
  },
};

// un'arma può uscire nelle carte? (le armi segrete solo dopo lo sblocco, vedi UNLOCKS)
function weaponOpen(id) { const s = WEAPON_DEFS[id].secret; return !s || Save.unlocked(s); }

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
