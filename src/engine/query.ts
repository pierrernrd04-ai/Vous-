/**
 * Lecture tolérante d'une `PlanInput` depuis la query de `GET /api/preview`.
 *
 * Les clés sont les noms des champs de `PlanInput` (voir src/shared/query.ts).
 * Le résultat n'est PAS validé : il passe ensuite par `validateInput`, qui produit
 * les messages d'erreur. Une valeur illisible est donc transmise telle quelle
 * (chaîne) pour que la validation la signale, plutôt que d'être devinée.
 *
 * Tolérances : espaces autour des valeurs, casse, virgule décimale, alias français
 * (« semi-marathon », « samedi »…), dates JJ/MM/AAAA, chrono « 45:30 » ou « 1:02:05 ».
 */

const MAX_VALUE_LENGTH = 200;

const RACE_ALIASES: Readonly<Record<string, string>> = {
  marathon: 'marathon',
  '42': 'marathon',
  '42k': 'marathon',
  semi: 'semi',
  semimarathon: 'semi',
  demimarathon: 'semi',
  half: 'semi',
  halfmarathon: 'semi',
  '21': 'semi',
  '21k': 'semi',
};

const LEVEL_ALIASES: Readonly<Record<string, string>> = {
  finisher: 'finisher',
  finish: 'finisher',
  l1: 'finisher',
  '1': 'finisher',
  l2: 'l2',
  '2': 'l2',
  l3: 'l3',
  '3': 'l3',
};

const DAY_ALIASES: Readonly<Record<string, string>> = {
  sat: 'sat',
  sam: 'sat',
  samedi: 'sat',
  saturday: 'sat',
  sun: 'sun',
  dim: 'sun',
  dimanche: 'sun',
  sunday: 'sun',
};

const DECIMAL_RE = /^[+-]?\d+(?:[.,]\d+)?$/;

/** Minuscules, sans accents, sans espaces / tirets / points. */
function simplify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s._-]+/g, '');
}

function readParam(params: URLSearchParams, key: string): string | undefined {
  const raw = params.get(key);
  if (raw === null) return undefined;
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  return trimmed.length > MAX_VALUE_LENGTH ? trimmed.slice(0, MAX_VALUE_LENGTH + 1) : trimmed;
}

function parseDecimal(value: string): number | undefined {
  return DECIMAL_RE.test(value) ? Number(value.replace(',', '.')) : undefined;
}

function pad2(value: string): string {
  return value.length === 1 ? `0${value}` : value;
}

/** `yyyy-mm-dd`, `yyyy/mm/dd`, `yyyy-mm-ddThh:mm…`, `jj/mm/aaaa`, `jj-mm-aaaa`, `jj.mm.aaaa`. */
function parseLooseDate(value: string): string {
  let match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ].*)?$/.exec(value);
  if (match) return `${match[1]}-${pad2(match[2] ?? '')}-${pad2(match[3] ?? '')}`;
  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
  if (match) return `${match[3]}-${pad2(match[2] ?? '')}-${pad2(match[1] ?? '')}`;
  return value;
}

/**
 * Temps sur 10 km : secondes (« 2730 »), minutes si le nombre est inférieur à 100
 * (« 45 », « 45,5 »), « mm:ss », « h:mm:ss » ou « 45'30 ».
 */
function parseT10(value: string): number | string {
  const compact = value.replace(/\s+/g, '').replace(/(?:''|")$/, '');
  const decimal = parseDecimal(compact);
  if (decimal !== undefined) return decimal < 100 ? Math.round(decimal * 60) : decimal;
  let match = /^(\d{1,3})[:'](\d{2})$/.exec(compact);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  match = /^(\d):(\d{2}):(\d{2})$/.exec(compact);
  if (match) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  match = /^(\d)h(\d{2})(?:min)?$/i.exec(compact);
  if (match) return Number(match[1]) * 3600 + Number(match[2]) * 60;
  match = /^(\d{1,3})min(?:(\d{1,2})s?)?$/i.exec(compact);
  if (match) return Number(match[1]) * 60 + Number(match[2] ?? 0);
  return value;
}

function parseWeeklyKm(value: string): number | string {
  const compact = value.replace(/\s+/g, '').replace(/km$/i, '');
  return parseDecimal(compact) ?? value;
}

function parseSessions(value: string): number | string {
  return /^\d+$/.test(value) ? Number(value) : value;
}

function alias(map: Readonly<Record<string, string>>, value: string): string {
  return map[simplify(value)] ?? value;
}

export function parseInputFromQuery(params: URLSearchParams): unknown {
  const out: Record<string, unknown> = {};

  const race = readParam(params, 'race');
  if (race !== undefined) out.race = alias(RACE_ALIASES, race);

  const raceDate = readParam(params, 'raceDate');
  if (raceDate !== undefined) out.raceDate = parseLooseDate(raceDate);

  const raceName = readParam(params, 'raceName');
  if (raceName !== undefined) out.raceName = raceName;

  const level = readParam(params, 'level');
  if (level !== undefined) out.level = alias(LEVEL_ALIASES, level);

  const t10 = readParam(params, 't10');
  if (t10 !== undefined) out.t10 = parseT10(t10);

  const weeklyKm = readParam(params, 'weeklyKm');
  if (weeklyKm !== undefined) out.weeklyKm = parseWeeklyKm(weeklyKm);

  const sessions = readParam(params, 'sessions');
  if (sessions !== undefined) out.sessions = parseSessions(sessions);

  const longRunDay = readParam(params, 'longRunDay');
  if (longRunDay !== undefined) out.longRunDay = alias(DAY_ALIASES, longRunDay);

  const startDate = readParam(params, 'startDate');
  if (startDate !== undefined) out.startDate = parseLooseDate(startDate);

  return out;
}
