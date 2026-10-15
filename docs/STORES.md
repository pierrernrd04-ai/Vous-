# Pass J-24 sur l'App Store et Google Play

Mise à jour : 14/10/2026. Les règles des stores changent souvent : relire les liens officiels avant chaque soumission.

## En bref

- **Lancement du 19/10/2026 : le site et la PWA** (installable depuis `/plan/`, « Partager → Sur l'écran d'accueil » sur iPhone). Aucune version store ne peut être en ligne d'ici là.
- **Chemin recommandé : intégrer le Pass dans l'app Traceo existante** (même dépôt, même compte développeur), plutôt que publier une app « Pass J-24 » séparée. Détails en fin de document.
- **En France, un contenu numérique vendu dans une app passe par l'achat intégré** : In-App Purchase (Apple) ou Google Play Billing. La version store doit donc soit proposer l'achat intégré, soit être une app compagnon qui ne vend rien.

## Ce qui est prêt dans ce dépôt

- `capacitor.config.json` : `appId` `io.traceo.pass`, `appName` « Pass J-24 », `webDir` `dist`. Capacitor n'est **pas installé**.
- Pour générer les projets natifs plus tard :

  ```sh
  npm i -D @capacitor/cli @capacitor/core @capacitor/android @capacitor/ios
  npx cap add android && npx cap add ios
  npm run build && npx cap sync
  ```

- **À faire avant une version store** :
  - Dans l'app, les pages sont servies depuis `https://localhost` (Android) ou `capacitor://localhost` (iOS) : les appels relatifs à `/api/*` doivent viser le site (URL absolue configurable) et l'API doit accepter ces origines (CORS).
  - Prévoir une variante de build « store » sans prix, sans fenêtre d'achat et sans lien vers une page de paiement (voir les règles de paiement ci-dessous).

## Apple App Store

**Coût** : Apple Developer Program, 99 USD par an (facturés en monnaie locale).

**Étapes**

1. **Inscription** sur developer.apple.com, avec un identifiant Apple protégé par la double authentification.
   - Compte individuel : validé en 24 à 48 h en général.
   - Compte organisation : numéro D-U-N-S obligatoire (gratuit). Son obtention peut prendre plusieurs jours, voire quelques semaines.
2. **Statut de professionnel (DSA)** dans App Store Connect, obligatoire pour être distribué dans l'UE. Une EI qui vend est un professionnel : adresse, téléphone et e-mail sont affichés sur la fiche de l'app. Il faut donc d'abord compléter `src/legal.ts`.
3. **Créer l'app** dans App Store Connect (identifiant de bundle `io.traceo.pass`) et renseigner :
   - la fiche : nom, sous-titre, description, mots-clés, captures iPhone 6,9 pouces (par exemple 1290 × 2796), URL d'assistance ;
   - l'URL de la politique de confidentialité (`/confidentialite/`) ;
   - le questionnaire « Confidentialité de l'app » (e-mail, réglages du plan, aucun suivi publicitaire) ;
   - la classification par âge ;
   - la conformité à l'export : HTTPS seulement, donc `ITSAppUsesNonExemptEncryption = NO`.
4. **Construire et envoyer** le build avec Xcode sur un Mac (ou un service de build macOS dans le cloud), avec le SDK iOS minimum exigé à ce moment-là.
5. **TestFlight** : les testeurs internes y ont accès tout de suite ; pour les testeurs externes, la première version passe une relecture rapide.
6. **Soumission** : Apple annonce que 90 % des apps sont relues en moins de 24 h. Prévoir 1 à 3 jours, plus une semaine de marge pour un éventuel refus.

**Guideline 4.2 (fonctionnalité minimale) : risque principal pour une app « site emballé »**

- L'app doit offrir des fonctions, du contenu et une interface qui vont au-delà d'un site web reconditionné.
- La 4.2.2 refuse les apps qui ne sont surtout que des pages web, du contenu agrégé ou une collection de liens.
- Pour passer, il faut du natif utile, par exemple :
  - les séances disponibles hors ligne ;
  - des notifications locales de rappel des séances ;
  - l'ajout direct au calendrier (EventKit) plutôt qu'un fichier `.ics` ;
  - le partage natif de l'image story ;
  - la génération de boucle intégrée plutôt qu'un lien vers le site.
- Une simple WebView du site sera très probablement refusée.

**Paiement (guidelines 3.1.1 et 3.1.3)**

- Débloquer le plan dans l'app = achat intégré obligatoire (achat non consommable, ou abonnement non renouvelable jusqu'au 30/06/2027).
- Commission de 15 % avec le Small Business Program (moins de 1 M USD par an, inscription requise), sinon 30 %.
- **App compagnon (guideline 3.1.3(f), « Free Stand-alone Apps »)** : une app gratuite peut ouvrir un plan acheté sur le site, à condition de ne contenir ni achat, ni prix, ni incitation à acheter ailleurs.
- **Options propres à l'UE (DMA)** : il existe des conditions spécifiques pour renvoyer vers un paiement externe, avec leurs propres commissions et contrats. Elles sont trop lourdes pour un produit unique.

## Google Play

**Coût** : 25 USD, payés une seule fois.

**Étapes**

1. **Compte Play Console** : vérification d'identité (pièce d'identité ; D-U-N-S pour une organisation), puis déclaration du statut de professionnel (DSA) pour la distribution dans l'UE.
2. **Nouveau compte personnel**, obligatoire depuis novembre 2023 :
   - avant toute mise en production, faire un **test fermé avec au moins 12 testeurs**, inscrits pendant **14 jours d'affilée** ;
   - ensuite, demander l'accès à la production (questionnaire sur le test). Google répond en 7 jours environ.

   Un compte organisation n'a pas cette obligation.
3. **Préparer l'app** :
   - un Android App Bundle (`.aab`) signé, avec Play App Signing ;
   - le niveau d'API cible exigé par Google (Android 15 / API 35 au minimum depuis le 31/08/2025, relevé chaque année fin août : vérifier la valeur en vigueur).
4. **Fiche et contenu de l'app** :
   - icône 512 × 512, image de présentation 1024 × 500, au moins 2 captures téléphone ;
   - description courte (80 caractères) et longue (4 000 caractères) ;
   - URL de confidentialité ;
   - formulaire « Sécurité des données » ;
   - questionnaire de classification (IARC), public cible, déclaration sur la publicité ;
   - déclaration « applis de santé » si la console la demande.
5. **Relecture** : de quelques heures à 7 jours, souvent plus longue pour une première app.

**Paiement** : un contenu numérique payant dans une app Play passe par Google Play Billing. La commission est de 15 % sur le premier million de dollars de revenus par an. L'EEE a des programmes de facturation alternative, avec une commission réduite mais pas nulle. Comme sur iOS, l'autre option est une app compagnon sans aucun achat ni lien d'achat.

**Variante Android** : une Trusted Web Activity (outil Bubblewrap) emballe directement la PWA. Elle demande un fichier `/.well-known/assetlinks.json` sur le site. Les mêmes règles de paiement s'appliquent.

## Calendrier réaliste (à partir du 14/10/2026)

| Étape | Apple | Google (compte personnel neuf) |
| --- | --- | --- |
| Compte développeur | 1 à 2 jours (individuel) | 1 à 3 jours (vérification) |
| Adaptation de l'app (API absolue, natif utile, variante store, achat intégré) | 1 à 2 semaines | idem, en commun |
| Test obligatoire | TestFlight, facultatif | 14 jours, 12 testeurs |
| Accès à la production + relecture | 1 à 3 jours | jusqu'à 7 jours, puis relecture |
| **En ligne au plus tôt** | **début novembre 2026** | **fin novembre 2026** |

La prépa commence le 19/10/2026 : la vente se fait sur le site, et les versions store ne viendront qu'en complément, au mieux pour les retardataires (plans raccourcis à partir de 8 semaines).

## Chemin recommandé : le Pass dans l'app Traceo

1. **Un seul compte développeur et une seule fiche.** Pas de second test fermé de 14 jours, ni de seconde déclaration DSA.
2. **Moins de risque avec la guideline 4.2.** Traceo apporte déjà une fonction native (la génération de boucles) : le plan devient une fonction de l'app, pas un site emballé.
3. **Achat intégré « Pass J-24 »** (achat non consommable) dans Traceo. Un nouvel endpoint vérifie le reçu (App Store Server API, Google Play Developer API), puis délivre le même jeton que `/api/unlock`. Le reste (`/api/plan`, `.ics`, image story) est réutilisé tel quel.
4. **Acheteurs du site.** Ils ouvrent leur lien personnel `/plan/#t=…` dans Traceo, comme sur une app compagnon.
   - Vérifier ce point au moment de la soumission : Apple accepte l'accès à un contenu acheté ailleurs si ce contenu est aussi proposé en achat intégré (guideline 3.1.3(b)).
5. **Le moteur ne bouge pas.** Il reste côté serveur (`src/engine/`, `/api/plan`), aucun calcul de plan n'est embarqué dans l'app.

## Liens officiels

- Apple : developer.apple.com/programs, developer.apple.com/app-store/review/guidelines, developer.apple.com/app-store/small-business-program
- Google : support.google.com/googleplay/android-developer (création de compte, exigences de test pour les comptes personnels, règles de paiement, niveau d'API cible)
