# Spécification du contenu d'une masterclass — Kairos Académie

Marque : **Kairos Académie** — « Le bon savoir, au bon moment. »
Produit : masterclass écrite (lecture + exercices + quiz), 25 € TTC, accès à vie, 2 h à 3 h de travail,
certificat de réussite délivré par Kairos Académie après le quiz final (score ≥ 80 %).
Public : professionnels, personnes âgées / seniors, et toute personne curieuse des tendances actuelles.
Langue : français impeccable, vouvoiement, ton expert, chaleureux, concret. Zéro remplissage.

## Arborescence à produire (chemins exacts)

```
apps/academie/content/<slug>/
  course.json
  modules/01.md
  modules/02.md
  ...
  modules/08.md
  modules/bonus.md
```

## course.json (JSON strict, UTF-8, pas de commentaires, pas de virgule finale)

```json
{
  "slug": "<slug>",
  "title": "Titre vendeur et précis (≤ 70 caractères)",
  "subtitle": "La promesse en une phrase (≤ 140 caractères)",
  "category": "une de : IA & Tech | Argent & Patrimoine | Carrière & Business | Vie numérique | Maison & Énergie | Bien-être & Efficacité",
  "level": "ex. Débutant à intermédiaire",
  "duration": "ex. 2 h 30",
  "audience": ["Pour qui (3 à 4 profils concrets)"],
  "promise": "Paragraphe d'accroche de 2 à 3 phrases pour le haut de la page de vente.",
  "pain_points": ["4 problèmes/frustrations que vit le lecteur, formulés à la 2e personne"],
  "outcomes": ["6 à 8 compétences concrètes acquises, commençant par un verbe"],
  "modules": [
    {"n": 1, "title": "Titre du module", "duration": "18 min", "summary": "1 à 2 phrases"}
  ],
  "bonuses": [{"title": "Titre", "description": "1 phrase"}],
  "faq": [{"q": "Question", "a": "Réponse"}],
  "quiz": [
    {"q": "Question", "choices": ["A", "B", "C", "D"], "answer": 0, "explanation": "Pourquoi"}
  ],
  "seo": {"title": "≤ 60 caractères", "description": "≤ 155 caractères", "keywords": ["5 à 8 mots-clés"]},
  "disclaimer": "Avertissement si nécessaire (finance, santé, juridique), sinon chaîne vide",
  "sources": [{"label": "Nom de la source officielle", "url": "https://..."}]
}
```

Contraintes : exactement 8 modules (n = 1..8, mêmes titres que les fichiers .md), 3 bonus (le premier
est toujours la « Boîte à outils » = modules/bonus.md), 6 à 8 FAQ (dont : « Le certificat est-il un
diplôme d'État ? » → non, c'est un certificat de réussite délivré par Kairos Académie, non inscrit au
RNCP, non éligible CPF ; et « Combien de temps ai-je accès ? » → à vie), exactement 20 questions de quiz
(4 choix, `answer` = index 0-3, varier la position de la bonne réponse, questions qui vérifient la
compréhension réelle, pas la mémoire mot à mot), 4 à 10 sources officielles ou de référence.

## modules/NN.md (Markdown)

- Ligne 1 : `# Module N — Titre` (même titre que dans course.json).
- Ligne 3 : `> **Objectif :** ...` (une phrase).
- Corps : **2 000 à 2 600 mots** par module. Sections `##` et `###`, paragraphes courts, listes,
  au moins un tableau Markdown quand c'est pertinent, exemples chiffrés réalistes, un cas pratique
  (« ### Cas pratique : ... ») avec un personnage fictif clairement fictif.
- Encadrés : blockquotes commençant par `> **À retenir :**`, `> **Attention :**`, `> **Astuce :**`
  ou `> **Exemple :**`.
- Fin de module obligatoire :
  - `## Exercice pratique` : un exercice réalisable en 10 à 15 minutes, étapes numérotées.
  - `## L'essentiel en 5 points` : 5 puces.
- Pas de HTML brut, pas d'images, pas d'emoji. Liens Markdown autorisés vers des sources officielles.

## modules/bonus.md

`# Boîte à outils — <titre court>` puis checklists (`- [ ]`), modèles prêts à copier (blocs de code
``` ``` ``` pour les modèles de texte/prompts), tableaux récapitulatifs, glossaire de 15 à 25 termes,
et « Plan d'action sur 30 jours » semaine par semaine. 1 500 à 2 500 mots.

## Exigences de qualité et d'honnêteté (non négociables)

1. **Exactitude datée** : nous sommes fin octobre 2026. Tout chiffre, plafond, taux, seuil, aide, loi,
   nom d'outil ou de version doit être vérifié avec WebSearch/WebFetch sur des sources officielles
   (service-public.fr, impots.gouv.fr, economie.gouv.fr, AMF, Banque de France, CNIL, ANSSI,
   cybermalveillance.gouv.fr, france-renov.gouv.fr, info-retraite.fr, l-assurance-retraite.fr,
   urssaf.fr, legifrance…). Si une valeur n'est pas vérifiable, ne l'invente pas : formule-la sans
   chiffre ou écris « au moment de la rédaction (octobre 2026) » et renvoie vers la source officielle.
2. **Aucun faux** : pas de faux témoignages, pas de fausses statistiques, pas de citation inventée,
   pas de promesse de gain garanti. Les personnages de cas pratiques sont présentés comme fictifs.
3. **Domaines réglementés** : finance → information générale, pas de conseil personnalisé, risque de
   perte en capital rappelé ; santé/bien-être → ne remplace pas un avis médical ; juridique/fiscal →
   renvoyer vers un professionnel pour les cas particuliers.
4. **Niveau professionnel** : méthodes, cadres, check-lists et exemples qu'on ne trouve pas dans un
   article de blog générique. Chaque module doit apporter au moins une méthode actionnable nommée.
5. **Accessibilité seniors** : expliquer chaque terme technique à sa première apparition.
