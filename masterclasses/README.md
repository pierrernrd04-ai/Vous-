# Catalogue de masterclasses à 49 €

20 masterclasses écrites, chacune prête à publier : le cours, la page de vente, 5 e-mails de promo et le SAV. Règles communes : [`_commun/BRIEF.md`](_commun/BRIEF.md).

| # | Masterclass | Niche |
|---|---|---|
| 01 | [Courir 10 km sans t'arrêter en 10 semaines](01-premier-10km/) | Course à pied débutant |
| 02 | [Ton premier semi-marathon, étape par étape](02-premier-semi/) | Course à pied intermédiaire |
| 03 | [Ta première course HYROX : la méthode en 12 semaines](03-premiere-hyrox/) | Fitness racing |
| 04 | [Du bitume aux sentiers : ton premier trail](04-premier-trail/) | Trail débutant |
| 05 | [Claude pour indépendants : délègue ton admin à l'IA](05-claude-independants/) | IA / indépendants |
| 06 | [Crée et vends ton premier produit numérique avec l'IA](06-produit-numerique-ia/) | IA / infopreneuriat |
| 07 | [La méthode de prompt pro](07-methode-prompt-pro/) | IA / productivité |
| 08 | [Crée ton site ou ton outil sans coder, avec l'IA](08-outil-sans-coder-ia/) | IA / no-code |
| 09 | [L'IA pour préparer tes cours en deux fois moins de temps](09-ia-enseignants/) | IA / éducation |
| 10 | [L'IA pour agents immobiliers](10-ia-immobilier/) | IA / immobilier |
| 11 | [L'IA pour artisans : devis, relances et avis clients](11-ia-artisans/) | IA / artisanat |
| 12 | [CV, lettre et entretien : ta recherche d'emploi avec l'IA](12-ia-recherche-emploi/) | IA / emploi |
| 13 | [Lance et anime ton run club de quartier](13-run-club/) | Running social |
| 14 | [Padel : les bases pour progresser dès tes premiers matchs](14-padel-debutant/) | Padel |
| 15 | [Deviens créateur UGC : ton portfolio et tes premières marques](15-createur-ugc/) | Création de contenu UGC |
| 16 | [Automatise ta petite entreprise avec des agents IA](16-agents-ia-pme/) | IA / automatisation |
| 17 | [Cultive tes pleurotes à la maison](17-champignons-maison/) | Culture de champignons |
| 18 | [Ton pain au levain maison, de A à Z](18-levain-maison/) | Boulangerie maison |
| 19 | [Entretiens et dépanne toi-même ton vélo électrique](19-velo-electrique-entretien/) | Vélo électrique |
| 20 | [Deviens ghostwriter LinkedIn : vends l'écriture de posts](20-ghostwriter-linkedin/) | Freelance / écriture |

## Contenu de chaque dossier

| Fichier | À quoi il sert |
|---|---|
| `formation.md` | Le cours complet (ce que l'acheteur reçoit) |
| `page-de-vente.md` | La page TinyPages, bloc par bloc |
| `emails.md` | 5 e-mails de promo (J0 → J+6) |
| `sav.md` | FAQ et réponses SAV propres au sujet |
| `fiche.json` | Titre, cible, modules, mots-clés |

Communs à tout le catalogue : [`_commun/sav.md`](_commun/sav.md) (organisation, remboursements, 8 réponses types), [`_commun/cgv.md`](_commun/cgv.md) (CGV), [`_commun/prompts-claude.md`](_commun/prompts-claude.md) (prompts Claude pour créer, améliorer et décliner).

## Mise en ligne

### 0. Bloquant avant la première vente (légal)

- [ ] Compléter adresse, SIREN, e-mail, téléphone et **médiateur de la consommation** dans `src/legal.ts` et `_commun/cgv.md`.
- [ ] Décider : garantie « remboursé sous 14 jours » oui ou non (voir `_commun/sav.md`). Si oui, l'ajouter aux pages de vente et aux CGV.
- [ ] Créer une adresse e-mail support.
- [ ] Remplir le bloc « Qui suis-je » de chaque page de vente (emplacements `[PRÉSENTATION DU FORMATEUR À COMPLÉTER]`).

### 1. Paiement (Stripe)

Deux options, choisis-en une :

- **A. Le paiement intégré de TinyPages** (si ton offre TinyPages le propose, connecté à ton compte Stripe) : l'accès est alors livré automatiquement après l'achat. Crée un produit à 49 € par masterclass dans TinyPages. Active la case de renonciation au droit de rétractation si elle est disponible ; sinon, ajoute la phrase au-dessus du bouton.
- **B. Payment Links Stripe** (prêts à générer) : un lien de paiement par masterclass, créés d'un coup par le script.

  ```sh
  # d'abord en test, puis en live
  STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-masterclasses.mjs
  STRIPE_SECRET_KEY=sk_live_... ACCESS_BASE_URL=https://<ton-site> node scripts/stripe-masterclasses.mjs
  ```

  Les 20 URL sont écrites dans `_commun/payment-links.json`. Colle chaque URL sur le bouton « Je commence pour 49 € » de sa page. Avec `ACCESS_BASE_URL`, l'acheteur est redirigé vers `<site>/<slug>/acces` ; sans elle, Stripe affiche une confirmation et tu envoies l'accès par e-mail (réponse R1 de `_commun/sav.md`).

### 2. Pages TinyPages (par masterclass)

1. **Page de vente** : copie `page-de-vente.md` bloc par bloc, et branche le bouton sur le lien de paiement.
2. **Page de contenu** (accès réservé aux acheteurs) : copie `formation.md`.
3. **Pages communes** : CGV (`_commun/cgv.md`) et mentions légales, liées en pied de chaque page de vente.
4. **Séquence e-mail** : `emails.md` dans ton outil d'e-mailing, uniquement pour des inscrits volontaires.

### 3. Lancement conseillé

Ne lance pas les 20 en même temps. Commence par les 3 dont tu peux parler le plus légitimement (par exemple 01, 13 et 05 : course à pied, run club et Claude, en lien avec Traceo), mesure les ventes pendant 2 semaines, puis ajoute les autres par lots de 3 ou 4.
