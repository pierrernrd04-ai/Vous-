/**
 * (b) Page gratuite : formulaire → semaine 1 du marathon de Paris, 4 séances datées
 * à partir du lundi 19/10/2026 (premier lundi à venir, date du serveur à Paris).
 */
import { expect, test } from '@playwright/test';
import { addDays, collectErrors, expectedPlanWeeks, firstMondayOnOrAfter, normalize, saveScreenshot, todayInParis } from './helpers';

test('formulaire → semaine 1 affichée, 4 séances datées, semaines suivantes verrouillées', async ({ page }) => {
  const errors = collectErrors(page);
  const monday = firstMondayOnOrAfter(todayInParis());
  const weeks = expectedPlanWeeks('marathon', '2027-04-04');
  // Lancé avant le lundi 19/10/2026 : c'est le jour 1 annoncé partout sur le site.
  const beforeDay1 = todayInParis() <= '2026-10-19';
  if (beforeDay1) {
    expect(monday).toBe('2026-10-19');
    expect(weeks).toBe(24);
  }

  // Défilement instantané vers le résultat (capture d'écran stable).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/gratuit/');
  await expect(page.locator('h1')).toHaveText(/Ta semaine 1\s+offerte/);
  const form = page.locator('#plan-form form');
  await expect(form).toBeVisible();

  // Valeurs par défaut : marathon de Paris (4 avril 2027), 4 séances, sortie longue le dimanche.
  const previewRequest = page.waitForRequest((request) => request.url().includes('/api/preview?'));
  await form.getByRole('button', { name: 'Voir ma semaine 1' }).click();
  const query = new URL((await previewRequest).url()).searchParams;
  expect(query.get('race')).toBe('marathon');
  expect(query.get('raceDate')).toBe('2027-04-04');
  expect(query.get('sessions')).toBe('4');

  const preview = page.locator('#preview');
  await expect(preview).toBeVisible();
  expect(normalize(await preview.locator('#result-title').textContent())).toBe(`Ta prépa : ${weeks} semaines`);
  await expect(preview.locator('.result__head .eyebrow')).toContainText('Marathon de Paris');
  if (beforeDay1) expect(normalize(await preview.locator('.result__dates').textContent())).toContain('Jour 1 : lundi 19 octobre');

  const sessions = preview.locator('.session-list .session');
  await expect(sessions).toHaveCount(4);
  const dates = await preview.locator('.session-list time.session__day').evaluateAll((els) =>
    els.map((el) => el.getAttribute('datetime')),
  );
  expect(dates).toEqual([addDays(monday, 1), addDays(monday, 3), addDays(monday, 5), addDays(monday, 6)]);
  for (const date of dates) {
    expect(date! >= monday && date! <= addDays(monday, 6), `${date} dans la semaine du ${monday}`).toBe(true);
  }
  await expect(sessions.last()).toContainText('Sortie longue');
  // Chaque séance courue propose sa boucle Traceo.
  await expect(preview.locator('.session-list .btn--loop').first()).toHaveAttribute('href', /traceorun\.pages\.dev\/app\?km=\d/);

  // Vue d'ensemble : les semaines suivantes verrouillées, sans leur contenu.
  await expect(preview.locator('.locked-weeks > li')).toHaveCount(weeks - 1);
  await expect(preview.locator('.unlock')).toContainText(`Débloque les ${weeks - 1} semaines suivantes`);
  await expect(preview.locator('.pace-table')).toBeVisible();

  // « Au plus fort » : le pic d'entraînement, pas la semaine de course (course comprise).
  await expect(preview.locator('.result__head .stat').nth(3)).toContainText(/^48\s?km/);
  await preview.locator('#week1-title').evaluate((el) => {
    el.scrollIntoView({ block: 'start', behavior: 'instant' });
    window.scrollBy({ top: -76, behavior: 'instant' });
  });
  await saveScreenshot(page, 'gratuit-semaine1-360');
  expect(errors).toEqual([]);
});

test('date libre trop proche : message d’erreur en français, pas de semaine affichée', async ({ page }) => {
  await page.goto('/gratuit/?race=semi&date=' + addDays(todayInParis(), 20) + '&name=Semi%20test');
  const form = page.locator('#plan-form form');
  await form.getByRole('button', { name: 'Voir ma semaine 1' }).click();
  await expect(page.locator('#plan-form')).toContainText(/semaines/);
  await expect(page.locator('#preview')).toBeHidden();
});
