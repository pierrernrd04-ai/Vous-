# La méthode de prompt pro : des réponses IA utilisables du premier coup

> Masterclass écrite · 6 modules · lecture 2 à 3 h · mise en pratique en 7 à 14 jours

---

## Introduction

### Pour qui

Tu utilises un assistant IA (Claude, ou un autre) plusieurs fois par semaine. Parfois, la réponse est excellente. Souvent, elle est générique, trop longue, à côté du sujet, ou contient une erreur que tu repères trop tard. Tu passes autant de temps à corriger qu'à faire toi-même.

Cette masterclass s'adresse aux personnes qui veulent des réponses **utilisables du premier coup**, ou presque : salariés, indépendants, étudiants, enseignants, responsables d'association. Pas besoin de compétences techniques.

### Ce que tu sauras faire à la fin

- Écrire un prompt selon une **structure en 6 blocs** que tu peux appliquer à n'importe quelle tâche.
- Donner le **bon contexte**, ni trop ni trop peu.
- Utiliser des **exemples** pour obtenir exactement le format et le ton voulus.
- **Itérer** efficacement quand la première réponse ne va pas.
- Construire ta **bibliothèque de prompts** personnelle, réutilisable.
- **Vérifier les faits** et repérer les erreurs typiques d'une IA.

### Comment suivre cette masterclass

1. Lis les modules dans l'ordre : chaque module s'appuie sur le précédent.
2. Ouvre ton assistant IA à côté. Teste chaque prompt pendant ta lecture, sur une vraie tâche à toi.
3. Fais les exercices : ils prennent 15 à 30 minutes et transforment la lecture en réflexe.
4. Ouvre dès maintenant un document « Ma bibliothèque de prompts ». Tu y ajouteras tes prompts au fil des modules (module 5).

### Pourquoi une méthode plutôt qu'une liste de « prompts magiques »

Les outils changent : nouveaux modèles, nouvelles fonctions, nouveaux noms. Les listes de « 100 prompts magiques » vieillissent vite et ne s'adaptent pas à ta situation. Une méthode, elle, reste valable : un assistant IA a toujours besoin de savoir ce que tu veux, pour qui, avec quelles contraintes et sous quelle forme. C'est ce que tu vas apprendre à formuler.

Les exemples citent Claude, sans aucun partenariat avec son éditeur. Tout fonctionne avec d'autres assistants conversationnels.

---

## Module 1 — Pourquoi tes réponses sont moyennes (et comment l'IA « lit » ton prompt)

### Leçon 1.1 — L'IA comble les trous avec des moyennes

Quand tu écris « Écris un post LinkedIn sur la gestion du temps », l'IA doit deviner :

- pour qui tu écris (dirigeants ? étudiants ? freelances ?) ;
- ce que tu penses toi, sur le sujet ;
- le ton (inspirant, technique, personnel ?) ;
- la longueur ;
- ce qu'il faut éviter.

Faute d'information, elle choisit l'option la plus probable : un texte moyen, consensuel, plein de formules déjà vues. Ce n'est pas un défaut de l'outil. C'est le résultat logique d'une consigne incomplète.

**Principe n°1 : chaque information que tu ne donnes pas sera remplacée par une moyenne.**

### Leçon 1.2 — Le test du stagiaire

Avant d'envoyer un prompt, pose-toi cette question : « Si je donnais exactement ce message à un stagiaire brillant qui ne me connaît pas et n'a jamais vu mon projet, pourrait-il faire le travail correctement ? »

Si la réponse est non, il manque quelque chose : du contexte, un objectif, un exemple, un format. L'IA est dans la même situation que ce stagiaire, à chaque nouvelle conversation.

### Leçon 1.3 — Les cinq défauts les plus fréquents

| Défaut | Exemple | Conséquence |
|---|---|---|
| Objectif absent | « Parle-moi du télétravail » | Réponse encyclopédique, inutilisable |
| Public absent | « Explique la TVA » | Niveau trop simple ou trop technique |
| Format absent | « Résume ce document » | Longueur et structure au hasard |
| Contraintes absentes | « Écris un e-mail de relance » | Ton générique, formules creuses |
| Critère de réussite absent | « Améliore ce texte » | Changements aléatoires |

### Leçon 1.4 — Avant / après

**Prompt faible :**

```text
Écris un e-mail pour annoncer une hausse de prix à mes clients.
```

**Prompt structuré :**

```text
Je suis professeure de yoga indépendante. Je donne des cours
collectifs à une vingtaine d'élèves réguliers, que je tutoie.
Mon tarif passe de 12 € à 14 € la séance au 1er janvier, parce que
la location de la salle a augmenté. C'est la première hausse en 3 ans.

Rédige l'e-mail d'annonce.
Objectif : informer clairement, garder la confiance, éviter les
désinscriptions.
Ton : simple, sincère, chaleureux, sans s'excuser excessivement.
Contenu : nouveau tarif, date, raison en une phrase, ce qui ne
change pas (horaires, contenu), remerciement.
Format : objet + corps de 100 mots maximum. Signature : Léa.
À éviter : jargon commercial, "nous", formules comme
"suite à une conjoncture".
```

**Exemple de résultat attendu :**

> **Objet : Les cours en 2027 : ce qui change (un peu)**
>
> Bonjour à toutes et tous,
>
> À partir du 1er janvier, la séance passera de 12 € à 14 €. La location de la salle a augmenté cette année, et c'est la première fois en trois ans que je modifie mes tarifs.
>
> Rien d'autre ne change : mêmes horaires, même salle, même énergie.
>
> Merci pour votre fidélité. C'est un vrai plaisir de pratiquer avec vous chaque semaine.
>
> À mardi,
> Léa

La deuxième version prend une minute de plus à écrire. Elle évite trois allers-retours.

### Exercice du module 1

Reprends trois prompts que tu as envoyés récemment (dans ton historique). Pour chacun, applique le test du stagiaire et liste ce qui manquait parmi les cinq défauts. Ne réécris pas encore : on le fera au module 2.

### Modèle à copier — Le test du stagiaire

```text
[ ] Un inconnu comprendrait-il QUI je suis et POUR QUI c'est ?
[ ] Sait-il ce que je veux OBTENIR (pas seulement le sujet) ?
[ ] Sait-il sous quelle FORME rendre le travail ?
[ ] Sait-il ce qu'il doit ÉVITER ?
[ ] Saurait-il juger lui-même si son travail est RÉUSSI ?
```

---

## Module 2 — La structure en 6 blocs

### Leçon 2.1 — Les 6 blocs

Un prompt pro contient, dans l'ordre, jusqu'à six blocs. Tous ne sont pas nécessaires pour une question simple, mais une tâche importante les mérite tous.

1. **Rôle et situation** : qui tu es, dans quel contexte, (éventuellement) quelle expertise tu attends de l'IA.
2. **Objectif** : ce que tu veux obtenir et à quoi ça servira.
3. **Matière** : les informations, documents, données à utiliser.
4. **Contraintes** : ton, longueur, interdits, public, niveau.
5. **Format** : la forme exacte de la réponse (liste, tableau, plan, e-mail, nombre de variantes).
6. **Critères de réussite et consignes de prudence** : comment juger que c'est bon, et que faire en cas de doute.

### Leçon 2.2 — Le gabarit universel

```text
## Contexte
Je suis [rôle / situation]. [1 à 3 phrases utiles sur le contexte.]

## Objectif
Je veux [livrable précis] pour [destinataire / usage].

## Matière
Utilise uniquement les informations suivantes :
"""
[données, notes, document]
"""

## Contraintes
- Public : [qui va lire, quel niveau]
- Ton : [2 ou 3 adjectifs + 1 exemple de phrase si possible]
- Longueur : [nombre de mots / de lignes]
- À éviter : [liste concrète]

## Format
[Structure exacte attendue]

## Réussite et prudence
- La réponse est réussie si [critère].
- Si une information manque, pose-moi la question avant de répondre.
- N'invente aucun chiffre, nom, date ou source.
```

Les titres en `##` ne sont pas obligatoires, mais ils aident : l'IA sépare clairement les instructions des données, et toi tu repères vite ce qui manque.

### Leçon 2.3 — Bloc par bloc : les bonnes pratiques

**Rôle et situation.** « Tu es un expert » apporte peu. Ce qui aide vraiment, c'est **ta** situation : « Je suis responsable des bénévoles d'une association de 40 personnes, je prépare la réunion de rentrée. » Si tu attribues un rôle à l'IA, rends-le précis : « Relis comme un correcteur d'édition exigeant » est plus utile que « Tu es un expert en écriture ».

**Objectif.** Distingue le **sujet** (« le compost ») de l'**objectif** (« convaincre le syndic d'installer un composteur collectif »). L'objectif change tout le contenu.

**Matière.** Donne les faits que tu connais. L'IA ne sait pas ce qui s'est passé dans ta réunion, ni le prix de ton offre, ni les retours de tes clients. Délimite la matière avec des guillemets triples `"""` ou des balises (`<document>…</document>`), pour que l'IA ne confonde pas tes données et tes instructions.

**Contraintes.** Les contraintes négatives concrètes fonctionnent bien : « N'utilise pas les mots "incontournable", "booster", "dans un monde en constante évolution" ». Les adjectifs seuls (« naturel », « dynamique ») sont interprétés de façon floue.

**Format.** Sois précis : « 3 options, chacune avec un titre en gras, 2 phrases d'explication et un inconvénient ». Si tu vas coller le résultat dans un tableur, demande un tableau. Si tu vas le lire sur téléphone, demande des paragraphes courts.

**Réussite et prudence.** C'est le bloc le plus oublié. « Si une information manque, pose-moi la question » réduit fortement les inventions. Un critère de réussite (« un lecteur de 12 ans doit comprendre ») oriente toute la réponse.

### Leçon 2.4 — Exemple complet : préparer une réunion

```text
## Contexte
Je coordonne une association de quartier (jardin partagé, 25
adhérents actifs). Je prépare l'assemblée générale annuelle.

## Objectif
Je veux un ordre du jour minuté pour une réunion de 1 h 30, que
j'enverrai aux adhérents une semaine avant.

## Matière
Points à traiter (mes notes) :
"""
- bilan de l'année : 2 nouvelles parcelles, récupérateur d'eau installé
- comptes : à présenter par la trésorière
- élection : 2 postes au bureau à renouveler
- projet : poulailler collectif, avis partagés
- questions diverses
"""

## Contraintes
- Public : adhérents, pas forcément familiers des procédures
- Ton : clair et convivial
- Laisser du temps de débat sur le poulailler

## Format
Tableau : Horaire | Point | Qui présente | Durée.
Puis 3 lignes d'introduction à mettre au-dessus du tableau dans l'e-mail.

## Réussite et prudence
- Le total doit faire exactement 1 h 30.
- Ne rajoute aucun point que je n'ai pas listé.
- Si un présentateur n'est pas indiqué, écris "à définir".
```

**Exemple de résultat attendu :**

> | Horaire | Point | Qui présente | Durée |
> |---|---|---|---|
> | 18 h 30 | Accueil et ouverture | à définir | 10 min |
> | 18 h 40 | Bilan de l'année | à définir | 15 min |
> | 18 h 55 | Présentation des comptes | Trésorière | 15 min |
> | 19 h 10 | Projet poulailler : présentation et débat | à définir | 30 min |
> | 19 h 40 | Élection au bureau (2 postes) | à définir | 10 min |
> | 19 h 50 | Questions diverses | Tous | 10 min |

Remarque : l'IA a placé le débat avant l'élection, ce qui est un choix discutable. C'est à toi de décider. Le prompt structuré ne te dispense pas de juger : il te donne un bon premier jet à juger.

### Leçon 2.5 — Le prompt court bien fait

Pour une tâche simple, deux ou trois blocs suffisent :

```text
Reformule ce paragraphe pour un public de non-spécialistes,
en 3 phrases maximum, sans perdre l'information clé (le délai
de 15 jours) :
"""[paragraphe]"""
```

Objectif, contrainte, critère de réussite, matière. En une ligne et demie.

### Leçon 2.6 — Les erreurs fréquentes avec la structure

- **Les consignes contradictoires.** « Sois exhaustif » et « 100 mots maximum » dans le même prompt : l'IA choisira l'une au hasard. Relis tes contraintes et hiérarchise : « Priorité à la concision ; si tu dois choisir, garde les points 1 et 3. »
- **La matière noyée dans les instructions.** Si tu colles un long document au milieu de tes consignes, une partie des consignes peut être moins bien suivie. Mets les consignes principales avant la matière, et rappelle la tâche en une ligne après : « Rappel : résume ce document en 5 puces. »
- **Le format implicite.** « Fais-moi un tableau » sans préciser les colonnes donne des colonnes au hasard. Nomme-les.
- **Le « etc. ».** « Parle des avantages, des coûts, etc. » laisse l'IA inventer la suite. Liste tout ce que tu veux, ou écris explicitement « uniquement ces points ».
- **La politesse à la place de la consigne.** « Pourrais-tu éventuellement essayer de faire plus court si possible ? » est moins clair que « 80 mots maximum ». Tu peux être poli, mais sois précis.
- **Le prompt jamais relu.** Avant d'envoyer un prompt important, relis-le en te mettant à la place du stagiaire. Une faute de frappe dans un chiffre (« 1 000 mots » au lieu de « 100 mots ») change tout.

### Exercice du module 2

Réécris les trois prompts de l'exercice du module 1 avec le gabarit. Envoie les deux versions (ancienne et nouvelle) dans deux conversations séparées. Compare les réponses et note ce qui a changé.

### Modèle à copier — Le gabarit express (tâches courantes)

```text
Je suis [rôle]. Je veux [livrable] pour [destinataire].
Utilise : """[matière]"""
Ton : [ ]. Longueur : [ ]. À éviter : [ ].
Format : [ ].
Si une info manque, demande-moi. N'invente rien.
```

---

## Module 3 — Le contexte et les exemples

### Leçon 3.1 — Combien de contexte donner

Trop peu de contexte produit des réponses génériques. Trop de contexte non trié noie l'essentiel. La règle : **donne tout ce qui changerait la réponse d'un expert humain, et rien d'autre.**

Questions pour trier :
- Cette information changerait-elle le ton, le contenu ou le format ? → garde.
- Est-ce une information que l'IA ne peut pas deviner (faits, préférences, contraintes réelles) ? → garde.
- Est-ce de l'historique sans effet sur la tâche ? → coupe ou résume en une ligne.

### Leçon 3.2 — Le contexte permanent

Si tu fais souvent le même type de tâches, écris un **contexte permanent** une fois pour toutes. Selon ton outil, tu le colles en début de conversation, ou tu le places dans les instructions d'un espace de travail dédié (souvent appelé « projet » ou « instructions personnalisées »).

```text
# Mon contexte permanent

Qui je suis : [métier, structure, public].
Ce que je fais le plus souvent avec toi : [3 à 5 tâches].
Mon style : [ton, tutoiement/vouvoiement, longueur habituelle].
Mes interdits : [mots, formules, tournures].
Mes consignes par défaut :
- Réponds en français.
- Va à l'essentiel : pas d'introduction ni de conclusion inutiles.
- Si une information manque, pose UNE question avant de répondre.
- Signale clairement quand tu n'es pas sûr d'un fait.
```

### Leçon 3.3 — La puissance des exemples

Décrire un style est difficile. Le montrer est facile. Un ou deux exemples valent souvent mieux qu'un paragraphe d'explications. On parle parfois de prompt « avec exemples » (ou *few-shot*).

```text
Je publie chaque semaine une astuce courte pour mes abonnés.
Voici deux astuces que j'ai écrites, dont j'aime le style :

<exemple>
Tu oublies toujours d'arroser tes plantes ? Pose ton arrosoir à
côté de la cafetière. Le matin, un geste en appelle un autre.
</exemple>

<exemple>
Ton basilic jaunit ? Trop d'eau, presque toujours. Enfonce un doigt
dans la terre : si elle est humide à deux centimètres, attends.
</exemple>

Écris 3 nouvelles astuces dans le même style, sur ces sujets :
semis de tomates, plantes en vacances, rempotage.
Même longueur, même structure : une question, une réponse concrète,
une phrase de justification.
```

**Exemple de résultat attendu :**

> Tu pars deux semaines ? Plonge une mèche de coton dans une bouteille d'eau et enfonce l'autre bout dans le pot. La plante boit à son rythme pendant ton absence.

**Bonnes pratiques avec les exemples :**
- Donne des exemples **variés** si tu veux de la variété ; sinon l'IA copiera trop fidèlement le sujet ou la tournure du premier.
- Indique ce qu'il faut reprendre (« même structure, même longueur ») et ce qu'il ne faut pas reprendre (« sujets différents, pas les mêmes mots d'ouverture »).
- Balise les exemples (`<exemple>`) pour les séparer des instructions.

### Leçon 3.4 — Le contre-exemple

Montrer ce que tu ne veux pas est aussi efficace :

```text
Voici le type de phrase que je NE veux PAS :
"Dans un monde en constante évolution, il est essentiel de
repenser notre rapport au temps."
Trop vague, trop solennel, aucune information.

Voici le type de phrase que je veux :
"Bloque 2 heures le mardi matin sans réunion. C'est le créneau
où ton équipe est la moins sollicitée."
Concret, actionnable, une seule idée.

Réécris le paragraphe suivant en respectant ce style : """[texte]"""
```

### Leçon 3.5 — Faire poser des questions à l'IA

Quand tu ne sais pas toi-même quel contexte donner, inverse les rôles :

```text
Je veux [objectif]. Avant de répondre, pose-moi les questions
dont tu as besoin pour faire un travail vraiment adapté à ma
situation. Maximum 5 questions, les plus importantes d'abord.
Attends mes réponses avant de produire quoi que ce soit.
```

C'est particulièrement utile pour les tâches que tu fais pour la première fois : rédiger un règlement intérieur, préparer un entretien, organiser un événement.

### Exercice du module 3

1. Écris ton contexte permanent (15 minutes) et installe-le dans ton outil.
2. Choisis un texte que tu écris régulièrement (post, newsletter, compte rendu). Trouve deux exemples réels que tu as aimés, et fais produire un nouveau texte avec la méthode des exemples.

### Modèle à copier — Bloc d'exemples

```text
Voici [nombre] exemples du résultat que je veux :
<exemple>[exemple 1]</exemple>
<exemple>[exemple 2]</exemple>
À reprendre : [structure, longueur, ton].
À ne pas reprendre : [sujets, mots d'ouverture, tournures].
```

---

## Module 4 — Itérer : transformer une réponse moyenne en réponse utilisable

### Leçon 4.1 — Ne recommence pas tout : corrige précisément

Quand la réponse ne va pas, l'erreur classique est de réécrire « Non, refais mieux » ou de tout réexpliquer. Il est plus efficace de dire **précisément** ce qui ne va pas et ce qui doit rester.

Structure d'une bonne relance :
1. Ce qui est bien et doit être gardé.
2. Ce qui ne va pas, précisément.
3. La correction attendue.

```text
Garde la structure en 3 parties et l'exemple du boulanger.
La deuxième partie est trop abstraite : remplace les généralités
par des étapes numérotées.
Raccourcis l'ensemble de 30 % environ.
```

### Leçon 4.2 — Les relances courtes à connaître

```text
Plus court. Garde uniquement l'essentiel.
```
```text
Donne-moi 3 versions très différentes du titre, pas des variantes
de la même idée.
```
```text
Explique ton raisonnement pour le point 2 : sur quoi t'appuies-tu ?
```
```text
Qu'est-ce que tu as dû supposer faute d'information ? Liste tes
hypothèses.
```
```text
Réécris uniquement le dernier paragraphe. Ne touche pas au reste.
```

La relance « liste tes hypothèses » est particulièrement utile : elle révèle les trous de ton prompt, que tu pourras combler la prochaine fois.

### Leçon 4.3 — Découper les tâches complexes

Une tâche complexe demandée en une fois donne un résultat moyen partout. Découpe-la en étapes, et valide chaque étape avant la suivante.

**Exemple : écrire un article de blog**

1. « Propose 5 angles pour un article sur [sujet] destiné à [public]. » → tu choisis.
2. « Fais le plan de l'angle 3, avec 5 parties et l'idée clé de chacune. » → tu ajustes.
3. « Rédige l'introduction et la partie 1, en utilisant mes notes : """…""" » → tu relis.
4. Parties suivantes, une par une.
5. « Relis l'ensemble et signale les répétitions et les passages faibles. »

Chaque étape te laisse décider. Le résultat final est le tien, pas une moyenne.

### Leçon 4.4 — Demander une auto-critique

Les assistants IA sont souvent capables de repérer les faiblesses de leur propre texte quand on le leur demande explicitement, avec des critères :

```text
Relis ta réponse selon ces critères et note chacun de 1 à 5 :
1. Clarté pour [public].
2. Précision : chaque affirmation est-elle étayée par la matière
   fournie ?
3. Respect des contraintes (longueur, ton, interdits).
4. Utilité concrète : le lecteur sait-il quoi faire après ?
Pour chaque note inférieure à 4, propose une correction précise.
Puis donne la version corrigée.
```

Attention : l'auto-critique améliore souvent la forme, mais ne garantit pas l'exactitude des faits. Pour ça, voir le module 6.

### Leçon 4.5 — Quand repartir de zéro

Une conversation longue accumule des consignes contradictoires et de vieilles versions. Si après 4 ou 5 relances le résultat se dégrade ou tourne en rond, ouvre une **nouvelle conversation** avec un prompt réécrit, qui intègre tout ce que tu as appris :

```text
Résume en un prompt unique et complet tout ce que je t'ai demandé
dans cette conversation (contexte, objectif, contraintes, format,
corrections successives), pour que je puisse le réutiliser dans
une nouvelle conversation.
```

Ce prompt-résumé est souvent le meilleur prompt de toute la conversation. Garde-le dans ta bibliothèque.

### Exercice du module 4

Prends une tâche réelle un peu complexe (un document de 2 pages, une présentation, un plan de projet). Découpe-la en 4 étapes minimum. À la fin, demande le prompt-résumé et enregistre-le.

### Modèle à copier — La relance en 3 temps

```text
À garder : [ ].
À changer : [ ], parce que [ ].
Attendu : [ ].
```

---

## Module 5 — Ta bibliothèque de prompts

### Leçon 5.1 — Pourquoi une bibliothèque

Tu fais probablement les mêmes types de tâches chaque semaine. Réécrire le prompt à chaque fois, c'est perdre du temps et de la qualité. Une bibliothèque, c'est un document où tu ranges tes meilleurs prompts, testés et améliorés, avec des emplacements à remplir.

### Leçon 5.2 — Le format d'une fiche-prompt

Chaque prompt de ta bibliothèque suit le même format :

```text
### [Nom court] — ex. "Compte rendu de réunion"
Quand l'utiliser : [déclencheur]
Variables à remplir : [DATE], [NOTES], [PARTICIPANTS]
Dernière mise à jour : [date]

PROMPT :
"""
[le prompt complet, avec les variables entre crochets]
"""

Notes : [ce qui marche, les pièges, l'outil sur lequel je l'ai testé]
```

Les variables entre crochets en majuscules te montrent immédiatement ce qu'il faut remplacer.

### Leçon 5.3 — Les 8 prompts de base à avoir

Voici huit prompts génériques couvrant la plupart des usages. Adapte-les, teste-les, puis range-les.

**1. Résumer un document**

```text
Résume ce document pour [destinataire] qui doit [décision/action].
Format : 5 puces maximum, la plus importante en premier, puis
une ligne "Ce qui manque ou reste flou".
N'ajoute aucune information absente du document.
"""
[DOCUMENT]
"""
```

**2. Rédiger un e-mail**

```text
Rédige un e-mail à [destinataire, relation].
Objectif : [ce que je veux obtenir].
Faits : [liste].
Ton : [ ]. Longueur : [N] mots max. Objet inclus.
N'invente aucun fait.
```

**3. Expliquer un sujet**

```text
Explique [sujet] à [public, niveau]. Utilise une analogie de la
vie quotidienne, puis un exemple concret, puis les 3 erreurs
fréquentes. 250 mots maximum. Signale tout point où les sources
divergent ou où tu n'es pas certain.
```

**4. Trouver des idées**

```text
Propose [N] idées de [quoi] pour [contexte, contraintes].
Les idées doivent être vraiment différentes les unes des autres.
Pour chacune : une phrase de description, un avantage, un
inconvénient, une estimation d'effort (faible/moyen/élevé).
```

**5. Corriger et améliorer un texte**

```text
Corrige ce texte : orthographe, grammaire, ponctuation.
Ensuite, liste séparément (sans les appliquer) les suggestions de
style qui le rendraient plus clair. Garde ma voix.
"""
[TEXTE]
"""
```

**6. Structurer des notes**

```text
Transforme ces notes en [compte rendu / plan / liste de tâches].
Structure : [rubriques]. Ne rajoute rien. Marque "à préciser"
là où mes notes sont ambiguës.
"""
[NOTES]
"""
```

**7. Comparer des options**

```text
Je dois choisir entre [option A], [option B] et [option C] pour
[objectif]. Mes critères, par ordre d'importance : [liste].
Fais un tableau comparatif sur ces critères, puis dis-moi quelles
informations me manquent pour décider. Ne décide pas à ma place.
```

**8. Préparer une conversation difficile**

```text
Je dois avoir une conversation avec [personne, relation] à propos
de [sujet]. Mon objectif : [ ]. Ce que je crains : [ ].
Propose : une phrase d'ouverture, 3 points à dire, les 3 objections
probables avec une réponse pour chacune, une phrase de conclusion.
Ton : respectueux et clair.
```

### Leçon 5.4 — Tester et améliorer tes prompts

Un prompt de bibliothèque doit être **robuste** : il doit fonctionner sur des cas différents. Teste-le sur 3 situations réelles variées avant de le considérer comme fiable. Si une sortie te déçoit, demande-toi quelle consigne a manqué, et ajoute-la au prompt (pas seulement à la conversation).

Prompt pour améliorer un prompt :

```text
Voici un prompt que j'utilise régulièrement :
"""[PROMPT]"""
Et voici une réponse obtenue qui ne m'a pas satisfait, avec ce qui
n'allait pas : """[RÉPONSE + CRITIQUE]"""
Propose une version améliorée du prompt qui évite ce problème,
sans le rallonger inutilement. Explique en 3 puces ce que tu as
changé et pourquoi.
```

### Leçon 5.5 — Organiser ta bibliothèque

Range par **usage**, pas par outil :
- Écrire (e-mails, posts, documents)
- Synthétiser (résumés, comptes rendus)
- Réfléchir (idées, comparaisons, décisions)
- Apprendre (explications, quiz)
- Vérifier (relecture, faits)

Un simple document texte suffit. Un outil de notes avec recherche est un plus. L'important est de pouvoir retrouver un prompt en moins de 10 secondes.

### Exercice du module 5

Crée ta bibliothèque avec les 8 prompts de base. Adapte au moins 3 d'entre eux à ton métier, teste-les sur 3 cas réels chacun, et note ce que tu as amélioré.

### Modèle à copier — Index de bibliothèque

```text
# MA BIBLIOTHÈQUE DE PROMPTS
## Écrire
- E-mail standard · E-mail délicat · Post [réseau]
## Synthétiser
- Résumé de document · Compte rendu
## Réfléchir
- Idées · Comparaison · Conversation difficile
## Apprendre
- Explication · Quiz
## Vérifier
- Correction · Vérification des faits
```

---

## Module 6 — Vérifier les faits : ne jamais publier une erreur de l'IA

### Leçon 6.1 — Pourquoi l'IA se trompe avec assurance

Un assistant IA produit du texte plausible. La plupart du temps, plausible et exact coïncident. Parfois non : il peut inventer une citation, une référence, une date, un chiffre, un article de loi, une fonctionnalité de logiciel, ou mélanger deux sources. Le ton reste le même, assuré, que l'information soit juste ou fausse. On appelle souvent ces erreurs des « hallucinations ».

Certains outils peuvent faire des recherches sur internet et citer leurs sources, ce qui aide, mais ne dispense pas de vérifier : une source citée peut être mal résumée ou ne pas dire ce que l'IA lui attribue.

**Principe : tu es responsable de ce que tu publies, envoies ou décides, quelle que soit l'origine du texte.**

### Leçon 6.2 — Les zones à risque

Vérifie systématiquement :

| Type d'information | Pourquoi c'est risqué |
|---|---|
| Chiffres et statistiques | Souvent inventés ou datés |
| Citations et auteurs | Attributions fausses fréquentes |
| Références (livres, articles, études, liens) | Peuvent ne pas exister |
| Règles légales, fiscales, médicales | Évoluent, varient selon les pays, erreurs graves |
| Dates et calculs | Erreurs d'arithmétique ou de calendrier |
| Fonctionnalités de logiciels | Changent souvent, l'IA peut décrire une ancienne version |
| Informations récentes | L'IA peut ne pas les connaître |

### Leçon 6.3 — Le prompt de prudence

Ajoute ces consignes à tout prompt où les faits comptent :

```text
Consignes de fiabilité :
- Distingue clairement ce qui est un fait établi, une estimation
  et une opinion.
- Pour chaque chiffre ou affirmation factuelle importante,
  indique ton niveau de confiance (élevé / moyen / faible).
- Si tu ne sais pas, dis "je ne sais pas" plutôt que de deviner.
- Ne cite aucune source, étude ou référence dont tu n'es pas
  certain de l'existence. Si une source serait utile, indique
  plutôt quel type d'organisme consulter.
```

**Exemple de résultat attendu :**

> **Durée de conservation des factures pour une entreprise en France** — Plusieurs durées peuvent s'appliquer selon le point de vue (commercial, fiscal). Confiance : moyenne sur le détail des durées. À vérifier sur service-public.fr (fiche « Durée de conservation des documents »).

### Leçon 6.4 — La méthode de vérification en 4 étapes

1. **Extraire.** Demande à l'IA de lister toutes les affirmations vérifiables de son texte.

```text
Liste toutes les affirmations factuelles vérifiables de ce texte
(chiffres, dates, noms, citations, règles, références), une par
ligne, dans un tableau : Affirmation | Type | Comment la vérifier
(quel type de source).
"""[TEXTE]"""
```

2. **Prioriser.** Commence par ce qui aurait des conséquences si c'était faux : règles, montants, citations publiques, conseils de sécurité.

3. **Vérifier à la source.** Va sur la source primaire : site officiel (service-public.fr, legifrance.gouv.fr, sites des ministères, organismes publics), documentation officielle du logiciel, publication originale de l'étude. Une page qui recopie une autre page n'est pas une source primaire.

4. **Corriger ou retirer.** Si tu ne peux pas vérifier une affirmation, retire-la ou formule-la avec prudence.

### Leçon 6.5 — Les questions de recoupement

Quelques questions à poser pour tester la solidité d'une réponse :

```text
Sur quoi t'appuies-tu pour affirmer [X] ?
```
```text
Quels sont les arguments ou les cas qui contredisent ce que tu
viens de dire ?
```
```text
Cette information peut-elle avoir changé récemment ? Quelle
serait la source officielle à jour ?
```

Attention : une IA qui « confirme » sa propre réponse n'est pas une vérification. Ces questions servent à repérer les points fragiles, que tu vérifies ensuite toi-même à la source.

### Leçon 6.6 — Confidentialité : ce que tu ne colles pas

La vérification concerne aussi ce que tu envoies. Avant de coller un document dans un assistant IA :
- vérifie les paramètres de confidentialité de ton outil (utilisation des conversations, durée de conservation) ;
- retire les données personnelles (noms, coordonnées, numéros) ou remplace-les par des marqueurs ;
- ne colle jamais de données sensibles (santé, coordonnées bancaires, mots de passe) ni de documents confidentiels que ton employeur ou ton client n'autorise pas à partager.

Pour aller plus loin : **cnil.fr** publie des recommandations sur l'usage des outils d'IA.

### Exercice du module 6

Prends un texte que l'IA t'a produit récemment et qui contient des faits (un article, une note, une réponse à une question pratique). Applique la méthode en 4 étapes. Compte le nombre d'affirmations vérifiées, corrigées et retirées. Ce chiffre te dira beaucoup sur ta vigilance à adopter.

### Modèle à copier — Checklist avant publication

```text
[ ] Chiffres vérifiés à la source primaire
[ ] Citations vérifiées (auteur, formulation exacte)
[ ] Références existantes et pertinentes
[ ] Règles légales/fiscales vérifiées sur un site officiel, avec date
[ ] Calculs refaits
[ ] Aucune donnée personnelle ou confidentielle dans ce que j'ai collé
[ ] Le texte final est relu par moi, en entier
```

---

## Checklist finale

**Les bases**
- [ ] J'applique le test du stagiaire avant chaque prompt important.
- [ ] Je connais les 6 blocs : rôle et situation, objectif, matière, contraintes, format, réussite et prudence.
- [ ] J'ai le gabarit universel et le gabarit express à portée de main.

**Contexte et exemples**
- [ ] Mon contexte permanent est écrit et installé.
- [ ] J'ai utilisé au moins une fois la méthode des exemples et une fois le contre-exemple.
- [ ] Je sais demander à l'IA de me poser des questions avant de répondre.

**Itération**
- [ ] Je corrige avec la relance en 3 temps (garder, changer, attendu).
- [ ] Je découpe les tâches complexes en étapes.
- [ ] Je demande le prompt-résumé à la fin des conversations utiles.

**Bibliothèque**
- [ ] Ma bibliothèque contient au moins 8 prompts au format fiche.
- [ ] Au moins 3 prompts sont adaptés à mon métier et testés sur 3 cas.

**Vérification**
- [ ] J'ajoute les consignes de fiabilité quand les faits comptent.
- [ ] J'applique la méthode en 4 étapes avant de publier ou d'envoyer.
- [ ] Je ne colle aucune donnée sensible ou confidentielle.

---

## Ressources

### Sources utiles

- **Documentation officielle de ton assistant IA** : la plupart des éditeurs publient des guides de rédaction de prompts, mis à jour avec leurs outils. Consulte la version actuelle.
- **service-public.fr**, **legifrance.gouv.fr** : sources primaires pour les règles françaises.
- **cnil.fr** : recommandations sur l'IA et les données personnelles.

### Récapitulatif des prompts

| # | Prompt | Module |
|---|---|---|
| 1 | Prompt structuré avant/après | 1 |
| 2 | Gabarit universel en 6 blocs | 2 |
| 3 | Gabarit express | 2 |
| 4 | Contexte permanent | 3 |
| 5 | Prompt avec exemples | 3 |
| 6 | Contre-exemple | 3 |
| 7 | Faire poser des questions à l'IA | 3 |
| 8 | Relances courtes (×5) | 4 |
| 9 | Auto-critique avec critères | 4 |
| 10 | Prompt-résumé de conversation | 4 |
| 11 | Les 8 prompts de base | 5 |
| 12 | Améliorer un prompt | 5 |
| 13 | Consignes de fiabilité | 6 |
| 14 | Extraction des affirmations vérifiables | 6 |
| 15 | Questions de recoupement | 6 |

### Dernier conseil

Le meilleur prompt n'est pas le plus long. C'est celui qui contient tout ce qui change la réponse, et rien d'autre. Avec la pratique, tu écriras naturellement des prompts courts et complets.
