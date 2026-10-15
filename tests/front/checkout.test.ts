/**
 * Achat (src/lib/checkout.ts, partie pure) : référence client `w1-<course>-<niveau>`,
 * URL du Payment Link Stripe (prix courant, `client_reference_id`, `prefilled_email`),
 * PayPal de secours, état « paiement bientôt disponible » (SPEC section 4).
 */
import { describe, expect, it } from 'vitest';
import { config, type SiteConfig } from '../../src/config';
import {
  PAYPAL_DELAY_TEXT,
  WAIVER_TEXT,
  buildPaypalUrl,
  buildStripeCheckoutUrl,
  clientReferenceId,
  hasWaiverRef,
  isLikelyEmail,
  parseClientReference,
  resolveCheckout,
} from '../../src/lib/checkout';

const BEFORE = new Date('2026-10-14T10:00:00Z');
const AFTER = new Date('2026-10-19T08:00:00Z');
const LAUNCH_LINK = 'https://buy.stripe.com/test_19eur';
const REGULAR_LINK = 'https://buy.stripe.com/test_29eur';

const cfg = (overrides: Partial<SiteConfig> = {}): SiteConfig => ({
  ...config,
  paymentLinkLaunch: LAUNCH_LINK,
  paymentLinkRegular: REGULAR_LINK,
  paypalFallbackUrl: '',
  stripeEnabled: true,
  ...overrides,
});

describe('textes imposés', () => {
  it('case de renonciation mot pour mot', () => {
    expect(WAIVER_TEXT).toBe(
      "Je demande l'accès immédiat au contenu numérique et je reconnais perdre mon droit de rétractation (art. L221-28 13° C. conso)",
    );
  });

  it('délai PayPal', () => {
    expect(PAYPAL_DELAY_TEXT).toBe('accès envoyé par e-mail sous 2 h (8 h-22 h)');
  });
});

describe('référence client', () => {
  it('w1-<course>-<niveau>', () => {
    expect(clientReferenceId('marathon', 'l2')).toBe('w1-marathon-l2');
    expect(clientReferenceId('semi', 'finisher')).toBe('w1-semi-finisher');
  });

  it('reconnaît une référence prouvant la renonciation', () => {
    expect(hasWaiverRef('w1-semi-l3')).toBe(true);
    expect(hasWaiverRef('')).toBe(false);
    expect(hasWaiverRef('paypal-123')).toBe(false);
    expect(hasWaiverRef(null)).toBe(false);
    expect(hasWaiverRef(undefined)).toBe(false);
  });

  it('relit course et niveau, et refuse le reste', () => {
    expect(parseClientReference('w1-marathon-l3')).toEqual({ race: 'marathon', level: 'l3' });
    expect(parseClientReference('w1-semi-finisher')).toEqual({ race: 'semi', level: 'finisher' });
    expect(parseClientReference('w1-trail-l2')).toBeNull();
    expect(parseClientReference('w1-marathon-l9')).toBeNull();
    expect(parseClientReference('w2-marathon-l2')).toBeNull();
    expect(parseClientReference(null)).toBeNull();
  });
});

describe('isLikelyEmail', () => {
  it.each(['prenom@exemple.fr', 'a.b+c@sous.domaine.com', '  marie@club.run  '])('accepte %s', (email) => {
    expect(isLikelyEmail(email)).toBe(true);
  });

  it.each(['', 'prenom', 'prenom@', '@exemple.fr', 'prenom@exemple', 'pre nom@exemple.fr', `${'a'.repeat(250)}@x.fr`])(
    'refuse « %s »',
    (email) => {
      expect(isLikelyEmail(email)).toBe(false);
    },
  );
});

describe('buildStripeCheckoutUrl', () => {
  it('ajoute la référence et l’e-mail prérempli, encodés', () => {
    const url = buildStripeCheckoutUrl(LAUNCH_LINK, { race: 'marathon', level: 'l2', email: ' marie+run@exemple.fr ' });
    expect(url).toBe(`${LAUNCH_LINK}?client_reference_id=w1-marathon-l2&prefilled_email=marie%2Brun%40exemple.fr`);
    const parsed = new URL(url ?? '');
    expect(parsed.searchParams.get('prefilled_email')).toBe('marie+run@exemple.fr');
  });

  it('ignore un e-mail vide ou invalide', () => {
    expect(buildStripeCheckoutUrl(LAUNCH_LINK, { race: 'semi', level: 'l3', email: '' })).toBe(
      `${LAUNCH_LINK}?client_reference_id=w1-semi-l3`,
    );
    expect(buildStripeCheckoutUrl(LAUNCH_LINK, { race: 'semi', level: 'l3', email: 'pas-un-email' })).toBe(
      `${LAUNCH_LINK}?client_reference_id=w1-semi-l3`,
    );
  });

  it('garde les paramètres existants et remplace une ancienne référence', () => {
    const base = `${LAUNCH_LINK}?locale=fr&client_reference_id=ancien&prefilled_email=vieux%40x.fr`;
    const url = new URL(buildStripeCheckoutUrl(base, { race: 'semi', level: 'finisher' }) ?? '');
    expect(url.searchParams.get('locale')).toBe('fr');
    expect(url.searchParams.get('client_reference_id')).toBe('w1-semi-finisher');
    expect(url.searchParams.has('prefilled_email')).toBe(false);
  });

  it('refuse une URL vide, invalide ou non https', () => {
    expect(buildStripeCheckoutUrl('', { race: 'marathon', level: 'l2' })).toBeNull();
    expect(buildStripeCheckoutUrl('   ', { race: 'marathon', level: 'l2' })).toBeNull();
    expect(buildStripeCheckoutUrl('buy.stripe.com/test', { race: 'marathon', level: 'l2' })).toBeNull();
    expect(buildStripeCheckoutUrl('http://buy.stripe.com/test', { race: 'marathon', level: 'l2' })).toBeNull();
    expect(buildStripeCheckoutUrl('javascript:alert(1)', { race: 'marathon', level: 'l2' })).toBeNull();
  });
});

describe('buildPaypalUrl', () => {
  it('ajoute le montant à un lien paypal.me sans montant', () => {
    expect(buildPaypalUrl('https://paypal.me/traceo', 19)).toBe('https://paypal.me/traceo/19EUR');
    expect(buildPaypalUrl('https://www.paypal.me/traceo', 29)).toBe('https://www.paypal.me/traceo/29EUR');
  });

  it('laisse tel quel un lien qui a déjà un montant, ou un autre lien PayPal', () => {
    expect(buildPaypalUrl('https://paypal.me/traceo/25EUR', 29)).toBe('https://paypal.me/traceo/25EUR');
    expect(buildPaypalUrl('https://www.paypal.com/ncp/payment/ABC123', 29)).toBe('https://www.paypal.com/ncp/payment/ABC123');
  });

  it('refuse une URL vide ou non https', () => {
    expect(buildPaypalUrl('', 19)).toBeNull();
    expect(buildPaypalUrl('http://paypal.me/traceo', 19)).toBeNull();
  });
});

describe('resolveCheckout', () => {
  const params = { race: 'marathon' as const, level: 'l3' as const, email: 'jo@exemple.fr' };

  it('Stripe au prix de lancement, puis au prix normal', () => {
    const before = resolveCheckout(params, BEFORE, cfg());
    expect(before.mode).toBe('stripe');
    expect(before.amount).toBe(19);
    expect(before.isLaunch).toBe(true);
    expect(before.url).toBe(`${LAUNCH_LINK}?client_reference_id=w1-marathon-l3&prefilled_email=jo%40exemple.fr`);

    const after = resolveCheckout(params, AFTER, cfg());
    expect(after.mode).toBe('stripe');
    expect(after.amount).toBe(29);
    expect(after.isLaunch).toBe(false);
    expect(after.url?.startsWith(`${REGULAR_LINK}?`)).toBe(true);
  });

  it('jamais de bouton cassé : Stripe activé mais lien du prix courant vide', () => {
    const target = resolveCheckout(params, AFTER, cfg({ paymentLinkRegular: '' }));
    expect(target.mode).toBe('unavailable');
    expect(target.url).toBeNull();
  });

  it('PayPal seulement quand Stripe est désactivé', () => {
    const paypal = resolveCheckout(params, BEFORE, cfg({ stripeEnabled: false, paypalFallbackUrl: 'https://paypal.me/traceo' }));
    expect(paypal.mode).toBe('paypal');
    expect(paypal.url).toBe('https://paypal.me/traceo/19EUR');

    const stripeWins = resolveCheckout(params, BEFORE, cfg({ paypalFallbackUrl: 'https://paypal.me/traceo' }));
    expect(stripeWins.mode).toBe('stripe');
  });

  it('« paiement bientôt disponible » quand rien n’est configuré', () => {
    const none = resolveCheckout(params, BEFORE, cfg({ stripeEnabled: false, paypalFallbackUrl: '' }));
    expect(none.mode).toBe('unavailable');
    expect(none.url).toBeNull();
    expect(none.label).toBe('19 €');
    const brokenPaypal = resolveCheckout(params, BEFORE, cfg({ stripeEnabled: false, paypalFallbackUrl: 'http://paypal.me/x' }));
    expect(brokenPaypal.mode).toBe('unavailable');
  });

  it('configuration livrée : aucun moyen de paiement, donc état « bientôt disponible »', () => {
    if (!config.stripeEnabled && !config.paypalFallbackUrl) {
      expect(resolveCheckout(params, BEFORE).mode).toBe('unavailable');
    } else {
      expect(resolveCheckout(params, BEFORE).url).not.toBeNull();
    }
  });
});
