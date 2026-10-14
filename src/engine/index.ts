/**
 * Moteur de plan — point d'entrée public (SPEC section 2).
 *
 * Utilisé UNIQUEMENT côté serveur (functions/) et dans les tests :
 * le bundle navigateur ne doit jamais importer ce dossier (le build échoue sinon).
 *
 * Bouchon posé par le squelette : l'implémentation revient à l'agent « moteur ».
 * Les signatures ci-dessous sont le contrat utilisé par functions/ et les tests.
 */
import type {
  PaceComputation,
  Plan,
  PlanInput,
  PlanPreview,
  ValidationResult,
} from './types';

export * from './types';

function notImplemented(name: string): Error {
  return new Error(`${name} : not implemented`);
}

/**
 * Validation stricte d'une entrée inconnue (corps JSON, query déjà parsée…).
 * Les erreurs sont des phrases en français, affichables telles quelles.
 */
export function validateInput(_input: unknown): ValidationResult {
  throw notImplemented('validateInput');
}

/**
 * Génère le plan complet. Déterministe : même entrée (et même `today`) → même sortie.
 * @param today date du jour ISO yyyy-mm-dd (UTC date-only) ; défaut = aujourd'hui.
 * @throws {PlanError} `INVALID_INPUT` ou `PLAN_TOO_SHORT` (moins de 8 semaines).
 */
export function generatePlan(_input: PlanInput, _today?: string): Plan {
  throw notImplemented('generatePlan');
}

/**
 * Aperçu gratuit : semaine 1 complète + vue d'ensemble des phases (sans le
 * contenu des semaines suivantes) + allures + prédiction.
 * @throws {PlanError} comme `generatePlan`.
 */
export function previewPlan(_input: PlanInput, _today?: string): PlanPreview {
  throw notImplemented('previewPlan');
}

/**
 * Allures d'entraînement (s/km) et temps prédit (Riegel, exposant 1,06).
 */
export function computePaces(
  _input: Pick<PlanInput, 'race' | 'level' | 't10'>,
): PaceComputation {
  throw notImplemented('computePaces');
}

/**
 * Lit une `PlanInput` depuis la query de `GET /api/preview`.
 * Les clés sont exactement les noms des champs de `PlanInput`
 * (voir `planInputToSearchParams` dans src/shared/query.ts).
 * Le résultat n'est pas validé : le passer ensuite à `validateInput`.
 */
export function parseInputFromQuery(_params: URLSearchParams): unknown {
  throw notImplemented('parseInputFromQuery');
}
