/**
 * Validation stricte d'une `PlanInput` (SPEC section 2). Les messages sont en français,
 * affichables tels quels. Les clés inconnues sont ignorées (et non recopiées).
 */
import {
  DATE_YEAR_MAX,
  DATE_YEAR_MIN,
  LEVEL_LABEL,
  RACE_NAME_MAX_LENGTH,
  T10_MAX_SEC,
  T10_MIN_SEC,
  WEEKLY_KM_MAX,
  WEEKLY_KM_MIN,
} from './constants';
import { isPlausibleIsoDate, parseIsoDate } from './dates';
import { frenchTypography } from './format';
import type { Level, PlanInput, RaceKind, ValidationResult } from './types';

const RACES: readonly RaceKind[] = ['marathon', 'semi'];
const LEVELS: readonly Level[] = ['finisher', 'l2', 'l3'];
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f-\u009f]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function levelMessage(race: RaceKind | undefined): string {
  if (race) {
    const labels = LEVEL_LABEL[race];
    return `Choisis un niveau : ${labels.finisher}, ${labels.l2} ou ${labels.l3}.`;
  }
  return 'Choisis un niveau : Finisher, l2 ou l3.';
}

function checkDate(value: unknown, missing: string, invalid: string, errors: string[]): string | undefined {
  if (isMissing(value)) {
    errors.push(missing);
    return undefined;
  }
  if (typeof value !== 'string' || parseIsoDate(value) === null) {
    errors.push(invalid);
    return undefined;
  }
  if (!isPlausibleIsoDate(value)) {
    errors.push(`${invalid.replace(/\.$/, '')}, entre ${DATE_YEAR_MIN} et ${DATE_YEAR_MAX}.`);
    return undefined;
  }
  return value;
}

export function validateInput(input: unknown): ValidationResult {
  if (!isRecord(input)) {
    return { ok: false, errors: [frenchTypography('Les paramètres du plan sont manquants ou illisibles.')] };
  }
  const errors: string[] = [];

  // Course
  let race: RaceKind | undefined;
  if (isMissing(input.race)) {
    errors.push('Choisis ta course : marathon ou semi-marathon.');
  } else if (typeof input.race === 'string' && (RACES as readonly string[]).includes(input.race)) {
    race = input.race as RaceKind;
  } else {
    errors.push('La course doit être « marathon » ou « semi ».');
  }

  // Date de course
  const raceDate = checkDate(
    input.raceDate,
    'Indique la date de ta course.',
    'La date de course doit être une date valide au format AAAA-MM-JJ.',
    errors,
  );

  // Nom de la course (facultatif)
  let raceName: string | undefined;
  if (!isMissing(input.raceName)) {
    if (typeof input.raceName !== 'string') {
      errors.push('Le nom de la course doit être un texte.');
    } else if (CONTROL_CHARS_RE.test(input.raceName)) {
      errors.push('Le nom de la course contient des caractères non autorisés.');
    } else {
      const cleaned = input.raceName.trim().replace(/\s+/g, ' ');
      if (cleaned.length > RACE_NAME_MAX_LENGTH) {
        errors.push(`Le nom de la course ne doit pas dépasser ${RACE_NAME_MAX_LENGTH} caractères.`);
      } else if (cleaned.length > 0) {
        raceName = cleaned;
      }
    }
  }

  // Niveau
  let level: Level | undefined;
  if (typeof input.level === 'string' && (LEVELS as readonly string[]).includes(input.level)) {
    level = input.level as Level;
  } else {
    errors.push(levelMessage(race));
  }

  // Temps sur 10 km
  let t10: number | undefined;
  if (isMissing(input.t10)) {
    errors.push('Indique ton temps actuel sur 10 km.');
  } else if (!isFiniteNumber(input.t10) || input.t10 < T10_MIN_SEC || input.t10 > T10_MAX_SEC) {
    errors.push(
      `Ton temps sur 10 km doit être compris entre 30 min et 1 h 30 (de ${T10_MIN_SEC} à ${T10_MAX_SEC} secondes).`,
    );
  } else {
    t10 = Math.round(input.t10);
  }

  // Volume actuel
  let weeklyKm: number | undefined;
  if (isMissing(input.weeklyKm)) {
    errors.push('Indique combien de kilomètres tu cours par semaine en ce moment.');
  } else if (!isFiniteNumber(input.weeklyKm) || input.weeklyKm < WEEKLY_KM_MIN || input.weeklyKm > WEEKLY_KM_MAX) {
    errors.push(`Ton volume actuel doit être compris entre ${WEEKLY_KM_MIN} et ${WEEKLY_KM_MAX} km par semaine.`);
  } else {
    weeklyKm = input.weeklyKm;
  }

  // Séances par semaine
  let sessions: PlanInput['sessions'] | undefined;
  if (input.sessions === 3 || input.sessions === 4 || input.sessions === 5) {
    sessions = input.sessions;
  } else {
    errors.push('Choisis 3, 4 ou 5 séances par semaine.');
  }

  // Jour de la sortie longue
  let longRunDay: PlanInput['longRunDay'] | undefined;
  if (input.longRunDay === 'sat' || input.longRunDay === 'sun') {
    longRunDay = input.longRunDay;
  } else {
    errors.push('Choisis le jour de ta sortie longue : samedi ou dimanche.');
  }

  // Date de début (facultative)
  let startDate: string | undefined;
  if (!isMissing(input.startDate)) {
    startDate = checkDate(
      input.startDate,
      '',
      'La date de début doit être une date valide au format AAAA-MM-JJ.',
      errors,
    );
  }

  if (raceDate !== undefined && startDate !== undefined && startDate > raceDate) {
    errors.push('La date de début doit précéder la date de course.');
  }

  if (
    errors.length > 0 ||
    race === undefined ||
    raceDate === undefined ||
    level === undefined ||
    t10 === undefined ||
    weeklyKm === undefined ||
    sessions === undefined ||
    longRunDay === undefined
  ) {
    return { ok: false, errors: errors.map(frenchTypography) };
  }

  // Ordre canonique des clés (celui de PlanInput), champs facultatifs omis s'ils sont vides.
  const normalized: PlanInput = {
    race,
    raceDate,
    ...(raceName !== undefined ? { raceName } : {}),
    level,
    t10,
    weeklyKm,
    sessions,
    longRunDay,
    ...(startDate !== undefined ? { startDate } : {}),
  };
  return { ok: true, input: normalized };
}
