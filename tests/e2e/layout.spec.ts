/**
 * (e) Écran 360 × 740 : aucune page ne défile horizontalement (pages statiques,
 * toutes les pages de course, page gratuite remplie, plan complet, états de /merci/).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { collectErrors, expectNoHorizontalScroll, expectedPlanWeeks, testToken } from './helpers';

const races = JSON.parse(readFileSync(resolve('data/races.json'), 'utf8')) as { slug: string }[];

const STATIC_PAGES = [
  '/',
  '/gratuit/',
  '/plan/',
  '/merci/',
  '/merci/?session_id=pas-un-id',
  '/cgv/',
  '/mentions-legales/',
  '/confidentialite/',
  '/retractation/',
  '/courses/',
  ...races.map((race) => `/courses/${race.slug}/`),
];

test.describe('360 × 740 sans défilement horizontal', () => {
  test('taille d’écran du test', async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 360, height: 740 });
  });

  for (const path of STATIC_PAGES) {
    test(path, async ({ page }) => {
      const errors = collectErrors(page);
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalScroll(page, path);
      // Fenêtre d'achat ouverte (pages qui en ont une).
      const trigger = page.locator('.site-header [data-checkout]');
      if ((await trigger.count()) > 0 && (await trigger.isVisible())) {
        await trigger.click();
        await expect(page.locator('dialog#checkout-dialog')).toBeVisible();
        await expectNoHorizontalScroll(page, `${path} (fenêtre d'achat)`);
      }
      // /merci/ sans session valide affiche une erreur attendue (400) dans la console.
      const unexpected = errors.filter((e) => !(path.startsWith('/merci/') && /status of 400/.test(e)));
      expect(unexpected, path).toEqual([]);
    });
  }

  test('/gratuit/ après envoi du formulaire', async ({ page }) => {
    await page.goto('/gratuit/');
    await page.getByRole('button', { name: 'Voir ma semaine 1' }).click();
    await expect(page.locator('#preview .session').first()).toBeVisible();
    await expectNoHorizontalScroll(page, '/gratuit/ (semaine 1)');
  });

  test('/plan/ complet, toutes les semaines dépliées', async ({ page }) => {
    await page.goto(`/plan/#t=${await testToken()}`);
    await page.getByRole('button', { name: 'Générer mon plan' }).click();
    const weeks = expectedPlanWeeks('marathon', '2027-04-04');
    await expect(page.locator('.weeks > .week')).toHaveCount(weeks);
    await page.getByRole('button', { name: 'Tout déplier' }).click();
    await expect(page.locator('.weeks > .week[open]')).toHaveCount(weeks);
    await expectNoHorizontalScroll(page, `/plan/ (${weeks} semaines dépliées)`);
    await page.getByRole('button', { name: 'Image story' }).click();
    await expectNoHorizontalScroll(page, '/plan/ (image story)');
  });
});
