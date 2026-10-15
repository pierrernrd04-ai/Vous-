/**
 * Calendrier « si tu crées ton plan aujourd'hui » de src/pages/course.ts : il doit
 * reproduire exactement le moteur (src/engine), qui reste côté serveur. Comparaison sur
 * toutes les courses de data/races.json et un jour sur trois d'août 2026 à juin 2027.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateRaces } from '../../build/races-plugin';
import { generatePlan } from '../../src/engine';
import { addDaysIso } from '../../src/lib/format';
import { FULL_PLAN_WEEKS, MIN_PLAN_WEEKS, daysUntilLabel, planCalendar } from '../../src/pages/course';

const { races } = validateRaces(JSON.parse(readFileSync(resolve(__dirname, '../../data/races.json'), 'utf8')));

function engineCalendar(race: (typeof races)[number], today: string): { start: string; weeks: number } | null {
  try {
    const plan = generatePlan(
      { race: race.kind, raceDate: race.date, level: 'finisher', t10: 3300, weeklyKm: 20, sessions: 4, longRunDay: 'sun' },
      today,
    );
    return { start: plan.weeks[0]?.start ?? '', weeks: plan.weeks.length };
  } catch {
    return null;
  }
}

describe('planCalendar (navigateur) = moteur', () => {
  const days: string[] = [];
  for (let day = '2026-08-01'; day <= '2027-06-05'; day = addDaysIso(day, 3)) days.push(day);

  it('donne le même lundi de départ et la même durée pour chaque course et chaque jour', () => {
    let compared = 0;
    for (const race of races) {
      for (const today of days) {
        const engine = engineCalendar(race, today);
        const calendar = planCalendar(race.kind, race.date, today);
        if (engine === null) {
          expect(calendar.status, `${race.slug} le ${today}`).not.toBe('ok');
        } else {
          expect(calendar, `${race.slug} le ${today}`).toMatchObject({ status: 'ok', start: engine.start, weeks: engine.weeks });
        }
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(races.length * 90);
  });

  it('reporte le départ quand la course est loin, raccourcit quand elle est proche', () => {
    expect(planCalendar('marathon', '2027-04-04', '2026-10-15')).toEqual({
      status: 'ok',
      start: '2026-10-19',
      weeks: 24,
      deferred: false,
      shortened: false,
    });
    expect(planCalendar('marathon', '2027-04-25', '2026-10-15')).toMatchObject({ start: '2026-11-09', weeks: 24, deferred: true });
    expect(planCalendar('semi', '2027-02-21', '2026-10-15')).toMatchObject({ start: '2026-10-19', weeks: 18, shortened: true });
    expect(planCalendar('semi', '2027-02-21', '2027-01-04')).toEqual({ status: 'too-short', weeksLeft: 7 });
    expect(planCalendar('semi', '2027-02-21', '2027-02-22')).toEqual({ status: 'past' });
    expect(FULL_PLAN_WEEKS).toEqual({ marathon: 24, semi: 20 });
    expect(MIN_PLAN_WEEKS).toBe(8);
  });
});

describe('daysUntilLabel', () => {
  it('formule le délai en français', () => {
    expect(daysUntilLabel(0)).toBe('aujourd’hui');
    expect(daysUntilLabel(1)).toBe('demain');
    expect(daysUntilLabel(12)?.replace(String.fromCharCode(0xa0), ' ')).toBe('dans 12 jours');
    expect(daysUntilLabel(-1)).toBeNull();
    expect(daysUntilLabel(Number.NaN)).toBeNull();
  });
});
