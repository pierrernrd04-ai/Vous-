# Miroir d'écran : PC Windows → tablette Lenovo

Duplique l'écran du PC (image et son) sur la tablette, par le Wi-Fi, sans rien installer : une seule page web, ouverte sur les deux appareils.

Adresse : **https://pierrernrd04-ai.github.io/Vous-/miroir/**

## Utilisation

1. **PC (Edge ou Chrome)** : ouvre l'adresse, choisis « Ordinateur ». Un QR code et un code à 8 caractères s'affichent.
2. **Tablette (Chrome)** : scanne le QR code avec l'appareil photo. Ou ouvre l'adresse, choisis « Tablette » et tape le code. L'appairage est mémorisé sur les deux appareils.
3. **PC** : clique sur « Dupliquer l'écran », choisis « Écran entier ». Coche « Partager aussi l'audio du système » pour avoir le son.
4. Lance ta vidéo : tout s'affiche sur la tablette. Elle se reconnecte toute seule si la page est rechargée ou si le Wi-Fi coupe un instant.

Pour un usage quotidien :
- **Sur le PC** : Edge › ⋯ › Applications › « Installer ce site en tant qu'application », pour avoir une icône Miroir sur le bureau.
- **Sur la tablette** : Chrome › ⋮ › « Ajouter à l'écran d'accueil », pour qu'elle s'ouvre en plein écran.

Si la tablette est ouverte et que le PC partage, l'image arrive en 1 à 3 secondes, sans rien toucher.

## Fonctionnement

| Élément | Rôle |
|---|---|
| `getDisplayMedia` (PC) | Capture de l'écran entier, jusqu'à 1920×1080 et 30 à 60 images/s, plus le son du système si coché |
| WebRTC | Envoi direct PC → tablette sur le réseau local, chiffré (DTLS-SRTP), débit visé 6 à 10 Mb/s |
| PeerJS (`vendor/peerjs.min.js`, serveur public `0.peerjs.com`) | Met seulement les deux appareils en relation. L'image et le son ne passent pas par lui |
| Code d'appairage | Identifiants `vous-miroir-<code>-pc` et `-tab`. 8 caractères aléatoires : seul un appareil qui connaît le code reçoit l'écran |

Réglages :
- **Qualité.** « Fluide » privilégie les images/s, pour les vidéos. « Net » privilégie la netteté, pour le texte.
- **Démarrage du débit.** La tablette demande au PC de démarrer directement à 6 Mb/s (paramètres `x-google-*` dans sa réponse SDP). L'image est donc nette tout de suite au lieu de monter progressivement.
- **Infos en direct.** Pendant la duplication, le PC et la tablette affichent la définition, les images/s, le débit et le chemin réseau (« Wi-Fi direct » ou « via un relais Internet »).

## Limites et dépannage

- Les deux appareils doivent être sur le **même Wi-Fi**. Sinon la connexion passe par un relais Internet public, plus lent.
- Le délai est en général sous 0,3 s sur un bon Wi-Fi : parfait pour regarder une vidéo, pas pour jouer.
- Le son est capturé, pas déplacé : le PC le joue aussi. Baisse le volume du PC ; selon la carte son, cela peut aussi baisser le son reçu par la tablette.
- Le site doit être en HTTPS (GitHub Pages), car la capture d'écran l'exige.
- Si l'image saccade : Wi-Fi 5 GHz, tablette plus proche de la box, ou qualité « Fluide ».

## Fichiers

- `index.html` : toute l'appli (choix de l'appareil, appairage, envoi, réception)
- `manifest.json`, `icons/` : installation comme application
- `vendor/` : PeerJS 1.5.5 et qrcode-generator 2.0.4 (licence MIT), copiés tels quels depuis npm

Publication : copier ce dossier dans `miroir/` sur la branche `gh-pages`.
