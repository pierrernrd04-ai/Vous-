// Phrases de motivation et idées de sujets.

export const QUOTES = [
  'Dis-le. Do It l’écrit.',
  'Les paroles s’envolent. Les tiennes restent.',
  'Ta voix vaut de l’or. Fais-en des lignes.',
  'Raconte en vrac, relis-toi en pro.',
  'Pas besoin de bien parler. Juste de parler.',
  'Les « euh » et les « en fait », on s’en charge.',
  'Chaque journée mérite son chapitre.',
  'Aujourd’hui, c’est toi l’auteur.',
  'Une minute de vrai vaut mieux qu’une page blanche.',
  'Ce que tu vis mérite d’être écrit.',
  'Ton futur toi te remerciera de l’avoir dit.',
  'Un mot ce soir, une histoire demain.',
  'Parle à cœur ouvert, on garde le fil.',
  'Le premier mot est le plus dur. Le reste coule.',
  'Tu parles, ça s’écrit, ça reste.',
  'Transforme tes paroles en or massif.',
];

export function quoteAt(index) {
  return QUOTES[((index % QUOTES.length) + QUOTES.length) % QUOTES.length];
}

// Idées de sujet : générales, puis selon les thèmes qui reviennent le plus.
const GENERAL_PROMPTS = [
  'Raconte ta journée en trois moments.',
  'Qu’est-ce qui t’a fait sourire aujourd’hui ?',
  'Qu’est-ce qui te trotte dans la tête en ce moment ?',
  'De quoi es-tu fier cette semaine ?',
  'Qu’est-ce que tu ferais différemment aujourd’hui ?',
  'Comment te sens-tu, là, maintenant ?',
  'Quelle petite victoire veux-tu garder en mémoire ?',
  'Qu’est-ce qui t’attend demain ?',
];

const THEME_PROMPTS = {
  sport: 'Comment s’est passée ta dernière séance ?',
  alcool: 'Combien de verres cette semaine, et dans quel contexte ?',
  humeur: 'Sur 10, ton moral aujourd’hui ? Raconte pourquoi.',
  sommeil: 'Comment as-tu dormi cette nuit ?',
  travail: 'Qu’est-ce qui a compté au travail aujourd’hui ?',
  famille: 'Des nouvelles de tes proches ?',
  amour: 'Comment va ton cœur en ce moment ?',
  amis: 'Raconte ta dernière sortie entre amis.',
  projets: 'Où en est ton projet du moment ?',
  argent: 'Une dépense ou une économie à noter ?',
  alimentation: 'Qu’as-tu mangé de bon aujourd’hui ?',
  sante: 'Comment va ton corps aujourd’hui ?',
  loisirs: 'Qu’est-ce que tu regardes, lis ou écoutes en ce moment ?',
  voyages: 'Raconte un lieu qui t’a marqué.',
  reflexions: 'Une idée qui t’a fait réfléchir récemment ?',
  gratitude: 'Trois choses pour lesquelles tu es reconnaissant aujourd’hui ?',
};

/** Trois idées de sujet, dont une liée au thème le plus fréquent. */
export function promptIdeas(topThemeIds = [], seed = 0) {
  const ideas = [];
  for (const id of topThemeIds) {
    if (THEME_PROMPTS[id] && ideas.length < 2) ideas.push(THEME_PROMPTS[id]);
  }
  for (let i = 0; ideas.length < 3 && i < GENERAL_PROMPTS.length; i++) {
    const p = GENERAL_PROMPTS[(seed + i) % GENERAL_PROMPTS.length];
    if (!ideas.includes(p)) ideas.push(p);
  }
  return ideas;
}

// Messages pendant que l’IA écrit.
export const WRITING_STEPS = [
  'Je remets tes idées dans l’ordre…',
  'Je chasse les « en fait » et les « du coup »…',
  'Je peaufine la grammaire…',
  'Je trouve le bon thème…',
  'Je polis la dernière phrase…',
];
