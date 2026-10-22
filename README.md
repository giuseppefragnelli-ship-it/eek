# Slime Survivors 98

Survivor-like in stile Windows 98, ambientato tra l'Inferno di Dante e la Roma antica. JavaScript puro + canvas, niente build.

## Giocare
Apri `index.html` da un server web (per esempio GitHub Pages). Aperto direttamente come file dal disco alcuni browser bloccano l'immagine dei mostri.

**GitHub Pages:** Settings → Pages → Source: *Deploy from a branch* → branch `main`, cartella `/ (root)` → Save. Dopo un minuto il gioco è su `https://<utente>.github.io/<repo>/`.

## Comandi
- Movimento: WASD / frecce, joystick sul telefono
- Scatto: Spazio (doppio tocco sul telefono)
- Teletrasporto (segreto): E / Q
- Velocità x2: F o il bottone x2
- Rilancia le carte: R · Pausa: Esc

## File
Tutti i file stanno nella stessa cartella: `index.html`, `game.css`, `monsters.png` e gli script `01_config.js` … `26_main.js`, caricati in quest'ordine (script classici, non moduli).

Il salvataggio resta nel browser (localStorage). Il salvataggio online funziona solo dentro Claude: qui si può passare i progressi con *Opzioni → Esporta / Importa codice*.
