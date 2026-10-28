# Widgets du tracker pour le bureau Windows (Lively Wallpaper)

Fond d'écran animé avec 14 widgets du tracker « Routine & Performance » (score du jour, pas, eau, sobriété, repas,
sommeil et humeur, tâches, Fox Bank, Do It Sport, sport, semaine, météo, citation, horloge), mis à jour en direct
dès qu'une donnée change dans le tracker de l'iPhone. Un clic sur un widget ouvre le tracker sur le bon onglet,
dans le navigateur par défaut du PC.

En ligne : https://pierrernrd04-ai.github.io/Vous-/widgets/

## Mise en route

1. iPhone : tracker › Accueil › bouton **Widgets PC** (ou Mes apps) › **Activer les widgets PC** → un code de liaison à 12 caractères s'affiche.
2. PC, dans Chrome : ouvrir l'adresse ci-dessus, taper le code, puis **Copier le lien**.
3. Lively Wallpaper : **+** (Ajouter un fond d'écran) › coller le lien dans le champ d'adresse › valider, puis appliquer.

Le lien a la forme `…/widgets/#XXXX-XXXX-XXXX`. Options à ajouter après le code, séparées par `&` :

| Option | Effet |
| --- | --- |
| `theme=light` / `theme=auto` | thème clair, ou clair le jour et sombre le soir (sombre par défaut) |
| `cote=gauche` / `cote=centre` | position des widgets (à droite par défaut, les icônes du bureau restent à gauche) |
| `taille=90` | taille des widgets en % (50 à 160) |
| `anim=0` | fond fixe (moins de calcul pour un PC portable sur batterie) |
| `verre=1` | effet verre dépoli sur les widgets (plus joli, plus gourmand) |

## Liaison (link.js)

- Relais : trois serveurs ntfy publics, gratuits et sans compte, utilisés en même temps : ntfy.envs.net et
  ntfy.adminforge.de (17 280 messages par jour et par adresse IP), ntfy.sh (250 seulement). Un envoi réussit dès
  qu'un relais l'a reçu ; les messages reçus en double sont écartés. Les relais gardent les messages 12 h.
  Avant (ntfy.sh seul), un quota épuisé, par exemple sur une connexion 4G partagée, bloquait tout sans le dire.
- Chiffrement de bout en bout : AES-GCM 256 bits, clé et nom du canal tirés du code de liaison (PBKDF2-SHA-256,
  120 000 tours). Les relais ne voient que du texte illisible. Le code n'est jamais envoyé à un serveur
  (il reste après le `#` des adresses).
- Le tracker envoie chaque modification (regroupées sur ½ s) avec un résumé calculé par ses propres formules,
  et un résumé frais à chaque retour dans l'appli après 15 min. Les widgets n'affichent que ce résumé.
  Fox Bank et Do It Sport (onglets du tracker) suivent le même chemin.
- Sens inverse : le tracker ouvert sur le PC (depuis un widget) reçoit tout et renvoie ses modifications au téléphone.
  En cas de modification des deux côtés, la plus récente gagne (par journée, réglages, tâches, Fox Bank, Do It).
- Les widgets gardent une copie des données sur le PC : affichage immédiat au démarrage, et relais de secours
  (republiée toutes les 10 h, envoyée à un tracker qui la demande quand le téléphone est fermé).
- Filets de sécurité : relecture directe des relais chaque minute, reconnexion immédiate quand Lively réveille
  le fond d'écran (trou dans l'horloge) ou quand l'iPhone revient au premier plan, envois limités à 15 s.
- Diagnostic : tracker › Widgets PC affiche le dernier envoi (« reçu par 2 relais sur 3 ») ou l'erreur, et
  **Tester la liaison** fait un aller-retour par les relais ; les widgets affichent « Test reçu de ton iPhone ✓ »
  et les 4 derniers caractères du code.
- La page des widgets se met à jour toute seule (`version.json`, écrit par `node apps/widgets/build.mjs`).
- Mesures : iPhone simulé avec WebKit (moteur de Safari), widgets dans Chromium, relais réels avec ntfy.sh saturé
  (erreur 429) : widget à jour 1,2 s après l'appui, test de liaison en 1,4 s aller-retour.

`link.js` est partagé : `apps/tracker/build.mjs` l'intègre à la page du tracker, la page des widgets le charge tel quel.
