// Mode local : quand l'IA n'est pas joignable (hors-ligne, site non configuré),
// Do It nettoie quand même la transcription et la classe par mots-clés.
// L'entrée est marquée « à sublimer » et repasse par l'IA dès que possible.
import { THEMES, FALLBACK_THEME_ID, fold } from './themes.js';

// Tics de langage supprimés partout.
// Les groupes de plusieurs mots passent avant les mots seuls.
const FILLERS = [
  'bon ben', 'bon bah', 'enfin bref', 'en fait', 'du coup', 'tu vois', 'tu sais', 'vous voyez',
  'j\'veux dire', 'je veux dire', 'comment dire', 'euh+', 'heu+', 'hum+', 'hmm+', 'bah', 'ben',
  'genre', 'disons', 'voilà',
];

// Mots d'amorce retirés en tout début de prise.
const OPENERS = /^(?:(?:bon|alors|donc|ok|okay|bref|et)[\s,]+)+/i;

// Phrases réduites à un mot d'amorce, ignorées.
const TRIVIAL = new Set(['alors', 'bon', 'donc', 'ok', 'okay', 'bref', 'et', 'voila', 'enfin', 'bah', 'ben']);

// « quoi » n'est un tic qu'en fin de phrase et hors tournures comme « c'est quoi ».
const QUOI = /(^|\s)(?<!(?:^|\s)(?:c'est|de|à|a|pour|sur|en|par|avec|sans|savoir|dire|faire|fais|fait|sais|sait|est-ce)\s)quoi(?=\s*(?:[.,;!?]|$|\s(?:mais|et|donc|alors|enfin|parce|puis)\b))/gi;

// Oral → écrit (appliqué sur le texte en minuscules, avant la remise en forme).
const SPOKEN = [
  [/\bj'?suis\b/g, 'je suis'],
  [/\bchui\b/g, 'je suis'],
  [/\bchuis\b/g, 'je suis'],
  [/\bj'?sais pas\b/g, 'je ne sais pas'],
  [/\bchais pas\b/g, 'je ne sais pas'],
  [/\bt'es\b/g, 'tu es'],
  [/\bt'as\b/g, 'tu as'],
  [/\by'?a pas\b/g, 'il n\'y a pas'],
  [/\by'?a\b/g, 'il y a'],
  [/\bil y a pas\b/g, 'il n\'y a pas'],
  [/\bouais\b/g, 'oui'],
  [/\bc'est pas\b/g, 'ce n\'est pas'],
  [/\bc'était pas\b/g, 'ce n\'était pas'],
  [/\bj'ai pas\b/g, 'je n\'ai pas'],
  [/\bj'avais pas\b/g, 'je n\'avais pas'],
  [/\bje sais pas\b/g, 'je ne sais pas'],
  [/\bje peux pas\b/g, 'je ne peux pas'],
  [/\bje veux pas\b/g, 'je ne veux pas'],
  [/\bje suis pas\b/g, 'je ne suis pas'],
  [/\bje pense pas\b/g, 'je ne pense pas'],
  [/\bje crois pas\b/g, 'je ne crois pas'],
  [/\bje vais pas\b/g, 'je ne vais pas'],
  [/\bje dois pas\b/g, 'je ne dois pas'],
  [/\bje fais pas\b/g, 'je ne fais pas'],
  [/\bça va pas\b/g, 'ça ne va pas'],
  [/\bon a pas\b/g, 'on n\'a pas'],
  [/\bon peut pas\b/g, 'on ne peut pas'],
];

// Mots doublés à garder (« nous nous sommes vus », « vous vous êtes »…).
const KEEP_DOUBLE = new Set(['nous', 'vous', 'si', 'très', 'tres', 'non', 'oui', 'bien']);

// Charnières où couper une phrase trop longue.
const BREAKERS = ['et puis', 'ensuite', 'après ça', 'après', 'par contre', 'sinon', 'mais bon', 'bref', 'finalement', 'au final'];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function removeFillers(text) {
  let out = ` ${text} `;
  for (const f of FILLERS) {
    const re = new RegExp(`(^|[\\s,.;!?])${f.split(' ').map((w) => (w.endsWith('+') ? w : escapeRe(w))).join('\\s+')}(?=[\\s,.;!?]|$)`, 'gi');
    out = out.replace(re, '$1');
  }
  out = out.replace(QUOI, '$1');
  return out.replace(/\s+([,.;!?])/g, '$1').replace(/([,;])\s*([,;.])/g, '$2').replace(/\s{2,}/g, ' ').trim();
}

// \b ne connaît pas les lettres accentuées : bornes de mot explicites.
const W = "[\\p{L}\\p{N}'’-]";
const START = `(?<!${W})`;
const END = `(?!${W})`;

function collapseRepeats(text) {
  // Mot répété : « je je pense » → « je pense ».
  let out = text.replace(new RegExp(`${START}(${W}+)(?:\\s+\\1${END})+`, 'giu'), (m, w) => (KEEP_DOUBLE.has(w.toLowerCase()) ? m : w));
  // Groupe de 2 à 5 mots répété : « je suis allé je suis allé » → une fois.
  for (let n = 5; n >= 2; n--) {
    const group = `((?:${W}+\\s+){${n - 1}}${W}+)`;
    out = out.replace(new RegExp(`${START}${group}(?:\\s+\\1${END})+`, 'giu'), '$1');
  }
  return out;
}

function splitLongSentences(sentence) {
  const words = sentence.split(/\s+/);
  if (words.length <= 22) return [sentence];
  let text = sentence;
  for (const b of BREAKERS) {
    text = text.replace(new RegExp(`\\s+(?:et\\s+)?${escapeRe(b)}\\s+`, 'gi'), ` ¦${b} `);
  }
  // Un morceau de moins de quatre mots rejoint le suivant (« et puis » + « après ça… »).
  const parts = [];
  let carry = '';
  for (const piece of text.split('¦').map((s) => s.trim()).filter(Boolean)) {
    const joined = carry ? `${carry} ${piece}` : piece;
    if (joined.split(/\s+/).length < 4) carry = joined;
    else { parts.push(joined); carry = ''; }
  }
  if (carry) parts.length ? (parts[parts.length - 1] += ` ${carry}`) : parts.push(carry);
  return parts;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Phrases propres, sans tics ni doublons, avec majuscules et ponctuation. */
export function cleanSentences(raw) {
  let text = String(raw || '').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
  if (!text) return [];
  text = removeFillers(text).replace(OPENERS, '');
  for (const [re, rep] of SPOKEN) {
    const source = re.source.replace(/^\\b/, START).replace(/\\b$/, END);
    text = text.replace(new RegExp(source, 'giu'), (m) => (m[0] !== m[0].toLowerCase() ? capitalize(rep) : rep));
  }
  text = collapseRepeats(text);

  const sentences = [];
  const seen = new Set();
  for (const chunk of text.split(/(?<=[.!?…])\s+/)) {
    for (let s of splitLongSentences(chunk)) {
      s = s.replace(/^[,;:\s]+/, '').replace(/[,;:\s]+$/, '').trim();
      if (!s) continue;
      if (!/[.!?…]$/.test(s)) s += '.';
      s = capitalize(s).replace(/\bi\b/g, 'i').replace(/\s*([!?;:])/g, ' $1');
      const key = fold(s).replace(/[^a-z0-9]/g, '');
      if (key.length < 2 || TRIVIAL.has(key) || seen.has(key)) continue; // phrase vide ou redite
      seen.add(key);
      sentences.push(s);
    }
  }
  return sentences;
}

/** Texte en paragraphes de trois à quatre phrases. */
export function cleanTranscript(raw) {
  const sentences = cleanSentences(raw);
  const paragraphs = [];
  for (let i = 0; i < sentences.length; i += 4) paragraphs.push(sentences.slice(i, i + 4).join(' '));
  return paragraphs.join('\n\n');
}

function tokensOf(text) {
  return ` ${fold(text).replace(/[^a-z0-9' -]+/g, ' ').replace(/'/g, ' ')} `;
}

function countStem(haystack, stem) {
  const s = fold(stem);
  // Racine courte : mot exact ; racine longue : début de mot (« muscu » → « musculation »).
  const re = s.length <= 3 || s.includes(' ') ? new RegExp(` ${escapeRe(s)} `, 'g') : new RegExp(` ${escapeRe(s)}[a-z]*`, 'g');
  return (haystack.match(re) || []).length;
}

/** Jusqu'à trois thèmes du catalogue, du plus présent au moins présent. */
export function classify(text) {
  const hay = tokensOf(text);
  const scored = [];
  for (const theme of THEMES) {
    if (theme.id === FALLBACK_THEME_ID) continue;
    let score = 0;
    for (const w of theme.strong) score += 2 * countStem(hay, w);
    for (const w of theme.weak) score += countStem(hay, w);
    if (score >= 2) scored.push({ id: theme.id, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0]?.score || 0;
  const ids = scored.filter((s) => s.score >= Math.max(2, top / 3)).slice(0, 3).map((s) => s.id);
  return ids.length ? ids : [FALLBACK_THEME_ID];
}

const POSITIVE = ['heureux', 'heureuse', 'content', 'contente', 'genial', 'super', 'top', 'kiffe', 'adore', 'fier', 'fiere', 'motive', 'serein', 'sereine', 'bien dormi', 'en forme', 'pleine forme', 'joie', 'rigole', 'excellent', 'parfait', 'reussi', 'cool', 'agreable', 'apaise', 'soulage'];
const VERY_POSITIVE = ['incroyable', 'meilleur jour', 'trop heureux', 'trop heureuse', 'extraordinaire', 'magnifique', 'euphori', 'au top', 'fantastique'];
const NEGATIVE = ['triste', 'fatigue', 'creve', 'stress', 'angoiss', 'enerve', 'colere', 'nul', 'galere', 'pas bien', 'mal dormi', 'deçu', 'decu', 'seul', 'marre', 'ras le bol', 'chiant', 'dur', 'difficile', 'pleure', 'malade', 'gueule de bois', 'mauvais', 'inquiet', 'inquiete'];
const VERY_NEGATIVE = ['deprim', 'horrible', 'catastroph', 'je n\'en peux plus', 'au bout du rouleau', 'effondre', 'desespere', 'pire jour', 'detruit'];

/** Humeur estimée d'après le vocabulaire. */
export function detectMood(text) {
  const hay = tokensOf(text);
  const count = (list) => list.reduce((n, w) => n + countStem(hay, w), 0);
  const score = count(POSITIVE) + 2 * count(VERY_POSITIVE) - count(NEGATIVE) - 2 * count(VERY_NEGATIVE);
  if (score >= 4) return 'excellent';
  if (score >= 1) return 'bon';
  if (score <= -4) return 'tres_bas';
  if (score <= -1) return 'bas';
  return 'neutre';
}

/** Titre court tiré de la première phrase. */
export function makeTitle(sentences) {
  const first = (sentences[0] || '').replace(/[.!?… ]+$/g, '');
  const stripped = first.replace(/^(?:(?:aujourd'hui|ce matin|ce soir|hier soir|hier|alors|bon|donc|bref|ok|bonjour|salut|et)[, ]+)+/i, '');
  const words = stripped.split(/\s+/).filter(Boolean);
  if (!words.length) return 'Note vocale';
  const title = words.slice(0, 6).join(' ');
  return capitalize(title) + (words.length > 6 ? '…' : '');
}

const FOLLOW_UPS = {
  humeur: ['Qu\'est-ce qui a le plus pesé sur ton humeur aujourd\'hui ?', 'Qu\'est-ce qui t\'aiderait à te sentir mieux demain ?'],
  sport: ['Comment ton corps a-t-il réagi après la séance ?', 'Quel sera ton prochain objectif sportif ?'],
  alcool: ['Comment t\'es-tu senti le lendemain ?', 'Qu\'est-ce qui t\'a donné envie de boire ce jour-là ?'],
  sante: ['Comment évolue ce que tu ressens depuis ?', 'Qu\'as-tu prévu pour prendre soin de toi ?'],
  sommeil: ['À quelle heure t\'es-tu couché, et pourquoi ?', 'Comment t\'es-tu senti au réveil ?'],
  alimentation: ['Quel repas t\'a fait le plus plaisir récemment ?', 'Comment te sentais-tu après ce repas ?'],
  travail: ['Quelle a été ta plus grande victoire au travail cette semaine ?', 'Qu\'est-ce qui t\'a le plus pris d\'énergie au travail ?'],
  argent: ['Quelle dépense regrettes-tu, ou ne regrettes-tu pas du tout ?', 'Quel objectif financier te motive en ce moment ?'],
  famille: ['Quel moment avec tes proches veux-tu garder en mémoire ?', 'Qu\'aurais-tu envie de leur dire ?'],
  amour: ['Qu\'as-tu ressenti à ce moment-là ?', 'Qu\'est-ce qui compte le plus pour toi dans cette relation ?'],
  amis: ['Quel moment de la soirée t\'a le plus marqué ?', 'Avec qui aimerais-tu passer plus de temps ?'],
  projets: ['Quelle est la toute prochaine étape concrète ?', 'Qu\'est-ce qui pourrait te freiner, et comment l\'éviter ?'],
  loisirs: ['Qu\'est-ce qui t\'a le plus plu là-dedans ?', 'Tu le conseillerais à qui, et pourquoi ?'],
  voyages: ['Quel souvenir de ce voyage veux-tu garder ?', 'Où aimerais-tu partir ensuite ?'],
  reflexions: ['Qu\'est-ce que cette réflexion change pour toi ?', 'D\'où te vient cette idée, à ton avis ?'],
  gratitude: ['Pour quoi d\'autre es-tu reconnaissant aujourd\'hui ?', 'Qui aimerais-tu remercier ?'],
  quotidien: ['Quel a été le meilleur moment de ta journée ?', 'Qu\'est-ce que tu retiens de cette journée ?'],
};

export function followUpFor(themeId, seed = Date.now()) {
  const list = FOLLOW_UPS[themeId] || FOLLOW_UPS.quotidien;
  return list[Math.abs(seed) % list.length];
}

/**
 * Entrée complète sans IA, au même format que la réponse de /api/ecrire
 * (thèmes donnés par leurs ids du catalogue).
 */
export function localWrite(segments, style = 'professionnel') {
  const raw = segments.map((s) => s.text).join(' ');
  const sentences = segments.flatMap((s) => cleanSentences(s.text));
  const themes = classify(raw);
  let paragraphs = [];
  for (let i = 0; i < sentences.length; i += 4) paragraphs.push(sentences.slice(i, i + 4).join(' '));
  if (style === 'synthese') paragraphs = [sentences.slice(0, 3).join(' ')];
  const text = paragraphs.join('\n\n') || 'Enregistrement trop court ou inaudible.';
  return {
    title: makeTitle(sentences),
    text,
    summary: sentences[0] || '',
    highlights: style === 'synthese' ? sentences.slice(3, 7).map((s) => s.replace(/\.$/, '')) : [],
    themes,
    mood: detectMood(raw),
    followUp: followUpFor(themes[0], raw.length),
  };
}
