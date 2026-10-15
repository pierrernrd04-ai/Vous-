# L'IA pour artisans : devis, relances et avis clients

*Une méthode pour faire rédiger par l'IA tes descriptifs de devis, tes relances, tes réponses aux avis et tes publications, sans y perdre ta voix ni tes clients.*

> **À lire avant de commencer.** L'IA écrit vite, mais elle se trompe : elle peut inventer une norme, un délai, un prix ou une mention légale. Tout ce qu'elle produit doit être **relu et vérifié par toi** avant d'être envoyé à un client ou publié. Les prix, quantités et taux de TVA viennent de ton logiciel ou de ton calcul, jamais de l'IA. Ce cours ne remplace pas un conseil juridique, comptable ou fiscal : pour les mentions obligatoires et les règles de recouvrement, vérifie toujours la version en vigueur sur **service-public.fr** (et entreprendre.service-public.fr) et auprès de ta chambre de métiers, de ton organisation professionnelle ou de ton expert-comptable. Enfin, **ne mets pas de données personnelles de tes clients** dans un outil d'IA : ni nom, ni adresse, ni téléphone, ni situation personnelle.

---

## Introduction

### Pour qui

Cette masterclass est pour toi si tu es artisan ou à la tête d'une petite entreprise : plombier, électricien, menuisier, peintre, maçon, carreleur, couvreur, chauffagiste, paysagiste, serrurier, mais aussi coiffeur, réparateur, ébéniste ou toute activité où tu travailles de tes mains et où la paperasse se fait le soir.

Tu sais faire ton métier. Ce qui te pèse : les devis à rédiger après la journée, les factures impayées que tu n'oses pas relancer, les avis Google auxquels tu ne réponds jamais, la page Facebook qui n'a pas bougé depuis des mois.

Pas besoin d'être à l'aise avec l'informatique. Si tu sais envoyer un SMS, tu sais utiliser un assistant IA. Beaucoup permettent même de **dicter** au lieu de taper : très pratique dans le camion.

### Ce que tu sauras faire à la fin

- Transformer tes notes de visite en **descriptif de devis** clair, avec une **checklist des mentions obligatoires** à vérifier sur service-public.fr.
- Écrire le **message d'envoi** du devis et sa **relance** quand le client ne répond pas.
- Relancer un **impayé** avec une méthode graduée en 4 étapes, du rappel amical à la mise en demeure.
- **Demander** des avis à tes clients satisfaits et **répondre** à tous les avis, y compris négatifs ou injustes.
- Produire des **publications** pour tes réseaux à partir de tes chantiers.
- Monter ta **bibliothèque de prompts** et une routine administrative de 30 minutes par semaine.

### Comment suivre

Lecture : 2 heures environ. Application : 2 à 3 semaines, sur tes vrais chantiers. Le plus simple : prends **ton prochain devis** et ton **dernier impayé** comme fil rouge des exercices.

Les prompts sont dans des blocs à copier. Remplace ce qui est `[entre crochets]`. Ils marchent avec la plupart des assistants (Claude, ChatGPT, Le Chat, Gemini…), sur ordinateur ou téléphone. Les noms et les boutons de ces outils changent souvent ; la méthode, elle, reste la même.

---

## Module 1 — Les bases : bien parler à l'IA quand on est artisan

### Leçon 1.1 — Ce que l'IA fait bien pour toi, et ce qu'elle ne doit jamais faire

**Elle fait bien :**
- Remettre au propre des notes en vrac ou une dictée (« salle de bain, dépose baignoire, mettre douche italienne 90 sur 120, faïence toute hauteur… »).
- Trouver le ton juste pour un message délicat (relance, réponse à un avis négatif).
- Rédiger plusieurs versions d'un même texte (SMS, e-mail, courrier).
- Proposer des idées de publications à partir de photos ou de notes de chantier.

**Elle ne doit jamais :**
- **Fixer un prix**, une quantité, un taux de TVA ou un délai de paiement. Ces chiffres viennent de toi ou de ton logiciel.
- **Affirmer une norme ou une règle technique** sans que tu la vérifies (elle peut citer une norme qui n'existe pas ou une règle dépassée).
- **Rédiger seule tes mentions légales** : elle peut se tromper ou utiliser une formulation périmée.
- **Recevoir les données personnelles** de tes clients.

Retiens : **l'IA rédige, toi tu chiffres et tu signes.**

### Leçon 1.2 — Le prompt de base de l'artisan

Pour toute demande, donne ces cinq éléments :

1. **Qui tu es** : métier, taille de l'entreprise, zone.
2. **À qui tu écris** : particulier, professionnel, syndic, architecte.
3. **La situation** : ce qui s'est passé, en quelques lignes.
4. **Ce que tu veux** : le type de texte et le but.
5. **Le format** : longueur, canal, tutoiement ou vouvoiement, ton.

Modèle :

```
Je suis [métier] à mon compte, dans une petite entreprise de [nombre] personnes, secteur [ville/département].
J'écris à : [un particulier / un professionnel]. Je n'indique pas son nom, je l'ajouterai moi-même.
Situation : [quelques lignes].
Ce que je veux : [ex. un message pour relancer un devis envoyé il y a 10 jours].
Format : [SMS de 300 caractères / e-mail de 120 mots], vouvoiement, ton [cordial et direct].
Règles : n'invente aucun prix, délai, norme ou mention légale. Si une information te manque, pose-moi la question.
```

### Leçon 1.3 — Dicter au lieu de taper

Beaucoup d'assistants sur téléphone acceptent la voix. Ou bien tu utilises la dictée de ton clavier. Méthode :
1. À la sortie d'une visite, dicte tes notes comme elles viennent, en 1 à 2 minutes.
2. Colle-les (ou dicte-les directement) avec une consigne de mise au propre.
3. Relis le soir ou le lendemain.

Prompt de mise au propre :

```
Voici mes notes dictées à la sortie d'une visite de chantier. Remets-les au propre en liste structurée : pièces/zones, travaux demandés, contraintes constatées, questions à poser au client, matériaux évoqués. Ne rajoute rien, ne devine pas les mesures : si une mesure ou un détail semble manquer, signale-le dans "À vérifier".
"""
[notes dictées]
"""
```

### Leçon 1.4 — Toujours relire, toujours vérifier

Trois questions avant d'envoyer quoi que ce soit :
- **Est-ce que c'est vrai ?** (rien d'inventé sur le chantier, les délais, les normes)
- **Est-ce que c'est complet ?** (prix, mentions, conditions)
- **Est-ce que c'est moi ?** (ton, vocabulaire ; un client qui te connaît doit reconnaître ta façon de parler)

### Exemple

Un plombier dicte dans son camion : « Cuisine madame, fuite sous évier, siphon à changer, flexible robinet usé, propose aussi de changer le robinet il a 20 ans, accès facile, prévoir 1 h 30. » L'IA lui rend une liste propre, et ajoute dans « À vérifier » : référence ou gamme du robinet proposé, prix des fournitures. Il complète dans son logiciel de devis.

### Exercice

Écris (ou dicte) ton prompt de base personnalisé : ton métier, ta zone, ton ton habituel. Teste la mise au propre sur les notes de ta dernière visite.

---

## Module 2 — Des devis clairs et complets

### Leçon 2.1 — Ce que l'IA apporte au devis

Le devis est un document commercial et souvent contractuel. Ton logiciel de devis ou ton modèle gère les lignes, les prix, la TVA et les mentions. L'IA t'aide sur trois points :
1. **Le descriptif des travaux** : clair, précis, compréhensible par un client non spécialiste.
2. **Le message d'envoi** : qui explique le devis et donne envie de signer.
3. **La relance** : quand le client ne répond pas.

Elle ne remplace pas ton logiciel. Elle ne calcule pas tes prix.

### Leçon 2.2 — Le descriptif des travaux

Un bon descriptif évite les malentendus (« je croyais que l'évacuation des gravats était comprise »). Règle : **tout ce qui est compris est écrit, tout ce qui n'est pas compris est écrit aussi.**

```
Je suis [métier]. À partir de mes notes de visite ci-dessous, rédige le descriptif des travaux pour un devis destiné à un particulier.
Pour chaque poste, une ligne de titre puis 1 à 3 lignes de détail : ce qui est fait, matériaux ou gamme (seulement si indiqués dans mes notes), ce qui est inclus (protection, évacuation des déchets, nettoyage) selon mes notes.
Ajoute à la fin une rubrique "Non compris dans ce devis" à partir de mes notes, et une rubrique "À préciser avec le client" pour ce qui reste flou.
Langage clair, sans jargon inutile ; si un terme technique est nécessaire, ajoute une explication courte entre parenthèses.
Ne mets AUCUN prix, AUCUNE quantité que je n'ai pas indiquée, AUCUNE référence de norme.
"""
[notes de visite remises au propre]
"""
```

Tu colles ensuite les lignes dans ton logiciel, et tu chiffres toi-même.

### Leçon 2.3 — Les mentions obligatoires : ta checklist à vérifier

Les mentions obligatoires d'un devis dépendent de ton activité (bâtiment, dépannage, services à la personne…), du client (particulier ou professionnel) et de ton statut (micro-entreprise, société, assujetti ou non à la TVA). Elles évoluent. La liste ci-dessous t'aide à ne rien oublier ; **la référence reste service-public.fr** (fiches sur le devis et sur les mentions obligatoires pour un artisan), à vérifier dans leur version en vigueur.

Points habituellement à contrôler :
- [ ] Date du devis et **durée de validité** de l'offre.
- [ ] **Identité de l'entreprise** : nom ou dénomination, adresse, numéro d'immatriculation (SIREN/SIRET, immatriculation au registre compétent), et forme juridique pour une société.
- [ ] **Identité et adresse du client**, et **adresse du chantier** si différente.
- [ ] **Description précise** des prestations et produits, avec pour chacun quantité et **prix unitaire**.
- [ ] Le cas échéant, les **frais de déplacement**.
- [ ] Le **total HT**, le ou les **taux de TVA** et le **total TTC**, ou la mention d'exonération applicable si tu n'es pas assujetti (par exemple « TVA non applicable, art. 293 B du CGI » en franchise en base : vérifie ta situation).
- [ ] Si le devis est **payant**, l'indiquer avant de le réaliser.
- [ ] **Date de début** et **durée estimée** des travaux, selon les cas.
- [ ] **Conditions de paiement** (acompte, échéances, délais) et, pour un client professionnel, pénalités de retard et indemnité forfaitaire de recouvrement.
- [ ] Pour les activités concernées, l'**assurance professionnelle obligatoire** (par exemple décennale) : nom et coordonnées de l'assureur, couverture géographique.
- [ ] Pour un client particulier, les informations sur la **médiation de la consommation**.
- [ ] Un emplacement pour la mention « devis reçu avant l'exécution des travaux », la date et la **signature du client**, selon les règles applicables à ton activité.
- [ ] Pour les travaux éligibles à un taux de TVA réduit, les **justificatifs ou attestations** demandés : vérifie les conditions en vigueur.

Fais valider ton modèle de devis une fois par ta chambre de métiers, ton organisation professionnelle ou ton expert-comptable, puis garde-le comme base.

L'IA peut faire un **contrôle de présence** sur un devis anonymisé :

```
Voici un devis dont j'ai retiré les informations du client, et ma checklist interne de mentions à vérifier.
Pour chaque point de la checklist, indique : "présent", "absent" ou "incertain", en citant la ligne concernée. Vérifie aussi que le total HT + TVA = TTC en refaisant le calcul.
Ne propose pas de formulation juridique : signale seulement ce qui semble manquer ou incohérent.
"""
DEVIS : [devis anonymisé]
CHECKLIST : [ta checklist]
"""
```

Le recalcul est utile pour repérer une erreur de saisie, mais refais toujours le calcul toi-même ou fais confiance à ton logiciel : l'IA peut se tromper en arithmétique.

### Leçon 2.4 — Le message d'envoi du devis

Un devis envoyé sans un mot est un devis qu'on compare uniquement sur le prix. Un message court qui rappelle ce que tu as compris du besoin fait la différence.

```
Rédige l'e-mail d'envoi d'un devis à un particulier.
Contexte : visite le [jour], besoin du client : [ex. remplacer la baignoire par une douche plus facile d'accès]. Points importants pour lui : [ex. durée des travaux, propreté du chantier].
Le message doit : remercier pour la visite, résumer le besoin en une phrase, présenter les 2 ou 3 choix proposés dans le devis (sans prix, il est dans le devis), rappeler la durée de validité [x jours], et proposer un appel pour répondre aux questions.
120 mots maximum, vouvoiement, ton simple et chaleureux. Pas de formule commerciale creuse.
```

### Leçon 2.5 — Relancer un devis sans réponse

Beaucoup de devis ne sont jamais relancés. Une relance polie n'agace pas : elle rend service à un client débordé. Proposition de rythme : J+7 et J+15 après l'envoi, puis un dernier message avant la fin de validité.

```
Rédige 3 relances pour un devis envoyé le [date] à un particulier, pour [travaux], validité jusqu'au [date] :
1. J+7 : SMS de 300 caractères maximum, pour vérifier la bonne réception et proposer de répondre aux questions.
2. J+15 : e-mail de 80 mots, qui propose d'ajuster le devis si besoin (variante, phasage) et donne mes disponibilités prévisionnelles [période].
3. Avant fin de validité : e-mail de 60 mots, qui rappelle la date de validité, sans pression, et laisse la porte ouverte.
Vouvoiement, ton cordial. Pas de fausse urgence ni de "dernière chance".
```

Note : si tes disponibilités sont réellement limitées, tu peux le dire. Si elles ne le sont pas, ne l'invente pas.

### Exemple

Une peintre en bâtiment reçoit une demande pour un salon et un couloir. Ses notes : murs et plafonds, deux couches, rebouchage de fissures fines, protection du parquet, client garde les meubles dans la pièce. L'IA produit un descriptif avec une rubrique « Non compris : déplacement de meubles lourds, réparation des plinthes » qu'elle avait oubliée. Elle chiffre dans son logiciel, passe sa checklist, envoie avec le message d'envoi, et programme ses relances.

### Exercice

Rédige le descriptif de ton prochain devis avec le prompt 2.2. Passe ton modèle de devis dans ta checklist de mentions, et vérifie les points incertains sur service-public.fr. Prépare tes 3 relances.

---

## Module 3 — Relances d'impayés : la méthode graduée

### Leçon 3.1 — Pourquoi graduer

Un impayé n'est pas toujours de la mauvaise foi : facture perdue, oubli, problème de trésorerie, désaccord non exprimé. Une relance graduée laisse au client l'occasion de régler sans conflit, tout en montrant que tu suis tes factures. Et si ça finit mal, tu auras une trace écrite de chaque étape.

Avant tout, vérifie ta facture : mentions, montant, date d'échéance, conditions de paiement prévues au devis. Une relance sur une facture erronée te met en position faible.

### Leçon 3.2 — Les 4 étapes

Ce rythme est une proposition à adapter à tes conditions de paiement et à la relation :

| Étape | Quand (après l'échéance) | Canal | Ton |
|---|---|---|---|
| 1. Rappel amical | quelques jours | SMS ou e-mail | Cordial, on suppose un oubli |
| 2. Relance ferme | environ 2 semaines | E-mail + appel | Clair, date limite précise |
| 3. Dernière relance | environ 3 à 4 semaines | E-mail | Formel, annonce de la mise en demeure |
| 4. Mise en demeure | environ 1 mois et plus | Lettre recommandée avec accusé de réception | Formel, délai, suites possibles |

Avant l'étape 4 et pour la suite (injonction de payer, procédure simplifiée de recouvrement des petites créances, recours à un commissaire de justice), renseigne-toi sur **service-public.fr** et, si besoin, auprès d'un professionnel du droit : les procédures, seuils et conditions évoluent.

Pour un **client professionnel**, la loi prévoit notamment des **pénalités de retard** et une **indemnité forfaitaire pour frais de recouvrement**, qui doivent figurer dans tes conditions. Vérifie les montants et taux en vigueur sur service-public.fr ou entreprendre.service-public.fr avant de les mentionner.

### Leçon 3.3 — Les prompts des 4 étapes

**Étape 1 — Rappel amical :**

```
Rédige un rappel amical pour une facture impayée.
Client : particulier, je ne donne pas son nom. Facture n° [n°] du [date], montant [montant] € TTC, échéance dépassée depuis [x] jours, pour [travaux].
SMS de 300 caractères maximum ET e-mail de 70 mots. Ton cordial, on suppose un oubli. Rappelle les moyens de paiement : [virement / chèque / CB]. Propose de renvoyer la facture si besoin. Vouvoiement.
```

**Étape 2 — Relance ferme :**

```
Rédige une relance ferme pour la facture n° [n°] du [date], [montant] € TTC, échéance dépassée depuis [x] jours, premier rappel envoyé le [date] sans réponse.
E-mail de 100 mots : rappelle le premier message, demande le règlement avant le [date précise], propose un échange si une difficulté ou un désaccord existe (possibilité d'échéancier si je l'accepte : [oui/non]). Ton poli, clair, sans menace. Vouvoiement.
```

**Étape 3 — Dernière relance avant mise en demeure :**

```
Rédige une dernière relance amiable pour la facture n° [n°] du [date], [montant] € TTC. Rappels envoyés le [date] et le [date] sans règlement.
E-mail de 120 mots, ton formel et courtois : récapitule les relances, fixe un dernier délai au [date], indique qu'à défaut j'adresserai une mise en demeure par lettre recommandée. Ne cite aucun article de loi, aucun montant de pénalité, aucune procédure judiciaire précise.
```

La dernière consigne est volontaire : tu n'inscris des références juridiques ou des pénalités qu'après les avoir vérifiées toi-même.

**Étape 4 — Mise en demeure :**

```
Rédige un projet de lettre de mise en demeure de payer, que je ferai vérifier et compléterai moi-même.
Éléments : facture n° [n°] du [date], [montant] € TTC, travaux réalisés le [date], relances du [dates].
Structure : en-tête (laisser mes coordonnées et celles du client entre crochets), objet "Mise en demeure de payer", rappel des faits datés, demande de paiement sous [x] jours à réception, mention des suites possibles en des termes généraux ("je me réserve la possibilité d'engager une procédure de recouvrement"), formule de politesse.
Laisse un emplacement [PÉNALITÉS ET INDEMNITÉS SI APPLICABLES — À VÉRIFIER] pour les clients professionnels.
Ton factuel, sans menace excessive ni agressivité.
```

Ajoute ensuite toi-même les coordonnées, signe, et envoie en recommandé avec accusé de réception. Garde une copie de tout.

### Leçon 3.4 — Ce qu'il ne faut pas faire

- **Menacer de ce que tu ne feras pas** (« huissier demain ») : ça décrédibilise.
- **Harceler** : multiplier les appels, contacter l'entourage ou l'employeur du client, publier quoi que ce soit sur les réseaux. C'est interdit et ça se retourne contre toi.
- **Relancer avec colère** : écris, laisse reposer, relis le lendemain. L'IA peut d'ailleurs t'aider à refroidir un message :

```
Voici un message que j'ai écrit sous le coup de l'énervement pour un client qui ne paie pas. Réécris-le en gardant la fermeté et toutes les informations utiles, mais en retirant tout ce qui est agressif, ironique ou menaçant. 100 mots maximum.
"""
[ton message]
"""
```

### Leçon 3.5 — Prévenir plutôt que relancer

Les meilleures relances sont celles qu'on n'envoie pas. Demande à l'IA de t'aider à rendre tes conditions plus claires :

```
Voici mes conditions de paiement actuelles sur mes devis : "[texte]". Reformule-les pour qu'un particulier les comprenne en une lecture : acompte, échéances, moyens de paiement, date d'exigibilité. Phrases courtes. Ne change aucun montant, pourcentage ni délai. Signale tout point ambigu.
```

Envoie aussi la facture **le jour de la fin du chantier**, avec un message de remerciement : plus la facture arrive tard, plus elle est payée tard.

### Exemple

Un menuisier a une facture de pose de fenêtres impayée depuis trois semaines. Il envoie le rappel amical : le client répond qu'il attendait la facture par courrier. Pour une autre, la relance ferme déclenche un appel : le client conteste un réglage de porte. Le menuisier repasse, règle le problème, et la facture est payée. Aucune des deux situations n'a nécessité la mise en demeure.

### Exercice

Prends ton plus vieil impayé (ou un cas fictif). Vérifie la facture. Rédige les 4 messages avec les prompts, et garde-les comme modèles dans ta bibliothèque.

---

## Module 4 — Avis clients : demander et répondre

### Leçon 4.1 — Pourquoi les avis comptent pour un artisan

Quand un particulier cherche un artisan près de chez lui, il voit souvent d'abord ta fiche d'établissement sur un moteur de recherche ou une carte, avec la note et les avis. Les avis, et surtout tes **réponses**, montrent comment tu travailles. Un avis négatif avec une réponse posée rassure parfois plus qu'une note parfaite sans réponse.

### Leçon 4.2 — Les règles à respecter

- **Jamais de faux avis** : ni écrits par toi, ni par tes proches, ni achetés. C'est une pratique commerciale trompeuse, sanctionnée, et les plateformes les suppriment.
- **Pas de contrepartie** contre un avis (remise, cadeau) : la plupart des plateformes l'interdisent ; vérifie leurs règles.
- **Pas de demande d'avis uniquement aux clients satisfaits si la plateforme l'interdit** : demande à tous, simplement.
- **Pas de données personnelles dans tes réponses** publiques : ni adresse, ni détail du chantier qui permettrait d'identifier le client, ni montant de facture.
- **Ne réponds jamais à chaud** à un avis négatif.

### Leçon 4.3 — Demander un avis

Le meilleur moment : à la fin du chantier, quand le client est content et te le dit. Prépare un message court avec le lien direct vers ta fiche.

```
Rédige un SMS (300 caractères maximum) et un e-mail (80 mots) pour demander un avis à un client à la fin d'un chantier de [type de travaux].
Ton simple et sincère : remercier, dire que l'avis aide les autres clients à choisir un artisan, préciser que ça prend 2 minutes, laisser l'emplacement [LIEN AVIS]. Pas de pression, pas de contrepartie, pas de demande de note précise.
```

### Leçon 4.4 — Répondre aux avis positifs

Une réponse personnalisée en deux ou trois phrases suffit. Évite le copier-coller identique sous chaque avis.

```
Voici un avis positif reçu sur ma fiche (le nom du client est retiré) : "[avis]".
Rédige une réponse de 2 à 3 phrases : remercie, reprends un élément précis de l'avis, sans donner aucune information personnelle sur le client ou le chantier (pas d'adresse, pas de quartier précis, pas de montant). Ton chaleureux et naturel, comme un artisan qui parle, pas comme une entreprise. Propose 3 variantes.
```

### Leçon 4.5 — Répondre aux avis négatifs

Méthode en 5 temps :
1. **Remercier** pour le retour (oui, même là).
2. **Reconnaître** ce qui est légitime, sans tout accepter.
3. **Expliquer** factuellement, en une ou deux phrases, sans accuser.
4. **Proposer** une solution ou un échange hors ligne.
5. **Signer** de ton prénom.

```
Voici un avis négatif sur ma fiche (nom retiré) : "[avis]".
Ma version des faits (pour toi seulement, ne la recopie pas telle quelle) : [faits].
Rédige une réponse publique de 80 mots maximum selon ces règles : remercier pour le retour ; reconnaître ce qui est légitime ; expliquer factuellement sans accuser le client ni révéler d'informations personnelles ou de détails du chantier ; proposer d'en parler directement [téléphone de l'entreprise ou "par message"] ; signer [prénom]. Ton calme et professionnel. Ce texte sera lu par de futurs clients plus que par l'auteur de l'avis.
Propose 2 versions.
```

La dernière phrase du prompt est la clé : ta réponse s'adresse d'abord aux prochains clients.

### Leçon 4.6 — Les avis injustes ou faux

Si un avis semble venir de quelqu'un qui n'a jamais été client, ou contient des propos injurieux :
1. Ne réponds pas sur le coup.
2. Utilise la procédure de **signalement** de la plateforme, en suivant ses règles.
3. Si tu réponds, reste factuel : « Nous ne retrouvons pas d'intervention correspondant à ce retour. N'hésitez pas à nous contacter pour en parler. »
4. Pour un avis diffamatoire, renseigne-toi auprès d'un professionnel du droit avant toute démarche.

```
Voici un avis qui me semble ne pas correspondre à un client réel : "[avis]". Rédige une réponse publique de 50 mots maximum, neutre et polie, qui indique que nous ne retrouvons pas d'intervention correspondante et invite la personne à nous contacter. Aucune accusation, aucune ironie.
```

### Exemple

Un électricien reçoit un avis à 2 étoiles : « Travail correct mais 45 minutes de retard sans prévenir. » Sa première idée de réponse se justifie longuement sur les bouchons. Avec le prompt, il obtient : « Merci pour votre retour. Vous avez raison : nous aurions dû vous prévenir de notre retard, c'est un point que nous avons corrigé dans notre organisation. Merci d'avoir souligné la qualité du travail. Julien. » Il vérifie que la phrase sur l'organisation est vraie (il a mis en place un SMS d'arrivée), puis publie.

### Exercice

Rédige ton message de demande d'avis et envoie-le à tes 3 derniers clients. Réponds à tous les avis sans réponse de ta fiche, en commençant par les négatifs.

---

## Module 5 — Publications et réseaux sociaux

### Leçon 5.1 — Quoi publier quand on est artisan

Tu n'as pas besoin de publier tous les jours. Une ou deux publications par semaine, régulières, suffisent souvent à montrer que ton entreprise est active. Les formats qui fonctionnent bien pour un artisan :
- **Avant / après** d'un chantier.
- **Étape de chantier** : ce que le client ne voit jamais (préparation, réseau caché, isolation).
- **Conseil** pratique : entretien, saison, erreur à éviter.
- **Coulisses** : l'atelier, l'équipe, un outil, un apprenti.
- **Réponse à une question** fréquente de clients.

### Leçon 5.2 — Photos et consentement

- Demande l'**accord du client** avant de publier des photos de chez lui.
- Ne montre ni l'**adresse**, ni le numéro de rue, ni les plaques d'immatriculation, ni les visages, ni les objets personnels (photos de famille, courrier).
- Ne localise pas précisément (« dans une maison de la rue X ») : la commune ou le secteur suffit, et seulement si le client est d'accord.

### Leçon 5.3 — Le prompt publication à partir d'un chantier

```
Je suis [métier] à [secteur]. Rédige une publication pour [Facebook / Instagram / ma fiche d'établissement] à partir de ce chantier :
- Travaux : [description]
- Difficulté ou particularité : [ex. mur pas d'équerre, accès difficile]
- Ce que le client voulait : [ex. une salle de bain plus facile à nettoyer]
- Photos disponibles : [avant, pendant, après]
Format : 80 à 120 mots. Première phrase qui donne envie de lire (une question ou un problème concret). Explique simplement ce qui a été fait et pourquoi. Termine par une invitation à demander un devis. 0 à 2 emojis. 3 à 5 hashtags (métier + ville).
Règles : aucune information sur le client, pas d'adresse, pas de prix, aucune affirmation technique que je n'ai pas donnée.
```

### Leçon 5.4 — Un mois de publications en une fois

```
Je suis [métier] à [secteur]. Mes clients sont surtout [particuliers / professionnels]. Propose un calendrier de 8 publications pour les 4 prochaines semaines (2 par semaine), en alternant : avant/après, conseil, coulisses, question fréquente.
Pour chacune : le titre de l'idée, le format (photo, carrousel, vidéo courte), le texte complet de 60 à 100 mots, et la photo à prendre.
Les conseils doivent être prudents et généraux, sans référence à une norme ; signale "à vérifier" sur tout point technique.
Adapte à la saison : [mois].
```

Relis chaque conseil technique : c'est ton expertise qui est engagée. Un conseil faux publié sous ton nom te coûte plus qu'un mois sans publication.

### Leçon 5.5 — Ta fiche d'établissement

Ta fiche sur les moteurs de recherche et les cartes mérite aussi des publications et une description à jour. Prompt pour la description :

```
Rédige la description de mon entreprise pour ma fiche d'établissement (750 caractères maximum).
Infos : [métier, spécialités, zone d'intervention, années d'expérience réelles, qualifications ou labels que je possède réellement, types de clients, ce qui me distingue concrètement].
Ton clair et direct. Pas de superlatif ("le meilleur", "n°1"). N'invente aucune qualification, label ou garantie.
```

### Exemple

Une paysagiste prend trois photos d'une haie replantée en essences locales. Elle colle ses notes dans le prompt 5.3. La publication commence par « Votre haie de thuyas a jauni après l'été ? » et explique en quatre phrases le choix d'essences variées. Elle retire un chiffre que l'IA avait ajouté sur la consommation d'eau, qu'elle ne pouvait pas vérifier.

### Exercice

Avec ton prochain chantier (photos avec accord du client), rédige une publication. Puis génère ton calendrier de 8 publications et programme les deux premières.

---

## Module 6 — Ton système : confidentialité, bibliothèque et routine

### Leçon 6.1 — Confidentialité : ta liste rouge

Les données de tes clients sont des données personnelles. Quand tu les colles dans un assistant IA, elles partent chez un prestataire, parfois hors de l'Union européenne, et peuvent selon les réglages servir à entraîner les modèles. Règles simples :

1. **Pas de nom, adresse, téléphone, e-mail** de client. Remplace par [Client] et ajoute les vraies infos dans ton logiciel ou ta messagerie.
2. **Pas de situation personnelle** : santé, handicap (même pour justifier des travaux d'adaptation), situation familiale ou financière.
3. **Pas de documents complets** : devis, factures, contrats nominatifs. Retire d'abord les informations du client.
4. **Pas d'informations de sécurité** : codes d'accès, alarmes, absences, emplacement des clés.
5. **Règle tes paramètres** : désactive quand c'est possible l'utilisation de tes conversations pour l'entraînement, supprime l'historique inutile.

Pour en savoir plus : **cnil.fr** (rubriques pour les TPE et les artisans).

### Leçon 6.2 — La bibliothèque de prompts

Dans les notes de ton téléphone ou un document, crée ces rubriques :
1. **Base** : prompt de base artisan, mise au propre des notes dictées.
2. **Devis** : descriptif, contrôle de présence des mentions, message d'envoi, 3 relances.
3. **Checklist de mentions** : ta version validée, avec la date de dernière vérification sur service-public.fr.
4. **Impayés** : 4 étapes, message refroidi, conditions de paiement claires.
5. **Avis** : demande, réponse positive, réponse négative, avis suspect.
6. **Publications** : chantier, calendrier, description de fiche.

### Leçon 6.3 — Les instructions permanentes

Si ton outil le permet, enregistre des instructions valables pour toutes tes conversations :

```
Je suis [métier] à mon compte en France, secteur [zone]. Par défaut :
- vouvoiement des clients, ton simple, direct et chaleureux, phrases courtes, pas de jargon commercial ;
- tu n'inventes jamais de prix, quantité, délai, norme, qualification, label ou mention légale ;
- si une information manque, tu me poses la question ;
- tu me rappelles de vérifier les mentions et règles légales sur service-public.fr ;
- je ne te donne pas les données personnelles de mes clients ; si un texte en contient, signale-le.
```

### Leçon 6.4 — Ta voix

Pour que les textes te ressemblent, fais analyser 3 ou 4 messages que tu as écrits toi-même et dont tu es content :

```
Voici des messages que j'ai écrits à des clients (données personnelles retirées). Décris ma façon d'écrire en 6 règles concrètes (longueur des phrases, formules de politesse, mots que j'utilise souvent, niveau de formalité). Je les ajouterai à mes instructions.
"""
[messages]
"""
```

### Leçon 6.5 — La routine administrative de 30 minutes

Une proposition, à caler sur un créneau fixe (par exemple le vendredi en fin d'après-midi) :
1. **10 min — Devis** : descriptifs des visites de la semaine, relances des devis en attente.
2. **10 min — Factures** : factures des chantiers terminés envoyées, relances des impayés à l'étape suivante.
3. **5 min — Avis** : demande d'avis aux clients de la semaine, réponses aux nouveaux avis.
4. **5 min — Publication** : une publication programmée à partir d'un chantier.

Garde un tableau simple (papier, tableur ou logiciel) : devis envoyés et date de relance, factures et étape de relance. L'IA rédige, le tableau te dit quoi rédiger.

Mesure ton temps administratif sur quelques semaines. Si une tâche ne va pas plus vite avec l'IA, garde ta méthode habituelle pour celle-là.

### Exemple

Un couvreur crée une note « IA boulot » sur son téléphone avec ses 15 prompts. Le vendredi à 17 h, il dicte ses notes de la semaine, lance les prompts dans l'ordre de la routine, et envoie tout depuis son logiciel. Il met à jour sa checklist de mentions tous les six mois après vérification sur service-public.fr.

### Exercice

Crée ta bibliothèque avec au moins 12 prompts. Enregistre tes instructions permanentes. Bloque ton créneau de 30 minutes dans ton agenda pour les 4 prochaines semaines.

---

## Checklist finale

**Avant d'utiliser l'IA**
- [ ] Paramètres de confidentialité réglés.
- [ ] Aucun nom, adresse, téléphone ou situation personnelle de client dans ma demande.
- [ ] Aucun code d'accès ni information de sécurité.

**Devis**
- [ ] Descriptif clair, avec « compris » et « non compris ».
- [ ] Prix, quantités et TVA saisis par moi dans mon logiciel.
- [ ] Mentions obligatoires vérifiées sur service-public.fr (version en vigueur), modèle validé par un professionnel.
- [ ] Totaux vérifiés.
- [ ] Message d'envoi et relances programmées.

**Impayés**
- [ ] Facture vérifiée avant toute relance.
- [ ] Étapes graduées respectées, chaque envoi daté et conservé.
- [ ] Pénalités et références juridiques ajoutées seulement après vérification.
- [ ] Aucun message envoyé sous le coup de la colère, aucun harcèlement.

**Avis**
- [ ] Aucun faux avis, aucune contrepartie.
- [ ] Réponse à chaque avis, sans donnée personnelle.
- [ ] Avis négatif : réponse posée, rédigée pour les futurs clients.

**Publications**
- [ ] Accord du client pour les photos.
- [ ] Pas d'adresse, de visage, de plaque ni d'objet personnel visible.
- [ ] Conseils techniques vérifiés par moi.

**Système**
- [ ] Bibliothèque de prompts à jour.
- [ ] Routine de 30 minutes dans l'agenda.
- [ ] Temps administratif mesuré avant et après.

---

## Ressources

- **service-public.fr** et **entreprendre.service-public.fr** : devis, mentions obligatoires des devis et factures, délais de paiement, recouvrement des impayés, injonction de payer, médiation de la consommation.
- **cnil.fr** : protection des données pour les TPE et artisans, prospection.
- **Ta chambre de métiers et de l'artisanat** et **ton organisation professionnelle** : modèles, validation de tes documents, accompagnement.
- **Ton expert-comptable** : TVA, conditions de paiement, facturation.
- **Les règles de chaque plateforme d'avis** : demande d'avis, signalement, réponses.
- **Les conditions d'utilisation** de ton outil IA.

Dernier rappel : l'IA rédige, toi tu chiffres, tu vérifies et tu signes. Et les infos de tes clients restent chez toi.
