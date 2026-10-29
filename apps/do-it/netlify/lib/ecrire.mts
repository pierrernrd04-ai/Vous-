// Logique de la fonction /api/ecrire, sans dépendance au SDK ni à Netlify
// pour rester testable : consigne, schéma de sortie, validation, normalisation.
import { z } from 'zod';
import { THEMES, MOODS, resolveTheme, slugify } from '../../public/js/themes.js';

export const STYLES = ['professionnel', 'recit', 'synthese'] as const;
export type Style = (typeof STYLES)[number];

export const LIMITS = {
  segments: 24,
  segmentChars: 20_000,
  totalChars: 40_000,
  questionChars: 300,
  customThemes: 40,
};

const catalog = THEMES.map((t) => `- ${t.id} (${t.emoji} ${t.label}) : ${t.covers}`).join('\n');

export const SYSTEM_PROMPT = `Tu es la plume de « Do It », un journal de bord vocal. L'utilisateur parle librement à voix haute ; tu reçois la transcription brute de la reconnaissance vocale : ponctuation absente ou fausse, hésitations, répétitions, mots mal reconnus. Tu en fais une entrée de journal écrite, claire et soignée, fidèle à ce qu'il a dit.

Écriture
- Écris à la première personne, comme si l'utilisateur avait lui-même rédigé son journal avec soin.
- Corrige grammaire, syntaxe, orthographe et ponctuation. Supprime les tics de langage (« en fait », « du coup », « euh », « tu vois », « voilà », « genre », « quoi » en fin de phrase), les répétitions et les idées redites.
- Remets les idées dans un ordre logique (chronologique pour un récit) et regroupe-les en paragraphes courts, séparés par une ligne vide.
- Résume sans trahir : garde les faits, chiffres, noms, lieux, émotions et décisions. N'invente rien, n'ajoute ni conseil, ni jugement, ni morale.
- Un mot visiblement mal reconnu par la dictée : déduis le terme le plus probable d'après le contexte ; s'il reste incompréhensible, laisse-le de côté plutôt que d'inventer.
- Garde la voix et la personnalité de l'utilisateur dans un français correct et naturel, sans jargon ni emphase. Tu peux garder une expression familière si elle porte le sens ou l'émotion.
- Plusieurs prises (suite du récit, réponses à tes relances) : fusionne-les en un seul texte cohérent. La question posée avant une prise donne le contexte de la réponse ; n'écris pas la question dans le texte.
- Transcription vide de sens ou inaudible : écris une phrase courte qui le dit honnêtement.

Style demandé
- professionnel : prose nette et structurée, phrases courtes, ton posé. Nettement plus court que l'oral quand celui-ci est redondant.
- recit : récit vivant façon journal intime, plus narratif et imagé, toujours fidèle aux faits.
- synthese : deux à quatre phrases au plus ; l'essentiel passe dans les points clés.

Thèmes
Classe l'entrée dans un à trois thèmes, le principal en premier, en reprenant l'id du catalogue :
${catalog}
Si un sujet important n'entre vraiment dans aucun thème du catalogue, crée un thème : id court en minuscules sans accents (par exemple « bricolage »), libellé d'un ou deux mots avec une majuscule, un emoji. Réutilise d'abord les thèmes personnels déjà créés, listés dans le message, quand l'un d'eux convient.

Humeur
Estime l'humeur exprimée : tres_bas, bas, neutre, bon ou excellent.

Relance
Termine par une question courte (tutoiement, quinze mots au plus), bienveillante et précise, qui donne envie de prolonger le récit à voix haute : un détail, un ressenti, la suite. Ni conseil, ni question passe-partout.`;

const themeSchema = z.object({
  id: z.string().describe('id du catalogue, ou id court d\'un nouveau thème'),
  label: z.string().describe('libellé du thème'),
  emoji: z.string().describe('un emoji'),
});

export const EntrySchema = z.object({
  title: z.string().describe('titre évocateur de deux à sept mots, sans point final ni guillemets'),
  text: z.string().describe('l\'entrée réécrite, paragraphes séparés par une ligne vide'),
  summary: z.string().describe('une phrase de vingt-cinq mots au plus, à la première personne'),
  highlights: z.array(z.string()).describe('zéro à quatre faits marquants, une ligne courte chacun, sans puce ; vide si l\'entrée est très courte'),
  themes: z.array(themeSchema).describe('un à trois thèmes, le principal en premier'),
  // Chaîne libre plutôt qu'enum : une valeur imprévue ne doit pas faire échouer l'analyse.
  mood: z.string().describe('une valeur parmi : tres_bas, bas, neutre, bon, excellent'),
  followUp: z.string().describe('la question de relance'),
});

export type EntryOutput = z.infer<typeof EntrySchema>;

export type Segment = { text: string; question?: string };
export type CustomTheme = { id: string; label: string; emoji: string };
export type EcrireInput = {
  segments: Segment[];
  style: Style;
  customThemes: CustomTheme[];
  when?: string;
};

export class InputError extends Error {}

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** Valide et nettoie le corps de la requête ; lève `InputError` sinon. */
export function validateInput(body: unknown): EcrireInput {
  if (!body || typeof body !== 'object') throw new InputError('Corps JSON attendu.');
  const raw = body as Record<string, unknown>;

  if (!Array.isArray(raw.segments) || raw.segments.length === 0) throw new InputError('Aucune prise à écrire.');
  if (raw.segments.length > LIMITS.segments) throw new InputError('Trop de prises dans une seule entrée.');

  let total = 0;
  const segments: Segment[] = [];
  for (const item of raw.segments) {
    const seg = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    if (typeof seg.text === 'string' && seg.text.length > LIMITS.segmentChars) throw new InputError('Prise trop longue.');
    const text = str(seg.text, LIMITS.segmentChars);
    if (!text) continue;
    total += text.length;
    const question = str(seg.question, LIMITS.questionChars);
    segments.push(question ? { text, question } : { text });
  }
  if (segments.length === 0) throw new InputError('Aucune parole à écrire.');
  if (total > LIMITS.totalChars) throw new InputError('Entrée trop longue.');

  const style = (STYLES as readonly string[]).includes(raw.style as string) ? (raw.style as Style) : 'professionnel';

  const customThemes: CustomTheme[] = [];
  if (Array.isArray(raw.customThemes)) {
    for (const item of raw.customThemes.slice(0, LIMITS.customThemes)) {
      const t = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const id = slugify(str(t.id, 40));
      const label = str(t.label, 40);
      if (id && label) customThemes.push({ id, label, emoji: str(t.emoji, 8) || '🏷️' });
    }
  }

  const when = str(raw.when, 80) || undefined;
  return { segments, style, customThemes, when };
}

/** Message utilisateur : contexte variable, puis la transcription. */
export function buildUserMessage(input: EcrireInput): string {
  const lines: string[] = [];
  if (input.when) lines.push(`Moment de l'enregistrement : ${input.when}`);
  lines.push(`Style demandé : ${input.style}`);
  lines.push(
    input.customThemes.length
      ? `Thèmes personnels déjà créés : ${input.customThemes.map((t) => `${t.id} (${t.emoji} ${t.label})`).join(', ')}`
      : 'Thèmes personnels déjà créés : aucun',
  );
  lines.push('', 'Transcription brute :');
  input.segments.forEach((seg, i) => {
    const head = input.segments.length > 1 ? `[Prise ${i + 1}]` : '[Prise]';
    lines.push('', seg.question ? `${head} Question posée : « ${seg.question} »` : head, seg.text);
  });
  return lines.join('\n');
}

export type NormalizedEntry = {
  title: string;
  text: string;
  summary: string;
  highlights: string[];
  themes: CustomTheme[];
  mood: string;
  followUp: string;
};

/** Bornes et nettoyage de la sortie du modèle avant de la renvoyer au navigateur. */
export function normalizeOutput(out: EntryOutput, customThemes: CustomTheme[] = []): NormalizedEntry {
  const clean = (s: string, max: number) => String(s || '').trim().slice(0, max);
  const text = String(out.text || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 30_000);

  const themes: CustomTheme[] = [];
  for (const proposal of out.themes || []) {
    const resolved = resolveTheme(proposal, customThemes);
    if (!resolved || themes.some((t) => t.id === resolved.id)) continue;
    themes.push({ id: resolved.id, label: resolved.theme.label, emoji: resolved.theme.emoji });
    if (themes.length === 3) break;
  }
  if (themes.length === 0) themes.push({ id: 'quotidien', label: 'Quotidien', emoji: '🗓️' });

  return {
    title: clean(out.title, 90).replace(/^[«"“\s]+|[»"”.\s]+$/g, '') || 'Sans titre',
    text,
    summary: clean(out.summary, 300),
    highlights: (out.highlights || []).map((h) => clean(h, 200).replace(/^[-•*\s]+/, '')).filter(Boolean).slice(0, 4),
    themes,
    mood: MOODS.some((m) => m.id === out.mood) ? out.mood : 'neutre',
    followUp: clean(out.followUp, 200),
  };
}
