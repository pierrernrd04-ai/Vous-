/**
 * (c) Plan complet avec un jeton de test : /plan/#t=<jeton> → réglages → 24 semaines,
 * export agenda .ics. Et refus d'un jeton altéré.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { collectErrors, expectedPlanWeeks, saveScreenshot, testToken, todayInParis } from './helpers';

test('jeton valide : 24 semaines affichées et export .ics', async ({ page }) => {
  const errors = collectErrors(page);
  const expected = expectedPlanWeeks('marathon', '2027-04-04');
  // Avant le jour 1 (lundi 19/10/2026), le plan du marathon de Paris compte 24 semaines.
  if (todayInParis() <= '2026-10-19') expect(expected).toBe(24);
  const token = await testToken('w1-marathon-l2');
  await page.goto(`/plan/#t=${token}`);

  // Premier passage sur cet appareil : réglages préremplis (marathon de Paris, sub-4h30).
  await expect(page.locator('h1')).toHaveText('Règle ton plan');
  const planRequest = page.waitForRequest((request) => request.url().endsWith('/api/plan') && request.method() === 'POST');
  await page.getByRole('button', { name: 'Générer mon plan' }).click();
  const body = (await planRequest).postDataJSON() as { token: string; input: { race: string; level: string; raceDate: string } };
  expect(body.token).toBe(token);
  expect(body.input).toMatchObject({ race: 'marathon', level: 'l2', raceDate: '2027-04-04' });

  await expect(page.locator('#plan-title')).toHaveText('Marathon de Paris');
  const weeks = page.locator('.weeks > .week');
  await expect(weeks).toHaveCount(expected);
  await expect(weeks.first().locator('.week__index')).toHaveText('S1');
  await expect(weeks.last().locator('.week__index')).toHaveText(`S${expected}`);
  // Semaine courante (ou la première, avant le début) ouverte, avec ses séances.
  await expect(page.locator('.weeks > .week[open]')).toHaveCount(1);
  await expect(page.locator('.weeks > .week[open] .session').first()).toBeVisible();
  // La course est la dernière séance du plan.
  await expect(weeks.last().locator('.session').last()).toContainText(/42,195\s?km/);
  await expect(weeks.last().locator('.week__meta')).toContainText('+ la course');
  await page.locator('#plan-title').scrollIntoViewIfNeeded();
  await saveScreenshot(page, 'plan-360');

  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Agenda (.ics)' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/\.ics$/);
  const path = await download.path();
  const ics = readFileSync(path, 'utf8');
  expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  expect(ics).not.toMatch(/[^\r]\n/);
  const events = ics.match(/^BEGIN:VEVENT\r$/gm) ?? [];
  expect(events.length).toBe(expected * 4);
  expect(ics).toMatch(/^DTSTART;VALUE=DATE:20270404\r$/m);
  for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line, 'utf8'), line).toBeLessThanOrEqual(75);

  expect(errors).toEqual([]);
});

test('jeton altéré : page « Lien invalide »', async ({ page }) => {
  const token = await testToken();
  const [payload, signature] = token.split('.');
  const forged = `${payload}.${signature!.slice(0, -2)}${signature!.endsWith('AA') ? 'BB' : 'AA'}`;
  await page.goto(`/plan/#t=${forged}`);
  await page.getByRole('button', { name: 'Générer mon plan' }).click();
  await expect(page.locator('h1')).toHaveText('Lien invalide');
});

test('sans jeton : invitation à coller son lien personnel', async ({ page }) => {
  await page.goto('/plan/');
  await expect(page.locator('h1')).toHaveText('Ton plan t’attend');
  await expect(page.getByLabel('Colle ton lien personnel')).toBeVisible();
});
