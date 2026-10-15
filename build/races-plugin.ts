/**
 * Plugin Vite « races » : pages SEO par course de printemps (SPEC section 4).
 *
 * À partir de data/races.json, le build produit :
 *   - dist/courses/<slug>/index.html : page d'atterrissage statique en français (title,
 *     description, canonical, Open Graph / Twitter, JSON-LD Product + Offer, FAQPage et
 *     BreadcrumbList, H1, dates de départ calculées, semaine allégée de Noël, appels à
 *     l'action vers /gratuit/ et vers l'achat) ;
 *   - dist/courses/index.html : toutes les courses, regroupées par mois ;
 *   - dist/sitemap.xml : toutes les pages HTML du site (moins celles que public/robots.txt
 *     interdit), avec `lastmod`.
 *
 * Approche : des pages HTML « virtuelles » déclarées comme entrées Vite.
 *   1. Hook `config` : les données sont lues et validées (le build échoue avec la liste
 *      des erreurs si une course est invalide), chaque page est rendue en mémoire, et son
 *      chemin public `<racine>/courses/<slug>/index.html` est ajouté aux entrées
 *      (`build.rolldownOptions.input`). Aucun fichier n'est écrit dans le dépôt.
 *   2. Hooks `resolveId` / `load` (`enforce: 'pre'`) : ces chemins, qui n'existent pas sur
 *      le disque, sont servis depuis la mémoire. Vite les traite donc exactement comme les
 *      pages écrites à la main : `/src/styles/*.css` et `/src/pages/course.ts` sont
 *      compilés, empreintés et injectés, `transformIndexHtml` s'applique, et la page sort
 *      à `dist/courses/<slug>/index.html` (chemin relatif à la racine de Vite).
 *   3. Hook `generateBundle` : émission de sitemap.xml.
 *   4. En développement (`vite`), un middleware sert les mêmes pages (passées par
 *      `transformIndexHtml`) et le sitemap ; data/races.json est surveillé.
 *
 * Le moteur de plan (src/engine) est appelé ici, dans Node, au build uniquement : les
 * phases, semaines allégées et dates affichées sont exactement celles du plan généré.
 * Il est chargé, avec les libellés et les prix, par le module runner de Vite
 * (`loadRaceDeps`, au hook `config`) plutôt qu'importé : le fichier de config, que Vite
 * empaquette, reste ainsi limité à des modules sans import interne. Le code navigateur
 * (src/pages/course.ts) n'importe jamais le moteur.
 */
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePath, runnerImport, type Connect, type Plugin, type UserConfig, type ViteDevServer } from 'vite';
// Imports statiques limités aux modules sans import interne (le fichier de config est
// empaqueté par Vite) ; le moteur, les libellés et les prix sont chargés par `loadRaceDeps`.
import { KEY_DATES, VAT_MENTION, config as siteConfig } from '../src/config.ts';
import type * as EngineConstants from '../src/engine/constants.ts';
import type * as Engine from '../src/engine/index.ts';
import type { Phase, PlanInput, Week } from '../src/engine/types.ts';
import { addDaysIso, formatDate, formatDateLong, formatRange, parseIsoDate, toIsoDate } from '../src/lib/format.ts';
import type * as Labels from '../src/lib/labels.ts';
import type * as Price from '../src/lib/price.ts';
import type { PriceInfo } from '../src/lib/price.ts';

/* ================================================================== */
/* Données                                                             */
/* ================================================================== */

export type RaceKind = 'marathon' | 'semi';
export type DateStatus = 'confirmée' | 'estimée';

/** Une course de data/races.json. */
export interface Race {
  /** Segment d'URL : /courses/<slug>/ (minuscules, chiffres, tirets). */
  slug: string;
  /** Nom d'usage, commençant par « Marathon » ou « Semi » (sans sponsor ni « officiel »). */
  name: string;
  city: string;
  region: string;
  kind: RaceKind;
  /** Date de l'édition 2027, ISO yyyy-mm-dd. */
  date: string;
  /** `estimée` : date 2027 non annoncée, déduite de l'édition 2026 (même week-end). */
  dateStatus: DateStatus;
  /** Page (https) d'où vient la date, ou la date 2026 pour une date estimée. */
  sourceUrl: string;
  participantsApprox?: number;
  /** Une ligne factuelle, sourcée. */
  notes?: string;
}

/** Fenêtre des courses de printemps couvertes. */
export const RACE_WINDOW = { start: '2027-02-01', end: '2027-05-31' } as const;

export const DEFAULT_DATA_FILE = 'data/races.json';

const RACE_KINDS: readonly RaceKind[] = ['marathon', 'semi'];
const DATE_STATUSES: readonly DateStatus[] = ['confirmée', 'estimée'];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOTES_MAX = 220;
const ALLOWED_KEYS = new Set([
  'slug',
  'name',
  'city',
  'region',
  'kind',
  'date',
  'dateStatus',
  'sourceUrl',
  'participantsApprox',
  'notes',
]);
/** Préfixe attendu du nom, pour que « Plan <nom> 2027 » se lise bien. */
const NAME_PREFIX: Record<RaceKind, RegExp> = {
  marathon: /^Marathon\b/,
  semi: /^Semi\b/,
};
/** Mots interdits par la SPEC (section 1) dans tout texte affiché. */
const FORBIDDEN_WORDS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /officiel/i, label: '« officiel »' },
  { pattern: /\basics\b/i, label: 'ASICS' },
  { pattern: /schneider/i, label: 'Schneider' },
  { pattern: /\bcoach/i, label: '« coach » / « coaching »' },
];

export interface RacesValidation {
  races: Race[];
  /** Erreurs en français ; vide si les données sont valides. */
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim() === value;
}

/**
 * Validation stricte de data/races.json : champs, types, slugs uniques, dates valides
 * dans la fenêtre de printemps, URL de source en https, mots interdits.
 */
export function validateRaces(data: unknown): RacesValidation {
  const errors: string[] = [];
  const races: Race[] = [];
  if (!Array.isArray(data)) {
    return { races, errors: ['data/races.json doit contenir un tableau de courses.'] };
  }
  const slugs = new Map<string, number>();

  data.forEach((item: unknown, index) => {
    const position = index + 1;
    if (!isRecord(item)) {
      errors.push(`Course n° ${position} : un objet est attendu.`);
      return;
    }
    const label = `Course n° ${position}${typeof item.slug === 'string' ? ` (${item.slug})` : ''}`;
    const problems: string[] = [];

    for (const key of Object.keys(item)) {
      if (!ALLOWED_KEYS.has(key)) problems.push(`champ inconnu « ${key} »`);
    }
    for (const key of ['slug', 'name', 'city', 'region', 'sourceUrl'] as const) {
      if (!nonEmptyString(item[key])) problems.push(`« ${key} » doit être un texte non vide, sans espace autour`);
    }
    const { slug, name, kind, date, dateStatus, sourceUrl, participantsApprox, notes } = item;

    if (typeof slug === 'string') {
      if (!SLUG_RE.test(slug)) problems.push(`slug « ${slug} » invalide (minuscules, chiffres et tirets)`);
      const previous = slugs.get(slug);
      if (previous !== undefined) problems.push(`slug « ${slug} » déjà utilisé par la course n° ${previous}`);
      else slugs.set(slug, position);
    }
    if (typeof kind !== 'string' || !RACE_KINDS.includes(kind as RaceKind)) {
      problems.push('« kind » doit valoir « marathon » ou « semi »');
    } else if (typeof name === 'string' && !NAME_PREFIX[kind as RaceKind].test(name)) {
      problems.push(`le nom d'un ${kind === 'marathon' ? 'marathon' : 'semi'} doit commencer par « ${kind === 'marathon' ? 'Marathon' : 'Semi'} »`);
    }
    if (typeof date !== 'string' || !ISO_RE.test(date) || parseIsoDate(date) === null) {
      problems.push(`date « ${String(date)} » invalide (AAAA-MM-JJ attendu)`);
    } else if (date < RACE_WINDOW.start || date > RACE_WINDOW.end) {
      problems.push(`date ${date} hors de la fenêtre du ${RACE_WINDOW.start} au ${RACE_WINDOW.end}`);
    }
    if (typeof dateStatus !== 'string' || !DATE_STATUSES.includes(dateStatus as DateStatus)) {
      problems.push('« dateStatus » doit valoir « confirmée » ou « estimée »');
    }
    if (typeof sourceUrl === 'string') {
      let url: URL | null = null;
      try {
        url = new URL(sourceUrl);
      } catch {
        url = null;
      }
      if (!url || url.protocol !== 'https:') problems.push(`« sourceUrl » doit être une URL https (reçu « ${sourceUrl} »)`);
    }
    if (
      participantsApprox !== undefined &&
      (typeof participantsApprox !== 'number' ||
        !Number.isInteger(participantsApprox) ||
        participantsApprox <= 0 ||
        participantsApprox > 1_000_000)
    ) {
      problems.push('« participantsApprox » doit être un entier positif');
    }
    if (notes !== undefined && (!nonEmptyString(notes) || notes.length > NOTES_MAX)) {
      problems.push(`« notes » doit être une ligne de 1 à ${NOTES_MAX} caractères`);
    }
    for (const key of ['name', 'city', 'region', 'notes'] as const) {
      const value = item[key];
      if (typeof value !== 'string') continue;
      for (const word of FORBIDDEN_WORDS) {
        if (word.pattern.test(value)) problems.push(`« ${key} » contient ${word.label}, interdit par la SPEC`);
      }
    }

    if (problems.length > 0) {
      errors.push(`${label} : ${problems.join(' ; ')}.`);
      return;
    }
    const race: Race = {
      slug: slug as string,
      name: name as string,
      city: item.city as string,
      region: item.region as string,
      kind: kind as RaceKind,
      date: date as string,
      dateStatus: dateStatus as DateStatus,
      sourceUrl: sourceUrl as string,
    };
    if (typeof participantsApprox === 'number') race.participantsApprox = participantsApprox;
    if (typeof notes === 'string') race.notes = notes;
    races.push(race);
  });

  return { races: sortRaces(races), errors };
}

/** Tri par date, puis marathon avant semi, puis nom. */
export function sortRaces(races: readonly Race[]): Race[] {
  return [...races].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      RACE_KINDS.indexOf(a.kind) - RACE_KINDS.indexOf(b.kind) ||
      a.name.localeCompare(b.name, 'fr'),
  );
}

/** Lit et valide le fichier de données ; lève une erreur lisible sinon. */
export function loadRaces(file: string): Race[] {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`[races] Lecture impossible de ${file} : ${(error as Error).message}`);
  }
  const { races, errors } = validateRaces(data);
  if (errors.length > 0) {
    throw new Error(`[races] ${file} contient ${errors.length} erreur(s) :\n- ${errors.join('\n- ')}`);
  }
  if (races.length === 0) throw new Error(`[races] ${file} ne contient aucune course.`);
  return races;
}

/* ================================================================== */
/* Calendrier (calculé avec le moteur de plan)                         */
/* ================================================================== */

/**
 * Modules de l'application utilisés au build : moteur de plan (phases, semaines allégées,
 * calendrier), libellés et prix. Injectés plutôt qu'importés : le plugin les charge avec
 * le module runner de Vite (`loadRaceDeps`), ce qui garde le fichier de config empaqueté
 * indépendant des imports sans extension de src/ ; les tests les passent directement.
 */
export interface RaceDeps {
  generatePlan: typeof Engine.generatePlan;
  nominalWeeks: typeof EngineConstants.NOMINAL_WEEKS;
  minWeeks: number;
  levels: typeof Labels.LEVELS;
  levelLabel: typeof Labels.levelLabel;
  levelHint: typeof Labels.levelHint;
  phaseLabels: typeof Labels.PHASE_LABELS;
  phaseDescriptions: typeof Labels.PHASE_DESCRIPTIONS;
  priceInfo: typeof Price.priceInfo;
}

export interface RaceDepsModules {
  engine: Pick<typeof Engine, 'generatePlan'>;
  constants: Pick<typeof EngineConstants, 'MIN_WEEKS' | 'NOMINAL_WEEKS'>;
  labels: Pick<typeof Labels, 'LEVELS' | 'PHASE_DESCRIPTIONS' | 'PHASE_LABELS' | 'levelHint' | 'levelLabel'>;
  price: Pick<typeof Price, 'priceInfo'>;
}

export function createRaceDeps({ engine, constants, labels, price }: RaceDepsModules): RaceDeps {
  return {
    generatePlan: engine.generatePlan,
    nominalWeeks: constants.NOMINAL_WEEKS,
    minWeeks: constants.MIN_WEEKS,
    levels: labels.LEVELS,
    levelLabel: labels.levelLabel,
    levelHint: labels.levelHint,
    phaseLabels: labels.PHASE_LABELS,
    phaseDescriptions: labels.PHASE_DESCRIPTIONS,
    priceInfo: price.priceInfo,
  };
}

/** Racine du dépôt (dossier parent de build/). */
const APP_ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Charge les modules de src/ avec le module runner de Vite (même résolution que l'app). */
export async function loadRaceDeps(appRoot: string = APP_ROOT): Promise<RaceDeps> {
  const load = async <T>(file: string): Promise<T> => (await runnerImport<T>(resolve(appRoot, file))).module;
  const [engine, constants, labels, price] = await Promise.all([
    load<typeof Engine>('src/engine/index.ts'),
    load<typeof EngineConstants>('src/engine/constants.ts'),
    load<typeof Labels>('src/lib/labels.ts'),
    load<typeof Price>('src/lib/price.ts'),
  ]);
  return createRaceDeps({ engine, constants, labels, price });
}

/** Durées proposées sur chaque page : le format complet du pass, puis deux prépas plus courtes. */
export function planDurations(kind: RaceKind, deps: Pick<RaceDeps, 'nominalWeeks'>): number[] {
  return kind === 'marathon' ? [deps.nominalWeeks.marathon, 20, 16] : [deps.nominalWeeks.semi, 16, 12];
}

/** Profil type pour calculer l'ossature (phases, semaines allégées) : sans effet sur les dates. */
const SAMPLE_INPUT: Omit<PlanInput, 'race' | 'raceDate'> = {
  level: 'finisher',
  t10: 3300,
  weeklyKm: 20,
  sessions: 4,
  longRunDay: 'sun',
};

export interface WeekSpan {
  index: number;
  start: string;
  end: string;
}

export interface PhaseSpan {
  phase: Phase;
  from: number;
  to: number;
  start: string;
  end: string;
}

export interface PlanSchedule {
  weeks: number;
  /** Lundi du jour 1. */
  start: string;
  phases: PhaseSpan[];
  deloads: WeekSpan[];
  /** Semaine contenant le 25 décembre, si le plan la traverse. */
  christmas: (WeekSpan & { deload: boolean }) | null;
  /** Lundi du début de l'affûtage. */
  taperStart: string | null;
  /** Une case par semaine (frise). */
  strip: { index: number; phase: Phase; deload: boolean }[];
}

export interface StartOption extends PlanSchedule {
  /** Format complet du pass (24 semaines marathon, 20 semaines semi). */
  nominal: boolean;
}

/** Plan obtenu en le créant à la date du build (même règle que /gratuit/ et /plan/). */
export type CurrentPlan =
  | { status: 'ok'; schedule: PlanSchedule; deferred: boolean; shortened: boolean }
  | { status: 'too-short' }
  | { status: 'past' };

export interface RaceFacts {
  options: StartOption[];
  current: CurrentPlan;
  /** Plan détaillé sur la page : celui d'aujourd'hui, sinon le format complet. */
  featured: PlanSchedule | null;
}

function weekdayIndex(iso: string): number {
  const date = parseIsoDate(iso);
  if (!date) throw new RangeError(`Date ISO invalide : ${iso}`);
  return (date.getUTCDay() + 6) % 7; // 0 = lundi
}

/** Lundi de la semaine d'une date. */
export function mondayOfIso(iso: string): string {
  return addDaysIso(iso, -weekdayIndex(iso));
}

/** Lundi de départ d'un plan de `weeks` semaines dont la dernière semaine contient la course. */
export function startMondayFor(raceDate: string, weeks: number): string {
  return addDaysIso(mondayOfIso(raceDate), -(weeks - 1) * 7);
}

function containsChristmas(week: Pick<Week, 'start' | 'end'>): boolean {
  for (let year = Number(week.start.slice(0, 4)); year <= Number(week.end.slice(0, 4)); year += 1) {
    const christmas = `${year}-12-25`;
    if (week.start <= christmas && christmas <= week.end) return true;
  }
  return false;
}

/** Ossature d'un plan généré par le moteur. */
export function scheduleFromWeeks(weeks: readonly Week[]): PlanSchedule {
  const first = weeks[0];
  if (!first) throw new Error('Plan vide.');
  const phases: PhaseSpan[] = [];
  for (const week of weeks) {
    const last = phases[phases.length - 1];
    if (last && last.phase === week.phase) {
      last.to = week.index;
      last.end = week.end;
    } else {
      phases.push({ phase: week.phase, from: week.index, to: week.index, start: week.start, end: week.end });
    }
  }
  const christmasWeek = weeks.find(containsChristmas);
  return {
    weeks: weeks.length,
    start: first.start,
    phases,
    deloads: weeks.filter((w) => w.deload).map((w) => ({ index: w.index, start: w.start, end: w.end })),
    christmas: christmasWeek
      ? { index: christmasWeek.index, start: christmasWeek.start, end: christmasWeek.end, deload: christmasWeek.deload }
      : null,
    taperStart: phases.find((p) => p.phase === 'affutage')?.start ?? null,
    strip: weeks.map((w) => ({ index: w.index, phase: w.phase, deload: w.deload })),
  };
}

function enginePlan(deps: RaceDeps, race: Race, today: string, startDate?: string): PlanSchedule | null {
  const input: PlanInput = { ...SAMPLE_INPUT, race: race.kind, raceDate: race.date };
  if (startDate) input.startDate = startDate;
  try {
    return scheduleFromWeeks(deps.generatePlan(input, today).weeks);
  } catch {
    return null;
  }
}

function nextMondayOnOrAfter(iso: string): string {
  const index = weekdayIndex(iso);
  return index === 0 ? iso : addDaysIso(iso, 7 - index);
}

/** Dates de départ (format complet et versions plus courtes) et plan créé à `today`. */
export function raceFacts(race: Race, today: string, deps: RaceDeps): RaceFacts {
  const nominalWeeks = deps.nominalWeeks[race.kind];
  const options: StartOption[] = [];
  for (const weeks of planDurations(race.kind, deps)) {
    const start = startMondayFor(race.date, weeks);
    const schedule = enginePlan(deps, race, start, start);
    if (!schedule) throw new Error(`[races] ${race.slug} : plan de ${weeks} semaines impossible à calculer.`);
    options.push({ ...schedule, nominal: weeks === nominalWeeks });
  }

  let current: CurrentPlan;
  const schedule = enginePlan(deps, race, today);
  if (schedule) {
    current = {
      status: 'ok',
      schedule,
      deferred: schedule.start > nextMondayOnOrAfter(today),
      shortened: schedule.weeks < nominalWeeks,
    };
  } else {
    current = { status: race.date < today ? 'past' : 'too-short' };
  }
  const featured = current.status === 'ok' ? current.schedule : (options.find((o) => o.nominal) ?? null);
  return { options, current, featured };
}

/* ================================================================== */
/* Textes et formatage                                                 */
/* ================================================================== */

const KIND_LABEL: Record<RaceKind, string> = { marathon: 'Marathon', semi: 'Semi-marathon' };
const DISTANCE_LABEL: Record<RaceKind, string> = { marathon: '42,195\u00a0km', semi: '21,1\u00a0km' };

const OPTION_HINTS: Record<RaceKind, Record<number, string>> = {
  marathon: {
    24: 'Le format complet : le temps de construire ta base sans te presser.',
    20: 'Si tu cours déjà régulièrement, 2 à 3 fois par semaine.',
    16: 'Une prépa resserrée, si tu as déjà une bonne base d’endurance.',
  },
  semi: {
    20: 'Le format complet : une progression douce, idéale pour un premier semi.',
    16: 'Si tu cours déjà régulièrement, 2 à 3 fois par semaine.',
    12: 'Une prépa resserrée, si tu as déjà une bonne base d’endurance.',
  },
};

const HEALTH_TEXT =
  'Le Pass J-24 est un programme généré automatiquement : il ne remplace ni l’avis d’un médecin ni un suivi individuel. Avant de commencer une préparation marathon ou semi, fais un bilan avec ton médecin. En cas de douleur, de malaise, d’essoufflement inhabituel ou de doute, arrête-toi et consulte.';

const FOOTER_HEALTH =
  'ce programme est généré automatiquement et ne remplace pas l’avis d’un médecin. Fais un bilan médical avant de commencer. En cas de douleur, de malaise ou de doute, arrête-toi et consulte.';

/**
 * Espaces insécables de la typographie française : avant « : ; ! ? % », après « « »,
 * dans les milliers (« 7 000 »), entre un nombre et son unité (« 9 h 15 », « 24 semaines »)
 * et dans « jour J ».
 */
export function frenchSpaces(text: string): string {
  return text
    .replace(/ ([:;!?»%])/g, '\u00a0$1')
    .replace(/« /g, '«\u00a0')
    .replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u00a0')
    .replace(/(\d) (?=(?:h|min|km|m|€|semaines?|jours?)(?![\p{L}\d]))/gu, '$1\u00a0')
    .replace(/\bjour J\b/g, 'jour\u00a0J');
}

/** Échappement HTML (texte et attributs). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Texte affiché : typographie française puis échappement. */
function t(text: string): string {
  return escapeHtml(frenchSpaces(text));
}

function lcFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase('fr-FR') + text.slice(1);
}

function ucFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
}

const NUMBER_FR = new Intl.NumberFormat('fr-FR');
const FMT_DOW_SHORT = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'short' });
const FMT_MONTH_SHORT = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', month: 'short' });
const FMT_MONTH_YEAR = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', month: 'long', year: 'numeric' });

function dateOf(iso: string): Date {
  const date = parseIsoDate(iso);
  if (!date) throw new RangeError(`Date ISO invalide : ${iso}`);
  return date;
}

function weekLabel(span: WeekSpan): string {
  return `S${span.index} (${formatRange(span.start, span.end)})`;
}

function phaseRange(span: PhaseSpan): string {
  return span.from === span.to ? `S${span.from}` : `S${span.from} à S${span.to}`;
}

function sourceHost(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '');
}

/** JSON sûr dans un <script> (pas de « </script> » possible). */
function jsonForScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** Lien de préremplissage de /gratuit/ (SPEC : `?race=&date=&name=`). */
export function freeWeekUrl(race: Race): string {
  const params = new URLSearchParams({ race: race.kind, date: race.date, name: race.name });
  return `/gratuit/?${params.toString()}`;
}

export function racePath(race: Race): string {
  return `/courses/${race.slug}/`;
}

/* ================================================================== */
/* Gabarit commun                                                      */
/* ================================================================== */

interface PageMeta {
  title: string;
  description: string;
  /** Chemin public, ex. /courses/x/ */
  path: string;
  jsonLd: unknown;
}

interface RenderContext {
  deps: RaceDeps;
  siteUrl: string;
  /** Date du build, ISO (UTC). */
  today: string;
  price: PriceInfo;
  races: readonly Race[];
}

const BRAND_LOGO =
  '<svg class="brand__logo" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><defs><linearGradient id="brand-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2be39b"/><stop offset="1" stop-color="#1ea6d0"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="#050f15"/><path d="M20 44c-6-4-7-14-1-20 5-5 12-4 15 1 2 4 6 5 9 2 4-3 9 0 9 5 0 9-11 16-22 16-4 0-7-1-10-4z" fill="none" stroke="url(#brand-grad)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="44" r="4" fill="#2be39b"/></svg>';
const FOOTER_LOGO =
  '<svg class="brand__logo" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="16" fill="#050f15"/><path d="M20 44c-6-4-7-14-1-20 5-5 12-4 15 1 2 4 6 5 9 2 4-3 9 0 9 5 0 9-11 16-22 16-4 0-7-1-10-4z" fill="none" stroke="#2be39b" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="44" r="4" fill="#2be39b"/></svg>';
const ICON_CHECK = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const ICON_CHEVRON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const ICON_ARROW = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const ICON_ALERT =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.4v.1"/></svg>';

const OG_IMAGE_ALT = 'Pass J-24 · Traceo : ta prépa marathon ou semi commence lundi.';

function renderHead(meta: PageMeta, ctx: RenderContext): string {
  const url = `${ctx.siteUrl}${meta.path}`;
  const title = t(meta.title);
  const description = t(meta.description);
  const image = `${ctx.siteUrl}/icons/og-image.png`;
  return `  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="${escapeHtml(url)}">
    <meta name="color-scheme" content="dark light">
    <meta name="theme-color" content="#050f15" media="(prefers-color-scheme: dark)">
    <meta name="theme-color" content="#f4faf8" media="(prefers-color-scheme: light)">
    <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" type="image/png">
    <link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
    <link rel="manifest" href="/manifest.webmanifest">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="fr_FR">
    <meta property="og:site_name" content="Pass J-24 · Traceo">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${escapeHtml(url)}">
    <meta property="og:image" content="${escapeHtml(image)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${t(OG_IMAGE_ALT)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${escapeHtml(image)}">
    <link rel="stylesheet" href="/src/styles/base.css">
    <link rel="stylesheet" href="/src/styles/course.css">
    <script type="module" src="/src/pages/course.ts"></script>
    <script type="application/ld+json">${jsonForScript(meta.jsonLd)}</script>
  </head>`;
}

function renderHeader(freeHref: string, price: PriceInfo): string {
  return `    <a class="skip-link" href="#contenu">Aller au contenu</a>

    <header class="site-header">
      <div class="wrap">
        <a class="brand" href="/" aria-label="Pass J-24 · Traceo, accueil">
          ${BRAND_LOGO}
          <span class="brand__name">Pass J-24</span>
          <span class="brand__by">par Traceo</span>
        </a>
        <nav class="header-nav" aria-label="Navigation principale">
          <a class="header-link" href="${escapeHtml(freeHref)}">Semaine 1 offerte</a>
          <a class="btn btn--primary btn--sm" href="${escapeHtml(freeHref)}" data-checkout>Mon pass · <span data-price="amount">${t(price.label)}</span></a>
        </nav>
      </div>
    </header>`;
}

function renderFooter(): string {
  return `    <footer class="site-footer">
      <div class="wrap footer-grid">
        <div class="footer-brand">
          <a class="brand" href="/">
            ${FOOTER_LOGO}
            <span class="brand__name">Pass J-24</span>
            <span class="brand__by">par Traceo</span>
          </a>
          <p>${t('Programme de préparation marathon et semi généré automatiquement, avec une boucle prête à courir pour chaque séance.')}</p>
        </div>
        <p class="health-warning"><strong>${t('Santé :')}</strong> ${t(FOOTER_HEALTH)}</p>
        <nav aria-label="Liens utiles">
          <ul>
            <li><a href="/gratuit/">Semaine 1 offerte</a></li>
            <li><a href="/courses/">Courses de printemps</a></li>
            <li><a href="/plan/">Mon plan</a></li>
            <li><a href="/cgv/">CGV</a></li>
            <li><a href="/mentions-legales/">Mentions légales</a></li>
            <li><a href="/confidentialite/">Confidentialité</a></li>
            <li><a href="/retractation/">Rétractation</a></li>
            <li><a href="/retractation/#renoncer">Renoncer au contrat ici</a></li>
            <li><a data-support-email hidden href="/mentions-legales/">Contact</a></li>
          </ul>
        </nav>
        <p class="footer-small">${t(`Pass J-24 n’est lié à aucun organisateur de course : les noms et dates de courses servent seulement à caler ton plan. Prix TTC, ${VAT_MENTION}. © 2026 Traceo`)}</p>
      </div>
    </footer>`;
}

interface Crumb {
  name: string;
  path: string;
}

function renderCrumbs(crumbs: readonly Crumb[]): string {
  const items = crumbs.map((crumb, index) =>
    index === crumbs.length - 1
      ? `<li><span aria-current="page">${t(crumb.name)}</span></li>`
      : `<li><a href="${escapeHtml(crumb.path)}">${t(crumb.name)}</a></li>`,
  );
  return `<nav class="crumbs" aria-label="Fil d’Ariane"><ol>${items.join('')}</ol></nav>`;
}

function breadcrumbJsonLd(crumbs: readonly Crumb[], siteUrl: string): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${siteUrl}${crumb.path}`,
    })),
  };
}

function renderDocument(meta: PageMeta, ctx: RenderContext, freeHref: string, main: string): string {
  return `<!doctype html>
<html lang="fr">
${renderHead(meta, ctx)}
  <body>
${renderHeader(freeHref, ctx.price)}

    <main id="contenu">
${main}
    </main>

${renderFooter()}
  </body>
</html>
`;
}

function priceSpan(kind: 'amount' | 'sentence', price: PriceInfo): string {
  return `<span data-price="${kind}">${t(kind === 'amount' ? price.label : price.sentence)}</span>`;
}

/* ================================================================== */
/* Page d'une course                                                   */
/* ================================================================== */

/** Contenu d'une réponse de FAQ : texte, ou prix mis à jour en direct sur la page. */
type FaqPart = string | { price: 'sentence' };

interface FaqItem {
  question: string;
  paragraphs: FaqPart[][];
}

function faqPartText(part: FaqPart, price: PriceInfo): string {
  return typeof part === 'string' ? part : price.sentence;
}

function faqPartHtml(part: FaqPart, price: PriceInfo): string {
  return typeof part === 'string' ? t(part) : priceSpan(part.price, price);
}

function raceFaq(race: Race, facts: RaceFacts, ctx: RenderContext): FaqItem[] {
  const name = lcFirst(race.name);
  const longDate = formatDateLong(race.date);
  const [full, ...shorter] = facts.options;
  const items: FaqItem[] = [];

  if (full) {
    const alternatives = shorter.map((o) => `${o.weeks} semaines (dès le ${formatDateLong(o.start)})`).join(' ou ');
    items.push({
      question: `Quand commencer ma prépa pour le ${name} 2027 ?`,
      paragraphs: [
        [
          `Pour la prépa complète de ${full.weeks} semaines, commence le ${formatDateLong(full.start)}. ` +
            (alternatives ? `Si tu cours déjà régulièrement, tu peux partir sur ${alternatives}. ` : '') +
            `Dans tous les cas, il faut au moins ${ctx.deps.minWeeks} semaines pour te préparer sans te blesser.`,
        ],
      ],
    });
  }

  const christmas = full?.christmas;
  if (full && christmas) {
    items.push({
      question: 'Et pendant les fêtes de fin d’année ?',
      paragraphs: [
        [
          christmas.deload
            ? `Avec le plan de ${full.weeks} semaines, la semaine de Noël (${formatRange(christmas.start, christmas.end)}) est la S${christmas.index} : elle est allégée exprès, avec environ un quart de volume en moins. Tu profites des fêtes sans perdre le fil.`
            : `Avec le plan de ${full.weeks} semaines, Noël tombe en S${christmas.index} (${formatRange(christmas.start, christmas.end)}). Si tu dois sacrifier une séance, garde la sortie longue et laisse tomber un footing sans regret.`,
        ],
      ],
    });
  }

  items.push({
    question: `La date du ${name} 2027 est-elle confirmée ?`,
    paragraphs: [
      race.dateStatus === 'confirmée'
        ? [
            `Oui : ${longDate}, d’après ${sourceHost(race.sourceUrl)}. Vérifie quand même le règlement et les horaires auprès de l’organisation de la course avant de t’inscrire.`,
          ]
        : [
            `Pas encore. Elle n’était pas annoncée quand cette page a été mise à jour, le ${formatDate(ctx.today)} : le ${longDate} est une estimation, déduite de l’édition 2026 (même week-end). Si la date change, modifie-la dans tes réglages : ton plan se recalcule aussitôt.`,
          ],
    ],
  });

  const levels = ctx.deps.levels.map((level) => ctx.deps.levelLabel(race.kind, level).toLocaleLowerCase('fr-FR'));
  items.push({
    question: 'Le plan est-il adapté à mon niveau ?',
    paragraphs: [
      [
        `Tu choisis ton objectif : ${levels.slice(0, -1).join(', ')} ou ${levels[levels.length - 1] ?? ''}. ` +
          'Le plan part de ton kilométrage actuel et ne l’augmente jamais de plus de 10 % d’une semaine à l’autre. Tu peux changer d’objectif à tout moment : le plan se recalcule.',
      ],
    ],
  });

  items.push({
    question: 'Combien coûte le plan complet ?',
    paragraphs: [
      ['C’est un paiement unique, sans abonnement : ', { price: 'sentence' }, '. La semaine 1 est gratuite, sans inscription.'],
    ],
  });

  items.push({
    question: `Pass J-24 est-il lié à l’organisation du ${name} ?`,
    paragraphs: [
      [
        'Non. Pass J-24 n’est lié à aucun organisateur de course : le nom et la date de la course servent seulement à caler ton plan. Ton dossard et ton inscription se gèrent auprès de l’organisation de la course.',
      ],
    ],
  });
  return items;
}

function faqJsonLd(items: readonly FaqItem[], price: PriceInfo): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: frenchSpaces(item.question),
      acceptedAnswer: {
        '@type': 'Answer',
        text: frenchSpaces(item.paragraphs.map((p) => p.map((part) => faqPartText(part, price)).join('')).join(' ')),
      },
    })),
  };
}

function renderFaq(items: readonly FaqItem[], price: PriceInfo): string {
  return items
    .map(
      (item) => `          <details>
            <summary><span>${t(item.question)}</span>${ICON_CHEVRON}</summary>
            <div class="faq__body">
${item.paragraphs.map((p) => `              <p>${p.map((part) => faqPartHtml(part, price)).join('')}</p>`).join('\n')}
            </div>
          </details>`,
    )
    .join('\n');
}

/** Titre de la page : « Plan marathon de Nantes 2027 : ta prépa datée de 24 semaines ». */
export function raceTitle(race: Race, current: CurrentPlan): string {
  const base = `Plan ${lcFirst(race.name)} 2027`;
  if (current.status !== 'ok') return `${base} : les dates de ta prépa`;
  const full = `${base} : ta prépa datée de ${current.schedule.weeks} semaines`;
  return full.length <= 70 ? full : `${base} : ta prépa datée`;
}

function raceDescription(race: Race, current: CurrentPlan): string {
  const when =
    race.dateStatus === 'confirmée'
      ? `${race.name} le ${formatDateLong(race.date)}`
      : `${race.name} 2027 (date estimée : ${formatDateLong(race.date)})`;
  if (current.status === 'ok') {
    return `${when} : ta prépa de ${current.schedule.weeks} semaines commence le ${formatDateLong(current.schedule.start)}. Plan daté, semaine 1 offerte, une boucle par séance.`;
  }
  return `${when} : les dates de départ d’une prépa de 16 à 24 semaines, la semaine de Noël et l’affûtage. Semaine 1 offerte.`;
}

function heroSentence(race: Race, current: CurrentPlan, minWeeks: number): string {
  const estimate = race.dateStatus === 'estimée' ? ' (date estimée)' : '';
  const raceDay = `Course le <strong>${t(formatDateLong(race.date))}</strong>${estimate}.`;
  if (current.status === 'past') return `${raceDay} ${t('Cette édition est passée : jette un œil aux autres courses de printemps.')}`;
  if (current.status === 'too-short') {
    return `${raceDay} ${t(`Il reste moins de ${minWeeks} semaines : trop peu pour une prépa complète sans te blesser.`)}`;
  }
  const { schedule } = current;
  const start = `<strong>${t(formatDateLong(schedule.start))}</strong>`;
  const loop = t('chaque séance est datée jusqu’au jour J, avec une boucle prête à courir depuis ta porte.');
  if (current.shortened) {
    return `${raceDay} ${t('En commençant le')} ${start}${t(`, ta prépa dure ${schedule.weeks} semaines :`)} ${loop}`;
  }
  return `${raceDay} ${t(`Ta prépa de ${schedule.weeks} semaines commence le`)} ${start}${t(' :')} ${loop}`;
}

function renderStartOption(option: StartOption, race: Race, today: string): string {
  const classes = ['start-option', option.nominal ? 'is-recommended' : '', option.start < today ? 'is-past' : '']
    .filter(Boolean)
    .join(' ');
  const xmas = option.christmas
    ? option.christmas.deload
      ? `Noël : semaine allégée en ${weekLabel(option.christmas)}`
      : `Noël tombe en ${weekLabel(option.christmas)}`
    : null;
  return `          <li class="${classes}" data-start-option data-start="${option.start}">
            <div class="start-option__head">
              <h3>${option.weeks} semaines</h3>
              ${option.nominal ? '<span class="badge badge--accent">Format complet</span>' : ''}
            </div>
            <p class="start-option__date">Début le <strong><time datetime="${option.start}">${t(formatDateLong(option.start))}</time></strong></p>
            <p class="start-option__hint">${t(OPTION_HINTS[race.kind][option.weeks] ?? '')}</p>
${xmas ? `            <p class="start-option__xmas">${t(xmas)}</p>\n` : ''}            <p class="start-option__status" data-start-status>${option.start < today ? 'Date passée' : ''}</p>
          </li>`;
}

function renderSchedule(schedule: PlanSchedule, race: Race, deps: RaceDeps): string {
  const strip = schedule.strip
    .map(
      (week) =>
        `<li class="plan-strip__week phase--${week.phase}${week.deload ? ' is-deload' : ''}${week.index === schedule.weeks ? ' is-race' : ''}"></li>`,
    )
    .join('');
  const phases = schedule.phases
    .map(
      (span) => `          <li class="phase-span phase--${span.phase}">
            <strong>${t(`${deps.phaseLabels[span.phase]} · ${phaseRange(span)}`)}</strong>
            <span class="phase-span__dates">${t(formatRange(span.start, span.end))}</span>
            <span class="phase-span__text">${t(span.phase === 'affutage' ? 'Le volume baisse : tu arrives frais le jour J.' : deps.phaseDescriptions[span.phase])}</span>
          </li>`,
    )
    .join('\n');
  const deloads = schedule.deloads
    .map((week) => {
      const isChristmas = schedule.christmas?.index === week.index;
      return `S${week.index} (${formatRange(week.start, week.end)}${isChristmas ? ', Noël' : ''})`;
    })
    .join(' · ');
  const rows: [string, string][] = [['Jour 1', formatDateLong(schedule.start)]];
  if (deloads) rows.push(['Semaines allégées', deloads]);
  if (schedule.christmas && !schedule.christmas.deload) {
    rows.push(['Semaine de Noël', `${weekLabel(schedule.christmas)} : garde la sortie longue, allège le reste si besoin`]);
  }
  if (schedule.taperStart) rows.push(['Début de l’affûtage', formatDateLong(schedule.taperStart)]);
  rows.push(['Jour J', formatDateLong(race.date)]);

  return `      <section class="course-band" aria-labelledby="phases-title">
        <div class="wrap wrap--narrow section">
          <div class="section-head">
            <p class="eyebrow">${t(`Exemple : plan de ${schedule.weeks} semaines dès le ${formatDateLong(schedule.start, false)}`)}</p>
            <h2 id="phases-title">Ta prépa, phase par phase</h2>
            <p class="muted">${t('Le volume monte de 10 % au plus d’une semaine à l’autre, avec une semaine allégée toutes les 3 à 4 semaines et un vrai affûtage avant le jour J.')}</p>
          </div>
          <ol class="plan-strip" aria-hidden="true">${strip}</ol>
          <ol class="phase-spans">
${phases}
          </ol>
          <dl class="key-dates">
${rows.map(([term, value]) => `            <div><dt>${t(term)}</dt><dd>${t(value)}</dd></div>`).join('\n')}
          </dl>
          <p class="hint">${t('Exemple indicatif : le contenu de chaque séance dépend de ton objectif, de ton temps sur 10 km, de tes kilomètres actuels et du nombre de séances par semaine.')}</p>
        </div>
      </section>`;
}

function relatedRaces(race: Race, all: readonly Race[], count = 6): Race[] {
  const day = (iso: string) => dateOf(iso).getTime();
  return all
    .filter((other) => other.slug !== race.slug)
    .map((other) => ({
      other,
      // Même région d'abord, puis même distance, puis la date la plus proche.
      score:
        (other.region === race.region ? 0 : 1) * 1e13 +
        (other.kind === race.kind ? 0 : 1) * 1e12 +
        Math.abs(day(other.date) - day(race.date)),
    }))
    .sort((a, b) => a.score - b.score || a.other.slug.localeCompare(b.other.slug))
    .slice(0, count)
    .map((entry) => entry.other)
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'fr'));
}

function renderLevelPicker(race: Race, deps: RaceDeps): string {
  const choices = deps.levels.map(
    (level, index) => `                <label class="choice choice--card">
                  <input type="radio" name="level" value="${level}"${index === 0 ? ' checked' : ''}>
                  <span><strong>${t(deps.levelLabel(race.kind, level))}</strong><small>${t(deps.levelHint(race.kind, level))}</small></span>
                </label>`,
  ).join('\n');
  return `            <fieldset class="field level-picker" data-level-picker>
              <legend>Ton objectif</legend>
              <div class="choices choices--cards">
${choices}
              </div>
            </fieldset>`;
}

export function renderRacePage(race: Race, ctx: RenderContext): string {
  const facts = raceFacts(race, ctx.today, ctx.deps);
  const path = racePath(race);
  const url = `${ctx.siteUrl}${path}`;
  const free = freeWeekUrl(race);
  const name = lcFirst(race.name);
  const crumbs: Crumb[] = [
    { name: 'Accueil', path: '/' },
    { name: 'Courses de printemps', path: '/courses/' },
    { name: `${race.name} 2027`, path },
  ];
  const faq = raceFaq(race, facts, ctx);
  const confirmed = race.dateStatus === 'confirmée';

  const product = {
    '@type': 'Product',
    '@id': `${url}#pass`,
    name: 'Pass J-24 · Traceo',
    description: frenchSpaces(
      `Programme de préparation ${race.kind === 'marathon' ? 'marathon' : 'semi-marathon'} généré automatiquement et daté jusqu’au ${name} du ${formatDateLong(race.date)}, avec une boucle Traceo pour chaque séance et Traceo Premium jusqu’au ${formatDate(KEY_DATES.premiumUntil)}.`,
    ),
    image: `${ctx.siteUrl}/icons/og-image.png`,
    brand: { '@type': 'Brand', name: 'Traceo' },
    offers: {
      '@type': 'Offer',
      url,
      price: ctx.price.amount.toFixed(2),
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      ...(ctx.price.isLaunch ? { priceValidUntil: siteConfig.launchPriceEnd.slice(0, 10) } : {}),
    },
  };
  const meta: PageMeta = {
    title: raceTitle(race, facts.current),
    description: raceDescription(race, facts.current),
    path,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [product, faqJsonLd(faq, ctx.price), breadcrumbJsonLd(crumbs, ctx.siteUrl)],
    },
  };

  const status = confirmed
    ? '<span class="badge badge--accent">Date confirmée</span>'
    : '<span class="badge badge--warn">Date estimée</span>';
  const estimateNotice = confirmed
    ? ''
    : `
          <p class="notice notice--warn race-estimate"><strong>${t('Date estimée.')}</strong> ${t(
            `La date 2027 n’était pas encore annoncée quand cette page a été mise à jour, le ${formatDate(ctx.today)}. Elle est déduite de l’édition 2026, même week-end. Vérifie-la avant de t’inscrire ; si elle change, modifie-la dans ton plan : il se recalcule.`,
          )}</p>`;

  const facts_rows: [string, string][] = [
    ['Date', `${formatDateLong(race.date)} (${confirmed ? 'confirmée' : 'estimée'})`],
    ['Distance', DISTANCE_LABEL[race.kind]],
    ['Lieu', `${race.city} (${race.region})`],
  ];
  if (race.participantsApprox) facts_rows.push(['Participants', `environ ${NUMBER_FR.format(race.participantsApprox)}`]);
  if (race.notes) facts_rows.push(['À savoir', race.notes]);

  const related = relatedRaces(race, ctx.races)
    .map(
      (other) => `          <li><a class="related__link" href="${escapeHtml(racePath(other))}"><strong>${t(other.name)}</strong><span>${t(`${formatDateLong(other.date)} · ${other.city}`)}${other.dateStatus === 'estimée' ? ' · date estimée' : ''}</span></a></li>`,
    )
    .join('\n');

  const main = `      <section class="race-hero" aria-labelledby="page-title" data-race-page data-race="${race.kind}" data-race-date="${race.date}" data-race-name="${escapeHtml(race.name)}">
        <div class="wrap wrap--narrow race-hero__inner">
          ${renderCrumbs(crumbs)}
          <p class="eyebrow">${t(`${KIND_LABEL[race.kind]} · ${race.city} · ${race.region}`)}</p>
          <h1 id="page-title">${t(`Plan ${name}`)} <span class="grad-text">2027</span></h1>
          <p class="lead">${heroSentence(race, facts.current, ctx.deps.minWeeks)}</p>
          <p class="race-hero__status">${status}<span class="race-countdown" data-race-countdown hidden></span></p>${estimateNotice}
          <div class="race-hero__ctas">
            <a class="btn btn--primary btn--lg" href="${escapeHtml(free)}" data-free-link>Voir ma semaine 1 gratuite ${ICON_ARROW}</a>
            <a class="btn btn--lg btn--ghost" href="${escapeHtml(free)}" data-course-checkout>Je prends mon pass · ${priceSpan('amount', ctx.price)}</a>
          </div>
          <p class="hint">${t('Semaine 1 gratuite, sans inscription · Programme généré automatiquement')}</p>
        </div>
      </section>

      <section class="section wrap wrap--narrow" aria-labelledby="depart-title">
        <div class="section-head">
          <p class="eyebrow">Ton calendrier</p>
          <h2 id="depart-title">Quand commencer ta prépa ?</h2>
          <p class="muted">${t('Le plan démarre toujours un lundi et s’arrête le jour de la course. Plus la prépa est longue, plus la progression est douce.')}</p>
        </div>
        <div class="start-now card" data-start-now hidden></div>
        <ol class="start-options">
${facts.options.map((option) => renderStartOption(option, race, ctx.today)).join('\n')}
        </ol>
      </section>

${facts.featured ? renderSchedule(facts.featured, race, ctx.deps) : ''}

      <section class="section wrap wrap--narrow" aria-labelledby="course-title">
        <div class="section-head">
          <p class="eyebrow">La course</p>
          <h2 id="course-title">${t(`${race.name} 2027 en bref`)}</h2>
        </div>
        <dl class="race-facts card">
${facts_rows.map(([term, value]) => `          <div><dt>${t(term)}</dt><dd>${t(value)}</dd></div>`).join('\n')}
          <div><dt>Source de la date</dt><dd><a href="${escapeHtml(race.sourceUrl)}" target="_blank" rel="noopener nofollow">${t(sourceHost(race.sourceUrl))}</a> <span class="muted">(nouvel onglet)</span></dd></div>
        </dl>
        <p class="hint">${t('Pass J-24 n’est lié à aucun organisateur : vérifie la date, le règlement et les inscriptions auprès de l’organisation de la course.')}</p>
      </section>

      <section class="course-band" id="offre" aria-labelledby="offre-title">
        <div class="wrap wrap--narrow section">
          <div class="card card--accent offer-card">
            <p class="eyebrow">Pass J-24 · Traceo</p>
            <h2 id="offre-title">${t(`Ton plan complet pour le ${name}`)}</h2>
            <p class="offer-card__price"><span class="offer-card__amount" data-price="amount">${t(ctx.price.label)}</span><span>paiement unique</span></p>
            <p class="offer-card__sentence" data-price="sentence">${t(ctx.price.sentence)}</p>
            <ul class="ticks">
              <li>${ICON_CHECK}<span>${t(`Toutes tes semaines datées, jusqu’au ${formatDateLong(race.date)}`)}</span></li>
              <li>${ICON_CHECK}<span>${t('3 niveaux, modifiables à tout moment')}</span></li>
              <li>${ICON_CHECK}<span>${t('Une boucle Traceo de la bonne distance pour chaque séance')}</span></li>
              <li>${ICON_CHECK}<span>${t('Export agenda .ics, version imprimable, image story')}</span></li>
              <li>${ICON_CHECK}<span>${t(`Traceo Premium jusqu’au ${formatDate(KEY_DATES.premiumUntil)}`)}</span></li>
            </ul>
${renderLevelPicker(race, ctx.deps)}
            <a class="btn btn--primary btn--lg btn--block" href="${escapeHtml(free)}" data-course-checkout>Je prends mon pass</a>
            <p class="hint center">${t(`Prix TTC · ${VAT_MENTION} · Accès immédiat après paiement`)}</p>
            <p class="center"><a href="${escapeHtml(free)}" data-free-link>${t('Pas encore décidé ? Commence par ta semaine 1 gratuite')}</a></p>
          </div>
        </div>
      </section>

      <section class="section wrap wrap--narrow" aria-labelledby="faq-title">
        <div class="section-head">
          <p class="eyebrow">Questions fréquentes</p>
          <h2 id="faq-title">${t(`Ta prépa pour le ${name}`)}</h2>
        </div>
        <div class="faq">
${renderFaq(faq, ctx.price)}
        </div>
      </section>

      <section class="section wrap wrap--narrow" aria-labelledby="autres-title">
        <div class="section-head">
          <p class="eyebrow">Au printemps 2027</p>
          <h2 id="autres-title">Autres courses</h2>
        </div>
        <ul class="related">
${related}
        </ul>
        <p><a href="/courses/">${t('Toutes les courses de printemps 2027')}</a></p>
      </section>

      <section class="wrap wrap--narrow race-health-wrap" aria-labelledby="sante-title">
        <div class="card race-health">
          ${ICON_ALERT}
          <div>
            <h2 id="sante-title">${t('Ta santé d’abord')}</h2>
            <p>${t(HEALTH_TEXT)}</p>
          </div>
        </div>
      </section>`;

  return renderDocument(meta, ctx, free, main);
}

/* ================================================================== */
/* Index des courses                                                   */
/* ================================================================== */

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(iso: string): string {
  return ucFirst(FMT_MONTH_YEAR.format(dateOf(iso)));
}

function planLine(current: CurrentPlan, minWeeks: number): string {
  if (current.status === 'past') return 'Course passée';
  if (current.status === 'too-short') return `Moins de ${minWeeks} semaines : trop tard pour une prépa complète`;
  return `Prépa de ${current.schedule.weeks} semaines dès le ${formatDateLong(current.schedule.start)}`;
}

export function renderRacesIndex(ctx: RenderContext): string {
  const races = sortRaces(ctx.races);
  const path = '/courses/';
  const crumbs: Crumb[] = [
    { name: 'Accueil', path: '/' },
    { name: 'Courses de printemps', path },
  ];
  const marathons = races.filter((r) => r.kind === 'marathon').length;
  const semis = races.length - marathons;
  const meta: PageMeta = {
    title: 'Marathons et semis de printemps 2027 en France : dates et plans',
    description:
      'Les dates 2027 des principaux marathons et semi-marathons de printemps en France, de février à mai, avec pour chacun le lundi où commencer ta prépa.',
    path,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        breadcrumbJsonLd(crumbs, ctx.siteUrl),
        {
          '@type': 'ItemList',
          name: 'Marathons et semi-marathons de printemps 2027 en France',
          numberOfItems: races.length,
          itemListElement: races.map((race, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: `${race.name} 2027`,
            url: `${ctx.siteUrl}${racePath(race)}`,
          })),
        },
      ],
    },
  };

  const months = new Map<string, Race[]>();
  for (const race of races) {
    const key = monthKey(race.date);
    const list = months.get(key) ?? [];
    list.push(race);
    months.set(key, list);
  }

  const groups = [...months.entries()]
    .map(([key, list]) => {
      const items = list
        .map((race) => {
          const date = dateOf(race.date);
          const current = raceFacts(race, ctx.today, ctx.deps).current;
          return `            <li class="race-item" data-kind="${race.kind}">
              <a class="race-item__link" href="${escapeHtml(racePath(race))}">
                <time class="race-item__date" datetime="${race.date}"><span>${t(FMT_DOW_SHORT.format(date))}</span><strong>${date.getUTCDate()}</strong><span>${t(FMT_MONTH_SHORT.format(date))}</span></time>
                <span class="race-item__body">
                  <span class="race-item__meta">${t(`${KIND_LABEL[race.kind]} · ${race.city}`)}</span>
                  <strong class="race-item__name">${t(race.name)}</strong>
                  <span class="race-item__plan">${t(planLine(current, ctx.deps.minWeeks))}</span>
                </span>
                ${race.dateStatus === 'estimée' ? '<span class="badge badge--warn race-item__badge">Date estimée</span>' : ''}
              </a>
            </li>`;
        })
        .join('\n');
      return `        <section class="race-month" data-race-month aria-labelledby="mois-${key}">
          <h2 id="mois-${key}">${t(monthLabel(`${key}-01`))}</h2>
          <ul class="race-list">
${items}
          </ul>
        </section>`;
    })
    .join('\n');

  const main = `      <section class="race-hero" aria-labelledby="page-title">
        <div class="wrap wrap--narrow race-hero__inner">
          ${renderCrumbs(crumbs)}
          <p class="eyebrow">${t(`Février à mai 2027 · ${races.length} courses`)}</p>
          <h1 id="page-title">Courses de printemps <span class="grad-text">2027</span></h1>
          <p class="lead">${t('Les principaux marathons et semi-marathons de France, de février à mai 2027. Pour chacun : la date, et le lundi où démarrer ta prépa.')}</p>
          <p class="hint">${t('Date confirmée : annoncée par l’organisation de la course ou par la presse. Date estimée : déduite de l’édition 2026, à vérifier avant de t’inscrire.')}</p>
        </div>
      </section>

      <div class="wrap wrap--narrow races-index">
        <div class="race-filter" data-race-filter role="group" aria-label="Filtrer par distance" hidden>
          <button class="race-filter__btn" type="button" data-filter="all" aria-pressed="true">Toutes <span class="race-filter__count">${races.length}</span></button>
          <button class="race-filter__btn" type="button" data-filter="marathon" aria-pressed="false">Marathons <span class="race-filter__count">${marathons}</span></button>
          <button class="race-filter__btn" type="button" data-filter="semi" aria-pressed="false">Semis <span class="race-filter__count">${semis}</span></button>
        </div>
        <p class="sr-only" data-race-filter-status aria-live="polite"></p>
${groups}

        <section class="card card--accent other-race" aria-labelledby="autre-title">
          <h2 id="autre-title">${t('Ta course n’est pas dans la liste ?')}</h2>
          <p>${t(`Le plan se cale sur la date de ta course, jusqu’au 30 juin 2027 et à au moins ${ctx.deps.minWeeks} semaines : choisis « Autre course » et indique sa date.`)}</p>
          <a class="btn btn--primary btn--lg" href="/gratuit/">Voir ma semaine 1 gratuite ${ICON_ARROW}</a>
        </section>

        <p class="health-warning"><strong>${t('Santé :')}</strong> ${t(FOOTER_HEALTH)}</p>
      </div>`;

  return renderDocument(meta, ctx, '/gratuit/', main);
}

/* ================================================================== */
/* Site généré et sitemap                                              */
/* ================================================================== */

export interface GeneratedPage {
  /** Nom de l'entrée Vite. */
  inputName: string;
  /** Chemin relatif à la racine Vite, ex. courses/x/index.html */
  file: string;
  /** URL publique, ex. /courses/x/ */
  path: string;
  html: string;
}

export interface RenderSiteOptions {
  deps: RaceDeps;
  races: readonly Race[];
  siteUrl: string;
  now: Date;
}

/** Index + une page par course, rendus en mémoire. */
export function renderRacePages(options: RenderSiteOptions): GeneratedPage[] {
  const races = sortRaces(options.races);
  const ctx: RenderContext = {
    deps: options.deps,
    siteUrl: options.siteUrl.replace(/\/+$/, ''),
    today: toIsoDate(options.now),
    price: options.deps.priceInfo(options.now),
    races,
  };
  return [
    { inputName: 'courses', file: 'courses/index.html', path: '/courses/', html: renderRacesIndex(ctx) },
    ...races.map((race) => ({
      inputName: `courses-${race.slug}`,
      file: `courses/${race.slug}/index.html`,
      path: racePath(race),
      html: renderRacePage(race, ctx),
    })),
  ];
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** sitemap.xml : `paths` publics (« / », « /gratuit/ »…), `/` en premier puis ordre alphabétique. */
export function buildSitemap(siteUrl: string, paths: Iterable<string>, lastmod: string): string {
  const unique = [...new Set(paths)].sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
  const base = siteUrl.replace(/\/+$/, '');
  const urls = unique
    .map((path) => `  <url>\n    <loc>${xmlEscape(`${base}${path}`)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Préfixes `Disallow` de robots.txt (toutes sections confondues). */
export function parseDisallow(robotsTxt: string): string[] {
  return robotsTxt
    .split(/\r?\n/)
    .map((line) => /^\s*disallow\s*:\s*(\S*)/i.exec(line)?.[1] ?? '')
    .filter((prefix) => prefix.startsWith('/'));
}

/** URL publique d'un fichier HTML relatif à la racine : `index.html` → `/`, `x/index.html` → `/x/`. */
export function htmlFileToPath(file: string): string {
  const clean = normalizePath(file).replace(/^\/+/, '');
  if (clean === 'index.html') return '/';
  if (clean.endsWith('/index.html')) return `/${clean.slice(0, -'index.html'.length)}`;
  return `/${clean}`;
}

type InputOption = string | string[] | Record<string, string>;

function inputValues(input: unknown): string[] {
  if (typeof input === 'string') return [input];
  if (Array.isArray(input)) return input.filter((v): v is string => typeof v === 'string');
  if (isRecord(input)) return Object.values(input).filter((v): v is string => typeof v === 'string');
  return [];
}

function inputRecord(input: unknown, root: string): Record<string, string> {
  if (input === undefined) {
    const home = resolve(root, 'index.html');
    return existsSync(home) ? { index: home } : {};
  }
  if (isRecord(input)) {
    return Object.fromEntries(Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  }
  const record: Record<string, string> = {};
  for (const file of inputValues(input)) {
    const name = normalizePath(relative(root, file)).replace(/\/index\.html$|\.html$/, '').replace(/\//g, '-') || 'index';
    record[name] = file;
  }
  return record;
}

/** Horloge du build : `SOURCE_DATE_EPOCH` (builds reproductibles) sinon l'heure courante. */
function buildClock(): Date {
  const epoch = Number(process.env.SOURCE_DATE_EPOCH);
  return Number.isFinite(epoch) && epoch > 0 ? new Date(epoch * 1000) : new Date();
}

/* ================================================================== */
/* Plugin                                                              */
/* ================================================================== */

export interface RacesPluginOptions {
  /** URL publique du site, sans barre finale (canonical, sitemap). */
  siteUrl: string;
  /** Fichier de données, relatif à la racine Vite (défaut : data/races.json). */
  dataFile?: string;
  /** Horloge du build (tests) ; défaut : SOURCE_DATE_EPOCH ou maintenant. */
  now?: () => Date;
  /** Modules de l'application (tests) ; défaut : chargés par `loadRaceDeps`. */
  deps?: RaceDeps;
}

export function racesPlugin(options: RacesPluginOptions): Plugin {
  const siteUrl = options.siteUrl.replace(/\/+$/, '');
  const clock = options.now ?? buildClock;
  let root = normalizePath(process.cwd());
  let dataPath = '';
  let buildDay = toIsoDate(clock());
  let byId = new Map<string, GeneratedPage>();
  let byPath = new Map<string, GeneratedPage>();
  let sitePaths: string[] = [];
  let disallow: string[] = [];
  let deps: RaceDeps | null = options.deps ?? null;

  const generate = (): GeneratedPage[] => {
    if (!deps) throw new Error('[races] Modules de l’application non chargés.');
    const now = clock();
    buildDay = toIsoDate(now);
    const pages = renderRacePages({ deps, races: loadRaces(dataPath), siteUrl, now });
    byId = new Map(pages.map((page) => [normalizePath(resolve(root, page.file)), page]));
    byPath = new Map(pages.map((page) => [page.path, page]));
    return pages;
  };

  const sitemap = (): string => {
    const paths = [...sitePaths, ...byPath.keys()].filter(
      (path) => !disallow.some((prefix) => path.startsWith(prefix)),
    );
    return buildSitemap(siteUrl, paths, buildDay);
  };

  const devMiddleware = (server: ViteDevServer): Connect.NextHandleFunction => (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let pathname: string;
    let search: string;
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      pathname = decodeURIComponent(url.pathname);
      search = url.search;
    } catch {
      return next();
    }
    if (pathname === '/sitemap.xml') {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.end(sitemap());
      return undefined;
    }
    if (!pathname.startsWith('/courses')) return next();
    const path = pathname.endsWith('/index.html') ? pathname.slice(0, -'index.html'.length) : pathname;
    const page = byPath.get(path);
    if (!page) {
      if (byPath.has(`${path}/`)) {
        res.statusCode = 301;
        res.setHeader('Location', `${path}/${search}`);
        res.end();
        return undefined;
      }
      return next();
    }
    server
      .transformIndexHtml(path, page.html, req.originalUrl)
      .then((html) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      })
      .catch(next);
    return undefined;
  };

  return {
    name: 'traceo:races',
    enforce: 'pre',

    async config(userConfig: UserConfig, env) {
      root = normalizePath(resolve(userConfig.root ?? process.cwd()));
      dataPath = resolve(root, options.dataFile ?? DEFAULT_DATA_FILE);
      deps ??= await loadRaceDeps();
      const pages = generate();
      if (env.command !== 'build') return undefined;

      const build = userConfig.build;
      const existing = inputRecord(build?.rolldownOptions?.input ?? build?.rollupOptions?.input, root);
      const extra: Record<string, string> = {};
      for (const page of pages) {
        const file = resolve(root, page.file);
        if (existsSync(file)) {
          throw new Error(`[races] ${page.file} existe déjà sur le disque : cette page est générée depuis ${DEFAULT_DATA_FILE}.`);
        }
        if (existing[page.inputName]) throw new Error(`[races] L'entrée « ${page.inputName} » est déjà utilisée.`);
        extra[page.inputName] = file;
      }
      const input: InputOption = { ...existing, ...extra };
      return { build: { rolldownOptions: { input } } };
    },

    configResolved(resolved) {
      const input = resolved.build.rolldownOptions.input;
      sitePaths = inputValues(input)
        .filter((file) => file.endsWith('.html'))
        .map((file) => htmlFileToPath(relative(resolved.root, file)));
      const robots = resolved.publicDir ? resolve(resolved.publicDir, 'robots.txt') : '';
      disallow = robots && existsSync(robots) ? parseDisallow(readFileSync(robots, 'utf8')) : [];
    },

    resolveId(source) {
      if (source.includes('?')) return null;
      const id = normalizePath(source);
      return byId.has(id) ? id : null;
    },

    load(id) {
      return byId.get(id)?.html ?? null;
    },

    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap() });
    },

    configureServer(server) {
      server.middlewares.use(devMiddleware(server));
      server.watcher.add(dataPath);
      server.watcher.on('change', (file) => {
        if (normalizePath(file) !== normalizePath(dataPath)) return;
        try {
          generate();
          server.ws.send({ type: 'full-reload' });
        } catch (error) {
          server.config.logger.error((error as Error).message);
        }
      });
    },
  };
}
