import { describe, expect, it } from 'vitest';
import { parseInputFromQuery, validateInput } from '../../src/engine';
import type { PlanInput } from '../../src/engine';
import { planInputToSearchParams } from '../../src/shared/query';
import { specGrid } from './helpers';

function parse(query: string): Record<string, unknown> {
  return parseInputFromQuery(new URLSearchParams(query)) as Record<string, unknown>;
}

const FULL: PlanInput = {
  race: 'marathon',
  raceDate: '2027-04-04',
  raceName: 'Marathon de Paris',
  level: 'l3',
  t10: 2730,
  weeklyKm: 22.5,
  sessions: 5,
  longRunDay: 'sat',
  startDate: '2026-10-19',
};

describe('parseInputFromQuery', () => {
  it('aller-retour avec planInputToSearchParams (src/shared/query.ts)', () => {
    for (const input of [FULL, ...specGrid()]) {
      const parsed = parseInputFromQuery(planInputToSearchParams(input));
      expect(validateInput(parsed)).toEqual({ ok: true, input });
    }
  });

  it('accepte les variantes courantes', () => {
    expect(
      parse(
        'race=Semi-Marathon&raceDate=07/03/2027&level=L2&t10=45:30&weeklyKm=22,5&sessions=%204%20&longRunDay=Samedi',
      ),
    ).toEqual({ race: 'semi', raceDate: '2027-03-07', level: 'l2', t10: 2730, weeklyKm: 22.5, sessions: 4, longRunDay: 'sat' });
    expect(parse('race=demi-marathon').race).toBe('semi');
    expect(parse('race=MARATHON').race).toBe('marathon');
    expect(parse('longRunDay=dimanche').longRunDay).toBe('sun');
    expect(parse('level=1').level).toBe('finisher');
    expect(parse('raceDate=2027-3-7').raceDate).toBe('2027-03-07');
    expect(parse('raceDate=2027-04-04T09:00:00%2B02:00').raceDate).toBe('2027-04-04');
    expect(parse('startDate=19.10.2026').startDate).toBe('2026-10-19');
    expect(parse('weeklyKm=30%20km').weeklyKm).toBe(30);
  });

  it('lit le temps sur 10 km sous plusieurs formes', () => {
    const cases: [string, number][] = [
      ['2730', 2730],
      ['2730.5', 2730.5],
      ['45', 2700],
      ['45,5', 2730],
      ['45:30', 2730],
      ["45'30", 2730],
      ['1:02:05', 3725],
      ['1h05', 3900],
      ['50min', 3000],
      ['45min30s', 2730],
    ];
    for (const [raw, expected] of cases) expect(parse(`t10=${encodeURIComponent(raw)}`).t10, raw).toBe(expected);
  });

  it('omet les valeurs vides et ignore les clés inconnues', () => {
    expect(parse('race=&raceName=%20%20&foo=bar&__proto__=x')).toEqual({});
  });

  it('garde les valeurs illisibles pour que la validation les signale', () => {
    const parsed = parse('race=trail&t10=vite&weeklyKm=beaucoup&sessions=quatre&raceDate=demain&longRunDay=lundi');
    expect(parsed).toEqual({
      race: 'trail',
      t10: 'vite',
      weeklyKm: 'beaucoup',
      sessions: 'quatre',
      raceDate: 'demain',
      longRunDay: 'lundi',
    });
    const result = validateInput(parsed);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThanOrEqual(6);
  });

  it('la première valeur d\'une clé répétée l\'emporte', () => {
    expect(parse('sessions=3&sessions=5').sessions).toBe(3);
  });

  it('borne la longueur des valeurs (le nom trop long est refusé par la validation)', () => {
    const parsed = parse(`raceName=${'a'.repeat(5000)}`);
    expect(String(parsed.raceName).length).toBeLessThanOrEqual(201);
  });
});
