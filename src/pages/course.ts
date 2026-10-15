/**
 * Pages courses : /courses/ (liste) et /courses/<slug>/ (une page par course), générées
 * au build par build/races-plugin.ts à partir de data/races.json (SPEC section 4).
 *
 * Le contenu est entièrement statique (lisible sans JavaScript, indexable). Ce module ajoute :
 * - prix, compte à rebours du lancement et boutons `[data-checkout]` (bootPage) ;
 * - l'achat depuis la page, avec la course et l'objectif choisis (`openCheckout`) ;
 * - le nombre de jours avant la course et l'état de chaque date de départ ;
 * - « si tu crées ton plan aujourd'hui » : même règle de calendrier que le moteur
 *   (premier lundi à venir, au plus 24 / 20 semaines, au moins 8) ;
 * - le filtre marathons / semis de la liste.
 *
 * Partie pure, exportée et testée : `planCalendar`, `daysUntilLabel`.
 * Hors navigateur (tests), le module n'accède pas au DOM.
 */
import type { Level, RaceKind } from '../shared/api-types';
import { bootPage } from '../lib/boot';
import { openCheckout, type CheckoutOptions } from '../lib/checkout';
import { h, onReady, qs, qsa } from '../lib/dom';
import { addDaysIso, daysBetween, formatDateLong, localTodayIso, parseIsoDate } from '../lib/format';
import { isLevel, isRaceKind } from '../lib/labels';

/* ================================================================== */
/* Partie pure                                                         */
/* ================================================================== */

/** Durée minimale d'un plan (SPEC section 2, `PLAN_TOO_SHORT` en dessous). */
export const MIN_PLAN_WEEKS = 8;

/** Durée complète du plan (SPEC section 2) : au-delà, le plan démarre plus tard. */
export const FULL_PLAN_WEEKS: Readonly<Record<RaceKind, number>> = { marathon: 24, semi: 20 };

export type PlanCalendar =
  | {
      status: 'ok';
      /** Lundi du jour 1. */
      start: string;
      weeks: number;
      /** La course est loin : le plan complet démarre plus tard que lundi prochain. */
      deferred: boolean;
      /** Moins de semaines que le format complet : base raccourcie. */
      shortened: boolean;
    }
  | { status: 'too-short'; weeksLeft: number }
  | { status: 'past' };

/** 0 = lundi … 6 = dimanche. */
function weekday(iso: string): number {
  const date = parseIsoDate(iso);
  if (!date) throw new RangeError(`Date ISO invalide : ${iso}`);
  return (date.getUTCDay() + 6) % 7;
}

/**
 * Calendrier d'un plan créé le jour `today` pour une course à `raceDate`, avec la règle
 * du moteur : départ le premier lundi à partir d'aujourd'hui ; si la course est à plus
 * de 24 semaines (marathon) ou 20 (semi), départ reporté pour en garder exactement 24 / 20 ;
 * moins de 8 semaines : trop court.
 */
export function planCalendar(race: RaceKind, raceDate: string, today: string): PlanCalendar {
  if (raceDate < today) return { status: 'past' };
  const firstMonday = weekday(today) === 0 ? today : addDaysIso(today, 7 - weekday(today));
  const raceMonday = addDaysIso(raceDate, -weekday(raceDate));
  const available = raceMonday >= firstMonday ? daysBetween(firstMonday, raceMonday) / 7 + 1 : 0;
  if (available < MIN_PLAN_WEEKS) return { status: 'too-short', weeksLeft: available };
  const full = FULL_PLAN_WEEKS[race];
  if (available > full) {
    return { status: 'ok', start: addDaysIso(raceMonday, -(full - 1) * 7), weeks: full, deferred: true, shortened: false };
  }
  return { status: 'ok', start: firstMonday, weeks: available, deferred: false, shortened: available < full };
}

/** « dans 12 jours », « demain », « aujourd’hui », ou `null` si la date est passée. */
export function daysUntilLabel(days: number): string | null {
  if (!Number.isFinite(days) || days < 0) return null;
  if (days === 0) return 'aujourd’hui';
  if (days === 1) return 'demain';
  return `dans ${days}\u00a0jours`;
}

/* ================================================================== */
/* Page d'une course                                                   */
/* ================================================================== */

interface RaceContext {
  race: RaceKind;
  raceDate: string;
  raceName: string;
}

function raceContext(): RaceContext | null {
  const root = qs('[data-race-page]');
  if (!root) return null;
  const { race, raceDate, raceName } = root.dataset;
  if (!isRaceKind(race) || !raceDate || !parseIsoDate(raceDate)) return null;
  return { race, raceDate, raceName: raceName ?? '' };
}

function selectedLevel(): Level | undefined {
  const checked = qs<HTMLInputElement>('[data-level-picker] input[name="level"]:checked');
  const value = checked?.value;
  return isLevel(value) ? value : undefined;
}

/** Options de la fenêtre d'achat : course de la page, objectif choisi. */
function checkoutOptions(): CheckoutOptions {
  const ctx = raceContext();
  if (!ctx) return {};
  const options: CheckoutOptions = { race: ctx.race, raceDate: ctx.raceDate };
  if (ctx.raceName) options.raceName = ctx.raceName;
  const level = selectedLevel();
  if (level) options.level = level;
  return options;
}

function bindCheckoutButtons(): void {
  for (const button of qsa('[data-course-checkout]')) {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      openCheckout({ ...checkoutOptions(), returnFocus: button });
    });
  }
}

/** L'objectif choisi suit aussi les liens vers la semaine 1 gratuite (`&level=`). */
function bindLevelPicker(): void {
  const picker = qs('[data-level-picker]');
  if (!picker) return;
  const sync = () => {
    const level = selectedLevel();
    for (const link of qsa<HTMLAnchorElement>('a[data-free-link], a[data-course-checkout]')) {
      const url = new URL(link.href, location.origin);
      if (level && level !== 'finisher') url.searchParams.set('level', level);
      else url.searchParams.delete('level');
      link.href = `${url.pathname}${url.search}`;
    }
  };
  picker.addEventListener('change', sync);
  sync();
}

function renderCountdown(ctx: RaceContext, today: string): void {
  const el = qs('[data-race-countdown]');
  if (!el) return;
  const days = daysBetween(today, ctx.raceDate);
  if (!Number.isFinite(days)) return;
  if (days < 0) el.textContent = 'Course passée';
  else if (days === 0) el.textContent = 'C’est le jour\u00a0J\u00a0!';
  else if (days === 1) el.textContent = 'Course demain\u00a0!';
  else {
    // « J-192 » à l'écran, une phrase complète pour les lecteurs d'écran.
    el.replaceChildren(
      h('span', { attrs: { 'aria-hidden': 'true' }, text: `J-${days}` }),
      h('span', { class: 'sr-only', text: `La course est dans ${days} jours.` }),
    );
  }
  el.hidden = false;
}

function renderStartStatuses(today: string): void {
  for (const option of qsa('[data-start-option]')) {
    const start = option.dataset.start;
    const status = qs('[data-start-status]', option);
    if (!start || !status) continue;
    const label = daysUntilLabel(daysBetween(today, start));
    option.classList.toggle('is-past', label === null);
    status.textContent = label === null ? 'Date passée' : `Début ${label}`;
  }
}

function startNowContent(calendar: PlanCalendar, today: string): HTMLElement[] {
  const title = h('h3', { class: 'start-now__title', text: 'Si tu crées ton plan aujourd’hui' });
  if (calendar.status === 'past') {
    return [
      title,
      h('p', {}, 'Cette course est passée. ', h('a', { attrs: { href: '/courses/' }, text: 'Jette un œil aux autres courses de printemps' }), '.'),
    ];
  }
  if (calendar.status === 'too-short') {
    return [
      title,
      h('p', {
        text:
          `Il reste moins de ${MIN_PLAN_WEEKS}\u00a0semaines avant la course\u00a0: trop peu pour une prépa complète sans te blesser. ` +
          'Vise une course plus lointaine, ou cours celle-ci tranquillement, sans objectif de chrono.',
      }),
      h('p', {}, h('a', { attrs: { href: '/courses/' }, text: 'Voir les autres courses de printemps' })),
    ];
  }
  const start = formatDateLong(calendar.start);
  const when = calendar.start === today ? `aujourd’hui, ${start}` : `le ${start}`;
  let text: string;
  if (calendar.deferred) {
    text =
      `Il démarre ${when}\u00a0: ${calendar.weeks}\u00a0semaines pile jusqu’au jour\u00a0J. ` +
      'D’ici là, entretiens ta forme avec 2 ou 3 footings faciles par semaine.';
  } else if (calendar.shortened) {
    text =
      `Il reste ${calendar.weeks}\u00a0semaines\u00a0: ton plan démarre ${when}, avec une phase de base raccourcie. ` +
      'Il garde une progression de 10\u00a0% maximum par semaine, des semaines allégées et un vrai affûtage.';
  } else {
    text = `Il démarre ${when}\u00a0: ${calendar.weeks}\u00a0semaines pile jusqu’au jour\u00a0J.`;
  }
  return [title, h('p', { text })];
}

function renderStartNow(ctx: RaceContext, today: string): void {
  const box = qs('[data-start-now]');
  if (!box) return;
  const calendar = planCalendar(ctx.race, ctx.raceDate, today);
  box.replaceChildren(...startNowContent(calendar, today));
  box.classList.toggle('is-warn', calendar.status !== 'ok');
  box.hidden = false;
}

/* ================================================================== */
/* Liste des courses                                                   */
/* ================================================================== */

type RaceFilter = RaceKind | 'all';

function isRaceFilter(value: unknown): value is RaceFilter {
  return value === 'all' || isRaceKind(value);
}

function initFilter(): void {
  const bar = qs('[data-race-filter]');
  if (!bar) return;
  const buttons = qsa<HTMLButtonElement>('button[data-filter]', bar);
  const status = qs('[data-race-filter-status]');
  const apply = (filter: RaceFilter, announce: boolean) => {
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    let shown = 0;
    for (const item of qsa('.race-item[data-kind]')) {
      const visible = filter === 'all' || item.dataset.kind === filter;
      item.hidden = !visible;
      if (visible) shown += 1;
    }
    for (const month of qsa('[data-race-month]')) {
      month.hidden = qsa('.race-item:not([hidden])', month).length === 0;
    }
    if (status && announce) status.textContent = `${shown} course${shown > 1 ? 's' : ''} affichée${shown > 1 ? 's' : ''}`;
  };
  bar.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-filter]') : null;
    const filter = button?.dataset.filter;
    if (isRaceFilter(filter)) apply(filter, true);
  });
  apply('all', false);
  bar.hidden = false;
}

/* ================================================================== */
/* Démarrage                                                           */
/* ================================================================== */

function init(): void {
  bootPage({ checkoutDefaults: checkoutOptions });
  onReady(() => {
    const today = localTodayIso();
    const ctx = raceContext();
    if (ctx) {
      bindCheckoutButtons();
      bindLevelPicker();
      renderCountdown(ctx, today);
      renderStartStatuses(today);
      renderStartNow(ctx, today);
    }
    initFilter();
  });
}

if (typeof document !== 'undefined') init();
