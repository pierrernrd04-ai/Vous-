/**
 * Moteur de plan — point d'entrée public (SPEC section 2).
 *
 * Utilisé UNIQUEMENT côté serveur (functions/) et dans les tests :
 * le bundle navigateur ne doit jamais importer ce dossier (le build échoue sinon).
 *
 * - `validateInput(input)` : validation stricte, erreurs en français ;
 * - `generatePlan(input, today?)` : plan complet daté ;
 * - `previewPlan(input, today?)` : semaine 1 + vue d'ensemble (aperçu gratuit) ;
 * - `computePaces(input)` : allures (s/km) et temps prédit (Riegel, exposant 1,06) ;
 * - `parseInputFromQuery(params)` : lecture tolérante de la query de `GET /api/preview`.
 *
 * `generatePlan` et `previewPlan` lèvent une `PlanError` :
 * `INVALID_INPUT` (messages de validation) ou `PLAN_TOO_SHORT` (moins de 8 semaines).
 * Déterministes : même entrée (et même `today`, ISO yyyy-mm-dd en UTC) → même sortie.
 * Sans `startDate`, le plan dépend du jour : le front doit mémoriser `startDate`
 * (par exemple `weeks[0].start`) pour retrouver le même plan les jours suivants.
 */

export * from './types';
export { validateInput } from './validate';
export { generatePlan, previewPlan } from './plan';
export { computePaces } from './paces';
export { parseInputFromQuery } from './query';
