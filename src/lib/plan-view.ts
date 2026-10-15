/**
 * Rendu partagé du plan : cartes de séance, tableau d'allures, graphique des
 * phases (une barre par semaine). Utilisé par /gratuit/ (semaine 1) et /plan/.
 */
import { config } from '../config';
import type { Phase, Plan, RaceKind, Session, Week, WeekOverview } from '../shared/api-types';
import { h } from './dom';
import { formatDateShort, formatDayMonth, formatKm, formatMinutes, formatRaceKm, formatPace, formatRange } from './format';
import { icon } from './icons';
import { PACE_LABELS, PACE_ORDER, PHASE_LABELS, PHASE_ORDER, SESSION_TYPE_LABELS } from './labels';
import { loopUrl } from './links';

/** Clé stable d'une séance (case « fait »). */
export function sessionKey(session: Pick<Session, 'date' | 'type'>): string {
  return `${session.date}:${session.type}`;
}

export interface SessionCardOptions {
  /** Préfixe d'id unique (case « fait »). */
  idPrefix: string;
  /** Affiche la case « fait » (plan complet seulement). */
  done?: boolean;
  onDoneChange?: (done: boolean) => void;
  /** Base du lien de boucle (défaut : config.traceoAppUrl). */
  appUrl?: string;
}

export function renderSessionCard(session: Session, options: SessionCardOptions): HTMLElement {
  const typeLabel = SESSION_TYPE_LABELS[session.type] ?? session.type;
  const titleId = `${options.idPrefix}-title`;
  const card = h('article', {
    class: ['session', `session--${session.type}`, options.done ? 'is-done' : null],
    attrs: { 'aria-labelledby': titleId },
  });

  const km = session.type === 'course' ? formatRaceKm(session.km) : formatKm(session.km);
  const facts = [h('span', { class: 'session__km num', text: km })];
  if (session.durationMin > 0) {
    facts.push(h('span', { class: 'session__dur num', text: `≈ ${formatMinutes(session.durationMin)}` }));
  }

  card.append(
    h(
      'header',
      { class: 'session__head' },
      h('span', { class: 'session__type', text: typeLabel }),
      h('time', { class: 'session__day', attrs: { datetime: session.date }, text: formatDateShort(session.date) }),
    ),
    h('h4', { id: titleId, class: 'session__title', text: session.title }),
    h('p', { class: 'session__facts' }, facts),
  );

  if (session.paces.length > 0) {
    card.append(
      h(
        'ul',
        { class: 'session__paces', attrs: { 'aria-label': 'Allures' } },
        session.paces.map((pace) =>
          h('li', {}, h('span', { text: pace.label }), h('strong', { class: 'num', text: formatPace(pace.secPerKm) })),
        ),
      ),
    );
  }
  if (session.steps.length > 0) {
    card.append(h('ol', { class: 'session__steps' }, session.steps.map((step) => h('li', { text: step }))));
  }

  const actions = h('div', { class: 'session__actions' });
  if (session.loopKm !== null && session.loopKm > 0) {
    actions.append(
      h(
        'a',
        {
          class: 'btn btn--sm btn--loop',
          attrs: {
            href: loopUrl(session.loopKm, options.appUrl ?? config.traceoAppUrl),
            target: '_blank',
            rel: 'noopener',
          },
        },
        icon('loop'),
        `Générer ma boucle de ${formatKm(session.loopKm)}`,
        h('span', { class: 'sr-only', text: ' (ouvre Traceo dans un nouvel onglet)' }),
      ),
    );
  }
  if (options.onDoneChange) {
    const inputId = `${options.idPrefix}-done`;
    const input = h('input', { id: inputId, attrs: { type: 'checkbox' } });
    input.checked = Boolean(options.done);
    input.addEventListener('change', () => {
      card.classList.toggle('is-done', input.checked);
      options.onDoneChange?.(input.checked);
    });
    actions.append(
      h(
        'label',
        { class: 'check session__done', attrs: { for: inputId } },
        input,
        h('span', {}, 'Fait', h('span', { class: 'sr-only', text: ` : ${session.title}, ${formatDateShort(session.date)}` })),
      ),
    );
  }
  if (actions.childElementCount > 0) card.append(actions);
  return card;
}

/** Tableau des allures d'entraînement. */
export function renderPaceTable(paces: Plan['paces']): HTMLElement {
  return h(
    'dl',
    { class: 'pace-table' },
    PACE_ORDER.map((key) =>
      h(
        'div',
        { class: `pace-table__row pace-table__row--${key}` },
        h('dt', { text: PACE_LABELS[key] }),
        h('dd', { class: 'num', text: formatPace(paces[key]) }),
      ),
    ),
  );
}

type ChartWeek = Pick<WeekOverview, 'index' | 'start' | 'phase' | 'deload' | 'km'> & { sessions?: Session[] };

/** Distance de la séance `course` (SPEC section 2 : 42,195 / 21,1 km). */
const RACE_SESSION_KM: Readonly<Record<RaceKind, number>> = { marathon: 42.195, semi: 21.1 };

/**
 * Volume d'entraînement de chaque semaine, course exclue, dans le même ordre.
 * Le `km` de la semaine de course (la dernière) inclut la course et dépasse souvent le
 * pic : graphiques et « au plus fort » ne montrent donc que l'entraînement.
 */
export function trainingKmByWeek(weeks: readonly ChartWeek[], race: RaceKind): number[] {
  return weeks.map((week, i) => {
    if (i < weeks.length - 1) return week.km;
    const km = week.sessions
      ? week.sessions.filter((s) => s.type !== 'course').reduce((sum, s) => sum + s.km, 0)
      : week.km - RACE_SESSION_KM[race];
    return Math.max(0, Math.round(km * 1000) / 1000);
  });
}

export interface PhaseChartOptions {
  currentIndex?: number;
  /** Rend chaque barre cliquable (ex. ouvrir la semaine dans le plan). */
  onSelect?: (index: number) => void;
  /**
   * Course du plan : la dernière barre montre l'entraînement de la semaine, sans la course
   * (voir `trainingKmByWeek`). Absent : les `km` sont pris tels quels.
   */
  race?: RaceKind;
}

/** Graphique « une barre par semaine », coloré par phase, avec légende. */
export function renderPhaseChart(weeks: ChartWeek[], options: PhaseChartOptions = {}): HTMLElement {
  const kms = options.race ? trainingKmByWeek(weeks, options.race) : weeks.map((w) => w.km);
  const maxKm = Math.max(1, ...kms);
  const list = h('ol', { class: 'phase-chart__bars', attrs: { 'aria-label': 'Volume de chaque semaine' } });
  weeks.forEach((week, i) => {
    const km = kms[i] ?? week.km;
    const withRace = options.race !== undefined && i === weeks.length - 1;
    const label = `Semaine ${week.index}, du ${formatDayMonth(week.start)} : ${PHASE_LABELS[week.phase] ?? week.phase}${
      week.deload ? ', allégée' : ''
    }, ${formatKm(km)}${withRace ? ' et la course' : ''}`;
    const bar = h('span', {
      class: ['phase-chart__bar', `phase--${week.phase}`, week.deload ? 'is-deload' : null],
      style: { '--h': `${Math.max(8, Math.round((km / maxKm) * 100))}%` },
    });
    const content = options.onSelect
      ? h(
          'button',
          {
            class: 'phase-chart__hit',
            attrs: { type: 'button', 'aria-label': label },
            on: { click: () => options.onSelect?.(week.index) },
          },
          bar,
        )
      : h('span', { class: 'phase-chart__hit' }, bar, h('span', { class: 'sr-only', text: label }));
    list.append(
      h('li', { class: ['phase-chart__item', week.index === options.currentIndex ? 'is-current' : null] }, content),
    );
  });
  const present = PHASE_ORDER.filter((phase) => weeks.some((w) => w.phase === phase));
  return h(
    'figure',
    { class: 'phase-chart' },
    list,
    h(
      'figcaption',
      { class: 'phase-chart__legend' },
      present.map((phase) => phaseLegendItem(phase)),
      weeks.some((w) => w.deload)
        ? h('span', { class: 'legend-item' }, h('span', { class: 'legend-swatch is-deload' }), 'Semaine allégée')
        : null,
    ),
  );
}

function phaseLegendItem(phase: Phase): HTMLElement {
  return h(
    'span',
    { class: 'legend-item' },
    h('span', { class: ['legend-swatch', `phase--${phase}`] }),
    PHASE_LABELS[phase],
  );
}

/** Pastille de phase. */
export function phaseBadge(phase: Phase): HTMLElement {
  return h('span', { class: ['phase-badge', `phase--${phase}`], text: PHASE_LABELS[phase] ?? phase });
}

/** « Semaine 3 · 2 – 8 nov. » */
export function weekHeading(week: Pick<Week, 'index' | 'start' | 'end'>): string {
  return `Semaine ${week.index} · ${formatRange(week.start, week.end)}`;
}
