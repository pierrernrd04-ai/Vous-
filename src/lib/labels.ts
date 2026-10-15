/**
 * Libellés en français des valeurs du plan (phases, types de séance, niveaux…)
 * et préréglages des deux courses cibles. Client-safe, sans DOM.
 */
import { KEY_DATES } from '../config';
import type { Dow, Level, PaceKey, Phase, RaceKind, SessionType } from '../shared/api-types';

export const RACE_LABELS: Record<RaceKind, string> = {
  marathon: 'Marathon',
  semi: 'Semi-marathon',
};

/** Distance officielle, en km. */
export const RACE_DISTANCE_KM: Record<RaceKind, number> = {
  marathon: 42.195,
  semi: 21.0975,
};

export interface RacePreset {
  race: RaceKind;
  /** Date de la course, ISO. */
  date: string;
  /** Nom par défaut de la course. */
  name: string;
  /** Durée du plan démarré le lundi 19/10/2026. */
  weeks: number;
}

/** Les deux courses parisiennes visées par le pass (SPEC section 1). */
export const RACE_PRESETS: Record<RaceKind, RacePreset> = {
  marathon: { race: 'marathon', date: KEY_DATES.marathon, name: 'Marathon de Paris', weeks: 24 },
  semi: { race: 'semi', date: KEY_DATES.semi, name: 'Semi de Paris', weeks: 20 },
};

export const PHASE_LABELS: Record<Phase, string> = {
  base: 'Base',
  developpement: 'Développement',
  specifique: 'Spécifique',
  affutage: 'Affûtage',
};

export const PHASE_DESCRIPTIONS: Record<Phase, string> = {
  base: 'Endurance, régularité et premières accélérations.',
  developpement: 'Le volume monte, le fractionné aussi.',
  specifique: 'Blocs à allure course et sorties longues les plus longues.',
  affutage: 'Le volume baisse : tu arrives frais le jour J.',
};

export const PHASE_ORDER: readonly Phase[] = ['base', 'developpement', 'specifique', 'affutage'];

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  ef: 'Endurance',
  qualite: 'Qualité',
  sl: 'Sortie longue',
  recup: 'Récupération',
  course: 'Jour J',
  renfo: 'Renforcement',
};

export const DOW_LABELS: Record<Dow, string> = {
  mon: 'lundi',
  tue: 'mardi',
  wed: 'mercredi',
  thu: 'jeudi',
  fri: 'vendredi',
  sat: 'samedi',
  sun: 'dimanche',
};

export const PACE_LABELS: Record<PaceKey, string> = {
  ef: 'Endurance fondamentale',
  recup: 'Récupération',
  seuil: 'Seuil',
  as10: 'Allure 10 km',
  allure_course: 'Allure course',
};

export const PACE_ORDER: readonly PaceKey[] = ['recup', 'ef', 'allure_course', 'seuil', 'as10'];

const LEVEL_LABELS: Record<RaceKind, Record<Level, { label: string; hint: string }>> = {
  marathon: {
    finisher: { label: 'Finisher', hint: 'Terminer en forme, sans viser un chrono' },
    l2: { label: 'Moins de 4 h 30', hint: 'Environ 6:24/km' },
    l3: { label: 'Moins de 4 h', hint: 'Environ 5:41/km' },
  },
  semi: {
    finisher: { label: 'Finisher', hint: 'Terminer en forme, sans viser un chrono' },
    l2: { label: 'Moins de 2 h', hint: 'Environ 5:41/km' },
    l3: { label: 'Moins de 1 h 45', hint: 'Environ 4:59/km' },
  },
};

export const LEVELS: readonly Level[] = ['finisher', 'l2', 'l3'];

export function levelLabel(race: RaceKind, level: Level): string {
  return LEVEL_LABELS[race][level].label;
}

export function levelHint(race: RaceKind, level: Level): string {
  return LEVEL_LABELS[race][level].hint;
}

export function isRaceKind(value: unknown): value is RaceKind {
  return value === 'marathon' || value === 'semi';
}

export function isLevel(value: unknown): value is Level {
  return value === 'finisher' || value === 'l2' || value === 'l3';
}
