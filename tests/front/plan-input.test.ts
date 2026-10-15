/**
 * Valeurs du formulaire de plan (src/lib/plan-input.ts) : préremplissage par l'URL,
 * conversion vers PlanInput, date de départ mémorisée (le moteur démarre au premier
 * lundi à partir de `startDate`, le front fige donc `weeks[0].start`).
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VALUES,
  carryStartDate,
  isPlanFormValues,
  planReferenceDate,
  sameRace,
  validateValues,
  valuesFromQuery,
  valuesToInput,
  withStartDate,
  type PlanFormValues,
} from '../../src/lib/plan-input';

const TODAY = '2026-10-14';
const base: PlanFormValues = { ...DEFAULT_VALUES };
const other: PlanFormValues = { ...DEFAULT_VALUES, preset: 'autre', race: 'semi', raceDate: '2027-05-16', raceName: 'Semi de Lyon' };

describe('valuesFromQuery', () => {
  it('préremplit course, date et nom', () => {
    const values = valuesFromQuery(new URLSearchParams('race=semi&date=2027-04-25&name=Semi%20de%20Nantes'));
    expect(values).toMatchObject({ preset: 'autre', race: 'semi', raceDate: '2027-04-25', raceName: 'Semi de Nantes' });
  });

  it('reconnaît les courses de Paris par leur date', () => {
    expect(valuesFromQuery(new URLSearchParams('race=semi&date=2027-03-07')).preset).toBe('semi');
    expect(valuesFromQuery(new URLSearchParams('race=marathon')).preset).toBe('marathon');
  });

  it('ignore les valeurs invalides', () => {
    const values = valuesFromQuery(new URLSearchParams('race=trail&date=2027-02-30&level=pro'));
    expect(values).toEqual(base);
  });
});

describe('valuesToInput', () => {
  it('course de Paris : date et nom du préréglage', () => {
    expect(valuesToInput(base)).toEqual({
      race: 'marathon',
      raceDate: '2027-04-04',
      raceName: 'Marathon de Paris',
      level: 'finisher',
      t10: 3300,
      weeklyKm: 20,
      sessions: 4,
      longRunDay: 'sun',
    });
  });

  it('autre course : date libre, nom nettoyé', () => {
    const input = valuesToInput({ ...other, raceName: '  Semi   de Lyon ' });
    expect(input).toMatchObject({ race: 'semi', raceDate: '2027-05-16', raceName: 'Semi de Lyon' });
  });

  it('transmet startDate seulement si elle est valide', () => {
    expect(valuesToInput(withStartDate(base, '2026-10-19')).startDate).toBe('2026-10-19');
    expect(valuesToInput({ ...base, startDate: '2026-13-01' }).startDate).toBeUndefined();
    expect(valuesToInput(base)).not.toHaveProperty('startDate');
  });
});

describe('date de départ du plan complet', () => {
  const started = withStartDate(base, '2026-10-19');

  it('withStartDate pose ou retire la date', () => {
    expect(started.startDate).toBe('2026-10-19');
    expect(withStartDate(started, null)).not.toHaveProperty('startDate');
    expect(withStartDate(started, 'n’importe quoi')).not.toHaveProperty('startDate');
  });

  it('sameRace compare préréglage, distance et date', () => {
    expect(sameRace(base, { ...base, level: 'l3', sessions: 5 })).toBe(true);
    expect(sameRace(base, { ...base, preset: 'semi', race: 'semi' })).toBe(false);
    expect(sameRace(other, { ...other, raceDate: '2027-05-23' })).toBe(false);
  });

  it('même course : la date est gardée, le calendrier ne bouge pas', () => {
    const next = carryStartDate({ ...base, level: 'l2' }, started, '2026-12-01');
    expect(next.startDate).toBe('2026-10-19');
    expect(next.level).toBe('l2');
  });

  it('autre course avant le début : la date est oubliée', () => {
    const future = withStartDate(base, '2026-10-19');
    expect(carryStartDate(other, future, TODAY)).not.toHaveProperty('startDate');
  });

  it('autre course en cours de prépa : la date est gardée', () => {
    expect(carryStartDate(other, started, '2026-11-20').startDate).toBe('2026-10-19');
  });

  it('pas encore de date mémorisée : rien à reporter', () => {
    expect(carryStartDate(base, null, TODAY)).not.toHaveProperty('startDate');
    expect(carryStartDate(base, base, TODAY)).not.toHaveProperty('startDate');
  });

  it('les 8 semaines minimales se comptent depuis le départ d’un plan commencé', () => {
    expect(planReferenceDate('2027-03-01', '2026-10-19')).toBe('2026-10-19');
    expect(planReferenceDate(TODAY, '2026-10-19')).toBe(TODAY);
    expect(planReferenceDate(TODAY, undefined)).toBe(TODAY);
    // En février, changer d'objectif pour le marathon du 4 avril reste possible.
    expect(validateValues({ ...started, level: 'l3' }, '2027-02-15')).toEqual({});
    expect(validateValues({ ...base, level: 'l3' }, '2027-02-15').preset).toMatch(/moins de 8 semaines/);
  });

  it('isPlanFormValues accepte une date valide et refuse une date abîmée', () => {
    expect(isPlanFormValues(started)).toBe(true);
    expect(isPlanFormValues(base)).toBe(true);
    expect(isPlanFormValues({ ...base, startDate: 42 })).toBe(false);
    expect(isPlanFormValues({ ...base, startDate: '2026-02-31' })).toBe(false);
  });
});

describe('validateValues', () => {
  it('valeurs par défaut valides', () => {
    expect(validateValues(base, TODAY)).toEqual({});
  });

  it('messages en français, champ par champ', () => {
    const errors = validateValues({ ...other, t10: 1200, weeklyKm: 12.5, raceDate: '2026-11-15' }, TODAY);
    expect(errors.t10).toMatch(/entre 30 min et 1 h 30/);
    expect(errors.weeklyKm).toMatch(/nombre entier/);
    expect(errors.raceDate).toMatch(/moins de 8 semaines/);
  });
});
