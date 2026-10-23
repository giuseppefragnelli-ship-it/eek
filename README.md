# S98

Survivor-like in stile Windows 98, ambientato tra l'Inferno di Dante e la Roma antica. JavaScript puro + canvas, niente build.

## Giocare
Apri `index.html` da un server web (per esempio GitHub Pages). Aperto direttamente come file dal disco alcuni browser bloccano l'immagine dei mostri.

**GitHub Pages:** Settings → Pages → Source: *Deploy from a branch* → branch `main`, cartella `/ (root)` → Save. Dopo un minuto il gioco è su `https://<utente>.github.io/<repo>/`.

**iPhone come app:** apri il link in Safari → Condividi → *Aggiungi alla schermata Home*. Si apre a schermo intero e funziona anche offline. Gioca sempre dall'icona: il salvataggio dell'icona è separato da quello di Safari, e se cancelli l'icona lo perdi (fai un *Esporta codice* ogni tanto).

**Aggiornare il gioco:** dopo ogni modifica cambia `VERSION` in `sw.js` (`'v1'` → `'v2'`…), sennò il telefono continua a usare la copia vecchia. Se aggiungi un file, mettilo anche nella lista `FILES` di `sw.js`. In locale (localhost) il service worker è spento; per provarlo apri con `?sw=1`.

## Comandi
- Movimento: WASD / frecce, joystick sul telefono
- Teletrasporto (segreto): Spazio / E / Q, tasto TELE sul telefono. 50 frecce schivate = TELE+ potenziato
- Abilità (vinci Dite / Cocito): 1 o Z = Ira di Dite, 2 o X = Gelo di Cocito; sul telefono i tasti IRA e GELO
- Velocità x2: F o il bottone x2
- Rilancia le carte: R · Pausa: Esc

## File
Tutti i file stanno nella stessa cartella: `index.html`, `game.css`, `monsters.png` e gli script `01_config.js` … `26_main.js`, caricati in quest'ordine (script classici, non moduli). Per la web app: `manifest.webmanifest`, `sw.js` (offline), `icons/` e `fonts/` (Silkscreen in locale).

Trucchi del debug (tasto O, poi I invincibile · P +300 nemici · B boss): solo con la finestra debug aperta, e la partita non conta (niente monete, record, sblocchi né missioni).

Il salvataggio resta nel browser (localStorage). Il salvataggio online funziona solo dentro Claude: qui si può passare i progressi con *Opzioni → Esporta / Importa codice*.
