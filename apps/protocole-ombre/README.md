# Protocole Ombre

Jeu de tir à la première personne en 3D, dans un univers militaire futuriste (2071, soldats augmentés, propulseurs, néons), inspiré de l'ambiance des jeux de tir de type Black Ops. Il se joue dans le navigateur sur **mobile, tablette et ordinateur**, et s'installe comme une application (PWA).

> Univers, noms, armes et cartes originaux. Le jeu n'est pas affilié à Activision ni à Call of Duty et ne peut pas se connecter à leurs serveurs.

## Contenu

- **18 armes** en 6 catégories : 5 fusils d'assaut, 3 mitraillettes, 3 fusils à pompe, 3 fusils de précision, 2 mitrailleuses légères et 2 pistolets. Chaque arme a sa cadence, ses dégâts avec chute selon la distance, son recul, sa dispersion, son chargeur, son temps de rechargement, sa mobilité et son zoom.
- **5 cartes** symétriques (équité des deux camps) :

  | Carte | Ambiance | Particularités |
  |---|---|---|
  | Station Cryo-7 | Base arctique | Laboratoire central avec toit accessible |
  | Néo-Kyoto | Quartier néon de nuit | Sanctuaire surélevé, salle d'arcade |
  | Avant-poste Sirocco | Village du désert au crépuscule | Tour de guet, toits accessibles |
  | Fonderie Aquilon | Usine | Bassin de métal en fusion, passerelles |
  | Port Abyssal | Terminal de conteneurs sous la pluie | Labyrinthe de conteneurs, entrepôt central |

- **Modes** : Match à mort par équipe (3 c. 3 à 6 c. 6) et Mêlée générale (6 à 10 joueurs).
- **Bots** sur 4 niveaux (Recrue, Régulier, Vétéran, Élite). Ils ont un champ de vision, une ligne de vue et une ouïe des tirs. Leur temps de réaction et leurs erreurs de visée dépendent du niveau. Ils tirent par rafales, se déplacent latéralement, se replient, chassent et lancent des grenades. Ils se déplacent avec une navigation A* sur plusieurs niveaux (toits, passerelles).
- **Mouvement** : sprint, saut, propulseur (double saut), glissade, accroupi.
- **Combat** : tirs à la tête, grenades à rebonds, santé qui se régénère, hitmarkers, indicateurs de direction des dégâts, caméra de mort.
- **Progression** : séries d'éliminations (Drone de reconnaissance à 3, Surcharge à 6), compétence *Impulsion* qui révèle les ennemis à travers les murs, XP et niveaux enregistrés sur l'appareil.
- **Multijoueur en ligne** : un joueur crée un salon et partage un code de 5 caractères, ses amis le rejoignent depuis leur navigateur, et les places vides sont remplies par des bots. Les humains peuvent jouer ensemble contre les bots ou les uns contre les autres.

## Commandes

| | Tactile | Clavier et souris | Manette |
|---|---|---|---|
| Se déplacer | Joystick flottant (moitié gauche) | ZQSD / WASD | Stick gauche |
| Viser (regard) | Glisser sur la moitié droite | Souris | Stick droit |
| Tirer | Gros bouton (déplaçable) ou tir automatique | Clic gauche | RT |
| Viser avec l'arme | Bouton ⌖ | Clic droit | LT |
| Sprinter | Joystick poussé à fond vers le haut | Maj | L3 |
| Sauter, propulseur | ▲ (deux fois) | Espace (deux fois) | A |
| S'accroupir, glisser | ▼ | C / Ctrl | B |
| Recharger | ↻ | R | X |
| Changer d'arme | ⇄ | 1 / 2 / molette | Y |
| Grenade | ✸ | G | LB |
| Impulsion | ◉ | E | RB |

Le **tir automatique** (activé par défaut en tactile) et la **visée assistée** se règlent dans les paramètres.

## Lancer en local

Le jeu est entièrement statique : aucune compilation ni dépendance à installer, toutes les bibliothèques sont dans `lib/`.

```sh
cd apps/protocole-ombre
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

Il faut un serveur HTTP : les modules JavaScript ne se chargent pas depuis `file://`.

## Mettre en ligne et installer sur téléphone

Il suffit de publier le dossier `apps/protocole-ombre/` sur n'importe quel hébergement statique en HTTPS (Netlify, Cloudflare Pages, GitHub Pages…). Sur le téléphone, il reste à ouvrir l'adresse puis à choisir « Ajouter à l'écran d'accueil » : le jeu se lance alors en plein écran, en paysage, et fonctionne hors ligne (sauf le multijoueur).

Pour une publication sur le Play Store ou l'App Store, on peut emballer ce même dossier avec Capacitor, ou avec une Trusted Web Activity pour Android.

## Architecture

```
index.html, css/style.css   interface (menus, HUD, commandes tactiles)
js/main.js        rendu (post-traitement bloom), menus, profil, salon, cycle des parties
js/game.js        une partie : entités, règles, dégâts, réseau (hôte qui fait autorité)
js/world.js       construction d'une carte (géométrie fusionnée, collisions, ciel, minicarte)
js/maps.js        les 5 cartes
js/physics.js     corps du soldat (collisions, marches, saut, propulseur, glissade)
js/nav.js         grille de navigation multi-niveaux + A*
js/bots.js        intelligence des bots
js/combat.js      balistique (tête/corps, plombs) et grenades
js/weapons.js     les 18 armes
js/models.js      modèles 3D procéduraux (armes, soldats animés)
js/viewmodel.js   arme à la première personne
js/effects.js     traçantes, étincelles, impacts, explosions, météo
js/textures.js    textures générées sur canvas
js/audio.js       sons synthétisés et spatialisés (Web Audio)
js/input.js       clavier/souris, tactile, manette
js/net.js         multijoueur pair-à-pair (WebRTC via PeerJS)
lib/              three.js 0.170 et PeerJS 1.5.4 (licences MIT incluses)
```

Tout est généré par le code (géométrie, textures, sons) : il n'y a aucun fichier image ni son à télécharger, à part les icônes.

## Multijoueur : fonctionnement et limites

- La connexion est **pair-à-pair** (WebRTC). Le serveur public de PeerJS sert uniquement à mettre les joueurs en relation ; aucun serveur de jeu n'est à héberger. Pour une version en production, on peut héberger son propre PeerServer et l'indiquer dans `js/net.js`.
- L'**hôte** fait tourner les bots, le score et les dégâts. S'il met le jeu en arrière-plan, le navigateur suspend la partie pour tout le monde. S'il quitte, la partie s'arrête.
- Un joueur qui quitte en cours de partie est remplacé par un bot.
- Chaque client détecte lui-même ses impacts (ce que tu vois est ce que tu touches). C'est simple et réactif, mais ce n'est pas protégé contre la triche : à réserver aux parties entre amis.
- Le jeu **ne peut pas** se connecter aux joueurs de Call of Duty Mobile, Black Ops 3 ou Black Ops 4. Ces jeux utilisent des serveurs fermés, sans API publique, protégés par un anti-triche, et leurs conditions d'utilisation l'interdisent.
