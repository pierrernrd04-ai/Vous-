/**
 * Constantes du moteur de plan, reprises telles quelles de la SPEC (section 2).
 * Toute valeur « inventée » (non écrite dans la SPEC) est signalée comme telle.
 */
import type { Level, Phase, RaceKind } from './types';

/* ---------------------------- Entrées ---------------------------- */

export const T10_MIN_SEC = 1800;
export const T10_MAX_SEC = 5400;
export const WEEKLY_KM_MIN = 0;
export const WEEKLY_KM_MAX = 120;
export const RACE_NAME_MAX_LENGTH = 80;
/** Garde-fou sur les dates (choix du moteur) : années plausibles. */
export const DATE_YEAR_MIN = 2000;
export const DATE_YEAR_MAX = 2100;

/* ---------------------------- Allures ---------------------------- */

export const RIEGEL_EXPONENT = 1.06;
/** Distances utilisées pour la prédiction de Riegel (km). */
export const RIEGEL_DISTANCE_KM: Readonly<Record<RaceKind, number>> = {
  marathon: 42.195,
  semi: 21.0975,
};
/** Distance officielle affichée pour la séance `course` (km). */
export const RACE_SESSION_KM: Readonly<Record<RaceKind, number>> = {
  marathon: 42.195,
  semi: 21.1,
};
/** Finisher : +5 % de marge sur l'allure course prédite. */
export const FINISHER_MARGIN = 1.05;
/** Objectif accepté s'il n'est pas plus rapide que la prédiction améliorée de 3 %. */
export const GOAL_TOLERANCE = 0.03;
export const EF_FACTOR = 1.2;
export const RECUP_FACTOR = 1.08;
export const SEUIL_FACTOR = 1.06;

/** Objectif chiffré des niveaux l2 / l3 (secondes). */
export const LEVEL_GOAL_SEC: Readonly<Record<RaceKind, Readonly<Record<Exclude<Level, 'finisher'>, number>>>> = {
  marathon: { l2: 4 * 3600 + 30 * 60, l3: 4 * 3600 },
  semi: { l2: 2 * 3600, l3: 3600 + 45 * 60 },
};

export const LEVEL_LABEL: Readonly<Record<RaceKind, Readonly<Record<Level, string>>>> = {
  marathon: { finisher: 'Finisher', l2: 'sub-4h30', l3: 'sub-4h' },
  semi: { finisher: 'Finisher', l2: 'sub-2h', l3: 'sub-1h45' },
};

/* ---------------------------- Volumes ---------------------------- */

/** Volume au pic (km / semaine). */
export const PEAK_KM: Readonly<Record<RaceKind, Readonly<Record<Level, number>>>> = {
  marathon: { finisher: 48, l2: 58, l3: 68 },
  semi: { finisher: 33, l2: 42, l3: 50 },
};

/** Sortie longue maximale (km). */
export const LONG_RUN_MAX_KM: Readonly<Record<RaceKind, Readonly<Record<Level, number>>>> = {
  marathon: { finisher: 28, l2: 30, l3: 32 },
  semi: { finisher: 16, l2: 18, l3: 20 },
};

/**
 * Choix du moteur (sécurité, en plus des plafonds en km de la SPEC) : une sortie longue
 * ne dépasse pas 3 h à l'allure d'endurance fondamentale.
 */
export const LONG_RUN_MAX_MINUTES = 180;

/** Part maximale de la sortie longue dans le volume hebdomadaire. */
export const LONG_RUN_SHARE = 0.35;
/** Exception : 3 dernières sorties longues du spécifique marathon. */
export const LONG_RUN_SHARE_MARATHON_SPECIFIC = 0.45;
export const LONG_RUN_SPECIFIC_COUNT = 3;

export const MIN_START_KM = 15;
export const MAX_WEEKLY_INCREASE = 0.1;
/** Semaine allégée : -27,5 % (milieu de la fourchette -25 à -30 %). */
export const DELOAD_FACTOR = 0.725;

/**
 * Choix du moteur (la SPEC dit « 3 séances : retirer le samedi ») : avec 3 séances,
 * le pic est réduit de 15 %, la part de la séance du samedi retirée.
 */
export const THREE_SESSIONS_PEAK_FACTOR = 0.85;

/** Affûtage : facteurs de volume par rapport à la dernière semaine chargée. */
export const TAPER_FACTORS: Readonly<Record<RaceKind, readonly number[]>> = {
  marathon: [0.8, 0.65, 0.45],
  semi: [0.75, 0.5],
};

/**
 * Semaine de course : la SPEC vise -55 % (marathon) / -50 % (semi) course incluse,
 * ce qui est impossible dès que la course dépasse à elle seule ce volume (toujours le cas).
 * On garde alors un plancher de footings courts hors course : 30 % (marathon) / 40 % (semi)
 * de la dernière semaine chargée, soit bien moins que 45 % / 50 % même sans compter la course.
 */
export const RACE_WEEK_TRAINING_SHARE: Readonly<Record<RaceKind, number>> = { marathon: 0.3, semi: 0.4 };

/* ---------------------------- Calendrier ---------------------------- */

export const MIN_WEEKS = 8;
export const NOMINAL_WEEKS: Readonly<Record<RaceKind, number>> = { marathon: 24, semi: 20 };

export const NOMINAL_PHASES: Readonly<Record<RaceKind, Readonly<Record<Phase, number>>>> = {
  marathon: { base: 8, developpement: 8, specifique: 5, affutage: 3 },
  semi: { base: 6, developpement: 7, specifique: 5, affutage: 2 },
};

/** Semaines allégées des plans de durée nominale (indices 1-based). */
export const NOMINAL_DELOADS: Readonly<Record<RaceKind, readonly number[]>> = {
  marathon: [4, 7, 10, 14, 18],
  semi: [4, 7, 10, 14],
};
