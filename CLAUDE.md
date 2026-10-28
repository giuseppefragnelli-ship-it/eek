# S98 — istruzioni per Claude

Survivor-like (stile Vampire Survivors) in JavaScript puro + canvas, niente engine, niente build. Tema Windows 98 tetro, testi in italiano, ambientazione Dante/Inferno + Roma antica + isole italiane. Si gioca **da iPhone**: pubblicato su **GitHub Pages** e aggiunto alla schermata Home come web app (PWA, funziona offline). Il PC non è una priorità.

## Come parlare con l'utente
- Italiano, tono informale ("bro"). Risposte corte: cosa è cambiato, cosa provare, niente spiegoni.
- L'utente non è un programmatore: niente gergo, spiega gli effetti nel gioco.
- **Niente scritte che spiegano** (richiesta dell'utente): gli avvisi in partita sono solo un nome (`UI.toast(nome, '')`), niente consigli nel menu, niente righe di spiegazione nei negozi.
- Testi nel gioco: italiano, ironico e tetro, nomi aulici/latini; **neutri sul genere** ("ha resistito", "la Morte ha preso Eek").
- Colori dell'interfaccia: **nero + giallo fluo** (`--yel`), **rosa fluo** (`--pink`) e **verde fluo** (`--grn`) solo in piccole dosi.

## File (tutti nella stessa cartella, script classici caricati in ordine da `index.html`)
Niente moduli ES: i file condividono variabili globali. Un file può usare *al caricamento* solo ciò che è definito nei file prima.

| File | Cosa c'è |
|---|---|
| `index.html` | tutta la UI HTML (menu, modali, HUD, tasti touch `#telebtn`, `.skbtn` IRA/GELO, ritratto `#reaper`), meta Apple/manifest, `<script>` in ordine |
| `game.css` | tema a variabili `:root` (`--yel --pink --grn --face ...`), font Silkscreen locale (`fonts/`), media query telefono ≤600px |
| `01_config.js` | `CFG` (numeri globali), `DIFFICULTY` (solo `incubo` + `facile` segreta) |
| `02_data_enemies.js` | `ENEMY_DEFS` (indice = `type`, nuovi **sempre in fondo**), `NIGHT` (notte perenne da `forever` 660), `TELEPORT`, `DODGE`, `TELE_UP`, `SKILLS` (ira/gelo), `SKULLS` (660), `DEATH` (840), boss, `SPAWN` |
| `03_data_weapons.js` | armi, passive, fusioni (`meteor` = Imber Siderum, pioggia di meteore: logica `Meteors`/`addMeteor` in `20_weapons.js`, disegno `Render.drawMeteors`, evo con passiva `area`) |
| `04_data_economy.js` | negozio, fabbro, missioni `QUESTS`, `OMENS` (`read: [5,9,16]`), `CHARACTERS` (**solo Eek**), `TRAITS` (Locanda: forza/destrezza/vita/magia) |
| `05_data_maps.js` | `MAPS` (id interni invariati: `cripta`=**Sicilia**, `palude`=**Sardegna**, cattedrale, selva, dite, cocito), `makeIsle`/`makeBridge`/`islandClamp`/`islandSpawn`, `ISLAND`, Goat (`MAPS.cripta.goat`), `REEF` + `REEF_MAP` (Scoglio di Scilla), `UNLOCKS` |
| `06_save.js` | `Save` (localStorage `slimeSurvivors98.save.v1` — **mai cambiare la chiave**), `traits`, `dodges`, `reef`, `omenSlots()`, `skillOpen()` |
| `07_audio.js` | suoni generati (Web Audio) |
| `08`–`11` | pixel art generata da codice (sprite, Eek, personaggi, boss) |
| `12_input.js` | tastiera + joystick touch, `teleReq`, `skillReq` |
| `13_grid.js`, `14_entities.js` | griglia spaziale; pool Struct-of-Arrays (`Enemies`, `EShots` col campo `near`...), `G` (stato partita), `spawnEnemy` (isole: mai in mare; dopo 11:00 tutto diventa teschio) |
| `15_world.js` | `MapGen` a blocchi (sulle isole niente rovine in mare / vicino a Goat), ostacoli |
| `16_player.js` | `Player`: movimento, `shore()` (costa + ponte), `tryTeleport`, `trySkill`, `recalcStats` (passive + negozio + Locanda) |
| `17_enemies.js` | `Spawner` (calendario), trasformazione in teschi a 11:00, `Death` (la Morte: fuori dal pool, uccide al tocco) |
| `18_bosses.js` | `Boss` (max 4 insieme), `onBossKilled` (Custodi, Scilla con `S.reef`), `bossFury` (TUTTI i boss: frecce mirate tipo 4 + fulmini `addStrike` + inseguono più veloci; numeri in `BOSS_FURY` in `02_data_enemies.js`, vita x1.5 in `spawnBoss`) |
| `19_enemy_ai.js` | IA nemici, notte, proiettili nemici + **frecce schivate** (`countDodge`), Scavatore `Fossor` (`ET.fossor`, dal 2:30, numeri in `FOSSOR`) → buchi e braccia `Pits`/`addPit`/`updatePits` (disegno `Render.drawPits`, layer 0 buco / 1 braccio) |
| `20_weapons.js`, `21_upgrades.js` | armi in partita, carte del level up |
| `22_render.js` | `Render.draw` (UNA funzione enorme: attenzione ai nomi `const` doppi!), `drawSea` (mare, spiaggia, ponte), notte = tinta fredda su tutto lo schermo, niente buio (`NIGHT.tint/haze/edge`; i nemici stanno SOPRA), Goat, Morte, frecce ai bordi |
| `23_ui.js` | menu, negozi (`renderShop`: Locanda = `traits`, Aruspice = omina), `showEnd`, `reaper()` |
| `24_village.js` | villaggio tra le partite (canvas piccolo ingrandito di `K`, a passi di 0.5, ~260 px sul lato corto) |
| `25_monster_art.js` | carica `monsters.png` (atlante) + `MONSTER_FILES` (`skull.png`, `death.png`); crea `goat` (sagoma nera) e `death` |
| `26_main.js` | `startRun`, `step`, `commitRun` (trucchi = non conta), Scoglio (`enterReef`/`leaveReef`/`spawnReefBoss`), `handleKeys`, game loop (28 FPS), `installWebApp` |
| `sw.js` | service worker offline: `VERSION` + lista `FILES` |
| `manifest.webmanifest`, `icons/`, `fonts/` | web app iPhone |
| immagini | `monsters.png`, `skull.png` (teschio viola), `death.png` (testa della Morte), `death_portrait.jpg` (ritratto della Morte) |

## Cosa c'è nel gioco (stato attuale)
- **Calendario**: 2:30 Custode (se comprata una ricetta), 4:00 Cacciatori, 5:00 Flegiàs, 6:00 notte a cicli, **8:00 vittoria** (era 7:00 fino al 2026-10-28); si può continuare: subito i due guardiani, 10:00 il trio, **11:00 notte perenne + solo teschi viola** (i nemici in giro si trasformano), **14:00 la Morte** (uccide al tocco, accelera; ritratto a tutto schermo all'arrivo e nella schermata finale). Dal 2026-10-28 **si può uccidere**: ha un "corpo" nel pool (`ET.death`, ultimo in `ENEMY_DEFS`, slot nella lista `Boss`, `Boss.MAX` = 5) che `Death.update` tiene attaccato a lei; vita `DEATH.hp`, battuta → `Death.killed` (bottino, toast "Mors Mortua") e torna dopo `DEATH.again` s con vita x`DEATH.harder`.
- **Sicilia = muro iniziale (voluto dall'utente)**: slime simpatici verdi (`MonsterArt.cute()`, sprite `cute_<id>`, mappa con `cute: true`). Dal 2026-10-28 pochi e **lenti** ma col morso cattivo (`spawn: 0.2`, `mobSpeed: 0.55`, `mobDmg: 3`, `swarmEvery: 50`); Sardegna simile (`spawn: 0.45`, `mobSpeed: 0.6`, `swarmEvery: 28`). Bot con stats a 0: fermo muore in ~20 s, scappando 50–115 s. Fortuna: `jackpot` (0,9% per uccisione: 10–24 monete, toast "Fortuna"). EXP x1.5 (`xpToNext`), monete Incubo x3 (era x5).
- **Test col bot**: `step()` non chiama `Input.update`, quindi per muovere il personaggio scrivi `Input.ax/ay` prima di ogni `step`. Il pool usa `Enemies.count` (non `.n`).
- **Sicilia** (prima mappa): isola finita (raggio ~4200), mare invalicabile. Un solo **ponte** a nord-ovest → **Scoglio di Scilla** (boss enorme; battuta = l'Aruspice legge **3 omina** per oggetto). In alto (nord) **Goat**: sagoma nera gigante, per ora non fa nulla, non si attraversa.
- **Teletrasporto** (dal 2026-10-28: **100 frecce schivate**, anche dei boss, contate su più partite in `Save.data.arrowStreak`; se una freccia ti uccide torna a 0; numeri in `TELE_UNLOCK`, logica in `countDodge`; `UNLOCKS.teleport` ha `map: null`): Spazio/E/Q o tasto TELE. 50 **frecce schivate** (conto per sempre) → TELE+ (più lontano, ricarica 3 s, onda d'urto). Lo scatto coi kunai è stato tolto.
- **Abilità**: Ira di Dite (vinci Dite), Gelo di Cocito (vinci Cocito). Tasti 1/Z, 2/X o IRA/GELO sul telefono (icone SVG `.skico` nei tasti). Effetti in alta risoluzione: `SkillFx` + `SKILL_FX` in cima a `22_render.js`, disegnati da `Render.drawSkillFx` (forme lisce a mezzi pixel, slot fissi, niente allocazioni).
- **Armi ("skill" per l'utente = le armi che attaccano da sole)**: sopra agli sprite a pixel c'è `Render.weaponGlow` (scie/vortici/fiamme per tipo di proiettile in `WEAPON_GLOW`, arco luminoso delle sfere, fascio liscio del Lume) + mezzaluna liscia nel fendente del Pugio (`FXK.SLASH`). Rifatti in alta risoluzione: frusta (`FXK.WHIP`), bottiglie in volo di Ignis/Aqua Stygia (`Render.bottle`), pozze acide (`Render.acidPool`, evo Flegetonte = sangue), esplosioni (`FXK.BOOM`, vale per tutte). Rota Fortunae indebolita (era ~4x le altre).
- **Locanda**: niente personaggi, vende Forza/Destrezza/Vita/Magia (**11 livelli**, `TRAIT_COSTS` 60→1650; migrazione v5 ha rimborsato i vecchi 5 livelli con `TRAITS_OLD`).
- **Trucchi debug**: tasto O, poi I/P/B. Se usati la partita non conta.

## Regole che non si rompono
- Niente `import`/`export`. Niente CDN nuovi: immagini come file nella cartella o generate da codice.
- Performance: niente allocazioni nel loop caldo (`step`, cicli sui nemici, `Render.draw`); usa i buffer `QBUF_*` e i pool.
- Mai `splice` su `Player.weapons`. Dopo `Enemies.compact()` gli indici cambiano (`ENEMY_REMAP`, `Boss.remap`).
- Salvataggio: nuovi campi solo con default in `Save.defaults()` + pulizia in `normalize`. Se togli qualcosa che si comprava, **rimborsa** (vedi migrazione v4).
- Tutto deve funzionare **touch e in verticale**; ogni tasto ha il suo bottone.
- **`VERSION` in `sw.js` si alza UNA volta sola, a fine giornata, prima di caricare su GitHub** (richiesta dell'utente 2026-10-28: non a ogni modifica). Si fa con `/s98-pubblica` o a mano ('v14' → 'v15'). Se aggiungi un file mettilo in `FILES`. Senza l'aumento l'iPhone tiene la versione vecchia.
- `G.mapId` resta la mappa scelta anche sullo Scoglio; per la mappa "fisica" usa `G.map` (`G.map.isle`, `G.map.bridge`, `G.map.reef`, `G.map.goat`).

## Lavori in corso
- `cantiere.json` = lista dei lavori a fasi (stato: `da fare` / `in corso` / `fatto`). **Aggiornalo** quando inizi/finisci un lavoro: la mod `s98-cantiere` lo mostra nel pannello (comando `/s98`).
- La mod tiene l'elenco dei file del gioco cambiati ("da pubblicare") e **non** alza la versione da sola: `/s98-pubblica` la alza una volta e svuota l'elenco. Quando l'utente dice che ha finito per oggi, ricordagli `/s98-pubblica` (o alza tu `VERSION` a mano) e di caricare i file su GitHub.

## Come provare
1. Server locale: su questo PC non c'è Python/Node → `.claude/serve.ps1` (server PowerShell, già in `.claude/launch.json`: `preview_start` nome `s98`). Manda `no-store`, quindi basta ricaricare.
2. Nel browser, **forza i file nuovi** (la cache del browser tiene le versioni vecchie e ti fa credere che un bug ci sia ancora):
   `await Promise.all([...document.querySelectorAll('script[src]')].map(s => fetch(s.getAttribute('src'), {cache:'reload'}))); location.reload()`
3. Viewport telefono (375x812). Controlla la console: un `SyntaxError` (es. `const` doppio in `Render.draw`) blocca tutto il gioco.
4. Test da console: `startRun(); G.god = true;` poi `step(CFG.DT)` in un ciclo (gestendo `levelup`/`chest`/`dead`); `G.time = 835` per saltare avanti. `G.hitStop = 1000` congela la simulazione per fare screenshot.
5. Alla fine rimetti pulito il salvataggio di prova: `Save.data = Save.normalize(null); Save._local(); location.reload()`.
6. Il service worker è spento su localhost; per provarlo apri con `?sw=1`.

## Copie di sicurezza
`..\..\backup_prima_pwa` = il gioco prima della trasformazione in web app. `..\..\s98.zip` = versione originale.
