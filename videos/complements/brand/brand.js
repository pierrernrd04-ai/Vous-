/* Ambrel brand data shared by every scene (classic script -> window.AMBREL; also usable from
   Node: `const AMBREL = require('../brand/brand.js')` or via tools/lint-copy.mjs).
   Copy texts from here instead of retyping them: claims and legal mentions are worded exactly
   as authorised (see brand-system.md §9-§11). */
(function (root) {
  'use strict';
  var NB = ' '; // no-break space (use before %, :, ?, ! and between number and unit)

  var AMBREL = {
    name: 'Ambrel',
    tagline: 'Tout est écrit.',
    fictive: 'Ambrel est une marque fictive (démonstration).',

    product: {
      name: 'Magnésium bisglycinate + vitamine B6',
      nameShort: 'Magnésium bisglycinate + B6',
      denomination: 'Complément alimentaire',
      format: '60 gélules végétales',
      dose: '3 gélules par jour',
      magnesium: '300' + NB + 'mg de magnésium (80' + NB + '% VNR)',
      b6: '1,4' + NB + 'mg de vitamine B6 (100' + NB + '% VNR)',
      mgShort: '300' + NB + 'mg · 80' + NB + '% VNR',
      b6Short: '1,4' + NB + 'mg · 100' + NB + '% VNR',
      form: 'Bisglycinate de magnésium',
      formExplained: 'Magnésium lié à 2 molécules de glycine (un acide aminé)',
      capsule: 'Gélule végétale (hydroxypropylméthylcellulose)',
      free: 'Sans arôme ni édulcorant',
      adult: 'Réservé à l’adulte',
      ingredients: 'Bisglycinate de magnésium ; enveloppe de la gélule : hydroxypropylméthylcellulose (gélule d’origine végétale) ; vitamine B6 (chlorhydrate de pyridoxine).',
    },

    colors: {
      ink: '#211B16', amber: '#C46F28', amberDeep: '#7E3F14', honey: '#EDB467', cream: '#F6EFE4',
      linen: '#EFE5D6', stone: '#D8CEBF', clay: '#A8927A', clayDark: '#6E5A45', mist: '#C7D2DA',
      dawn: '#4F6175', night: '#1F2A38', problem: '#8E8A85', white: '#FFFFFF',
    },

    /* Authorised health claims, Reg. (EU) 432/2012, exact French wording.
       Condition met by the product: >= 15 % NRV per daily dose (Mg 80 %, B6 100 %). */
    claims: {
      // ready-to-use combined sentences (both nutrients hold the claim)
      fatigue: 'Le magnésium et la vitamine B6 contribuent à réduire la fatigue.',
      nerveux: 'Le magnésium et la vitamine B6 contribuent au fonctionnement normal du système nerveux.',
      psycho: 'Le magnésium et la vitamine B6 contribuent à des fonctions psychologiques normales.',
      energie: 'Le magnésium et la vitamine B6 contribuent à un métabolisme énergétique normal.',
      muscle: 'Le magnésium contribue à une fonction musculaire normale.',
      // full lists (single nutrient)
      magnesium: [
        'Le magnésium contribue à réduire la fatigue.',
        'Le magnésium contribue à l’équilibre électrolytique.',
        'Le magnésium contribue à un métabolisme énergétique normal.',
        'Le magnésium contribue au fonctionnement normal du système nerveux.',
        'Le magnésium contribue à une fonction musculaire normale.',
        'Le magnésium contribue à une synthèse protéique normale.',
        'Le magnésium contribue à des fonctions psychologiques normales.',
        'Le magnésium contribue au maintien d’une ossature normale.',
        'Le magnésium contribue au maintien d’une dentition normale.',
        'Le magnésium joue un rôle dans le processus de division cellulaire.',
      ],
      b6: [
        'La vitamine B6 contribue à la synthèse normale de la cystéine.',
        'La vitamine B6 contribue à un métabolisme énergétique normal.',
        'La vitamine B6 contribue au fonctionnement normal du système nerveux.',
        'La vitamine B6 contribue au métabolisme normal de l’homocystéine.',
        'La vitamine B6 contribue au métabolisme normal des protéines et du glycogène.',
        'La vitamine B6 contribue à des fonctions psychologiques normales.',
        'La vitamine B6 contribue à la formation normale de globules rouges.',
        'La vitamine B6 contribue au fonctionnement normal du système immunitaire.',
        'La vitamine B6 contribue à réduire la fatigue.',
        'La vitamine B6 contribue à réguler l’activité hormonale.',
      ],
    },

    legal: {
      // end card, >= 4-5 s, horizontal, contrasted (Reg. 1924/2006 art. 10.2 + labelling mentions)
      full: 'Complément alimentaire à base de magnésium et de vitamine B6. 3 gélules par jour. ' +
        'Ne pas dépasser la dose journalière recommandée. Tenir hors de portée des jeunes enfants. ' +
        'Réservé à l’adulte. Un complément alimentaire ne se substitue pas à une alimentation variée ' +
        'et équilibrée et à un mode de vie sain.',
      fictive: 'Ambrel est une marque fictive (démonstration).',
      // compact variant when no health claim is made in the video (V2)
      short: 'Complément alimentaire. 3 gélules par jour. Ne pas dépasser la dose journalière recommandée. ' +
        'Tenir hors de portée des jeunes enfants. Réservé à l’adulte. Une alimentation variée et ' +
        'équilibrée et un mode de vie sain sont importants.',
    },

    mentions: {
      ad: 'Publicité',
      aiBadge: 'Contenu généré par IA',
      aiVisual: 'Visuel généré par IA',
      aiVoice: 'Voix générée par IA',
      virtual: 'Images virtuelles',
      film: 'Film publicitaire généré par IA',
      // per video (opening 0-2 s line + permanent badge)
      v1: { open: 'Publicité · Visuel généré par IA · Voix générée par IA', badge: 'Publicité · Contenu généré par IA' },
      v2: { open: 'Publicité · Visuel généré par IA · Voix générée par IA', badge: 'Publicité · Visuel généré par IA' }, // drop the voice part if V2 has no VO
      v3: { open: 'Publicité · Visuel généré par IA · Voix générée par IA', badge: 'Publicité · Contenu généré par IA' },
      v4: { open: 'Film publicitaire généré par IA · Images virtuelles · Voix générée par IA', badge: 'Publicité · Contenu généré par IA' },
    },

    cta: {
      main: 'Découvre la composition',
      alt: ['Voir la composition', 'Lis l’étiquette complète', 'Lien en bio'],
      button: 'En savoir plus',
    },

    /* asset paths relative to a scene living in videos/complements/<dir>/ */
    assets: {
      css: '../brand/brand.css',
      logo: '../brand/logo.svg', logoLight: '../brand/logo-light.svg', mark: '../brand/logo-mark.svg',
      packshotSvg: '../brand/packshot.svg',
      packshot: '../brand/png/packshot-transparent-2400.png',      // 2000x2400, alpha
      packshot1200: '../brand/png/packshot-transparent-1200.png',  // 1000x1200, alpha
      jarBody: '../brand/png/packshot-body-2400.png',              // same canvas, no lid
      jarLid: '../brand/png/packshot-lid-2400.png',                // same canvas, lid only
      packshotSquare: '../brand/png/packshot-1080.png',
      labelWrap: '../brand/png/label-wrap-2x.png',                 // 3496x1060 unrolled label
      capsule: '../brand/capsule.svg', capsulePng: '../brand/png/capsule-640.png',
    },
    /* jar geometry inside the 1000x1200 packshot canvas (multiply by 2 for the 2400 PNGs) */
    jar: { body: [222, 306, 778, 1073], lid: [258, 140, 742, 300], label: [222, 424, 778, 963], neckY: 292, centerX: 500 },

    /* Forbidden wording (normalised: lower case, no accents). level 'error' = never use. */
    forbidden: [
      ['anti[- ]?fatigue', 'error'], ['boost', 'error'], ['fini(e)? la fatigue', 'error'], ['plus (jamais )?de fatigue', 'error'],
      ['effet immediat', 'error'], ['immediatement', 'warn'], ['instantane', 'error'], ['en \\d+ jours', 'error'], ['en (sept|dix|quinze|trente) jours', 'error'],
      ['sommeil', 'error'], ['dormir', 'error'], ['dors mieux', 'error'], ['endorm', 'error'], ['insomni', 'error'],
      ['stress', 'error'], ['\\bzen\\b', 'error'], ['anxi', 'error'], ['angoiss', 'error'], ['detente', 'warn'], ['relax', 'error'],
      ['crampe', 'error'], ['recuperation', 'error'], ['\\brecup\\b', 'error'],
      ['brule[- ]?graisse', 'error'], ['minceur', 'error'], ['maigri', 'error'], ['perte de poids', 'error'], ['kilos?\\b', 'warn'],
      ['prise de (muscle|masse)', 'error'], ['muscler', 'error'],
      ['cliniquement', 'error'], ['prouve', 'error'], ['\\bn ?° ?1\\b', 'error'], ['numero 1', 'error'], ['meilleur', 'error'], ['le plus efficace', 'error'],
      ['miracle', 'warn'],
      ['absorption', 'error'], ['absorbe', 'error'], ['biodisponib', 'error'], ['assimil', 'error'],
      ['carence', 'error'], ['deficit', 'error'], ['manque de magnesium', 'error'],
      ['soign', 'warn'], ['guer', 'error'], ['traitement', 'error'], ['remede', 'error'], ['medicament', 'error'], ['previen', 'error'], ['prevenir', 'error'], ['maladie', 'error'], ['symptome', 'error'], ['therapeut', 'error'],
      ['medecin', 'error'], ['pharmacien', 'error'], ['naturopath', 'error'], ['docteur', 'error'], ['recommande par', 'error'],
      ['detox', 'error'], ['immunite\\b', 'error'], ['naturel', 'warn'], ['\\bpur\\b', 'warn'], ['vegan', 'warn'],
      ['\\benergie\\b', 'warn'], ['vitalite', 'warn'], ['bien[- ]etre', 'warn'],
      ['alimentation ne (suffit|couvre)', 'error'],
      ['\\bavis\\b', 'warn'], ['etoiles', 'warn'], ['\\d[,.]\\d ?/ ?5', 'error'], ['\\+ ?\\d+ ?%', 'error'], ['clients satisfaits', 'error'],
      ['depuis que je (le |la )?prends', 'error'], ['ca a change', 'error'], ['avant ?/ ?apres', 'error'],
      ['plus que \\d+ en stock', 'error'], ['derniere chance', 'error'],
    ],
  };

  function norm(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');
  }
  /** AMBREL.lint(text) -> [{term, level, excerpt}] */
  AMBREL.lint = function (text) {
    var n = norm(text), out = [];
    AMBREL.forbidden.forEach(function (f) {
      var re = new RegExp(f[0], 'g'), m;
      while ((m = re.exec(n))) {
        out.push({ term: f[0], level: f[1], excerpt: n.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30) });
        if (!re.global) break;
      }
    });
    return out;
  };
  AMBREL.NB = NB;

  if (typeof module === 'object' && module.exports) module.exports = AMBREL;
  else root.AMBREL = AMBREL;
})(typeof window !== 'undefined' ? window : globalThis);
