# Tracker « Routine & Performance » · version web

La même appli que l'artefact Claude, en vrai site : une adresse en `https://…pages.dev`, installable sur l'écran d'accueil de l'iPhone, qui marche hors ligne et se synchronise entre tous tes appareils.

| Fichier | Rôle |
|---|---|
| `app.source.html` | L'appli, exportée telle quelle de l'artefact Claude |
| `shim.js` | Remplace la base de données de Claude par la sauvegarde en ligne `/api/state` |
| `build.mjs` | Construit `public/index.html` (appli + shim + icônes + mode hors ligne) |
| `functions/api/state.js` | Sauvegarde en ligne (Cloudflare Pages Function + base D1) |
| `wrangler.toml` | Configuration Cloudflare ; `ALLOWED_SHA` = empreinte de la clé autorisée |

## Mise en ligne (une seule fois)

1. Cloudflare (gratuit) : **My Profile › API Tokens › Create Token › Custom token**, avec les droits *Account › Cloudflare Pages › Edit* et *Account › D1 › Edit*. Note aussi ton **Account ID** (colonne de droite de la page d'accueil du tableau de bord).
2. GitHub : **Settings › Secrets and variables › Actions** du dépôt, ajoute `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`.
3. Onglet **Actions › Tracker › Run workflow**. Le workflow crée la base D1, le projet Pages et publie le site. L'adresse s'affiche dans le résumé du run (normalement `https://routine-pierre.pages.dev`).

Ensuite, chaque modification poussée dans `apps/tracker/` redéploie automatiquement.

## Sur l'iPhone

1. Ouvre dans **Safari** : `https://<adresse>/?k=<ta clé>` (la clé t'a été donnée par Claude Code ; elle n'est pas dans le dépôt).
2. **Partager › Sur l'écran d'accueil**. L'icône garde la clé : l'appli s'ouvre directement sur ta journée, en plein écran.
3. Tes données sont synchronisées toutes les 4 secondes quand l'appli est ouverte. Sans réseau, tes saisies sont gardées sur le téléphone puis envoyées dès que la connexion revient. Les photos restent sur le téléphone.

## Mettre à jour l'appli

Exporte la nouvelle version de l'artefact dans `app.source.html`, lance `node apps/tracker/build.mjs`, pousse.

## Changer de clé

Génère une nouvelle clé, calcule son empreinte (`printf %s 'CLÉ' | sha256sum`), remplace `ALLOWED_SHA` dans `wrangler.toml`, pousse. Les données sont rangées par clé : changer de clé repart d'un espace vide.
