# Brief commun — catalogue de masterclasses à 49 €

Source de vérité pour toutes les masterclasses de ce dossier. Toute la copie est en **français**, tutoiement.

## Offre

- **Prix** : 49 € TTC, paiement unique, « TVA non applicable, art. 293 B du CGI ». Jamais de prix barré, jamais de « -X % », jamais de faux compte à rebours.
- **Vendeur** : Pierre Renard, entrepreneur individuel (identité complète dans `src/legal.ts`).
- **Plateforme** : TinyPages (page de vente + accès au contenu), paiement Stripe (Payment Link) ou checkout TinyPages.
- **Format** : masterclass écrite, 5 à 7 modules, accès immédiat et à vie, exercices, modèles à copier, checklist finale. Lisible en 2 à 4 h, appliquée en 7 à 30 jours.
- **Rétractation** : contenu numérique fourni immédiatement à la demande expresse de l'acheteur, qui renonce à son droit de rétractation (art. L221-28 13° C. conso). Case à cocher obligatoire au paiement.
- **Garantie commerciale** : aucune par défaut. Ne jamais écrire « satisfait ou remboursé » (décision du vendeur, à activer dans `_commun/sav.md` s'il le souhaite).

## Règles de qualité (non négociables)

1. **Contenu réel et actionnable.** Chaque leçon apprend quelque chose de précis : méthode, étapes numérotées, exemples concrets chiffrés, modèle à copier, erreurs fréquentes. Pas de remplissage, pas de généralités du type « soyez constant ».
2. **Aucune fausse preuve.** Pas de témoignages inventés, pas de chiffres de ventes ou d'élèves, pas de « +10 000 personnes formées », pas de captures fictives. Si une preuve est utile, laisser un emplacement `[TÉMOIGNAGE À AJOUTER après les premiers élèves]`.
3. **Aucune promesse de résultat** chiffrée ou garantie (revenus, perte de poids, chrono, abonnés). On promet une méthode et des livrables, pas un résultat.
4. **Domaines réglementés.**
   - Sport : dire « programme » ou « méthode », jamais « coaching » ni « coach » (art. L212-1 Code du sport). Avertissement santé en tête : avis médical avant de commencer, arrêter en cas de douleur.
   - Pas de conseil médical, nutritionnel thérapeutique, juridique personnalisé, fiscal personnalisé ni d'investissement.
   - Chiffres légaux ou fiscaux : seulement s'ils sont sûrs, avec renvoi vers la source officielle (service-public.fr, urssaf.fr) et la mention « vérifie le montant en vigueur ».
5. **Pas de marque d'autrui** dans les titres (pas de « officiel », pas de logo). Citer un outil (Canva, Notion, Claude, Instagram) est permis, sans laisser croire à un partenariat.
6. **Outils IA** : les noms de produits et fonctions évoluent ; décrire des usages durables (prompts, méthode) plutôt que des boutons précis.

## Livrables par masterclass (`masterclasses/NN-slug/`)

| Fichier | Contenu |
|---|---|
| `formation.md` | Le cours complet : intro (pour qui, ce que tu sauras faire, comment suivre), 5 à 7 modules, chacun avec leçons, exemple, exercice, modèle à copier ; checklist finale ; ressources. **5 000 à 8 000 mots.** |
| `page-de-vente.md` | Copie de la page TinyPages, bloc par bloc (voir structure ci-dessous). |
| `emails.md` | Séquence de 5 e-mails de promo (objet, aperçu, corps, CTA), J0 à J+6. |
| `sav.md` | FAQ spécifique (8 à 10 questions) + 3 réponses SAV prêtes à envoyer propres au sujet. |
| `fiche.json` | Métadonnées : `{ "slug", "titre", "sous_titre", "niche", "cible", "prix": 49, "modules": [titres], "mots_cles": [] }` |

### Structure de `page-de-vente.md`

1. **Hero** : titre (bénéfice concret), sous-titre, bouton « Je commence pour 49 € », ligne de réassurance (accès immédiat, à vie, paiement sécurisé).
2. **Le problème** : 3 à 5 situations que la cible reconnaît.
3. **La promesse** : ce que tu sauras faire à la fin (livrables concrets, pas de résultat garanti).
4. **Le programme** : modules avec 1 phrase chacun.
5. **Pour toi si / pas pour toi si** : 4 + 3 puces honnêtes.
6. **Ce que tu reçois** : liste des contenus, modèles, checklists.
7. **Qui suis-je** : emplacement `[PRÉSENTATION DU FORMATEUR À COMPLÉTER]` avec 2 suggestions de phrases.
8. **FAQ** : 5 questions.
9. **CTA final** + mentions : « 49 € TTC · TVA non applicable, art. 293 B du CGI · Accès immédiat : en validant, tu renonces à ton droit de rétractation (art. L221-28 13° C. conso) · CGV · Contact ».

### Structure de `emails.md`

| # | Jour | Angle |
|---|---|---|
| 1 | J0 | Annonce : le problème et la masterclass |
| 2 | J+1 | Valeur gratuite : une astuce réelle tirée du module 1 |
| 3 | J+3 | Objection principale et réponse |
| 4 | J+5 | Coulisses du programme : ce qu'il y a dedans, module par module |
| 5 | J+6 | Rappel simple et dernier appel (sans fausse urgence) |

Chaque e-mail : objet (< 50 caractères), texte d'aperçu, corps de 120 à 250 mots, un seul lien `[LIEN PAGE DE VENTE]`, signature `Pierre`, pied de page `[LIEN DÉSINSCRIPTION]`. Les e-mails ne partent qu'à des personnes inscrites (opt-in).

## Ton

Direct, chaleureux, concret, phrases courtes. Comme quelqu'un qui a fait le chemin et partage sa méthode. Pas de jargon marketing (« game changer », « secret », « hack ultime »), pas d'emojis en excès (0 à 2 par page).
