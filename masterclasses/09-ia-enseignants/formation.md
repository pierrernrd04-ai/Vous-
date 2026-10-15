# L'IA pour préparer tes cours en deux fois moins de temps

*Séquences, différenciation, évaluations, corrigés : une méthode pour faire de l'IA un assistant de préparation fiable, sans exposer tes élèves.*

> **À lire avant de commencer.** Le titre est un objectif de travail, pas une garantie : le temps gagné dépend de ta discipline, de ton niveau, de tes habitudes et de l'outil que tu utilises. L'IA se trompe, parfois avec aplomb. Tout ce qu'elle produit doit être relu et vérifié par toi avant d'arriver devant tes élèves. Et une règle ne souffre aucune exception dans ce cours : **aucune donnée personnelle d'élève dans un outil d'IA** (nom, prénom, note nominative, situation familiale, santé, handicap, comportement). Respecte aussi les consignes de ton employeur et de ton établissement sur les outils autorisés.

---

## Introduction

### Pour qui

Cette masterclass est pour toi si tu enseignes (collège, lycée, primaire, voie professionnelle, enseignement supérieur, formation pour adultes, cours particuliers) et que la préparation te mange tes soirées et tes week-ends. Tu as peut-être déjà essayé un assistant IA : tu as obtenu un cours générique, trop long, pas adapté à ta classe, et tu as conclu que ça ne valait pas le coup. Ou tu ne t'y es jamais mis, parce que tu ne sais pas ce qui est autorisé.

Elle n'est pas faite pour remplacer ton expertise. L'IA ne connaît pas tes élèves, ne connaît pas ta progression, ne sait pas que la classe de 4e B décroche le vendredi après-midi. C'est toi qui sais. L'IA rédige, reformule, décline, propose des variantes. Toi, tu décides et tu valides.

### Ce que tu sauras faire à la fin

- Écrire un **brief pédagogique** en 6 blocs qui donne des réponses utilisables du premier coup, au lieu de cours génériques.
- Produire le **squelette d'une séquence** complète (objectifs, séances, activités, évaluation) puis le détail d'une séance minutée.
- Décliner un même support en **trois niveaux de difficulté** et en version adaptée (lisibilité, consignes fractionnées) sans jamais décrire un élève réel.
- Générer des **évaluations** (QCM, questions ouvertes, exercices), une **grille critériée** et un **corrigé détaillé**, puis les contrôler avec une méthode de vérification en 5 points.
- Appliquer des règles claires sur les **données élèves et le RGPD**.
- Repenser tes devoirs face à la **triche par IA** et construire une **charte d'usage** pour tes élèves.
- Monter ta **bibliothèque de prompts** et une routine de préparation hebdomadaire.

### Comment suivre

Le cours se lit en 2 à 3 heures. Il s'applique ensuite sur deux à quatre semaines, au rythme de ta préparation réelle. Le meilleur moyen : choisis **une seule séquence** que tu dois préparer prochainement et fais tous les exercices dessus. À la fin, tu auras une séquence complète prête à l'emploi, et une méthode réutilisable.

Les prompts sont dans des blocs à copier. Les passages entre crochets `[comme ceci]` sont à remplacer par tes informations. Ils fonctionnent avec la plupart des assistants conversationnels (Claude, ChatGPT, Le Chat, Gemini, ou l'outil fourni par ton institution) : les noms et les boutons changent, la méthode reste.

---

## Module 1 — Le brief pédagogique : arrêter les réponses génériques

### Leçon 1.1 — Ce que l'IA fait bien, ce qu'elle fait mal

Avant de gagner du temps, il faut savoir où l'IA en fait perdre.

**Ce qu'elle fait bien :**
- Produire un premier jet structuré en quelques secondes (plan de séquence, déroulé de séance, consignes).
- Décliner : même exercice, autres nombres ; même texte, trois niveaux de lecture ; même notion, cinq contextes différents.
- Reformuler : simplifier une consigne, transformer un paragraphe en tableau, un cours en fiche de révision.
- Générer des listes : distracteurs de QCM, exemples, idées d'accroches, questions de compréhension.
- Critiquer un document que tu lui fournis : « qu'est-ce qui peut bloquer un élève dans cette consigne ? ».

**Ce qu'elle fait mal :**
- **Les faits précis** : dates, citations, références bibliographiques, chiffres. Elle peut inventer une citation de Victor Hugo ou un article de loi qui n'existe pas.
- **Les programmes officiels** : elle les connaît approximativement, parfois dans une version ancienne. Ne lui fais jamais confiance sur « ce que dit le programme » : colle-lui l'extrait toi-même.
- **Le calcul et la logique en plusieurs étapes** : un corrigé de maths ou de physique peut contenir une erreur au milieu, avec un résultat final juste ou faux.
- **Les documents patrimoniaux** : elle peut « citer » un poème en en modifiant des vers. Prends toujours le texte depuis une source fiable.
- **La connaissance de ta classe** : elle ne sait que ce que tu lui dis.

Retiens la règle : **l'IA est forte pour la forme, toi tu restes garant du fond.**

### Leçon 1.2 — Le brief en 6 blocs

La plupart des réponses décevantes viennent d'une demande d'une ligne : « Fais-moi un cours sur la Révolution française. » L'IA comble les vides avec des moyennes. Un bon brief remplit les vides à sa place.

Les 6 blocs :

1. **Rôle et public** : qui tu es, qui sont les élèves (niveau, âge, filière, effectif, profil de classe décrit globalement).
2. **Objectif** : ce que les élèves doivent savoir ou savoir-faire à la fin, formulé avec un verbe observable (identifier, calculer, rédiger, justifier).
3. **Cadre officiel** : l'extrait du programme ou du référentiel, **collé par toi**.
4. **Contraintes** : durée, matériel disponible, prérequis, ce qui a déjà été vu, ce que tu ne veux pas.
5. **Format de sortie** : tableau, liste numérotée, longueur maximale, niveau de langue.
6. **Mode de travail** : « pose-moi des questions avant de commencer », ou « propose 3 options avant de détailler ».

Modèle à copier :

```
Tu es mon assistant de préparation de cours. Je suis professeur(e) de [discipline] en [niveau/classe].

PUBLIC : [nombre] élèves de [âge] ans. Profil général de la classe : [ex. hétérogène, plutôt à l'aise à l'oral, difficultés en rédaction]. Aucune information individuelle sur les élèves ne te sera donnée.

OBJECTIF : à la fin, les élèves doivent être capables de [verbe observable + contenu].

CADRE OFFICIEL (extrait que je te fournis, à respecter, n'invente rien au-delà) :
"""
[colle ici l'extrait du programme ou du référentiel]
"""

CONTRAINTES :
- Durée : [x séances de y minutes]
- Matériel : [vidéoprojecteur, pas de salle info, manuels X…]
- Prérequis déjà vus : [liste]
- À éviter : [ex. activités trop longues à mettre en place, travail de groupe à plus de 4]

FORMAT DE SORTIE : [ex. tableau avec colonnes Séance / Objectif / Activités / Durée / Trace écrite], 400 mots maximum.

MODE : avant de produire quoi que ce soit, pose-moi jusqu'à 5 questions si une information te manque. Si un point du programme te semble ambigu, signale-le au lieu de l'inventer.
```

Le dernier bloc change tout : en demandant des questions, tu évites qu'elle remplisse les trous à l'aveugle.

### Leçon 1.3 — Itérer au lieu de recommencer

La première réponse est un brouillon. Trois relances couvrent 90 % des besoins :

- **Resserrer** : « Garde la structure, mais réduis chaque activité à 3 lignes maximum et supprime tout ce qui demande plus de 10 minutes de mise en place. »
- **Critiquer** : « Relis ta proposition comme un inspecteur exigeant. Liste les 5 faiblesses principales (cohérence avec l'objectif, charge cognitive, temps, différenciation), puis propose une version corrigée. »
- **Varier** : « Propose deux autres accroches pour la séance 1 : une à partir d'un objet du quotidien, une à partir d'une question-énigme. »

Astuce : garde la même conversation pour une même séquence. L'IA garde alors le contexte (niveau, objectifs, contraintes) et tu n'as pas à tout répéter. Ouvre une nouvelle conversation pour une nouvelle séquence, pour éviter que les consignes se mélangent.

### Exemple

Une professeure de SVT de 5e demande d'abord : « Fais-moi un cours sur la respiration. » Elle obtient deux pages de texte, du vocabulaire de lycée et aucune activité.

Elle reprend avec le brief en 6 blocs : 28 élèves, 3 séances de 55 minutes, pas de matériel d'expérimentation au-delà de l'eau de chaux, l'extrait du programme collé, un tableau en sortie, et la consigne de poser des questions. L'IA lui demande si les élèves ont déjà vu la notion d'organe et si elle souhaite une démarche d'investigation. Après deux échanges, elle a un squelette en trois séances qu'elle ajuste en dix minutes.

### Exercice

Choisis la séquence que tu prépares prochainement. Remplis le brief en 6 blocs (sans lancer l'IA). Note le temps que ça te prend. Puis lance-le, réponds aux questions, et compare avec ce que tu aurais obtenu avec une demande d'une ligne.

---

## Module 2 — Séquences et séances

### Leçon 2.1 — Du squelette au détail, jamais l'inverse

L'erreur classique : demander « une séquence complète avec tous les documents ». Tu obtiens un pavé impossible à relire. Travaille en entonnoir :

1. **Squelette de séquence** (une page) : objectifs, nombre de séances, progression, évaluation finale.
2. **Validation** par toi : tu coupes, déplaces, ajoutes.
3. **Déroulé d'une séance** : phases minutées.
4. **Supports** : consignes, fiche d'activité, trace écrite.
5. **Évaluation** (module 4).

À chaque étape, tu valides avant de passer à la suivante. Si le squelette est faux, tout le reste le sera.

### Leçon 2.2 — Le prompt squelette

```
À partir du brief ci-dessus, propose le squelette d'une séquence de [n] séances.

Pour chaque séance, donne dans un tableau :
- le titre (une question problématisée si possible),
- l'objectif d'apprentissage (verbe observable),
- l'activité principale en une phrase,
- la modalité (individuel, binôme, groupe, collectif),
- la trace écrite attendue en une phrase.

Ajoute ensuite :
- la problématique générale de la séquence,
- l'évaluation finale envisagée et ce qu'elle mesure,
- les 3 difficultés que les élèves rencontrent le plus souvent sur cette notion, et à quelle séance tu les traites.

Ne rédige pas encore les activités en détail.
```

La dernière demande est précieuse : l'IA a lu beaucoup de didactique et liste souvent bien les obstacles classiques (confusions, représentations initiales). Vérifie quand même avec ton expérience.

### Leçon 2.3 — Le prompt séance minutée

```
Détaille maintenant la séance [numéro] : "[titre]". Durée totale : [x] minutes, dont [y] minutes perdues en début de cours (entrée, appel).

Donne un déroulé minuté en phases :
1. Accroche (5 min max)
2. Activité principale (consigne exacte à lire ou projeter, en langage adapté à des élèves de [âge] ans)
3. Mise en commun
4. Trace écrite (rédigée intégralement, 8 lignes maximum)
5. Prolongement ou devoir (facultatif, 10 min de travail maximum à la maison)

Pour chaque phase : durée, ce que fait l'enseignant, ce que font les élèves, matériel.
Ajoute un "plan B" si l'activité principale prend 10 minutes de plus que prévu.
```

Le « plan B » t'évite la séance qui déborde et la trace écrite dictée en courant à la sonnerie.

### Leçon 2.4 — Les supports : consignes et fiches

Une consigne claire fait gagner plus de temps en classe que n'importe quel outil. Fais-la vérifier :

```
Voici la consigne que je compte donner à des élèves de [niveau] :
"""
[ta consigne]
"""
1. Liste ce qui peut être mal compris (mots difficiles, consignes doubles, ambiguïtés).
2. Réécris-la en étapes numérotées, une action par étape, avec un verbe d'action en début de ligne.
3. Indique ce que l'élève doit produire et sous quelle forme (longueur, support).
Ne change pas le niveau d'exigence.
```

Pour une fiche d'activité, précise toujours la mise en page attendue (titres, cadres, espaces de réponse) et demande un format que tu peux coller dans ton traitement de texte : texte simple avec titres, ou tableau.

### Leçon 2.5 — Les documents et les faits : ta zone de vigilance

Pour tout document « source » (texte littéraire, extrait historique, données scientifiques, carte), **ne demande pas à l'IA de le fournir**. Fournis-le-lui. Elle peut en revanche :
- proposer des questions sur un texte que tu colles,
- résumer un document que tu as choisi,
- créer un texte **fictif et annoncé comme tel** (un dialogue, une situation-problème, une lettre imaginaire).

Si tu lui demandes des faits (dates, chiffres, définitions), ajoute :

```
Pour chaque fait, chiffre ou date que tu mentionnes, indique ton niveau de certitude (sûr / à vérifier). N'invente aucune référence, citation ou source. Si tu ne sais pas, écris "à vérifier".
```

Ça ne la rend pas infaillible, mais ça te signale où regarder en priorité.

### Exemple

Un professeur d'histoire-géographie de 3e prépare une séquence sur la Première Guerre mondiale. Il colle l'extrait du programme, demande le squelette en 5 séances, supprime une séance qu'il juge redondante et en fusionne deux. Pour la séance sur la vie des soldats, il fournit lui-même deux extraits de lettres de poilus issus d'un recueil publié, et demande à l'IA trois niveaux de questions sur ces textes. Il ne lui demande jamais de « trouver » des lettres.

### Exercice

Produis le squelette de ta séquence avec le prompt 2.2, puis le déroulé minuté d'une séance avec le prompt 2.3. Repère dans le résultat au moins un fait à vérifier et vérifie-le dans une source fiable (manuel, ressource institutionnelle, ouvrage de référence).

---

## Module 3 — Différencier sans y passer la nuit

### Leçon 3.1 — Trois leviers de différenciation

L'IA est particulièrement utile pour décliner. Trois leviers, à combiner :

1. **Le niveau de difficulté** : même objectif, trois paliers (découverte, standard, approfondissement).
2. **L'étayage** : même exercice, avec plus ou moins d'aide (exemple résolu, coup de pouce, banque de mots, étapes guidées).
3. **L'accessibilité** : même contenu, présenté autrement (phrases courtes, consignes fractionnées, vocabulaire expliqué, mise en page aérée).

Important : on différencie **des tâches**, pas des élèves dans l'outil. Tu ne dis jamais à l'IA « Lucas est dyslexique » ou « Inès a un PAP ». Tu demandes « une version avec des phrases courtes, une consigne par ligne, et des mots-clés en gras ». C'est toi qui sais à qui la donner.

### Leçon 3.2 — Le prompt trois paliers

```
Voici un exercice destiné à des élèves de [niveau], objectif : [objectif].
"""
[colle ton exercice]
"""

Décline-le en trois versions qui visent le MÊME objectif :
- Version A (découverte) : même notion, données plus simples, une étape de raisonnement de moins, un exemple résolu au début.
- Version B (standard) : l'exercice tel quel, consigne clarifiée si besoin.
- Version C (approfondissement) : même notion, une étape de plus ou une justification à rédiger, sans introduire de notion hors programme.

Présente les trois versions l'une après l'autre avec un titre neutre (Parcours 1, 2, 3), sans mention "facile" ou "difficile" visible par les élèves.
Puis donne le corrigé de chaque version.
```

Le titre neutre évite l'étiquette « groupe des faibles » que les élèves repèrent immédiatement.

### Leçon 3.3 — Les coups de pouce gradués

Plutôt que trois fiches, tu peux garder une seule fiche et préparer des cartes d'aide que l'élève demande au besoin :

```
Pour l'exercice suivant, rédige 3 coups de pouce gradués, à imprimer sur des petites cartes :
- Coup de pouce 1 : une question qui relance la réflexion, sans donner de méthode.
- Coup de pouce 2 : un rappel de la méthode ou de la notion utile (3 lignes max).
- Coup de pouce 3 : le début de la résolution, l'élève termine seul.
Chaque coup de pouce tient en 40 mots maximum.
"""
[exercice]
"""
```

### Leçon 3.4 — Rendre un document plus accessible

```
Réécris le texte suivant pour le rendre plus accessible à des élèves en difficulté de lecture, sans changer le contenu scientifique ou historique :
- phrases de 15 mots maximum,
- une idée par phrase,
- vocabulaire courant ; les mots techniques indispensables restent, mais sont expliqués entre parenthèses la première fois,
- paragraphes de 3 phrases maximum avec un intertitre,
- mots-clés en gras.
Liste ensuite les mots techniques conservés, avec une définition d'une ligne, pour un lexique.
"""
[texte]
"""
```

Relis attentivement : la simplification peut introduire des approximations (« le cœur nettoie le sang »). C'est précisément le type d'erreur que tu dois attraper.

Pour les élèves bénéficiant d'aménagements officiels, la mise en forme précise (police, taille, interlignage) relève de leur plan d'accompagnement et des recommandations de l'équipe : l'IA t'aide à produire le texte, pas à décider de l'aménagement.

### Leçon 3.5 — Varier les contextes

Un même exercice de proportionnalité peut parler de recettes, de vitesse, de cartes, de mélanges de peinture. Varier les contextes aide les élèves à transférer.

```
Voici un exercice sur [notion]. Propose 5 variantes avec des contextes différents et proches de la vie d'élèves de [âge] ans (sport, cuisine, jeux, transport, argent de poche…), avec des nombres différents mais la même structure mathématique. Évite les contextes qui supposent un niveau de vie particulier (voyages en avion, résidence secondaire). Donne le résultat de chaque variante.
```

La dernière consigne évite des énoncés qui mettent une partie de la classe mal à l'aise.

### Exemple

Une professeure de français en 6e travaille l'inférence sur une fable. Elle colle le texte (pris dans le manuel), demande trois parcours de questions et des coups de pouce. Elle relit, retire une question du parcours 3 qui portait sur une notion de 4e, corrige une réponse attendue qu'elle juge contestable. Elle imprime les parcours sur trois couleurs de papier différentes sans indication de niveau.

### Exercice

Prends un exercice de ta séquence. Produis les trois parcours et les coups de pouce. Vérifie chaque corrigé à la main. Note les erreurs trouvées : c'est ta mesure personnelle de la fiabilité de l'outil dans ta discipline.

---

## Module 4 — Évaluations, grilles et corrigés

### Leçon 4.1 — Partir de ce que tu veux mesurer

Une évaluation se conçoit à l'envers : d'abord ce que tu veux mesurer, ensuite les questions. Demande d'abord la **table de spécification** :

```
Je prépare une évaluation de [durée] minutes pour des élèves de [niveau] sur la séquence suivante : [résumé ou squelette].

Avant toute question, propose une table de spécification :
- les 4 à 6 compétences ou connaissances à évaluer,
- pour chacune, le type de question adapté (restitution, application, analyse, rédaction),
- la répartition des points sur [total] points,
- le temps estimé par partie.
Je validerai avant que tu rédiges les questions.
```

### Leçon 4.2 — Des QCM qui mesurent vraiment quelque chose

Un mauvais QCM se devine par élimination. La clé : des **distracteurs fondés sur des erreurs réelles**.

```
Rédige [n] questions à choix multiple sur [notion], niveau [classe].
Règles :
- une seule bonne réponse par question, 4 propositions,
- chaque mauvaise réponse correspond à une erreur fréquente d'élève sur cette notion ; indique laquelle entre parenthèses dans le corrigé,
- propositions de longueur similaire,
- pas de "toutes les réponses ci-dessus" ni de double négation,
- varie la position de la bonne réponse.
Donne d'abord les questions (version élève), puis le corrigé avec l'erreur visée par chaque distracteur.
```

Le corrigé commenté te sert aussi après l'évaluation : si 12 élèves ont choisi la même mauvaise réponse, tu sais quelle erreur retravailler.

### Leçon 4.3 — La grille critériée

```
Pour la tâche suivante : "[consigne de la production écrite/orale/projet]", niveau [classe], rédige une grille d'évaluation critériée :
- 4 critères maximum, formulés de façon observable,
- 4 niveaux de maîtrise par critère (insuffisant, fragile, satisfaisant, très bonne maîtrise),
- pour chaque case, un descripteur concret de ce qu'on observe dans la copie (pas "bon travail" mais "les arguments sont illustrés par au moins un exemple précis"),
- une version simplifiée de la grille en langage élève, pour l'autoévaluation.
Format : tableau.
```

Donner la version élève **avant** la tâche est un des usages les plus rentables : les élèves savent ce qui est attendu, et tu corriges plus vite.

### Leçon 4.4 — Les corrigés : la vérification obligatoire

Le corrigé est l'endroit où une erreur de l'IA coûte le plus cher : elle se retrouve dans les copies de toute la classe et dans ta crédibilité. Méthode :

1. **Résous toi-même** les questions de calcul ou de raisonnement avant de regarder le corrigé de l'IA, au moins les plus difficiles.
2. **Demande une vérification séparée**, dans une nouvelle conversation :

```
Voici un énoncé et un corrigé proposé. Vérifie le corrigé étape par étape, en refaisant chaque calcul. Signale toute erreur, toute étape manquante et toute ambiguïté de l'énoncé qui permettrait une autre réponse valable. Ne réécris pas le corrigé si tout est juste.
"""
[énoncé + corrigé]
"""
```

3. **Contrôle les unités, les arrondis et les notations** propres à ton niveau (la notation attendue au collège n'est pas celle du supérieur).
4. **Vérifie le barème** : la somme des points, et la cohérence entre points et difficulté.
5. **Teste l'énoncé** : y a-t-il une autre interprétation possible ? Les élèves la trouveront.

Une seconde passe par l'IA ne remplace pas ta vérification : deux erreurs peuvent se confirmer. Elle sert à attirer ton attention.

### Leçon 4.5 — Commentaires de copies : oui, mais anonymisés

L'IA peut t'aider à formuler des appréciations, à condition de ne rien transmettre d'identifiant. Méthode recommandée : ne colle pas la copie d'un élève. Colle **tes propres observations**, anonymes :

```
Je corrige des rédactions de [niveau]. Voici mes observations sur une copie (aucune information sur l'élève) :
- points forts : [ex. plan clair, bonne introduction]
- points faibles : [ex. exemples absents, nombreuses fautes d'accord sujet-verbe]
Rédige une appréciation de 3 phrases, bienveillante et précise, qui commence par un point fort, nomme une priorité de travail et propose une action concrète. Tutoiement, langage accessible à un élève de [âge] ans.
```

Mieux encore : construis avec l'IA une **banque de 20 à 30 commentaires types** par critère, une fois pour toutes, et pioche dedans. Aucune donnée ne circule, et tes appréciations restent cohérentes.

Les notes et appréciations officielles restent sous ta responsabilité : relis chaque phrase avant de la reporter.

### Exemple

Un professeur de physique-chimie de 2nde fait générer 10 QCM sur la quantité de matière avec les distracteurs « erreurs fréquentes ». À la vérification, il trouve une question où deux réponses peuvent être jugées correctes selon l'arrondi. Il la corrige. Après l'évaluation, le corrigé commenté lui montre qu'un tiers de la classe a confondu masse et masse molaire : il prévoit une séance de remédiation ciblée.

### Exercice

Produis la table de spécification, puis l'évaluation, la grille et le corrigé de ta séquence. Applique les 5 points de vérification et note combien d'erreurs ou d'ambiguïtés tu as corrigées.

---

## Module 5 — Données élèves, RGPD et déontologie

### Leçon 5.1 — Pourquoi c'est sérieux

Les données des élèves sont des données personnelles, et souvent celles de mineurs. Le règlement général sur la protection des données (RGPD) s'applique. Quand tu colles une information dans un assistant IA grand public, elle est transmise à une entreprise, stockée sur ses serveurs, parfois hors de l'Union européenne, et peut, selon les réglages et les conditions d'utilisation, servir à améliorer ses modèles. Tu ne maîtrises plus ce qu'elle devient.

Ce cours ne donne pas de conseil juridique. Il te donne des règles de prudence simples, et des renvois vers les sources qui font autorité :
- le site de la **CNIL** (cnil.fr), qui publie des ressources sur l'IA et sur les données dans l'éducation ;
- les consignes de ton **employeur** : dans l'enseignement public, ton académie et son **délégué à la protection des données (DPO)** ; dans le privé, ton établissement ;
- les éventuels cadres ou guides d'usage de l'IA publiés par ton ministère de tutelle (vérifie la version en vigueur sur le site officiel).

### Leçon 5.2 — Les règles de base

1. **Zéro donnée identifiante** : pas de nom, prénom, initiales reconnaissables, classe + détail permettant de reconnaître un élève, photo, voix, écriture manuscrite scannée.
2. **Zéro donnée sensible** : santé, handicap, troubles des apprentissages, situation familiale, origine, religion, signalements, sanctions disciplinaires. Même sans nom.
3. **Pas de copies d'élèves brutes** dans un outil non autorisé par ton employeur. Une copie contient souvent un nom, un style reconnaissable, des éléments personnels.
4. **Pas de décision automatisée** : l'IA ne note pas à ta place, ne décide pas d'une orientation, d'un passage, d'une sanction.
5. **Préfère les outils validés** par ton institution quand il en existe. Renseigne-toi auprès de ton établissement ou de ta délégation numérique.
6. **Règle les paramètres** de ton outil : désactive, quand c'est possible, l'utilisation de tes conversations pour l'entraînement des modèles, et supprime les conversations inutiles.
7. **Ne crée pas de compte au nom des élèves** et ne leur impose pas un outil qui demande une inscription : c'est un traitement de données qui relève de l'établissement, pas de toi seul.

### Leçon 5.3 — Anonymiser vraiment

Remplacer « Lucas » par « L. » ne suffit pas si le texte mentionne « le seul élève de la classe qui vient d'arriver du Brésil ». Avant de coller quoi que ce soit, passe ce test : **quelqu'un qui connaît l'établissement pourrait-il reconnaître l'élève ?** Si oui, retire l'information ou ne colle pas.

En pratique, tu as rarement besoin d'un cas individuel. Décris un **profil type fictif** :

```
Profil fictif pour préparer une activité : un élève de 4e qui comprend les consignes à l'oral mais se perd dans les consignes écrites longues, et qui abandonne dès la première difficulté. Propose 3 adaptations de la fiche ci-dessous qui l'aideraient à démarrer seul.
```

Le profil fictif te donne la même aide, sans aucune donnée réelle.

### Leçon 5.4 — Communication avec les familles

L'IA peut t'aider à rédiger un message aux familles (sortie, réunion, organisation). Rédige un modèle **générique**, puis ajoute toi-même les éléments individuels hors de l'outil :

```
Rédige un message aux familles d'élèves de [niveau] pour annoncer [événement : date, lieu, horaires, matériel, coût éventuel, autorisation à rendre avant le…]. Ton cordial et clair, 120 mots maximum, phrases simples, compréhensible par des parents qui maîtrisent peu le français écrit. Laisse les éléments variables entre crochets.
```

Pour un message sur un élève en particulier (comportement, difficultés), écris-le toi-même. Tu peux demander à l'IA une **structure** ou une liste de formulations neutres, sans lui donner la situation réelle.

### Leçon 5.5 — Propriété intellectuelle et sources

- Les manuels, ressources payantes et sujets d'examen non publics sont protégés : n'en colle pas des chapitres entiers dans un outil sans savoir ce que tes licences autorisent.
- Les productions de l'IA peuvent ressembler à des contenus existants. Pour un support que tu diffuses largement (blog, plateforme de partage entre collègues), relis-le et réécris-le avec ta voix.
- Si tu utilises l'IA pour un support, tu peux le mentionner sobrement à tes élèves : c'est aussi une manière de montrer un usage honnête.

### Exemple

Un professeur des écoles veut préparer des exercices différenciés pour un élève suivi pour des troubles de l'attention. Il ne mentionne ni l'élève ni le trouble. Il demande « une version de la fiche avec une seule consigne par encadré, des exercices plus courts et une case à cocher après chaque étape ». Le résultat est le même ; aucune donnée n'est sortie de la classe.

### Exercice

Ouvre les paramètres de ton outil IA. Repère : l'historique des conversations, l'option d'utilisation des données pour l'entraînement, la suppression des conversations. Règle-les au plus protecteur. Puis renseigne-toi sur les outils autorisés ou recommandés dans ton établissement, et note le contact de ton DPO.

---

## Module 6 — Triche et usage de l'IA par les élèves

### Leçon 6.1 — Ce qui ne marche pas

Les **détecteurs d'IA** ne sont pas fiables : ils produisent des faux positifs (un élève qui écrit de façon scolaire et régulière peut être signalé) et des faux négatifs (un texte reformulé passe). Accuser un élève sur la base d'un score de détecteur est injuste et indéfendable. Ne fonde jamais une sanction sur cet outil.

Interdire « l'IA » en général, sans préciser, ne marche pas mieux : les élèves ne savent pas si corriger l'orthographe avec un outil est autorisé, si demander une explication l'est.

### Leçon 6.2 — Repenser les devoirs

Le plus efficace est de concevoir des tâches où l'IA aide peu, ou dont le processus est visible :

1. **Faire en classe ce qui compte** : la rédaction évaluée se fait en temps limité, en classe. À la maison : préparation, lecture, entraînement.
2. **Évaluer le processus** : brouillons datés, plan intermédiaire, journal de bord, versions successives.
3. **Ancrer dans le vécu de la classe** : « à partir de l'expérience que nous avons faite mardi », « en utilisant les deux documents distribués en classe ».
4. **Ajouter un oral court** : 3 minutes pour expliquer son travail. Un élève qui a compris sait expliquer ; l'inverse se voit vite.
5. **Demander une critique** plutôt qu'une production : « voici une réponse produite par une IA, trouve et corrige les 3 erreurs ».

Prompt pour transformer un devoir existant :

```
Voici un devoir à la maison que je donne à des élèves de [niveau] :
"""
[devoir]
"""
Analyse dans quelle mesure un élève peut le faire faire entièrement par une IA. Puis propose 3 façons de le transformer pour que :
- le travail personnel de l'élève soit visible (étapes, brouillons, choix justifiés),
- la tâche s'appuie sur un élément vécu en classe,
- l'objectif d'apprentissage reste le même.
```

### Leçon 6.3 — L'activité « corriger l'IA »

C'est un des meilleurs moyens d'apprendre aux élèves à se méfier des réponses générées. Prépare toi-même une réponse contenant des erreurs volontaires :

```
Rédige une réponse de niveau [classe] à la question "[question]", en 150 mots, qui contient volontairement :
- 2 erreurs factuelles plausibles,
- 1 raisonnement incomplet,
- 1 affirmation vraie mais non justifiée.
Donne ensuite, séparément, la liste des erreurs pour mon corrigé.
```

Vérifie que les erreurs listées sont bien des erreurs, et qu'il n'y en a pas d'autres, involontaires.

### Leçon 6.4 — Une charte d'usage claire

Les élèves ont besoin de savoir ce qui est permis, devoir par devoir. Un système simple en trois niveaux :

- **Niveau 0 — Sans IA** : le travail doit être entièrement personnel.
- **Niveau 1 — IA pour comprendre** : tu peux demander une explication, un exemple ou une reformulation du cours ; tu ne copies aucune phrase produite par l'IA dans ton travail.
- **Niveau 2 — IA déclarée** : tu peux utiliser l'IA pour une étape précise (idées, relecture) ; tu indiques laquelle et comment, en fin de copie.

Indique le niveau sur chaque consigne. Avant d'autoriser un usage, vérifie ce que prévoient le règlement intérieur, ton établissement et les conditions d'âge des outils : plusieurs services fixent un âge minimum ou demandent l'accord parental, et tu ne dois pas pousser des élèves à créer un compte.

Modèle de charte à adapter :

```
Rédige une charte d'usage de l'IA pour mes élèves de [niveau], une page maximum, ton direct et respectueux, avec :
- pourquoi l'IA peut aider à apprendre et pourquoi elle peut empêcher d'apprendre,
- les 3 niveaux d'usage (0 sans IA, 1 IA pour comprendre, 2 IA déclarée) avec un exemple concret chacun dans ma discipline,
- comment déclarer un usage (une phrase type),
- les erreurs que fait l'IA et pourquoi il faut vérifier,
- la règle de protection des données : ne jamais donner son nom, ses coordonnées ou des informations personnelles à un outil d'IA.
Laisse un emplacement pour les règles propres à l'établissement.
```

### Leçon 6.5 — En cas de doute sur un travail

Si un travail te semble non personnel, ne lance pas d'accusation. Méthode :
1. Compare avec les productions faites en classe par l'élève.
2. Propose un échange : « explique-moi comment tu as construit ce paragraphe », « que veut dire ce mot ici ? ».
3. Rappelle la règle du niveau d'usage et laisse une chance de refaire.
4. Applique les règles prévues par l'établissement, sans en inventer.

### Exemple

Une professeure de SES remplace la dissertation à la maison par : un plan détaillé à la maison (niveau 1 autorisé), rédaction de l'introduction et d'une partie en classe, puis un échange oral de 3 minutes avec chaque élève sur un tableau de données. Les élèves qui ont fait faire leur plan par une IA le découvrent seuls : ils ne savent pas le développer en classe.

### Exercice

Choisis un devoir que tu donnes habituellement. Passe-le dans le prompt de la leçon 6.2. Retiens une transformation et attribue-lui un niveau d'usage (0, 1 ou 2). Rédige ta charte d'usage et fais-la relire par un collègue.

---

## Module 7 — Ton système : bibliothèque de prompts et routine

### Leçon 7.1 — La bibliothèque de prompts

Tu ne vas pas réécrire tes prompts à chaque fois. Crée un document unique (traitement de texte ou outil de notes) avec ces rubriques :

1. **Brief de base** (module 1) déjà rempli pour chacune de tes classes : niveau, profil global, contraintes matérielles.
2. **Séquence** : squelette, séance minutée, consignes.
3. **Différenciation** : trois paliers, coups de pouce, accessibilité, contextes variés.
4. **Évaluation** : table de spécification, QCM, grille, vérification de corrigé, banque de commentaires.
5. **Classe et vie scolaire** : message aux familles, charte, activité « corriger l'IA ».

Chaque fois qu'une relance améliore nettement un résultat, ajoute-la au prompt correspondant. Au bout de quelques semaines, tes prompts sont faits pour toi.

Beaucoup d'assistants permettent d'enregistrer des **instructions permanentes** (on parle selon les outils d'instructions personnalisées, de projets ou d'espaces). Tu peux y placer :

```
Je suis professeur(e) de [discipline] en [niveaux]. Par défaut :
- réponds en français, avec un vocabulaire adapté à l'âge des élèves quand tu rédiges pour eux,
- respecte strictement les extraits de programme que je fournis,
- signale tout fait, date ou chiffre incertain par "à vérifier",
- n'invente jamais de citation, de référence ni de source,
- pose-moi des questions si une information manque,
- formats courts : tableaux et listes plutôt que longs paragraphes.
Je ne te transmettrai jamais de données personnelles d'élèves.
```

### Leçon 7.2 — La routine hebdomadaire

Une proposition de routine, à ajuster :

1. **Planifier (15 min)** : liste les séances de la semaine suivante et ce qui manque pour chacune.
2. **Produire en lot (45 à 60 min)** : une seule conversation par séquence ; enchaîne séances, consignes, déclinaisons.
3. **Vérifier (20 à 30 min)** : faits, corrigés, consignes, niveau de langue. Ne saute jamais cette étape.
4. **Mettre en forme (variable)** : copie dans tes modèles de documents habituels.
5. **Capitaliser (5 min)** : améliore un prompt, archive les supports validés.

Mesure ton temps sur deux ou trois semaines, avant et après. C'est le seul chiffre qui compte : le tien. Si une tâche te prend plus de temps avec l'IA que sans (ça arrive, notamment pour des supports très spécifiques ou des documents très mis en page), arrête de l'utiliser pour cette tâche.

### Leçon 7.3 — Réutiliser d'une année sur l'autre

Archive avec chaque séquence : le brief, les prompts utilisés, les supports validés et une note « ce qui a marché / ce qui n'a pas marché » rédigée juste après la séquence. L'année suivante :

```
Voici une séquence que j'ai faite l'an dernier et mon bilan :
"""
[séquence + bilan]
"""
Propose une version améliorée qui tient compte du bilan, sans changer les objectifs. Liste d'abord les modifications proposées, je validerai avant que tu les rédiges.
```

### Leçon 7.4 — Travailler entre collègues

Une bibliothèque partagée en équipe disciplinaire est plus riche qu'une bibliothèque seule : chacun apporte ses meilleurs prompts et ses vérifications. Convenez ensemble des règles (données élèves, outils autorisés, niveau d'usage pour les élèves) pour que les élèves entendent le même discours d'une classe à l'autre.

### Exemple

Une professeure de lettres crée un document « Prompts 2nde » avec son brief de base pré-rempli et 12 prompts. Pour chaque nouvelle séquence, elle copie le brief, colle l'extrait du programme et les textes choisis, et enchaîne trois prompts. Elle garde un temps fixe de vérification le dimanche matin, sans exception.

### Exercice

Crée ta bibliothèque avec au moins 8 prompts tirés de ce cours, adaptés à ta discipline. Enregistre tes instructions permanentes si ton outil le permet. Planifie ta routine pour la semaine prochaine dans ton agenda.

---

## Checklist finale

**Avant chaque utilisation**
- [ ] J'utilise un outil autorisé ou toléré par mon établissement.
- [ ] Mes paramètres de confidentialité sont réglés au plus protecteur.
- [ ] Mon prompt ne contient aucun nom, aucune donnée identifiante ni sensible sur un élève.
- [ ] J'ai collé moi-même l'extrait du programme et les documents sources.

**Pendant la production**
- [ ] Mon brief contient les 6 blocs (public, objectif, cadre, contraintes, format, mode).
- [ ] J'avance du squelette vers le détail, en validant chaque étape.
- [ ] J'ai demandé de signaler les faits incertains.

**Avant d'utiliser en classe**
- [ ] J'ai vérifié chaque fait, date, citation et chiffre dans une source fiable.
- [ ] J'ai refait moi-même les corrigés des questions de calcul ou de raisonnement.
- [ ] Le barème est cohérent et la somme est juste.
- [ ] Les consignes sont compréhensibles par mes élèves (une action par étape).
- [ ] Les versions différenciées visent le même objectif et ne portent pas d'étiquette de niveau.
- [ ] Rien dans le support ne peut gêner ou exclure une partie des élèves.

**Usage par les élèves**
- [ ] Chaque devoir indique un niveau d'usage de l'IA (0, 1 ou 2).
- [ ] Ma charte d'usage est rédigée et cohérente avec le règlement de l'établissement.
- [ ] Je n'utilise pas de détecteur d'IA pour accuser un élève.

**Système**
- [ ] Ma bibliothèque de prompts existe et je l'améliore après chaque séquence.
- [ ] J'ai mesuré mon temps de préparation avant et après, sur plusieurs semaines.

---

## Ressources

- **CNIL** (cnil.fr) : ressources sur la protection des données, l'IA et l'éducation ; rubriques dédiées aux mineurs.
- **Le site de ton ministère de tutelle** (pour l'Éducation nationale : education.gouv.fr) et **Eduscol** (eduscol.education.fr) : programmes officiels, ressources d'accompagnement, et éventuels cadres d'usage de l'IA. Vérifie toujours la version en vigueur.
- **Ton académie ou ton établissement** : DPO, délégation au numérique éducatif, outils autorisés, règlement intérieur.
- **Les conditions d'utilisation** de chaque outil IA que tu utilises : âge minimum, utilisation des données, localisation des serveurs.
- **Ta bibliothèque de prompts** : le vrai livrable de ce cours. Garde-la vivante.

Dernier rappel : l'IA te propose, tu disposes. Relis, vérifie, et garde tes élèves hors de l'outil.
