/**
 * Formatage en français (dates, distances, allures, durées). Fonctions pures.
 *
 * Les dates du plan sont des dates calendaires ISO `yyyy-mm-dd` sans fuseau
 * (SPEC section 2) : on les manipule en UTC pour éviter tout décalage d'heure d'été.
 */

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** `yyyy-mm-dd` → Date à minuit UTC, ou `null` si la date est invalide. */
export function parseIsoDate(iso: string): Date | null {
  const match = ISO_DATE_RE.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return toIsoDate(date) === iso ? date : null;
}

/** Date (lue en UTC) → `yyyy-mm-dd`. */
export function toIsoDate(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Date du jour dans le fuseau de l'appareil, en `yyyy-mm-dd`. */
export function localTodayIso(now: Date = new Date()): string {
  const y = String(now.getFullYear()).padStart(4, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Ajoute `days` jours à une date ISO. */
export function addDaysIso(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  if (!date) throw new RangeError(`Date ISO invalide : ${iso}`);
  return toIsoDate(new Date(date.getTime() + days * DAY_MS));
}

/** Nombre de jours de `fromIso` à `toIso` (négatif si `toIso` est avant). */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = parseIsoDate(fromIso);
  const b = parseIsoDate(toIso);
  if (!a || !b) return Number.NaN;
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function fmt(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...options });
}

const FMT_LONG = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const FMT_LONG_NO_YEAR = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
const FMT_SHORT = fmt({ weekday: 'short', day: 'numeric', month: 'short' });
const FMT_DAY_MONTH = fmt({ day: 'numeric', month: 'short' });
const FMT_DAY_MONTH_LONG = fmt({ day: 'numeric', month: 'long' });
const FMT_WEEKDAY = fmt({ weekday: 'long' });
const FMT_DMY = fmt({ day: 'numeric', month: 'long', year: 'numeric' });

function withDate(iso: string, format: (date: Date) => string): string {
  const date = parseIsoDate(iso);
  return date ? format(date) : iso;
}

/** « 1er » pour le premier du mois, comme l'usage français. */
function firstOfMonth(text: string): string {
  return text.replace(/(^|\s)1(\s)/, '$11er$2');
}

/** « lundi 19 octobre 2026 » */
export function formatDateLong(iso: string, withYear = true): string {
  return withDate(iso, (d) => firstOfMonth((withYear ? FMT_LONG : FMT_LONG_NO_YEAR).format(d)));
}

/** « mar. 20 oct. » */
export function formatDateShort(iso: string): string {
  return withDate(iso, (d) => FMT_SHORT.format(d));
}

/** « 19 oct. » */
export function formatDayMonth(iso: string): string {
  return withDate(iso, (d) => FMT_DAY_MONTH.format(d));
}

/** « 19 octobre » */
export function formatDayMonthLong(iso: string): string {
  return withDate(iso, (d) => firstOfMonth(FMT_DAY_MONTH_LONG.format(d)));
}

/** « 5 avril 2027 » */
export function formatDate(iso: string): string {
  return withDate(iso, (d) => firstOfMonth(FMT_DMY.format(d)));
}

/** « lundi » */
export function formatWeekday(iso: string): string {
  return withDate(iso, (d) => FMT_WEEKDAY.format(d));
}

/** « 19 – 25 oct. » ou « 28 déc. – 3 janv. » */
export function formatRange(startIso: string, endIso: string): string {
  const a = parseIsoDate(startIso);
  const b = parseIsoDate(endIso);
  if (!a || !b) return `${startIso} – ${endIso}`;
  if (a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${a.getUTCDate()} – ${FMT_DAY_MONTH.format(b)}`;
  }
  return `${FMT_DAY_MONTH.format(a)} – ${FMT_DAY_MONTH.format(b)}`;
}

const NUMBER_1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** « 12,5 » */
export function formatNumber(value: number): string {
  return NUMBER_1.format(value);
}

/** « 12,5 km » (espace insécable) */
export function formatKm(km: number): string {
  return `${formatNumber(km)} km`;
}

/** Secondes → « m:ss » ou « h:mm:ss ». */
export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Allure en s/km → « 5:30/km ». */
export function formatPace(secPerKm: number): string {
  return `${formatClock(secPerKm)}/km`;
}

/** Secondes → « 3 h 52 », « 52 min », « 3 h 05 ». */
export function formatDuration(totalSec: number): string {
  const totalMin = Math.round(Math.max(0, totalSec) / 60);
  return formatMinutes(totalMin);
}

/** Minutes → « 52 min » ou « 1 h 35 ». */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** Secondes → « 3 h 52 min 10 s » (temps de course détaillé). */
export function formatRaceTime(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} h`);
  if (h > 0 || m > 0) parts.push(`${h > 0 ? String(m).padStart(2, '0') : m} min`);
  if (s > 0 || parts.length === 0) parts.push(`${String(s).padStart(2, '0')} s`);
  return parts.join(' ');
}

/** « 1 séance », « 3 séances » */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${Math.abs(count) >= 2 ? pluralForm : singular}`;
}
