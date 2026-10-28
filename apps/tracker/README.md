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

## Barre d'onglets, titres et mises à jour

- **Barre du bas** : une icône fixe et un nom toujours visible par onglet (Accueil, Repas, Sport, Sobriété, Photos, Do It, Tâches, Banque). Les jeux d'icônes qui changeaient toutes les 3 minutes sont retirés. L'onglet actif a une pastille de la couleur d'accent derrière son icône.
- **Titres** : chaque onglet du tracker commence par un grand titre en Geist (la police de l'appli) et une ligne qui dit ce qu'il contient. Do It et Fox Bank gardent leur propre en-tête.
- **Mise à jour automatique** : `build.mjs` écrit `public/version.json`. À l'ouverture, à chaque retour dans l'appli et toutes les 15 minutes, l'appli compare ce numéro au sien et se recharge (une seule fois par version). Pendant Do It ou Fox Bank, ou si tu es en train d'écrire, elle propose un bouton « Mettre à jour » au lieu de recharger. Le service worker lit la page sans le cache du navigateur et ne met jamais `version.json` en cache.

## Onglet Hygiène retiré

La routine d'hygiène disparaît. Les cartes **Hydratation**, **Sommeil** et **Humeur & énergie** passent dans l'onglet Accueil, et la tuile « Hygiène » de l'accueil devient « Hydratation » (verres d'eau, litres, sommeil). La note du jour ne compte plus la routine : ses autres parts (tâches, sport, repas, sobriété, eau) sont remises sur 100. Les données déjà saisies restent enregistrées ; le lien `#hygiene` ouvre l'Accueil.

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

## Widgets du PC (Lively Wallpaper)

Mes apps › **Activer les widgets PC** : un code de liaison à 12 caractères relie le tracker aux widgets animés
du bureau Windows (`apps/widgets`, en ligne sur `…/Vous-/widgets/`). Chaque modification part chiffrée de bout en bout
par le relais ntfy.sh et s'affiche en moins d'une seconde. Un clic sur un widget ouvre `…/Vous-/#onglet&lien=CODE` :
le tracker du PC se relie tout seul, reçoit les données du téléphone et lui renvoie ses propres modifications.
Code dans `addon.js` (fin du fichier) et `../widgets/link.js` ; détails dans `apps/widgets/README.md`.
