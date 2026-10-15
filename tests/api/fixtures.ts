/**
 * Données factices conformes aux types du moteur, pour simuler `src/engine`
 * dans les tests d'endpoints (indépendants de l'implémentation du moteur).
 */
import type { Plan, PlanInput, PlanPreview, Week } from '../../src/engine/types';

export const SAMPLE_INPUT: PlanInput = {
  race: 'marathon',
  raceDate: '2027-04-04',
  raceName: 'Marathon de Paris',
  level: 'l2',
  t10: 3000,
  weeklyKm: 30,
  sessions: 4,
  longRunDay: 'sun',
  startDate: '2026-10-19',
};

const PACES: Plan['paces'] = { ef: 390, seuil: 300, as10: 290, allure_course: 330, recup: 420 };

export const SAMPLE_WEEK: Week = {
  index: 1,
  start: '2026-10-19',
  end: '2026-10-25',
  phase: 'base',
  deload: false,
  km: 30,
  sessions: [
    {
      date: '2026-10-20',
      dow: 'tue',
      type: 'ef',
      title: 'Endurance fondamentale + lignes droites',
      km: 8,
      durationMin: 52,
      paces: [{ label: 'EF', secPerKm: 390 }],
      steps: ['8 km en endurance fondamentale', '6 lignes droites de 80 m'],
      loopKm: 8,
    },
  ],
};

export const SAMPLE_PLAN: Plan = {
  input: SAMPLE_INPUT,
  weeks: [SAMPLE_WEEK],
  paces: PACES,
  predicted: { raceSec: 13_800 },
  totalKm: 30,
};

export const SAMPLE_PREVIEW: PlanPreview = {
  week1: SAMPLE_WEEK,
  overview: [{ index: 1, start: '2026-10-19', phase: 'base', deload: false, km: 30 }],
  paces: PACES,
  predicted: { raceSec: 13_800 },
};
