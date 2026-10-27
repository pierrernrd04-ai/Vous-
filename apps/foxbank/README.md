# Fox Bank

Suivi de compte personnel : solde, dépenses par jour et par catégorie, budget mensuel, virements reçus, citations sur l'argent, date, heure et météo du jour.

| Version | Adresse | Données |
|---|---|---|
| Appli iPhone (écran d'accueil) | https://pierrernrd04-ai.github.io/Vous-/foxbank/ | Dans le téléphone (`localStorage`) |
| Artefact Claude | lien claude.ai donné par Claude | Stockage privé de l'artefact (`db`, sous `data/users/<id>/foxbank`) |

Les deux versions viennent du même fichier `app.html`. Pour passer ses comptes de l'une à l'autre : Mon solde › Réglages › « Copier mes données », puis « Coller des données » de l'autre côté.

## Installer sur l'iPhone

Safari › l'adresse ci-dessus › Partager › **Sur l'écran d'accueil**. L'appli s'ouvre en plein écran et marche hors ligne (sauf la météo).

## Calcul du solde

Solde actuel = dernier solde saisi + virements ajoutés depuis − dépenses ajoutées depuis (option « Mes dépenses baissent mon solde », activée par défaut). Saisir un nouveau solde repart de ce montant. Les montants sont stockés en centimes.

## Fichiers

- `app.html` : toute l'appli, publiée telle quelle comme artefact
- `build.mjs` : construit `public/index.html` (en-tête iPhone, manifeste, mode hors ligne)
- `public/` : ce qui est servi sur GitHub Pages (`manifest.json`, `sw.js`, `icons/`)

Météo et recherche de ville : Open-Meteo (sans clé). Couleurs des catégories : palette validée pour le daltonisme, chaque catégorie toujours accompagnée de son nom.

Mettre à jour : modifier `app.html`, lancer `node apps/foxbank/build.mjs`, copier `public/` dans `foxbank/` sur la branche `gh-pages`, et republier l'artefact.
