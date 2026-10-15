/**
 * (a) Landing : rendu, prix 19 € puis 29 € (horloge simulée), fenêtre d'achat
 * avec case de renonciation non cochée et bouton bloqué tant qu'elle ne l'est pas.
 */
import { expect, test } from '@playwright/test';
import { collectErrors, normalize, saveScreenshot } from './helpers';

/** Fin du prix de lancement (SPEC section 1). */
const LAUNCH_PRICE_END = '2026-10-18T23:59:59+02:00';
const launchEnd = Date.parse(LAUNCH_PRICE_END);

test.describe('landing', () => {
  test('rendu, titre, avertissement santé et aucune erreur', async ({ page }) => {
    const errors = collectErrors(page);
    await page.clock.install({ time: new Date('2026-10-14T10:00:00+02:00') });
    await page.goto('/');
    await expect(page).toHaveTitle(/Pass J-24/);
    await expect(page.locator('h1')).toHaveText(/Ta prépa commence\s+lundi\./);
    await expect(page.locator('.hero__day1')).toContainText('lundi 19 octobre');
    await expect(page.locator('.health-warning').first()).toBeVisible();
    await expect(page.getByText(/officiel/i)).toHaveCount(0);
    await saveScreenshot(page, 'landing-360');
    expect(errors).toEqual([]);
  });

  test('19 € jusqu’au dimanche 18/10/2026 23:59 (Paris)', async ({ page }) => {
    await page.clock.install({ time: new Date(launchEnd - 60_000) });
    await page.goto('/');
    const amount = page.locator('.hero__amount');
    await expect(amount).toHaveText(/^19\s€$/);
    expect(normalize(await page.locator('.hero__sentence').textContent())).toMatch(/^19 € jusqu['’]à dimanche 23:59, puis 29 €$/);
    await expect(page.locator('.hero__offer .countdown')).toBeVisible();
    await expect(page.locator('.hero__offer [data-countdown]')).toHaveText(/\d/);
    // Jamais de prix barré.
    await expect(page.locator('del, s, strike')).toHaveCount(0);
  });

  test('29 € dès le lundi 19/10/2026 00:00, et bascule sans recharger', async ({ page }) => {
    await page.clock.install({ time: new Date(launchEnd - 5_000) });
    await page.goto('/');
    await expect(page.locator('.hero__amount')).toHaveText(/^19\s€$/);
    await page.clock.runFor(10_000);
    await expect(page.locator('.hero__amount')).toHaveText(/^29\s€$/);
    await expect(page.locator('.hero__sentence')).toHaveText(/^29\s€$/);
    await expect(page.locator('.hero__offer .countdown')).toBeHidden();

    await page.clock.setFixedTime(new Date('2026-11-02T12:00:00+01:00'));
    await page.reload();
    await expect(page.locator('.hero__amount')).toHaveText(/^29\s€$/);
    await expect(page.locator('.site-header [data-checkout]')).toContainText(/29\s€/);
  });

  test('le bouton d’achat ouvre la fenêtre ; payer est bloqué tant que la case n’est pas cochée', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-15T09:00:00+02:00') });
    let paymentUrl = '';
    await page.route('https://buy.stripe.com/**', async (route) => {
      paymentUrl = route.request().url();
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Stripe (test)</title><p>Paiement factice</p>' });
    });

    await page.goto('/');
    await page.locator('.hero__ctas [data-checkout]').first().click();
    const dialog = page.locator('dialog#checkout-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#checkout-title')).toHaveText('Ton plan complet, jusqu’au jour J');
    await expect(dialog.locator('.checkout__amount')).toHaveText(/^19\s€$/);

    const waiver = dialog.locator('#checkout-waiver');
    const pay = dialog.locator('button[type="submit"]');
    await expect(waiver).not.toBeChecked();
    await expect(dialog.locator('.waiver__label')).toContainText('art. L221-28 13°');
    await expect(dialog.locator('.waiver a[href="/cgv/"]')).toBeVisible();
    await expect(pay).toHaveAttribute('aria-disabled', 'true');
    await expect(pay).toBeDisabled();
    await expect(pay).toContainText(/Payer 19\s€/);

    // Clic forcé sans la case : rien ne part, l'erreur s'affiche.
    await pay.click({ force: true });
    await expect(dialog.locator('#checkout-waiver-error')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    expect(paymentUrl).toBe('');

    await dialog.locator('#checkout-email').fill('coureur@exemple.fr');
    await waiver.check();
    await expect(pay).toHaveAttribute('aria-disabled', 'false');
    await expect(pay).toBeEnabled();
    await pay.click();
    await page.waitForURL(/buy\.stripe\.com/);
    const url = new URL(paymentUrl);
    expect(url.origin + url.pathname).toBe('https://buy.stripe.com/test_e2e_lancement');
    expect(url.searchParams.get('client_reference_id')).toBe('w1-marathon-finisher');
    expect(url.searchParams.get('prefilled_email')).toBe('coureur@exemple.fr');
  });

  test('après le lancement, le paiement passe par le lien à 29 €', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-20T09:00:00+02:00') });
    let paymentUrl = '';
    await page.route('https://buy.stripe.com/**', async (route) => {
      paymentUrl = route.request().url();
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Stripe (test)</title>' });
    });
    await page.goto('/');
    await page.locator('.hero__ctas [data-checkout]').first().click();
    const dialog = page.locator('dialog#checkout-dialog');
    await expect(dialog.locator('.checkout__amount')).toHaveText(/^29\s€$/);
    await dialog.locator('#checkout-waiver').check();
    await dialog.locator('button[type="submit"]').click();
    await page.waitForURL(/buy\.stripe\.com/);
    expect(paymentUrl).toContain('https://buy.stripe.com/test_e2e_normal?');
  });
});
