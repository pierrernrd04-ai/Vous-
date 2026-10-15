# Pass J-24 · Traceo

> Ta prépa commence lundi. 24 semaines, et chaque séance devient une boucle prête à courir depuis ta porte.

Site de vente d'un **programme de préparation généré automatiquement** pour le marathon (24 semaines, course le dimanche 4 avril 2027) et le semi (20 semaines, course le dimanche 7 mars 2027) de Paris, ou toute autre course de printemps à date libre. Paiement unique : 19 € jusqu'à dimanche 23:59, puis 29 € (TVA non applicable, art. 293 B du CGI).

- **Gratuit** : semaine 1 complète et datée, vue d'ensemble des phases, calculateur d'allures, image story « Ma prépa commence lundi ».
- **Pass** : plan complet daté, 3 niveaux modifiables, une boucle Traceo par séance (« Générer ma boucle de X km »), export agenda `.ics`, version imprimable, image story, Traceo Premium jusqu'au 5 avril 2027.

La source de vérité produit et technique est [`docs/SPEC.md`](docs/SPEC.md).

## Pile technique

- **Front** : Vite multi-pages, TypeScript sans framework, aucune dépendance d'exécution (`src/`).
- **API** : Cloudflare Pages Functions (`functions/`), Web Crypto uniquement.
- **Moteur de plan** : `src/engine/`, exécuté **uniquement côté serveur** et dans les tests. Le build échoue si une page l'importe.
- **Tests** : Vitest (`tests/**/*.test.ts`) et Playwright sur Chromium (`tests/e2e/`).

```
index.html, gratuit/, merci/, plan/, cgv/, mentions-legales/, confidentialite/, retractation/
                      pages HTML d'entrée (une par URL)
src/pages/            module TypeScript de chaque page
src/styles/           jetons de design (tokens.css) et socle commun (base.css)
src/shared/           code commun navigateur + serveur (types de l'API, jeton, query)
src/engine/           moteur de plan (serveur et tests seulement)
src/config.ts         prix, date de fin du lancement, Payment Links, URL du site
src/legal.ts          identité de l'éditeur, hébergeur, médiateur
functions/api/        GET /api/preview, GET /api/unlock, POST /api/plan
build/races-plugin.ts pages /courses/<slug>/ et sitemap.xml générées au build
data/races.json       courses de printemps (une page SEO par course)
public/               fichiers copiés tels quels (_headers, robots.txt, icônes…)
scripts/token.mjs     génération manuelle d'un jeton (ventes PayPal, support)
scripts/stripe-setup.mjs  création des Payment Links Stripe (workflow GitHub « Stripe »)
```

## Développer en local

Prérequis : Node 22.12 ou plus récent.

```sh
npm ci
npm run dev          # front seul sur http://localhost:5173 (/api relayé vers le port 8788)
```

Pour tester les Functions, copier `.dev.vars.example` en `.dev.vars`, le remplir, puis :

```sh
npm run build
npm run pages:dev    # site + /api sur http://127.0.0.1:8788
```

Vérifications (aussi exécutées par la CI GitHub Actions à chaque push) :

```sh
npm run typecheck
npm test
npm run build
npm run e2e          # construit le site et le sert avec wrangler, puis lance Playwright
```

## Déployer sur Cloudflare Pages

1. Tableau de bord Cloudflare → **Workers & Pages** → **Créer** → **Pages** → **Se connecter à Git**, puis choisir ce dépôt.
2. Paramètres de build :
   - préréglage du framework : **Aucun** ;
   - commande de build : `npm run build` ;
   - répertoire de sortie : `dist` ;
   - répertoire racine : `/`.
   La version de Node est lue dans `.node-version` (22).
3. Le fichier `wrangler.toml` fixe le nom du projet (`traceo-pass`), le dossier `dist`, la date de compatibilité et la variable `SITE_URL`. Si le site a un autre domaine, modifier `SITE_URL` dans `wrangler.toml` **et** `siteUrl` dans `src/config.ts`.
4. **Paramètres** → **Variables et secrets** (production, et aperçu si besoin), en type **Secret** :

   | Nom | Valeur |
   | --- | --- |
   | `STRIPE_KEY` | clé restreinte Stripe `rk_live_…` (voir plus bas) |
   | `TOKEN_SECRET` | chaîne aléatoire d'au moins 32 caractères, par exemple `openssl rand -base64 48` |
   | `PAYMENT_LINK_IDS` | ids des deux Payment Links séparés par une virgule : `plink_…,plink_…` |

   En ligne de commande, c'est équivalent à `npx wrangler pages secret put TOKEN_SECRET --project-name traceo-pass`.
5. Relancer un déploiement pour que les secrets soient pris en compte.

**Important** : garder `TOKEN_SECRET` dans un gestionnaire de mots de passe. Le changer invalide tous les liens personnels déjà envoyés.

Les en-têtes de sécurité (CSP stricte, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`…) sont définis dans `public/_headers`. Ils ne s'appliquent qu'aux fichiers statiques : les réponses de `/api/*` posent les leurs.

## Configurer Stripe

1. **Clé restreinte du site** : Stripe → Développeurs → Clés API → **Créer une clé restreinte**. Une seule permission : **Checkout Sessions : Lecture**. Tout le reste sur « Aucun ». La clé `rk_live_…` va dans le secret `STRIPE_KEY`.
2. **Produit, prix et Payment Links, en automatique** (recommandé) : ajouter le secret GitHub `STRIPE_SECRET_KEY` (Settings → Secrets and variables → Actions ; clé avec écriture sur Products, Prices et Payment Links), puis onglet **Actions** → **Stripe** → **Run workflow** avec `setup`. En local, c'est `STRIPE_SECRET_KEY=sk_… node scripts/stripe-setup.mjs`. Le script est idempotent et affiche les valeurs à reporter aux étapes 4 et 5. Le même workflow désactive le lien à 19 € le lundi 19 octobre 2026 à 00:00 (heure de Paris).
3. **Ou à la main** : créer le produit « Pass J-24 · Traceo » (paiement unique) et **deux Payment Links** : un à **19 €** (lancement) et un à **29 €**. Pour chacun :
   - après le paiement : **Ne pas afficher de page de confirmation** → rediriger vers
     `https://traceo-pass.pages.dev/merci/?session_id={CHECKOUT_SESSION_ID}` (garder `{CHECKOUT_SESSION_ID}` tel quel, Stripe le remplace) ;
   - l'adresse e-mail est toujours demandée par Stripe : c'est elle qui reçoit l'accès et l'activation de Traceo Premium.
4. Récupérer l'id de chaque lien (`plink_…`, visible dans l'URL du lien dans le tableau de bord) et les mettre tous les deux dans `PAYMENT_LINK_IDS`.
5. Dans `src/config.ts` : coller les URL publiques (`https://buy.stripe.com/…`) dans `paymentLinkLaunch` (19 €) et `paymentLinkRegular` (29 €), puis passer `stripeEnabled` à `true`. Pousser : Cloudflare redéploie.

Le site bascule seul sur le lien à 29 € après le dimanche 18 octobre 2026 à 23:59 (heure de Paris, `launchPriceEnd` dans `src/config.ts`). On peut ensuite désactiver le lien à 19 € dans Stripe, mais **garder son id** dans `PAYMENT_LINK_IDS` pour que les achats déjà payés se débloquent toujours.

Tester d'abord en mode test de Stripe (clé `rk_test_…`, liens de test, carte `4242 4242 4242 4242`) sur un déploiement d'aperçu.

## Vendre par PayPal (secours) et générer un jeton à la main

Tant que `stripeEnabled` vaut `false` et que `paypalFallbackUrl` est renseigné dans `src/config.ts`, le site propose PayPal avec la mention « accès envoyé par e-mail sous 2 h (8 h-22 h) ». À chaque paiement reçu :

1. Générer le lien personnel de l'acheteur, avec **le même** `TOKEN_SECRET` que la production :

   ```sh
   TOKEN_SECRET='…' SITE_URL='https://traceo-pass.pages.dev' npm run token -- acheteur@exemple.fr [ref]
   ```

   `ref` est facultatif (par exemple `w1-marathon-l2`, ou l'identifiant de la transaction PayPal). La commande affiche le lien `https://traceo-pass.pages.dev/plan/#t=<jeton>`.
2. Envoyer ce lien par e-mail à l'acheteur, en lui conseillant de le garder précieusement (il fonctionne jusqu'au 30 juin 2027).
3. Activer Traceo Premium pour cette adresse sous 24 h.

La même commande sert au support (lien perdu, changement d'appareil).

## Avant la mise en vente

- Remplir toutes les valeurs « À COMPLÉTER » de `src/legal.ts` (adresse, e-mail, téléphone, SIREN, médiateur de la consommation, téléphone de l'hébergeur). Le build affiche un avertissement tant qu'il en reste.
- Vérifier les Payment Links et `stripeEnabled` (ou le lien PayPal de secours) dans `src/config.ts`.
- Relire les mentions interdites : pas de logo ni de marque d'organisateur de course, pas d'« officiel », pas de « coaching » ni de « coach » (on parle de « programme généré automatiquement »), jamais de prix barré. L'avertissement santé doit rester visible.
