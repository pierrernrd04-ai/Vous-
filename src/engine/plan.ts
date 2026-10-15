/**
 * Assemblage du plan complet et de l'aperçu gratuit (SPEC section 2).
 * Déterministe : même entrée et même `today` → même sortie.
 */
import { buildRaceWeek, buildTrainingWeek } from './allocation';
import {
  LONG_RUN_MAX_GAIN_KM,
  LONG_RUN_MAX_KM,
  LONG_RUN_MAX_MINUTES,
  LONG_RUN_SHARE,
  MIN_START_KM,
  MIN_WEEKS,
  NOMINAL_WEEKS,
  TAPER_FACTORS,
} from './constants';
import {
  DOWS,
  containsChristmas,
  dowIndex,
  firstMondayOnOrAfter,
  formatDateFr,
  formatIsoDate,
  mondayOf,
  parseIsoDate,
  todayIsoUtc,
} from './dates';
import { formatDecimal, frenchTypography } from './format';
import { computePaces } from './paces';
import { deloadWeeks, effectivePeakHm, phaseLengths, phaseOf, weeklyVolumes } from './structure';
import { PlanError } from './types';
import type { Phase, Plan, PlanInput, PlanPreview, RaceKind, Session, Week } from './types';
import { validateInput } from './validate';
import type { DraftSession, WorkoutContext } from './workouts';

function requireDay(iso: string): number {
  const day = parseIsoDate(iso);
  if (day === null) throw new PlanError('INVALID_INPUT', [frenchTypography(`Date invalide : ${iso}.`)]);
  return day;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function toSession(draft: DraftSession, weekStart: number): Session {
  const km = draft.exactKm ?? draft.hm / 10;
  const loopKm = draft.type === 'renfo' || draft.type === 'course' || draft.hm <= 0 ? null : Math.round(draft.hm / 5) / 2;
  return {
    date: formatIsoDate(weekStart + draft.dowIdx),
    dow: DOWS[draft.dowIdx] ?? 'mon',
    type: draft.type,
    title: frenchTypography(draft.title),
    km,
    durationMin: draft.durationMin,
    paces: draft.paces.map((p) => ({ label: p.label, secPerKm: p.secPerKm })),
    steps: draft.steps.map(frenchTypography),
    loopKm,
  };
}

/* ------------------------------------------------------------------ */
/* Notes                                                              */
/* ------------------------------------------------------------------ */

function phaseIntro(phase: Phase, race: RaceKind): string {
  switch (phase) {
    case 'base':
      return 'Phase de base : on construit ton endurance. Presque tout se court en aisance (tu dois pouvoir parler) ; la séance du jeudi reste ludique, avec du fartlek ou des côtes.';
    case 'developpement':
      return 'Phase de développement : place au fractionné et au seuil pour gagner en vitesse. Respecte les récupérations, c\'est là que ton corps progresse.';
    case 'specifique':
      return race === 'marathon'
        ? 'Phase spécifique : on travaille ton allure marathon et les sorties longues s\'allongent. Profites-en pour tester ta tenue et ton ravitaillement de course.'
        : 'Phase spécifique : on installe ton allure semi. Certaines sorties longues finissent à allure course, comme une répétition du jour J.';
    case 'affutage':
      return 'Affûtage : le volume baisse pour que tu arrives frais le jour J. Garde un peu de rythme, dors bien et ne cherche pas à rattraper une séance manquée.';
  }
}

interface NoteContext {
  input: PlanInput;
  weeks: number;
  available: number;
  deferred: boolean;
  startMonday: number;
  paceNote: string | undefined;
  peakHm: number;
}

function firstWeekNotes(ctx: NoteContext): string[] {
  const { input } = ctx;
  const notes: string[] = [];
  const nominal = NOMINAL_WEEKS[input.race];
  if (ctx.deferred) {
    notes.push(
      `Ta course est dans ${ctx.available} semaines : ton programme de ${nominal} semaines démarre le ${formatDateFr(ctx.startMonday)}. ` +
        'D\'ici là, entretiens ta forme avec 2 ou 3 footings faciles par semaine.',
    );
  } else if (ctx.weeks < nominal) {
    notes.push(
      `Ta course est dans ${ctx.weeks} semaines : le programme est raccourci (phase de base plus courte), ` +
        'mais il garde une progression de 10 % maximum par semaine, des semaines allégées et un vrai affûtage.',
    );
  }
  if (ctx.paceNote) notes.push(ctx.paceNote);
  if (input.weeklyKm < MIN_START_KM) {
    notes.push(
      `Tu cours peu en ce moment : cette première semaine compte ${MIN_START_KM} km, à courir très tranquillement. ` +
        'N\'hésite pas à alterner course et marche au début.',
    );
  } else if (input.weeklyKm * 10 > ctx.peakHm) {
    notes.push(
      `Tu cours déjà ${formatDecimal(input.weeklyKm)} km par semaine : le programme reste plafonné à ${formatDecimal(ctx.peakHm / 10)} km, ` +
        `le volume prévu pour ce niveau${input.sessions === 3 ? ' avec 3 séances' : ''}. Profite de cette marge pour soigner la qualité de chaque séance.`,
    );
  }
  return notes;
}

const DELOAD_NOTE = 'Semaine allégée : environ 25 % de volume en moins pour assimiler le travail des semaines précédentes.';
const CHRISTMAS_DELOAD_NOTE = 'C\'est la semaine de Noël : profite des fêtes, le programme s\'allège exprès.';
const CHRISTMAS_NOTE =
  'Semaine de Noël : si tu dois sacrifier une séance, garde la sortie longue et la séance du jeudi, et laisse tomber un footing sans regret.';
const RACE_WEEK_NOTE =
  'Semaine de course ! Footings courts, un rappel d\'allure et beaucoup de repos. Mange normalement, hydrate-toi et fais confiance à ton entraînement.';

/* ------------------------------------------------------------------ */
/* Calendrier                                                         */
/* ------------------------------------------------------------------ */

interface Calendar {
  startMonday: number;
  weeks: number;
  available: number;
  deferred: boolean;
}

/**
 * Début du plan : premier lundi à partir de `startDate` (ou d'aujourd'hui), c'est-à-dire
 * le lundi de la semaine courante si l'on est lundi, sinon le lundi suivant.
 * Plus de semaines disponibles que la durée nominale : le plan démarre plus tard
 * (24 ou 20 semaines avant la course). Moins : le plan démarre tout de suite, raccourci.
 */
function resolveCalendar(input: PlanInput, today: number): Calendar {
  const raceDay = requireDay(input.raceDate);
  const from = input.startDate !== undefined ? requireDay(input.startDate) : today;
  if (raceDay < from) {
    throw new PlanError('PLAN_TOO_SHORT', [
      frenchTypography('La date de ta course est déjà passée : choisis une course à venir.'),
    ]);
  }
  let startMonday = firstMondayOnOrAfter(from);
  const raceMonday = mondayOf(raceDay);
  const available = raceMonday >= startMonday ? (raceMonday - startMonday) / 7 + 1 : 0;
  if (available < MIN_WEEKS) {
    const message =
      available === 0
        ? `Ta course a lieu avant le début du programme (${formatDateFr(startMonday)}) : il faut au moins ${MIN_WEEKS} semaines de préparation.`
        : `Il ne reste que ${available} semaine${available > 1 ? 's' : ''} avant ta course à partir du ${formatDateFr(startMonday)} : ` +
          `il en faut au moins ${MIN_WEEKS} pour te préparer sans te blesser.`;
    throw new PlanError('PLAN_TOO_SHORT', [
      frenchTypography(`${message} Choisis une course plus lointaine, ou cours celle-ci tranquillement, sans objectif de chrono.`),
    ]);
  }
  const nominal = NOMINAL_WEEKS[input.race];
  const deferred = available > nominal;
  if (deferred) startMonday = raceMonday - (nominal - 1) * 7;
  return { startMonday, weeks: Math.min(available, nominal), available, deferred };
}

/* ------------------------------------------------------------------ */
/* Plan                                                               */
/* ------------------------------------------------------------------ */

export function generatePlan(rawInput: PlanInput, today?: string): Plan {
  const validation = validateInput(rawInput);
  if (!validation.ok) throw new PlanError('INVALID_INPUT', validation.errors);
  const input = validation.input;
  const todayIso = today ?? todayIsoUtc();
  const todayDay = parseIsoDate(todayIso);
  if (todayDay === null) {
    throw new PlanError('INVALID_INPUT', [
      frenchTypography('La date du jour doit être une date valide au format AAAA-MM-JJ.'),
    ]);
  }

  const calendar = resolveCalendar(input, todayDay);
  const { startMonday, weeks } = calendar;
  const raceDay = requireDay(input.raceDate);

  const lengths = phaseLengths(input.race, weeks);
  const weekStart = (index: number): number => startMonday + (index - 1) * 7;
  let christmasIndex: number | null = null;
  for (let i = 1; i <= weeks && christmasIndex === null; i += 1) {
    if (containsChristmas(weekStart(i), weekStart(i) + 6)) christmasIndex = i;
  }
  const deloads = new Set(deloadWeeks(input.race, weeks, christmasIndex));
  const paceInfo = computePaces(input);
  const longRunCapHm = Math.min(
    LONG_RUN_MAX_KM[input.race][input.level] * 10,
    Math.floor((LONG_RUN_MAX_MINUTES * 60 * 10) / paceInfo.paces.ef),
  );
  const peakHm = effectivePeakHm(input.race, input.level, input.sessions, longRunCapHm);
  const specificStart = lengths.base + lengths.developpement + 1;
  const volumes = weeklyVolumes({
    race: input.race,
    weeks,
    weeklyKm: input.weeklyKm,
    peakHm,
    deloads: [...deloads],
    specificStart,
  });

  const ctx: WorkoutContext = {
    race: input.race,
    level: input.level,
    paces: paceInfo.paces,
    sessions: input.sessions,
    longRunDay: input.longRunDay,
    ...(input.raceName !== undefined ? { raceName: input.raceName } : {}),
  };

  const phases: Phase[] = [];
  for (let i = 1; i <= weeks; i += 1) phases.push(phaseOf(lengths, i));
  const specificLoadWeeks = phases
    .map((phase, k) => ({ phase, index: k + 1 }))
    .filter((w) => w.phase === 'specifique' && !deloads.has(w.index))
    .map((w) => w.index);
  const taperStart = weeks - lengths.affutage + 1;

  const noteCtx: NoteContext = {
    input,
    weeks,
    available: calendar.available,
    deferred: calendar.deferred,
    startMonday,
    paceNote: paceInfo.note,
    peakHm,
  };

  const progressByPhase = new Map<Phase, number>();
  /** Sortie longue de la dernière semaine non allégée (hm) : base du plafond +2 km. */
  let lastLoadLongHm: number | null = null;
  const result: Week[] = [];
  for (let index = 1; index <= weeks; index += 1) {
    const phase = phases[index - 1] ?? 'base';
    const deload = deloads.has(index);
    const start = weekStart(index);
    const progress = progressByPhase.get(phase) ?? 0;
    const targetHm = volumes.weekHm[index - 1] ?? 0;

    const drafts: DraftSession[] =
      index === weeks
        ? buildRaceWeek(ctx, {
            trainingHm: targetHm,
            referenceHm: volumes.referenceHm,
            maxShare: TAPER_FACTORS[input.race][lengths.affutage - 1] ?? 0.45,
            raceDowIdx: dowIndex(raceDay),
          })
        : buildTrainingWeek(ctx, {
            phase,
            deload,
            targetHm,
            longRunShare: LONG_RUN_SHARE[phase],
            longRunCapHm:
              lastLoadLongHm === null
                ? longRunCapHm
                : Math.min(longRunCapHm, lastLoadLongHm + LONG_RUN_MAX_GAIN_KM * 10),
            progress,
            taperStep: phase === 'affutage' ? index - taperStart : 0,
            specificRank: phase === 'specifique' && !deload ? specificLoadWeeks.indexOf(index) : null,
          });
    if (!deload) {
      progressByPhase.set(phase, progress + 1);
      const longRun = drafts.find((d) => d.type === 'sl');
      if (longRun) lastLoadLongHm = longRun.hm;
    }

    const sessions = drafts.map((d) => toSession(d, start));
    const km = round3(sessions.reduce((acc, s) => acc + s.km, 0));

    const notes: string[] = [];
    const firstOfPhase = index === 1 || phases[index - 2] !== phase;
    if (firstOfPhase) notes.push(phaseIntro(phase, input.race));
    if (index === 1) notes.push(...firstWeekNotes(noteCtx));
    const christmas = christmasIndex === index;
    if (deload) {
      notes.push(DELOAD_NOTE);
      if (christmas) notes.push(CHRISTMAS_DELOAD_NOTE);
    } else if (christmas && index !== weeks) {
      notes.push(CHRISTMAS_NOTE);
    }
    if (index === weeks) notes.push(RACE_WEEK_NOTE);

    const week: Week = {
      index,
      start: formatIsoDate(start),
      end: formatIsoDate(start + 6),
      phase,
      deload,
      km,
      sessions,
    };
    if (notes.length > 0) week.note = frenchTypography(notes.join(' '));
    result.push(week);
  }

  return {
    input,
    weeks: result,
    paces: paceInfo.paces,
    predicted: paceInfo.predicted,
    totalKm: round3(result.reduce((acc, w) => acc + w.km, 0)),
  };
}

export function previewPlan(input: PlanInput, today?: string): PlanPreview {
  const plan = generatePlan(input, today);
  const week1 = plan.weeks[0];
  if (!week1) throw new PlanError('PLAN_TOO_SHORT', ['Le programme ne contient aucune semaine.']);
  return {
    week1,
    overview: plan.weeks.map((w) => ({ index: w.index, start: w.start, phase: w.phase, deload: w.deload, km: w.km })),
    paces: plan.paces,
    predicted: plan.predicted,
  };
}
