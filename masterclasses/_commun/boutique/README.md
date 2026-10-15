# Boutique des masterclasses

**Lien à envoyer :** https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA
(Partage-le en public depuis le menu « Partager » de la page, sinon seuls toi et les personnes invitées peuvent l'ouvrir.)

## Comment ça marche

1. Le client choisit une masterclass, coche la case de renonciation au droit de rétractation et clique sur « Payer 49 € par carte » (Stripe) ou « Payer avec PayPal ».
2. Après le paiement, Stripe ou PayPal le renvoie vers le **lien d'accès** de sa masterclass (tableau ci-dessous).
3. La boutique déchiffre le cours avec le code contenu dans ce lien. Le code reste mémorisé sur son appareil, et il peut aussi le saisir dans « Tu as déjà acheté ? ».

Sans le code, le cours est illisible, même en lisant le code source de la page (chiffrement AES-256-GCM).

## Brancher le paiement (une fois par masterclass)

**Stripe :** tableau de bord → Liens de paiement → Créer → produit « Masterclass … » à 49 € → onglet « Après le paiement » → « Ne pas afficher la page de confirmation » → rediriger vers le lien d'accès ci-dessous.
Ou en une commande, pour les 20 : `STRIPE_SECRET_KEY=sk_live_... BOUTIQUE_URL=https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA node scripts/stripe-masterclasses.mjs`

**PayPal :** paypal.com → Liens de paiement et boutons → Créer un lien de paiement → 49 EUR → URL de retour = le lien d'accès ci-dessous.

Puis colle chaque URL de paiement dans `masterclasses/_commun/liens-paiement.json` (ou envoie-les à Claude), et republie :

```sh
python3 masterclasses/_commun/boutique/build_boutique.py boutique.html
```

Les boutons « Paiement bientôt disponible » deviennent alors « Payer 49 € par carte » / « Payer avec PayPal ».

## Liens d'accès (URL de redirection après paiement)

Ces liens donnent accès au cours : ne les publie pas. Si l'un fuit, change son code dans `codes-acces.json`, reconstruis, republie et mets à jour la redirection Stripe/PayPal.

| # | Masterclass | Lien d'accès |
|---|---|---|
| 01 | Courir 10 km sans t'arrêter en 10 semaines | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#01-VRfn8k4zEYNAUUkPeS` |
| 02 | Ton premier semi-marathon, étape par étape | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#02-hl22wJo1qMBBOgL0Q0` |
| 03 | Ta première course HYROX : la méthode en 12 semaines | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#03-efSdoNjz10uqt1HHUJ` |
| 04 | Du bitume aux sentiers : ton premier trail | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#04-IgLQuN5VGn89Gjr23K` |
| 05 | Claude pour indépendants : délègue ton admin à l'IA | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#05-l62Fx67SHSmryTdneP` |
| 06 | Crée et vends ton premier produit numérique avec l'IA | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#06-4Drf7pRDVc12biUZmM` |
| 07 | La méthode de prompt pro : des réponses IA utilisables du premier coup | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#07-wHrtk7heHJ4TiRIymg` |
| 08 | Crée ton site ou ton outil sans coder, avec l'IA | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#08-N7Fh7VGKq5dVRm1Ryk` |
| 09 | L'IA pour préparer tes cours en deux fois moins de temps | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#09-DkQM1BpswRKsL9snqx` |
| 10 | L'IA pour agents immobiliers : annonces, relances, comptes rendus | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#10-2MnSLVtphGe7CscCqa` |
| 11 | L'IA pour artisans : devis, relances et avis clients | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#11-JgZr1xelesgm9t9Ng8` |
| 12 | CV, lettre et entretien : ta recherche d'emploi avec l'IA | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#12-sYx2OmP9vzlYu2VL0R` |
| 13 | Lance et anime ton run club de quartier | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#13-9MObXAJka5cCRy90hV` |
| 14 | Padel : les bases pour progresser dès tes premiers matchs | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#14-tM85QEa59lYmTZdZuX` |
| 15 | Deviens créateur UGC : ton portfolio et tes premières marques | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#15-m0UWBO9TSNhRsnlTyd` |
| 16 | Automatise ta petite entreprise avec des agents IA | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#16-EwTGXh6bZXzkK9Xmnr` |
| 17 | Cultive tes pleurotes à la maison | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#17-ZtG9NGVkrTWhSyKQwI` |
| 18 | Ton pain au levain maison, de A à Z | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#18-1TtWrvR06hJsdFUp62` |
| 19 | Entretiens et dépanne toi-même ton vélo électrique | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#19-v8JE8Sq53f2zVproWm` |
| 20 | Deviens ghostwriter LinkedIn : vends l'écriture de posts | `https://claude.ai/artifact/FxstdiBRKYcney7HcPsadA#20-Tvtwk1ASaf8kSbgRnS` |
