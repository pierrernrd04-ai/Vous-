# L'IA pour agents immobiliers : annonces, relances, comptes rendus

*Une méthode pour rédiger plus vite tes annonces, tes relances et tes comptes rendus avec un assistant IA, sans inventer une ligne sur le bien et sans exposer tes clients.*

> **À lire avant de commencer.** L'IA rédige vite, mais elle se trompe et elle invente. Tout ce qu'elle produit doit être relu et vérifié par toi avant publication ou envoi : tu restes responsable de chaque annonce et de chaque message. Ce cours ne remplace ni un conseil juridique ni la réglementation : les mentions obligatoires évoluent, vérifie toujours la version en vigueur sur les sources officielles (service-public.fr, legifrance.gouv.fr) et auprès de ton réseau, de ta fédération ou de ton juriste. Enfin, **ne mets jamais de données personnelles sensibles dans un outil d'IA** : ni noms, ni coordonnées, ni situation financière, familiale ou de santé de tes clients.

---

## Introduction

### Pour qui

Cette masterclass s'adresse aux agents immobiliers, négociateurs salariés, agents commerciaux en immobilier, mandataires et gestionnaires locatifs qui passent trop de temps à écrire : annonces, relances, comptes rendus de visite, messages aux vendeurs, réponses aux demandes entrantes. Tu connais ton métier. Ce qui te manque, c'est du temps.

Elle convient aussi si tu as déjà testé un assistant IA et obtenu des annonces pleines de « lumineux », « coup de cœur assuré », « prestations de standing », parfois avec une terrasse qui n'existe pas. Le problème ne vient pas de l'outil : il vient de ce qu'on lui donne et de ce qu'on lui interdit.

### Ce que tu sauras faire à la fin

- Construire une **fiche bien** structurée, seule source autorisée pour l'IA, et un prompt qui lui interdit d'inventer.
- Rédiger une **annonce** en plusieurs formats (portail, site, réseaux sociaux, vitrine) et la contrôler avec une **checklist des mentions obligatoires** à vérifier sur la réglementation officielle.
- Écrire des **relances** adaptées à chaque situation : demande entrante, après visite, vendeur sans nouvelles, mandat à renouveler, acquéreur en recherche.
- Transformer tes notes de visite en **comptes rendus** clairs pour tes vendeurs, et produire un **reporting** régulier.
- Appliquer des **règles de confidentialité** concrètes avec l'IA.
- Monter ta **bibliothèque de prompts** et une routine hebdomadaire.

### Comment suivre

Lecture : 2 à 3 heures. Application : 2 à 4 semaines, sur tes vrais dossiers. Choisis dès maintenant **un bien en portefeuille** : tu feras tous les exercices dessus.

Les prompts sont dans des blocs à copier. Les passages `[entre crochets]` sont à remplacer. Ils fonctionnent avec la plupart des assistants conversationnels (Claude, ChatGPT, Le Chat, Gemini ou l'outil intégré à ton logiciel métier). Les noms et les fonctions de ces outils changent souvent : la méthode, elle, reste valable.

---

## Module 1 — La règle d'or : l'IA ne connaît que ta fiche

### Leçon 1.1 — Pourquoi l'IA invente

Un assistant IA produit le texte le plus probable. Si tu lui demandes « une annonce pour un T3 à Nantes », la suite la plus probable contient un balcon, une cuisine équipée, des transports à proximité. Ton T3 n'a peut-être rien de tout ça. L'IA n'a pas menti au sens humain : elle a comblé les trous avec du plausible.

Dans l'immobilier, ce plausible est dangereux. Une caractéristique inventée dans une annonce peut constituer une **pratique commerciale trompeuse** (Code de la consommation), te mettre en difficulté avec ton client, et te faire perdre du temps en visites inutiles. La règle est donc simple et non négociable :

**L'IA n'écrit que ce qui figure dans ta fiche. Tout le reste est interdit.**

### Leçon 1.2 — La fiche bien

Avant tout prompt, tu remplis une fiche factuelle. C'est ton travail d'agent, pas celui de l'IA. Modèle à copier dans ton outil de notes :

```
FICHE BIEN — [référence interne, pas l'adresse exacte]

TYPE : [maison / appartement / terrain / local]  —  TRANSACTION : [vente / location]
SECTEUR : [quartier ou commune, niveau de précision que tu acceptes de publier]
SURFACE : [x m²] — Type de surface : [loi Carrez / habitable / à vérifier]
PIÈCES : [nombre], dont chambres : [nombre]
ÉTAGE / NIVEAUX : [x / y], ascenseur : [oui / non]
EXTÉRIEURS : [balcon x m², terrasse, jardin x m², aucun]
STATIONNEMENT : [garage, place, aucun]
CHAUFFAGE : [type, individuel / collectif]
ANNÉE DE CONSTRUCTION : [si connue, sinon "non communiquée"]
ÉTAT : [à rafraîchir / bon état / rénové en [année], travaux réalisés : liste]
DPE : classe énergie [ ] — classe climat [ ] — estimation des dépenses annuelles d'énergie : [fourchette indiquée sur le DPE et année de référence des prix]
COPROPRIÉTÉ : [oui / non] — nombre de lots : [ ] — charges courantes annuelles moyennes (quote-part) : [ ] — procédure en cours : [oui / non]
PRIX : [x €] — honoraires : [montant ou %, à la charge de vendeur / acquéreur]
ATOUTS RÉELS CONSTATÉS : [liste factuelle : exposition, vue, calme constaté le jour de la visite…]
POINTS À SIGNALER : [ex. pas d'ascenseur au 4e, vis-à-vis, travaux de façade votés]
À NE PAS MENTIONNER : [ex. raison de la vente, situation du vendeur]
```

Trois remarques :
- Chaque information vient d'un **document** (titre de propriété, diagnostics, PV d'AG, mesurage) ou de **ton constat**. Si tu ne sais pas, écris « à vérifier » : l'IA ne doit pas deviner.
- La rubrique **Points à signaler** est volontaire : une annonce honnête attire des visites qualifiées.
- La rubrique **À ne pas mentionner** sert de garde-fou pour toi, mais même ces informations ne devraient pas être confiées à l'outil si elles sont personnelles (divorce, décès, difficultés financières). Écris simplement « ne pas évoquer la raison de la vente ».

### Leçon 1.3 — Le prompt garde-fou

Chaque fois que tu utilises la fiche, commence par ce cadre :

```
Tu es mon assistant de rédaction pour mon activité d'agent immobilier en France.

RÈGLES ABSOLUES :
1. Tu utilises UNIQUEMENT les informations de la fiche ci-dessous. Tu n'ajoutes aucune caractéristique, aucun équipement, aucune distance, aucun commerce ou transport, aucune surface, aucune qualité qui n'y figure pas.
2. Si une information utile manque, tu ne l'inventes pas : tu la listes à la fin sous "INFORMATIONS MANQUANTES".
3. Pas de superlatifs invérifiables ("exceptionnel", "unique", "coup de cœur assuré", "rare").
4. Pas de mention liée aux personnes (âge, origine, situation familiale, religion, handicap) ni de critère de sélection des acquéreurs ou locataires.
5. Les chiffres (surface, prix, honoraires, DPE, charges) sont recopiés à l'identique, sans arrondi.

FICHE :
"""
[colle ta fiche bien]
"""
```

La règle 4 vise aussi la **non-discrimination** : une annonce ne peut pas exclure ou cibler des personnes selon des critères discriminatoires (« idéal jeune couple », « pas d'étudiants »). Décris le bien, pas l'acheteur idéal.

### Leçon 1.4 — Le contrôle anti-invention

Après chaque texte produit, demande un contrôle croisé. Idéalement dans la même conversation, juste après :

```
Relis le texte que tu viens d'écrire et compare-le ligne par ligne à la fiche.
Présente un tableau à 3 colonnes : "Affirmation du texte" / "Présente dans la fiche ? (oui/non)" / "Correction proposée".
Liste toutes les affirmations, même les petites (lumineux, calme, proche de…).
```

Puis relis toi-même. Le contrôle de l'IA t'aide à repérer, il ne te dispense pas de vérifier : c'est ton nom et ta carte professionnelle qui figurent sur l'annonce.

### Exemple

Une négociatrice demande : « Rédige une annonce pour un T2 de 42 m² à Lyon 7e, 2e étage, 215 000 €. » L'annonce produite mentionne « un balcon agréable », « à deux pas du métro » et « une cuisine entièrement équipée ». Aucune de ces trois informations n'est vraie. Avec la fiche et le prompt garde-fou, l'IA écrit à la place une annonce sobre et ajoute en fin : « INFORMATIONS MANQUANTES : exposition, état de la cuisine, stationnement, chauffage. » Elle complète la fiche en 3 minutes et relance.

### Exercice

Choisis un bien en portefeuille. Remplis la fiche bien à partir de tes documents. Repère toutes les cases où tu as écrit « à vérifier » et vérifie-les avant de passer au module 2.

---

## Module 2 — Des annonces exactes, claires et conformes

### Leçon 2.1 — La structure d'une annonce efficace

Une annonce lisible suit souvent cet ordre :

1. **Titre** : type, surface, pièces, secteur, un atout factuel. Ex. : « Appartement T3 de 68 m² avec balcon, secteur gare ».
2. **Accroche** (1 à 2 phrases) : l'atout principal, factuel.
3. **Description** : parcours logique de la visite (entrée, pièces de vie, nuit, extérieurs, annexes).
4. **Environnement** : uniquement ce que tu as vérifié.
5. **Informations pratiques et mentions** : prix, honoraires, DPE, copropriété, etc.
6. **Contact et appel à l'action** : comment organiser une visite.

### Leçon 2.2 — Le prompt annonce principale

À la suite du prompt garde-fou :

```
Rédige l'annonce principale pour un portail immobilier.
- Titre : 70 caractères maximum, avec type, surface, nombre de pièces, secteur, et un atout tiré de la fiche.
- Accroche : 2 phrases maximum.
- Description : 150 à 220 mots, dans l'ordre de la visite, phrases courtes, vocabulaire concret (dimensions, exposition, matériaux si présents dans la fiche).
- Intègre honnêtement les "points à signaler" de la fiche, formulés de façon factuelle et non dévalorisante.
- Ton : professionnel, chaleureux, sans superlatif.
- Ne rédige PAS le bloc des mentions légales : je l'ajoute moi-même à partir de ma checklist.
Termine par la liste "INFORMATIONS MANQUANTES" si besoin.
```

Pourquoi ne pas faire rédiger les mentions légales ? Parce que l'IA peut se tromper sur leur contenu ou leur formulation, et que ton logiciel ou ton réseau a souvent un bloc standard validé. Tu gardes la main sur la partie réglementaire.

### Leçon 2.3 — Les mentions obligatoires : ta checklist à vérifier

La réglementation des annonces immobilières évolue régulièrement. La liste ci-dessous t'aide à **ne rien oublier**, mais elle ne remplace pas les textes : vérifie la version en vigueur sur **service-public.fr** (rubriques sur l'achat, la vente et la location d'un logement, et sur le diagnostic de performance énergétique), sur **legifrance.gouv.fr**, et auprès de ton réseau ou de ta fédération professionnelle.

Points habituellement à contrôler pour une **vente** :
- [ ] Le **prix** et les **honoraires** : à la charge de qui, et leur montant ou taux, présentés selon les règles d'affichage en vigueur (notamment prix honoraires inclus et exclus lorsque les honoraires sont à la charge de l'acquéreur).
- [ ] Les informations issues du **DPE** : classe énergie, classe climat (émissions de gaz à effet de serre), estimation des dépenses annuelles d'énergie et, selon le cas, les mentions spécifiques aux logements très énergivores. Vérifie les formulations exactes exigées.
- [ ] Pour un lot de **copropriété** : le fait que le bien est en copropriété, le nombre de lots, le montant moyen annuel des charges courantes (quote-part), et l'existence d'une procédure en cours le cas échéant.
- [ ] La **surface** (loi Carrez pour un lot de copropriété, selon les cas).
- [ ] L'information sur les **risques** (notamment le renvoi vers le site Géorisques lorsque c'est exigé).
- [ ] Les **mentions relatives à ton activité** exigées par ton statut (carte professionnelle, statut d'agent commercial, réseau…).

Points habituellement à contrôler pour une **location** :
- [ ] Loyer mensuel, charges (et leur mode de règlement), dépôt de garantie, honoraires à la charge du locataire (dont ceux de l'état des lieux).
- [ ] Surface habitable, caractère meublé ou non.
- [ ] Informations DPE.
- [ ] Dans les communes concernées par l'**encadrement des loyers** : loyer de référence, complément de loyer éventuel, et autres mentions exigées localement.

Garde cette liste dans ta bibliothèque, mets-la à jour dès qu'un texte change, et fais-la valider par ton réseau ou ton juriste.

Tu peux demander à l'IA un **contrôle de présence** (pas de contenu) :

```
Voici une annonce complète, mentions incluses, et ma checklist interne de mentions à vérifier.
Pour chaque point de la checklist, indique : "présent", "absent" ou "incertain", et cite la phrase concernée.
Ne juge pas la conformité juridique, ne propose pas de formulation légale : signale seulement ce qui semble manquer.
"""
ANNONCE : [annonce]
CHECKLIST : [ta checklist]
"""
```

### Leçon 2.4 — Décliner sur tous les supports

Une fois l'annonce validée, la déclinaison est un vrai gain de temps :

```
À partir de l'annonce validée ci-dessus (et uniquement d'elle), rédige :
1. Une version courte pour la vitrine de l'agence : 60 mots maximum, titre + 3 atouts + prix.
2. Une publication pour un réseau social professionnel ou grand public : 80 à 120 mots, une première ligne qui donne envie de lire, 3 atouts factuels, un appel à prendre rendez-vous, 3 hashtags descriptifs (ville, type de bien). Pas d'emoji ou 2 maximum.
3. Un texte de 30 secondes à lire à voix haute pour une vidéo de visite.
4. Un SMS de 300 caractères maximum pour les acquéreurs de mon fichier dont la recherche correspond.
Rappel : aucune information hors annonce. Les mentions obligatoires applicables à chaque support restent à vérifier par moi.
```

Attention : une publication sur les réseaux sociaux qui présente un bien avec un prix est aussi une annonce. Les mentions qui s'appliquent doivent être vérifiées sur chaque support, pas seulement sur le portail.

### Leçon 2.5 — Photos et visuels

Certains outils proposent la **retouche** ou l'**ameublement virtuel** (home staging virtuel). Règles de prudence :
- Ne modifie jamais un élément du bien (fissure, vue, taille d'une pièce, état d'un sol).
- Signale clairement une image retouchée ou meublée virtuellement (« image non contractuelle, ameublement virtuel »), et garde la photo réelle à côté.
- Avant d'envoyer une photo à un outil, retire tout élément personnel : visages, photos de famille, courrier, plaques d'immatriculation, documents sur un bureau.

### Leçon 2.6 — Les descriptions qui fonctionnent

Remplace les adjectifs vides par des faits :

| À éviter | Préférer (si la fiche le permet) |
|---|---|
| Lumineux | Séjour exposé sud-ouest avec deux fenêtres |
| Proche de tout | Boulangerie et école à 300 m à pied (distance mesurée) |
| Beaux volumes | Séjour de 32 m², hauteur sous plafond 2,90 m |
| Rare sur le secteur | (à supprimer) |
| Calme | Chambres côté cour |

Prompt pour améliorer un texte existant :

```
Voici une annonce. Repère chaque adjectif ou formule vague ("lumineux", "proche de tout", "beaux volumes"…). Pour chacun, propose une reformulation factuelle UNIQUEMENT si la fiche jointe contient l'information ; sinon, propose de supprimer la formule et indique quelle donnée je pourrais vérifier pour la remplacer.
```

### Exemple

Un agent commercial a une maison de 1975 avec un DPE défavorable. Sa fiche signale « menuiseries simple vitrage à l'étage » et « chaudière remplacée en 2021 ». L'annonce produite présente honnêtement la maison comme « à moderniser sur le plan énergétique, chaudière récente ». Il ajoute son bloc de mentions, vérifie les informations DPE au mot près sur le diagnostic, et contrôle les règles d'affichage pour cette classe sur service-public.fr.

### Exercice

Rédige l'annonce principale de ton bien, puis lance le contrôle anti-invention. Ajoute ton bloc de mentions et passe-le dans ta checklist. Décline-la ensuite pour deux supports.

---

## Module 3 — Relances et suivi des contacts

### Leçon 3.1 — Le principe : une relance utile, pas une relance « je reviens vers vous »

Une relance efficace apporte quelque chose : une information, une question précise, une prochaine étape. Avant de rédiger, réponds à trois questions :
1. **Où en est la personne ?** (première demande, après visite, offre en réflexion, vendeur inquiet)
2. **Qu'est-ce que je lui apporte ?** (nouveau bien, retour de visite, point marché, document)
3. **Quelle action simple je lui propose ?** (un créneau, un oui/non, un appel de 10 minutes)

### Leçon 3.2 — Le prompt de relance générique

```
Rédige une relance pour mon activité d'agent immobilier.
CANAL : [e-mail / SMS / message vocal à lire]
DESTINATAIRE : [acquéreur / vendeur / bailleur / locataire] — je n'indique pas son nom, je l'ajouterai moi-même.
SITUATION : [ex. a visité un T3 il y a 5 jours, a dit "on réfléchit", pas de nouvelles]
CE QUE J'APPORTE : [ex. deux autres visites ont eu lieu depuis, le vendeur reste ouvert à la discussion — vérifier que j'ai l'accord du vendeur pour le dire]
ACTION PROPOSÉE : [ex. un appel de 10 minutes jeudi ou vendredi]
CONTRAINTES : vouvoiement, 90 mots maximum pour un e-mail, 300 caractères pour un SMS, ton cordial et direct, pas de pression ni de fausse urgence, une seule question à la fin.
Propose 2 versions : une plus directe, une plus douce.
```

Note la contrainte « pas de fausse urgence » : « un autre acquéreur est sur le point de signer » est une technique de pression qui, si elle est fausse, nuit à ta réputation et peut être trompeuse.

### Leçon 3.3 — Les situations types

Garde un prompt prêt pour chaque situation récurrente. Tu changes seulement le bloc SITUATION.

**Demande entrante sur une annonce :**

```
Un contact a envoyé une demande sur l'annonce [référence] via un portail. Son message : "[colle le message en retirant nom, téléphone, e-mail]".
Rédige une réponse sous 100 mots qui : remercie, répond précisément à sa question à partir de la fiche ci-dessous (et seulement d'elle), propose deux créneaux de visite [créneaux], et pose UNE question de qualification utile (ex. délai de projet, financement validé ou non, critère principal). Vouvoiement.
"""
[fiche bien]
"""
```

**Après une visite, acquéreur indécis :**

```
SITUATION : visite il y a [x] jours. Points positifs exprimés : [ ]. Réserves exprimées : [ ].
Rédige un e-mail de suivi de 120 mots maximum qui reprend les points positifs, répond factuellement à chaque réserve (avec les éléments de la fiche, ou en proposant de vérifier), et propose une prochaine étape (contre-visite, envoi d'un document, appel).
```

**Vendeur sans visite depuis plusieurs semaines :**

```
SITUATION : bien en vente depuis [x] semaines, [n] demandes, [n] visites, retours principaux : [ ]. 
Rédige un e-mail au vendeur, 180 mots maximum, factuel et respectueux, qui : donne les chiffres de suivi, résume les retours sans les durcir ni les adoucir, et propose un rendez-vous pour faire le point sur la stratégie (présentation, photos, prix). Ne propose pas de nouveau prix : c'est l'objet du rendez-vous.
```

**Acquéreur en recherche, nouveau bien correspondant :**

```
Rédige un SMS de 300 caractères maximum pour prévenir un acquéreur en recherche d'un [type] sur [secteur] qu'un bien correspondant vient d'entrer en portefeuille. Infos à utiliser uniquement : [3 éléments de la fiche + prix]. Propose une visite. Vouvoiement, pas d'abréviation.
```

**Mandat arrivant à échéance :**

```
Rédige un e-mail à un vendeur dont le mandat arrive à échéance le [date]. Résume le travail réalisé [liste factuelle : diffusion, visites, retours], propose un rendez-vous pour décider ensemble de la suite. Ton professionnel, sans pression, 150 mots maximum.
```

### Leçon 3.4 — Prospection : attention aux règles

L'IA peut t'aider à rédiger des courriers de prospection, des messages de boîtage ou des scripts d'appel. Mais les règles de la prospection s'appliquent à toi, pas à l'outil :
- **Démarchage téléphonique** des particuliers : vérifie les obligations liées à la liste d'opposition Bloctel et aux plages horaires autorisées (renseigne-toi sur bloctel.gouv.fr et service-public.fr).
- **E-mail et SMS de prospection** vers des particuliers : en principe soumis au consentement préalable. Consulte les fiches de la **CNIL** (cnil.fr) sur la prospection commerciale.
- Chaque message commercial doit permettre de **se désinscrire** facilement.

Prompt pour un courrier de boîtage :

```
Rédige un courrier de boîtage pour présenter mon agence aux propriétaires du secteur [quartier]. 150 mots maximum. Contenu : qui je suis [présentation courte], ce que je propose concrètement (estimation, accompagnement), une information utile et vérifiable que je fournis [ex. nombre de ventes de l'agence sur le secteur l'an dernier, uniquement si chiffre réel], un moyen de contact. Pas de chiffre inventé, pas de "vous allez vendre en 15 jours", pas de faux sentiment d'urgence.
```

### Leçon 3.5 — Structurer le suivi

Une relance sans suivi est une relance perdue. Tu peux faire générer ton plan de relance par situation :

```
Propose un plan de suivi pour un acquéreur après une première visite sans offre : 3 points de contact sur 3 semaines, avec pour chacun : le jour, le canal, l'objectif, et ce que j'apporte de nouveau. Prévois quand arrêter de relancer et le message de clôture poli.
```

Reporte ensuite ces étapes dans ton logiciel métier ou ton agenda. L'IA ne doit pas devenir ton fichier clients.

### Exemple

Une conseillère reçoit 14 demandes sur un appartement en une semaine. Elle copie chaque message dans le prompt « demande entrante » en supprimant les coordonnées, obtient une réponse, l'ajuste, et ajoute le prénom dans son logiciel au moment de l'envoi. Les réponses posent toutes la même question de qualification (projet financé ou non), ce qui l'aide à prioriser les visites.

### Exercice

Choisis trois situations récurrentes dans ton activité. Adapte un prompt pour chacune et teste-les sur des cas réels anonymisés. Garde les meilleures versions dans ta bibliothèque.

---

## Module 4 — Comptes rendus de visite et reporting vendeur

### Leçon 4.1 — Pourquoi c'est le gain le plus sous-estimé

Les vendeurs veulent savoir ce qui se passe. Un compte rendu régulier, clair et honnête rassure, évite les appels « alors, ça avance ? » et prépare les discussions difficiles (prix, présentation). C'est aussi la tâche qu'on repousse le plus. L'IA transforme tes notes brutes en texte propre en quelques secondes.

### Leçon 4.2 — Prendre des notes exploitables

Après chaque visite, prends 2 minutes pour noter, sur ton téléphone ou à l'oral (dictée vocale) :
- date, type de visiteur (sans nom : « couple primo-accédant », « investisseur »),
- points positifs exprimés,
- réserves exprimées,
- question posée à laquelle tu dois répondre,
- intérêt estimé (faible / moyen / fort) et suite prévue.

Si tu utilises une fonction d'enregistrement ou de transcription pendant une visite ou un rendez-vous, **informe les personnes et obtiens leur accord** avant d'enregistrer. Le plus simple : dicte tes notes toi-même après la visite.

### Leçon 4.3 — Le prompt compte rendu de visite

```
Transforme mes notes de visite en compte rendu à envoyer au vendeur.
Notes (sans données personnelles sur les visiteurs) :
"""
[tes notes brutes]
"""
Format :
- Date et profil du visiteur (sans nom)
- Ce qui a plu (liste)
- Les réserves (liste, formulées factuellement, sans les adoucir ni les durcir)
- Questions en suspens et ce que je fais pour y répondre
- Suite prévue
Ton : professionnel, rassurant mais honnête, vouvoiement, 150 mots maximum.
N'ajoute aucune information absente de mes notes. N'invente aucune intention d'achat.
```

### Leçon 4.4 — Le reporting hebdomadaire ou mensuel

Regroupe les comptes rendus de la période :

```
Voici les données de commercialisation du bien [référence] sur la période du [date] au [date] :
- Vues/demandes : [chiffres réels de mon logiciel ou des portails]
- Visites : [nombre]
- Résumés des comptes rendus : [colle-les]
Rédige un bilan pour le vendeur, 250 mots maximum, avec :
1. Les chiffres de la période (recopiés à l'identique),
2. Les 3 retours les plus fréquents, positifs et négatifs,
3. Mon analyse en 3 phrases, prudente, sans prédire de délai de vente,
4. Les actions proposées pour la période suivante.
Signale si un chiffre semble incohérent au lieu de le corriger.
```

Ne fais jamais calculer ou « estimer » des chiffres par l'IA pour les présenter comme réels. Elle met en forme tes données, elle ne les produit pas.

### Leçon 4.5 — Préparer une conversation difficile

Le compte rendu sert souvent à préparer un rendez-vous sur le prix. L'IA peut t'aider à structurer ton argumentaire, sans conseil personnalisé au vendeur sur sa situation fiscale ou juridique :

```
Je dois proposer à un vendeur de revoir la stratégie de son bien. Éléments factuels : [durée de mise en vente, chiffres de commercialisation, retours de visite, éléments de comparaison que j'ai vérifiés].
Prépare un plan d'entretien de 20 minutes : ouverture, rappel des faits, retours des visiteurs, options possibles (présentation, photos, prix, conditions de visite), questions à poser au vendeur, conclusion avec une décision à prendre ensemble.
Ton respectueux. Ne recommande pas un prix précis : je le déterminerai avec mes propres outils d'estimation.
```

### Leçon 4.6 — Comptes rendus internes et état des lieux

Les mêmes prompts servent pour :
- les **comptes rendus de rendez-vous d'estimation** (à partir de tes notes, sans données personnelles du propriétaire) ;
- les **notes de passation** à un collègue qui reprend un dossier ;
- la **mise au propre d'observations** en gestion locative (attention : un état des lieux est un document contractuel, rédige-le avec ton outil métier et relis chaque mention ; l'IA peut tout au plus t'aider à formuler des descriptions neutres et précises).

Prompt pour des descriptions neutres :

```
Reformule ces observations en descriptions neutres, précises et vérifiables, sans jugement ("sale", "abîmé" → description de ce qu'on voit, localisation, dimension approximative). Ne change pas le sens, n'ajoute rien.
"""
[observations]
"""
```

### Exemple

Un agent dicte ses notes après trois visites le samedi. Le lundi matin, il colle les trois notes dans le prompt compte rendu, ajuste deux formulations, et envoie un seul e-mail au vendeur. Le mois suivant, il colle les quatre bilans hebdomadaires dans le prompt reporting pour préparer le rendez-vous de stratégie.

### Exercice

Rédige le compte rendu de ta dernière visite à partir de tes notes, puis un bilan de période pour ton bien de référence. Vérifie que chaque chiffre est identique à ta source.

---

## Module 5 — Confidentialité et conformité avec l'IA

### Leçon 5.1 — Ce que tu manipules

Dans ton métier, tu as accès à beaucoup de données personnelles : identité et coordonnées des vendeurs, acquéreurs et locataires, situation familiale, financement, revenus, pièces justificatives, adresse exacte et habitudes d'occupation d'un logement (absences, clés). Le RGPD s'applique, et tu en es responsable, ou ton agence l'est.

Quand tu colles une information dans un assistant IA grand public, elle est transmise à un prestataire, stockée, parfois hors de l'Union européenne, et peut selon les réglages servir à améliorer les modèles. Ce cours ne fournit pas de conseil juridique ; il te donne des règles de prudence. Pour aller plus loin : **cnil.fr** et ton réseau ou ta fédération.

### Leçon 5.2 — Les règles de base

1. **Jamais de données d'identité** : nom, adresse personnelle, téléphone, e-mail. Ajoute-les dans ton logiciel au moment de l'envoi.
2. **Jamais de données financières ou sensibles** : revenus, crédit, apport, dossier de location, pièces d'identité, avis d'imposition, santé, situation familiale (divorce, succession, décès).
3. **Jamais de documents complets** : compromis, mandat, titre de propriété, bail, dossier locataire. Si tu as besoin d'aide sur un paragraphe, recopie seulement ce paragraphe, sans éléments identifiants.
4. **L'adresse exacte du bien** n'est pas indispensable pour rédiger une annonce. Utilise le secteur.
5. **Sécurité** : ne mentionne jamais dans l'outil les absences d'un propriétaire, l'emplacement des clés, un code d'accès ou une alarme.
6. **Règle tes paramètres** : désactive quand c'est possible l'utilisation de tes conversations pour l'entraînement, et supprime l'historique inutile.
7. **Respecte la politique de ton agence ou de ton réseau** : certains imposent un outil précis ou interdisent certains usages.

### Leçon 5.3 — Le test avant de coller

Avant de coller un texte, pose-toi trois questions :
- Est-ce qu'on peut **identifier une personne** avec ce texte ?
- Est-ce que ça contient une information que mon client **ne voudrait pas voir circuler** ?
- Est-ce que j'ai **réellement besoin** de cette information pour la tâche demandée ?

Si une réponse est « oui » pour les deux premières ou « non » pour la troisième, retire l'information.

### Leçon 5.4 — Anonymiser rapidement

Pour un message reçu que tu veux faire analyser :

```
[Contact A] écrit : "Bonjour, nous avons visité l'appartement samedi avec [conjoint]. Nous avons un financement en cours de validation. Pouvons-nous revoir le séjour en fin de journée ?"
```

Les remplacements entre crochets suffisent. Tu remettras les vraies informations dans ton logiciel.

### Leçon 5.5 — Ce qui reste ta responsabilité

L'IA ne porte aucune responsabilité professionnelle. Toi si. Gardent leur place humaine :
- la **vérification** des informations du bien et des diagnostics ;
- les **mentions obligatoires** et leur conformité ;
- les **conseils** donnés aux clients (l'IA ne doit pas donner de conseil juridique ou fiscal personnalisé en ton nom) ;
- la **sélection** des candidats locataires ou acquéreurs, qui doit respecter les règles de non-discrimination ;
- l'**estimation** du bien.

### Exemple

Une gestionnaire locative veut une réponse à un locataire qui conteste une régularisation de charges. Elle ne colle ni le nom, ni l'adresse, ni le décompte. Elle décrit : « un locataire conteste le montant de la régularisation annuelle et demande les justificatifs ». Elle obtient une structure de réponse cordiale qui propose l'envoi des justificatifs, et complète elle-même les montants et références dans son outil de gestion.

### Exercice

Règle les paramètres de confidentialité de ton outil IA. Écris ta propre « liste rouge » (5 à 10 informations que tu ne colles jamais) et affiche-la près de ton poste. Vérifie si ton agence ou ton réseau a une politique d'usage de l'IA.

---

## Module 6 — Ton système : bibliothèque, instructions et routine

### Leçon 6.1 — La bibliothèque de prompts

Crée un document unique, organisé en rubriques :
1. **Cadre** : prompt garde-fou, fiche bien vide, contrôle anti-invention.
2. **Annonces** : annonce principale, déclinaisons, amélioration d'un texte, contrôle de présence des mentions.
3. **Checklist des mentions** : ta version à jour, avec la date de dernière vérification sur les sources officielles.
4. **Relances** : un prompt par situation.
5. **Comptes rendus** : visite, bilan, préparation d'entretien, descriptions neutres.
6. **Prospection** : boîtage, scripts, avec les règles rappelées en tête.

### Leçon 6.2 — Les instructions permanentes

Beaucoup d'outils permettent d'enregistrer des instructions qui s'appliquent à toutes tes conversations (selon les outils : instructions personnalisées, projets, espaces). Exemple :

```
Je suis agent immobilier en France. Par défaut :
- tu utilises uniquement les informations que je fournis sur un bien et tu listes les informations manquantes au lieu de les inventer ;
- pas de superlatifs invérifiables, pas de critères discriminatoires, pas de fausse urgence ;
- tu ne rédiges pas de mentions légales et tu ne donnes pas d'avis juridique ou fiscal ; tu me rappelles de vérifier ces points sur les sources officielles ;
- vouvoiement des clients, phrases courtes, ton professionnel et chaleureux ;
- je ne te transmets aucune donnée personnelle de client ; si un texte en contient, signale-le-moi.
```

### Leçon 6.3 — Ta charte de style

Pour que tous tes textes se ressemblent (et ressemblent à toi), fais analyser ton style :

```
Voici 3 annonces et 3 e-mails que j'ai rédigés moi-même et dont je suis satisfait (données personnelles retirées).
"""
[textes]
"""
Décris mon style en 8 règles concrètes (longueur des phrases, vocabulaire, formules d'ouverture et de clôture, niveau de formalité, façon de présenter les défauts). Je les ajouterai à mes instructions.
```

### Leçon 6.4 — La routine hebdomadaire

Une proposition, à adapter :
1. **Lundi matin (30 min)** : comptes rendus de la semaine précédente et bilans vendeurs.
2. **À chaque entrée de mandat (20 à 40 min)** : fiche bien, annonce, contrôle anti-invention, mentions, déclinaisons.
3. **Chaque jour (10 min)** : relances du jour à partir de ton logiciel, rédigées avec les prompts situationnels.
4. **Fin de mois (20 min)** : mise à jour de la checklist des mentions (vérification des sources officielles), amélioration de deux prompts.

Mesure ton temps sur quelques semaines. Si une tâche ne va pas plus vite avec l'IA, garde ta méthode habituelle pour celle-là.

### Leçon 6.5 — Travailler en équipe

En agence, une bibliothèque partagée garantit un niveau de qualité homogène. Fixez ensemble : l'outil autorisé, la liste rouge des données, le bloc de mentions validé, et la règle « aucune annonce publiée sans relecture humaine ».

### Exemple

Un mandataire indépendant crée un dossier « IA » avec sa fiche bien, son prompt garde-fou, ses 8 prompts de relance et sa checklist datée. À chaque nouveau mandat, il remplit la fiche pendant la visite d'estimation, et rédige l'annonce le soir même.

### Exercice

Monte ta bibliothèque avec au moins 10 prompts tirés de ce cours. Enregistre tes instructions permanentes. Planifie ta routine dans ton agenda pour les deux prochaines semaines.

---

## Checklist finale

**Avant d'utiliser l'IA**
- [ ] Mes paramètres de confidentialité sont réglés au plus protecteur.
- [ ] Mon texte ne contient aucun nom, coordonnée, donnée financière ou sensible.
- [ ] Je n'ai pas collé de document contractuel complet.
- [ ] Aucune information de sécurité (absences, clés, codes) n'est mentionnée.

**Annonce**
- [ ] La fiche bien est remplie à partir de documents et de mes constats.
- [ ] Le prompt garde-fou est en tête de conversation.
- [ ] Le contrôle anti-invention est fait, et j'ai relu moi-même ligne par ligne.
- [ ] Chiffres (prix, surface, honoraires, DPE, charges) identiques aux documents.
- [ ] Mentions obligatoires vérifiées sur les sources officielles en vigueur, pour chaque support.
- [ ] Aucun superlatif invérifiable ni critère discriminatoire.
- [ ] Visuels retouchés signalés, aucun élément du bien modifié.

**Relances et comptes rendus**
- [ ] Chaque relance apporte une information et propose une action simple.
- [ ] Pas de fausse urgence.
- [ ] Prospection conforme (consentement, opposition, désinscription).
- [ ] Les comptes rendus ne contiennent que ce qui figure dans mes notes.
- [ ] Les chiffres de reporting viennent de mes outils, pas de l'IA.

**Système**
- [ ] Bibliothèque de prompts à jour.
- [ ] Checklist des mentions datée et revérifiée.
- [ ] Temps mesuré avant et après.

---

## Ressources

- **service-public.fr** : fiches sur la vente et la location d'un logement, les diagnostics immobiliers, le DPE, l'encadrement des loyers.
- **legifrance.gouv.fr** : textes officiels (loi Hoguet et textes d'application, Code de la construction et de l'habitation, Code de la consommation).
- **georisques.gouv.fr** : information sur les risques.
- **cnil.fr** : prospection commerciale, données des clients, IA.
- **bloctel.gouv.fr** : démarchage téléphonique.
- **Ton réseau, ta fédération professionnelle, ton juriste** : validation de ton bloc de mentions et de tes pratiques.
- **Les conditions d'utilisation** de ton outil IA : traitement et localisation des données.

Dernier rappel : l'IA met en forme, toi tu garantis. Chaque fait vient de ta fiche, chaque mention de la réglementation en vigueur, et aucune donnée sensible de tes clients ne sort de tes outils métier.
