/**
 * data/races.json : schéma, unicité des slugs, dates dans la fenêtre de printemps,
 * distances, sources en https, et règles de la SPEC (pas de « officiel »).
 * Plus les cas d'erreur du validateur utilisé au build (build/races-plugin.ts).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RACE_WINDOW, type Race, loadRaces, validateRaces } from '../../build/races-plugin';
import { KEY_DATES } from '../../src/config';

const DATA_FILE = resolve(__dirname, '../../data/races.json');
const raw: unknown = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
const { races, errors } = validateRaces(raw);

const SAMPLE: Race = {
  slug: 'marathon-exemple',
  name: 'Marathon d’Exemple',
  city: 'Exemple',
  region: 'Bretagne',
  kind: 'marathon',
  date: '2027-04-11',
  dateStatus: 'confirmée',
  sourceUrl: 'https://exemple.fr/marathon',
};

function errorsFor(overrides: Record<string, unknown>, base: Record<string, unknown> = { ...SAMPLE }): string[] {
  return validateRaces([{ ...base, ...overrides }]).errors;
}

describe('data/races.json', () => {
  it('passe la validation du build, sans aucune erreur', () => {
    expect(errors).toEqual([]);
    expect(Array.isArray(raw)).toBe(true);
    expect(races).toHaveLength((raw as unknown[]).length);
    expect(() => loadRaces(DATA_FILE)).not.toThrow();
  });

  it('contient entre 20 et 35 courses, marathons et semis', () => {
    expect(races.length).toBeGreaterThanOrEqual(20);
    expect(races.length).toBeLessThanOrEqual(35);
    expect(races.some((r) => r.kind === 'marathon')).toBe(true);
    expect(races.some((r) => r.kind === 'semi')).toBe(true);
  });

  it('a des slugs uniques, en minuscules et tirets', () => {
    const slugs = races.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('a des dates valides, du 1er février au 31 mai 2027, triées', () => {
    for (const race of races) {
      expect(race.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const parsed = new Date(`${race.date}T00:00:00Z`);
      expect(parsed.toISOString().slice(0, 10)).toBe(race.date);
      expect(race.date >= RACE_WINDOW.start && race.date <= RACE_WINDOW.end).toBe(true);
    }
    const dates = (raw as Race[]).map((r) => r.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('a des distances, statuts de date et sources https valides', () => {
    for (const race of races) {
      expect(['marathon', 'semi']).toContain(race.kind);
      expect(['confirmée', 'estimée']).toContain(race.dateStatus);
      expect(new URL(race.sourceUrl).protocol).toBe('https:');
      if (race.participantsApprox !== undefined) {
        expect(Number.isInteger(race.participantsApprox) && race.participantsApprox > 0).toBe(true);
      }
    }
  });

  it('reprend les dates de Paris de la SPEC', () => {
    const marathon = races.find((r) => r.slug === 'marathon-de-paris');
    const semi = races.find((r) => r.slug === 'semi-de-paris');
    expect(marathon).toMatchObject({ kind: 'marathon', date: KEY_DATES.marathon, dateStatus: 'confirmée' });
    expect(semi).toMatchObject({ kind: 'semi', date: KEY_DATES.semi, dateStatus: 'confirmée' });
  });

  it('ne dit jamais « officiel » et ne cite aucune marque interdite', () => {
    const text = JSON.stringify(races.map(({ name, city, region, notes }) => ({ name, city, region, notes })));
    expect(text).not.toMatch(/officiel|asics|schneider|coach/i);
  });

  it('a des notes courtes, d’une ligne', () => {
    for (const race of races) {
      if (race.notes === undefined) continue;
      expect(race.notes.length).toBeLessThanOrEqual(220);
      expect(race.notes).not.toMatch(/\n/);
    }
  });
});

describe('validateRaces', () => {
  it('accepte une course complète et la renvoie telle quelle', () => {
    const result = validateRaces([SAMPLE]);
    expect(result.errors).toEqual([]);
    expect(result.races).toEqual([SAMPLE]);
  });

  it('refuse autre chose qu’un tableau d’objets', () => {
    expect(validateRaces({}).errors).toHaveLength(1);
    expect(validateRaces(['x']).errors[0]).toMatch(/objet/);
  });

  it('refuse les slugs en double', () => {
    const { errors: dup } = validateRaces([SAMPLE, { ...SAMPLE, name: 'Marathon Bis' }]);
    expect(dup).toHaveLength(1);
    expect(dup[0]).toMatch(/déjà utilisé/);
  });

  it('refuse un slug mal formé', () => {
    expect(errorsFor({ slug: 'Marathon Exemple' })[0]).toMatch(/slug/);
  });

  it('refuse une date invalide ou hors de la fenêtre de printemps', () => {
    expect(errorsFor({ date: '2027-02-30' })[0]).toMatch(/invalide/);
    expect(errorsFor({ date: '11/04/2027' })[0]).toMatch(/invalide/);
    expect(errorsFor({ date: '2027-01-31' })[0]).toMatch(/fenêtre/);
    expect(errorsFor({ date: '2027-06-01' })[0]).toMatch(/fenêtre/);
    expect(errorsFor({ date: '2026-10-11' })[0]).toMatch(/fenêtre/);
  });

  it('refuse une distance inconnue ou un nom qui ne la reflète pas', () => {
    expect(errorsFor({ kind: '10k' })[0]).toMatch(/kind/);
    expect(errorsFor({ kind: 'semi' })[0]).toMatch(/commencer par « Semi »/);
  });

  it('refuse un statut de date inconnu', () => {
    expect(errorsFor({ dateStatus: 'officielle' })[0]).toMatch(/dateStatus/);
  });

  it('exige une source en https', () => {
    expect(errorsFor({ sourceUrl: 'http://exemple.fr' })[0]).toMatch(/https/);
    expect(errorsFor({ sourceUrl: 'exemple.fr' })[0]).toMatch(/https/);
  });

  it('refuse un nombre de participants non entier ou négatif', () => {
    expect(errorsFor({ participantsApprox: -3 })[0]).toMatch(/participantsApprox/);
    expect(errorsFor({ participantsApprox: 12.5 })[0]).toMatch(/participantsApprox/);
    expect(errorsFor({ participantsApprox: '7000' })[0]).toMatch(/participantsApprox/);
  });

  it('refuse les champs inconnus, vides ou mal espacés', () => {
    expect(errorsFor({ logo: 'x.png' })[0]).toMatch(/champ inconnu « logo »/);
    expect(errorsFor({ city: '' })[0]).toMatch(/city/);
    expect(errorsFor({ name: ' Marathon d’Exemple' })[0]).toMatch(/name/);
  });

  it('refuse « officiel » et les marques interdites dans les textes affichés', () => {
    expect(errorsFor({ notes: 'Le parcours officiel passe par le port.' })[0]).toMatch(/officiel/);
    expect(errorsFor({ name: 'Marathon Schneider de Paris' })[0]).toMatch(/Schneider/);
    expect(errorsFor({ notes: 'Village ASICS au départ.' })[0]).toMatch(/ASICS/);
  });

  it('trie les courses par date', () => {
    const later = { ...SAMPLE, slug: 'semi-plus-tard', name: 'Semi Plus Tard', kind: 'semi', date: '2027-05-02' };
    const earlier = { ...SAMPLE, slug: 'marathon-plus-tot', date: '2027-03-01' };
    expect(validateRaces([later, SAMPLE, earlier]).races.map((r) => r.slug)).toEqual([
      'marathon-plus-tot',
      'marathon-exemple',
      'semi-plus-tard',
    ]);
  });
});
