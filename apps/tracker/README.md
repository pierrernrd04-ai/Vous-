# Tracker « Routine & Performance » · version web

La même appli que l'artefact Claude, en vrai site : une adresse en `https://…pages.dev`, installable sur l'écran d'accueil de l'iPhone, qui marche hors ligne et se synchronise entre tous tes appareils.

| Fichier | Rôle |
|---|---|
| `app.source.html` | L'appli, exportée telle quelle de l'artefact Claude |
| `shim.js` | Remplace les fonctions de Claude : sauvegarde en ligne `/api/state`, et analyse photo via `ai.js` |
| `ai.js` | Analyse photo de l'assiette et tri automatique des photos : API Claude avec la clé de l'utilisateur |
| `addon.js` | Réglage de cette clé (Mes apps › Analyse photo par Claude), inséré dans le script de l'appli |
| `build.mjs` | Construit `public/index.html` (appli + shim + icônes + mode hors ligne) et `public/ai.js` (SDK Claude) |
| `functions/api/state.js` | Sauvegarde en ligne (Cloudflare Pages Function + base D1) |
| `wrangler.toml` | Configuration Cloudflare ; `ALLOWED_SHA` = empreinte de la clé autorisée |

## Publication actuelle : GitHub Pages (mode local)

Adresse : **https://pierrernrd04-ai.github.io/Vous-/**, servie par la branche `gh-pages` (contenu de `public/` construit en mode local, plus un fichier `.nojekyll`). Les données restent dans le téléphone. Pour mettre à jour : `npm ci` puis `node build.mjs` dans `apps/tracker`, puis copier `public/` dans la branche `gh-pages` (sans `_headers`) et pousser.

## Onglet « Do It » (Do It Sport)

L'onglet Budget est remplacé par **Do It Sport** (cycles de 3 minutes, kettlebell, marche lestée, calories). L'appli publiée sur https://do-it-sport.netlify.app est copiée dans `sport/source.html` ; `build.mjs` la sert dans `public/sport/` avec quatre retouches : alarmes écran verrouillé envoyées au serveur Netlify de Do It Sport, minuteur iPhone ouvert depuis la fenêtre principale, cache hors ligne limité à ses propres fichiers, et un résumé par jour (`doitsport-sum` : calories, cycles, minutes) que lit la tuile « Do It Sport » de l'accueil du tracker (à la place de « Budget du mois »).

Dans le tracker, Do It Sport tourne dans un cadre gardé en vie quand on change d'onglet : un minuteur en cours n'est jamais coupé. Les photos de motivation ne s'affichent pas pendant une séance. Ses données sont celles de cette copie (le même téléphone que le tracker), pas celles de l'appli Netlify.

Mettre à jour Do It Sport : `curl -o apps/tracker/sport/source.html https://do-it-sport.netlify.app/index.html`, puis `node build.mjs`.

## Onglet « Fox Bank »

L'onglet Traceo est remplacé par **Fox Bank** (`apps/foxbank`, servi sur le même site dans `foxbank/`), affiché de la même façon que Do It Sport : un cadre gardé en vie entre les onglets. Les données de Traceo restent enregistrées. Dans le tracker, Fox Bank a ses propres données (celles du tracker sur ce téléphone) : pour y reprendre celles de l'appli Fox Bank de l'écran d'accueil, Mon solde › Réglages › « Copier mes données » d'un côté, « Coller des données » de l'autre. Les liens `#traceo` et `#foxbank` ouvrent cet onglet, `#budget` et `#doit` l'onglet Do It.

## Analyse photo de l'assiette et tri automatique des photos

Hors de Claude, ces deux fonctions appellent directement l'API Claude depuis le téléphone, avec la clé API personnelle de l'utilisateur (platform.claude.com › API Keys). La clé est collée une fois dans **Mes apps › Analyse photo par Claude**, vérifiée sans frais, puis gardée dans le téléphone (`localStorage`) : elle n'est ni dans le dépôt ni sur un serveur. Le SDK (`public/ai.js`, 310 Ko) n'est chargé qu'au premier usage.

- Modèle : Claude Opus 5.5, effort moyen pour l'assiette, faible pour le tri ; repli automatique sur un autre modèle si Claude décline une photo.
- Sans clé : la photo de l'assiette ouvre le réglage, et l'import de photos garde tout (sans tri), comme avant.
- Les photos gardées par le tri sont enregistrées dans le téléphone (IndexedDB).

## Option : synchronisation entre appareils (Cloudflare)

1. Cloudflare (gratuit) : **My Profile › API Tokens › Create Token › Custom token**, avec les droits *Account › Cloudflare Pages › Edit* et *Account › D1 › Edit*. Note aussi ton **Account ID** (colonne de droite de la page d'accueil du tableau de bord).
2. GitHub : **Settings › Secrets and variables › Actions** du dépôt, ajoute `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`.
3. Onglet **Actions › Tracker › Run workflow**. Le workflow crée la base D1, le projet Pages et publie le site. L'adresse s'affiche dans le résumé du run (normalement `https://routine-pierre.pages.dev`).

Ensuite, chaque modification poussée dans `apps/tracker/` redéploie automatiquement.

## Sur l'iPhone

1. Ouvre dans **Safari** : `https://<adresse>/?k=<ta clé>` (la clé t'a été donnée par Claude Code ; elle n'est pas dans le dépôt).
2. **Partager › Sur l'écran d'accueil**. L'icône garde la clé : l'appli s'ouvre directement sur ta journée, en plein écran.
3. Tes données sont synchronisées toutes les 4 secondes quand l'appli est ouverte. Sans réseau, tes saisies sont gardées sur le téléphone puis envoyées dès que la connexion revient. Les photos restent sur le téléphone.

## Mettre à jour l'appli

Exporte la nouvelle version de l'artefact dans `app.source.html`, lance `npm ci` puis `node build.mjs` dans `apps/tracker`, pousse.

## Changer de clé

Génère une nouvelle clé, calcule son empreinte (`printf %s 'CLÉ' | sha256sum`), remplace `ALLOWED_SHA` dans `wrangler.toml`, pousse. Les données sont rangées par clé : changer de clé repart d'un espace vide.
