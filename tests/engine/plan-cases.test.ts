/**
 * Cas particuliers : plan tardif, plan trop court, date libre (lointaine, jour quelconque),
 * Noël, date de début explicite, déterminisme, aperçu gratuit.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanError, generatePlan, isPlanError, previewPlan } from '../../src/engine';
import type { PlanInput } from '../../src/engine';
import {
  LEVELS,
  LONG_RUN_DAYS,
  NOMINAL_WEEKS,
  RACES,
  RACE_DATE,
  SESSIONS,
  TODAY,
  dayNumber,
  dowIdx,
  isoOf,
  label,
  lastSession,
  trainingKm,
} from './helpers';
import { checkPlanInvariants } from './invariants';

const BASE: PlanInput = {
  race: 'marathon',
  raceDate: RACE_DATE.marathon,
  level: 'l2',
  t10: 50 * 60,
  weeklyKm: 30,
  sessions: 4,
  longRunDay: 'sun',
};

function planError(fn: () => unknown): PlanError {
  try {
    fn();
  } catch (error) {
    if (isPlanError(error)) return error;
    throw error;
  }
  throw new Error('aucune erreur levée');
}

/** Générateur pseudo-aléatoire déterministe (LCG), pour balayer des dates libres. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

describe('marathon de Paris, l2, 4 séances', () => {
  const plan = generatePlan(BASE, TODAY);

  it('commence le lundi 19/10/2026 et finit le dimanche 4/04/2027 par la course', () => {
    expect(plan.weeks).toHaveLength(24);
    expect(plan.weeks[0]!.start).toBe('2026-10-19');
    const race = lastSession(plan)!;
    expect(race).toMatchObject({ type: 'course', date: '2027-04-04', dow: 'sun', km: 42.195, loopKm: null });
    expect(race.title).toMatch(/^Jour J/);
  });

  it('reprend le nom de la course quand il est fourni', () => {
    const named = generatePlan({ ...BASE, raceName: '  Marathon   de Paris ' }, TODAY);
    expect(lastSession(named)!.title).toBe('Jour J\u00a0: Marathon de Paris');
    expect(named.input.raceName).toBe('Marathon de Paris');
  });

  it('notes : intro de phase en S1, S9, S17, S22 ; semaine de course ; Noël en S10', () => {
    expect(plan.weeks[0]!.note).toMatch(/^Phase de base/);
    expect(plan.weeks[8]!.note).toMatch(/^Phase de développement/);
    expect(plan.weeks[16]!.note).toMatch(/^Phase spécifique/);
    expect(plan.weeks[21]!.note).toMatch(/^Affûtage/);
    expect(plan.weeks[23]!.note).toMatch(/Semaine de course/);
    expect(plan.weeks[9]!.note).toMatch(/Noël/);
  });

  it('contenu concret : échauffement, répétitions, récupérations et allures min:ss/km', () => {
    const quality = plan.weeks[8]!.sessions.find((s) => s.type === 'qualite')!;
    expect(quality.title).toMatch(/^Fractionné\u00a0: \d+\u00a0×\u00a0\d/);
    const text = quality.steps.join('\n');
    expect(text).toMatch(/Échauffement\u00a0: \d+\u00a0min en endurance fondamentale \(\d:\d\d\/km\)/);
    expect(text).toMatch(/de trot entre les répétitions/);
    expect(text).toMatch(/Retour au calme/);
    expect(quality.paces.map((p) => p.label)).toEqual(['Endurance fondamentale', 'Allure 10 km', 'Récupération']);
  });

  it('séance de renforcement le samedi, avec le footing court', () => {
    const saturday = plan.weeks[0]!.sessions.find((s) => s.dow === 'sat')!;
    expect(saturday.type).toBe('ef');
    expect(saturday.title).toBe('Footing court + renforcement');
    expect(saturday.steps.join(' ')).toMatch(/Gainage/);
  });

  it('les durées sont cohérentes avec la distance et l\'allure EF', () => {
    for (const week of plan.weeks) {
      for (const s of week.sessions.filter((x) => x.type === 'sl' && x.paces.length === 1)) {
        expect(Math.abs(s.durationMin - (s.km * plan.paces.ef) / 60)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('plan tardif ou court', () => {
  it('démarrage le 30/11/2026 : 18 semaines, base raccourcie, Noël allégé', () => {
    const today = '2026-11-30';
    const plan = generatePlan(BASE, today);
    checkPlanInvariants(plan, BASE);
    expect(plan.weeks).toHaveLength(18);
    expect(plan.weeks[0]!.start).toBe('2026-11-30');
    const count = (phase: string) => plan.weeks.filter((w) => w.phase === phase).length;
    expect(count('base')).toBeLessThan(8);
    expect(count('developpement')).toBeLessThanOrEqual(8);
    expect(count('specifique')).toBeLessThanOrEqual(5);
    expect(count('affutage')).toBe(3);
    const christmas = plan.weeks.find((w) => w.start === '2026-12-21')!;
    expect(christmas.index).toBe(4);
    expect(christmas.deload).toBe(true);
    expect(plan.weeks[0]!.note).toMatch(/raccourci/);
  });

  it('démarrage un mercredi : le plan commence le lundi suivant', () => {
    const plan = generatePlan(BASE, '2026-12-02');
    expect(plan.weeks[0]!.start).toBe('2026-12-07');
    expect(plan.weeks).toHaveLength(17);
  });

  it('exactement 8 semaines : accepté', () => {
    for (const race of RACES) {
      const input: PlanInput = { ...BASE, race, raceDate: RACE_DATE[race] };
      const today = isoOf(dayNumber(RACE_DATE[race]) - 6 - 7 * 7);
      const plan = generatePlan(input, today);
      expect(plan.weeks, race).toHaveLength(8);
      checkPlanInvariants(plan, input);
    }
  });

  it('toutes les combinaisons à 8 et 12 semaines respectent les invariants', () => {
    for (const weeks of [8, 12])
      for (const race of RACES)
        for (const level of LEVELS)
          for (const sessions of SESSIONS)
            for (const longRunDay of LONG_RUN_DAYS)
              for (const weeklyKm of [0, 15, 45, 120]) {
                const input: PlanInput = { race, raceDate: RACE_DATE[race], level, t10: 2700, weeklyKm, sessions, longRunDay };
                const today = isoOf(dayNumber(RACE_DATE[race]) - 6 - 7 * (weeks - 1));
                const plan = generatePlan(input, today);
                expect(plan.weeks, label(input)).toHaveLength(weeks);
                checkPlanInvariants(plan, input);
              }
  });

  it('moins de 8 semaines : erreur PLAN_TOO_SHORT explicite', () => {
    const today = isoOf(dayNumber(RACE_DATE.marathon) - 6 - 7 * 7 + 1); // mardi, il reste 7 semaines
    const error = planError(() => generatePlan(BASE, today));
    expect(error.code).toBe('PLAN_TOO_SHORT');
    expect(error.messages).toHaveLength(1);
    expect(error.messages[0]).toMatch(/7 semaines/);
    expect(error.messages[0]).toMatch(/au moins 8/);
    expect(() => previewPlan(BASE, today)).toThrow(PlanError);
  });

  it('course déjà passée ou dans la semaine : PLAN_TOO_SHORT', () => {
    expect(planError(() => generatePlan(BASE, '2027-04-05')).code).toBe('PLAN_TOO_SHORT');
    expect(planError(() => generatePlan(BASE, '2027-04-05')).messages[0]).toMatch(/déjà passée/);
    expect(planError(() => generatePlan(BASE, '2027-04-01')).code).toBe('PLAN_TOO_SHORT');
  });
});

describe('date libre', () => {
  it('course lointaine : programme nominal qui démarre plus tard, avec une note', () => {
    const input: PlanInput = { ...BASE, raceDate: '2027-10-10', raceName: 'Marathon d\'automne' };
    const plan = generatePlan(input, TODAY);
    checkPlanInvariants(plan, input);
    expect(plan.weeks).toHaveLength(24);
    expect(plan.weeks[0]!.start).toBe('2027-04-26');
    expect(plan.weeks[0]!.note).toMatch(/démarre le lundi 26\u00a0avril 2027|démarre le lundi 26 avril 2027/);
    expect(plan.weeks.filter((w) => w.deload).map((w) => w.index)).toEqual([4, 7, 10, 14, 18]);
  });

  it('course un samedi : la course est la dernière séance, rien après', () => {
    const input: PlanInput = { ...BASE, race: 'semi', raceDate: '2027-04-10', longRunDay: 'sun' };
    const plan = generatePlan(input, '2026-12-01');
    checkPlanInvariants(plan, input);
    expect(plan.weeks).toHaveLength(18);
    const raceWeek = plan.weeks[plan.weeks.length - 1]!;
    expect(raceWeek.sessions).toHaveLength(4);
    expect(raceWeek.sessions[3]).toMatchObject({ type: 'course', dow: 'sat' });
  });

  it('course un lundi : la dernière semaine ne contient que la course', () => {
    const input: PlanInput = { ...BASE, raceDate: '2027-04-05' };
    const plan = generatePlan(input, TODAY);
    checkPlanInvariants(plan, input);
    expect(plan.weeks[plan.weeks.length - 1]!.sessions.map((s) => s.type)).toEqual(['course']);
  });

  it('course un mercredi : séances d\'avant-course limitées aux jours disponibles', () => {
    const input: PlanInput = { ...BASE, raceDate: '2027-05-05', sessions: 5 };
    const plan = generatePlan(input, '2026-12-15');
    checkPlanInvariants(plan, input);
    const raceWeek = plan.weeks[plan.weeks.length - 1]!;
    expect(raceWeek.sessions.map((s) => s.dow)).toEqual(['mon', 'tue', 'wed']);
  });

  it('Noël en S2 d\'un plan de 16 semaines : semaine allégée', () => {
    const plan = generatePlan(BASE, '2026-12-14');
    expect(plan.weeks).toHaveLength(16);
    expect(plan.weeks[1]!.start).toBe('2026-12-21');
    expect(plan.weeks[1]!.deload).toBe(true);
    checkPlanInvariants(plan, BASE);
  });

  it('balayage de 500 dates libres (jour, durée, profil quelconques)', () => {
    const random = lcg(20261014);
    const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)]!;
    let generated = 0;
    let tooShort = 0;
    for (let k = 0; k < 500; k += 1) {
      const todayDay = dayNumber('2026-06-01') + Math.floor(random() * 560);
      const raceDay = todayDay + 7 * 6 + Math.floor(random() * 7 * 40);
      const input: PlanInput = {
        race: pick(RACES),
        raceDate: isoOf(raceDay),
        level: pick(LEVELS),
        t10: 1800 + Math.floor(random() * 3601),
        weeklyKm: Math.round(random() * 1200) / 10,
        sessions: pick(SESSIONS),
        longRunDay: pick(LONG_RUN_DAYS),
      };
      const today = isoOf(todayDay);
      const startMonday = todayDay + ((7 - dowIdx(today)) % 7);
      const available = Math.floor((raceDay - dowIdx(input.raceDate) - startMonday) / 7) + 1;
      if (available < 8) {
        expect(planError(() => generatePlan(input, today)).code, label(input)).toBe('PLAN_TOO_SHORT');
        tooShort += 1;
        continue;
      }
      const plan = generatePlan(input, today);
      expect(plan.weeks, label(input)).toHaveLength(Math.min(available, NOMINAL_WEEKS[input.race]));
      checkPlanInvariants(plan, input);
      generated += 1;
    }
    expect(generated).toBeGreaterThan(350);
    expect(tooShort).toBeGreaterThan(0);
  });
});

describe('date de début', () => {
  it('startDate un mercredi : le plan commence le lundi suivant', () => {
    const plan = generatePlan({ ...BASE, startDate: '2026-10-21' }, TODAY);
    expect(plan.weeks[0]!.start).toBe('2026-10-26');
    expect(plan.weeks).toHaveLength(23);
  });

  it('startDate passée : le même plan reste disponible les semaines suivantes', () => {
    const reference = generatePlan(BASE, TODAY);
    const later = generatePlan({ ...BASE, startDate: '2026-10-19' }, '2026-12-01');
    expect(later.weeks).toEqual(reference.weeks);
  });

  it('sans today : date du jour UTC, sans effet de fuseau', () => {
    vi.useFakeTimers();
    // 14/10/2026 23:30 à Paris = 21:30 UTC, toujours le 14 en UTC.
    vi.setSystemTime(new Date('2026-10-14T23:30:00+02:00'));
    expect(generatePlan(BASE)).toEqual(generatePlan(BASE, TODAY));
    // Dimanche 18/10 22:30 UTC : le plan commence le lendemain, lundi 19.
    vi.setSystemTime(new Date('2026-10-18T22:30:00Z'));
    expect(generatePlan(BASE).weeks[0]!.start).toBe('2026-10-19');
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

describe('le contrôleur d\'invariants détecte un plan altéré', () => {
  const clone = () => structuredClone(generatePlan(BASE, TODAY));
  it.each([
    ['semaine au-dessus du pic', (p: ReturnType<typeof clone>) => {
      const s = p.weeks[16]!.sessions[0]!;
      s.km += 20;
      p.weeks[16]!.km += 20;
    }],
    ['course absente', (p: ReturnType<typeof clone>) => {
      p.weeks[23]!.sessions.pop();
    }],
    ['semaine allégée manquante', (p: ReturnType<typeof clone>) => {
      p.weeks[9]!.deload = false;
    }],
    ['date hors de la semaine', (p: ReturnType<typeof clone>) => {
      p.weeks[2]!.sessions[0]!.date = p.weeks[3]!.start;
    }],
    ['allure inconnue dans les consignes', (p: ReturnType<typeof clone>) => {
      p.weeks[0]!.sessions[0]!.steps.push('Finis à 3:59/km.');
    }],
    ['sortie longue allongée de plus de 2 km', (p: ReturnType<typeof clone>) => {
      // S9 : 15,8 km en S8, donc 17,8 km au plus ; on déplace 0,8 km d'un footing vers la
      // sortie longue (volume et part de 45 % respectés : seule la règle des +2 km casse).
      const week = p.weeks[8]!;
      const sl = week.sessions.find((s) => s.type === 'sl')!;
      const ef = week.sessions.find((s) => s.type === 'ef')!;
      sl.km = Math.round((sl.km + 0.8) * 10) / 10;
      ef.km = Math.round((ef.km - 0.8) * 10) / 10;
      sl.loopKm = Math.round(sl.km * 2) / 2;
      ef.loopKm = Math.round(ef.km * 2) / 2;
    }],
  ] as const)('%s', (_name, corrupt) => {
    const plan = clone();
    expect(() => checkPlanInvariants(plan, BASE)).not.toThrow();
    corrupt(plan);
    expect(() => checkPlanInvariants(plan, BASE)).toThrow();
  });
});

describe('déterminisme', () => {
  it('même entrée → même sortie, sans muter l\'entrée', () => {
    const input = Object.freeze({ ...BASE, raceName: 'Marathon de Paris' });
    const a = generatePlan(input, TODAY);
    const b = generatePlan({ ...input }, TODAY);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(input).toEqual({ ...BASE, raceName: 'Marathon de Paris' });
  });

  it('l\'entrée renvoyée est l\'entrée validée et normalisée', () => {
    const plan = generatePlan({ ...BASE, t10: 2999.6 }, TODAY);
    expect(plan.input).toEqual({ ...BASE, t10: 3000 });
  });

  it('les entrées invalides lèvent INVALID_INPUT avec les messages de validation', () => {
    const error = planError(() => generatePlan({ ...BASE, sessions: 7 as PlanInput['sessions'], t10: 10 }, TODAY));
    expect(error.code).toBe('INVALID_INPUT');
    expect(error.messages).toHaveLength(2);
    expect(planError(() => generatePlan(BASE, '14/10/2026')).code).toBe('INVALID_INPUT');
  });
});

describe('aperçu gratuit (previewPlan)', () => {
  it('semaine 1 complète + vue d\'ensemble sans contenu', () => {
    const plan = generatePlan(BASE, TODAY);
    const preview = previewPlan(BASE, TODAY);
    expect(preview.week1).toEqual(plan.weeks[0]);
    expect(preview.paces).toEqual(plan.paces);
    expect(preview.predicted).toEqual(plan.predicted);
    expect(preview.overview).toHaveLength(24);
    expect(preview.overview[9]).toEqual({ index: 10, start: '2026-12-21', phase: 'developpement', deload: true, km: plan.weeks[9]!.km });
    for (const row of preview.overview) expect(Object.keys(row).sort()).toEqual(['deload', 'index', 'km', 'phase', 'start']);
    expect(JSON.stringify(preview.overview)).not.toMatch(/sessions|steps/);
  });

  it('le volume de la semaine 1 vaut max(weeklyKm, 15)', () => {
    expect(previewPlan({ ...BASE, weeklyKm: 0 }, TODAY).week1.km).toBe(15);
    expect(previewPlan({ ...BASE, weeklyKm: 22.5 }, TODAY).week1.km).toBe(22.5);
    expect(previewPlan({ ...BASE, weeklyKm: 100 }, TODAY).week1.km).toBe(58);
  });

  it('note de semaine 1 pour un volume faible ou supérieur au pic', () => {
    expect(previewPlan({ ...BASE, weeklyKm: 5 }, TODAY).week1.note).toMatch(/Tu cours peu/);
    expect(previewPlan({ ...BASE, weeklyKm: 100 }, TODAY).week1.note).toMatch(/plafonné à 58\u00a0km/);
  });

  it('peu de volume avec 5 séances : les footings en trop deviennent du renforcement', () => {
    const week1 = previewPlan({ ...BASE, weeklyKm: 15, sessions: 5, t10: 40 * 60 }, TODAY).week1;
    expect(week1.sessions).toHaveLength(5);
    const strength = week1.sessions.filter((s) => s.type === 'renfo');
    expect(strength.length).toBeGreaterThan(0);
    for (const s of strength) expect(s).toMatchObject({ km: 0, loopKm: null });
    expect(trainingKm(week1)).toBe(15);
  });
});
