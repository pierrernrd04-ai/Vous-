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

/**
 * Nom des niveaux dans les textes du plan (notes, messages d'erreur). La SPEC nomme les
 * niveaux sub-4h30, sub-4h…, mais la copie utilisateur reste en français, comme l'interface
 * (« Moins de 4 h 30 »).
 */
export const LEVEL_LABEL: Readonly<Record<RaceKind, Readonly<Record<Level, string>>>> = {
  marathon: { finisher: 'Finisher', l2: 'moins de 4 h 30', l3: 'moins de 4 h' },
  semi: { finisher: 'Finisher', l2: 'moins de 2 h', l3: 'moins de 1 h 45' },
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

/**
 * Budget de temps hebdomadaire au pic, en minutes à l'allure EF (revue du 15/10/2026) :
 * le pic en km de la SPEC vaut pour un coureur rapide ; un coureur plus lent ne court pas
 * 8 à 13 h par semaine pour autant. Le pic effectif est min(PEAK_KM, budget / allure EF).
 * Sans effet pour la grille de la SPEC à 40 et 50 min au 10 km.
 */
export const WEEKLY_MAX_MINUTES: Readonly<Record<RaceKind, Readonly<Record<Level, number>>>> = {
  marathon: { finisher: 330, l2: 390, l3: 450 },
  semi: { finisher: 270, l2: 300, l3: 330 },
};

/**
 * Footings (revue du 15/10/2026) : jamais plus de 75 % de la sortie longue de la semaine,
 * ni plus de 90 min (60 min pour le footing court de la veille ou du lendemain de la
 * sortie longue). Le surplus éventuel va à la séance de qualité, sinon il est abandonné.
 */
export const EF_MAX_SHARE_OF_LONG = 0.75;
export const EF_MAX_MINUTES = 90;
export const EF_SHORT_MAX_MINUTES = 60;
/**
 * Séance de qualité : au plus 30 % de la semaine (la part qu'impose une semaine à 3 séances,
 * sortie longue 40 % et footing 30 %), à 200 m d'arrondi près, et jamais plus longue que la
 * sortie longue. Au-delà, le surplus de la semaine est abandonné plutôt que d'allonger
 * démesurément l'échauffement de la séance de qualité.
 */
export const QUALITY_MAX_SHARE = 0.3;
export const QUALITY_ROUNDING_SLACK_HM = 2;

/**
 * Sortie longue des semaines allégées et de l'affûtage (revue du 15/10/2026) : même quand
 * elle est plafonnée (3 h, maximum du niveau), elle raccourcit vraiment.
 * Semaine allégée : ≤ 75 % de la sortie longue de la dernière semaine chargée.
 * Affûtage : ≤ 70 % puis 55 % de la plus longue sortie du plan (marathon), 70 % (semi).
 */
export const DELOAD_LONG_RUN_FACTOR = 0.75;
export const TAPER_LONG_RUN_FACTORS: Readonly<Record<RaceKind, readonly number[]>> = {
  marathon: [0.7, 0.55],
  semi: [0.7],
};

/**
 * Avant une course en semaine (lundi à vendredi), aucune sortie longue à 5 jours ou moins
 * de la course : elle devient un footing court (≤ 40 % de la sortie longue prévue).
 */
export const PRE_RACE_NO_LONG_RUN_DAYS = 5;
export const PRE_RACE_LONG_RUN_FACTOR = 0.4;
/**
 * Semaine de course : plafonds par séance (minutes à l'allure de la séance, part de la référence).
 * Activation : 28 min de footing + 3 accélérations, soit 30 min au plus.
 */
export const RACE_WEEK_ACTIVATION_MAX_MINUTES = 28;
export const RACE_WEEK_ACTIVATION_MAX_HM = 50;
export const RACE_WEEK_FOOTING_MAX_MINUTES = 50;
export const RACE_WEEK_FOOTING_MAX_SHARE = 0.15;
export const RACE_WEEK_RECUP_MAX_MINUTES = 45;
export const RACE_WEEK_RECUP_MAX_SHARE = 0.12;

/**
 * Prépa courte ou sortie longue limitée (revue du 15/10/2026) : si la plus longue sortie du
 * plan reste sous ce seuil, l'allure course prend 5 % de marge de plus (prudence le jour J).
 */
export const SHORT_PREP_LONG_RUN_KM: Readonly<Record<RaceKind, number>> = { marathon: 26, semi: 14 };
/** … ou sous 90 % de la sortie longue maximale du coureur, si elle est plus courte que ce seuil. */
export const SHORT_PREP_CAP_SHARE = 0.9;
export const SHORT_PREP_EXTRA_MARGIN = 1.05;

/**
 * Part maximale de la sortie longue dans le volume hebdomadaire, selon la phase
 * (décision du 14/10/2026, qui remplace l'ancienne règle 35 % / 45 %) : 40 % en base,
 * 45 % en développement, 50 % en spécifique, pour les deux courses.
 * Choix du moteur pour l'affûtage : 40 %, comme en base.
 */
export const LONG_RUN_SHARE: Readonly<Record<Phase, number>> = {
  base: 0.4,
  developpement: 0.45,
  specifique: 0.5,
  affutage: 0.4,
};
/**
 * Hausse maximale de la sortie longue (km) par rapport à la sortie longue de la dernière
 * semaine non allégée.
 */
export const LONG_RUN_MAX_GAIN_KM = 2;

export const MIN_START_KM = 15;
/**
 * Départ d'un coureur qui court peu (revue du 15/10/2026) : la première semaine compte
 * max(weeklyKm, min(15 km, 90 min à l'allure EF)), soit environ 3 × 30 min.
 */
export const START_FLOOR_MINUTES = 90;
/** En dessous de ce volume actuel, les deux premières semaines n'ont pas de vrai fartlek. */
export const BEGINNER_WEEKLY_KM = 15;
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
