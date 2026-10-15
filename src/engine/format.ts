/**
 * Mise en forme française des nombres, allures et durées (déterministe, sans Intl).
 */

const NBSP = '\u00a0';

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** Nombre décimal à la française : 12.5 → « 12,5 », 12 → « 12 ». */
export function formatDecimal(value: number, maxDecimals = 1): string {
  const factor = 10 ** maxDecimals;
  const rounded = Math.round(value * factor) / factor;
  return String(rounded).replace('.', ',');
}

/** Allure en s/km → « 5:41/km ». */
export function formatPace(secPerKm: number): string {
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${pad2(total % 60)}/km`;
}

/** Distance en hectomètres (unité interne) → « 12,5 km ». */
export function formatHm(hm: number): string {
  return `${formatDecimal(hm / 10)} km`;
}

/** Distance en mètres pour une répétition → « 800 m », « 1 000 m ». */
export function formatMeters(meters: number): string {
  const m = Math.round(meters);
  if (m >= 1000) {
    const thousands = Math.floor(m / 1000);
    const rest = m % 1000;
    return `${thousands}${NBSP}${String(rest).padStart(3, '0')} m`;
  }
  return `${m} m`;
}

/** Durée d'une répétition en secondes → « 45 s », « 1 min », « 1 min 30 ». */
export function formatRepDuration(sec: number): string {
  const s = Math.round(sec);
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  const rest = s % 60;
  return rest === 0 ? `${min} min` : `${min} min ${pad2(rest)}`;
}

/** Durée de séance en minutes → « 45 min », « 1 h 05 », « 2 h ». */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${pad2(rest)}`;
}

/** Chrono de course arrondi à la minute → « 3 h 50 », « 58 min ». */
export function formatRaceTime(sec: number): string {
  return formatMinutes(Math.round(sec / 60));
}

/** Chrono sur 10 km, à la seconde → « 45 min », « 45 min 30 s », « 1 h 02 min 05 s ». */
export function formatChrono(sec: number): string {
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    if (min === 0 && s === 0) return `${h} h`;
    return s === 0 ? `${h} h ${pad2(min)}` : `${h} h ${pad2(min)} min ${pad2(s)} s`;
  }
  return s === 0 ? `${min} min` : `${min} min ${pad2(s)} s`;
}

/**
 * Typographie française : espace insécable avant « : ; ! ? », autour de « × »
 * et entre un nombre et son unité, pour éviter les retours à la ligne disgracieux.
 */
export function frenchTypography(text: string): string {
  return text
    .replace(/ ([:;!?])/g, `${NBSP}$1`)
    .replace(/(\d) × (\d)/g, `$1${NBSP}×${NBSP}$2`)
    .replace(/(\d) (km|min|m|s|h|%)(?![\p{L}\d])/gu, `$1${NBSP}$2`);
}
