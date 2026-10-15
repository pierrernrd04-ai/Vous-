# SAV — Crée ton site ou ton outil sans coder, avec l'IA

## FAQ

**1. Faut-il installer un logiciel ?**
Non. Un éditeur de texte (le Bloc-notes ou TextEdit en texte brut suffisent) et un navigateur à jour suffisent. Un éditeur de code gratuit comme Visual Studio Code est plus confortable, mais optionnel.

**2. Puis-je suivre la masterclass sur téléphone ou tablette ?**
Tu peux la lire sur téléphone. Pour enregistrer, tester et déposer des fichiers, un ordinateur est nécessaire.

**3. L'hébergement gratuit est-il fiable ?**
Les hébergeurs de sites statiques cités (par exemple GitHub Pages, Netlify, Cloudflare Pages, Vercel) sont largement utilisés. Leurs offres gratuites ont des limites et peuvent évoluer : vérifie-les sur leurs sites, et garde toujours une copie locale de ton dossier.

**4. Mon site sera-t-il bien référencé sur les moteurs de recherche ?**
Une page bien structurée peut être trouvée, mais aucune position n'est garantie. Le référencement est un travail à part, que la masterclass ne couvre pas en détail.

**5. Puis-je ajouter un formulaire de contact ?**
C'est possible, mais un formulaire implique de savoir où vont les données, qui y a accès et combien de temps elles sont conservées, et d'en informer les visiteurs (voir cnil.fr). Pour commencer, la masterclass recommande un simple lien e-mail.

**6. Puis-je vendre sur ma page ?**
Oui, avec le lien ou le bouton officiel d'un prestataire de paiement reconnu. Ne crée jamais de formulaire qui collecte des numéros de carte.

**7. Le code généré m'appartient-il ?**
Les conditions d'utilisation de ton assistant IA précisent en général les droits sur les contenus générés : consulte-les. Pour les images, polices et textes que tu ajoutes, vérifie toujours leur licence.

**8. Combien de temps pour avoir une page en ligne ?**
La lecture prend 2 à 3 heures. Une première page simple peut être en ligne en une à deux semaines, à ton rythme, en incluant les tests et les mentions légales.

**9. Puis-je obtenir un remboursement ?**
Le contenu numérique est fourni immédiatement après l'achat, à ta demande expresse, et tu as renoncé à ton droit de rétractation en validant le paiement (art. L221-28 13° du Code de la consommation). En cas de problème d'accès, écris-moi : je le règle en priorité.

**10. Je n'ai pas reçu mon accès. Que faire ?**
Vérifie tes courriers indésirables, puis réponds à l'e-mail de confirmation ou écris à l'adresse de contact de la page, en indiquant l'adresse e-mail utilisée lors de l'achat.

---

## Réponses SAV prêtes à envoyer

### Réponse 1 — « Les accents s'affichent mal sur ma page »

Bonjour [Prénom],

Merci pour ton message : c'est un problème très fréquent, et facile à régler.

Il vient presque toujours de l'encodage du fichier. Vérifie deux choses :

1. **Dans le code**, tout en haut, dans la partie `<head>`, il doit y avoir la ligne `<meta charset="UTF-8">`. Si elle manque, demande à l'IA de l'ajouter.
2. **À l'enregistrement**, ton fichier doit être enregistré en UTF-8. Dans le Bloc-notes : « Enregistrer sous », puis choisis « UTF-8 » dans la liste « Encodage ». Dans TextEdit, assure-toi d'être en texte brut, puis choisis l'encodage UTF-8 à l'enregistrement si l'option est proposée. Dans un éditeur de code, l'encodage est généralement indiqué en bas de la fenêtre.

Réenregistre, rouvre la page dans le navigateur : les accents devraient s'afficher correctement.

Si ce n'est pas le cas, envoie-moi une capture d'écran de la page et les premières lignes de ton fichier.

Belle journée,
Pierre

### Réponse 2 — « Mes images ne s'affichent pas une fois en ligne »

Bonjour [Prénom],

Merci pour ta question. Si les images s'affichent sur ton ordinateur mais pas en ligne, voici les causes les plus courantes, dans l'ordre :

1. **Les majuscules** : en ligne, `Photo.JPG` et `photo.jpg` sont deux fichiers différents. Le nom dans le code doit être exactement identique au nom du fichier.
2. **Le dossier** : si ton code indique `images/bols.jpg`, le fichier doit être dans un dossier `images` déposé avec ta page.
3. **Les espaces et accents** dans les noms de fichiers : renomme en `atelier-tour.jpg` plutôt que `Atelier tour été.jpg`, puis corrige le code.
4. **Le chemin absolu** : si le code contient un chemin du type `C:\Users\...`, il ne fonctionne que sur ton ordinateur. Demande à l'IA de le remplacer par un chemin relatif.

Corrige, redépose ton dossier complet, et vérifie à nouveau (pense à recharger la page sans cache).

Belle journée,
Pierre

### Réponse 3 — « L'IA veut ajouter un formulaire avec une clé d'API dans le code »

Bonjour [Prénom],

Tu as bien fait de t'arrêter et de poser la question.

Règle du module 6 : **aucun secret dans ton code**. Tout ce qui est dans un fichier HTML ou JavaScript publié est lisible par n'importe quel visiteur. Une clé d'API exposée peut être réutilisée par quelqu'un d'autre, à tes frais ou à ton détriment.

Ce que je te conseille :
1. Refuse cette solution et demande à l'IA une alternative sans secret dans la page.
2. Pour un contact simple, reviens au lien e-mail (`mailto:`), qui ne nécessite aucune clé.
3. Si tu as vraiment besoin d'un formulaire, utilise un service spécialisé qui fournit un formulaire prêt à l'emploi selon sa documentation officielle, et vérifie où vont les données (information des visiteurs, voir cnil.fr).
4. Si le projet exige un traitement côté serveur, c'est le signe qu'il faut l'aide d'un professionnel.

Lance ensuite l'audit de sécurité de la leçon 6.3 pour vérifier qu'il ne reste rien.

Belle journée,
Pierre
