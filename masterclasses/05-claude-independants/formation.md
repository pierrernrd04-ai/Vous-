# Claude pour indépendants : délègue ton admin à l'IA

> Masterclass écrite · 6 modules · lecture 2 à 3 h · mise en place en 7 à 14 jours

---

## Introduction

### Pour qui

Tu es indépendant : freelance, consultant, graphiste, développeur, formateur, thérapeute, photographe, artisan qui facture en direct. Tu passes une partie de ta semaine sur des tâches qui ne sont pas ton métier : répondre aux e-mails, rédiger des devis, relancer des factures, écrire des comptes rendus, organiser ta semaine. Ces tâches ne sont pas difficiles. Elles sont répétitives, elles demandent de la concentration au mauvais moment, et elles se repoussent facilement.

Cette masterclass t'apprend à confier le premier jet de ces tâches à un assistant IA conversationnel comme Claude, en gardant la main sur la décision finale et sur la confidentialité de tes clients.

### Ce que tu sauras faire à la fin

- Préparer un **dossier de contexte** réutilisable qui fait écrire l'IA avec ton ton, tes tarifs et tes conditions.
- Rédiger en quelques minutes un **e-mail client** délicat (refus, recadrage, retard, changement de périmètre).
- Transformer des notes d'appel en **proposition commerciale ou devis** structuré.
- Mettre en place une **séquence de relance de factures** en trois niveaux, polie puis ferme.
- Produire un **compte rendu de réunion** clair à partir de notes brutes ou d'une transcription.
- Organiser ta **semaine** avec une revue hebdomadaire assistée.
- Appliquer des **règles de confidentialité** simples pour ne jamais exposer les données de tes clients.

### Comment suivre cette masterclass

1. Lis le module 1 en entier : c'est la fondation. Sans le dossier de contexte et les règles de confidentialité, les modules suivants marchent moins bien.
2. Ensuite, prends les modules dans l'ordre de ta douleur. Si tes factures impayées t'empêchent de dormir, va directement au module 4.
3. Chaque module se termine par un exercice. Fais-le sur un vrai cas de ta semaine, pas sur un exemple inventé.
4. Copie les prompts dans un fichier à toi (un document texte, une note, un outil de type Notion). À la fin, tu auras ta propre bibliothèque.

### Un mot sur les outils

Les assistants IA changent vite : noms des offres, boutons, fonctions de mémoire, « projets », intégrations. Cette masterclass ne dépend d'aucun bouton précis. Elle te donne des méthodes et des prompts qui fonctionnent dans n'importe quel assistant conversationnel sérieux. Les exemples citent Claude parce que c'est l'outil que j'utilise, mais tu peux les appliquer ailleurs. Aucun partenariat avec Anthropic ou un autre éditeur.

### Ce que l'IA ne fait pas à ta place

L'IA rédige des premiers jets. Elle ne connaît pas ton client, ne signe rien, ne vérifie pas tes chiffres, et peut se tromper avec aplomb. **Tu relis tout ce qui part.** Elle ne remplace pas non plus un expert-comptable, un avocat ou ton organisme de recouvrement : pour toute question juridique ou fiscale qui te concerne personnellement, adresse-toi à un professionnel.

---

## Module 1 — Les fondations : ton dossier de contexte et tes règles de confidentialité

### Leçon 1.1 — Pourquoi l'IA te répond « à côté »

Quand tu demandes « écris un e-mail de relance pour une facture », l'IA ne sait pas :

- si tu tutoies ou vouvoies ce client ;
- si c'est la première relance ou la troisième ;
- quels sont tes délais de paiement contractuels ;
- si tu veux garder la relation ou si tu es prêt à la rompre ;
- comment tu signes tes e-mails.

Elle comble ces trous avec des moyennes : un ton corporate, des formules toutes faites (« Je me permets de revenir vers vous… »), une longueur excessive. Le résultat n'est pas faux, il est générique. Tu passes alors dix minutes à le réécrire, et tu conclus que « l'IA, ça ne fait pas gagner de temps ».

La solution n'est pas un meilleur prompt à chaque fois. C'est un **contexte permanent** que tu donnes une fois et que tu réutilises.

### Leçon 1.2 — Construire ton dossier de contexte

Ton dossier de contexte est un texte d'une page qui décrit ton activité. Selon l'outil, tu le colles en début de conversation, tu le places dans les instructions d'un espace de travail dédié, ou tu le joins comme fichier. Le principe reste identique.

Voici le modèle. Remplis chaque ligne, même brièvement.

```text
# MON CONTEXTE D'INDÉPENDANT

## Qui je suis
- Prénom : [Prénom]
- Métier : [ex. graphiste spécialisé en identité visuelle pour restaurants]
- Statut : [ex. micro-entrepreneur, franchise en base de TVA]
- Ancienneté : [ex. 4 ans d'activité]

## Mes clients
- Type : [ex. restaurateurs indépendants, 1 à 3 établissements]
- Ce qu'ils veulent : [ex. une identité cohérente, livrée vite, sans jargon]
- Ce qui les agace : [ex. les allers-retours interminables, les devis flous]

## Mes offres et tarifs
- [Offre 1] : [prix] — [ce qui est inclus]
- [Offre 2] : [prix] — [ce qui est inclus]
- Hors périmètre facturé : [ex. 60 € HT/h, ou "sur devis"]

## Mes conditions
- Acompte : [ex. 30 % à la signature]
- Délai de paiement : [ex. 30 jours à réception de facture]
- Nombre d'allers-retours inclus : [ex. 2 séries de corrections]
- Délai de réponse habituel : [ex. sous 48 h ouvrées]

## Mon style d'écriture
- Tutoiement ou vouvoiement par défaut : [ex. vouvoiement, sauf si le client tutoie]
- Ton : [ex. direct, chaleureux, phrases courtes, pas de formules administratives]
- Formules que je n'utilise jamais : ["Je me permets de", "N'hésitez pas à", "Cordialement" seul]
- Signature : [ex. "Belle journée, Camille"]

## Consignes permanentes
- Rédige en français.
- Fais court : un e-mail client tient en 120 mots maximum sauf demande contraire.
- Si une information manque pour bien répondre, pose-moi la question au lieu d'inventer.
- Ne mentionne jamais de chiffre, de date ou de montant que je ne t'ai pas donné.
- Propose une seule version, sauf si je demande des variantes.
```

**Pourquoi ces lignes comptent :**

- « Pose-moi la question au lieu d'inventer » réduit nettement les montants et dates fantaisistes.
- « Formules que je n'utilise jamais » est plus efficace que « écris de façon naturelle ». L'IA comprend mieux les interdits concrets que les adjectifs vagues.
- La longueur maximale évite les pavés.

### Leçon 1.3 — Les règles de confidentialité des données clients

C'est la partie que beaucoup d'indépendants sautent. Elle est pourtant décisive : tes clients te confient des informations, et tu as des obligations, notamment au titre du RGPD dès que tu traites des données personnelles. L'objectif ici n'est pas de te donner un avis juridique, mais une hygiène de travail simple.

**Règle 1 — Lis les conditions de ton outil.** Avant d'y coller quoi que ce soit, vérifie dans les paramètres et la politique de confidentialité de ton assistant : les conversations servent-elles à entraîner les modèles ? Peux-tu le désactiver ? Combien de temps sont-elles conservées ? Les offres grand public, professionnelles et entreprise n'ont pas toujours les mêmes règles, et elles évoluent. Note la réponse et la date de vérification dans ton dossier de contexte.

**Règle 2 — Anonymise par défaut.** Remplace les éléments identifiants avant de coller un texte :

| Donnée réelle | Remplacement |
|---|---|
| Nom du client | [CLIENT] ou un prénom fictif |
| Nom de l'entreprise | [SOCIÉTÉ] |
| Adresse, téléphone, e-mail | supprimés |
| Numéro de facture, IBAN | [N° FACTURE], jamais d'IBAN |
| Montants sensibles | gardés si nécessaires au texte, sinon [MONTANT] |

Tu remets les vraies valeurs à la main dans le texte final. Ça prend trente secondes et ça règle 90 % des risques.

**Règle 3 — Jamais de données sensibles.** Ne colle jamais : données de santé (si tu es thérapeute, coach sportif, praticien), numéros de sécurité sociale, coordonnées bancaires, mots de passe, pièces d'identité, documents couverts par un accord de confidentialité (NDA) sans l'accord du client.

**Règle 4 — Lis ton contrat client.** Certains contrats interdisent explicitement l'usage d'outils tiers ou d'IA sur les documents du client. Dans ce cas, l'IA peut t'aider sur la forme générique (un modèle de compte rendu vide), pas sur le contenu.

**Règle 5 — Sois transparent quand c'est pertinent.** Tu n'as pas à annoncer que tu utilises un correcteur ou une IA pour un e-mail. Mais si un client te demande comment tu travailles, ou si un livrable important a été largement produit avec l'IA, l'honnêteté protège la relation.

Pour aller plus loin sur tes obligations, la CNIL publie des guides pratiques pour les indépendants et TPE : **cnil.fr**.

### Leçon 1.4 — Le prompt d'anonymisation

Si tu as un long texte à nettoyer, tu peux faire l'anonymisation à la main avec la fonction « rechercher et remplacer » de ton traitement de texte. C'est la méthode la plus sûre, car le texte original ne sort pas de ton ordinateur.

Pour vérifier que tu n'as rien oublié, tu peux ensuite coller **le texte déjà nettoyé** avec ce prompt :

```text
Voici un texte que j'ai anonymisé avant de te le confier.
Relis-le et liste-moi tout élément qui pourrait encore permettre
d'identifier une personne ou une entreprise : nom, prénom, ville
précise, date de naissance, numéro, nom de produit unique, détail
très spécifique.
Ne réécris pas le texte. Donne-moi seulement une liste à puces
des éléments à vérifier, avec la phrase où ils apparaissent.

[TEXTE ANONYMISÉ]
```

**Exemple de résultat attendu :**

> - « notre boutique de la rue des Carmes » : nom de rue précis, combiné à la ville peut identifier le client.
> - « depuis l'ouverture en mars 2019 » : date d'ouverture, peut identifier l'établissement.
> - Aucun nom de personne détecté.

### Exemple — Camille, graphiste

Camille a rempli son dossier en vingt minutes. Elle a ajouté une ligne qu'elle n'avait pas prévue : « Mes clients sont des restaurateurs, ils lisent leurs e-mails sur téléphone entre deux services : pas plus de 5 lignes par paragraphe. » Cette seule consigne a changé la qualité de tous les e-mails produits ensuite.

### Exercice du module 1

1. Remplis le modèle de dossier de contexte. Vise une page, pas plus.
2. Vérifie les paramètres de confidentialité de ton outil IA. Note ce que tu as trouvé et la date.
3. Teste ton dossier : colle-le, puis demande « Écris un e-mail court pour confirmer un rendez-vous jeudi à 10 h. » Compare avec le même prompt sans dossier.

### Modèle à copier — Mémo confidentialité (à garder près de ton écran)

```text
AVANT DE COLLER QUOI QUE CE SOIT :
[ ] Noms, sociétés, coordonnées remplacés
[ ] Aucun IBAN, mot de passe, numéro d'identité
[ ] Aucune donnée de santé
[ ] Le contrat du client n'interdit pas l'usage d'outils tiers
[ ] Je relirai et remettrai les vraies valeurs à la main
```

---

## Module 2 — Les e-mails clients : répondre vite, juste, sans y passer la soirée

### Leçon 2.1 — La méthode « intention, faits, ton »

Un bon e-mail client assisté par IA tient en trois informations que tu donnes toi-même :

1. **L'intention** : ce que tu veux obtenir (accepter, refuser, recadrer, rassurer, demander une info).
2. **Les faits** : ce qui s'est passé, avec les dates et montants exacts.
3. **Le ton** : la relation que tu veux préserver (client fidèle, prospect froid, client qui dépasse les bornes).

L'IA s'occupe de la formulation. Toi, tu fournis le fond. C'est la répartition qui marche.

### Leçon 2.2 — Le prompt universel de réponse client

```text
[Dossier de contexte collé au-dessus ou déjà en mémoire]

Rédige une réponse à cet e-mail client.

Intention : [ex. refuser poliment une demande de modification gratuite
et proposer un devis complémentaire]
Faits :
- [ex. Le devis signé incluait 2 séries de corrections, déjà utilisées.]
- [ex. La nouvelle demande : changer la palette de couleurs.]
- [ex. Estimation : une demi-journée, soit 240 € HT.]
Ton : [ex. cordial et ferme, le client est sympathique et je veux le garder]
Longueur : 100 mots maximum.

E-mail reçu :
"""
[COLLE L'E-MAIL ANONYMISÉ]
"""
```

**Exemple de résultat attendu :**

> Bonjour [Prénom],
>
> Merci pour votre retour, je comprends l'envie de tester une autre palette.
>
> Les deux séries de corrections prévues au devis ont été utilisées sur les versions précédentes. Ce changement représente une nouvelle étape de création : je l'estime à une demi-journée, soit 240 € HT.
>
> Si vous êtes d'accord, je vous envoie le devis complémentaire aujourd'hui et je m'y mets dès réception de votre accord.
>
> Belle journée,
> Camille

Remarque : les guillemets triples `"""` délimitent clairement le texte à traiter. Ça évite que l'IA confonde l'e-mail du client avec tes instructions.

### Leçon 2.3 — Les cinq situations délicates et leurs prompts

**1. Le retard de ta part**

```text
Rédige un e-mail pour prévenir un client d'un retard de livraison.
Faits : livraison prévue le [date], nouvelle date réaliste [date].
Cause : [cause réelle, en une phrase, sans dramatiser].
Je veux : reconnaître le retard sans m'excuser trois fois, donner
la nouvelle date, proposer une compensation simple [ex. livrer
une première partie dès vendredi].
Ton : responsable et calme. 90 mots maximum.
```

**2. Le changement de périmètre (« tant que tu y es… »)**

```text
Un client demande un travail supplémentaire hors devis, présenté
comme un petit détail.
Demande : [description].
Mon estimation : [temps] soit [montant].
Rédige une réponse qui : valorise la demande, explique en une phrase
que c'est hors périmètre, propose deux options (devis complémentaire
ou report à une phase 2). Ton : positif, aucune culpabilisation.
80 mots maximum.
```

**3. Le refus d'une mission**

```text
Rédige un e-mail pour refuser une mission.
Raison réelle : [ex. budget trop bas / hors de ma spécialité / planning plein].
Raison que je veux donner : [ex. planning plein jusqu'en [mois]].
Je veux : laisser la porte ouverte, et si possible recommander
[nom d'un confrère ou "un confrère" sans nom].
70 mots maximum.
```

**4. Le client mécontent**

```text
Un client exprime son mécontentement. Avant de rédiger, analyse
son e-mail et dis-moi en 3 puces :
1. Ce qu'il reproche concrètement (faits).
2. Ce qu'il ressent (émotion).
3. Ce qu'il attend probablement (demande implicite).
Ensuite seulement, propose une réponse qui reconnaît le point 2,
répond factuellement au point 1 et propose une action précise pour
le point 3. Ne promets rien que je n'ai pas validé : marque [À
VALIDER] devant toute proposition de geste commercial.

E-mail :
"""
[E-MAIL ANONYMISÉ]
"""
```

Ce prompt en deux temps est important : il te force à comprendre avant de répondre, et la mention `[À VALIDER]` t'empêche d'envoyer une remise que tu n'as pas décidée.

**5. La demande d'information floue**

```text
Un prospect m'envoie une demande vague. Rédige une réponse courte
qui le remercie et lui pose les 4 questions indispensables pour que
je puisse chiffrer : [ex. objectif, délai, budget indicatif,
existant]. Présente les questions en liste numérotée, faciles
à répondre depuis un téléphone. 80 mots maximum.
```

### Leçon 2.4 — Améliorer ce que tu as déjà écrit

Souvent, tu as déjà écrit ton e-mail, mais il ne te plaît pas. Plutôt que de demander une réécriture complète, demande une correction ciblée :

```text
Voici mon brouillon. Ne le réécris pas entièrement.
1. Corrige les fautes.
2. Supprime les phrases inutiles.
3. Signale-moi (sans les changer) les passages qui pourraient être
   mal interprétés par le client.
Garde mon ton et mes expressions.

"""
[TON BROUILLON]
"""
```

Tu gardes ta voix, tu gagnes en clarté.

### Leçon 2.5 — Les erreurs fréquentes

- **Envoyer sans relire.** L'IA peut inventer un détail (« comme convenu lors de notre appel de mardi ») qui n'a jamais existé. Relis chaque phrase contenant un fait.
- **Laisser passer les formules creuses.** Si tu vois « N'hésitez pas à revenir vers moi pour toute question », supprime-la ou ajoute-la à tes interdits.
- **Copier-coller tout le fil d'échange.** Ne colle que le dernier message utile et résume le reste en deux lignes. Moins de données exposées, meilleure réponse.
- **Demander dix variantes.** Une bonne version vaut mieux que dix moyennes. Si elle ne va pas, dis précisément pourquoi.

### Exercice du module 2

Prends les trois e-mails qui traînent dans ta boîte depuis plus de deux jours. Pour chacun : anonymise, utilise le prompt universel, relis, remets les vraies valeurs, envoie. Note le temps passé.

### Modèle à copier — Itération rapide

Quand le premier jet ne va pas, utilise ces relances courtes plutôt que de tout réexpliquer :

```text
Plus court : 50 mots maximum.
```
```text
Plus ferme, sans être sec. Retire les excuses.
```
```text
Moins formel : écris comme si je parlais à un client que je connais
depuis deux ans.
```
```text
La deuxième phrase est fausse : [correction]. Corrige uniquement ça.
```

---

## Module 3 — Devis et propositions commerciales : de l'appel au document en 20 minutes

### Leçon 3.1 — Ce que l'IA fait bien et ce qu'elle ne doit pas faire

**L'IA fait bien :** structurer tes notes d'appel, reformuler le besoin du client avec ses mots, rédiger la partie « compréhension du projet », découper une mission en étapes, proposer des options (basique, standard, complète), relire pour repérer les ambiguïtés.

**L'IA ne doit pas faire :** fixer tes prix, calculer seule les totaux sans vérification, inventer des mentions légales. Les devis et factures ont des mentions obligatoires qui dépendent de ton statut et de ton activité. Pour la liste à jour, consulte **service-public.fr** (rubrique « Devis » et « Facturation ») ou ton expert-comptable. Ton logiciel de facturation les gère en général : c'est lui qui produit le document officiel, l'IA prépare le contenu.

### Leçon 3.2 — Des notes d'appel au brief structuré

Après un appel de découverte, tu as des notes en vrac. Colle-les (anonymisées) avec ce prompt :

```text
Voici mes notes brutes d'un appel de découverte avec un prospect.
Transforme-les en brief structuré avec ces rubriques :
1. Contexte du client (3 lignes max)
2. Problème à résoudre, avec ses mots à lui si possible
3. Objectif mesurable s'il en a donné un (sinon écris "non précisé")
4. Livrables attendus
5. Contraintes (délai, budget, technique, validation)
6. Questions restées sans réponse
N'invente rien. Si une rubrique est vide, écris "à demander".

Notes :
"""
[NOTES ANONYMISÉES]
"""
```

**Exemple de résultat attendu (extrait) :**

> **2. Problème à résoudre** — « On a l'air d'un kebab alors qu'on fait de la cuisine du marché » : l'identité actuelle ne reflète pas le positionnement.
> **3. Objectif mesurable** — non précisé.
> **6. Questions restées sans réponse** — Budget indicatif ; qui valide (le gérant seul ou avec son associé ?) ; date de réouverture après travaux.

La rubrique 6 est la plus précieuse : elle te dit quoi demander avant de chiffrer.

### Leçon 3.3 — Rédiger la proposition

Une proposition qui convainc suit en général cet ordre : ce que j'ai compris, ce que je propose, comment ça se passe, combien ça coûte, ce qu'il faut faire pour commencer.

```text
À partir de ce brief, rédige une proposition commerciale.
Structure :
1. "Ce que j'ai compris" : reformule le besoin en 4 à 6 lignes,
   avec les mots du client.
2. "Ce que je vous propose" : trois options.
   - Option A : [périmètre] — [prix que je fixe]
   - Option B : [périmètre] — [prix]
   - Option C : [périmètre] — [prix]
   Pour chaque option : livrables, délai, ce qui n'est pas inclus.
3. "Comment on travaille" : étapes numérotées avec durée.
4. "Conditions" : reprends mes conditions du dossier de contexte.
5. "Pour démarrer" : l'action exacte attendue du client.
Ne modifie aucun prix. Ne rajoute aucun livrable que je n'ai pas
listé. Ton : clair, sans superlatifs.

Brief :
"""
[BRIEF]
"""
```

Pourquoi trois options ? Elle laisse le client choisir entre plusieurs « oui » au lieu de choisir entre oui et non. Mais c'est **toi** qui fixes le périmètre et le prix de chaque option.

### Leçon 3.4 — La relecture « avocat du diable »

Avant d'envoyer, demande à l'IA de chercher les failles :

```text
Relis cette proposition comme un client prudent qui veut éviter
les mauvaises surprises. Liste :
- les formulations ambiguës qui pourraient créer un désaccord
  (ex. "corrections illimitées", "livraison rapide") ;
- ce qui n'est pas clairement exclu du périmètre ;
- les questions qu'il me poserait avant de signer.
Ne réécris pas. Donne une liste numérotée, du plus important
au moins important.
```

**Exemple de résultat attendu :**

> 1. « Déclinaison sur les supports principaux » : quels supports ? Le client pourrait inclure les enseignes extérieures.
> 2. Rien n'indique qui fournit les photos des plats.
> 3. Le délai de 3 semaines démarre à quelle date : signature ou réception de l'acompte ?

Chaque point corrigé ici est un litige évité plus tard.

### Leçon 3.5 — Vérifier les calculs

Si ta proposition contient des quantités et des totaux, ne fais pas confiance au calcul de l'IA sans contrôle. Deux options :

- Fais le calcul dans ton tableur ou ton logiciel de facturation (recommandé).
- Demande à l'IA de **montrer** son calcul ligne par ligne, puis vérifie-le :

```text
Recalcule le total de cette proposition en montrant chaque ligne :
quantité × prix unitaire = sous-total, puis la somme.
Signale tout écart avec le total que j'ai indiqué.
```

### Exercice du module 3

Reprends ton dernier appel de découverte (ou le prochain). Transforme tes notes en brief, puis en proposition à trois options, puis passe la relecture « avocat du diable ». Corrige au moins deux points avant d'envoyer.

### Modèle à copier — Paragraphe de périmètre

```text
Inclus : [liste].
Non inclus : [liste], qui pourront faire l'objet d'un devis
complémentaire.
Corrections : [nombre] séries de corrections sont incluses.
Au-delà, chaque série est facturée [montant ou "sur devis"].
Démarrage : à réception du devis signé et de l'acompte de [X] %.
```

---

## Module 4 — Relances de factures : récupérer ton argent sans abîmer la relation

### Leçon 4.1 — Pourquoi on ne relance pas (et pourquoi c'est un problème)

Relancer une facture est inconfortable : peur de paraître pressant, peur de perdre le client. Résultat, beaucoup d'indépendants attendent trop longtemps. Or une facture se règle plus difficilement à mesure qu'elle vieillit. L'IA t'aide ici sur un point précis : supprimer la friction de l'écriture. Une fois les trois modèles prêts, relancer prend deux minutes.

### Leçon 4.2 — Le rappel du cadre légal (à vérifier)

Entre professionnels en France, les délais de paiement, les pénalités de retard et l'indemnité forfaitaire pour frais de recouvrement sont encadrés par le Code de commerce. Ces mentions doivent figurer sur tes factures et conditions générales. Le montant de l'indemnité forfaitaire et le mode de calcul des pénalités sont définis par les textes : **vérifie les montants en vigueur sur service-public.fr** (fiche « Retard de paiement entre entreprises ») ou economie.gouv.fr avant de les citer.

Pour les clients particuliers, les règles sont différentes : renseigne-toi sur service-public.fr ou auprès d'un professionnel.

Cette masterclass ne te dit pas quand appliquer des pénalités : c'est une décision commerciale et parfois juridique qui t'appartient.

### Leçon 4.3 — La séquence en trois niveaux

| Niveau | Quand | Ton | Objectif |
|---|---|---|---|
| 1. Rappel | J+3 après l'échéance | Neutre, bienveillant | Signaler un oubli |
| 2. Relance | J+15 | Direct, factuel | Obtenir une date de paiement |
| 3. Mise en demeure amiable | J+30 | Ferme, formel | Dernière étape avant recours |

Ces délais sont des repères : adapte-les à tes conditions et à ta relation client.

### Leçon 4.4 — Les trois prompts

**Niveau 1 — Rappel**

```text
Rédige un rappel de paiement de niveau 1.
Faits : facture [N° FACTURE] du [date], montant [montant],
échéance dépassée depuis [X] jours.
Ton : neutre et bienveillant, on part du principe d'un oubli.
Je veux : rappeler les références, joindre la facture
(mentionne "ci-joint"), demander une confirmation de la date
de règlement. Pas de mention de pénalités.
60 mots maximum. Objet de l'e-mail inclus.
```

**Exemple de résultat attendu :**

> **Objet : Facture [N°] — petit rappel**
>
> Bonjour [Prénom],
>
> Sauf erreur de ma part, la facture [N°] du [date], d'un montant de [montant], arrivait à échéance le [date]. Je vous la remets ci-jointe.
>
> Pouvez-vous me confirmer la date de règlement prévue ?
>
> Merci et belle journée,
> Camille

**Niveau 2 — Relance**

```text
Rédige une relance de paiement de niveau 2.
Faits : facture [N°] du [date], montant [montant], échéance
dépassée de [X] jours, rappel envoyé le [date] resté sans réponse.
Ton : direct et factuel, sans agressivité.
Je veux : rappeler les faits, demander une date de paiement
précise sous [5] jours ouvrés, proposer un échange téléphonique
si une difficulté existe.
Mentionne que mes conditions prévoient des pénalités de retard,
sans en citer le montant.
90 mots maximum. Objet inclus.
```

**Niveau 3 — Mise en demeure amiable**

```text
Rédige un e-mail de dernière relance avant mise en demeure.
Faits : facture [N°] du [date], montant [montant], échéance
dépassée de [X] jours, relances du [date] et du [date] sans
réponse (ou réponse : [résumé]).
Ton : ferme, formel, vouvoiement, aucune émotion.
Je veux : rappeler l'historique, fixer un délai de règlement
de [8] jours, indiquer qu'à défaut j'engagerai les démarches
de recouvrement prévues par la loi.
Ne cite aucun article de loi ni aucun montant de pénalité :
je les ajouterai moi-même après vérification.
120 mots maximum. Objet inclus.
```

Note la dernière consigne : c'est toi qui ajoutes les références légales vérifiées. L'IA peut citer un article inexact ou un montant périmé.

### Leçon 4.5 — Quand le client répond

Un client répond souvent par une difficulté : « On a un souci de trésorerie », « La facture n'est pas arrivée au bon service ». Prompt pour répondre :

```text
Mon client répond à ma relance : """[réponse anonymisée]"""
Je suis prêt à : [ex. accepter un paiement en 2 fois sur 30 jours
/ renvoyer la facture au bon contact / rien de plus].
Rédige une réponse qui accepte [ce que j'accepte], fixe les dates
précises par écrit, et demande une confirmation explicite.
80 mots maximum.
```

Fixer les dates par écrit est la clé : un accord oral se discute, un e-mail confirmé se retrouve.

### Leçon 4.6 — Le tableau de suivi

L'IA peut t'aider à tenir un suivi simple. Tu peux lui coller une liste (anonymisée) et lui demander quoi faire aujourd'hui :

```text
Voici mes factures en attente au [date du jour] :
- F-012 · [CLIENT A] · 1 200 € · échéance 02/10 · rappel envoyé 06/10
- F-015 · [CLIENT B] · 450 € · échéance 10/10 · aucune relance
- F-016 · [CLIENT C] · 800 € · échéance 30/10 · —
Ma séquence : rappel J+3, relance J+15, dernière relance J+30.
Dis-moi pour chaque facture : l'action à faire aujourd'hui
(ou "rien"), et la date de la prochaine action.
Présente le résultat en tableau.
```

**Exemple de résultat attendu :**

| Facture | Action aujourd'hui (15/10) | Prochaine action |
|---|---|---|
| F-012 | Relance niveau 2 (J+13 : à envoyer le 17/10) → rien aujourd'hui | 17/10 |
| F-015 | Rappel niveau 1 (J+5, en retard) | 25/10 relance niveau 2 |
| F-016 | Rien, pas encore échue | 02/11 rappel si impayée |

Vérifie toujours les dates : les calculs de jours sont une source d'erreur classique des IA. Ton logiciel de facturation peut aussi faire ce suivi automatiquement.

### Exercice du module 4

1. Génère tes trois modèles de relance. Relis-les, adapte-les, enregistre-les dans ton logiciel de messagerie comme modèles.
2. Liste tes factures en attente. Envoie aujourd'hui les relances dues.
3. Vérifie que tes factures portent bien les mentions sur les pénalités de retard (source : service-public.fr).

### Modèle à copier — Phrase de clôture ferme et polie

```text
Sans règlement ou retour de votre part d'ici le [date], je serai
contraint(e) d'engager les démarches de recouvrement prévues.
Je préfère évidemment que nous trouvions une solution ensemble
d'ici là.
```

---

## Module 5 — Comptes rendus de réunion : clairs, actionnables, envoyés le jour même

### Leçon 5.1 — Le compte rendu qui sert vraiment

Un compte rendu utile ne raconte pas la réunion. Il répond à trois questions : **qu'est-ce qui a été décidé, qui fait quoi, pour quand.** Envoyé le jour même, il devient la référence commune et évite les « je croyais qu'on avait dit… ».

### Leçon 5.2 — Tes sources : notes ou transcription

- **Notes manuscrites ou tapées** : le plus simple. Tape-les en vrac juste après la réunion, même en style télégraphique.
- **Transcription automatique** : certains outils de visioconférence ou applications d'enregistrement en produisent. **Demande toujours l'accord des participants avant d'enregistrer.** Une transcription contient souvent des noms et des propos personnels : anonymise ou résume avant de la coller dans un assistant IA, ou vérifie que ton contrat et ton outil le permettent.

### Leçon 5.3 — Le prompt de compte rendu

```text
Voici mes notes brutes d'une réunion avec un client.
Rédige un compte rendu avec cette structure :

**Réunion du [date] — [objet]**
Participants : [rôles, pas de noms complets]

1. Décisions prises (liste)
2. Actions : tableau avec colonnes Action | Responsable | Échéance
3. Points en suspens (à trancher plus tard)
4. Prochaine étape / prochaine réunion

Règles :
- N'ajoute aucune décision qui n'est pas clairement dans mes notes.
- Si une action n'a pas de responsable ou d'échéance, écris
  "à définir" : ne devine pas.
- Phrases courtes, pas de récit chronologique.

Notes :
"""
[NOTES]
"""
```

**Exemple de résultat attendu :**

> **Réunion du 14/10 — Validation des pistes de logo**
> Participants : gérant, associée, graphiste
>
> **1. Décisions prises**
> - La piste 2 (typographie manuscrite) est retenue.
> - La couleur terracotta est conservée, le vert est abandonné.
>
> **2. Actions**
>
> | Action | Responsable | Échéance |
> |---|---|---|
> | Décliner la piste 2 en 3 variantes | Graphiste | 21/10 |
> | Envoyer les photos du lieu | Associée | à définir |
>
> **3. Points en suspens** — Faut-il intégrer le nom du chef au logo ?
>
> **4. Prochaine étape** — Présentation des variantes le 22/10.

### Leçon 5.4 — L'e-mail d'envoi

```text
Rédige un e-mail court pour envoyer ce compte rendu au client.
Je veux : remercier en une phrase, rappeler les 2 décisions
principales, mettre en avant l'action qui l'attend lui
(avec la date), demander de signaler toute erreur sous 48 h.
70 mots maximum.
```

La phrase « signalez-moi toute erreur sous 48 h » fait du compte rendu une référence validée par silence. Pratique en cas de désaccord ultérieur.

### Leçon 5.5 — Les comptes rendus internes et les notes pour toi

Le même prompt sert pour tes propres notes : appel avec un fournisseur, point avec un partenaire, réflexion stratégique. Variante utile :

```text
Transforme ces notes en fiche de suivi pour moi seul :
- ce que j'ai appris,
- ce que je dois faire (avec une date proposée),
- ce que je dois surveiller.
Format télégraphique, 10 lignes maximum.
```

### Exercice du module 5

Après ta prochaine réunion client, chronomètre : notes en vrac (5 min), compte rendu avec le prompt (5 min), relecture et envoi (5 min). Objectif : l'envoyer avant la fin de la journée.

### Modèle à copier — Mini-compte rendu pour un appel court

```text
Suite à notre échange de ce jour :
- Décidé : [ ]
- Je m'occupe de : [ ] d'ici le [ ]
- Vous vous occupez de : [ ] d'ici le [ ]
- Prochain point : [ ]
Dites-moi si j'ai oublié quelque chose.
```

---

## Module 6 — Organiser ta semaine avec l'IA

### Leçon 6.1 — L'IA comme partenaire de planification, pas comme agenda

L'IA ne connaît pas ton énergie, tes imprévus, ni tes priorités réelles. Elle est en revanche très bonne pour **trier une liste en vrac**, **estimer** grossièrement, **repérer** les surcharges et **proposer** un plan que tu ajustes. Ton agenda reste ton outil de référence.

### Leçon 6.2 — La vidange du dimanche (ou du lundi matin)

Étape 1 : écris tout ce qui te passe par la tête, sans ordre, pendant 10 minutes. Tâches clients, admin, perso, idées. Étape 2 : colle avec ce prompt.

```text
Voici tout ce que j'ai en tête pour la semaine, en vrac.
Ma semaine : [ex. 4 jours travaillés, lundi au jeudi, 9 h - 17 h,
mercredi après-midi bloqué].
Engagements fixes : [ex. réunion client mardi 10 h, appel jeudi 14 h].

Fais ceci :
1. Classe chaque élément : Client (facturable) / Commercial /
   Admin / Perso / Idée à garder pour plus tard.
2. Pour chaque tâche, estime une durée (15 min, 30 min, 1 h,
   2 h, demi-journée). Marque "?" si tu ne peux pas estimer.
3. Identifie les 3 priorités de la semaine selon ce critère :
   [ex. ce qui débloque un paiement ou un client en attente].
4. Propose une répartition par jour, en gardant 20 % de marge
   libre chaque jour pour les imprévus.
5. Dis-moi clairement si la semaine est surchargée et ce que
   tu proposerais de reporter.

Liste :
"""
[TA LISTE EN VRAC]
"""
```

**Exemple de résultat attendu (extrait) :**

> **Semaine surchargée** : environ 31 h de tâches estimées pour 22 h disponibles après marge. Je propose de reporter : refonte de ton site (idée, 1 journée), tri des photos (perso), article de blog (commercial, non urgent).
>
> **Lundi** — Relance F-015 (15 min) · Déclinaisons logo [CLIENT A] (demi-journée) · Répondre au prospect [B] (30 min)

Le point 5 est le plus utile : l'IA dit souvent ce que tu refuses de voir.

### Leçon 6.3 — Les blocs d'admin

Regroupe les petites tâches administratives dans un ou deux créneaux fixes par semaine (par exemple mardi et vendredi, 1 h). Dans ce créneau, tu enchaînes : relances (module 4), e-mails en attente (module 2), comptes rendus en retard (module 5). Les prompts sont prêts, la friction disparaît.

Prompt pour préparer le bloc :

```text
J'ai un bloc admin de 60 minutes. Voici mes tâches en attente :
[liste]. Ordonne-les pour finir en premier ce qui débloque de
l'argent ou un client, et regroupe les tâches similaires.
Donne-moi une liste minutée.
```

### Leçon 6.4 — La revue du vendredi

Quinze minutes en fin de semaine pour apprendre de ta semaine :

```text
Voici ce que j'avais prévu cette semaine : [plan].
Voici ce que j'ai réellement fait : [liste].
Pose-moi 3 questions pour m'aider à comprendre les écarts,
puis, après mes réponses, propose UN seul ajustement concret
pour la semaine prochaine.
```

Ce format question-réponse est plus utile qu'un bilan automatique : c'est toi qui trouves la cause, l'IA te pose les bonnes questions.

### Leçon 6.5 — Construire tes routines réutilisables

Au bout de deux ou trois semaines, tu verras revenir les mêmes demandes. Transforme-les en « routines » : un prompt enregistré, avec son déclencheur.

| Déclencheur | Routine | Module |
|---|---|---|
| Nouvel e-mail délicat | Prompt universel de réponse | 2 |
| Fin d'appel de découverte | Notes → brief → proposition | 3 |
| Mardi et vendredi, bloc admin | Tableau de suivi des factures | 4 |
| Fin de réunion | Compte rendu + e-mail d'envoi | 5 |
| Lundi matin | Vidange et plan de semaine | 6 |
| Vendredi 16 h | Revue de semaine | 6 |

Si ton outil propose un espace de travail avec instructions permanentes (souvent appelé « projet »), crée un espace « Admin » avec ton dossier de contexte et ces routines. Sinon, garde tout dans un document que tu ouvres à côté.

### Exercice du module 6

Lundi prochain, fais la vidange et le plan. Vendredi, fais la revue. Ajuste ton dossier de contexte avec ce que tu as appris (par exemple : « je sous-estime toujours les tâches de création, multiplie par 1,5 »).

### Modèle à copier — Ta semaine type

```text
Lundi    : 9 h - 9 h 30 plan de semaine · reste : production client
Mardi    : 9 h - 10 h bloc admin · reste : production client
Mercredi : production client / commercial
Jeudi    : production client · 16 h prospection ou contenu
Vendredi : 9 h - 10 h bloc admin · 16 h revue de semaine
```

---

## Checklist finale

Coche chaque ligne quand c'est fait, pas quand c'est compris.

**Fondations**
- [ ] Mon dossier de contexte est rempli (1 page) et testé.
- [ ] J'ai vérifié les paramètres de confidentialité de mon outil IA (date notée).
- [ ] Mon mémo confidentialité est à portée de main.
- [ ] J'anonymise systématiquement avant de coller.

**E-mails**
- [ ] J'ai enregistré le prompt universel et les 5 prompts de situations délicates.
- [ ] J'ai traité au moins 3 e-mails en attente avec la méthode.

**Devis et propositions**
- [ ] J'ai transformé au moins un appel en brief puis en proposition.
- [ ] J'ai fait la relecture « avocat du diable » avant envoi.
- [ ] Mes totaux sont calculés par mon logiciel ou vérifiés ligne par ligne.
- [ ] Mes mentions obligatoires sont vérifiées sur service-public.fr ou avec mon comptable.

**Relances**
- [ ] Mes 3 modèles de relance sont enregistrés.
- [ ] Toutes mes factures en retard ont reçu l'action prévue.
- [ ] Mes factures portent les mentions sur les retards de paiement (vérifiées).

**Comptes rendus**
- [ ] J'ai envoyé au moins un compte rendu le jour même de la réunion.
- [ ] Je demande l'accord avant tout enregistrement.

**Organisation**
- [ ] J'ai fait une vidange et un plan de semaine.
- [ ] J'ai bloqué 2 créneaux admin par semaine dans mon agenda.
- [ ] J'ai fait une revue du vendredi.

**Relecture permanente**
- [ ] Je relis chaque fait, date et montant avant d'envoyer.

---

## Ressources

### Sources officielles (à consulter, les règles évoluent)

- **service-public.fr** — fiches entreprises : devis, facturation, mentions obligatoires, retards de paiement entre entreprises.
- **economie.gouv.fr** — délais de paiement, pénalités et indemnité forfaitaire.
- **cnil.fr** — RGPD pour les TPE et indépendants, guides pratiques.
- **urssaf.fr** et **autoentrepreneur.urssaf.fr** — si tu es micro-entrepreneur.

### Ta bibliothèque de prompts (récapitulatif)

| # | Prompt | Module |
|---|---|---|
| 1 | Dossier de contexte | 1 |
| 2 | Vérification d'anonymisation | 1 |
| 3 | Prompt universel de réponse client | 2 |
| 4 | Retard de ma part | 2 |
| 5 | Changement de périmètre | 2 |
| 6 | Refus de mission | 2 |
| 7 | Client mécontent (analyse puis réponse) | 2 |
| 8 | Demande floue → questions | 2 |
| 9 | Correction ciblée de brouillon | 2 |
| 10 | Notes d'appel → brief | 3 |
| 11 | Brief → proposition à 3 options | 3 |
| 12 | Relecture « avocat du diable » | 3 |
| 13 | Vérification des calculs | 3 |
| 14 | Relance niveau 1, 2, 3 | 4 |
| 15 | Réponse à une difficulté de paiement | 4 |
| 16 | Tableau de suivi des factures | 4 |
| 17 | Compte rendu de réunion | 5 |
| 18 | E-mail d'envoi du compte rendu | 5 |
| 19 | Fiche de suivi personnelle | 5 |
| 20 | Vidange et plan de semaine | 6 |
| 21 | Préparation du bloc admin | 6 |
| 22 | Revue du vendredi | 6 |

### Dernier conseil

Commence petit. Une seule routine bien installée (par exemple, les relances) vaut mieux que vingt prompts jamais utilisés. Ajoute la suivante quand la première est devenue un réflexe.
