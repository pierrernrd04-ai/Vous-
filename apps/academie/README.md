# Kairos Académie · guide de lancement

10 masterclasses en ligne à 25 € (2 h 30 chacune, 8 modules, boîte à outils, quiz de 20 questions, certificat de réussite), un Pass intégral à 89 €, des pages de vente, un espace de cours, la vérification des certificats et un tableau de bord des visites et des ventes.

- Site : https://kairos-academie.netlify.app
- Tableau de bord : https://kairos-academie.netlify.app/admin/ (mot de passe : variable `ADMIN_PASSWORD` dans Netlify)
- Projet Netlify : https://app.netlify.com/projects/kairos-academie

## Ce qu'il reste à faire avant d'encaisser (15 minutes)

1. **Valider les 11 liens de paiement PayPal.** Ils ont été préparés (nom, prix, description, page de retour) et attendent votre validation dans l'application Claude. Une fois validés, copiez chaque URL `https://www.paypal.com/ncp/payment/...` dans `config.json` → `paymentLinks`, puis redéployez. Tant qu'un lien est vide, le bouton d'achat affiche une liste d'attente : aucun visiteur n'est perdu.
   Pour chaque lien, la page de retour après paiement est `https://kairos-academie.netlify.app/acces/<masterclass>-<jeton>/` (les jetons sont dans la variable Netlify `ACCESS_TOKENS`).
2. **Compléter les mentions légales** dans `config.json` → `legal` : adresse, e-mail, téléphone, SIREN (micro-entreprise à créer gratuitement sur autoentrepreneur.urssaf.fr si ce n'est pas fait), médiateur de la consommation (obligatoire pour vendre à des particuliers ; comptez quelques dizaines d'euros par an, par exemple CM2C, Médicys ou un médiateur de votre fédération). Les champs manquants s'affichent « [À COMPLÉTER] » sur le site.
3. **Lire les points signalés** dans [`docs/POINTS-A-VERIFIER.md`](docs/POINTS-A-VERIFIER.md) (quelques chiffres datés que les rédacteurs n'ont pas pu confirmer sur une source officielle).

## Comment ça marche

| Étape | Ce qui se passe | Où le voir |
| --- | --- | --- |
| Visite | Chaque page vue est comptée (sans cookie, sans adresse IP) avec la source, le pays et l'appareil | `/admin/` |
| Intérêt | Clic sur « Accéder », puis départ vers PayPal après la case de renonciation au droit de rétractation | `/admin/` |
| Achat | PayPal encaisse puis redirige vers la page d'accès secrète de la masterclass ; la première ouverture compte un achat | `/admin/` + l'application PayPal |
| Accès | L'acheteur peut demander à recevoir son lien par e-mail (formulaire « acheteurs ») | Netlify → Forms |
| Certificat | Après 16/20 au quiz, le certificat nominatif est enregistré et vérifiable sur `/certificat/` | `/admin/` |

**Ventes PayPal nominatives dans le tableau de bord (facultatif)** : sur developer.paypal.com → Apps & Credentials → mode Live → créez une application, puis ajoutez dans Netlify (Project configuration → Environment variables, portée « Functions ») `PAYPAL_CLIENT_ID` et `PAYPAL_CLIENT_SECRET`. Le tableau de bord listera alors chaque vente (nom, e-mail, produit, montant, frais).

**Limite connue** : l'accès repose sur une adresse secrète. Un acheteur pourrait la partager. Pour un produit à 25 €, c'est le compromis habituel au lancement ; les CGV interdisent le partage public.

## Plan de lancement sur 30 jours

Objectif réaliste du premier mois : quelques dizaines de ventes. Une page de vente convertit en général entre 1 % et 3 % de visiteurs ciblés : 1 000 € de chiffre d'affaires (40 ventes) demandent environ 1 500 à 4 000 visiteurs qualifiés. Aucun résultat n'est garanti ; la régularité de la diffusion fait la différence.

- **Semaine 1 · votre réseau.** Envoyez le message WhatsApp du kit à 30 contacts choisis (une masterclass adaptée à chacun), publiez le post LinkedIn « IA générative » et le post Facebook « Cybersécurité ». Proposez le Pass intégral en cadeau (fêtes de fin d'année, départ à la retraite).
- **Semaine 2 · groupes et communautés.** Repérez 10 groupes Facebook ou forums (retraités, parents, indépendants, propriétaires) dont le règlement autorise le partage ; publiez un conseil utile tiré du module 1, avec le lien en commentaire si le groupe le demande.
- **Semaine 3 · vidéo courte.** Une vidéo de 30 s par jour (TikTok, Reels, Shorts) : une arnaque décortiquée, un réglage de smartphone, un prompt d'IA. Lien en bio vers l'accueil avec `utm_source`.
- **Semaine 4 · partenaires.** Associations de seniors, clubs, médiathèques, CCAS, espaces France Services, comités d'entreprise : proposez le Pass intégral à tarif groupe (créez un lien PayPal dédié) ou une intervention gratuite qui renvoie vers le site.
- **Chaque lundi** : ouvrez `/admin/`, regardez la colonne « Sources » et doublez la mise sur ce qui amène des acheteurs.

Publications, messages et e-mails prêts à copier, avec des liens suivis : [`marketing/KIT-MARKETING.md`](marketing/KIT-MARKETING.md) (regénéré par `npm run marketing`).

## Technique

```
config.json            prix, liens PayPal, mentions légales, ordre du catalogue
content/<slug>/        course.json (page de vente, quiz, FAQ) + modules/01..08.md + bonus.md
scripts/build.mjs      génère dist/ (accueil, pages de vente, espaces de cours, pages légales, sitemap)
scripts/marketing.mjs  génère marketing/KIT-MARKETING.md
src/                   CSS et JavaScript du site (copiés dans dist/assets/)
netlify/functions/     /api/t (mesure d'audience), /api/cert (certificats), /api/stats (tableau de bord)
```

En local : `npm install`, puis `npm run build` (les jetons viennent de `tokens.json`, non versionné, ou de la variable `ACCESS_TOKENS`). Netlify exécute la même commande à chaque déploiement.

Modifier une masterclass : éditez le fichier Markdown du module ou `course.json`, puis redéployez. Le site affiche « Contenu à jour (octobre 2026) » : pensez à le relire tous les six mois (taux des livrets, aides à la rénovation, règles de retraite…).
