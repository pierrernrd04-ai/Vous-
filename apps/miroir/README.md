# Miroir d'écran : PC Windows → tablette Lenovo

Duplique l'écran du PC (image et son) sur la tablette, par le Wi-Fi, sans rien installer : une seule page web, ouverte sur les deux appareils.

Adresse : **https://pierrernrd04-ai.github.io/Vous-/miroir/**

## Utilisation

1. **PC (Chrome)** : ouvre l'adresse, choisis « Ordinateur ». Un QR code et un code à 8 caractères s'affichent.
2. **Tablette (Chrome)** : scanne le QR code avec l'appareil photo. Ou ouvre l'adresse, choisis « Tablette » et tape le code. L'appairage est mémorisé sur les deux appareils.
3. **PC, mode « Vidéo · un onglet » (conseillé pour YouTube)** : clique sur « Dupliquer la vidéo », choisis l'onglet de la vidéo et laisse son son activé. Mets ensuite la vidéo en plein écran (touche F). La tablette n'affiche que la vidéo, sans les barres de Chrome ni de Windows. Le son sort seulement de la tablette, synchronisé avec l'image.
   **PC, mode « Écran entier »** : tout l'écran du PC, barre des tâches comprise. Active le son du système (interrupteur en bas de la fenêtre) pour avoir le son.
4. **Tablette** : touche l'image, elle passe en plein écran avec le son. « Remplir l'écran » supprime les bandes noires (les bords de l'image sont alors un peu rognés). La tablette se reconnecte toute seule si la page est rechargée ou si le Wi-Fi coupe un instant.

Pour un usage quotidien :
- **Sur le PC** : Chrome › ⋮ › Caster, enregistrer et partager › « Installer la page en tant qu'application », pour avoir une icône Miroir sur le bureau.
- **Sur la tablette** : Chrome › ⋮ › « Ajouter à l'écran d'accueil », pour qu'elle s'ouvre en plein écran.

Si la tablette est ouverte et que le PC partage, l'image arrive en 1 à 3 secondes, sans rien toucher.

## Fonctionnement

| Élément | Rôle |
|---|---|
| `getDisplayMedia` (PC) | Capture d'un onglet (son coupé sur le PC, `suppressLocalAudioPlayback`) ou de l'écran entier, en 1080p et 30 images/s |
| WebRTC | Envoi direct PC → tablette sur le réseau local, chiffré (DTLS-SRTP). Jusqu'à 16 Mb/s, H.264 en priorité (décodé par la puce de la tablette), tampon de réception minimal (`jitterBufferTarget = 0`) |
| Garde-fou de délai (PC) | Chaque seconde, si l'aller-retour réseau dépasse de 80 ms son minimum (images qui s'entassent dans le Wi-Fi), le PC plafonne son débit à 70 % de ce qui passe, puis remonte de 20 % toutes les 3 s quand tout est fluide |
| Définition de la tablette | La tablette envoie au PC la définition de son écran (canal de données PeerJS). Le PC n'encode jamais plus de pixels que la tablette n'en affiche |
| PeerJS (`vendor/peerjs.min.js`, serveur public `0.peerjs.com`) | Met seulement les deux appareils en relation. L'image et le son ne passent pas par lui |
| Code d'appairage | Identifiants `vous-miroir-<code>-pc` et `-tab`. 8 caractères aléatoires : seul un appareil qui connaît le code reçoit l'écran |

Réglages :
- **Qualité.** 30 images/s : assez pour les vidéos (YouTube : 24 à 30 i/s), et deux fois plus de débit par image qu'à 60 i/s. « Fluide » garde la fluidité si le réseau faiblit, « Net » garde la définition.
- **Démarrage du débit et codec.** La tablette demande au PC de démarrer à 2,5 Mb/s (`x-google-start-bitrate`), sans débit minimum, et met H.264 en tête de sa réponse SDP. Sur un bon Wi-Fi, le débit monte à la HD en 1 à 2 secondes.
- **Pourquoi pas de débit minimum.** Un débit minimum forcé (2,5 Mb/s dans la version précédente) faisait s'entasser les images dès que le Wi-Fi passait moins : jusqu'à 5 secondes de retard mesurées à 1,5 Mb/s.
- **Infos en direct.** Pendant la duplication, le PC et la tablette affichent la définition, les images/s, le débit et le chemin réseau (« Wi-Fi direct » ou « via un relais Internet »).

## Délai mesuré

Banc de test : la vidéo de Pierre redessinée en 1080p avec un code-barres horodaté sur chaque image ; la « tablette » relit le code-barres de chaque image affichée. Réseau limité avec `tc` (token bucket), mise en relation par le vrai serveur PeerJS, tablette 1280×800.

| Débit du réseau | Version précédente | Version actuelle (médiane · 95 % des images sous) |
|---|---|---|
| Illimité | 129 ms | 87 ms · 107 ms |
| 6 Mb/s | 101 ms | 88 ms · 113 ms |
| 3 Mb/s | 69 ms | 53 ms · 81 ms |
| 1,5 Mb/s | 4 983 ms | 30 ms · 48 ms |
| 0,8 Mb/s | plus de 5 s | 223 ms · 605 ms |

## Limites et dépannage

- Les deux appareils doivent être sur le **même Wi-Fi**. Sinon la connexion passe par un relais Internet public, plus lent : le PC l'affiche alors en orange, avec la marche à suivre (même Wi-Fi, pas le Wi-Fi invité, réseau Windows en « Privé »).
- Le délai est en général sous 0,3 s sur un bon Wi-Fi : parfait pour regarder une vidéo, pas pour jouer.
- En mode Écran entier, le son est capturé, pas déplacé : le PC le joue aussi, un peu en avance sur la tablette. Utilise le mode Vidéo pour l'avoir seulement sur la tablette.
- Il reste toujours quelques centièmes de seconde entre le PC et la tablette, le temps d'encoder, d'envoyer, de décoder et d'afficher chaque image. La tablette affiche ce délai estimé (« délai ≈ … ms ») quand on touche l'image.
- Le site doit être en HTTPS (GitHub Pages), car la capture d'écran l'exige.
- Si l'image saccade : Wi-Fi 5 GHz, tablette plus proche de la box, ou qualité « Fluide ».

## Fichiers

- `index.html` : toute l'appli (choix de l'appareil, appairage, envoi, réception)
- `manifest.json`, `icons/` : installation comme application
- `vendor/` : PeerJS 1.5.5 et qrcode-generator 2.0.4 (licence MIT), copiés tels quels depuis npm

Publication : copier ce dossier dans `miroir/` sur la branche `gh-pages`.
