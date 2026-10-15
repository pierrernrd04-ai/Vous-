/**
 * Outils partagés des tests e2e : jetons de test, dates, mise en page mobile, captures.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';
import { buildTokenPayload, signToken } from '../../src/shared/token';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SCREENSHOT_DIR = resolve(ROOT, 'docs', 'screenshots');

/**
 * Jeton d'accès de test : `E2E_TOKEN` s'il est fourni (sortie de `npm run token`),
 * sinon signé avec le secret de playwright.config.ts (`E2E_TOKEN_SECRET`).
 */
export async function testToken(ref = 'w1-marathon-l2'): Promise<string> {
  const provided = process.env.E2E_TOKEN?.trim();
  if (provided) return provided;
  const secret = process.env.E2E_TOKEN_SECRET;
  if (!secret) throw new Error('E2E_TOKEN_SECRET manquant (voir playwright.config.ts).');
  const payload = buildTokenPayload({ email: 'e2e@exemple.fr', sid: 'paypal:e2e', ref });
  return signToken(payload, secret);
}

/** Date du jour à Paris (yyyy-mm-dd), comme l'API (`todayInParis`). */
export function todayInParis(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Premier lundi à partir de `iso` (le jour même si c'est un lundi). */
export function firstMondayOnOrAfter(iso: string): string {
  const day = new Date(`${iso}T00:00:00Z`);
  const offset = (8 - day.getUTCDay()) % 7;
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}

/**
 * Nombre de semaines du plan généré aujourd'hui pour une course (règle du moteur :
 * du premier lundi à venir à la semaine de la course, au plus 24 / 20 semaines).
 * Vaut 24 (marathon de Paris) / 20 (semi) jusqu'au lundi 19/10/2026.
 */
export function expectedPlanWeeks(race: 'marathon' | 'semi', raceDate: string, today = todayInParis()): number {
  const start = Date.parse(`${firstMondayOnOrAfter(today)}T00:00:00Z`);
  const raceDay = new Date(`${raceDate}T00:00:00Z`);
  const raceMonday = raceDay.getTime() - ((raceDay.getUTCDay() + 6) % 7) * 86_400_000;
  const weeks = Math.round((raceMonday - start) / (7 * 86_400_000)) + 1;
  return Math.min(weeks, race === 'marathon' ? 24 : 20);
}

export function addDays(iso: string, days: number): string {
  const day = new Date(`${iso}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

/** Texte d'un élément, espaces insécables et blancs multiples normalisés. */
export function normalize(text: string | null): string {
  return (text ?? '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Aucune barre de défilement horizontale (la page tient dans la largeur de l'écran). */
export async function expectNoHorizontalScroll(page: Page, label: string): Promise<void> {
  const widths = await page.evaluate(() => ({
    scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    viewport: window.innerWidth,
  }));
  expect(widths.scroll, `${label} : largeur ${widths.scroll} px pour un écran de ${widths.viewport} px`).toBeLessThanOrEqual(
    widths.viewport,
  );
}

/** Enregistre les erreurs JavaScript et de console (CSP comprise) d'une page. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

/** Capture d'écran 360 px (pixels CSS, donc légère) si `E2E_SCREENSHOTS=1`. */
export async function saveScreenshot(page: Page, name: string): Promise<void> {
  if (!process.env.E2E_SCREENSHOTS) return;
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, `${name}.png`), scale: 'css', animations: 'disabled' });
}
