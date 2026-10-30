# Dan't Procrastiner

> Pas *dans* une heure. **Maintenant.**

Rappels classés par thème (Sport, Alcool, Nourriture, Courses, Productivité, Famille), relancés **à l'heure prévue puis toutes les heures** tant qu'ils ne sont pas cochés. Heure, date, météo (Open-Meteo, sans clé) et saint du jour en tête d'écran.

## Notifications

- Le service worker (`sw.js`) vérifie les rappels toutes les 30 s tant que l'appli tourne, et sur les réveils `periodicsync` (Chrome Android, appli installée). Boutons « ✅ C'est fait » et « ⏳ Dans 1 h » dans la notification.
- iPhone : notifications seulement si l'appli est ajoutée à l'écran d'accueil (iOS 16.4+), et iOS ne réveille pas une appli web fermée.
- Relance garantie même appli fermée : bouton 📅 d'un rappel (ou Réglages › Agenda) ; il crée un `.ics` avec une alarme à l'échéance puis une par heure (6 relances).
- Heures calmes (22 h–8 h par défaut) : aucune relance la nuit.

## Fichiers

Statique, sans build : `index.html`, `style.css`, `app.js` (interface), `core.js` (stockage IndexedDB et règles de relance, partagé avec le SW), `saints.js`, `sw.js`, `manifest.webmanifest`, `icons/`.

En local : `python3 -m http.server` dans ce dossier, puis http://localhost:8000.
