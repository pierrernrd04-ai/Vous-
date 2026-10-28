# Boîte à outils — L'IA générative au quotidien

Cette boîte à outils rassemble les modèles, check-lists et repères de la masterclass. Copiez les prompts dans votre bibliothèque personnelle et remplacez les éléments entre [crochets].

## Check-list avant chaque usage

- [ ] J'ai situé ma tâche dans la bonne zone : verte, orange ou rouge (module 1).
- [ ] Les données que je vais coller sont en vert, ou anonymisées dans un outil validé (module 7).
- [ ] Mon prompt contient au minimum un rôle, un contexte, une tâche et un format (méthode PRÉCISE).
- [ ] J'ai autorisé l'outil à dire « je ne sais pas » et interdit d'inventer des chiffres.
- [ ] Pour une information datée, j'ai exigé des sources avec lien et date.
- [ ] J'ai relu, vérifié les faits clés et personnalisé avant d'envoyer ou de publier.

## Check-list de configuration (une fois par trimestre)

- [ ] Réglage « utilisation des conversations pour l'entraînement » vérifié.
- [ ] Mémoire consultée et nettoyée.
- [ ] Mode temporaire repéré.
- [ ] Applications connectées passées en revue, accès inutiles retirés.
- [ ] Instructions personnalisées relues et mises à jour.
- [ ] Bibliothèque de prompts mise à jour.
- [ ] Tarif de l'abonnement comparé au gain net mesuré.

## Les méthodes de la masterclass

| Méthode | Module | Usage | Composantes |
|---|---|---|---|
| Trois zones | 1 | Niveau de confiance | Verte, orange, rouge |
| PICS | 2 | Choisir un outil | Prix, Intégration, Confidentialité, Spécialité |
| PRÉCISE | 3 | Écrire un prompt | Personnage, Renseignements, Énoncé, Cadre, Interdits, Spécimens, Essais |
| CEV | 4 | Résumer un document à enjeu | Cartographier, Extraire, Vérifier |
| 3 R | 5 | Repérer les tâches à déléguer | Répétitif, Rédactionnel, Recherche |
| Double canal | 6 | Démarches | L'IA prépare, le site officiel fait foi |
| SCÈNE | 6 | Décrire une image | Sujet, Cadrage, Éclairage, Nature du style, Exclusions |
| Feu tricolore | 7 | Protéger les données | Vert, orange, rouge |
| Système 3A | 8 | S'organiser | Assistants, Automatismes, Audit |
| MISSION | 8 | Créer un assistant | Mission, Interlocuteur, Sources, Style, Interdits, Organisation, Noter |

## 30 prompts professionnels prêts à copier

### Fondamentaux

**1. Le modèle universel PRÉCISE**

```
Tu es [rôle]. Contexte : [situation, objectif réel, destinataire].
Tâche : [verbe d'action + livrable].
Format : [longueur, structure, ton].
Contraintes : n'invente aucun chiffre ; si une information manque, écris [À COMPLÉTER].
Exemple de style à imiter : [coller un exemple].
Avant de commencer, pose-moi les questions nécessaires, une à la fois.
```

**2. La réponse sourcée**

```
Réponds à la question suivante : [question].
Appuie-toi en priorité sur des sources officielles françaises ou européennes.
Pour chaque affirmation importante, donne le lien et la date de la source.
Si les sources se contredisent ou si tu n'es pas sûr, dis-le explicitement.
```

**3. L'auto-critique**

```
Relis ta réponse précédente. Liste les affirmations dont tu es le moins sûr,
celles qu'il faut vérifier auprès d'une source officielle, et les éventuelles
contradictions. Puis propose une version corrigée.
```

**4. L'avocat du diable**

```
Joue le rôle d'un critique exigeant et sans complaisance.
Voici ma proposition : [texte].
Liste les 5 faiblesses principales, les objections qu'un opposant formulerait,
et ce qu'il faudrait ajouter pour la rendre solide.
```

### Rédaction

**5. Le brouillon à partir de notes**

```
Transforme ces notes en [type de document] clair et structuré pour [destinataire].
Garde toutes les informations, n'en ajoute aucune.
Ton [ton]. Longueur : [longueur].
Notes : """[notes]"""
```

**6. L'analyse de mon style**

```
Voici trois textes que j'ai écrits. Décris mon style en 6 points
(longueur des phrases, ton, vocabulaire, structure, ouvertures, formules
récurrentes), afin que tu puisses écrire comme moi.
Textes : """[textes]"""
```

**7. La réécriture sans style IA**

```
Réécris ce texte pour le rendre plus clair et plus direct.
Commence par l'information principale. Varie la longueur des phrases.
Pas d'introduction générale ni de conclusion récapitulative.
Évite : crucial, essentiel, incontournable, véritable, en constante évolution.
Texte : """[texte]"""
```

**8. La correction seule**

```
Corrige uniquement l'orthographe, la grammaire et la ponctuation de ce texte,
sans reformuler ni changer le style. Liste ensuite chaque correction effectuée.
Texte : """[texte]"""
```

### Documents

**9. La cartographie (CEV, étape 1)**

```
Avant tout résumé, donne-moi pour ce document : sa nature, son auteur et sa date
si elles figurent, son plan en titres principaux, et l'objet de chaque partie
en une phrase.
```

**10. L'extraction avec citations (CEV, étape 2)**

```
Je dois [décision ou objectif]. Extrais de ce document : [liste des éléments].
Pour chaque point, cite la phrase exacte entre guillemets et indique la section
ou la page. Si un élément n'apparaît pas, écris "Non mentionné".
```

**11. La question de contrôle (CEV, étape 3)**

```
Y a-t-il dans ce document des éléments importants pour [objectif] que tu n'as pas
mentionnés, notamment des conditions, exceptions, délais ou pénalités ?
```

**12. La comparaison de versions**

```
Compare ces deux versions de [document]. Présente dans un tableau : l'article ou
la section, la version A, la version B, la nature du changement, et son impact
probable pour [qui].
```

**13. La traduction en contexte**

```
Traduis ce texte en [langue] pour [destinataire et relation].
Registre : [formel / cordial]. Conserve exactement montants, dates et noms propres.
Signale les expressions qui n'ont pas d'équivalent direct.
Texte : """[texte]"""
```

**14. L'analyse de tableur**

```
Voici un fichier de [nature des données], [nombre] lignes.
Colonnes : [description de chaque colonne].
Calcule [indicateurs], présente un tableau récapitulatif, puis explique ta méthode
et le nombre de lignes prises en compte. Signale toute ligne anormale.
```

### Travail

**15. La réponse à un e-mail**

```
Réponds à cet e-mail : """[e-mail]"""
Points à faire passer : 1) [point] 2) [point] 3) [point].
Ton [ton], [nombre] mots maximum, objet compris si nécessaire.
```

**16. Le désamorçage**

```
Voici un e-mail reçu et mon projet de réponse. Mon projet est-il trop défensif
ou trop sec ? Propose une version qui reconnaît le problème, explique sans se
justifier à l'excès et propose une solution concrète.
E-mail reçu : """[...]""" Mon projet : """[...]"""
```

**17. Le résumé de fil de discussion**

```
Résume ce fil d'e-mails en 5 lignes : qui demande quoi, ce qui est décidé,
ce qui reste en suspens, et ce que l'on attend de moi, avec les échéances.
Fil : """[...]"""
```

**18. L'ordre du jour**

```
Je prépare une réunion de [durée] avec [participants] pour [objectif].
Propose un ordre du jour minuté, les décisions à prendre, et les objections
probables de chaque participant.
```

**19. Le compte rendu en trois blocs**

```
À partir de ces notes, rédige un compte rendu en trois blocs :
1) décisions prises, 2) actions (qui, quoi, pour quand), 3) points en suspens.
Une page maximum. Si un responsable ou une échéance manque, écris [À PRÉCISER].
Notes : """[...]"""
```

**20. La formule de tableur**

```
Dans [Excel / Google Sheets / LibreOffice], interface en [français / anglais],
j'ai [description des colonnes]. Je veux [résultat attendu].
Donne la formule, explique chaque partie et indique comment la tester.
```

**21. La présentation**

```
Je présente [sujet] à [public] pendant [durée].
1) Formule le message principal en une phrase.
2) Propose un plan de [nombre] diapositives avec un titre affirmatif chacune.
3) Pour chaque diapositive : 3 puces de 10 mots maximum et une idée de visuel.
4) Liste les 5 questions difficiles du public et des réponses possibles.
```

**22. La veille hebdomadaire**

```
Quelles sont les nouveautés des 7 derniers jours sur [sujet] ?
Sources : presse spécialisée et sites officiels uniquement.
Pour chaque nouveauté : date, lien, résumé en 2 lignes, impact possible pour
[type d'organisation]. Ignore les sources de plus de 6 mois.
```

**23. La simulation d'entretien**

```
Simule un entretien. Tu es [rôle de l'interlocuteur], je suis [mon rôle].
Contexte : [contexte]. Pose-moi une question à la fois et attends ma réponse.
À la fin, évalue mes réponses sur la clarté, la pertinence et la conviction,
avec trois conseils d'amélioration.
```

**24. La procédure interne**

```
Transforme cette explication orale en procédure numérotée. Pour chaque étape :
l'action, l'outil utilisé, le responsable, les points de vigilance.
Puis relis-la comme un nouvel arrivant et liste ce qui est flou ou manquant.
Explication : """[...]"""
```

### Quotidien

**25. Le courrier expliqué**

```
Explique ce courrier en langage simple : qui m'écrit, pourquoi, ce que je dois
faire et avant quelle date. Indique le site officiel où vérifier l'information.
Je ne veux pas de conseil juridique, seulement une explication.
```

**26. La réclamation**

```
Rédige une lettre de réclamation polie et ferme adressée à [organisme] au sujet
de [problème], survenu le [date]. Demande : [solution attendue].
Laisse entre crochets les références à compléter. Une page maximum.
```

**27. L'itinéraire de voyage**

```
Nous sommes [profil, âge, rythme de marche]. Nous partons [durée] à [destination]
en [mois], sans voiture. Propose un itinéraire jour par jour, avec temps de trajet
approximatifs et pauses. Liste ce que je dois vérifier et réserver moi-même.
```

**28. Le tuteur socratique**

```
Je veux apprendre [sujet]. Mon niveau : [niveau]. Sois mon tuteur.
Explique un concept à la fois en 10 lignes maximum, avec un exemple concret.
Puis pose-moi une question. Ne donne pas la réponse : aide-moi par des indices.
```

**29. L'image avec SCÈNE**

```
Crée une image. Sujet : [sujet]. Cadrage : [plan, format].
Éclairage : [lumière]. Style : [aquarelle, photo réaliste, illustration...].
Exclusions : sans texte, sans logo, sans personne réelle identifiable.
```

**30. Le discours d'occasion**

```
Je dois prononcer un discours de [durée] pour [occasion].
Souvenirs et éléments personnels : [liste].
Ton [ton], phrases courtes faciles à dire, pauses indiquées entre crochets,
pas de formules toutes faites. Termine par [toast, remerciement...].
```

## Modèle d'instructions personnalisées

```
Qui je suis : [métier ou situation, secteur, région].
Pour qui j'écris souvent : [clients, collègues, proches].
Comment me répondre : en français, [vouvoiement / tutoiement], va à l'essentiel,
titres courts, listes quand c'est utile.
Toujours : signaler les informations incertaines et indiquer la source officielle
à vérifier pour toute information juridique, fiscale, médicale ou chiffrée.
Jamais : inventer de chiffres, de références ou de citations.
```

## Glossaire

- **Agent** : mode dans lequel l'IA enchaîne elle-même plusieurs actions (naviguer, remplir, envoyer) pour atteindre un objectif.
- **AI Act** : règlement européen (UE) 2024/1689 qui encadre l'IA selon son niveau de risque.
- **Assistant personnalisé** : assistant configuré avec une mission et des instructions propres (GPTs, Gems, agents).
- **Date de coupure** : date à laquelle s'arrêtent les données d'entraînement d'un modèle.
- **Données personnelles** : toute information permettant d'identifier une personne, directement ou indirectement.
- **Entraînement** : phase pendant laquelle le modèle apprend à partir de très grandes quantités de textes.
- **Fenêtre de contexte** : quantité de texte que le modèle peut prendre en compte en même temps.
- **Few-shot** : technique consistant à donner quelques exemples du résultat attendu dans le prompt.
- **Hallucination** : réponse fausse présentée avec assurance.
- **Hypertrucage (deepfake)** : image, vidéo ou voix générée ou modifiée pour faire croire à un fait inexistant.
- **IA fantôme (shadow AI)** : usage d'outils d'IA non autorisés par l'organisation.
- **IA générative** : IA qui produit du contenu nouveau (texte, image, son, vidéo, code).
- **Injection de prompt** : instruction cachée dans un contenu, destinée à détourner le comportement d'une IA.
- **Itération** : amélioration d'un résultat par corrections successives.
- **LLM (grand modèle de langage)** : programme entraîné à prédire la suite d'un texte, moteur des assistants.
- **Mémoire** : fonction qui conserve certaines informations sur vous d'une conversation à l'autre.
- **Mode temporaire** : conversation non conservée dans l'historique et non utilisée pour l'entraînement.
- **Modèle de raisonnement** : modèle qui décompose le problème en étapes avant de répondre.
- **OCR** : reconnaissance optique de caractères, qui transforme une image de texte en texte.
- **Projet** : espace regroupant conversations, documents et consignes autour d'un sujet.
- **Prompt** : instruction ou demande adressée à l'IA.
- **Recherche approfondie** : enquête automatisée de plusieurs minutes sur de nombreuses sources, rendue sous forme de rapport.
- **RGPD** : règlement européen sur la protection des données personnelles, applicable depuis 2018.
- **Token** : unité de texte (morceau de mot) traitée par le modèle.

## Plan d'action sur 30 jours

### Semaine 1 : les bases

- [ ] Choisir un outil principal avec la méthode PICS et créer un compte.
- [ ] Vérifier les réglages de confidentialité et de mémoire.
- [ ] Faire l'exercice des trois zones avec trois questions.
- [ ] Copier les prompts 1, 2 et 3 dans votre bibliothèque.

### Semaine 2 : la méthode

- [ ] Rédiger cinq prompts avec la méthode PRÉCISE sur des tâches réelles.
- [ ] Tester un même prompt sur deux outils et comparer.
- [ ] Appliquer la méthode CEV à un document de plus de 10 pages.
- [ ] Rédiger vos instructions personnalisées.

### Semaine 3 : l'intégration

- [ ] Repérer vos trois tâches prioritaires avec la méthode des 3 R.
- [ ] Installer trois routines dans votre agenda.
- [ ] Créer un projet ou un assistant personnalisé avec la fiche MISSION.
- [ ] Démarrer votre journal de bord de gain de temps.

### Semaine 4 : la consolidation

- [ ] Poursuivre le journal de bord et calculer votre gain net hebdomadaire.
- [ ] Supprimer ou améliorer les prompts qui déçoivent.
- [ ] Décider : rester en gratuit ou s'abonner, chiffres à l'appui.
- [ ] Fixer votre premier rendez-vous trimestriel et parler du mot de code familial à vos proches.
