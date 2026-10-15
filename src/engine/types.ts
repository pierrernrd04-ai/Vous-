/**
 * Types du moteur de plan (SPEC section 2).
 *
 * Ce module est partagé : il est compilé avec la lib DOM (tests) et avec
 * les types Cloudflare Workers (functions/). Pas d'API spécifique à un
 * environnement ici.
 *
 * Le code navigateur ne doit jamais importer `src/engine/` à l'exécution :
 * il passe par `src/shared/api-types.ts`, qui ré-exporte ces types en
 * `export type` (effacés à la compilation).
 */

export type RaceKind = 'marathon' | 'semi';

/** marathon : Finisher / sub-4h30 / sub-4h ; semi : Finisher / sub-2h / sub-1h45 */
export type Level = 'finisher' | 'l2' | 'l3';

export interface PlanInput {
  race: RaceKind;
  /** ISO yyyy-mm-dd, dimanche ou autre jour */
  raceDate: string;
  /** ex. "Marathon de Paris" */
  raceName?: string;
  level: Level;
  /** temps actuel sur 10 km en secondes (1800..5400) */
  t10: number;
  /** km actuels / semaine (0..120) */
  weeklyKm: number;
  /** séances / semaine */
  sessions: 3 | 4 | 5;
  longRunDay: 'sat' | 'sun';
  /** ISO ; défaut = lundi de la semaine courante ou prochain lundi */
  startDate?: string;
}

export interface Session {
  date: string;
  dow: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  type: 'ef' | 'qualite' | 'sl' | 'recup' | 'course' | 'renfo';
  title: string;
  km: number;
  durationMin: number;
  paces: { label: string; secPerKm: number }[];
  steps: string[];
  loopKm: number | null;
}

export interface Week {
  index: number;
  start: string;
  end: string;
  phase: 'base' | 'developpement' | 'specifique' | 'affutage';
  deload: boolean;
  km: number;
  sessions: Session[];
  note?: string;
}

export interface Plan {
  input: PlanInput;
  weeks: Week[];
  paces: Record<'ef' | 'seuil' | 'as10' | 'allure_course' | 'recup', number>;
  predicted: { raceSec: number };
  totalKm: number;
}

/* ------------------------------------------------------------------ */
/* Alias dérivés (pratiques pour le reste du code, sans changer les    */
/* formes ci-dessus).                                                  */
/* ------------------------------------------------------------------ */

export type Dow = Session['dow'];
export type SessionType = Session['type'];
export type Phase = Week['phase'];
export type PaceKey = keyof Plan['paces'];
export type SessionPace = Session['paces'][number];

/** Une ligne de la vue d'ensemble (aperçu gratuit : contenu des semaines masqué). */
export interface WeekOverview {
  index: number;
  start: string;
  phase: Week['phase'];
  deload: boolean;
  km: number;
}

/** Réponse de `previewPlan` et de `GET /api/preview`. */
export interface PlanPreview {
  week1: Week;
  overview: WeekOverview[];
  paces: Plan['paces'];
  predicted: Plan['predicted'];
}

/** Résultat de `computePaces`. */
export interface PaceComputation {
  /** Allures en secondes par km. */
  paces: Plan['paces'];
  predicted: Plan['predicted'];
  /**
   * Présente quand l'allure course n'est pas celle de l'objectif du niveau :
   * objectif irréaliste au vu du T10 (on garde alors l'allure prédite), ou
   * objectif très en deçà du potentiel (allure plafonnée à prédiction + 5 %).
   * Texte en français à afficher (repris dans la note de la semaine 1).
   */
  note?: string;
}

export type ValidationResult =
  | { ok: true; input: PlanInput }
  | { ok: false; errors: string[] };

export type PlanErrorCode = 'INVALID_INPUT' | 'PLAN_TOO_SHORT';

/**
 * Erreur levée par `generatePlan` / `previewPlan`.
 * `messages` : liste de messages en français, affichables tels quels.
 */
export class PlanError extends Error {
  readonly code: PlanErrorCode;
  readonly messages: string[];

  constructor(code: PlanErrorCode, messages: string[]) {
    super(messages.length > 0 ? messages.join(' ') : code);
    this.name = 'PlanError';
    this.code = code;
    this.messages = messages;
  }
}

export function isPlanError(value: unknown): value is PlanError {
  return value instanceof PlanError;
}
