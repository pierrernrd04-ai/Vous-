/**
 * Arithmétique de dates « date seule » en UTC (SPEC section 2) : pas de fuseau,
 * pas de décalage d'heure d'été. Une date est représentée par un numéro de jour
 * (nombre de jours écoulés depuis le 1970-01-01).
 */
import { DATE_YEAR_MAX, DATE_YEAR_MIN } from './constants';
import type { Dow } from './types';

const DAY_MS = 86_400_000;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Jours de la semaine, lundi en premier (index 0). */
export const DOWS: readonly Dow[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const DOW_FR = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;
const MONTH_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

/** Numéro de jour d'une date ISO `yyyy-mm-dd`, ou `null` si elle n'existe pas au calendrier. */
export function parseIsoDate(value: string): number | null {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return Math.round(date.getTime() / DAY_MS);
}

/** Vrai pour une date ISO valide dont l'année est plausible (garde-fou du moteur). */
export function isPlausibleIsoDate(value: string): boolean {
  const day = parseIsoDate(value);
  if (day === null) return false;
  const year = yearOf(day);
  return year >= DATE_YEAR_MIN && year <= DATE_YEAR_MAX;
}

export function formatIsoDate(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(day: number, days: number): number {
  return day + days;
}

/** 0 = lundi … 6 = dimanche. Le 1970-01-01 était un jeudi. */
export function dowIndex(day: number): number {
  return (((day + 3) % 7) + 7) % 7;
}

export function dowOf(day: number): Dow {
  return DOWS[dowIndex(day)] ?? 'mon';
}

export function mondayOf(day: number): number {
  return day - dowIndex(day);
}

/** Le jour lui-même s'il tombe un lundi, sinon le lundi suivant. */
export function firstMondayOnOrAfter(day: number): number {
  const idx = dowIndex(day);
  return idx === 0 ? day : day + (7 - idx);
}

export function yearOf(day: number): number {
  return new Date(day * DAY_MS).getUTCFullYear();
}

/** Date du jour en UTC (seule source non déterministe, utilisée par défaut uniquement). */
export function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Vrai si un 25 décembre tombe dans l'intervalle [first, last] (bornes incluses). */
export function containsChristmas(first: number, last: number): boolean {
  for (let year = yearOf(first); year <= yearOf(last); year += 1) {
    const christmas = Math.round(Date.UTC(year, 11, 25) / DAY_MS);
    if (christmas >= first && christmas <= last) return true;
  }
  return false;
}

/** « lundi 19 octobre 2026 ». */
export function formatDateFr(day: number): string {
  const date = new Date(day * DAY_MS);
  const dow = DOW_FR[dowIndex(day)] ?? '';
  const month = MONTH_FR[date.getUTCMonth()] ?? '';
  const dom = date.getUTCDate();
  return `${dow} ${dom === 1 ? '1er' : String(dom)} ${month} ${date.getUTCFullYear()}`;
}
