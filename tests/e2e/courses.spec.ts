/**
 * (d) Pages SEO /courses/<slug>/ générées au build depuis data/races.json.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { collectErrors, normalize, saveScreenshot } from './helpers';

interface RaceEntry {
  slug: string;
  name: string;
  kind: 'marathon' | 'semi';
  date: string;
}

const races = JSON.parse(readFileSync(resolve('data/races.json'), 'utf8')) as RaceEntry[];
const lcFirst = (text: string): string => text.charAt(0).toLocaleLowerCase('fr-FR') + text.slice(1);

const SAMPLES = ['marathon-de-paris', 'semi-de-paris', 'marathon-de-nantes'];

for (const slug of SAMPLES) {
  test(`/courses/${slug}/ : H1, title, canonical et JSON-LD`, async ({ page }) => {
    const race = races.find((r) => r.slug === slug);
    expect(race, `${slug} dans data/races.json`).toBeDefined();
    const errors = collectErrors(page);
    await page.goto(`/courses/${slug}/`);

    expect(normalize(await page.locator('h1').textContent())).toBe(`Plan ${lcFirst(race!.name)} 2027`);
    await expect(page).toHaveTitle(new RegExp(`^Plan ${lcFirst(race!.name)} 2027`));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/courses/${slug}/$`));
    await expect(page.locator('[data-race-page]')).toHaveAttribute('data-race-date', race!.date);

    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = jsonLd.flatMap((text) => {
      const data = JSON.parse(text) as { '@type'?: string; '@graph'?: { '@type': string }[] };
      return data['@graph'] ? data['@graph'].map((node) => node['@type']) : [data['@type']];
    });
    expect(types).toEqual(expect.arrayContaining(['Product', 'FAQPage', 'BreadcrumbList']));
    await expect(page.getByText(/officiel/i)).toHaveCount(0);

    // Lien vers la semaine 1 gratuite, préréglé sur la course.
    const free = page.locator('a[data-free-link]').first();
    await expect(free).toHaveAttribute('href', new RegExp(`/gratuit/\\?race=${race!.kind}&date=${race!.date}`));
    if (slug === 'marathon-de-nantes') await saveScreenshot(page, 'course-marathon-de-nantes-360');
    expect(errors).toEqual([]);
  });
}

test('le bouton d’achat d’une page de course ouvre la fenêtre de paiement', async ({ page }) => {
  await page.goto('/courses/marathon-de-nantes/');
  await page.locator('[data-course-checkout]').first().click();
  const dialog = page.locator('dialog#checkout-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#checkout-waiver')).not.toBeChecked();
  await expect(dialog.locator('button[type="submit"]')).toHaveAttribute('aria-disabled', 'true');
});

test('/courses/ liste toutes les courses de data/races.json', async ({ page }) => {
  await page.goto('/courses/');
  await expect(page.locator('h1')).toHaveText(/Courses de printemps\s+2027/);
  for (const race of races) await expect(page.locator(`a[href="/courses/${race.slug}/"]`).first()).toBeAttached();
});
