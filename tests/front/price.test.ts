/**
 * Prix courant selon la date (src/lib/price.ts) : 19 € jusqu'au dimanche 18/10/2026
 * 23:59:59 heure de Paris, puis 29 € ; formulation imposée, jamais de prix barré
 * ni de pourcentage (SPEC section 1).
 */
import { describe, expect, it } from 'vitest';
import { LAUNCH_PRICE_END, config, type SiteConfig } from '../../src/config';
import {
  countdownTo,
  formatCountdown,
  formatCountdownSpoken,
  isLaunchAt,
  launchEnd,
  priceInfo,
  priceSentence,
} from '../../src/lib/price';

const NB = ' ';
/** 23:59:59 à Paris le 18/10/2026 (heure d'été, UTC+2). */
const LAST_SECOND = new Date('2026-10-18T21:59:59Z');
const AFTER = new Date('2026-10-18T22:00:00Z');
const TODAY = new Date('2026-10-14T10:00:00Z');

const cfg = (overrides: Partial<SiteConfig> = {}): SiteConfig => ({
  ...config,
  paymentLinkLaunch: 'https://buy.stripe.com/test_launch',
  paymentLinkRegular: 'https://buy.stripe.com/test_regular',
  ...overrides,
});

describe('fin du prix de lancement', () => {
  it('reprend la constante de la SPEC', () => {
    expect(LAUNCH_PRICE_END).toBe('2026-10-18T23:59:59+02:00');
    expect(launchEnd().toISOString()).toBe('2026-10-18T21:59:59.000Z');
  });

  it('inclut la dernière seconde, et s’arrête juste après', () => {
    expect(isLaunchAt(TODAY)).toBe(true);
    expect(isLaunchAt(LAST_SECOND)).toBe(true);
    expect(isLaunchAt(new Date('2026-10-18T21:59:58.999Z'))).toBe(true);
    // Même instant que la fin du compte à rebours : prix et décompte basculent ensemble.
    expect(isLaunchAt(new Date('2026-10-18T21:59:59.001Z'))).toBe(false);
    expect(isLaunchAt(AFTER)).toBe(false);
    expect(isLaunchAt(new Date('2027-01-01T00:00:00Z'))).toBe(false);
  });
});

describe('priceInfo', () => {
  it('19 € et le lien de lancement avant la fin', () => {
    const info = priceInfo(TODAY, cfg());
    expect(info).toMatchObject({
      amount: 19,
      label: `19${NB}€`,
      isLaunch: true,
      paymentLink: 'https://buy.stripe.com/test_launch',
    });
  });

  it('29 € et le lien normal ensuite, sans recharger quoi que ce soit', () => {
    const info = priceInfo(AFTER, cfg());
    expect(info).toMatchObject({
      amount: 29,
      label: `29${NB}€`,
      isLaunch: false,
      paymentLink: 'https://buy.stripe.com/test_regular',
    });
    expect(info.sentence).toBe(`29${NB}€`);
  });

  it('suit les montants de la configuration', () => {
    expect(priceInfo(TODAY, cfg({ priceLaunch: 24 })).amount).toBe(24);
    expect(priceInfo(AFTER, cfg({ priceRegular: 34 })).label).toBe(`34${NB}€`);
  });
});

describe('priceSentence', () => {
  it('formulation imposée pendant la dernière semaine', () => {
    expect(priceSentence(TODAY)).toBe(`19${NB}€ jusqu'à dimanche 23:59, puis 29${NB}€`);
    expect(priceSentence(LAST_SECOND)).toBe(`19${NB}€ jusqu'à dimanche 23:59, puis 29${NB}€`);
  });

  it('précise la date quand la fin est à plus de 6 jours', () => {
    expect(priceSentence(new Date('2026-10-10T10:00:00Z'))).toBe(
      `19${NB}€ jusqu'au dimanche 18 octobre 23:59, puis 29${NB}€`,
    );
  });

  it('seulement le prix normal après le lancement', () => {
    expect(priceSentence(AFTER)).toBe(`29${NB}€`);
  });

  it('jamais de pourcentage ni de prix barré', () => {
    for (const when of [new Date('2026-10-01T00:00:00Z'), TODAY, LAST_SECOND, AFTER]) {
      const sentence = priceSentence(when);
      expect(sentence).not.toMatch(/%|-\s*\d|au lieu de|barré|promo/i);
    }
  });
});

describe('compte à rebours', () => {
  it('décompose le temps restant', () => {
    const left = countdownTo(launchEnd(), new Date('2026-10-14T10:00:00Z'));
    expect(left).not.toBeNull();
    expect(left).toMatchObject({ days: 4, hours: 11, minutes: 59, seconds: 59 });
  });

  it('renvoie null une fois la fin passée (bascule à 29 €)', () => {
    expect(countdownTo(launchEnd(), AFTER)).toBeNull();
    expect(countdownTo(launchEnd(), new Date(launchEnd().getTime()))).toBeNull();
  });

  it('formate en court et en toutes lettres', () => {
    const left = countdownTo(launchEnd(), new Date('2026-10-14T10:00:00Z'));
    if (!left) throw new Error('compte à rebours attendu');
    expect(formatCountdown(left)).toBe(`4${NB}j 11${NB}h 59${NB}min 59${NB}s`);
    expect(formatCountdown(left, false)).toBe(`4${NB}j 11${NB}h 59${NB}min`);
    expect(formatCountdownSpoken(left)).toBe('4 jours, 11 heures et 59 minutes');
  });

  it('dernière heure : plus de jours, singuliers corrects', () => {
    const left = countdownTo(launchEnd(), new Date('2026-10-18T20:58:59Z'));
    if (!left) throw new Error('compte à rebours attendu');
    expect(formatCountdown(left)).toBe(`1${NB}h 01${NB}min 00${NB}s`);
    expect(formatCountdownSpoken(left)).toBe('1 heure et 1 minute');
  });
});
