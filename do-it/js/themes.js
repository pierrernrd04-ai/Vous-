// Catalogue des thèmes, partagé par le navigateur (couleurs, classement local)
// et par la fonction serveur (liste donnée à Claude).
// `hue` : teinte OKLCH de la pastille. `strong` / `weak` : racines de mots
// pour le classement hors-ligne (un mot fort vaut 2 points, un faible 1).

export const THEMES = [
  {
    id: 'humeur', label: 'Humeurs', emoji: '🌤️', hue: 75,
    covers: 'émotions, moral, stress, joie, colère, fatigue morale, ressenti du jour',
    strong: ['humeur', 'moral', 'stress', 'angoiss', 'anxi', 'triste', 'tristesse', 'deprim', 'heureux', 'heureuse', 'joie', 'colere', 'enerve', 'emotion', 'ressens', 'ressenti', 'pleur', 'motive', 'demotive', 'seul', 'solitude', 'frustr', 'serein', 'apais'],
    weak: ['content', 'contente', 'sentiment', 'sens', 'senti', 'peur', 'fier', 'fiere', 'soulag', 'bien', 'mal', 'moyen', 'vide', 'perdu'],
  },
  {
    id: 'sport', label: 'Sport', emoji: '🏃', hue: 150,
    covers: 'entraînements, séances, performances, course, salle, matchs, activité physique',
    strong: ['sport', 'courir', 'couru', 'footing', 'jogging', 'running', 'muscu', 'entrainement', 'entraine', 'seance', 'velo', 'natation', 'nage', 'piscine', 'football', 'tennis', 'marathon', 'semi-marathon', 'kilometre', 'yoga', 'crossfit', 'fitness', 'abdos', 'pompes', 'randonnee', 'rando', 'boxe', 'basket', 'rugby', 'escalade', 'cardio', 'fractionne', 'trail', 'triathlon', 'padel', 'squat'],
    weak: ['salle', 'match', 'km', 'foot', 'marche', 'etirement', 'courbature', 'chrono', 'record', 'coach'],
  },
  {
    id: 'alcool', label: 'Alcool', emoji: '🍷', hue: 15,
    covers: 'consommation d\'alcool, apéros, soirées arrosées, sobriété, gueule de bois',
    strong: ['alcool', 'biere', 'vin', 'vins', 'apero', 'aperitif', 'cocktail', 'whisky', 'vodka', 'rhum', 'champagne', 'bourre', 'cuite', 'ivre', 'pinte', 'pastis', 'sobre', 'sobriete', 'tequila', 'spritz', 'mojito', 'cidre', 'ricard', 'gueule de bois'],
    weak: ['verre', 'verres', 'boire', 'bu', 'bois', 'bar', 'shot', 'shots', 'rose', 'gin', 'soiree'],
  },
  {
    id: 'sante', label: 'Santé', emoji: '🩺', hue: 195,
    covers: 'maladies, douleurs, médecin, traitements, bien-être physique',
    strong: ['sante', 'medecin', 'docteur', 'malade', 'maladie', 'douleur', 'blessure', 'blesse', 'hopital', 'urgences', 'medicament', 'traitement', 'kine', 'dentiste', 'fievre', 'migraine', 'grippe', 'rhume', 'ordonnance', 'symptome', 'therapie', 'psy'],
    weak: ['mal au', 'tete', 'dos', 'genou', 'ventre', 'gorge', 'toux', 'rendez-vous', 'analyse'],
  },
  {
    id: 'sommeil', label: 'Sommeil', emoji: '😴', hue: 265,
    covers: 'nuits, coucher, réveil, insomnies, siestes, rêves',
    strong: ['sommeil', 'dormi', 'dormir', 'dors', 'insomnie', 'sieste', 'nuit blanche', 'reveil', 'reveille', 'couche', 'coucher', 'reve', 'cauchemar', 'endormi', 'endormir'],
    weak: ['nuit', 'fatigue', 'fatiguee', 'creve', 'epuise', 'lit', 'heures de sommeil'],
  },
  {
    id: 'alimentation', label: 'Alimentation', emoji: '🥗', hue: 110,
    covers: 'repas, cuisine, nutrition, régime, courses alimentaires',
    strong: ['manger', 'mange', 'repas', 'dejeuner', 'diner', 'petit-dejeuner', 'cuisine', 'cuisin', 'recette', 'regime', 'nutrition', 'calorie', 'proteine', 'legume', 'fruit', 'restaurant', 'resto', 'pizza', 'burger', 'sucre', 'jeune', 'grignot'],
    weak: ['faim', 'plat', 'courses', 'bouffe', 'gateau', 'cafe', 'eau'],
  },
  {
    id: 'travail', label: 'Travail', emoji: '💼', hue: 230,
    covers: 'boulot, études, collègues, réunions, carrière, recherche d\'emploi',
    strong: ['travail', 'boulot', 'taf', 'bureau', 'collegue', 'patron', 'manager', 'reunion', 'client', 'entretien', 'embauche', 'candidature', 'cv', 'stage', 'alternance', 'carriere', 'promotion', 'licenciement', 'teletravail', 'job', 'dossier', 'deadline', 'examen', 'partiel', 'cours', 'etudes', 'fac'],
    weak: ['projet', 'equipe', 'mail', 'mails', 'presentation', 'salaire', 'chef', 'boite', 'entreprise', 'poste'],
  },
  {
    id: 'argent', label: 'Argent', emoji: '💶', hue: 95,
    covers: 'budget, dépenses, épargne, revenus, achats, factures',
    strong: ['argent', 'budget', 'depense', 'economie', 'epargne', 'salaire', 'facture', 'loyer', 'credit', 'pret', 'banque', 'compte', 'euros', 'investi', 'placement', 'impot', 'dette', 'rembourse', 'paye'],
    weak: ['achat', 'achete', 'payer', 'cher', 'prix', 'fric', 'thune', 'sous'],
  },
  {
    id: 'famille', label: 'Famille', emoji: '🏡', hue: 40,
    covers: 'parents, enfants, frères et sœurs, proches, vie de famille',
    strong: ['famille', 'maman', 'papa', 'mere', 'pere', 'parents', 'frere', 'soeur', 'fils', 'fille', 'enfant', 'bebe', 'grand-mere', 'grand-pere', 'mamie', 'papi', 'oncle', 'tante', 'cousin', 'cousine', 'neveu', 'niece', 'beau-pere', 'belle-mere'],
    weak: ['maison', 'proches', 'dimanche'],
  },
  {
    id: 'amour', label: 'Amour', emoji: '❤️', hue: 355,
    covers: 'couple, relation amoureuse, rencontres, séduction, rupture, mariage',
    strong: ['amour', 'amoureux', 'amoureuse', 'copine', 'copain', 'couple', 'chérie', 'cherie', 'cheri', 'femme', 'mari', 'fiance', 'fiancee', 'mariage', 'rupture', 'date', 'rencontre', 'bisou', 'embrass', 'tinder', 'relation', 'jaloux', 'jalouse', 'saint-valentin'],
    weak: ['ensemble', 'aime', 'manque', 'coeur'],
  },
  {
    id: 'amis', label: 'Amis & sorties', emoji: '🎉', hue: 320,
    covers: 'amitiés, sorties, fêtes, vie sociale',
    strong: ['ami', 'amis', 'amie', 'amies', 'pote', 'potes', 'copains', 'copines', 'bande', 'fete', 'anniversaire', 'sortie', 'sorti', 'concert', 'boite de nuit', 'invite', 'invitation'],
    weak: ['soiree', 'week-end', 'retrouve', 'groupe', 'rigole'],
  },
  {
    id: 'projets', label: 'Projets & objectifs', emoji: '🎯', hue: 285,
    covers: 'ambitions, objectifs, résolutions, projets perso, idées, décisions',
    strong: ['objectif', 'projet', 'ambition', 'resolution', 'plan', 'planifi', 'lancer', 'creer', 'entreprendre', 'business', 'idee', 'decision', 'decide', 'reve de', 'challenge', 'defi', 'progress', 'ameliorer', 'habitude', 'discipline'],
    weak: ['futur', 'avenir', 'bientot', 'vouloir', 'veux', 'commencer', 'motivation'],
  },
  {
    id: 'loisirs', label: 'Loisirs & culture', emoji: '🎬', hue: 300,
    covers: 'films, séries, livres, musique, jeux, hobbies, culture',
    strong: ['film', 'serie', 'netflix', 'cinema', 'livre', 'lecture', 'lu', 'roman', 'musique', 'chanson', 'album', 'jeu video', 'jeux', 'console', 'playstation', 'manga', 'podcast', 'expo', 'musee', 'theatre', 'peinture', 'dessin', 'guitare', 'piano', 'photo'],
    weak: ['regarde', 'ecoute', 'joue', 'hobby', 'passion'],
  },
  {
    id: 'voyages', label: 'Voyages', emoji: '✈️', hue: 215,
    covers: 'voyages, vacances, déplacements, découvertes de lieux',
    strong: ['voyage', 'vacances', 'avion', 'aeroport', 'train', 'hotel', 'airbnb', 'valise', 'plage', 'montagne', 'roadtrip', 'road trip', 'visite', 'visiter', 'etranger', 'pays', 'billet', 'escapade', 'camping'],
    weak: ['partir', 'parti', 'route', 'ville', 'mer'],
  },
  {
    id: 'reflexions', label: 'Réflexions', emoji: '💭', hue: 255,
    covers: 'pensées, introspection, valeurs, questions existentielles, leçons tirées',
    strong: ['reflechi', 'reflexion', 'pense que', 'je me demande', 'question', 'sens de', 'valeurs', 'lecon', 'compris', 'realise', 'prise de conscience', 'philosoph', 'introspection', 'remise en question'],
    weak: ['pense', 'penser', 'vie', 'pourquoi', 'idee'],
  },
  {
    id: 'gratitude', label: 'Gratitude', emoji: '🙏', hue: 60,
    covers: 'reconnaissance, petites victoires, moments heureux à retenir',
    strong: ['gratitude', 'reconnaissant', 'reconnaissante', 'merci', 'chance', 'grace a', 'kiffe', 'victoire', 'reussi', 'fierte', 'beau moment', 'magnifique'],
    weak: ['super', 'genial', 'top', 'cool', 'sourire'],
  },
  {
    id: 'quotidien', label: 'Quotidien', emoji: '🗓️', hue: 220,
    covers: 'faits du jour, tâches, organisation, ce qui ne rentre nulle part ailleurs',
    strong: ['aujourd', 'journee', 'ce matin', 'ce soir', 'menage', 'rangement', 'lessive', 'courses', 'administratif', 'demarche', 'rdv'],
    weak: ['matin', 'soir', 'apres-midi', 'hier', 'demain'],
  },
];

const BY_ID = new Map(THEMES.map((t) => [t.id, t]));

export const FALLBACK_THEME_ID = 'quotidien';

/** Minuscules, sans accents, espaces et ponctuation simplifiés. */
export function fold(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’`]/g, "'");
}

/** Identifiant court à partir d'un libellé : « Bricolage maison » → « bricolage-maison ». */
export function slugify(label) {
  return fold(label)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

/** Teinte stable pour un thème personnel. */
export function hueFor(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

export function isCatalogTheme(id) {
  return BY_ID.has(id);
}

/** Thème du catalogue ou thème personnel ; jamais `undefined`. */
export function getTheme(id, customThemes = []) {
  if (BY_ID.has(id)) return BY_ID.get(id);
  const custom = customThemes.find((t) => t.id === id);
  if (custom) return { hue: hueFor(custom.id), ...custom };
  return { id, label: id, emoji: '🏷️', hue: hueFor(id) };
}

/**
 * Rattache un thème proposé (par l'IA ou un import) au catalogue ou aux thèmes
 * personnels. Renvoie `{ id, theme, isNew }` ; `theme` est à ajouter aux thèmes
 * personnels quand `isNew` vaut vrai.
 */
export function resolveTheme(proposal, customThemes = []) {
  const rawId = slugify(proposal?.id || proposal?.label || '');
  const labelSlug = slugify(proposal?.label || '');
  if (!rawId && !labelSlug) return null;

  for (const t of THEMES) {
    if (t.id === rawId || slugify(t.label) === labelSlug || t.id === labelSlug) return { id: t.id, theme: t, isNew: false };
  }
  for (const t of customThemes) {
    if (t.id === rawId || slugify(t.label) === labelSlug) return { id: t.id, theme: t, isNew: false };
  }
  const label = String(proposal?.label || rawId).trim().slice(0, 28) || rawId;
  const emoji = String(proposal?.emoji || '🏷️').trim().slice(0, 8) || '🏷️';
  const theme = { id: rawId || labelSlug, label: label.charAt(0).toUpperCase() + label.slice(1), emoji, hue: hueFor(rawId || labelSlug) };
  return { id: theme.id, theme, isNew: true };
}

export const MOODS = [
  { id: 'tres_bas', label: 'Très bas', emoji: '😞', score: -2 },
  { id: 'bas', label: 'Bas', emoji: '😕', score: -1 },
  { id: 'neutre', label: 'Neutre', emoji: '😐', score: 0 },
  { id: 'bon', label: 'Bon', emoji: '🙂', score: 1 },
  { id: 'excellent', label: 'Excellent', emoji: '🤩', score: 2 },
];

export function getMood(id) {
  return MOODS.find((m) => m.id === id) || MOODS[2];
}
