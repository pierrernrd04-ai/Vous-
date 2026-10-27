// Arsenal : 18 armes originales. Points de vie d'un soldat : 100.
//   damage  : [proche, lointain] par projectile ; range : [début, fin] de la chute
//   rpm     : cadence (coups/min) ; mode : auto | semi | burst | bolt | pump
//   spread  : dispersion en degrés [hanche, visée] ; recoil : degrés par tir
//   move    : multiplicateur de vitesse ; zoom : grossissement en visée
//   model   : paramètres du modèle 3D procédural

export const CLASSES = {
  ar: 'Fusil d\'assaut',
  smg: 'Mitraillette',
  shotgun: 'Fusil à pompe',
  sniper: 'Fusil de précision',
  lmg: 'Mitrailleuse légère',
  pistol: 'Pistolet',
};

const W = (o) => ({
  headMult: 1.4, pellets: 1, burst: 1, burstDelay: 0, adsTime: 0.25, move: 0.95, zoom: 1.3,
  scope: 'dot', reserveMags: 4, ...o,
});

export const WEAPONS = [
  // ── Fusils d'assaut ────────────────────────────────────────────
  W({ id: 'vk12', name: 'VK-12 Vipère', cls: 'ar', desc: 'Polyvalent et maîtrisable. La référence.',
    damage: [26, 19], range: [26, 48], rpm: 720, mode: 'auto', mag: 30, reload: 2.2,
    spread: [4, 0.35], recoil: { v: 0.55, h: 0.28 },
    model: { len: 0.78, body: 'urban', accent: '#19e6ff', stock: 'fixed', mag: 'curved', barrel: 0.22 } }),
  W({ id: 'kr9', name: 'KR-9 Faucheur', cls: 'ar', desc: 'Gros calibre : tue vite, recule fort.',
    damage: [33, 25], range: [24, 45], rpm: 560, mode: 'auto', mag: 30, reload: 2.4,
    spread: [4.5, 0.45], recoil: { v: 0.85, h: 0.38 }, move: 0.92, adsTime: 0.28,
    model: { len: 0.82, body: 'tan', accent: '#ff7a1a', stock: 'fixed', mag: 'curved', barrel: 0.26 } }),
  W({ id: 'm21', name: 'M-21 Rafale', cls: 'ar', desc: 'Rafales de 3 coups chirurgicales.',
    damage: [34, 28], range: [30, 55], rpm: 900, mode: 'burst', burst: 3, burstDelay: 0.26, mag: 30, reload: 2.3,
    spread: [4, 0.25], recoil: { v: 0.5, h: 0.2 }, zoom: 1.45, scope: 'holo',
    model: { len: 0.8, body: 'black', accent: '#ffcc33', stock: 'skeleton', mag: 'straight', barrel: 0.25 } }),
  W({ id: 'arx', name: 'ARX Spectre', cls: 'ar', desc: 'Cadence très élevée, dégâts légers.',
    damage: [22, 16], range: [22, 42], rpm: 860, mode: 'auto', mag: 36, reload: 2.0,
    spread: [3.5, 0.4], recoil: { v: 0.42, h: 0.32 }, move: 0.97,
    model: { len: 0.72, body: 'carbon', accent: '#9b5cff', stock: 'bullpup', mag: 'straight', barrel: 0.18 } }),
  W({ id: 'hv47', name: 'HV-47 Marteau', cls: 'ar', desc: 'Lent et dévastateur à longue portée.',
    damage: [40, 31], range: [30, 60], rpm: 480, mode: 'auto', mag: 25, reload: 2.6,
    spread: [5, 0.4], recoil: { v: 1.05, h: 0.3 }, move: 0.9, adsTime: 0.3,
    model: { len: 0.86, body: 'olive', accent: '#ff3040', stock: 'fixed', mag: 'curved', barrel: 0.3 } }),

  // ── Mitraillettes ──────────────────────────────────────────────
  W({ id: 'k3', name: 'Guêpe K3', cls: 'smg', desc: 'Compacte, très mobile, idéale au corps à corps.',
    damage: [24, 12], range: [10, 24], rpm: 900, mode: 'auto', mag: 32, reload: 1.8,
    spread: [3, 0.6], recoil: { v: 0.4, h: 0.4 }, move: 1.05, adsTime: 0.17, zoom: 1.2,
    model: { len: 0.52, body: 'black', accent: '#19e6ff', stock: 'folded', mag: 'straight', barrel: 0.1 } }),
  W({ id: 'frelon', name: 'Frelon 9', cls: 'smg', desc: 'Équilibrée, efficace jusqu\'à moyenne distance.',
    damage: [28, 15], range: [12, 28], rpm: 720, mode: 'auto', mag: 30, reload: 1.9,
    spread: [3.2, 0.5], recoil: { v: 0.45, h: 0.3 }, move: 1.03, adsTime: 0.19, zoom: 1.2,
    model: { len: 0.58, body: 'tan', accent: '#ffcc33', stock: 'skeleton', mag: 'straight', barrel: 0.12 } }),
  W({ id: 'razor', name: 'Razor MP', cls: 'smg', desc: 'Un déluge de balles. Difficile à tenir.',
    damage: [19, 10], range: [8, 20], rpm: 1100, mode: 'auto', mag: 40, reload: 2.1,
    spread: [3.4, 0.7], recoil: { v: 0.38, h: 0.55 }, move: 1.04, adsTime: 0.18, zoom: 1.15,
    model: { len: 0.5, body: 'carbon', accent: '#ff2a8a', stock: 'bullpup', mag: 'drum', barrel: 0.08 } }),

  // ── Fusils à pompe ─────────────────────────────────────────────
  W({ id: 'brise', name: 'Brise-Porte 12', cls: 'shotgun', desc: 'Pompe classique : un tir, une élimination.',
    damage: [20, 5], range: [7, 18], rpm: 72, mode: 'pump', pellets: 8, mag: 6, reload: 3.0,
    spread: [6, 4], recoil: { v: 4, h: 0.8 }, move: 0.95, adsTime: 0.25, zoom: 1.15, headMult: 1.2, scope: 'iron',
    model: { len: 0.84, body: 'black', accent: '#ff7a1a', stock: 'fixed', mag: 'tube', barrel: 0.3 } }),
  W({ id: 'dragon', name: 'Dragon S8', cls: 'shotgun', desc: 'Semi-automatique, enchaîne les tirs.',
    damage: [14, 4], range: [6, 15], rpm: 220, mode: 'semi', pellets: 8, mag: 8, reload: 2.8,
    spread: [5.6, 4], recoil: { v: 2.6, h: 0.7 }, move: 0.94, adsTime: 0.24, zoom: 1.15, headMult: 1.2, scope: 'iron',
    model: { len: 0.8, body: 'urban', accent: '#ff3040', stock: 'skeleton', mag: 'box', barrel: 0.26 } }),
  W({ id: 'krait', name: 'Krait Duo', cls: 'shotgun', desc: 'Double canon. Brutal, mais deux cartouches.',
    damage: [22, 5], range: [6, 13], rpm: 280, mode: 'semi', pellets: 10, mag: 2, reload: 2.1, reserveMags: 10,
    spread: [6.5, 5], recoil: { v: 5, h: 1 }, move: 0.97, adsTime: 0.2, zoom: 1.1, headMult: 1.2, scope: 'iron',
    model: { len: 0.7, body: 'tan', accent: '#ffcc33', stock: 'fixed', mag: 'none', barrel: 0.28, double: true } }),

  // ── Fusils de précision ────────────────────────────────────────
  W({ id: 'lance', name: 'Lance HX-50', cls: 'sniper', desc: 'À verrou. Une balle au torse suffit.',
    damage: [110, 95], range: [40, 120], rpm: 48, mode: 'bolt', mag: 5, reload: 3.2,
    spread: [9, 0], recoil: { v: 3.5, h: 0.6 }, move: 0.86, adsTime: 0.42, zoom: 4.5, headMult: 2, scope: 'sniper',
    model: { len: 1.05, body: 'olive', accent: '#19e6ff', stock: 'sniper', mag: 'box', barrel: 0.42 } }),
  W({ id: 'sentinelle', name: 'Sentinelle DMR', cls: 'sniper', desc: 'Tir semi-auto précis, deux balles au corps.',
    damage: [52, 44], range: [40, 90], rpm: 260, mode: 'semi', mag: 15, reload: 2.6,
    spread: [6, 0.05], recoil: { v: 1.6, h: 0.4 }, move: 0.9, adsTime: 0.33, zoom: 2.8, headMult: 2, scope: 'scope',
    model: { len: 0.95, body: 'black', accent: '#ffcc33', stock: 'fixed', mag: 'box', barrel: 0.34 } }),
  W({ id: 'eclipse', name: 'Éclipse .50', cls: 'sniper', desc: 'Anti-matériel. Traverse tout, sauf la patience.',
    damage: [150, 130], range: [50, 150], rpm: 36, mode: 'bolt', mag: 4, reload: 3.6,
    spread: [10, 0], recoil: { v: 5, h: 1 }, move: 0.8, adsTime: 0.52, zoom: 6, headMult: 2, scope: 'sniper',
    model: { len: 1.15, body: 'carbon', accent: '#ff3040', stock: 'sniper', mag: 'box', barrel: 0.5 } }),

  // ── Mitrailleuses légères ──────────────────────────────────────
  W({ id: 'colosse', name: 'Colosse L8', cls: 'lmg', desc: '100 cartouches de suppression.',
    damage: [30, 24], range: [30, 55], rpm: 660, mode: 'auto', mag: 100, reload: 5.4, reserveMags: 2,
    spread: [5.5, 0.5], recoil: { v: 0.5, h: 0.42 }, move: 0.84, adsTime: 0.4, zoom: 1.35, scope: 'holo',
    model: { len: 0.95, body: 'olive', accent: '#ff7a1a', stock: 'fixed', mag: 'drum', barrel: 0.34, heavy: true } }),
  W({ id: 'rempart', name: 'Rempart 200', cls: 'lmg', desc: 'Lourde et précise, contrôle les zones.',
    damage: [36, 29], range: [32, 60], rpm: 520, mode: 'auto', mag: 80, reload: 5.0, reserveMags: 2,
    spread: [5.5, 0.4], recoil: { v: 0.62, h: 0.3 }, move: 0.82, adsTime: 0.42, zoom: 1.4,
    model: { len: 1.0, body: 'black', accent: '#19e6ff', stock: 'fixed', mag: 'box', barrel: 0.36, heavy: true } }),

  // ── Pistolets ──────────────────────────────────────────────────
  W({ id: 'mamba', name: 'Mamba 9', cls: 'pistol', desc: 'Arme de poing fiable et rapide.',
    damage: [30, 18], range: [10, 25], rpm: 420, mode: 'semi', mag: 15, reload: 1.5, reserveMags: 5,
    spread: [2.5, 0.6], recoil: { v: 1, h: 0.4 }, move: 1.06, adsTime: 0.14, zoom: 1.15, scope: 'iron',
    model: { len: 0.24, body: 'black', accent: '#19e6ff', pistol: true } }),
  W({ id: 'cobra', name: 'Cobra .45', cls: 'pistol', desc: 'Revolver. Deux balles suffisent.',
    damage: [55, 38], range: [12, 30], rpm: 170, mode: 'semi', mag: 6, reload: 2.2, reserveMags: 6,
    spread: [2.8, 0.4], recoil: { v: 2.6, h: 0.6 }, move: 1.04, adsTime: 0.16, zoom: 1.15, scope: 'iron',
    model: { len: 0.28, body: 'urban', accent: '#ff7a1a', pistol: true, revolver: true } }),
];

export const getWeapon = (id) => WEAPONS.find((w) => w.id === id) || WEAPONS[0];
export const PRIMARIES = WEAPONS.filter((w) => w.cls !== 'pistol');
export const SECONDARIES = WEAPONS.filter((w) => w.cls === 'pistol');

/** Dégâts d'un projectile à une distance donnée (chute linéaire). */
export function damageAt(w, dist) {
  const [near, far] = w.damage;
  const [r0, r1] = w.range;
  if (dist <= r0) return near;
  if (dist >= r1) return far;
  return near + (far - near) * ((dist - r0) / (r1 - r0));
}

/** Notes 0–100 pour l'armurerie. */
export function weaponStats(w) {
  const dps = (w.damage[0] * w.pellets * w.rpm) / 60;
  return {
    Dégâts: Math.min(100, (w.damage[0] * w.pellets) / 1.3),
    Cadence: Math.min(100, w.rpm / 11),
    Portée: Math.min(100, w.range[1] / 1.3),
    Précision: Math.max(5, 100 - w.spread[1] * 18 - w.recoil.v * 12),
    Mobilité: Math.min(100, (w.move - 0.75) * 330),
    dps,
  };
}
