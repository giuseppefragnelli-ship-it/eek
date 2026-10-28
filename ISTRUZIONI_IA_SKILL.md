# Istruzioni per un'IA: abbellire le "skill" di S98

Copia tutto quello che c'è sotto la riga e incollalo all'IA, insieme ai file elencati.

---

## Chi sei e cosa devi fare
Lavori su **S98**, un survivor-like (stile Vampire Survivors) in **JavaScript puro + canvas 2D**, niente engine, niente build, niente librerie. Si gioca **da iPhone in verticale** come web app. Tema: Windows 98 tetro, Inferno di Dante, Roma antica, isole italiane. Testi in **italiano**, ironici e tetri, nomi latini/aulici.

**Obiettivo: migliorare il DESIGN e la GRAFICA delle skill**, cioè:
1. le **armi** che attaccano da sole (Sagitta, Pugio, Hasta, Arcus, Bipennis, Limbus, Sphaerae, Fulmen, Ignis, Falx Lunae, Aqua Stygia, Linguae Ignis, Flagellum, Procella, Lumen, Gelu, Helix, Imber Siderum e le loro evoluzioni/fusioni);
2. le **abilità** a tasto: Ira di Dite, Gelo di Cocito, Teletrasporto.

Devono essere più belle, leggibili, d'impatto e diverse tra loro. **Non cambiare il bilanciamento** (danni, ricariche, aree) se non te lo chiedo.

## File che ti servono (gli altri NON toccarli)
| File | Cosa contiene |
|---|---|
| `03_data_weapons.js` | dati delle armi: `WEAPON_DEFS` (livelli, evoluzioni), nomi e descrizioni |
| `20_weapons.js` | logica delle armi in partita (`WEAPON_LOGIC.<id>`), proiettili `PK`, meteore `Meteors` |
| `22_render.js` | **tutto il disegno**. Cerca: `weaponGlow` + `WEAPON_GLOW` (scie e bagliori delle armi), `drawMeteors`, `drawSkillFx` + `SKILL_FX` (Ira/Gelo), `FXK.SLASH` (fendente del Pugio), i blocchi "raggi del Lume", "ampolle orbitanti", "falci di luna", "Vite Aerea", "turbini della Bufera", `bolt(` (fulmini) |
| `08_sprites.js` | sprite a pixel generati da codice (`proj_salt`, `proj_arrow`, `proj_scythe`, icone `ico_*` con `fromRows`) |
| `02_data_enemies.js` | solo `SKILLS` (Ira/Gelo) e `TELEPORT` |
| `16_player.js` | solo `trySkill` e `tryTeleport` (dove partono gli effetti delle abilità) |
| `index.html` + `game.css` | tasti IRA / GELO / TELE sul telefono (`.skbtn`, `#telebtn`, icone `.skico`) |

## Come funziona il disegno (importante)
- Il canvas è **2x**: si disegna in "pixel del gioco" con `ctx.setTransform(2,0,0,2,0,0)`. Coordinate intere = pixel a blocchi; **coordinate con mezzi pixel e forme lisce** (`arc`, `lineTo`, `ellipse`) = alta risoluzione. Gli effetti nuovi devono essere in **alta risoluzione** (vedi `weaponGlow` e `drawSkillFx` come esempio).
- Mondo → schermo: `sx = x * S + ox`, `sy = y * S + oy` (dentro `Render.draw` ci sono `S`, `ox`, `oy`, `rt` = tempo reale, `alpha`/`ia` per l'interpolazione).
- Per il bagliore usa `ctx.globalCompositeOperation = 'lighter'` e **rimettilo sempre a `'source-over'`**; idem `globalAlpha = 1`, `lineCap = 'butt'`.
- Colori dell'interfaccia: nero + giallo fluo; rosa e verde fluo solo in piccole dosi.

## Regole che NON si rompono
1. **Niente `import`/`export`, niente moduli**: sono script classici caricati in ordine da `index.html` e condividono variabili globali. Un file può usare *al caricamento* solo ciò che è definito nei file prima di lui.
2. **Niente librerie, CDN o immagini nuove scaricate**: tutto disegnato da codice.
3. **Performance (gira su iPhone a 28 FPS)**: nel ciclo di disegno e di gioco **niente allocazioni** (niente `[]`, `{}`, `new`, `map`, `filter`, `for...of` su array creati al volo, niente `createRadialGradient`/`createLinearGradient` a ogni frame). Usa array fissi preallocati (`Float32Array`) come fanno `Meteors`, `Strikes`, `SkillFx`.
4. **`Render.draw` è una funzione enorme**: attenzione a non dichiarare due volte lo stesso `const` nello stesso blocco, altrimenti un `SyntaxError` blocca tutto il gioco.
5. **Mai `splice` su `Player.weapons`**.
6. **Non toccare il salvataggio** (`06_save.js`, chiave `slimeSurvivors98.save.v1`).
7. Testi nel gioco in italiano, **neutri sul genere**, e **niente frasi che spiegano** (al massimo un nome).
8. **Non cambiare `VERSION` in `sw.js`**: la alzo io una volta sola prima di pubblicare. Se aggiungi un file nuovo dimmelo (va aggiunto a `FILES` in `sw.js` e in `index.html`).
9. Tutto deve funzionare **touch e in verticale** (schermo 375×812).

## Cosa voglio indietro
- Modifiche **piccole e mirate**, un'arma o un'abilità alla volta, così posso provarle.
- Per ogni modifica: quale file, cosa cambia e com'è in partita, spiegato **senza gergo** (non sono un programmatore).
- Se un'idea richiede di cambiare danni o ricariche, chiedimelo prima.

## Come provare
1. Apri la cartella con un server locale (es. `py -m http.server 8765`) e vai su `http://localhost:8765` con la vista telefono (375×812).
2. Ricarica forzando i file nuovi (la cache tiene le versioni vecchie).
3. Console del browser: **nessun errore rosso**.
4. Per vedere un'arma subito, da console: `startRun(); G.god = true; addWeapon('scythe');` poi `G.hitStop = 1000` per congelare la scena e guardarla. Abilità: `Player.skill.ira = true; Player.trySkill('ira');`.
5. Alla fine: `Save.data = Save.normalize(null); Save._local(); location.reload()` per pulire il salvataggio di prova.
