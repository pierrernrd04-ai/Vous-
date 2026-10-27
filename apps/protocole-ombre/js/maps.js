// Les 5 cartes. Chaque carte décrit une ambiance (thème) et une fonction de
// construction appelée avec le constructeur de monde `B` (voir world.js).
// Les cartes sont symétriques par rotation de 180° : tout ce qui est construit
// dans `B.both(...)` est dupliqué pour l'équipe adverse, ce qui garantit
// l'équité des deux camps.

const CYAN = '#19e6ff';
const ORANGE = '#ff7a1a';
const PINK = '#ff2a8a';
const PURPLE = '#9b5cff';
const RED = '#ff3040';
const SODIUM = '#ffb35a';

export const MAPS = [
  {
    id: 'cryo',
    name: 'Station Cryo-7',
    tagline: 'Base de recherche arctique · moyenne portée',
    size: [60, 84],
    theme: {
      skyTop: '#5e88b8', skyBottom: '#dfe9f2', sun: '#fff4e6', sunIntensity: 2.4,
      sunDir: [0.5, 0.8, 0.3], hemiSky: '#cfe3ff', hemiGround: '#8a96a8', hemiIntensity: 1.1,
      fog: '#cfdbe6', fogDensity: 0.012, night: false, snow: true, bloom: 0.35, exposure: 1.0,
      ambientSound: 'wind',
      mats: {
        ground: { tex: 'ground', color: '#eef3f8', scale: 6, rough: 0.95 },
        wall: { tex: 'concrete', color: '#c9ced6', scale: 3, rough: 0.9 },
        wall2: { tex: 'panelDark', color: '#7e8ea3', scale: 3, rough: 0.6, metal: 0.3 },
        floor: { tex: 'floor', color: '#9aa3ad', scale: 2, rough: 0.8 },
        metal: { tex: 'metal', color: '#a8b4c2', scale: 2, rough: 0.45, metal: 0.7 },
        cover: { tex: 'concrete', color: '#b7bec8', scale: 2, rough: 0.9 },
        crate: { tex: 'metal', color: '#5d6b7c', scale: 1.2, rough: 0.6, metal: 0.4 },
        trim: { tex: 'hazard', color: '#ff9a3c', scale: 1, rough: 0.6 },
        accent: { tex: 'metal', color: '#e86a1c', scale: 2, rough: 0.5, metal: 0.4 },
        c1: { tex: 'container', color: '#d24a2a', scale: 3, rough: 0.6, metal: 0.4 },
        c2: { tex: 'container', color: '#2f6fb0', scale: 3, rough: 0.6, metal: 0.4 },
        c3: { tex: 'container', color: '#e8e8e8', scale: 3, rough: 0.6, metal: 0.4 },
        snow: { tex: 'ground', color: '#ffffff', scale: 4, rough: 1 },
      },
    },
    build(B) {
      B.ground('ground');
      B.perimeter(6, 'wall');
      B.both((B) => {
        // Zone de déploiement : hangar ouvert
        B.house(0, -36.5, 14, 7, 4, 'wall2', { doors: ['+z', '-x', '+x'], roofMat: 'metal' });
        B.neon(0, 3.4, -32.95, 6, 0.12, 0.06, CYAN);
        for (const [x, z] of [[-3, -37], [0, -36], [3, -37], [-12, -35], [12, -35], [-21, -36], [21, -36], [0, -30]]) B.spawn(x, z, Math.PI);

        // Laboratoire central (moitié, la rotation construit l'autre)
        B.box(-4.3, 0, -7, 5.8, 3.6, 0.4, 'wall');
        B.box(4.3, 0, -7, 5.8, 3.6, 0.4, 'wall');
        B.box(0, 2.6, -7, 2.8, 1, 0.4, 'wall');
        B.box(-7, 0, -4.05, 0.4, 3.6, 5.5, 'wall');
        B.box(-7, 0, 4.05, 0.4, 3.6, 5.5, 'wall');
        B.box(-7, 2.6, 0, 0.4, 1, 2.6, 'wall');
        B.box(0, 3.6, -3.6, 14.4, 0.4, 7.2, 'metal');
        B.stairs(4.75, -14.2, '+z', 2.5, 4.0, 7, 'metal');
        B.box(-4.1, 4, -7.1, 6.2, 0.9, 0.2, 'metal');
        B.box(-7.1, 4, -4, 0.2, 0.9, 4, 'metal');
        B.box(-4, 0, -4, 1.3, 1.3, 1.3, 'crate');
        B.box(2.5, 0, -2, 2.4, 1, 1, 'crate');
        B.neon(0, 3.25, -7.25, 2.6, 0.08, 0.06, CYAN);
        B.neon(-7.25, 3.25, 0, 0.06, 0.08, 2.4, CYAN);
        B.light(0, 3, -3, '#bfe8ff', 6, 12);

        // Flanc gauche : réservoirs cryogéniques et conteneurs
        B.tank(-21, -22, 1.6, 5.5, 'metal');
        B.tank(-25, -16, 1.6, 5.5, 'metal');
        B.neon(-21, 4.6, -22, 3.3, 0.1, 3.3, CYAN, 2, true);
        B.neon(-25, 4.6, -16, 3.3, 0.1, 3.3, CYAN, 2, true);
        B.container(-23, -6, 'z', 'c1');
        B.container(-17.5, -10, 'x', 'c2');
        B.container(-17.5, -10, 'x', 'c3', 2.6);
        B.cover(-14, -27, 4, 0.8, 1.1);
        B.cover(-10, -19, 0.8, 3.5, 1.1);

        // Flanc droit : dortoir traversant avec accès au toit
        B.house(22, -20, 10, 14, 3.6, 'wall2', { doors: ['-z', '+z', '-x'], roofMat: 'metal' });
        B.stairs(11, -25.5, '+x', 2, 3.9, 6, 'metal');
        B.box(22, 3.9, -13.1, 10, 0.9, 0.2, 'metal');
        B.neon(17, 2.8, -20, 0.06, 0.1, 4, ORANGE);
        B.cover(24, -8, 3, 0.8, 1.1);
        B.box(18, 0, -5, 1.2, 1.2, 1.2, 'crate');
        B.box(18, 1.2, -5, 1.2, 1.2, 1.2, 'crate');

        // Centre-avant
        B.cover(-6, -14, 3, 0.8, 1.1);
        B.box(9, 0, -18, 2, 2, 2, 'crate');
        B.box(-2, 0, -22, 6, 2.4, 0.8, 'wall');
        B.box(-11, 0, -31, 6, 2.2, 1, 'snow');
        B.box(11, 0, -29, 1, 2.2, 5, 'snow');

        // Mât radar
        B.deco(14, 0, -30, 0.5, 9, 0.5, 'metal');
        B.deco(14, 9, -30, 3, 0.2, 0.2, 'metal');
        B.neon(14, 9.3, -30, 0.25, 0.25, 0.25, RED, 4);
        B.light(-21, 5, -19, '#9fe8ff', 4, 14);
        B.light(22, 3.2, -20, '#ffd2a8', 4, 12);
      });
    },
  },

  {
    id: 'neon',
    name: 'Néo-Kyoto',
    tagline: 'Quartier néon de nuit · combats rapprochés',
    size: [52, 80],
    theme: {
      skyTop: '#05030f', skyBottom: '#2a0f3d', sun: '#9fb6ff', sunIntensity: 0.6,
      sunDir: [-0.3, 0.9, 0.2], hemiSky: '#7a6ac0', hemiGround: '#2a2034', hemiIntensity: 1.15,
      fog: '#1a0c2a', fogDensity: 0.022, night: true, stars: true, bloom: 1.0, exposure: 1.05,
      ambientSound: 'city',
      mats: {
        ground: { tex: 'ground', color: '#2a2a33', scale: 5, rough: 0.35, metal: 0.4 },
        wall: { tex: 'panelDark', color: '#3a3d4a', scale: 3, rough: 0.6, metal: 0.3 },
        wall2: { tex: 'concrete', color: '#5a5566', scale: 3, rough: 0.8 },
        floor: { tex: 'floor', color: '#3c3c48', scale: 2, rough: 0.5 },
        metal: { tex: 'metal', color: '#6b7080', scale: 2, rough: 0.4, metal: 0.8 },
        cover: { tex: 'concrete', color: '#55586a', scale: 2, rough: 0.8 },
        crate: { tex: 'metal', color: '#2d3240', scale: 1.2, rough: 0.5, metal: 0.5 },
        trim: { tex: 'hazard', color: '#ffcc33', scale: 1, rough: 0.6 },
        accent: { tex: 'metal', color: '#c4123f', scale: 2, rough: 0.4, metal: 0.4 },
        stone: { tex: 'concrete', color: '#6e6a78', scale: 2, rough: 0.9 },
        tower: { tex: 'panelDark', color: '#1c1d26', scale: 4, rough: 0.5, metal: 0.5, emissive: '#ffd9a8', emissiveMap: 'facade', emissiveIntensity: 1.6 },
        tower2: { tex: 'panelDark', color: '#161824', scale: 5, rough: 0.5, metal: 0.5, emissive: '#9fd8ff', emissiveMap: 'facade', emissiveIntensity: 1.4 },
        car1: { tex: 'metal', color: '#c8102e', scale: 2, rough: 0.25, metal: 0.8 },
        car2: { tex: 'metal', color: '#1b1f2a', scale: 2, rough: 0.25, metal: 0.8 },
      },
    },
    build(B) {
      B.ground('ground');
      B.perimeter(9, 'wall');
      B.both((B) => {
        // Gratte-ciels hors limites (silhouette)
        const towers = [[-34, -30, 8, 34, 10, 'tower'], [-36, -12, 10, 46, 8, 'tower2'], [34, -24, 9, 40, 12, 'tower2'], [36, -4, 8, 28, 8, 'tower'], [-8, -50, 14, 38, 8, 'tower'], [12, -52, 10, 52, 9, 'tower2']];
        for (const [x, z, w, h, d, m] of towers) B.deco(x, 0, z, w, h, d, m);
        B.neon(-30.1, 18, -30, 0.1, 6, 1.2, PINK, 3);
        B.neon(29.6, 22, -24, 0.1, 1.2, 8, CYAN, 3);

        // Station de métro (déploiement)
        B.box(0, 0, -36, 12, 3.5, 0.6, 'wall');
        B.box(0, 3.5, -34.5, 14, 0.4, 4, 'metal');
        B.box(-6.6, 0, -34.5, 0.6, 3.5, 3.4, 'wall');
        B.box(6.6, 0, -34.5, 0.6, 3.5, 3.4, 'wall');
        B.neon(0, 3.3, -32.45, 8, 0.15, 0.05, CYAN);
        for (const [x, z] of [[-3, -34], [0, -34], [3, -34], [-11, -36], [11, -36], [-20, -36], [20, -36], [0, -29]]) B.spawn(x, z, Math.PI);

        // Ruelle gauche : immeuble plein et passages
        B.box(-17, 0, -24, 6, 9, 12, 'wall2');
        B.neon(-13.95, 4, -24, 0.06, 2.5, 0.6, PINK, 3);
        B.neon(-13.95, 6.5, -21, 0.06, 0.6, 3, PURPLE, 3);
        B.box(-23, 0, -12, 1.2, 1.2, 1.2, 'crate');
        B.box(-23, 0, -10.6, 1.2, 1.2, 1.2, 'crate');
        B.box(-23, 1.2, -11.3, 1.2, 1.2, 1.2, 'crate');
        B.box(-18, 0, -6, 4, 4, 4, 'wall2');
        B.neon(-18, 4.05, -6, 4, 0.08, 4, CYAN, 1.5, true);
        B.light(-22, 3, -20, PINK, 6, 12);

        // Salle d'arcade traversante (droite) + enseigne
        B.house(17, -18, 14, 12, 4, 'wall', { doors: ['-z', '+z', '-x'], roofMat: 'metal' });
        B.box(14, 0, -18, 1, 1.6, 0.8, 'crate');
        B.box(17, 0, -16, 1, 1.6, 0.8, 'crate');
        B.box(20, 0, -20, 1, 1.6, 0.8, 'crate');
        B.neon(14, 1.7, -18, 0.8, 0.5, 0.05, PINK, 3);
        B.neon(17, 1.7, -16, 0.8, 0.5, 0.05, CYAN, 3);
        B.neon(20, 1.7, -20, 0.8, 0.5, 0.05, PURPLE, 3);
        B.deco(17, 4.3, -23.6, 8, 2, 0.2, 'crate');
        B.neon(17, 5.3, -23.75, 7, 0.15, 0.05, PINK, 4);
        B.neon(17, 4.7, -23.75, 7, 0.15, 0.05, CYAN, 4);
        B.light(17, 3.2, -18, PURPLE, 6, 12);

        // Rue principale : voitures et étals
        B.car(-6, -22, 'z', 'car1');
        B.car(8, -9, 'x', 'car2');
        B.car(-10, -3, 'z', 'car2');
        B.box(6, 0, -27, 3, 1.1, 1.2, 'crate');
        B.deco(6, 2.4, -27, 3.6, 0.12, 2.2, 'accent');
        B.neon(6, 2.35, -25.9, 3.6, 0.06, 0.06, ORANGE, 3);
        B.cover(-2, -15, 3.2, 0.8, 1.1);
        B.cover(11, -30, 0.8, 3, 1.1);

        // Sanctuaire central surélevé
        B.box(0, 0, -2, 9, 1.2, 4, 'stone');
        B.stairs(0, -7, '+z', 3.2, 1.2, 3, 'stone');
        B.box(-3, 1.2, -1.5, 0.45, 3.6, 0.45, 'accent');
        B.box(3, 1.2, -1.5, 0.45, 3.6, 0.45, 'accent');
        B.deco(0, 4.4, -1.5, 8, 0.35, 0.6, 'accent');
        B.neon(0, 4.8, -1.5, 8.6, 0.12, 0.7, RED, 3);
        B.box(-1.2, 1.2, 1.5, 2, 1, 0.8, 'stone');
        B.light(0, 3, 0, RED, 5, 10);
      });
    },
  },

  {
    id: 'dune',
    name: 'Avant-poste Sirocco',
    tagline: 'Village du désert au crépuscule · longues lignes de tir',
    size: [72, 72],
    theme: {
      skyTop: '#3a5a8c', skyBottom: '#ffb070', sun: '#ffc48a', sunIntensity: 2.8,
      sunDir: [-0.7, 0.35, 0.4], hemiSky: '#ffd2a8', hemiGround: '#8a5a3a', hemiIntensity: 0.9,
      fog: '#e8a878', fogDensity: 0.011, night: false, bloom: 0.45, exposure: 1.0, dust: true,
      ambientSound: 'wind',
      mats: {
        ground: { tex: 'ground', color: '#d9b083', scale: 7, rough: 1 },
        wall: { tex: 'concrete', color: '#d6b48c', scale: 3, rough: 0.95 },
        wall2: { tex: 'concrete', color: '#c49a6c', scale: 3, rough: 0.95 },
        floor: { tex: 'floor', color: '#b08a62', scale: 2, rough: 0.9 },
        metal: { tex: 'metal', color: '#8a8478', scale: 2, rough: 0.6, metal: 0.5 },
        cover: { tex: 'concrete', color: '#c9a77e', scale: 2, rough: 1 },
        crate: { tex: 'container', color: '#8a6a44', scale: 1.2, rough: 0.9 },
        trim: { tex: 'hazard', color: '#ffcc33', scale: 1, rough: 0.6 },
        accent: { tex: 'metal', color: '#2f6f6a', scale: 2, rough: 0.6 },
        cloth1: { tex: 'ground', color: '#b8322a', scale: 2, rough: 1 },
        cloth2: { tex: 'ground', color: '#2a6ab8', scale: 2, rough: 1 },
        palm: { tex: 'ground', color: '#3f6b2a', scale: 2, rough: 1 },
        trunk: { tex: 'container', color: '#6a4a2a', scale: 1, rough: 1 },
        car1: { tex: 'metal', color: '#c9c0a8', scale: 2, rough: 0.5, metal: 0.5 },
        car2: { tex: 'metal', color: '#4a5a3a', scale: 2, rough: 0.6, metal: 0.4 },
      },
    },
    build(B) {
      B.ground('ground');
      B.perimeter(5, 'wall2');
      B.both((B) => {
        // Enceinte de départ
        B.box(-10, 0, -30, 8, 2.6, 0.8, 'wall2');
        B.box(10, 0, -30, 8, 2.6, 0.8, 'wall2');
        B.car(0, -33, 'x', 'car2');
        for (const [x, z] of [[-6, -33], [6, -32], [-14, -33], [14, -33], [-24, -32], [24, -32], [0, -27], [-3, -30]]) B.spawn(x, z, Math.PI);

        // Maisons en pisé
        B.house(-22, -20, 9, 8, 3.4, 'wall', { doors: ['+z', '+x'], roofMat: 'floor' });
        B.stairs(-19, -11.5, '-z', 1.8, 3.7, 4.5, 'wall');
        B.box(-22, 3.7, -24.1, 9, 0.8, 0.2, 'wall');
        B.house(-6, -22, 8, 7, 3.4, 'wall2', { doors: ['-z', '+z', '-x'], roofMat: 'floor' });
        B.house(14, -18, 10, 8, 3.4, 'wall', { doors: ['-z', '+z', '+x'], roofMat: 'floor' });
        B.stairs(17, -9.5, '-z', 1.8, 3.7, 4.5, 'wall');
        B.box(14, 3.7, -22.1, 10, 0.8, 0.2, 'wall');
        B.house(27, -6, 7, 9, 3.4, 'wall2', { doors: ['-z', '-x'], roofMat: 'floor' });

        // Tour de guet (plateforme sur piliers)
        for (const [x, z] of [[-30, -4], [-26, -4], [-30, -8], [-26, -8]]) B.box(x, 0, z, 0.5, 4.5, 0.5, 'trunk');
        B.box(-28, 4.5, -6, 5, 0.3, 5, 'floor');
        B.stairs(-28, -16, '+z', 1.6, 4.8, 7.5, 'trunk');
        B.box(-30.4, 4.8, -6, 0.2, 1, 5, 'trunk');
        B.box(-28, 4.8, -3.6, 5, 1, 0.2, 'trunk');

        // Marché central
        for (const [x, z, m] of [[-8, -8, 'cloth1'], [8, -6, 'cloth2'], [-3, -12, 'cloth2']]) {
          B.box(x, 0, z, 2.6, 1.1, 1.1, 'crate');
          B.deco(x, 2.5, z, 3.4, 0.1, 2.6, m);
          for (const sx of [-1.6, 1.6]) B.deco(x + sx, 0, z + 1.2, 0.12, 2.5, 0.12, 'trunk');
        }
        B.tank(0, -3, 1.4, 1, 'wall');
        B.car(18, -5, 'z', 'car1');

        // Ruines et couverts
        B.box(-16, 0, -10, 0.8, 2.4, 5, 'wall2');
        B.box(-16, 0, -4, 0.8, 1.2, 2, 'wall2');
        B.cover(4, -24, 3, 0.8, 1.1);
        B.cover(-12, -26, 0.8, 3, 1.1);
        B.cover(24, -18, 3, 0.8, 1.1);
        B.box(30, 0, -22, 1.2, 1.2, 1.2, 'crate');
        B.box(31.2, 0, -22, 1.2, 1.2, 1.2, 'crate');

        // Palmiers
        for (const [x, z] of [[-14, -16], [6, -30], [22, -26], [-33, -26]]) {
          B.tank(x, z, 0.25, 6, 'trunk');
          B.deco(x, 6, z, 4, 0.15, 0.9, 'palm');
          B.deco(x, 6.05, z, 0.9, 0.15, 4, 'palm');
        }
      });
    },
  },

  {
    id: 'forge',
    name: 'Fonderie Aquilon',
    tagline: 'Usine en activité · combat vertical sur passerelles',
    size: [60, 76],
    theme: {
      skyTop: '#0b0b10', skyBottom: '#2a1a12', sun: '#ffd0a0', sunIntensity: 0.9,
      sunDir: [0.2, 1, 0.1], hemiSky: '#b08a70', hemiGround: '#3a2a20', hemiIntensity: 1.25,
      fog: '#1c120c', fogDensity: 0.02, night: true, indoor: true, bloom: 0.9, exposure: 1.1, embers: true,
      ambientSound: 'factory',
      mats: {
        ground: { tex: 'floor', color: '#5a5650', scale: 3, rough: 0.8, metal: 0.2 },
        wall: { tex: 'panelDark', color: '#4a4844', scale: 4, rough: 0.7, metal: 0.4 },
        wall2: { tex: 'concrete', color: '#6a645c', scale: 3, rough: 0.9 },
        floor: { tex: 'grate', color: '#7a7670', scale: 1.5, rough: 0.5, metal: 0.7 },
        grate: { tex: 'grate', color: '#7a7670', scale: 1.5, rough: 0.5, metal: 0.7 },
        metal: { tex: 'metal', color: '#7a7a7a', scale: 2, rough: 0.4, metal: 0.8 },
        cover: { tex: 'metal', color: '#5a5a5e', scale: 2, rough: 0.5, metal: 0.6 },
        crate: { tex: 'metal', color: '#3e4a3a', scale: 1.2, rough: 0.6, metal: 0.5 },
        trim: { tex: 'hazard', color: '#ffb000', scale: 1, rough: 0.6 },
        accent: { tex: 'metal', color: '#b8641e', scale: 2, rough: 0.5, metal: 0.6 },
        rust: { tex: 'container', color: '#7a3e1e', scale: 2, rough: 0.9, metal: 0.3 },
      },
    },
    build(B) {
      B.ground('ground');
      B.perimeter(14, 'wall');
      // Bassin de métal en fusion (unique, centré)
      B.lava(0, 0, 12, 7);
      B.box(0, 0, 0, 2.4, 0.3, 7.4, 'grate');
      B.light(0, 2, 0, '#ff6a10', 10, 18);
      B.both((B) => {
        // Quai de chargement (déploiement)
        B.box(0, 0, -35, 18, 1, 4, 'wall2');
        B.box(-9, 0, -32, 1, 3, 1, 'trim');
        B.box(9, 0, -32, 1, 3, 1, 'trim');
        for (const [x, z] of [[-4, -32], [0, -31], [4, -32], [-14, -33], [14, -33], [-23, -33], [23, -33], [0, -27]]) B.spawn(x, z, Math.PI);

        // Garde-corps du bassin
        B.box(-4, 0, -3.8, 4.6, 1, 0.25, 'trim');
        B.box(4, 0, -3.8, 4.6, 1, 0.25, 'trim');
        B.box(-6.2, 0, 0, 0.25, 1, 7.4, 'trim');

        // Passerelle transversale au-dessus du bassin + escaliers
        B.box(0, 3.7, -10, 44, 0.3, 2.5, 'grate');
        B.box(-20.1, 4, -11.2, 3.8, 1, 0.1, 'metal');
        B.box(3.1, 4, -11.2, 37.8, 1, 0.1, 'metal');
        for (const x of [-14, 0, 14]) B.box(x, 0, -10, 0.5, 3.7, 0.5, 'metal');
        B.stairs(-17, -18.5, '+z', 2, 4, 7.25, 'grate');

        // Passerelles latérales
        B.box(-25, 3.7, -13, 3, 0.3, 26, 'grate');
        B.box(-22, 3.7, -10, 3, 0.3, 2.5, 'grate');
        for (const z of [-24, -14, -4, 6, 16]) B.box(-25, 0, z, 0.5, 3.7, 0.5, 'metal');
        B.box(-23.45, 4, -17, 0.1, 1, 12, 'metal');
        B.box(-25, 3.7, 13, 3, 0.3, 26, 'grate');
        B.box(-22, 3.7, 10, 3, 0.3, 2.5, 'grate');

        // Presses et machines
        B.box(-12, 0, -22, 5, 5.5, 4, 'wall');
        B.box(-12, 5.5, -22, 5.6, 0.4, 4.6, 'trim');
        B.neon(-12, 3, -19.95, 3, 0.15, 0.06, ORANGE, 3);
        B.box(14, 0, -20, 4, 3, 6, 'rust');
        B.box(14, 3, -20, 2, 2, 2, 'metal');
        B.tank(20, -3, 2, 6, 'accent');
        B.neon(20, 2, -5.05, 1.2, 0.8, 0.06, ORANGE, 4);
        B.tank(-8, 22, 1.4, 4, 'metal');

        // Convoyeurs (couverts bas)
        B.box(-5, 0, -17, 8, 1.1, 1.4, 'cover');
        B.box(-5, 1.1, -17, 8, 0.1, 1.2, 'trim');
        B.box(6, 0, -28, 1.2, 1.2, 1.2, 'crate');
        B.box(7.3, 0, -28, 1.2, 1.2, 1.2, 'crate');
        B.box(24, 0, -26, 2.4, 2.4, 2.4, 'crate');
        B.cover(-24, -26, 3, 0.8, 1.2);
        B.cover(9, -12, 0.8, 3, 1.2);

        // Éclairage industriel (néons blancs au plafond)
        for (const z of [-28, -16]) B.neon(-14, 11, z, 0.3, 0.1, 6, '#fff2dc', 2.5);
        for (const z of [-28, -16]) B.neon(14, 11, z, 0.3, 0.1, 6, '#fff2dc', 2.5);
        B.deco(0, 12, -20, 60, 0.6, 0.8, 'metal');
        B.deco(0, 12, -6, 60, 0.6, 0.8, 'metal');
        B.light(-14, 9, -22, '#ffe6c8', 5, 22);
        B.light(14, 9, -22, '#ffe6c8', 5, 22);
      });
    },
  },

  {
    id: 'port',
    name: 'Port Abyssal',
    tagline: 'Terminal de conteneurs sous la pluie · labyrinthe',
    size: [64, 88],
    theme: {
      skyTop: '#03060c', skyBottom: '#1a2638', sun: '#a8c0ff', sunIntensity: 0.9,
      sunDir: [0.4, 0.8, -0.3], hemiSky: '#6a88b0', hemiGround: '#2a3444', hemiIntensity: 1.35,
      fog: '#121a26', fogDensity: 0.024, night: true, rain: true, water: true, bloom: 0.8, exposure: 1.1,
      ambientSound: 'rain',
      mats: {
        ground: { tex: 'ground', color: '#3a3e44', scale: 5, rough: 0.3, metal: 0.3 },
        wall: { tex: 'concrete', color: '#5a5e66', scale: 3, rough: 0.8 },
        wall2: { tex: 'panelDark', color: '#4a5260', scale: 3, rough: 0.6, metal: 0.4 },
        floor: { tex: 'metal', color: '#4a5058', scale: 3, rough: 0.5, metal: 0.6 },
        metal: { tex: 'metal', color: '#7a828c', scale: 2, rough: 0.4, metal: 0.8 },
        cover: { tex: 'concrete', color: '#6a6e74', scale: 2, rough: 0.8 },
        crate: { tex: 'container', color: '#6a5a3a', scale: 1.2, rough: 0.8 },
        trim: { tex: 'hazard', color: '#ffcc00', scale: 1, rough: 0.6 },
        accent: { tex: 'metal', color: '#e8b400', scale: 2, rough: 0.5, metal: 0.5 },
        c1: { tex: 'container', color: '#b83a24', scale: 3, rough: 0.5, metal: 0.5 },
        c2: { tex: 'container', color: '#24608a', scale: 3, rough: 0.5, metal: 0.5 },
        c3: { tex: 'container', color: '#3a7a3a', scale: 3, rough: 0.5, metal: 0.5 },
        c4: { tex: 'container', color: '#c88a1a', scale: 3, rough: 0.5, metal: 0.5 },
        car1: { tex: 'metal', color: '#e8b400', scale: 2, rough: 0.4, metal: 0.6 },
      },
    },
    build(B) {
      B.ground('ground');
      B.perimeter(1, 'cover', 8);
      B.both((B) => {
        // Bureau du port (déploiement)
        B.house(0, -39, 12, 6, 3.5, 'wall2', { doors: ['+z', '-x', '+x'], roofMat: 'metal' });
        B.neon(0, 3, -35.95, 5, 0.12, 0.06, SODIUM, 3);
        for (const [x, z] of [[-3, -39], [3, -39], [-10, -37], [10, -37], [-20, -38], [20, -38], [0, -33], [-26, -34]]) B.spawn(x, z, Math.PI);

        // Rangées de conteneurs
        B.container(-24, -26, 'z', 'c1');
        B.container(-24, -26, 'z', 'c2', 2.6);
        B.container(-19, -22, 'z', 'c3');
        B.container(-14, -28, 'x', 'c4');
        B.container(-12, -16, 'z', 'c2');
        B.container(-12, -16, 'z', 'c1', 2.6);
        B.container(-26, -10, 'x', 'c4');
        B.container(-20, -4, 'z', 'c3');
        B.container(10, -26, 'x', 'c1');
        B.container(10, -23.5, 'x', 'c3');
        B.container(10, -24.75, 'x', 'c2', 2.6);
        B.container(22, -18, 'z', 'c4');
        B.container(26, -26, 'z', 'c2');
        B.container(26, -26, 'z', 'c3', 2.6);
        B.container(18, -6, 'x', 'c1');
        B.stairs(16.9, -20.2, '+x', 1.6, 2.6, 3.88, 'metal');

        // Entrepôt central (moitié)
        B.box(-5.5, 0, -8, 7, 6, 0.5, 'wall2');
        B.box(5.5, 0, -8, 7, 6, 0.5, 'wall2');
        B.box(0, 3, -8, 4, 3, 0.5, 'wall2');
        B.box(-9, 0, -4.3, 0.5, 6, 7.4, 'wall2');
        B.box(-9, 0, 5.7, 0.5, 6, 4.6, 'wall2');
        B.box(-9, 3, 1.4, 0.5, 3, 4, 'wall2');
        B.deco(0, 6, -4, 18.5, 0.3, 8.5, 'metal');
        B.box(-6, 0, -3, 1.3, 1.3, 1.3, 'crate');
        B.box(-6, 1.3, -3, 1.3, 1.3, 1.3, 'crate');
        B.box(3, 0, -5, 2.6, 1.2, 1.2, 'crate');
        B.neon(0, 5.6, -4, 0.2, 0.08, 6, '#dfefff', 2);
        B.light(0, 5, -3, '#dfefff', 5, 14);

        // Grue portique (décor) + accès plate-forme
        for (const x of [-29, -22]) B.box(x, 0, -14, 0.8, 12, 0.8, 'accent');
        B.deco(-25.5, 12, -14, 9, 0.8, 1.2, 'accent');
        B.deco(-25.5, 12.8, -14, 3, 2, 2.4, 'accent');
        B.neon(-25.5, 15, -14, 0.3, 0.3, 0.3, RED, 5);

        // Couverts divers
        B.car(2, -20, 'z', 'car1');
        B.cover(-4, -30, 3, 0.8, 1.1);
        B.cover(-6, -13, 0.8, 3, 1.1);
        B.cover(28, -8, 0.8, 3, 1.1);
        B.box(6, 0, -14, 1.2, 1.2, 1.2, 'crate');

        // Lampadaires au sodium
        for (const [x, z] of [[-17, -33], [17, -33], [0, -16], [24, -12], [-16, -9]]) {
          B.deco(x, 0, z, 0.2, 7, 0.2, 'metal');
          B.neon(x, 7, z, 0.9, 0.12, 0.4, SODIUM, 3);
        }
        B.light(-17, 6.5, -33, SODIUM, 5, 16);
        B.light(17, 6.5, -24, SODIUM, 5, 16);
      });
    },
  },
];

export const getMap = (id) => MAPS.find((m) => m.id === id) || MAPS[0];
