import { describe, expect, it } from 'vitest';
import { validateInput } from '../../src/engine';
import type { PlanInput } from '../../src/engine';

const VALID: PlanInput = {
  race: 'semi',
  raceDate: '2027-03-07',
  level: 'l2',
  t10: 3000,
  weeklyKm: 25,
  sessions: 4,
  longRunDay: 'sun',
};

/** Les messages utilisent des espaces insécables (typographie française) : on les aplanit pour comparer. */
function errorsFor(input: unknown): string[] {
  const result = validateInput(input);
  if (result.ok) throw new Error('entrée acceptée à tort');
  return result.errors.map((e) => e.replace(/\u00a0/g, ' '));
}

describe('validateInput', () => {
  it('accepte une entrée valide et la normalise', () => {
    const result = validateInput({ ...VALID, extra: 'ignoré', raceName: '  Semi   de Paris ' });
    expect(result).toEqual({ ok: true, input: { ...VALID, raceName: 'Semi de Paris' } });
  });

  it('omet les champs facultatifs vides', () => {
    const result = validateInput({ ...VALID, raceName: '   ', startDate: '' });
    expect(result.ok && Object.keys(result.input)).toEqual([
      'race',
      'raceDate',
      'level',
      't10',
      'weeklyKm',
      'sessions',
      'longRunDay',
    ]);
  });

  it('accepte les bornes de la SPEC', () => {
    for (const t10 of [1800, 5400]) expect(validateInput({ ...VALID, t10 }).ok, String(t10)).toBe(true);
    for (const weeklyKm of [0, 120, 22.5]) expect(validateInput({ ...VALID, weeklyKm }).ok, String(weeklyKm)).toBe(true);
    for (const sessions of [3, 4, 5]) expect(validateInput({ ...VALID, sessions }).ok).toBe(true);
    for (const longRunDay of ['sat', 'sun']) expect(validateInput({ ...VALID, longRunDay }).ok).toBe(true);
    expect(validateInput({ ...VALID, startDate: '2026-10-19', raceDate: '2027-03-07' }).ok).toBe(true);
    expect(validateInput({ ...VALID, startDate: '2027-03-07', raceDate: '2027-03-07' }).ok).toBe(true);
  });

  it('refuse ce qui n\'est pas un objet', () => {
    for (const value of [null, undefined, 'marathon', 42, [], [VALID]]) {
      expect(errorsFor(value)).toEqual(['Les paramètres du plan sont manquants ou illisibles.']);
    }
  });

  it.each([
    ['race', 'trail', /course doit être « marathon » ou « semi »/],
    ['race', undefined, /Choisis ta course/],
    ['raceDate', '2027-02-30', /date de course doit être une date valide/],
    ['raceDate', '07/03/2027', /AAAA-MM-JJ/],
    ['raceDate', 20270307, /date de course/],
    ['raceDate', '1999-04-04', /entre 2000 et 2100/],
    ['raceDate', undefined, /Indique la date de ta course/],
    ['raceName', 42, /nom de la course doit être un texte/],
    ['raceName', 'x'.repeat(81), /80 caractères/],
    ['raceName', 'Semi\nde Paris', /caractères non autorisés/],
    ['level', 'expert', /Choisis un niveau : Finisher, sub-2h ou sub-1h45/],
    ['t10', 1799, /entre 30 min et 1 h 30/],
    ['t10', 5401, /entre 30 min et 1 h 30/],
    ['t10', '3000', /entre 30 min et 1 h 30/],
    ['t10', Number.NaN, /entre 30 min et 1 h 30/],
    ['t10', Number.POSITIVE_INFINITY, /entre 30 min et 1 h 30/],
    ['t10', undefined, /Indique ton temps actuel sur 10 km/],
    ['weeklyKm', -1, /entre 0 et 120 km/],
    ['weeklyKm', 121, /entre 0 et 120 km/],
    ['weeklyKm', '25', /entre 0 et 120 km/],
    ['weeklyKm', null, /Indique combien de kilomètres/],
    ['sessions', 2, /3, 4 ou 5 séances/],
    ['sessions', 6, /3, 4 ou 5 séances/],
    ['sessions', '4', /3, 4 ou 5 séances/],
    ['sessions', 4.5, /3, 4 ou 5 séances/],
    ['longRunDay', 'mon', /samedi ou dimanche/],
    ['longRunDay', 'Sat', /samedi ou dimanche/],
    ['startDate', '2026-13-01', /date de début doit être une date valide/],
    ['startDate', '2027-03-08', /date de début doit précéder la date de course/],
  ] as const)('%s = %j → erreur en français', (key, value, message) => {
    const errors = errorsFor({ ...VALID, [key]: value });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(message);
  });

  it('nomme les niveaux de la course choisie', () => {
    expect(errorsFor({ ...VALID, race: 'marathon', level: 'x' })[0]).toBe('Choisis un niveau : Finisher, sub-4h30 ou sub-4h.');
    expect(errorsFor({ ...VALID, race: 'x', level: 'x' })).toContain('Choisis un niveau : Finisher, l2 ou l3.');
  });

  it('cumule toutes les erreurs, dans l\'ordre des champs', () => {
    const errors = errorsFor({ race: 'velo', t10: 0, sessions: 9 });
    expect(errors).toHaveLength(7);
    expect(errors[0]).toMatch(/course/);
    expect(errors[errors.length - 1]).toMatch(/sortie longue/);
  });

  it('typographie française : espace insécable avant les deux-points', () => {
    const result = validateInput({ ...VALID, sessions: 9 });
    expect(!result.ok && result.errors[0]).toBe('Choisis 3, 4 ou 5 séances par semaine.');
    const level = validateInput({ ...VALID, level: 'x' });
    expect(!level.ok && level.errors[0]).toBe('Choisis un niveau\u00a0: Finisher, sub-2h ou sub-1h45.');
  });

  it('messages en français, phrases complètes', () => {
    const errors = errorsFor({});
    expect(errors.length).toBeGreaterThan(5);
    for (const message of errors) {
      expect(message).toMatch(/^[A-ZÀ-Ý]/);
      expect(message).toMatch(/\.$/);
      expect(message).not.toMatch(/\b(must|invalid|required|should)\b/i);
    }
  });
});
