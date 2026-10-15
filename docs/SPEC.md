# Pass J-24 · Traceo — spécification produit et technique

Source de vérité partagée par tous les contributeurs (humains et agents). Toute la copie utilisateur est en **français**.

## 1. Produit

- **Nom** : « Pass J-24 · Traceo ». Accroche : « Ta prépa commence lundi. 24 semaines, et chaque séance devient une boucle prête à courir depuis ta porte. »
- **Cible** : coureurs qui ont un dossard pour le **marathon de Paris du dimanche 4 avril 2027** ou le **semi de Paris du dimanche 7 mars 2027**, plus tout coureur visant une course de printemps (option « autre course » avec date libre).
- **Calendrier** : du dimanche 18/10/2026 au 4/04/2027 = 24 semaines ; au 7/03/2027 = 20 semaines. Le **lundi 19/10/2026 est le jour 1**.
- **Prix** (paiement unique, TTC, « TVA non applicable, art. 293 B du CGI ») :
  - **19 €** jusqu'au **dimanche 18/10/2026 23:59 Europe/Paris** (constante `LAUNCH_PRICE_END = "2026-10-18T23:59:59+02:00"`),
  - **29 €** ensuite. Jamais de prix barré, jamais de « -34 % » (art. L112-1-1 C. conso). Formulation : « 19 € jusqu'à dimanche 23:59, puis 29 € ».
- **Inclus** : plan complet daté (marathon 24 sem. ou semi 20 sem., ou date libre), 3 niveaux modifiables, bouton « Générer ma boucle de X km » par séance, export agenda `.ics`, version imprimable (PDF via impression), image story 1080×1920, Traceo Premium jusqu'au 5/04/2027 (activé manuellement sous 24 h à partir de l'e-mail d'achat).
- **Gratuit (aimant)** : formulaire → semaine 1 complète datée + vue d'ensemble des phases (contenu des semaines suivantes masqué) + calculateur d'allures + image story « Ma prépa commence lundi ».
- **Interdits** : logo/marque « Marathon de Paris », « officiel », ASICS, Schneider ; le mot « coaching » / « coach » pour le plan (art. L212-1 Code du sport) → dire « programme généré automatiquement ». Avertissement santé visible (landing, plan, pied de page).

## 2. Moteur de plan (`src/engine/`, code partagé, utilisé **uniquement côté serveur** et dans les tests)

Le bundle navigateur **ne doit jamais importer** `src/engine/` : la semaine 1 gratuite et l'aperçu sont servis par `/api/preview`, le plan complet par `/api/plan` (jeton requis).

### Entrées (`PlanInput`)
```ts
type RaceKind = 'marathon' | 'semi';
type Level = 'finisher' | 'l2' | 'l3'; // marathon: Finisher / sub-4h30 / sub-4h ; semi: Finisher / sub-2h / sub-1h45
interface PlanInput {
  race: RaceKind;
  raceDate: string;        // ISO yyyy-mm-dd, dimanche ou autre jour
  raceName?: string;       // ex. "Marathon de Paris"
  level: Level;
  t10: number;             // temps actuel sur 10 km en secondes (1800..5400)
  weeklyKm: number;        // km actuels / semaine (0..120)
  sessions: 3 | 4 | 5;     // séances / semaine
  longRunDay: 'sat' | 'sun';
  startDate?: string;      // ISO ; défaut = lundi de la semaine courante ou prochain lundi
}
```
### Sorties (`Plan`)
```ts
interface Session { date: string; dow: 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun'; type: 'ef'|'qualite'|'sl'|'recup'|'course'|'renfo';
  title: string; km: number; durationMin: number; paces: { label: string; secPerKm: number }[]; steps: string[]; loopKm: number | null; }
interface Week { index: number; start: string; end: string; phase: 'base'|'developpement'|'specifique'|'affutage'; deload: boolean; km: number; sessions: Session[]; note?: string; }
interface Plan { input: PlanInput; weeks: Week[]; paces: Record<'ef'|'seuil'|'as10'|'allure_course'|'recup', number>; predicted: { raceSec: number }; totalKm: number; }
```
### Règles
- **Allures** (Riegel, exposant 1,06) : `T(D) = T10 × (D/10)^1.06` (semi ≈ 2,21 × T10, marathon ≈ 4,60 × T10). Niveau Finisher : +5 % de marge sur l'allure course prédite. Si l'objectif du niveau (sub-4h, sub-4h30, sub-2h, sub-1h45) est plus rapide que la prédiction + 3 %, garder la prédiction (ne jamais imposer une allure irréaliste) et ajouter une `note`. Si l'objectif est au contraire bien plus lent que le potentiel, l'allure course est plafonnée à prédiction + 5 % (comme Finisher), avec une note encourageante (décision du 14/10/2026).
  Allures dérivées : EF = allure marathon × 1,15–1,25 (prendre 1,20), récup = EF × 1,08, seuil ≈ allure 10 km × 1,06 (≈ allure semi), AS10 = allure 10 km.
- **Volumes au pic** (km/sem) : marathon Finisher 48, l2 58, l3 68 ; semi Finisher 33, l2 42, l3 50. **Sortie longue max** : marathon 28 / 30 / 32 km ; semi 16 / 18 / 20 km. Sortie longue ≤ 40 % du volume hebdo en base, ≤ 45 % en développement, ≤ 50 % en spécifique (les deux courses ; 40 % en affûtage), toujours bornée par ces maxima, par 3 h à l'allure EF et par +2 km au plus par rapport à la sortie longue de la dernière semaine non allégée (décision du 14/10/2026, qui remplace la règle 35 % / 45 %). Repères : marathon l2 ≈ 28-30 km au plus long (27,5 km pour un T10 de 50 min, limite des 3 h), semi Finisher ≈ 15-16 km.
- **Progression** : partir de `max(weeklyKm, 15)` ; hausse ≤ **10 %** par semaine non allégée par rapport à la dernière semaine non allégée ; ne jamais dépasser le pic. Ces deux règles portent sur les km d'entraînement (course exclue). Avec 3 séances, le pic est réduit de 15 % ; pour les coureurs les plus lents, il est aussi borné pour qu'aucune séance ne dépasse la sortie longue.
- **Semaines allégées** (-25 à -30 %) : marathon 24 sem. → S4, S7, S10, S14, S18 (S10 = semaine du 21 au 27/12/2026, Noël). Semi 20 sem. → S4, S7, S10, S14. Ces listes s'appliquent aux plans de 24 / 20 semaines quelle que soit la date de départ (Noël ne tombe en S10 que pour Paris). Pour une autre durée : toutes les 3-4 semaines + la semaine contenant le 25/12 si elle tombe dans le plan hors affûtage.
- **Affûtage** : marathon 3 dernières semaines (-20 %, -35 %, -55 % course incluse) ; semi 2 dernières (-25 %, -50 % course incluse). La course seule dépasse déjà 45 % / 50 % de la semaine de référence : la semaine de course garde donc des footings courts hors course (au moins 30 % marathon / 40 % semi de la dernière semaine chargée, jamais plus de 45 % / 50 %). `Week.km` de la semaine de course inclut la course et peut dépasser le pic (accepté le 14/10/2026).
- **Phases** : marathon base S1-S8, développement S9-S16, spécifique S17-S21, affûtage S22-S24 ; semi base S1-S6, développement S7-S13, spécifique S14-S18, affûtage S19-S20. Autres durées : mise à l'échelle proportionnelle.
- **Semaine type** (4 séances, `longRunDay = sun`) : mar EF + lignes droites ; jeu qualité (base : fartlek/côtes, développement : fractionné AS10 ou seuil, spécifique : blocs à allure course) ; sam EF courte + renfo ; dim sortie longue. 3 séances : retirer le samedi. 5 séances : ajouter mer EF. `longRunDay = sat` : sortie longue samedi, EF courte dimanche.
- **Dernière semaine** : la course apparaît comme séance `course` à `raceDate` avec la distance officielle (42,195 / 21,1).
- **Plan court/tardif** : si moins de semaines que prévu jusqu'à la course (min 8), démarrer à la semaine courante, raccourcir la base, garder les règles +10 %, affûtage et décharge. En dessous de 8 semaines : erreur explicite `PLAN_TOO_SHORT`.
- **loopKm** : distance de la boucle à générer (km de la séance arrondi à 0,5) ; `null` pour renfo/course.
- Déterministe : même entrée → même sortie. Dates calculées en **UTC date-only** (pas de fuseau, pas de décalage DST).
- Validation stricte des entrées (`validateInput` renvoie la liste des erreurs en français).

## 3. API (Cloudflare Pages Functions, `functions/`)

Variables d'environnement : `STRIPE_KEY` (clé restreinte, lecture Checkout Sessions), `TOKEN_SECRET` (≥ 32 caractères), `PAYMENT_LINK_IDS` (ids `plink_…` séparés par des virgules), `SITE_URL`.

- `GET /api/preview?<PlanInput en query>` → `{ week1: Week, overview: { index, start, phase, deload, km }[], paces, predicted }`. Pas de jeton. Cache 1 h.
- `GET /api/unlock?session_id=cs_…` → lit `https://api.stripe.com/v1/checkout/sessions/{id}` (Bearer `STRIPE_KEY`). Exige `status=complete`, `payment_status=paid`, `payment_link ∈ PAYMENT_LINK_IDS`. Renvoie `{ token, email, ref }`. Erreurs : 400 id invalide (regex `^cs_(test|live)_[A-Za-z0-9]+$`), 402 non payé, 403 lien inconnu, 502 Stripe injoignable. Jamais de fuite de la clé ni du corps Stripe brut.
- `POST /api/plan` corps `{ token, input: PlanInput }` → `Plan`. 401 si jeton invalide/expiré.
- **Jeton** : `base64url(JSON payload).base64url(HMAC-SHA256)`, payload `{ v:1, sub: email, sid: session id | "paypal:<id>", ref, iat, exp }`, expiration 2027-06-30. Vérification à temps constant. Web Crypto (`crypto.subtle`) uniquement.
- `scripts/token.mjs` : `npm run token -- <email> [ref]` génère un jeton (ventes PayPal / support) avec `TOKEN_SECRET` lu dans l'environnement, et imprime le lien `SITE_URL/plan/#t=<jeton>`.
- En-têtes de sécurité via `public/_headers` (CSP stricte, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).

## 4. Front (Vite multi-pages, TypeScript sans framework, `src/`)

Pages : `/` landing ; `/gratuit/` formulaire + semaine 1 ; `/merci/` ; `/plan/` ; `/courses/<slug>/` (une page SEO par course de `data/races.json`, générée au build) ; `/cgv/`, `/mentions-legales/`, `/confidentialite/`, `/retractation/`.

- **Achat** : modale avec case **non pré-cochée** « Je demande l'accès immédiat au contenu numérique et je reconnais perdre mon droit de rétractation (art. L221-28 13° C. conso) » + lien CGV ; le bouton n'est actif qu'une fois la case cochée ; il ouvre le Payment Link (19 € avant la date, 29 € après) avec `?client_reference_id=w1-<race>-<level>&prefilled_email=…`. Si `config.paypalFallbackUrl` est défini et `config.stripeEnabled === false`, proposer PayPal avec la mention « accès envoyé par e-mail sous 2 h (8 h-22 h) ».
- **/merci/** : lit `session_id`, appelle `/api/unlock`, stocke le jeton (`localStorage`, try/catch), affiche le **lien personnel** `/plan/#t=<jeton>` à conserver + boutons « Ouvrir mon plan », « Installer l'app ». Si `ref` ne commence pas par `w1-`, réafficher la case de renonciation avant d'ouvrir le plan.
- **/plan/** : jeton depuis `#t=` ou `localStorage`. Formulaire de paramètres (course, date, niveau, T10, km, séances, jour de sortie longue) mémorisé localement ; vue semaine par semaine, semaine courante ouverte ; carte par séance (type, km, durée, allures, consignes, case « fait » persistée) ; bouton « Générer ma boucle de X km » → `https://traceorun.pages.dev/app?km=X` ; export `.ics` (UID stable, événements journée entière, `\r\n`, échappement RFC 5545, lignes repliées à 75 octets) ; impression propre (`@media print`) ; image story canvas 1080×1920.
- **PWA** : `manifest.webmanifest` (nom « Pass J-24 · Traceo », short_name « J-24 », `display: standalone`, `start_url: /plan/`, icônes 192/512 + maskable, couleurs de la marque), `sw.js` (pré-cache du shell, sans les pages `/courses/…` ni le sitemap, mis en cache seulement à la visite ; réseau d'abord pour `/api/*` avec repli sur le dernier plan en cache, version de cache incrémentée au build). Bandeau d'installation iOS (« Partager → Sur l'écran d'accueil »).
- **Accessibilité / mobile** : mobile d'abord (360 px), contrastes AA, focus visibles, `prefers-reduced-motion`, pas de dépendance JS tierce, polices système ou une Google Font.
- **SEO** : balises title/description/OG/Twitter par page, JSON-LD (`Product` + `Offer` en EUR, `FAQPage`), `sitemap.xml`, `robots.txt`, URLs canoniques à partir de `SITE_URL`.
- **Config** : `src/config.ts` (prix, date de fin du lancement, URLs des Payment Links 19/29, PayPal de secours, `stripeEnabled`, `traceoAppUrl`, `siteUrl` ; les réglages de paiement peuvent être remplacés au build par les variables publiques `PUBLIC_STRIPE_ENABLED`, `PUBLIC_PAYMENT_LINK_LAUNCH`, `PUBLIC_PAYMENT_LINK_REGULAR`, `PUBLIC_PAYPAL_URL`) et `src/legal.ts` (identité éditeur : nom, « EI », adresse, e-mail, téléphone, SIREN, médiateur — valeurs `À COMPLÉTER` tant que non fournies ; le build affiche un avertissement si une valeur est `À COMPLÉTER`).

## 5. Qualité

- `npm run typecheck`, `npm test` (Vitest), `npm run build` doivent passer. CI GitHub Actions sur chaque push.
- Tests moteur : invariants sur toutes les combinaisons (2 courses × 3 niveaux × 3/4/5 séances × sat/sun × T10 {40, 50, 60 min} × km {15, 30, 50}) + cas date libre et plan tardif.
- Tests API : jeton (signature, altération, expiration), unlock avec `fetch` Stripe simulé (payé, non payé, lien inconnu, id invalide, Stripe en panne).
- Test e2e Playwright (Chromium déjà installé, `executablePath: '/opt/pw-browsers/chromium'` si besoin) : landing → gratuit → semaine 1 affichée ; plan avec jeton de test via `wrangler pages dev` ; pages de course ; aucune page ne défile horizontalement en 360 × 740. Captures 360 px dans `docs/screenshots/`.
- Stores (App Store, Google Play) : voir `docs/STORES.md` ; `capacitor.config.json` prêt, Capacitor non installé.
