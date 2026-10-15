/**
 * Configuration du site (SPEC section 4). Client-safe, sans dépendance.
 * Importé aussi par vite.config.ts au build : pas d'API navigateur au niveau module.
 */

export interface SiteConfig {
  /** Fin du prix de lancement (inclus), heure de Paris. */
  launchPriceEnd: string;
  /** Prix de lancement, en euros TTC. */
  priceLaunch: number;
  /** Prix normal, en euros TTC. */
  priceRegular: number;
  /** URL du Payment Link Stripe à 19 € (https://buy.stripe.com/…). */
  paymentLinkLaunch: string;
  /** URL du Payment Link Stripe à 29 €. */
  paymentLinkRegular: string;
  /** Lien PayPal de secours, proposé seulement si `stripeEnabled` est faux. */
  paypalFallbackUrl: string;
  /** Paiement Stripe actif (Payment Links renseignés et testés). */
  stripeEnabled: boolean;
  /** URL publique du site, sans barre finale. */
  siteUrl: string;
  /** App Traceo (générateur de boucles), reçoit `?km=X`. */
  traceoAppUrl: string;
}

export const config: SiteConfig = {
  launchPriceEnd: '2026-10-18T23:59:59+02:00',
  priceLaunch: 19,
  priceRegular: 29,
  paymentLinkLaunch: '',
  paymentLinkRegular: '',
  paypalFallbackUrl: '',
  stripeEnabled: false,
  siteUrl: 'https://traceo-pass.pages.dev',
  traceoAppUrl: 'https://traceorun.pages.dev/app',
};

/** Constante de la SPEC (section 1). */
export const LAUNCH_PRICE_END = config.launchPriceEnd;

/** Dates clés de la prépa (SPEC section 1), ISO yyyy-mm-dd. */
export const KEY_DATES = {
  /** Jour 1 du programme : lundi 19/10/2026. */
  planStart: '2026-10-19',
  /** Marathon : dimanche 4 avril 2027 (24 semaines). */
  marathon: '2027-04-04',
  /** Semi : dimanche 7 mars 2027 (20 semaines). */
  semi: '2027-03-07',
  /** Traceo Premium inclus jusqu'au 5/04/2027. */
  premiumUntil: '2027-04-05',
} as const;

/** Vrai tant que le prix de lancement s'applique (jusqu'au dimanche 18/10/2026 23:59 inclus, Paris). */
export function isLaunchPrice(now: Date = new Date()): boolean {
  return now.getTime() <= Date.parse(config.launchPriceEnd);
}

/** Prix applicable à l'instant `now`, en euros TTC. */
export function currentPrice(now: Date = new Date()): number {
  return isLaunchPrice(now) ? config.priceLaunch : config.priceRegular;
}

/** URL du Payment Link applicable à l'instant `now` (`''` si non renseigné). */
export function currentPaymentLink(now: Date = new Date()): string {
  return isLaunchPrice(now) ? config.paymentLinkLaunch : config.paymentLinkRegular;
}

/** « 19 € » avec espace insécable. */
export function formatEuros(amount: number): string {
  const text = Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace('.', ',');
  return `${text} €`;
}

/**
 * Formulation imposée par la SPEC : « 19 € jusqu'à dimanche 23:59, puis 29 € »
 * pendant le lancement ; ensuite, seulement le prix normal. Jamais de prix barré.
 */
export function priceSentence(now: Date = new Date()): string {
  return isLaunchPrice(now)
    ? `${formatEuros(config.priceLaunch)} jusqu'à dimanche 23:59, puis ${formatEuros(config.priceRegular)}`
    : formatEuros(config.priceRegular);
}

/** Mention fiscale obligatoire à côté des prix. */
export const VAT_MENTION = 'TVA non applicable, art. 293 B du CGI';
