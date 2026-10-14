# Kit de lancement — Pass J-24 · Traceo

## 1. Le calcul honnête vers 100 € / jour

| Objectif | Ventes nécessaires |
|---|---|
| 100 € / jour au prix de lancement (19 €, net ≈ 18,45 €) | ≈ 5,5 ventes / jour |
| 100 € / jour au prix normal (29 €, net ≈ 28,30 €) | ≈ 3,5 ventes / jour |
| 3 000 € / mois | ≈ 105 ventes à 29 €, ou 600 abonnés Premium à 4,99 € |

- **Demain : 0 à 3 ventes.** C'est réaliste avec ton audience actuelle (≈ 491 abonnés, ≈ 200 vues par jour). Personne ne peut te garantir mieux.
- **Ce qui fait monter le chiffre :**
  - **les pages « Plan marathon de <ville> 2027 »**, qui captent des recherches Google tous les jours sans que tu postes ;
  - **les groupes Facebook et clubs Strava**, qui touchent des milliers de coureurs ;
  - **le bouche-à-oreille** : chaque acheteur partage son image « Ma prépa commence lundi ».
- **Saisonnalité.** Les marathons de printemps se vendent d'octobre à janvier. Ensuite :
  - **Kit 8x8** pour la course HYROX de décembre à Paris (déjà identifié) ;
  - **marathons d'automne 2027**, à partir de mai ;
  - **abonnement Premium**, pour le revenu récurrent.

## 2. Ta routine (30 à 60 min / jour)

| Quand | Quoi | Durée |
|---|---|---|
| Matin | Lire les e-mails Stripe/PayPal. Pour chaque vente PayPal : `npm run token -- email@client.fr` et envoyer le lien. Activer Premium dans admin.html. | 5-10 min |
| Midi | 1 post dans 1 groupe Facebook ou club Strava, avec l'accord de l'admin (texte B). | 10 min |
| Midi | 10 DM aux personnes qui ont réagi à @traceo.io (texte C). | 10 min |
| Soir | Répondre aux commentaires et messages, et republier en story l'image d'un acheteur, avec son accord. | 10-20 min |

Tout le reste est automatique : paiement, accès au plan, bascule à 29 € lundi 00:00 (GitHub Action), posts Instagram programmés (Metricool) et pages Google générées à chaque déploiement.

## 3. Textes prêts à envoyer

**A. WhatsApp / SMS à tes proches (jeudi 7:30-8:30, priorité absolue)**
> Salut [prénom] ! Question rapide : tu as été tiré au sort pour le marathon ou le semi de Paris ? Ou quelqu'un autour de toi ?
> J'ai sorti un truc sur Traceo, mon appli de boucles : un plan qui démarre lundi pile (24 semaines jusqu'au 4 avril), et chaque séance te génère une boucle de la bonne distance depuis chez toi.
> La semaine 1 est gratuite : [lien]/gratuit/. Le plan complet est à 19 € jusqu'à dimanche.
> Si tu connais quelqu'un qui a eu son dossard, tu peux lui transférer ? Ça m'aiderait vraiment.

**B. Groupe Facebook (après l'accord de l'admin)**
> Pour celles et ceux qui ont eu leur dossard pour le 4 avril (ou le semi du 7 mars) : du dimanche 18 octobre au dimanche 4 avril, il y a exactement 24 semaines. Le semi tombe pile à 20 semaines. Si vous partez sur un plan classique de 20 à 24 semaines, le premier jour, c'est lundi 19.
>
> J'ai fait un calendrier gratuit : vous entrez votre temps sur 10 km, votre niveau et votre nombre de séances, et il vous donne votre semaine 1 datée avec vos allures, plus la vue des 24 semaines (la semaine allégée tombe sur Noël) : [lien]/gratuit/
>
> Transparence : je développe Traceo, une appli web qui génère des boucles de course. Le plan complet est payant (19 € jusqu'à dimanche, 29 € ensuite). La semaine 1 et le calendrier restent gratuits. Si ce post n'a pas sa place ici, dites-le-moi et je le retire.

**C. DM Instagram**
> Salut [prénom], merci de suivre Traceo. Tu as une course ce printemps ? Si tu as un dossard pour le 4 avril ou le 7 mars, ta prépa commence lundi. Je t'ai préparé la semaine 1 gratuite : [lien]/gratuit/. Si tu veux tout le plan, avec une boucle pour chaque séance, c'est 19 € jusqu'à dimanche. Bonne prépa !

**D. Admin de groupe**
> Bonjour [prénom], je développe Traceo, une appli web française de boucles de course. J'ai fait un calendrier gratuit pour ceux qui préparent le 4 avril ou le 7 mars (semaine 1 datée et allures). Est-ce que je peux le partager dans le groupe ? J'indique qu'il existe une version payante, sans insister, et je retire le post si ça gêne. Merci !

**E. Dimanche 20:00, story ou statut WhatsApp**
> Dernier jour à 19 €. Demain, c'est le premier jour de ta prépa pour le 4 avril (ou le 7 mars). Le plan complet, une boucle depuis chez toi pour chaque séance, et Traceo Premium jusqu'au 5 avril. 19 € jusqu'à 23:59 ce soir, 29 € dès demain.

## 4. Où publier

- **Groupes Facebook :** cherche « marathon de Paris 2027 », « semi de Paris 2027 », « prépa marathon », « running Paris », « runneuses Paris ».
- **Clubs Strava** de coureurs parisiens et franciliens.
- **Run clubs parisiens :** propose la semaine 1 gratuite à leurs membres.
- **Médias running :** commentaires utiles, sans lien, sous leurs posts sur le tirage au sort.

## 5. Règles à respecter

- **Marque :** jamais « officiel », jamais le logo du marathon, jamais « coaching ». Écris « programme généré automatiquement ».
- **Prix :** jamais de prix barré. Écris « 19 € jusqu'à dimanche 23:59, puis 29 € ».
- **Messages :** pas plus de 30 DM par jour, pour ne pas être bloqué par Instagram.
- **E-mails :** n'envoie d'e-mail commercial qu'à tes clients ou à ceux qui l'ont accepté (règles CNIL).
