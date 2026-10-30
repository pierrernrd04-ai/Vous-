# iPhone Live (app iOS)

App privée qui diffuse l'écran de l'iPhone en direct vers le PC Windows (dossier `iphone-live`).
L'app contient une extension ReplayKit « Broadcast Upload » lancée par le bouton rond de l'app.
L'extension encode l'écran en H.264 (VideoToolbox, ~6 Mbit/s, 30 i/s max) et ouvre un serveur TCP sur le port 5000.
Protocole : flux H.264 Annex B brut (codes 00 00 00 01), SPS et PPS envoyés avant chaque image IDR.
Un client qui se connecte reçoit d'abord les derniers SPS/PPS, puis une image clé forcée ; aucune image P avant.
Plusieurs clients possibles ; un client lent (> 2 Mo en attente) saute les images P jusqu'à la prochaine image clé.
Côté PC : `ffmpeg -f h264 -i tcp://172.20.10.1:5000` (adresse du Partage de connexion ; l'app affiche les autres).
Génération : `xcodegen generate` puis `xcodebuild -sdk iphoneos CODE_SIGNING_ALLOWED=NO` (GitHub Actions, macOS).
Installation : l'IPA est signée et installée avec Sideloadly et un Apple ID gratuit (aucune capacité payante).
Arrêt de la diffusion : la pastille rouge en haut de l'écran de l'iPhone.
