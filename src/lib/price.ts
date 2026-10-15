/**
 * Prix courant selon la date (SPEC section 1). Fonctions pures, testées.
 *
 * - 19 € jusqu'au dimanche 18/10/2026 23:59:59 (heure de Paris), puis 29 €.
 * - Jamais de prix barré ni de pourcentage de réduction : seule la formulation
 *   « 19 € jusqu'à dimanche 23:59, puis 29 € » est utilisée pendant le lancement.
 */
import { config, formatEuros, type SiteConfig } from '../config';

export interface PriceInfo {
  /** Montant TTC en euros applicable à l'instant donné. */
  amount: number;
  /** « 19 € » (espace insécable). */
  label: string;
  /** Vrai tant que le prix de lancement s'applique. */
  isLaunch: boolean;
  /** Fin du prix de lancement. */
  launchEndsAt: Date;
  /** Payment Link Stripe correspondant au prix (`''` si non renseigné). */
  paymentLink: string;
  /** Phrase de prix à afficher (voir `priceSentence`). */
  sentence: string;
}

export function launchEnd(cfg: SiteConfig = config): Date {
  return new Date(cfg.launchPriceEnd);
}

/** Vrai tant que le prix de lancement s'applique (fin incluse). */
export function isLaunchAt(now: Date, cfg: SiteConfig = config): boolean {
  return now.getTime() <= launchEnd(cfg).getTime();
}

const PARIS_WEEKDAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'Europe/Paris' });
const PARIS_DAY_MONTH = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Paris',
});
const PARIS_TIME = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/Paris',
});

/** Moins de 6 jours avant la fin : « dimanche » suffit, sinon on précise la date. */
const SHORT_FORM_MAX_MS = 6 * 86_400_000;

/**
 * « 19 € jusqu'à dimanche 23:59, puis 29 € » pendant le lancement (date complète
 * si la fin est à plus de 6 jours), puis seulement « 29 € ».
 */
export function priceSentence(now: Date = new Date(), cfg: SiteConfig = config): string {
  const regular = formatEuros(cfg.priceRegular);
  if (!isLaunchAt(now, cfg)) return regular;
  const end = launchEnd(cfg);
  const launch = formatEuros(cfg.priceLaunch);
  const time = PARIS_TIME.format(end);
  const when =
    end.getTime() - now.getTime() <= SHORT_FORM_MAX_MS
      ? `jusqu'à ${PARIS_WEEKDAY.format(end)} ${time}`
      : `jusqu'au ${PARIS_DAY_MONTH.format(end)} ${time}`;
  return `${launch} ${when}, puis ${regular}`;
}

export function priceInfo(now: Date = new Date(), cfg: SiteConfig = config): PriceInfo {
  const isLaunch = isLaunchAt(now, cfg);
  const amount = isLaunch ? cfg.priceLaunch : cfg.priceRegular;
  return {
    amount,
    label: formatEuros(amount),
    isLaunch,
    launchEndsAt: launchEnd(cfg),
    paymentLink: isLaunch ? cfg.paymentLinkLaunch : cfg.paymentLinkRegular,
    sentence: priceSentence(now, cfg),
  };
}

export interface Countdown {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Temps restant jusqu'à `end`, ou `null` si l'instant est passé. */
export function countdownTo(end: Date, now: Date = new Date()): Countdown | null {
  const totalMs = end.getTime() - now.getTime();
  if (!(totalMs > 0)) return null;
  const totalSec = Math.floor(totalMs / 1000);
  return {
    totalMs,
    days: Math.floor(totalSec / 86_400),
    hours: Math.floor((totalSec % 86_400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

const NBSP = ' ';

/** « 4 j 12 h 03 min 05 s » (les jours disparaissent à J-0). */
export function formatCountdown(c: Countdown, withSeconds = true): string {
  const parts: string[] = [];
  if (c.days > 0) parts.push(`${c.days}${NBSP}j`);
  parts.push(`${c.days > 0 ? String(c.hours).padStart(2, '0') : c.hours}${NBSP}h`);
  parts.push(`${String(c.minutes).padStart(2, '0')}${NBSP}min`);
  if (withSeconds) parts.push(`${String(c.seconds).padStart(2, '0')}${NBSP}s`);
  return parts.join(' ');
}

/** Version longue pour les lecteurs d'écran : « 4 jours, 12 heures et 3 minutes ». */
export function formatCountdownSpoken(c: Countdown): string {
  const unit = (n: number, one: string, many: string) => `${n} ${n >= 2 ? many : one}`;
  const parts = [
    c.days > 0 ? unit(c.days, 'jour', 'jours') : '',
    c.hours > 0 ? unit(c.hours, 'heure', 'heures') : '',
    unit(c.minutes, 'minute', 'minutes'),
  ].filter(Boolean);
  if (parts.length === 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`;
}
