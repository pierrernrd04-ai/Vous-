/**
 * Sérialisation d'une `PlanInput` en query string pour `GET /api/preview`
 * (et pour les liens partageables). Client-safe.
 *
 * Contrat : une clé par champ de `PlanInput`, même nom, valeur `String(v)`,
 * champs `undefined` omis, ordre fixe (URL stable → cache HTTP efficace).
 * L'inverse côté serveur est `parseInputFromQuery` (src/engine).
 */
import type { PlanInput } from '../engine/types';

/** Exhaustif par construction : ajouter un champ à `PlanInput` sans l'ajouter ici ne compile pas. */
const KEY_ORDER: { readonly [K in keyof PlanInput]-?: true } = {
  race: true,
  raceDate: true,
  raceName: true,
  level: true,
  t10: true,
  weeklyKm: true,
  sessions: true,
  longRunDay: true,
  startDate: true,
};

export const PLAN_INPUT_KEYS: readonly (keyof PlanInput)[] = Object.freeze(
  Object.keys(KEY_ORDER) as (keyof PlanInput)[],
);

export function planInputToSearchParams(input: PlanInput): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of PLAN_INPUT_KEYS) {
    const value = input[key];
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params;
}
