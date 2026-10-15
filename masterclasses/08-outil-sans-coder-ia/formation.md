# Crée ton site ou ton outil sans coder, avec l'IA

> Masterclass écrite · 6 modules · lecture 2 à 3 h · premier site en ligne en 7 à 14 jours

---

## Introduction

### Pour qui

Tu as besoin d'une page web simple : une page de présentation pour ton activité, une page d'événement, un mini-portfolio. Ou d'un petit outil : un calculateur de devis, une checklist interactive, un convertisseur, un quiz. Tu ne sais pas coder, tu ne veux pas payer un abonnement mensuel pour trois blocs de texte, et tu as entendu dire que l'IA peut écrire du code à ta place.

C'est vrai, dans certaines limites. Cette masterclass t'apprend à en tirer parti **proprement** : savoir ce que tu veux, le faire générer, le tester, le mettre en ligne gratuitement, l'améliorer, et surtout connaître les limites au-delà desquelles il faut un professionnel.

### Ce que tu sauras faire à la fin

- Écrire un **cahier des charges d'une page** que l'IA comprend.
- Faire générer une **page web complète** (un seul fichier HTML) et l'ouvrir sur ton ordinateur.
- Créer un **petit outil interactif** : calculateur, checklist, quiz.
- **Tester et corriger** sans lire le code ligne à ligne.
- **Héberger** ta page gratuitement et lui donner une adresse.
- **Itérer** proprement, en gardant des versions.
- Connaître les **limites et règles de sécurité** : ce que tu ne dois jamais faire seul.

### Ce dont tu as besoin

- Un ordinateur (Windows, Mac ou Linux). Un téléphone ne suffit pas pour les manipulations de fichiers.
- Un navigateur à jour (Firefox, Chrome, Edge, Safari).
- Un éditeur de texte. Le Bloc-notes ou TextEdit en mode texte brut suffisent ; un éditeur de code gratuit (comme Visual Studio Code) est plus confortable.
- Un assistant IA conversationnel (Claude ou un autre).

### Un mot sur les outils

Les assistants IA, les hébergeurs et leurs offres gratuites évoluent vite. Certains assistants affichent un aperçu direct du code généré, d'autres non ; certains hébergeurs changent leurs conditions. Je décris des méthodes durables : un fichier HTML reste un fichier HTML, et un hébergement de fichiers statiques fonctionne de la même façon partout. Les outils cités le sont à titre d'exemple, sans aucun partenariat. Vérifie toujours les conditions actuelles sur leurs sites.

### Comment suivre cette masterclass

Suis les modules dans l'ordre, avec un vrai projet en tête. Choisis un projet **petit** pour commencer : une page, ou un outil qui fait une seule chose. Tu pourras l'agrandir ensuite.

---

## Module 1 — Le cahier des charges : savoir ce que tu veux avant de demander

### Leçon 1.1 — Pourquoi l'IA a besoin d'un plan

Si tu demandes « Fais-moi un site pour ma boulangerie », l'IA va produire une page générique : un titre, trois blocs, des couleurs au hasard, du faux texte, peut-être des sections inutiles. Tu vas ensuite passer des heures à demander des corrections une par une.

Un cahier des charges d'une page t'oblige à décider **avant** : à quoi sert la page, pour qui, ce qu'elle contient, à quoi elle ressemble. L'IA devient alors un exécutant précis.

### Leçon 1.2 — Les 7 rubriques du cahier des charges

1. **Objectif** : à quoi sert la page, en une phrase. Quelle action le visiteur doit-il faire ? (appeler, réserver, calculer un prix, s'inscrire)
2. **Public** : qui visite, sur quel appareil (souvent un téléphone).
3. **Contenu** : la liste des sections, dans l'ordre, avec le **vrai texte** ou au moins les vraies informations.
4. **Fonctions** : ce qui est interactif (un bouton qui calcule, un formulaire, un menu). Pour une page simple : rien, ou un lien.
5. **Apparence** : 2 ou 3 couleurs, un style (sobre, chaleureux, moderne), un exemple de site que tu aimes et pourquoi.
6. **Contraintes techniques** : un seul fichier HTML, aucune dépendance externe ou seulement des polices, fonctionne sans serveur, adapté au mobile.
7. **Hors périmètre** : ce que la page ne fait pas (pas de paiement, pas de compte utilisateur, pas de base de données).

### Leçon 1.3 — Exemple complet : la page d'une céramiste

```text
# CAHIER DES CHARGES — Page atelier céramique

## Objectif
Présenter mon atelier et permettre aux visiteurs de me contacter
pour réserver un cours d'initiation.
Action principale : cliquer sur "Réserver un cours" (ouvre un e-mail).

## Public
Adultes de la région, curieux, majoritairement sur téléphone.

## Contenu (dans l'ordre)
1. En-tête : "Atelier Terre Douce", sous-titre "Cours de céramique
   à Angers", bouton "Réserver un cours".
2. Présentation : "Je m'appelle Inès, je tourne la terre depuis
   12 ans. Mon atelier accueille 6 personnes maximum."
3. Les cours :
   - Initiation tournage, 3 h, 65 €
   - Modelage à la main, 2 h, 45 €
   - Atelier parent-enfant, 2 h, 70 € les deux
4. Infos pratiques : adresse [ADRESSE], horaires mardi-samedi,
   accès tram ligne A.
5. Contact : e-mail [EMAIL], téléphone [TÉLÉPHONE].
6. Pied de page : lien "Mentions légales".

## Fonctions
- Bouton "Réserver un cours" = lien mailto vers mon e-mail avec
  l'objet "Réservation cours".
- Pas de formulaire.

## Apparence
Couleurs : terre cuite (#C0623B), crème (#F6EFE6), brun foncé
pour le texte. Style chaleureux et sobre, beaucoup d'espace.
Police lisible sans empattement.

## Contraintes techniques
- Un seul fichier index.html, CSS intégré, pas de JavaScript sauf
  si indispensable.
- Responsive : parfaite lisibilité sur téléphone.
- Aucune ressource externe, sauf éventuellement une police.
- Accessible : contrastes suffisants, textes alternatifs sur les images.

## Hors périmètre
Pas de paiement, pas de réservation en ligne, pas de compte client.
```

### Leçon 1.4 — Faire relire ton cahier des charges par l'IA

```text
Voici le cahier des charges d'une page web que je veux faire
générer. Avant de coder quoi que ce soit, relis-le et liste :
1. Les informations manquantes qui t'obligeraient à deviner.
2. Les contradictions éventuelles.
3. Les éléments trop complexes pour une page statique sans serveur
   (à retirer ou à simplifier).
4. Les obligations à ne pas oublier pour une page publique en
   France (mentions légales, etc.), en me renvoyant vers les
   sources officielles.
Ne génère pas encore de code.

"""
[CAHIER DES CHARGES]
"""
```

**Exemple de résultat attendu (extrait) :**

> 1. **Manquant** : images (as-tu des photos de l'atelier ? Si oui, noms des fichiers) ; texte de la page « Mentions légales ».
> 3. **Complexité** : aucune, tout est réalisable en HTML/CSS statique.
> 4. **Obligations** : une page professionnelle doit comporter des mentions légales (identité, contact, hébergeur). Vérifie la liste sur service-public.fr.

### Exercice du module 1

Écris le cahier des charges de ton projet avec les 7 rubriques. Rédige le **vrai texte** de chaque section (pas de « lorem ipsum »). Fais-le relire par l'IA et complète.

### Modèle à copier — Cahier des charges vierge

```text
# CAHIER DES CHARGES — [Nom du projet]
## Objectif
[À quoi sert la page] · Action principale : [ ]
## Public
[Qui] · Appareil principal : [téléphone / ordinateur]
## Contenu (dans l'ordre)
1. [Section] : [texte réel]
2. ...
## Fonctions
[Liste, ou "aucune"]
## Apparence
Couleurs : [ ] · Style : [ ] · Référence : [site + ce que j'aime]
## Contraintes techniques
Un seul fichier index.html · CSS intégré · responsive · accessible
· aucune ressource externe sauf [ ]
## Hors périmètre
[Ce que la page ne fait pas]
```

---

## Module 2 — Faire générer ta première page

### Leçon 2.1 — Pourquoi un seul fichier HTML

Pour un premier projet, demande **un seul fichier** `index.html` qui contient tout : la structure (HTML), l'apparence (CSS) et, si besoin, l'interactivité (JavaScript). Avantages :

- tu l'ouvres en double-cliquant dessus, sans rien installer ;
- tu le mets en ligne en déposant un seul fichier ;
- tu le sauvegardes et le versionnes facilement.

### Leçon 2.2 — Le prompt de génération

```text
Tu vas générer une page web à partir du cahier des charges
ci-dessous.

Règles techniques :
- Un seul fichier complet index.html, du <!DOCTYPE html> à </html>.
- CSS dans une balise <style> dans le <head>.
- JavaScript seulement si le cahier des charges l'exige, dans une
  balise <script> en fin de <body>.
- Balise <meta name="viewport"> pour le mobile.
- HTML sémantique (header, main, section, footer), langue "fr".
- Contrastes de couleurs lisibles, textes alternatifs sur les images.
- Aucune bibliothèque externe, aucun service tiers, aucun traceur.
- Utilise exactement mes textes. N'invente ni avis clients, ni
  chiffres, ni informations.
- Commente brièvement en français chaque grande partie du code,
  pour que je puisse me repérer.

Donne le fichier complet en un seul bloc de code, puis en dessous,
3 lignes maximum pour m'expliquer comment l'ouvrir.

"""
[CAHIER DES CHARGES]
"""
```

### Leçon 2.3 — Ce que tu dois obtenir

L'IA te renvoie un long bloc de code. Voici à quoi ressemble le début d'un résultat correct (extrait) :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Atelier Terre Douce — Cours de céramique à Angers</title>
  <style>
    /* Couleurs principales */
    :root {
      --terre: #C0623B;
      --creme: #F6EFE6;
      --texte: #3B2A20;
    }
    body {
      margin: 0;
      font-family: system-ui, sans-serif;
      background: var(--creme);
      color: var(--texte);
      line-height: 1.6;
    }
    /* Bouton principal */
    .bouton {
      display: inline-block;
      background: var(--terre);
      color: #fff;
      padding: 14px 24px;
      border-radius: 8px;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <!-- En-tête -->
  <header>
    <h1>Atelier Terre Douce</h1>
    <p>Cours de céramique à Angers</p>
    <a class="bouton" href="mailto:[EMAIL]?subject=Réservation%20cours">
      Réserver un cours
    </a>
  </header>
  <!-- ... suite de la page ... -->
</body>
</html>
```

Tu n'as pas besoin de tout comprendre. Repère seulement : le `<!DOCTYPE html>` au début, le `</html>` à la fin, et tes textes au milieu.

### Leçon 2.4 — Enregistrer et ouvrir le fichier

1. Crée un dossier pour ton projet, par exemple `site-atelier`.
2. Ouvre ton éditeur de texte, colle **tout** le code.
3. Enregistre sous le nom `index.html`, encodage **UTF-8**. Dans le Bloc-notes, choisis « Tous les fichiers » comme type pour éviter `index.html.txt`. Dans TextEdit sur Mac, passe d'abord en « Format > Convertir au format texte ».
4. Double-clique sur le fichier : il s'ouvre dans ton navigateur.

Si tu vois des caractères bizarres à la place des accents, le fichier n'est pas enregistré en UTF-8 ou il manque `<meta charset="UTF-8">`.

### Leçon 2.5 — Les images

- Place tes images dans le même dossier que `index.html` (ou dans un sous-dossier `images/`).
- Donne-leur des noms simples, sans espaces ni accents : `atelier-tour.jpg`.
- Réduis leur poids avant de les ajouter (un outil de compression d'images gratuit suffit ; vise quelques centaines de Ko maximum par image).
- Indique les noms de fichiers à l'IA : « Ajoute la photo `atelier-tour.jpg` dans la section présentation, avec le texte alternatif "Inès au tour de potier" ».
- N'utilise que des images dont tu as les droits : tes photos, ou des images sous licence libre dont tu as vérifié les conditions.

### Exercice du module 2

Génère ta page avec le prompt, enregistre-la, ouvre-la dans ton navigateur. Vérifie que tous tes textes y sont, sans invention. Ouvre-la aussi en mode mobile (voir module 3).

### Modèle à copier — Arborescence de projet

```text
site-atelier/
├── index.html
├── mentions-legales.html
├── images/
│   ├── atelier-tour.jpg
│   └── bols.jpg
└── versions/
    ├── index-v1.html
    └── index-v2.html
```

---

## Module 3 — Tester et itérer sans savoir coder

### Leçon 3.1 — La checklist de test

Ouvre ta page et vérifie, dans cet ordre :

1. **Contenu** : tous les textes sont là, sans faute, sans invention.
2. **Liens** : chaque bouton et lien mène au bon endroit (e-mail, téléphone, autre page).
3. **Mobile** : dans ton navigateur, ouvre les outils de développement (touche F12, ou clic droit > « Inspecter ») et active le mode d'affichage mobile (une icône de téléphone/tablette). Fais défiler toute la page.
4. **Lisibilité** : texte assez grand, contrastes suffisants, rien ne déborde sur les côtés.
5. **Vitesse** : la page s'affiche immédiatement. Si elle est lente, tes images sont probablement trop lourdes.

### Leçon 3.2 — Décrire un problème pour qu'il soit corrigé

L'IA corrige bien quand tu décris précisément : **où**, **quoi**, **attendu**.

```text
Voici mon fichier index.html actuel :
"""
[CODE COMPLET]
"""
Problèmes constatés :
1. Sur téléphone (largeur 375 px), les trois cartes de cours
   débordent à droite de l'écran. Attendu : les cartes s'empilent
   les unes sous les autres.
2. Le bouton "Réserver un cours" est trop petit sur mobile.
   Attendu : pleine largeur sur mobile, taille actuelle sur ordinateur.
Corrige uniquement ces deux problèmes. Ne change rien d'autre.
Donne le fichier complet corrigé, puis liste en 2 lignes ce que
tu as modifié.
```

La phrase « Ne change rien d'autre » est importante : sans elle, l'IA peut « améliorer » des parties qui fonctionnaient.

### Leçon 3.3 — Lire les erreurs avec la console

Si un outil interactif ne fonctionne pas (un bouton ne fait rien), ouvre les outils de développement (F12) et l'onglet **Console**. Les erreurs y apparaissent souvent en rouge. Copie-les telles quelles :

```text
Quand je clique sur "Calculer", rien ne se passe. La console
affiche cette erreur :
"""
[ERREUR COPIÉE]
"""
Explique-moi en une phrase simple la cause, puis donne le fichier
complet corrigé.
```

### Leçon 3.4 — Garder des versions

Avant chaque série de modifications, copie ton fichier dans le dossier `versions/` en le renommant (`index-v1.html`, `index-v2.html`). Si une correction casse quelque chose, tu reviens en arrière en une seconde.

Pour aller plus loin, des outils de gestion de versions comme Git existent, mais ils ne sont pas nécessaires pour commencer.

### Leçon 3.5 — Les demandes d'amélioration

Une fois la page fonctionnelle, améliore-la par petites touches, une demande à la fois :

```text
Améliore la hiérarchie visuelle de la section "Les cours" :
le nom du cours doit ressortir, puis la durée et le prix sur
une même ligne, en plus petit. Garde mes couleurs.
Ne change rien d'autre. Fichier complet.
```

```text
Relis ce fichier comme un expert en accessibilité web.
Liste les problèmes (contrastes, textes alternatifs, titres,
navigation au clavier, taille des zones cliquables), du plus
important au moins important. Ne corrige pas encore.
```

Une demande à la fois, un test après chaque demande, une version sauvegardée avant chaque changement important.

### Leçon 3.6 — Quand le fichier devient long

Les longs fichiers peuvent dépasser ce que l'IA renvoie en une réponse, ou être tronqués. Signes : le code s'arrête au milieu, ou le `</html>` final manque. Solutions :

- Demande seulement la partie à modifier : « Donne-moi uniquement le nouveau bloc CSS pour `.cartes`, et dis-moi exactement quel bloc il remplace. »
- Remplace ce bloc toi-même dans ton éditeur, avec la fonction de recherche.
- Vérifie toujours que le fichier se termine par `</html>`.

### Exercice du module 3

Applique la checklist de test. Corrige au moins deux problèmes avec le prompt « où, quoi, attendu ». Lance la relecture accessibilité et corrige les trois premiers points. Sauvegarde chaque version.

### Modèle à copier — Prompt de correction

```text
Fichier actuel : """[CODE]"""
Problème : [où] — [ce que je vois].
Attendu : [ce que je veux voir].
Corrige uniquement ce problème. Ne change rien d'autre.
Fichier complet, puis 2 lignes sur ce qui a changé.
```

---

## Module 4 — Créer un petit outil interactif

### Leçon 4.1 — Ce qu'un outil simple peut faire

Avec un seul fichier HTML et un peu de JavaScript généré par l'IA, tu peux créer des outils qui fonctionnent entièrement dans le navigateur :

- **Calculateur** : estimation de prix, conversion d'unités, simulation simple.
- **Checklist interactive** : cases à cocher, progression, mémorisée dans le navigateur.
- **Quiz** : questions, score, correction.
- **Générateur** : produit un texte à partir de quelques champs (par exemple une signature d'e-mail).
- **Minuteur ou planning** : compte à rebours d'exercices, planning de révision.

Tout ce qui ne nécessite **ni stockage partagé entre utilisateurs, ni compte, ni paiement, ni données sensibles** est à ta portée.

### Leçon 4.2 — Le cahier des charges d'un outil

Pour un outil, ajoute trois rubriques : **entrées** (ce que l'utilisateur saisit), **calcul ou règles** (ce que l'outil fait), **sorties** (ce qu'il affiche). Et donne **des exemples chiffrés** : ce sont eux qui permettent de vérifier que l'outil calcule juste.

```text
# CAHIER DES CHARGES — Calculateur de devis de peinture

## Objectif
Donner une estimation indicative du prix d'une peinture de pièce.

## Entrées
- Surface des murs en m² (nombre, obligatoire, entre 1 et 500)
- Nombre de couches : 1 ou 2 (menu déroulant, défaut 2)
- Préparation des murs : légère / importante (boutons radio)

## Règles de calcul
- Prix de base : 18 € par m² et par couche
- Préparation importante : + 6 € par m² (une seule fois)
- Total arrondi à l'euro

## Sorties
- Le total estimé, en gros
- Le détail du calcul en une ligne
- La mention : "Estimation indicative, non contractuelle.
  Devis précis après visite."

## Exemples pour vérifier
- 30 m², 2 couches, légère → 30 × 18 × 2 = 1 080 €
- 30 m², 2 couches, importante → 1 080 + 30 × 6 = 1 260 €
- 12 m², 1 couche, légère → 216 €

## Comportement
- Calcul mis à jour dès qu'une valeur change.
- Si la surface est vide ou hors limites : message clair, pas de total.

## Contraintes techniques
Un seul fichier HTML, JavaScript simple sans bibliothèque,
responsive, accessible (étiquettes sur tous les champs).
Aucune donnée envoyée nulle part.
```

### Leçon 4.3 — Le prompt de génération d'outil

```text
Génère l'outil décrit dans ce cahier des charges.
Mêmes règles techniques que pour une page (un seul fichier
index.html complet, CSS et JS intégrés, aucune ressource externe,
code commenté en français).
En plus :
- Sépare clairement dans le JavaScript les paramètres modifiables
  (prix, limites) en haut du script, avec un commentaire, pour que
  je puisse les changer moi-même.
- Valide les entrées et affiche des messages d'erreur clairs.
- Après le code, donne-moi un tableau de tests : pour chacun de mes
  exemples, le résultat que l'outil doit afficher.

"""
[CAHIER DES CHARGES]
"""
```

**Exemple de résultat attendu (extrait du script) :**

```html
<script>
  // === PARAMÈTRES MODIFIABLES ===
  const PRIX_M2_PAR_COUCHE = 18;   // en euros
  const SUPPLEMENT_PREPARATION = 6; // en euros par m²
  const SURFACE_MIN = 1;
  const SURFACE_MAX = 500;

  // === CALCUL ===
  function calculer() {
    const surface = parseFloat(document.getElementById('surface').value);
    const couches = parseInt(document.getElementById('couches').value, 10);
    const prepa = document.querySelector('input[name="prepa"]:checked').value;
    const sortie = document.getElementById('resultat');

    if (isNaN(surface) || surface < SURFACE_MIN || surface > SURFACE_MAX) {
      sortie.textContent = 'Indique une surface entre 1 et 500 m².';
      return;
    }
    let total = surface * PRIX_M2_PAR_COUCHE * couches;
    if (prepa === 'importante') total += surface * SUPPLEMENT_PREPARATION;
    sortie.textContent = Math.round(total).toLocaleString('fr-FR') + ' €';
  }
</script>
```

Grâce au bloc « paramètres modifiables », tu peux changer ton prix au m² toi-même, sans redemander à l'IA.

### Leçon 4.4 — Tester les calculs

**Ne fais jamais confiance à un calcul sans l'avoir testé.** Saisis chacun de tes exemples dans l'outil et compare avec le résultat attendu. Teste aussi les cas limites : champ vide, zéro, nombre négatif, très grand nombre, virgule au lieu du point (« 12,5 »). Ce dernier cas pose souvent problème en français : selon la façon dont le code lit le champ, l'outil peut refuser la valeur, ou pire, la tronquer silencieusement (12,5 lu comme 12). Compare toujours avec ton résultat attendu.

```text
Test : quand je saisis "12,5" dans la surface, l'outil calcule
comme si j'avais saisi 12 (résultat 216 € au lieu de 225 €).
Attendu : accepter la virgule comme séparateur décimal.
Corrige uniquement ça. Fichier complet.
```

### Leçon 4.5 — Mémoriser dans le navigateur

Pour une checklist ou un outil personnel, tu peux demander que l'état soit sauvegardé **dans le navigateur de l'utilisateur** (stockage local). C'est pratique, mais à connaître :

- les données restent sur l'appareil et le navigateur de la personne, elles ne sont pas partagées ;
- elles peuvent être effacées (navigation privée, nettoyage du navigateur) ;
- ne stocke jamais de données sensibles de cette façon.

```text
Ajoute la sauvegarde automatique des cases cochées dans le
stockage local du navigateur, pour qu'elles soient conservées
si la personne recharge la page. Ajoute un bouton
"Tout réinitialiser". Le site doit continuer à fonctionner
normalement si le stockage local n'est pas disponible.
```

### Exercice du module 4

Écris le cahier des charges d'un outil utile à ton activité, avec au moins 3 exemples chiffrés. Génère-le, teste tous les exemples et 4 cas limites. Corrige jusqu'à ce que tout passe.

### Modèle à copier — Tableau de tests

```text
| Entrées | Résultat attendu | Résultat obtenu | OK ? |
|---|---|---|---|
| [exemple 1] | [ ] | [ ] | [ ] |
| [exemple 2] | [ ] | [ ] | [ ] |
| champ vide | message d'erreur | [ ] | [ ] |
| valeur négative | message d'erreur | [ ] | [ ] |
| virgule décimale | calcul correct | [ ] | [ ] |
```

---

## Module 5 — Mettre en ligne gratuitement

### Leçon 5.1 — Ce qu'est un hébergement statique

Ta page est un fichier « statique » : il n'a besoin d'aucun serveur qui calcule quoi que ce soit, seulement d'un endroit qui le distribue aux visiteurs. Plusieurs services proposent ce type d'hébergement avec une offre gratuite, par exemple **GitHub Pages**, **Netlify**, **Cloudflare Pages** ou **Vercel**. Leurs conditions, limites et interfaces évoluent : vérifie-les sur leurs sites avant de choisir.

Le principe est presque toujours le même :
1. Créer un compte.
2. Créer un nouveau site ou projet.
3. Déposer ton dossier (glisser-déposer dans le navigateur, ou relier un dépôt de fichiers).
4. Le service te donne une adresse du type `nom-du-projet.service.app`.

### Leçon 5.2 — La méthode du glisser-déposer

Plusieurs hébergeurs permettent de déposer directement un dossier depuis le navigateur. C'est la méthode la plus simple pour commencer :

1. Vérifie que ton dossier contient bien `index.html` **à la racine** (pas dans un sous-dossier).
2. Retire le dossier `versions/` et tout fichier qui n'a rien à faire en ligne.
3. Connecte-toi à l'hébergeur, cherche l'option de création de site par dépôt de fichiers, et dépose ton dossier.
4. Ouvre l'adresse fournie sur ton ordinateur **et** sur ton téléphone.

Pour mettre à jour : dépose la nouvelle version du dossier sur le même projet.

Si tu bloques sur une interface, demande à l'IA de t'accompagner, en lui décrivant précisément ce que tu vois :

```text
Je veux mettre en ligne un site statique (un dossier avec
index.html et des images) sur [nom de l'hébergeur], avec la
méthode la plus simple, sans ligne de commande.
Guide-moi étape par étape, une étape à la fois. Après chaque
étape, attends que je te décrive ce que je vois à l'écran.
Si tu n'es pas sûr de l'interface actuelle, dis-le et
indique-moi quoi chercher dans la documentation officielle.
```

### Leçon 5.3 — Un nom de domaine (optionnel)

L'adresse gratuite fonctionne. Si tu veux une adresse à ton nom (`atelier-terre-douce.fr`), il faut acheter un nom de domaine auprès d'un registraire (un abonnement annuel payant), puis le relier à ton hébergeur. La procédure est décrite dans la documentation de chaque hébergeur, dans une rubrique du type « domaine personnalisé ». Elle consiste en général à ajouter un ou deux enregistrements DNS chez ton registraire. Compte quelques heures de propagation.

### Leçon 5.4 — Les mentions légales

Une page web à caractère professionnel doit comporter des **mentions légales** : identité de l'éditeur, coordonnées, numéro d'immatriculation le cas échéant, directeur de la publication, identité et coordonnées de l'hébergeur. Les informations exactes dépendent de ta situation (particulier, entreprise individuelle, société, association). **Vérifie la liste à jour sur service-public.fr** (fiche « Quelles sont les mentions obligatoires sur un site internet ? »).

L'IA peut générer la **page** `mentions-legales.html` dans le même style que ton site, à partir des informations que **tu** fournis :

```text
Génère une page mentions-legales.html dans le même style que mon
index.html (mêmes couleurs, même police, lien retour vers
l'accueil). Utilise uniquement les informations suivantes, sans
rien inventer ni compléter :
"""
[TES INFORMATIONS, vérifiées sur service-public.fr]
"""
Laisse [À COMPLÉTER] pour toute rubrique dont je n'ai pas donné
l'information.
```

Si ton site collecte des données personnelles (formulaire, statistiques de visite avec traceurs), d'autres obligations s'appliquent (information des personnes, consentement aux cookies selon les cas) : voir **cnil.fr**.

### Leçon 5.5 — Vérifications après mise en ligne

- L'adresse s'ouvre sur ordinateur et téléphone, en `https://`.
- Toutes les images s'affichent (attention aux majuscules : `Photo.JPG` et `photo.jpg` sont deux fichiers différents en ligne).
- Tous les liens fonctionnent, y compris mentions légales et e-mail.
- Le titre de l'onglet est correct.

### Exercice du module 5

Mets ta page en ligne sur l'hébergeur de ton choix. Crée la page de mentions légales. Fais les vérifications de la leçon 5.5. Envoie l'adresse à deux personnes et demande-leur ce qui n'est pas clair.

### Modèle à copier — Fiche projet

```text
Projet : [nom]
Hébergeur : [ ] · Compte : [e-mail utilisé]
Adresse : [ ]
Nom de domaine : [ ] chez [registraire] · renouvellement : [date]
Dernière mise en ligne : [date] · version : [v ]
Conditions de l'offre gratuite vérifiées le : [date]
```

---

## Module 6 — Limites et sécurité : ce que tu ne fais pas seul

### Leçon 6.1 — Ce que l'IA fait bien, ce qu'elle fait mal

**Bien :** pages vitrines, mises en page, petits outils de calcul, checklists, quiz, prototypes pour montrer une idée.

**Mal ou risqué sans compétence :** tout ce qui implique des données d'utilisateurs stockées sur un serveur, des comptes et mots de passe, des paiements, des données sensibles, des applications complexes à maintenir. Le code généré peut sembler fonctionner tout en contenant des failles invisibles pour un non-spécialiste.

### Leçon 6.2 — Les règles de sécurité non négociables

1. **Aucun secret dans ton code.** Ne mets jamais de mot de passe, clé d'API, identifiant de connexion ou jeton dans un fichier HTML ou JavaScript. Tout ce qui est dans ta page est lisible par n'importe quel visiteur (clic droit > « Afficher le code source »).
2. **Pas de paiement fait maison.** Pour vendre, utilise un prestataire de paiement reconnu et son lien ou son bouton officiel. Ne fais jamais générer un formulaire qui collecte des numéros de carte.
3. **Pas de formulaire collectant des données sans réflexion.** Un formulaire de contact implique de savoir où vont les données, qui y a accès, combien de temps elles sont gardées, et d'en informer les personnes (RGPD, voir cnil.fr). Pour commencer, un simple lien e-mail (`mailto:`) évite ce problème.
4. **Pas de données sensibles** (santé, identité, données bancaires) dans un outil fait sans professionnel.
5. **Vérifie les ressources externes.** Si l'IA ajoute un script hébergé ailleurs (bibliothèque, police, statistiques), demande-lui ce que c'est et pourquoi. Moins tu en as, moins tu dépends de tiers, et moins tu transmets de données de tes visiteurs.

### Leçon 6.3 — L'audit de sécurité par l'IA

Avant de publier, fais relire ton fichier :

```text
Relis ce fichier HTML comme un auditeur de sécurité et de
confidentialité. Vérifie et liste :
1. Tout secret, identifiant ou clé présent dans le code.
2. Toute ressource externe chargée (scripts, polices, images,
   iframes), avec son domaine et ce qu'elle implique pour la
   vie privée des visiteurs.
3. Tout envoi de données vers l'extérieur.
4. Tout usage du stockage du navigateur et ce qui y est stocké.
5. Toute insertion de texte saisi par l'utilisateur dans la page
   qui pourrait poser un problème de sécurité.
Pour chaque point : gravité (haute/moyenne/faible) et correction
proposée. Si tout est en ordre sur un point, écris-le.

"""
[CODE]
"""
```

Cet audit ne remplace pas un professionnel pour un projet sensible. Il attrape les erreurs grossières, ce qui est déjà beaucoup.

### Leçon 6.4 — Les autres limites à connaître

- **Maintenance.** Un site statique simple demande peu d'entretien. Mais si tes informations changent (prix, horaires), c'est à toi de mettre à jour. Note-toi un rappel tous les trois mois.
- **Référencement.** Une page bien construite (titre, description, structure claire, contenu utile) peut être trouvée par les moteurs de recherche, mais rien ne garantit une bonne position. Le référencement est un travail à part.
- **Accessibilité.** Une page lisible par tous (contrastes, textes alternatifs, navigation au clavier) est une bonne pratique, et une obligation pour certains acteurs. Fais la relecture accessibilité du module 3.
- **Droits.** Textes, images, polices et icônes doivent être utilisés conformément à leur licence. Ne fais pas reproduire par l'IA le design ou les textes d'un site existant.
- **Dépendance à l'hébergeur.** Les offres gratuites peuvent changer. Garde toujours une copie locale de ton dossier : tu pourras le déposer ailleurs en quelques minutes.

### Leçon 6.5 — Quand faire appel à un professionnel

Fais appel à un développeur ou une agence si ton projet nécessite :
- des comptes utilisateurs ou un espace membre ;
- une base de données partagée ;
- des paiements intégrés au-delà d'un lien de prestataire ;
- des données personnelles ou sensibles en quantité ;
- une boutique en ligne avec gestion de stock ;
- une forte fréquentation ou un enjeu commercial important.

Ton travail n'est pas perdu : ton cahier des charges et ton prototype seront de très bons supports pour expliquer ton besoin et obtenir un devis précis.

Tu peux aussi envisager des outils de création de sites « sans code » avec interface visuelle, qui gèrent eux-mêmes l'hébergement, la sécurité et certaines fonctions (formulaires, paiements). Compare leurs abonnements et leurs conditions avec ton besoin réel.

### Exercice du module 6

Lance l'audit de sécurité sur ton fichier. Corrige tous les points de gravité haute et moyenne. Fais la liste de ce que ton projet pourrait devenir dans un an, et identifie le moment où il faudrait passer à un professionnel ou à un outil spécialisé.

### Modèle à copier — Checklist sécurité avant publication

```text
[ ] Aucun mot de passe, clé ou identifiant dans le code
[ ] Aucun paiement fait maison
[ ] Aucun formulaire collectant des données sans information RGPD
[ ] Ressources externes listées et justifiées (idéalement aucune)
[ ] Stockage navigateur : rien de sensible
[ ] Audit de sécurité IA lancé et points corrigés
[ ] Mentions légales en ligne
[ ] Copie locale du dossier sauvegardée
```

---

## Checklist finale

**Préparer**
- [ ] Mon cahier des charges suit les 7 rubriques, avec mes vrais textes.
- [ ] Il a été relu par l'IA et complété.

**Générer**
- [ ] Ma page est un fichier `index.html` unique, en UTF-8, qui s'ouvre dans mon navigateur.
- [ ] Mes images sont légères, bien nommées, et j'en ai les droits.
- [ ] Aucun texte inventé (avis, chiffres) ne figure sur la page.

**Tester et itérer**
- [ ] J'ai appliqué la checklist de test (contenu, liens, mobile, lisibilité, vitesse).
- [ ] Je corrige avec « où, quoi, attendu » et « ne change rien d'autre ».
- [ ] Je sauvegarde une version avant chaque changement important.
- [ ] La relecture accessibilité est faite.

**Outil (si concerné)**
- [ ] Les paramètres modifiables sont regroupés en haut du script.
- [ ] Tous mes exemples et cas limites passent.

**Publier**
- [ ] Ma page est en ligne, vérifiée sur ordinateur et téléphone.
- [ ] Ma page de mentions légales est en ligne (vérifiée sur service-public.fr).
- [ ] Ma fiche projet est remplie.

**Sécuriser**
- [ ] La checklist sécurité est cochée en entier.
- [ ] Je sais à quel moment mon projet nécessiterait un professionnel.

---

## Ressources

### Sources officielles et documentation

- **service-public.fr** — mentions obligatoires d'un site internet.
- **cnil.fr** — formulaires, cookies et traceurs, données personnelles.
- **Documentation officielle de ton hébergeur** — mise en ligne, domaine personnalisé, limites de l'offre gratuite.
- **MDN Web Docs (developer.mozilla.org)** — documentation de référence en français et en anglais sur HTML, CSS et JavaScript, utile pour comprendre ce que l'IA a écrit.

### Récapitulatif des prompts

| # | Prompt | Module |
|---|---|---|
| 1 | Relecture du cahier des charges | 1 |
| 2 | Génération de page en un fichier | 2 |
| 3 | Correction « où, quoi, attendu » | 3 |
| 4 | Correction à partir d'une erreur de console | 3 |
| 5 | Amélioration ciblée | 3 |
| 6 | Relecture accessibilité | 3 |
| 7 | Génération d'outil avec paramètres modifiables | 4 |
| 8 | Correction de cas limite | 4 |
| 9 | Sauvegarde dans le navigateur | 4 |
| 10 | Accompagnement pas à pas pour la mise en ligne | 5 |
| 11 | Page de mentions légales | 5 |
| 12 | Audit de sécurité et de confidentialité | 6 |

### Dernier conseil

Commence par une page qui fait une seule chose, et fais-la bien. Une page simple, claire, en ligne cette semaine, vaut mieux qu'un projet ambitieux qui reste dans un dossier.
