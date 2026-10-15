/**
 * Contenu des séances (SPEC section 2, « Semaine type ») : séances de qualité par phase,
 * sorties longues, footings, renforcement, semaine de course et jour J.
 *
 * Distances internes en hectomètres entiers (1 hm = 100 m). Le kilométrage d'une
 * séance est exact ; les durées d'échauffement / retour au calme sont arrondies à la minute.
 */
import { RACE_SESSION_KM } from './constants';
import { formatHm, formatMeters, formatMinutes, formatPace, formatRaceTime, formatRepDuration } from './format';
import type { Level, Phase, Plan, RaceKind, SessionPace, SessionType } from './types';

export type Paces = Plan['paces'];

export interface WorkoutContext {
  race: RaceKind;
  level: Level;
  paces: Paces;
  sessions: 3 | 4 | 5;
  longRunDay: 'sat' | 'sun';
  raceName?: string;
  /** Coureur qui court peu (< 15 km / semaine) : pas de vrai fartlek les deux premières semaines. */
  beginner?: boolean;
}

/** Séance avant datation (le jour est un index 0 = lundi … 6 = dimanche). */
export interface DraftSession {
  dowIdx: number;
  type: SessionType;
  title: string;
  /** Distance en hm (0 pour le renforcement ; course : voir `exactKm`). */
  hm: number;
  /** Distance exacte en km, pour la course uniquement (42,195 / 21,1). */
  exactKm?: number;
  durationMin: number;
  paces: SessionPace[];
  steps: string[];
}

/* ------------------------------------------------------------------ */
/* Semaine type                                                       */
/* ------------------------------------------------------------------ */

export type SlotRole = 'ef_main' | 'ef_mid' | 'ef_short' | 'qualite' | 'sl';

export interface Slot {
  dowIdx: number;
  role: SlotRole;
}

const TUE = 1;
const WED = 2;
const THU = 3;
const SAT = 5;
const SUN = 6;

/**
 * 4 séances, sortie longue le dimanche : mar EF + lignes droites, jeu qualité,
 * sam EF courte + renfo, dim sortie longue. 3 séances : sans l'EF courte.
 * 5 séances : + mer EF. Sortie longue le samedi : EF courte le dimanche.
 */
export function weekTemplate(sessions: 3 | 4 | 5, longRunDay: 'sat' | 'sun'): Slot[] {
  const slots: Slot[] = [
    { dowIdx: TUE, role: 'ef_main' },
    { dowIdx: THU, role: 'qualite' },
  ];
  if (sessions === 5) slots.push({ dowIdx: WED, role: 'ef_mid' });
  const longIdx = longRunDay === 'sun' ? SUN : SAT;
  const shortIdx = longRunDay === 'sun' ? SAT : SUN;
  slots.push({ dowIdx: longIdx, role: 'sl' });
  if (sessions >= 4) slots.push({ dowIdx: shortIdx, role: 'ef_short' });
  return slots.sort((a, b) => a.dowIdx - b.dowIdx);
}

/* ------------------------------------------------------------------ */
/* Allures et petites aides                                           */
/* ------------------------------------------------------------------ */

function efPace(ctx: WorkoutContext): SessionPace {
  return { label: 'Endurance fondamentale', secPerKm: ctx.paces.ef };
}
function recupPace(ctx: WorkoutContext): SessionPace {
  return { label: 'Récupération', secPerKm: ctx.paces.recup };
}
function seuilPace(ctx: WorkoutContext): SessionPace {
  return { label: 'Seuil', secPerKm: ctx.paces.seuil };
}
function as10Pace(ctx: WorkoutContext): SessionPace {
  return { label: 'Allure 10 km', secPerKm: ctx.paces.as10 };
}
function coursePace(ctx: WorkoutContext): SessionPace {
  return { label: ctx.race === 'marathon' ? 'Allure marathon' : 'Allure semi', secPerKm: ctx.paces.allure_course };
}
function courseNoun(ctx: WorkoutContext): string {
  return ctx.race === 'marathon' ? 'allure marathon' : 'allure semi';
}

function uniquePaces(list: SessionPace[]): SessionPace[] {
  const seen = new Set<string>();
  return list.filter((p) => {
    if (seen.has(p.label)) return false;
    seen.add(p.label);
    return true;
  });
}

function pick<T>(list: readonly T[], index: number): T {
  const item = list[Math.max(0, Math.min(list.length - 1, index))];
  if (item === undefined) throw new Error('liste vide');
  return item;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Mètres parcourus en `sec` secondes à `pace` s/km. */
function metersFor(sec: number, pace: number): number {
  return (sec / pace) * 1000;
}
/** Secondes pour `meters` à `pace` s/km. */
function secondsFor(meters: number, pace: number): number {
  return (meters / 1000) * pace;
}
function minutesForHm(hm: number, pace: number): number {
  return Math.round(secondsFor(hm * 100, pace) / 60);
}

function runLine(hm: number, pace: SessionPace, what: string): string {
  return `${formatHm(hm)} ${what} (${formatPace(pace.secPerKm)}), soit environ ${formatMinutes(minutesForHm(hm, pace.secPerKm))}.`;
}

/* ------------------------------------------------------------------ */
/* Séances de qualité                                                 */
/* ------------------------------------------------------------------ */

type Amount = { sec: number } | { m: number };
type Family = 'fartlek' | 'cotes' | 'intervalles' | 'seuil' | 'blocs';
export type QualityKind = 'standard' | 'deload' | 'taper' | 'rappel';

interface RepPattern {
  family: Family;
  fast: Amount;
  fastPace: SessionPace;
  /** Allure servant à estimer la distance de l'effort (côtes : plus lente que l'effort). */
  distancePace?: number;
  rec: Amount;
  recPace: SessionPace;
  /** Libellé de la récupération (« de trot », « en endurance fondamentale »). */
  recWhat: string;
  nMin: number;
  nMax: number;
  /** Minimum absolu quand la semaine est très légère. */
  nFloor: number;
  maxFastM?: number;
  maxFastSec?: number;
}

function fastMeters(p: RepPattern): number {
  return 'm' in p.fast ? p.fast.m : metersFor(p.fast.sec, p.distancePace ?? p.fastPace.secPerKm);
}
function fastSeconds(p: RepPattern): number {
  return 'sec' in p.fast ? p.fast.sec : secondsFor(p.fast.m, p.fastPace.secPerKm);
}
function recMeters(p: RepPattern): number {
  return 'm' in p.rec ? p.rec.m : metersFor(p.rec.sec, p.recPace.secPerKm);
}
function recSeconds(p: RepPattern): number {
  return 'sec' in p.rec ? p.rec.sec : secondsFor(p.rec.m, p.recPace.secPerKm);
}
function mainMeters(p: RepPattern, n: number): number {
  return n * fastMeters(p) + Math.max(0, n - 1) * recMeters(p);
}
function mainSeconds(p: RepPattern, n: number): number {
  return n * fastSeconds(p) + Math.max(0, n - 1) * recSeconds(p);
}

function fartlekPattern(ctx: WorkoutContext, level: number): RepPattern {
  const levels = [
    { fast: 60, rec: 60, pace: as10Pace(ctx), nMin: 6, nMax: 12 },
    { fast: 90, rec: 60, pace: as10Pace(ctx), nMin: 5, nMax: 10 },
    { fast: 120, rec: 60, pace: seuilPace(ctx), nMin: 5, nMax: 8 },
    { fast: 180, rec: 90, pace: seuilPace(ctx), nMin: 4, nMax: 6 },
  ] as const;
  const l = pick(levels, level);
  return {
    family: 'fartlek',
    fast: { sec: l.fast },
    fastPace: l.pace,
    rec: { sec: l.rec },
    recPace: recupPace(ctx),
    recWhat: 'de trot',
    nMin: l.nMin,
    nMax: l.nMax,
    nFloor: 4,
    maxFastSec: 16 * 60,
  };
}

function cotesPattern(ctx: WorkoutContext, level: number): RepPattern {
  const levels = [
    { up: 30, nMin: 8, nMax: 10 },
    { up: 45, nMin: 8, nMax: 10 },
    { up: 60, nMin: 6, nMax: 10 },
    { up: 75, nMin: 6, nMax: 8 },
  ] as const;
  const l = pick(levels, level);
  const uphillPace = Math.round(ctx.paces.as10 * 1.15);
  const upMeters = metersFor(l.up, uphillPace);
  return {
    family: 'cotes',
    fast: { sec: l.up },
    fastPace: as10Pace(ctx),
    distancePace: uphillPace,
    rec: { m: upMeters },
    recPace: recupPace(ctx),
    recWhat: 'en redescendant au trot',
    nMin: l.nMin,
    nMax: l.nMax,
    nFloor: 5,
    maxFastSec: 12 * 60,
  };
}

function intervallesPattern(ctx: WorkoutContext, level: number): RepPattern {
  const levels = [
    { m: 800, rec: 90, nMin: 5, nMax: 10 },
    { m: 1000, rec: 120, nMin: 4, nMax: 8 },
    { m: 1200, rec: 120, nMin: 4, nMax: 6 },
    { m: 1500, rec: 150, nMin: 3, nMax: 5 },
  ] as const;
  const l = pick(levels, level);
  return {
    family: 'intervalles',
    fast: { m: l.m },
    fastPace: as10Pace(ctx),
    rec: { sec: l.rec },
    recPace: recupPace(ctx),
    recWhat: 'de trot',
    nMin: l.nMin,
    nMax: l.nMax,
    nFloor: 3,
    maxFastM: 8000,
  };
}

function seuilPattern(ctx: WorkoutContext, level: number): RepPattern {
  const levels = [
    { sec: 480, rec: 120, nMin: 3, nMax: 4 },
    { sec: 600, rec: 120, nMin: 2, nMax: 4 },
    { sec: 720, rec: 180, nMin: 2, nMax: 3 },
    { sec: 900, rec: 180, nMin: 2, nMax: 3 },
  ] as const;
  const l = pick(levels, level);
  return {
    family: 'seuil',
    fast: { sec: l.sec },
    fastPace: seuilPace(ctx),
    rec: { sec: l.rec },
    recPace: recupPace(ctx),
    recWhat: 'de trot',
    nMin: l.nMin,
    nMax: l.nMax,
    nFloor: 2,
    maxFastSec: 40 * 60,
  };
}

function blocsPattern(ctx: WorkoutContext, level: number): RepPattern {
  if (ctx.race === 'marathon') {
    const levels = [
      { m: 3000, nMin: 2, nMax: 4 },
      { m: 4000, nMin: 2, nMax: 3 },
      { m: 5000, nMin: 2, nMax: 3 },
      { m: 6000, nMin: 2, nMax: 2 },
    ] as const;
    const l = pick(levels, level);
    return {
      family: 'blocs',
      fast: { m: l.m },
      fastPace: coursePace(ctx),
      rec: { m: 1000 },
      recPace: efPace(ctx),
      recWhat: 'en endurance fondamentale',
      nMin: l.nMin,
      nMax: l.nMax,
      nFloor: 1,
      maxFastM: 16000,
    };
  }
  const levels = [
    { m: 2000, rec: 120, nMin: 3, nMax: 5 },
    { m: 3000, rec: 180, nMin: 2, nMax: 4 },
    { m: 4000, rec: 180, nMin: 2, nMax: 3 },
    { m: 5000, rec: 180, nMin: 2, nMax: 2 },
  ] as const;
  const l = pick(levels, level);
  return {
    family: 'blocs',
    fast: { m: l.m },
    fastPace: coursePace(ctx),
    rec: { sec: l.rec },
    recPace: recupPace(ctx),
    recWhat: 'de trot',
    nMin: l.nMin,
    nMax: l.nMax,
    nFloor: 1,
    maxFastM: 10000,
  };
}

/** Blocs courts à allure course (affûtage, rappel de la semaine de course). */
function shortBlocsPattern(ctx: WorkoutContext, meters: number, recSec: number, nMin: number, nMax: number): RepPattern {
  return {
    family: 'blocs',
    fast: { m: meters },
    fastPace: coursePace(ctx),
    rec: { sec: recSec },
    recPace: recupPace(ctx),
    recWhat: 'de trot',
    nMin,
    nMax,
    nFloor: 1,
  };
}

/**
 * Niveau de progression le plus élevé (≤ `level`) dont la version minimale tient dans
 * le budget (+20 %) : un petit volume hebdomadaire ne reçoit pas des blocs démesurés.
 */
function fitLevel(make: (level: number) => RepPattern, level: number, budgetM: number): RepPattern {
  return fitLevelWithIndex(make, level, budgetM).pattern;
}

function fitLevelWithIndex(
  make: (level: number) => RepPattern,
  level: number,
  budgetM: number,
): { pattern: RepPattern; level: number } {
  for (let l = level; l > 0; l -= 1) {
    const pattern = make(l);
    if (mainMeters(pattern, pattern.nMin) <= budgetM * 1.2) return { pattern, level: l };
  }
  return { pattern: make(0), level: 0 };
}

export interface QualityChoice {
  /** Séance visée, puis versions de repli plus courtes (semaine trop légère pour la séance visée). */
  patterns: readonly RepPattern[];
  kind: QualityKind;
  /** Part du volume hebdomadaire visée pour le corps de séance. */
  mainShare: number;
}

/** Repli ultime : 30 s vite / 30 s trot, tient dans les plus petites semaines. */
function tinyFartlekPattern(ctx: WorkoutContext): RepPattern {
  return { ...fartlekPattern(ctx, 0), fast: { sec: 30 }, rec: { sec: 30 }, nMin: 6, nMax: 8, nFloor: 4 };
}

export interface QualityOptions {
  /** La sortie longue de la semaine contient déjà des blocs à allure course. */
  longRunRacePace?: boolean;
  /** Index de la semaine dans le plan (1-based). */
  weekIndex?: number;
}

/**
 * Séance de qualité de la semaine.
 * - base : fartlek et côtes en alternance (petit fartlek de 30 s les deux premières semaines
 *   d'un coureur qui court peu) ;
 * - développement : fractionné à allure 10 km et seuil en alternance ;
 * - spécifique : blocs à allure course, qui progressent au fil des semaines ; blocs courts
 *   quand la sortie longue de la semaine contient déjà de l'allure course ;
 * - affûtage : blocs courts à allure course ;
 * - semaine allégée : version plus courte que la séance de la phase.
 * `progress` = nombre de semaines chargées déjà passées dans la phase.
 */
export function selectQuality(
  ctx: WorkoutContext,
  phase: Phase,
  deload: boolean,
  progress: number,
  taperStep: number,
  weekHm: number,
  options: QualityOptions = {},
): QualityChoice {
  const level = Math.floor(progress / 2);
  const budget = (share: number): number => weekHm * 100 * share;
  const tiny = tinyFartlekPattern(ctx);
  const shortBlocs = shortBlocsPattern(ctx, 1000, 120, 2, 2);

  if (phase === 'affutage') {
    const first =
      ctx.race === 'marathon' && taperStep === 0
        ? shortBlocsPattern(ctx, 3000, 180, 2, 3)
        : shortBlocsPattern(ctx, 2000, 120, 2, 3);
    return { patterns: [first, shortBlocs], kind: 'taper', mainShare: 0.12 };
  }
  if (deload) {
    const patterns =
      phase === 'base'
        ? [{ ...fartlekPattern(ctx, 0), nMin: 4, nMax: 6 }, tiny]
        : phase === 'developpement'
          ? [
              { ...seuilPattern(ctx, 0), nMin: 2, nMax: 2 },
              { ...seuilPattern(ctx, 0), fast: { sec: 360 }, nMin: 2, nMax: 2 },
              tiny,
            ]
          : ctx.race === 'marathon'
            ? // Strictement plus court que la plus petite séance chargée (2 × 3 km).
              [shortBlocsPattern(ctx, 2000, 120, 2, 2), shortBlocs]
            : [{ ...blocsPattern(ctx, 0), nMin: 2, nMax: 2 }, shortBlocs];
    return { patterns, kind: 'deload', mainShare: 0.07 };
  }
  if (phase === 'base' && ctx.beginner && (options.weekIndex ?? 99) <= 2) {
    return { patterns: [tiny], kind: 'standard', mainShare: 0.08 };
  }
  if (phase === 'base') {
    const make = progress % 2 === 0 ? fartlekPattern : cotesPattern;
    const first = fitLevel((l) => make(ctx, l), level, budget(0.1));
    return { patterns: [first, make(ctx, 0), tiny], kind: 'standard', mainShare: 0.1 };
  }
  if (phase === 'developpement') {
    const make = progress % 2 === 0 ? intervallesPattern : seuilPattern;
    const first = fitLevel((l) => make(ctx, l), level, budget(0.14));
    return {
      patterns: [first, make(ctx, 0), { ...seuilPattern(ctx, 0), fast: { sec: 360 }, nMin: 2, nMax: 2 }, tiny],
      kind: 'standard',
      mainShare: 0.14,
    };
  }
  const share = ctx.race === 'marathon' ? 0.17 : 0.15;
  if (options.longRunRacePace) {
    // La sortie longue porte déjà des blocs à allure course : le jeudi reste court
    // (jamais deux grosses séances à allure course dans la même semaine).
    const blocks = shortBlocsPattern(ctx, 1000, 90, 3, 5);
    return { patterns: [blocks, shortBlocs], kind: 'standard', mainShare: Math.min(share, 0.1) };
  }
  const fitted = fitLevelWithIndex((l) => blocsPattern(ctx, l), progress, budget(share));
  // Petit volume : le niveau reste bloqué, on progresse alors en ajoutant une répétition.
  const target = Math.min(progress, 3);
  const extra = fitted.level < target && progress >= 2 ? 1 : 0;
  const first: RepPattern = { ...fitted.pattern, nMin: Math.min(fitted.pattern.nMax, fitted.pattern.nMin + extra) };
  return {
    patterns: [first, fitted.pattern, blocsPattern(ctx, 0), shortBlocsPattern(ctx, 2000, 120, 2, 3), shortBlocs],
    kind: 'standard',
    mainShare: share,
  };
}

/** Rappel d'allure de la semaine de course, avec des versions plus courtes pour les petits volumes. */
export function raceWeekRappel(ctx: WorkoutContext, referenceHm: number): QualityChoice {
  const first =
    ctx.race === 'marathon'
      ? shortBlocsPattern(ctx, referenceHm >= 300 ? 2000 : 1000, 120, 2, 2)
      : shortBlocsPattern(ctx, 1000, 120, referenceHm >= 250 ? 3 : 2, referenceHm >= 250 ? 3 : 2);
  const minutes: RepPattern = { ...shortBlocsPattern(ctx, 1000, 120, 2, 2), fast: { sec: 180 } };
  return { patterns: [first, shortBlocsPattern(ctx, 1000, 120, 2, 2), minutes], kind: 'rappel', mainShare: 0 };
}

export interface PreparedQuality {
  choice: QualityChoice;
  /** Séance retenue parmi `choice.patterns`. */
  pattern: RepPattern;
  n: number;
  mainM: number;
  mainSec: number;
  /** Distance minimale (échauffement 10 min, retour au calme 5 min), en hm. */
  minHm: number;
  /** Distance « naturelle » (échauffement et retour au calme standards), en hm. */
  naturalHm: number;
}

const MIN_WU_MIN = 10;
const MIN_CD_MIN = 5;

function naturalWarmUp(kind: QualityKind): { wu: number; cd: number } {
  return kind === 'standard' ? { wu: 20, cd: 10 } : { wu: 15, cd: 10 };
}

function chooseReps(p: RepPattern, budgetM: number): number {
  const per = fastMeters(p) + recMeters(p);
  let n = clamp(Math.round((budgetM + recMeters(p)) / per), p.nMin, p.nMax);
  while (
    n > p.nFloor &&
    ((p.maxFastM !== undefined && n * fastMeters(p) > p.maxFastM) ||
      (p.maxFastSec !== undefined && n * fastSeconds(p) > p.maxFastSec))
  ) {
    n -= 1;
  }
  return n;
}

/**
 * Choisit la séance (la première de `choice.patterns` qui tient sous `maxHm` avec un
 * échauffement de 10 min et un retour au calme de 5 min) et son nombre de répétitions.
 */
export function prepareQuality(
  ctx: WorkoutContext,
  choice: QualityChoice,
  weekHm: number,
  maxHm: number,
): PreparedQuality {
  const minWuM = metersFor(MIN_WU_MIN * 60, ctx.paces.ef);
  const minCdM = metersFor(MIN_CD_MIN * 60, ctx.paces.recup);
  const nat = naturalWarmUp(choice.kind);
  // Échauffement + retour au calme « naturels », limités à 25 % de la semaine quand elle est légère.
  const natM = Math.max(
    minWuM + minCdM,
    Math.min(metersFor(nat.wu * 60, ctx.paces.ef) + metersFor(nat.cd * 60, ctx.paces.recup), weekHm * 100 * 0.25),
  );

  const minimalHm = (pattern: RepPattern, count: number): number =>
    Math.ceil((mainMeters(pattern, count) + minWuM + minCdM) / 100);
  const candidates = choice.patterns.map((pattern) => ({
    pattern,
    n: choice.kind === 'rappel' ? pattern.nMin : chooseReps(pattern, weekHm * 100 * choice.mainShare),
  }));
  // 1er passage : la première séance qui tient telle quelle ; 2e passage : moins de répétitions.
  let selected = candidates.find((c) => minimalHm(c.pattern, c.n) <= maxHm);
  if (!selected) {
    for (const candidate of candidates) {
      let n = candidate.n;
      while (n > candidate.pattern.nFloor && minimalHm(candidate.pattern, n) > maxHm) n -= 1;
      selected = { pattern: candidate.pattern, n };
      if (minimalHm(candidate.pattern, n) <= maxHm) break;
    }
  }
  if (!selected) throw new Error('aucune séance de qualité');

  const { pattern, n } = selected;
  const minHm = minimalHm(pattern, n);
  const mainM = mainMeters(pattern, n);
  return {
    choice,
    pattern,
    n,
    mainM,
    mainSec: mainSeconds(pattern, n),
    minHm,
    naturalHm: Math.round((mainM + natM) / 100),
  };
}

/** « 800 m », « 1 200 m », mais « 2 km » pour un multiple du kilomètre. */
function formatRepDistance(meters: number): string {
  const m = Math.round(meters);
  return m >= 1000 && m % 1000 === 0 ? `${m / 1000} km` : formatMeters(m);
}

/** Taille d'une répétition : distance si elle est définie en mètres, sinon durée. */
function repLabel(p: RepPattern): string {
  return 'm' in p.fast ? formatRepDistance(p.fast.m) : formatRepDuration(p.fast.sec);
}

function qualityTitle(ctx: WorkoutContext, p: RepPattern, n: number, kind: QualityKind): string {
  switch (p.family) {
    case 'fartlek':
      return `Fartlek : ${n} × ${formatRepDuration(fastSeconds(p))}`;
    case 'cotes':
      return `Côtes : ${n} × ${formatRepDuration(fastSeconds(p))}`;
    case 'intervalles':
      return `Fractionné : ${n} × ${formatMeters(fastMeters(p))}`;
    case 'seuil':
      return `Seuil : ${n} × ${formatRepDuration(fastSeconds(p))}`;
    case 'blocs': {
      const dist = repLabel(p);
      if (kind === 'rappel') return `Rappel d'${courseNoun(ctx)} : ${n === 1 ? dist : `${n} × ${dist}`}`;
      return n === 1 ? `Bloc de ${dist} à ${courseNoun(ctx)}` : `Blocs à ${courseNoun(ctx)} : ${n} × ${dist}`;
    }
  }
}

function qualityMainLines(ctx: WorkoutContext, p: RepPattern, n: number, kind: QualityKind): string[] {
  const fastPaceTxt = formatPace(p.fastPace.secPerKm);
  const recTxt = 'sec' in p.rec ? formatRepDuration(p.rec.sec) : formatRepDistance(p.rec.m);
  switch (p.family) {
    case 'fartlek':
      return [
        `${n} × ${formatRepDuration(fastSeconds(p))} rapide à ${fastPaceTxt} (${p.fastPace.label === 'Seuil' ? 'allure seuil' : 'allure 10 km'}), ${recTxt} ${p.recWhat} entre chaque accélération.`,
        'Sur les parties rapides : allure soutenue mais relâchée, sans sprinter. Sur le trot : laisse redescendre le souffle.',
      ];
    case 'cotes':
      return [
        `${n} × ${formatRepDuration(fastSeconds(p))} en montée : effort soutenu (comme sur un 10 km), buste droit, petits pas dynamiques, bras actifs.`,
        'Récupération : redescends en trottinant tranquillement jusqu\'au point de départ.',
        `Pas de côte près de chez toi ? Fais ces répétitions sur le plat à ${fastPaceTxt}, avec la même récupération.`,
      ];
    case 'intervalles':
      return [
        `${n} × ${formatMeters(fastMeters(p))} à ${fastPaceTxt} (allure 10 km), ${recTxt} ${p.recWhat} entre les répétitions.`,
        'Cours toutes les répétitions à la même allure. Si tu ralentis nettement, arrête la série : la qualité prime sur la quantité.',
      ];
    case 'seuil':
      return [
        `${n} × ${formatRepDuration(fastSeconds(p))} à ${fastPaceTxt} (allure seuil : soutenue mais contrôlée, tu peux encore dire quelques mots), ${recTxt} ${p.recWhat} entre les blocs.`,
      ];
    case 'blocs': {
      const dist = repLabel(p);
      const head =
        n === 1
          ? `${dist} à ${fastPaceTxt} (${courseNoun(ctx)}).`
          : `${n} × ${dist} à ${fastPaceTxt} (${courseNoun(ctx)}), ${recTxt} ${p.recWhat} entre les blocs.`;
      if (kind === 'rappel') return [head];
      return [head, 'Vise la régularité au kilomètre près : c\'est l\'allure de ton jour J, elle doit devenir naturelle.'];
    }
  }
}

function qualityPrep(p: RepPattern, kind: QualityKind): { line: string; minutes: number } | null {
  if (kind === 'rappel') return null;
  if (p.family === 'cotes') {
    return { line: 'Rejoins une côte régulière de 150 à 300 m (pente de 4 à 6 %).', minutes: 0 };
  }
  if (p.family === 'blocs') {
    return { line: 'Puis 2 accélérations progressives de 20 secondes.', minutes: 2 };
  }
  return {
    line: 'Puis 5 min de gammes (montées de genoux, talons-fesses, pas chassés) et 2 accélérations progressives.',
    minutes: 5,
  };
}

/** Rédige la séance de qualité pour une distance totale `hm` (≥ `prepared.minHm`). */
export function renderQuality(ctx: WorkoutContext, prepared: PreparedQuality, hm: number, dowIdx: number): DraftSession {
  const { choice, pattern: p, n, mainM, mainSec } = prepared;
  const totalHm = Math.max(hm, prepared.minHm);
  const restM = totalHm * 100 - mainM;
  const minWuM = metersFor(MIN_WU_MIN * 60, ctx.paces.ef);
  const minCdM = metersFor(MIN_CD_MIN * 60, ctx.paces.recup);
  let wuM = Math.max(minWuM, (restM * 2) / 3);
  let cdM = restM - wuM;
  if (cdM < minCdM) {
    cdM = minCdM;
    wuM = Math.max(minWuM, restM - cdM);
  }
  const wuMin = Math.max(MIN_WU_MIN, Math.round(secondsFor(wuM, ctx.paces.ef) / 60));
  const cdMin = Math.max(MIN_CD_MIN, Math.round(secondsFor(cdM, ctx.paces.recup) / 60));
  const prep = qualityPrep(p, choice.kind);

  const steps: string[] = [`Échauffement : ${wuMin} min en endurance fondamentale (${formatPace(ctx.paces.ef)}).`];
  if (prep) steps.push(prep.line);
  steps.push(...qualityMainLines(ctx, p, n, choice.kind));
  steps.push(`Retour au calme : ${cdMin} min de footing très lent (${formatPace(ctx.paces.recup)}).`);
  if (choice.kind === 'deload') steps.push('Semaine allégée : la séance est volontairement plus courte, garde de la fraîcheur.');
  if (choice.kind === 'taper') steps.push('Affûtage : séance courte, tu dois finir avec l\'envie d\'en faire plus.');
  if (choice.kind === 'rappel') steps.push('Juste un rappel de l\'allure : tu dois finir frais, avec l\'impression d\'en garder sous le pied.');

  return {
    dowIdx,
    type: 'qualite',
    title: qualityTitle(ctx, p, n, choice.kind),
    hm: totalHm,
    durationMin: Math.round(wuMin + (prep?.minutes ?? 0) + mainSec / 60 + cdMin),
    paces: uniquePaces([efPace(ctx), p.fastPace, p.recPace, recupPace(ctx)]),
    steps,
  };
}

/* ------------------------------------------------------------------ */
/* Sortie longue                                                      */
/* ------------------------------------------------------------------ */

export interface LongRunOptions {
  phase: Phase;
  deload: boolean;
  /** Rang de la semaine chargée dans le spécifique (0, 1, 2…), sinon null. */
  specificRank: number | null;
}

function fuelingSteps(durationMin: number): string[] {
  const steps: string[] = [];
  if (durationMin >= 75) steps.push('Emporte de l\'eau et bois quelques gorgées toutes les 15 à 20 minutes.');
  if (durationMin >= 100) {
    steps.push('Teste ton ravitaillement du jour J : un gel ou une pâte de fruits toutes les 40 minutes environ.');
  }
  return steps;
}

/** La sortie longue de cette semaine contient-elle des blocs (marathon) ou un final (semi) à allure course ? */
export function longRunHasRacePace(ctx: WorkoutContext, hm: number, opts: LongRunOptions): boolean {
  const withRacePace = opts.phase === 'specifique' && !opts.deload && opts.specificRank !== null && opts.specificRank % 2 === 0;
  return withRacePace && hm >= (ctx.race === 'marathon' ? 160 : 100);
}

export function renderLongRun(ctx: WorkoutContext, hm: number, dowIdx: number, opts: LongRunOptions): DraftSession {
  const ef = efPace(ctx);
  const course = coursePace(ctx);
  const withRacePace = longRunHasRacePace(ctx, hm, opts);

  if (withRacePace && ctx.race === 'marathon') {
    const blockHm = hm >= 240 ? 50 : hm >= 190 ? 40 : 30;
    const blocks = 2;
    const recHm = 10;
    const efHm = hm - blocks * blockHm - recHm;
    const firstHm = Math.round(efHm * 0.6);
    const lastHm = efHm - firstHm;
    const durationSec =
      secondsFor((efHm + recHm) * 100, ctx.paces.ef) + secondsFor(blocks * blockHm * 100, ctx.paces.allure_course);
    const durationMin = Math.round(durationSec / 60);
    return {
      dowIdx,
      type: 'sl',
      title: 'Sortie longue avec allure marathon',
      hm,
      durationMin,
      paces: [ef, course],
      steps: [
        `Commence par ${formatHm(firstHm)} en endurance fondamentale (${formatPace(ef.secPerKm)}).`,
        `Enchaîne ${blocks} × ${formatHm(blockHm)} à ${formatPace(course.secPerKm)} (allure marathon), avec ${formatHm(recHm)} en endurance fondamentale entre les deux.`,
        `Termine par ${formatHm(lastHm)} en endurance fondamentale, sans accélérer.`,
        'Comme une répétition du jour J : teste ta tenue, tes chaussures et ton ravitaillement de course.',
        ...fuelingSteps(durationMin),
      ],
    };
  }

  if (withRacePace && ctx.race === 'semi') {
    const finishHm = hm >= 150 ? 40 : 30;
    const efHm = hm - finishHm;
    const durationMin = Math.round(
      (secondsFor(efHm * 100, ctx.paces.ef) + secondsFor(finishHm * 100, ctx.paces.allure_course)) / 60,
    );
    return {
      dowIdx,
      type: 'sl',
      title: 'Sortie longue avec final à allure semi',
      hm,
      durationMin,
      paces: [ef, course],
      steps: [
        `${formatHm(efHm)} en endurance fondamentale (${formatPace(ef.secPerKm)}).`,
        `Puis ${formatHm(finishHm)} à ${formatPace(course.secPerKm)} (allure semi) pour finir : régulier, sans t'emballer.`,
        'Teste ta tenue et tes chaussures du jour J.',
        ...fuelingSteps(durationMin),
      ],
    };
  }

  const durationMin = minutesForHm(hm, ctx.paces.ef);
  const steps = [
    runLine(hm, ef, 'en endurance fondamentale'),
    'Pars très tranquillement : les 2 premiers kilomètres servent d\'échauffement.',
    'Reste en aisance respiratoire du début à la fin : tu dois pouvoir parler.',
  ];
  if (opts.phase === 'base' && !opts.deload) steps.push('Un parcours vallonné est le bienvenu, sans chercher la vitesse dans les montées.');
  if (opts.deload) steps.push('Semaine allégée : sortie raccourcie pour récupérer.');
  steps.push(...fuelingSteps(durationMin));
  return { dowIdx, type: 'sl', title: 'Sortie longue', hm, durationMin, paces: [ef], steps };
}

/* ------------------------------------------------------------------ */
/* Footings et renforcement                                           */
/* ------------------------------------------------------------------ */

function strideCount(phase: Phase, deload: boolean): number {
  if (deload || phase === 'affutage') return 4;
  if (phase === 'developpement') return 6;
  return phase === 'specifique' ? 5 : 4;
}

function strengthExercises(phase: Phase, short: boolean): string[] {
  const full =
    phase === 'base'
      ? [
          'Gainage ventral (planche sur les avant-bras) : 3 × 30 s',
          'Gainage latéral : 2 × 20 s de chaque côté',
          'Squats : 3 × 12',
          'Fentes avant : 2 × 10 par jambe',
          'Montées sur la pointe des pieds (mollets) : 3 × 15',
          'Pont fessier : 3 × 12',
        ]
      : phase === 'affutage'
        ? [
            'Gainage ventral : 2 × 30 s',
            'Gainage latéral : 2 × 20 s de chaque côté',
            'Montées sur la pointe des pieds : 2 × 15',
            'Mobilité des hanches et des chevilles : 5 min',
          ]
        : [
            'Gainage ventral : 3 × 45 s',
            'Gainage latéral : 3 × 30 s de chaque côté',
            'Squats : 3 × 15',
            'Fentes arrière : 3 × 10 par jambe',
            'Mollets sur une marche, descente lente : 3 × 12',
            'Pont fessier sur une jambe : 3 × 10 par jambe',
          ];
  return short ? full.slice(0, 4) : full;
}

export interface EasyRunOptions {
  phase: Phase;
  deload: boolean;
}

export function renderEasyRun(
  ctx: WorkoutContext,
  role: 'ef_main' | 'ef_mid' | 'ef_short',
  hm: number,
  dowIdx: number,
  opts: EasyRunOptions,
): DraftSession {
  const ef = efPace(ctx);
  const runMin = minutesForHm(hm, ctx.paces.ef);
  if (role === 'ef_main') {
    const strides = strideCount(opts.phase, opts.deload);
    return {
      dowIdx,
      type: 'ef',
      title: 'Footing + lignes droites',
      hm,
      durationMin: runMin + 3,
      paces: [ef],
      steps: [
        runLine(hm, ef, 'en endurance fondamentale'),
        `Termine par ${strides} lignes droites d'environ 80 m : accélère progressivement jusqu'à une allure rapide mais relâchée, puis reviens en marchant.`,
      ],
    };
  }
  if (role === 'ef_mid') {
    return {
      dowIdx,
      type: 'ef',
      title: 'Footing en endurance fondamentale',
      hm,
      durationMin: runMin,
      paces: [ef],
      steps: [
        runLine(hm, ef, 'en endurance fondamentale'),
        'Allure vraiment facile : demain, séance de qualité.',
      ],
    };
  }
  const steps = [runLine(hm, ef, 'de footing très facile')];
  if (dowIdx === SUN && ctx.longRunDay === 'sat') {
    steps.push('C\'est le lendemain de ta sortie longue : cours lentement, juste pour délier les jambes.');
  }
  steps.push('Puis 15 min de renforcement :', ...strengthExercises(opts.phase, true));
  return {
    dowIdx,
    type: 'ef',
    title: 'Footing court + renforcement',
    hm,
    durationMin: runMin + 15,
    paces: [ef],
    steps,
  };
}

export function renderStrength(dowIdx: number, phase: Phase): DraftSession {
  return {
    dowIdx,
    type: 'renfo',
    title: 'Renforcement musculaire',
    hm: 0,
    durationMin: 25,
    paces: [],
    steps: [
      'Échauffe-toi 5 min : marche rapide, rotations des chevilles, des genoux et des hanches.',
      ...strengthExercises(phase, false),
      'Arrête-toi si une douleur apparaît : le renforcement ne doit jamais faire mal.',
      'Ton volume est encore léger : cette séance remplace un footing pour renforcer tes appuis sans surcharger tes jambes.',
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Semaine de course                                                  */
/* ------------------------------------------------------------------ */

export type RaceWeekRole = 'rw_footing' | 'rw_rappel' | 'rw_recup' | 'rw_activation';

export function renderRaceWeekRun(
  ctx: WorkoutContext,
  role: Exclude<RaceWeekRole, 'rw_rappel'>,
  hm: number,
  dowIdx: number,
  daysBeforeRace: number,
  extraStep?: string,
): DraftSession {
  const ef = efPace(ctx);
  const recup = recupPace(ctx);
  const extra = extraStep ? [extraStep] : [];
  if (role === 'rw_footing') {
    return {
      dowIdx,
      type: 'ef',
      title: 'Footing + lignes droites',
      hm,
      durationMin: minutesForHm(hm, ef.secPerKm) + 3,
      paces: [ef],
      steps: [
        runLine(hm, ef, 'en endurance fondamentale'),
        'Termine par 4 lignes droites d\'environ 80 m, relâché, retour en marchant.',
        ...extra,
      ],
    };
  }
  if (role === 'rw_recup') {
    return {
      dowIdx,
      type: 'recup',
      title: 'Footing très facile',
      hm,
      durationMin: minutesForHm(hm, recup.secPerKm),
      paces: [recup],
      steps: [runLine(hm, recup, 'en récupération'), 'Aucune intensité : on fait juste tourner les jambes.', ...extra],
    };
  }
  const steps = [
    runLine(hm, ef, 'de footing très facile'),
    'Termine par 3 accélérations progressives de 15 secondes, sans forcer.',
  ];
  if (daysBeforeRace === 1) {
    steps.push('Prépare tes affaires ce soir (dossard, épingles, tenue, ravitaillement) et couche-toi tôt.');
  } else {
    steps.push('Demain, repos complet : hydrate-toi bien et prépare tes affaires de course.');
  }
  steps.push(...extra);
  return {
    dowIdx,
    type: 'ef',
    title: 'Footing d\'activation',
    hm,
    durationMin: minutesForHm(hm, ef.secPerKm) + 2,
    paces: [ef],
    steps,
  };
}

export function renderRaceDay(ctx: WorkoutContext, dowIdx: number): DraftSession {
  const km = RACE_SESSION_KM[ctx.race];
  const pace = ctx.paces.allure_course;
  const targetSec = km * pace;
  const paceTxt = formatPace(pace);
  const name = ctx.raceName ?? (ctx.race === 'marathon' ? 'ton marathon' : 'ton semi-marathon');
  const steps =
    ctx.race === 'marathon'
      ? [
          'Échauffement léger : 10 min de marche active et de mobilité, quelques foulées de trot avant le départ.',
          `Pars à ${paceTxt} (allure marathon) sans te laisser emporter par l'ambiance : les 10 premiers kilomètres doivent te sembler faciles.`,
          'Bois un peu à chaque ravitaillement et prends un gel toutes les 40 à 45 minutes, comme à l\'entraînement.',
          `Temps visé : environ ${formatRaceTime(targetSec)}. Si les jambes répondent encore après le 30e kilomètre, tu peux accélérer.`,
          'Après l\'arrivée : continue de marcher, bois, mange et savoure. Bravo !',
        ]
      : [
          'Échauffement : 10 à 15 min de footing très facile, puis 2 ou 3 accélérations progressives.',
          `Pars à ${paceTxt} (allure semi) : les 5 premiers kilomètres doivent rester maîtrisés.`,
          'Bois quelques gorgées aux ravitaillements ; prends un gel vers le 12e kilomètre si tu en as l\'habitude.',
          `Temps visé : environ ${formatRaceTime(targetSec)}. Accélère sur les 3 derniers kilomètres si tu te sens bien.`,
          'Après l\'arrivée : marche, hydrate-toi et savoure. Bravo !',
        ];
  return {
    dowIdx,
    type: 'course',
    title: `Jour J : ${name}`,
    hm: Math.round(km * 10),
    exactKm: km,
    durationMin: Math.round(targetSec / 60),
    paces: [coursePace(ctx)],
    steps,
  };
}
