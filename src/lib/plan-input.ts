/**
 * Valeurs du formulaire de plan (page gratuite et réglages du plan) : défauts,
 * conversion vers `PlanInput`, validation côté client (messages en français),
 * lecture des paramètres d'URL. Fonctions pures, sans DOM.
 *
 * La validation de référence reste celle du serveur (`/api/preview`, `/api/plan`) ;
 * celle-ci sert à guider la saisie sans aller-retour réseau.
 */
import type { Level, PlanInput, RaceKind } from '../shared/api-types';
import { daysBetween, localTodayIso, parseIsoDate } from './format';
import { RACE_PRESETS, isLevel, isRaceKind } from './labels';
import { isRecord } from './storage';

export type RaceChoice = RaceKind | 'autre';

export interface PlanFormValues {
  /** Course parisienne préréglée, ou « autre » (date libre). */
  preset: RaceChoice;
  /** Distance (pour « autre ») ; égale au préréglage sinon. */
  race: RaceKind;
  /** Date de la course pour « autre », ISO. */
  raceDate: string;
  /** Nom de la course pour « autre » (facultatif). */
  raceName: string;
  level: Level;
  /** Temps sur 10 km, en secondes. */
  t10: number;
  weeklyKm: number;
  sessions: 3 | 4 | 5;
  longRunDay: 'sat' | 'sun';
  /**
   * Lundi de départ mémorisé (plan complet uniquement). Le moteur démarre le plan
   * au premier lundi à partir de `startDate`, sinon à partir d'aujourd'hui : sans
   * cette date, le même réglage donnerait un plan décalé la semaine suivante.
   * Le formulaire ne la saisit pas ; /plan/ la fixe à `weeks[0].start`.
   */
  startDate?: string;
}

export const T10_MIN_SEC = 1800;
export const T10_MAX_SEC = 5400;
export const WEEKLY_KM_MIN = 0;
export const WEEKLY_KM_MAX = 120;
export const MIN_PLAN_WEEKS = 8;
export const MAX_DAYS_AHEAD = 548; // ~18 mois
export const RACE_NAME_MAX = 80;

export const DEFAULT_VALUES: Readonly<PlanFormValues> = Object.freeze({
  preset: 'marathon',
  race: 'marathon',
  raceDate: RACE_PRESETS.marathon.date,
  raceName: '',
  level: 'finisher',
  t10: 3300,
  weeklyKm: 20,
  sessions: 4,
  longRunDay: 'sun',
});

export type FieldName = 'preset' | 'raceDate' | 'raceName' | 't10' | 'weeklyKm';
export type FieldErrors = Partial<Record<FieldName, string>>;

function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, RACE_NAME_MAX);
}

/** Valeurs du formulaire → entrée de l'API (`startDate` transmise si elle est valide). */
export function valuesToInput(values: PlanFormValues): PlanInput {
  let input: PlanInput;
  if (values.preset !== 'autre') {
    const preset = RACE_PRESETS[values.preset];
    input = {
      race: preset.race,
      raceDate: preset.date,
      raceName: preset.name,
      level: values.level,
      t10: Math.round(values.t10),
      weeklyKm: Math.round(values.weeklyKm),
      sessions: values.sessions,
      longRunDay: values.longRunDay,
    };
  } else {
    input = {
      race: values.race,
      raceDate: values.raceDate,
      level: values.level,
      t10: Math.round(values.t10),
      weeklyKm: Math.round(values.weeklyKm),
      sessions: values.sessions,
      longRunDay: values.longRunDay,
    };
    const name = cleanName(values.raceName);
    if (name) input.raceName = name;
  }
  if (values.startDate && parseIsoDate(values.startDate)) input.startDate = values.startDate;
  return input;
}

/* ---------------- Date de départ du plan complet ---------------- */

/** Copie des valeurs avec `startDate` posée (si valide) ou retirée. */
export function withStartDate(values: PlanFormValues, startDate: string | null | undefined): PlanFormValues {
  const next: PlanFormValues = { ...values };
  if (startDate && parseIsoDate(startDate)) next.startDate = startDate;
  else delete next.startDate;
  return next;
}

/** Même course (préréglage, distance et date) : le calendrier du plan est inchangé. */
export function sameRace(a: PlanFormValues, b: PlanFormValues): boolean {
  return a.preset === b.preset && a.race === b.race && effectiveRaceDate(a) === effectiveRaceDate(b);
}

/**
 * Date de départ à garder quand les réglages du plan changent :
 * - même course : la date mémorisée est conservée, le calendrier ne bouge pas ;
 * - autre course alors que le plan a déjà commencé : conservée aussi (les semaines
 *   passées et les cases « fait » restent à leur place) ;
 * - autre course avant le début du plan : oubliée, le nouveau plan part du prochain lundi.
 */
export function carryStartDate(next: PlanFormValues, previous: PlanFormValues | null, today: string): PlanFormValues {
  const anchor = previous?.startDate;
  if (!previous || !anchor || !parseIsoDate(anchor)) return withStartDate(next, null);
  if (sameRace(next, previous)) return withStartDate(next, anchor);
  return withStartDate(next, anchor <= today ? anchor : null);
}

/**
 * Date à partir de laquelle se mesurent les 8 semaines minimales : la date de départ
 * mémorisée si le plan a déjà commencé (changer d'objectif en cours de prépa reste
 * possible), sinon aujourd'hui.
 */
export function planReferenceDate(today: string, startDate?: string | null): string {
  return startDate && parseIsoDate(startDate) && startDate < today ? startDate : today;
}

/** Entrée (même partielle) → valeurs du formulaire. */
export function inputToValues(input: Partial<PlanInput>, base: PlanFormValues = DEFAULT_VALUES): PlanFormValues {
  const race = isRaceKind(input.race) ? input.race : base.race;
  const values: PlanFormValues = { ...base, race };
  if (isLevel(input.level)) values.level = input.level;
  if (typeof input.t10 === 'number' && Number.isFinite(input.t10)) values.t10 = input.t10;
  if (typeof input.weeklyKm === 'number' && Number.isFinite(input.weeklyKm)) values.weeklyKm = input.weeklyKm;
  if (input.sessions === 3 || input.sessions === 4 || input.sessions === 5) values.sessions = input.sessions;
  if (input.longRunDay === 'sat' || input.longRunDay === 'sun') values.longRunDay = input.longRunDay;

  const date = typeof input.raceDate === 'string' && parseIsoDate(input.raceDate) ? input.raceDate : null;
  const name = typeof input.raceName === 'string' ? cleanName(input.raceName) : '';
  if (date === null) {
    if (isRaceKind(input.race)) {
      values.preset = race;
      values.raceDate = RACE_PRESETS[race].date;
    }
    return values;
  }
  const preset = RACE_PRESETS[race];
  if (date === preset.date && (name === '' || name === preset.name)) {
    values.preset = race;
    values.raceDate = preset.date;
    values.raceName = '';
  } else {
    values.preset = 'autre';
    values.raceDate = date;
    values.raceName = name;
  }
  return values;
}

/**
 * Préremplissage depuis l'URL : `race` (marathon|semi), `date` (yyyy-mm-dd),
 * `name`, et en bonus `level`. Les valeurs invalides sont ignorées.
 */
export function valuesFromQuery(params: URLSearchParams, base: PlanFormValues = DEFAULT_VALUES): PlanFormValues {
  const rawRace = (params.get('race') ?? '').trim().toLowerCase();
  const race: RaceKind | undefined =
    rawRace === 'marathon' ? 'marathon' : rawRace === 'semi' || rawRace === 'semi-marathon' ? 'semi' : undefined;
  const date = (params.get('date') ?? '').trim();
  const name = params.get('name') ?? '';
  const level = params.get('level') ?? '';
  const partial: Partial<PlanInput> = {};
  if (race) partial.race = race;
  if (parseIsoDate(date)) partial.raceDate = date;
  if (name.trim()) partial.raceName = name;
  if (isLevel(level)) partial.level = level;
  if (!race && !partial.raceDate) return isLevel(level) ? { ...base, level } : { ...base };
  if (!race && partial.raceDate) partial.race = base.race;
  return inputToValues(partial, base);
}

/** Vrai si l'URL contient au moins un paramètre de préremplissage. */
export function hasPrefillParams(params: URLSearchParams): boolean {
  return ['race', 'date', 'name', 'level'].some((key) => params.has(key));
}

/** Date de course effective (préréglage ou date libre). */
export function effectiveRaceDate(values: PlanFormValues): string {
  return values.preset === 'autre' ? values.raceDate : RACE_PRESETS[values.preset].date;
}

/**
 * Validation de saisie ; objet vide si tout est bon. Les 8 semaines minimales se
 * comptent depuis `planReferenceDate` (date de départ mémorisée d'un plan commencé).
 */
export function validateValues(values: PlanFormValues, today: string = localTodayIso()): FieldErrors {
  const errors: FieldErrors = {};

  if (!Number.isFinite(values.t10) || values.t10 < T10_MIN_SEC || values.t10 > T10_MAX_SEC) {
    errors.t10 = 'Indique un temps sur 10 km entre 30 min et 1 h 30.';
  }
  if (
    !Number.isFinite(values.weeklyKm) ||
    !Number.isInteger(values.weeklyKm) ||
    values.weeklyKm < WEEKLY_KM_MIN ||
    values.weeklyKm > WEEKLY_KM_MAX
  ) {
    errors.weeklyKm = `Indique un nombre entier de kilomètres entre ${WEEKLY_KM_MIN} et ${WEEKLY_KM_MAX}.`;
  }

  const raceDate = effectiveRaceDate(values);
  if (values.preset === 'autre') {
    if (!parseIsoDate(values.raceDate)) {
      errors.raceDate = 'Indique la date de ta course.';
    }
    if (cleanName(values.raceName).length !== values.raceName.replace(/\s+/g, ' ').trim().length) {
      errors.raceName = `Le nom de la course doit faire au plus ${RACE_NAME_MAX} caractères.`;
    }
  }
  if (!errors.raceDate && parseIsoDate(raceDate)) {
    const days = daysBetween(planReferenceDate(today, values.startDate), raceDate);
    const field: FieldName = values.preset === 'autre' ? 'raceDate' : 'preset';
    if (days < MIN_PLAN_WEEKS * 7) {
      errors[field] =
        values.preset === 'autre'
          ? 'Ta course est dans moins de 8 semaines : c’est trop court pour un plan complet. Choisis une date plus lointaine.'
          : 'Cette course est dans moins de 8 semaines : c’est trop court pour un plan complet. Choisis « Autre course ».';
    } else if (days > MAX_DAYS_AHEAD) {
      errors[field] = 'Choisis une course dans les 18 prochains mois.';
    }
  }
  return errors;
}

/** Garde de type pour des valeurs relues depuis le stockage local. */
export function isPlanFormValues(v: unknown): v is PlanFormValues {
  return (
    isRecord(v) &&
    (v.preset === 'marathon' || v.preset === 'semi' || v.preset === 'autre') &&
    isRaceKind(v.race) &&
    typeof v.raceDate === 'string' &&
    typeof v.raceName === 'string' &&
    isLevel(v.level) &&
    typeof v.t10 === 'number' &&
    typeof v.weeklyKm === 'number' &&
    (v.sessions === 3 || v.sessions === 4 || v.sessions === 5) &&
    (v.longRunDay === 'sat' || v.longRunDay === 'sun') &&
    (v.startDate === undefined || (typeof v.startDate === 'string' && parseIsoDate(v.startDate) !== null))
  );
}
