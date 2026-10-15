/**
 * Briques internes du moteur : dates UTC, mise en forme, phases, semaines allégées, répartition.
 */
import { describe, expect, it } from 'vitest';
import { distribute } from '../../src/engine/allocation';
import {
  containsChristmas,
  dowIndex,
  firstMondayOnOrAfter,
  formatDateFr,
  formatIsoDate,
  mondayOf,
  parseIsoDate,
} from '../../src/engine/dates';
import {
  formatChrono,
  formatHm,
  formatMeters,
  formatMinutes,
  formatPace,
  formatRaceTime,
  formatRepDuration,
  frenchTypography,
} from '../../src/engine/format';
import { deloadWeeks, phaseLengths, weeklyVolumes } from '../../src/engine/structure';
import { RACES } from './helpers';

const NBSP = ' ';
const day = (iso: string): number => {
  const d = parseIsoDate(iso);
  if (d === null) throw new Error(iso);
  return d;
};

describe('dates UTC « date seule »', () => {
  it('lit et écrit les dates ISO, refuse les dates impossibles', () => {
    expect(formatIsoDate(day('2026-10-19'))).toBe('2026-10-19');
    expect(formatIsoDate(day('2028-02-29'))).toBe('2028-02-29');
    for (const bad of ['2027-02-29', '2026-13-01', '2026-00-10', '2026-10-32', '2026-1-01', '19/10/2026', '', '2026-10-19T00:00'])
      expect(parseIsoDate(bad), bad).toBeNull();
  });

  it('jours de la semaine et lundis', () => {
    expect(dowIndex(day('2026-10-19'))).toBe(0);
    expect(dowIndex(day('2027-04-04'))).toBe(6);
    expect(dowIndex(day('2027-03-07'))).toBe(6);
    expect(formatIsoDate(mondayOf(day('2027-04-04')))).toBe('2027-03-29');
    expect(formatIsoDate(firstMondayOnOrAfter(day('2026-10-14')))).toBe('2026-10-19');
    expect(formatIsoDate(firstMondayOnOrAfter(day('2026-10-19')))).toBe('2026-10-19');
    expect(formatIsoDate(firstMondayOnOrAfter(day('2026-10-18')))).toBe('2026-10-19');
  });

  it('aucun effet des changements d\'heure (25/10/2026, 28/03/2027)', () => {
    expect(day('2026-10-26') - day('2026-10-25')).toBe(1);
    expect(day('2027-03-29') - day('2027-03-28')).toBe(1);
    expect(formatIsoDate(day('2026-10-19') + 7)).toBe('2026-10-26');
    expect(formatIsoDate(day('2027-03-22') + 7)).toBe('2027-03-29');
  });

  it('Noël et dates en toutes lettres', () => {
    expect(containsChristmas(day('2026-12-21'), day('2026-12-27'))).toBe(true);
    expect(containsChristmas(day('2026-12-14'), day('2026-12-20'))).toBe(false);
    expect(containsChristmas(day('2027-12-20'), day('2027-12-26'))).toBe(true);
    expect(formatDateFr(day('2026-10-19'))).toBe('lundi 19 octobre 2026');
    expect(formatDateFr(day('2027-03-01'))).toBe('lundi 1er mars 2027');
  });
});

describe('mise en forme française', () => {
  it('allures, distances, durées', () => {
    expect(formatPace(341)).toBe('5:41/km');
    expect(formatPace(360)).toBe('6:00/km');
    expect(formatPace(299.6)).toBe('5:00/km');
    expect(formatHm(125)).toBe('12,5 km');
    expect(formatHm(120)).toBe('12 km');
    expect(formatMeters(800)).toBe('800 m');
    expect(formatMeters(1200)).toBe(`1${NBSP}200 m`);
    expect(formatRepDuration(45)).toBe('45 s');
    expect(formatRepDuration(90)).toBe('1 min 30');
    expect(formatRepDuration(120)).toBe('2 min');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(65)).toBe('1 h 05');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatRaceTime(14400)).toBe('4 h');
    expect(formatRaceTime(13801)).toBe('3 h 50');
    expect(formatChrono(2730)).toBe('45 min 30 s');
    expect(formatChrono(3600)).toBe('1 h');
    expect(formatChrono(3725)).toBe('1 h 02 min 05 s');
  });

  it('typographie : espaces insécables avant « : ! ? ; », autour de « × » et devant les unités', () => {
    expect(frenchTypography('Seuil : 3 × 10 min !')).toBe(`Seuil${NBSP}: 3${NBSP}×${NBSP}10${NBSP}min${NBSP}!`);
    expect(frenchTypography('12,5 km à 5:41/km')).toBe(`12,5${NBSP}km à 5:41/km`);
    expect(frenchTypography('3 marches')).toBe('3 marches');
  });
});

describe('phases', () => {
  it('durées nominales de la SPEC', () => {
    expect(phaseLengths('marathon', 24)).toEqual({ base: 8, developpement: 8, specifique: 5, affutage: 3 });
    expect(phaseLengths('semi', 20)).toEqual({ base: 6, developpement: 7, specifique: 5, affutage: 2 });
  });

  it('plans plus courts : affûtage conservé, base raccourcie d\'abord, chaque phase présente', () => {
    for (const race of RACES) {
      const nominal = phaseLengths(race, race === 'marathon' ? 24 : 20);
      let previousBase = 0;
      for (let weeks = 8; weeks <= (race === 'marathon' ? 24 : 20); weeks += 1) {
        const l = phaseLengths(race, weeks);
        expect(l.base + l.developpement + l.specifique + l.affutage, `${race} ${weeks}`).toBe(weeks);
        expect(l.affutage).toBe(nominal.affutage);
        for (const v of Object.values(l)) expect(v).toBeGreaterThanOrEqual(1);
        expect(l.developpement).toBeLessThanOrEqual(nominal.developpement);
        expect(l.specifique).toBeLessThanOrEqual(nominal.specifique);
        expect(l.base).toBeGreaterThanOrEqual(previousBase);
        previousBase = l.base;
      }
      // Une semaine de moins que la durée nominale : seule la base raccourcit.
      const oneLess = phaseLengths(race, (race === 'marathon' ? 24 : 20) - 1);
      expect(oneLess).toEqual({ ...nominal, base: nominal.base - 1 });
    }
  });
});

describe('semaines allégées', () => {
  it('listes fixes de la SPEC pour les durées nominales', () => {
    expect(deloadWeeks('marathon', 24, 10)).toEqual([4, 7, 10, 14, 18]);
    expect(deloadWeeks('semi', 20, 10)).toEqual([4, 7, 10, 14]);
  });

  it('autres durées : toutes les 3-4 semaines, Noël inclus hors affûtage', () => {
    for (const race of RACES) {
      const taper = race === 'marathon' ? 3 : 2;
      for (let weeks = 8; weeks < (race === 'marathon' ? 24 : 20); weeks += 1) {
        for (const christmas of [null, ...Array.from({ length: weeks }, (_, i) => i + 1)]) {
          const deloads = deloadWeeks(race, weeks, christmas);
          const ctx = `${race} ${weeks} sem., Noël ${christmas}`;
          expect(deloads.length, ctx).toBeGreaterThanOrEqual(1);
          let previous = 0;
          for (const d of deloads) {
            expect(d, ctx).toBeGreaterThanOrEqual(2);
            expect(d, ctx).toBeLessThanOrEqual(weeks - taper);
            expect(d - previous, ctx).toBeGreaterThanOrEqual(2);
            expect(d - previous, ctx).toBeLessThanOrEqual(6);
            previous = d;
          }
          if (christmas !== null && christmas >= 2 && christmas <= weeks - taper) expect(deloads, ctx).toContain(christmas);
          if (christmas === null) {
            // Sans contrainte de Noël, l'écart reste de 3 à 4 semaines (au plus 5 avant l'affûtage).
            deloads.forEach((d, i) => expect(d - (deloads[i - 1] ?? 0), ctx).toBeGreaterThanOrEqual(3));
            expect(weeks - taper + 1 - previous, ctx).toBeLessThanOrEqual(5);
          }
        }
      }
    }
  });
});

describe('volumes', () => {
  it('progression lissée vers le pic, jamais plus de +10 %, allégée à -27,5 %', () => {
    const plan = weeklyVolumes({
      race: 'marathon',
      weeks: 24,
      weeklyKm: 30,
      peakHm: 580,
      deloads: [4, 7, 10, 14, 18],
      specificStart: 17,
    });
    expect(plan.weekHm).toHaveLength(24);
    expect(plan.weekHm[0]).toBe(300);
    expect(plan.weekHm[16]).toBe(580);
    expect(plan.referenceHm).toBe(580);
    expect(plan.weekHm[3]).toBe(Math.round((plan.weekHm[2]! * 0.725) / 5) * 5);
    expect(plan.weekHm[21]).toBe(Math.round((580 * 0.8) / 5) * 5);
    expect(plan.weekHm[22]).toBe(Math.round((580 * 0.65) / 5) * 5);
    for (const hm of plan.weekHm) expect(hm % 5).toBe(0);
  });

  it('volume de départ plafonné au pic', () => {
    const plan = weeklyVolumes({ race: 'semi', weeks: 20, weeklyKm: 100, peakHm: 330, deloads: [4, 7, 10, 14], specificStart: 14 });
    expect(Math.max(...plan.weekHm)).toBe(330);
    expect(plan.weekHm[0]).toBe(330);
  });
});

describe('répartition', () => {
  it('somme exacte, plafond respecté, plancher appliqué', () => {
    expect(distribute(100, [1, 1], 60)).toEqual([50, 50]);
    expect(distribute(101, [1, 0.7], 100)).toEqual([59, 42]);
    expect(distribute(100, [3, 1], 55)).toEqual([55, 45]);
    expect(distribute(90, [1, 0.1], 100, 30).every((x) => x >= 30)).toBe(true);
    expect(distribute(90, [1, 0.1], 100, 30).reduce((a, b) => a + b, 0)).toBe(90);
    expect(distribute(0, [], 10)).toEqual([]);
    // Plafond impossible à tenir : le surplus va à la première part.
    expect(distribute(30, [1, 1], 10)).toEqual([20, 10]);
  });
});
