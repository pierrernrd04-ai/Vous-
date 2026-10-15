/**
 * Page gratuite (/gratuit/) : formulaire (préremplissable par `?race=&date=&name=`),
 * aperçu servi par /api/preview (semaine 1 complète + vue d'ensemble, semaines
 * suivantes verrouillées), calculateur d'allures, image story, achat.
 */
import { config } from '../config';
import type { PreviewResponse, WeekOverview } from '../shared/api-types';
import { getPreview } from '../lib/api';
import { bootPage } from '../lib/boot';
import type { CheckoutOptions } from '../lib/checkout';
import { announce, h, must, prefersReducedMotion } from '../lib/dom';
import {
  addDaysIso,
  formatClock,
  daysBetween,
  formatDate,
  formatDateLong,
  formatDayMonthLong,
  formatDuration,
  formatKm,
  formatPace,
  formatRange,
  localTodayIso,
  parseIsoDate,
} from '../lib/format';
import { icon } from '../lib/icons';
import { levelLabel } from '../lib/labels';
import { STANDARD_DISTANCES, pacePerKm, partsToSeconds, riegel, speedKmh, trainingPaces } from '../lib/pace';
import { createPlanForm } from '../lib/plan-form';
import {
  DEFAULT_VALUES,
  hasPrefillParams,
  isPlanFormValues,
  valuesFromQuery,
  valuesToInput,
  type PlanFormValues,
} from '../lib/plan-input';
import { phaseBadge, renderPaceTable, renderPhaseChart, renderSessionCard, weekHeading } from '../lib/plan-view';
import { bindPrices } from '../lib/price-ui';
import { createStoryPanel, type StoryData } from '../lib/share-canvas';
import { STORAGE_KEYS, readJson, writeJson } from '../lib/storage';

/* ---------- Valeurs de départ ---------- */
const params = new URLSearchParams(location.search);
const stored = readJson(STORAGE_KEYS.freeForm, isPlanFormValues);
const base: PlanFormValues = stored ?? { ...DEFAULT_VALUES };
const initial: PlanFormValues = hasPrefillParams(params) ? valuesFromQuery(params, base) : base;

let current: PlanFormValues = initial;

function checkoutOptions(values: PlanFormValues = current): CheckoutOptions {
  const input = valuesToInput(values);
  const opts: CheckoutOptions = { race: input.race, level: input.level };
  if (values.preset === 'autre') {
    opts.raceDate = input.raceDate;
    if (input.raceName) opts.raceName = input.raceName;
  }
  return opts;
}

bootPage({ checkoutDefaults: () => checkoutOptions() });

const statusEl = must('#preview-status');
const resultEl = must('#preview');

/* ---------- Formulaire ---------- */
const form = createPlanForm({
  idPrefix: 'free',
  initial,
  submitLabel: 'Voir ma semaine 1',
  onSubmit: (values) => void submit(values),
  onChange: (values) => {
    current = values;
    syncCalculatorFromForm(values);
  },
});
must('#plan-form').replaceChildren(form.form);

function rememberQuery(values: PlanFormValues): void {
  const input = valuesToInput(values);
  const next = new URLSearchParams();
  next.set('race', input.race);
  if (values.preset === 'autre') {
    next.set('date', input.raceDate);
    if (input.raceName) next.set('name', input.raceName);
  }
  try {
    history.replaceState(null, '', `${location.pathname}?${next.toString()}`);
  } catch {
    // Sans conséquence : l'URL n'est qu'un raccourci de partage.
  }
}

function showStatus(kind: 'loading' | 'error' | 'none', message = '', retry?: () => void): void {
  if (kind === 'none') {
    statusEl.replaceChildren();
    return;
  }
  if (kind === 'loading') {
    statusEl.replaceChildren(
      h('p', { class: 'free__loading' }, h('span', { class: 'spinner', attrs: { 'aria-hidden': 'true' } }), message),
    );
    return;
  }
  statusEl.replaceChildren(
    h(
      'div',
      { class: 'notice notice--danger free__error' },
      h('p', {}, h('strong', { text: 'Oups. ' }), message),
      retry
        ? h(
            'button',
            { class: 'btn btn--sm', attrs: { type: 'button' }, on: { click: retry } },
            icon('refresh'),
            'Réessayer',
          )
        : null,
    ),
  );
}

async function submit(values: PlanFormValues): Promise<void> {
  current = values;
  writeJson(STORAGE_KEYS.freeForm, values);
  rememberQuery(values);
  form.setBusy(true, 'Calcul de ta semaine 1…');
  showStatus('loading', 'Calcul de ta semaine 1…');
  const result = await getPreview(valuesToInput(values));
  form.setBusy(false);

  if (!result.ok) {
    if (result.code === 'invalid_input' || result.code === 'plan_too_short') {
      showStatus('none');
      form.showServerErrors(result.details.length > 0 ? result.details : [result.message]);
      return;
    }
    showStatus('error', result.message, () => void submit(values));
    announce(result.message, 'assertive');
    return;
  }

  showStatus('none');
  renderPreview(result.data, values);
  announce('Ta semaine 1 est prête.');
}

/* ---------- Aperçu ---------- */
function raceNameOf(values: PlanFormValues): string {
  const input = valuesToInput(values);
  return input.raceName ?? (input.race === 'semi' ? 'Semi-marathon' : 'Marathon');
}

function storyHeadline(startIso: string, today: string): { headline: string; highlight: string } {
  const days = daysBetween(today, startIso);
  const start = parseIsoDate(startIso);
  if (days <= 0) return { headline: 'Ma prépa est', highlight: 'lancée.' };
  if (days <= 7 && start?.getUTCDay() === 1) return { headline: 'Ma prépa commence', highlight: 'lundi.' };
  return { headline: 'Ma prépa commence le', highlight: `${formatDayMonthLong(startIso)}.` };
}

function siteHost(): string {
  try {
    return new URL(config.siteUrl).host;
  } catch {
    return location.host;
  }
}

function lockedWeek(week: WeekOverview, withBlur: boolean): HTMLElement {
  const end = addDaysIso(week.start, 6);
  return h(
    'li',
    { class: ['locked-week', `phase--${week.phase}`, week.deload ? 'is-deload' : null] },
    h(
      'div',
      { class: 'locked-week__head' },
      h('strong', { class: 'locked-week__index', text: `S${week.index}` }),
      h('span', { class: 'locked-week__dates', text: formatRange(week.start, end) }),
      phaseBadge(week.phase),
      week.deload ? h('span', { class: 'badge', text: 'Allégée' }) : null,
      h('span', { class: 'locked-week__km num', text: formatKm(week.km) }),
      icon('lock', { class: 'locked-week__lock', label: 'Contenu réservé au pass' }),
    ),
    withBlur
      ? h(
          'div',
          { class: 'locked-week__blur', attrs: { 'aria-hidden': 'true' } },
          ['Endurance fondamentale', 'Séance de qualité', 'Sortie longue'].map((label, i) =>
            h('span', { class: 'locked-week__line' }, h('b', { text: label }), h('i', { text: `${6 + i * 3} km` })),
          ),
        )
      : null,
  );
}

function renderPreview(preview: PreviewResponse, values: PlanFormValues): void {
  const input = valuesToInput(values);
  const today = localTodayIso();
  const week1 = preview.week1;
  const totalWeeks = preview.overview.length;
  const peakKm = Math.max(...preview.overview.map((w) => w.km), week1.km);
  const raceName = raceNameOf(values);
  const lockedCount = Math.max(0, totalWeeks - 1);

  const heading = h('h2', { id: 'result-title', attrs: { tabindex: -1 }, text: `Ta prépa : ${totalWeeks} semaines` });

  const head = h(
    'section',
    { class: 'card result__head', attrs: { 'aria-labelledby': 'result-title' } },
    h('p', { class: 'eyebrow', text: `${raceName} · ${formatDate(input.raceDate)}` }),
    heading,
    h(
      'p',
      { class: 'result__dates' },
      'Jour 1 : ',
      h('strong', { text: formatDateLong(week1.start, false) }),
      ' · Jour J : ',
      h('strong', { text: formatDateLong(input.raceDate, false) }),
    ),
    h(
      'div',
      { class: 'stats' },
      stat(formatDuration(preview.predicted.raceSec), 'temps estimé d’après ton 10 km'),
      stat(levelLabel(input.race, input.level), 'objectif choisi'),
      stat(formatKm(week1.km), 'en semaine 1'),
      stat(formatKm(peakKm), 'au plus fort de la prépa'),
    ),
    week1.note ? h('p', { class: 'notice notice--warn', text: week1.note }) : null,
  );

  const paces = h(
    'section',
    { class: 'result__block', attrs: { 'aria-labelledby': 'paces-title' } },
    h('h3', { id: 'paces-title', text: 'Tes allures d’entraînement' }),
    renderPaceTable(preview.paces),
    h('p', {
      class: 'hint',
      text: 'L’endurance fondamentale, c’est l’allure où tu peux parler en courant : la plus grande partie de ta prépa se fait là.',
    }),
  );

  const weekOne = h(
    'section',
    { class: 'result__block', attrs: { 'aria-labelledby': 'week1-title' } },
    h(
      'div',
      { class: 'result__block-head' },
      h('h3', { id: 'week1-title', text: weekHeading(week1) }),
      phaseBadge(week1.phase),
      h('span', { class: 'badge', text: formatKm(week1.km) }),
    ),
    h(
      'div',
      { class: 'session-list' },
      week1.sessions.map((session, i) => renderSessionCard(session, { idPrefix: `w1-s${i}` })),
    ),
  );

  const later = preview.overview.filter((w) => w.index !== week1.index);
  const overview = h(
    'section',
    { class: 'result__block', attrs: { 'aria-labelledby': 'overview-title' } },
    h('h3', { id: 'overview-title', text: 'Ta prépa en un coup d’œil' }),
    h('div', { class: 'card result__chart' }, renderPhaseChart(preview.overview, { currentIndex: week1.index })),
    h('ol', { class: 'locked-weeks' }, later.map((week, i) => lockedWeek(week, i < 2))),
    h(
      'div',
      { class: 'card card--accent unlock' },
      icon('lock', { class: 'unlock__icon' }),
      h('h4', { text: `Débloque les ${lockedCount} semaines suivantes` }),
      h('p', {
        text: 'Chaque séance datée jusqu’au jour J, une boucle Traceo par séance, l’export agenda, la version imprimable et Traceo Premium jusqu’au 5 avril 2027.',
      }),
      h(
        'a',
        {
          class: 'btn btn--primary btn--lg btn--block',
          attrs: { href: '/', 'data-checkout': '' },
          dataset: {
            race: input.race,
            level: input.level,
            ...(values.preset === 'autre' ? { raceDate: input.raceDate, raceName: input.raceName ?? '' } : {}),
          },
        },
        'Débloquer mon plan · ',
        h('span', { attrs: { 'data-price': 'amount' }, text: '' }),
      ),
      h('p', { class: 'hint center', attrs: { 'data-price': 'sentence' } }),
    ),
  );

  const { headline, highlight } = storyHeadline(week1.start, today);
  const storyData = (): StoryData => ({
    eyebrow: `${raceName} · ${formatDate(input.raceDate)}`,
    headline,
    highlight,
    subline: `${totalWeeks} semaines, du ${formatDayMonthLong(week1.start)} au ${formatDayMonthLong(input.raceDate)}`,
    bars: preview.overview.map((w) => ({ phase: w.phase, km: w.km, deload: w.deload, current: w.index === 1 })),
    stats: [
      { value: String(totalWeeks), label: 'semaines de prépa' },
      { value: formatDuration(preview.predicted.raceSec), label: 'temps estimé' },
      { value: formatKm(peakKm), label: 'au plus fort' },
    ],
    footer: siteHost(),
  });
  const story = h(
    'section',
    { class: 'result__block', attrs: { 'aria-labelledby': 'story-title' } },
    h('h3', { id: 'story-title', text: 'Annonce ta prépa' }),
    h('p', { class: 'muted', text: 'Ton image story « Ma prépa commence lundi », au format 1080 × 1920, prête pour Instagram.' }),
    createStoryPanel(storyData, 'ma-prepa-j24.png'),
  );

  resultEl.replaceChildren(h('div', { class: 'result' }, head, weekOne, paces, overview, story));
  resultEl.hidden = false;
  // Les prix des boutons ajoutés suivent l'état courant (lancement ou non).
  refreshPrices(resultEl);
  heading.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  heading.focus({ preventScroll: true });
}

function stat(value: string, label: string): HTMLElement {
  return h('div', { class: 'stat' }, h('span', { class: 'stat__value', text: value }), h('span', { class: 'stat__label', text: label }));
}

let stopResultPrices: (() => void) | null = null;

function refreshPrices(root: ParentNode): void {
  stopResultPrices?.();
  stopResultPrices = bindPrices(root);
}

/* ---------- Calculateur d'allures ---------- */
const calc = (() => {
  const distance = h(
    'select',
    { id: 'calc-distance', attrs: { name: 'distance' } },
    STANDARD_DISTANCES.map((d) => h('option', { attrs: { value: d.id }, text: d.label })),
    h('option', { attrs: { value: 'custom' }, text: 'Autre distance' }),
  );
  distance.value = '10k';
  const custom = h('input', {
    id: 'calc-km',
    attrs: { type: 'number', inputmode: 'decimal', min: 1, max: 100, step: 0.1, value: 15 },
  });
  const customField = h(
    'div',
    { class: 'field', attrs: { hidden: true } },
    h('label', { attrs: { for: 'calc-km' }, text: 'Distance en km' }),
    custom,
  );
  const num = (idName: string, label: string, max: number, value: number) =>
    h(
      'label',
      { class: 'time-input' },
      h('input', {
        id: idName,
        attrs: { type: 'number', inputmode: 'numeric', min: 0, max, step: 1, value, 'aria-describedby': 'calc-error' },
      }),
      h('span', { attrs: { 'aria-hidden': 'true' }, text: label }),
      h('span', { class: 'sr-only', text: label === 'h' ? 'heures' : label === 'min' ? 'minutes' : 'secondes' }),
    );
  const hours = num('calc-h', 'h', 9, 0);
  const minutes = num('calc-m', 'min', 59, 55);
  const seconds = num('calc-s', 's', 59, 0);
  const error = h('p', { id: 'calc-error', class: 'error', attrs: { hidden: true } });
  const summary = h('p', { class: 'calc__summary', attrs: { 'aria-live': 'polite' } });
  const trainingBox = h('div', { class: 'calc__col' });
  const equivBox = h('div', { class: 'calc__col' });
  const out = h('div', { class: 'calc__out' }, summary, h('div', { class: 'calc__grid' }, trainingBox, equivBox));

  const formEl = h(
    'form',
    { class: 'calc__form', attrs: { novalidate: true } },
    h('div', { class: 'field' }, h('label', { attrs: { for: 'calc-distance' }, text: 'Distance courue' }), distance),
    customField,
    h('fieldset', { class: 'field' }, h('legend', { text: 'Ton temps' }), h('div', { class: 'time-inputs' }, hours, minutes, seconds)),
    error,
  );
  formEl.addEventListener('submit', (e) => e.preventDefault());

  const inputValue = (label: HTMLElement): number => {
    const input = label.querySelector('input');
    return input && input.value.trim() !== '' ? Number(input.value) : 0;
  };
  const setInput = (label: HTMLElement, value: number) => {
    const input = label.querySelector('input');
    if (input) input.value = String(value);
  };

  let timer = 0;
  const compute = () => {
    customField.hidden = distance.value !== 'custom';
    const km =
      distance.value === 'custom' ? Number(custom.value) : STANDARD_DISTANCES.find((d) => d.id === distance.value)?.km ?? 10;
    const total = partsToSeconds({ h: inputValue(hours), m: inputValue(minutes), s: inputValue(seconds) });
    const paces = total && km > 0 ? trainingPaces(total, km) : null;
    const pace = total ? pacePerKm(total, km) : Number.NaN;
    const plausible = paces !== null && pace >= 150 && pace <= 720;
    if (!total || !(km > 0) || !plausible || !paces) {
      error.textContent = 'Indique une distance et un temps réalistes (entre 2:30 et 12:00 par km).';
      error.hidden = false;
      out.hidden = true;
      return;
    }
    error.hidden = true;
    out.hidden = false;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      summary.replaceChildren(
        'Allure : ',
        h('strong', { class: 'num', text: formatPace(pace) }),
        ' · Vitesse : ',
        h('strong', { class: 'num', text: `${speedKmh(total, km).toFixed(1).replace('.', ',')} km/h` }),
      );
    }, 250);
    trainingBox.replaceChildren(
      h('h3', { text: 'Allures d’entraînement' }),
      h(
        'dl',
        { class: 'pace-table' },
        (
          [
            ['Récupération', paces.recup],
            ['Endurance fondamentale', paces.ef],
            ['Allure marathon', paces.marathon],
            ['Allure semi', paces.semi],
            ['Seuil', paces.seuil],
            ['Allure 10 km', paces.as10],
          ] as const
        ).map(([label, value]) =>
          h('div', { class: 'pace-table__row' }, h('dt', { text: label }), h('dd', { class: 'num', text: formatPace(value) })),
        ),
      ),
    );
    equivBox.replaceChildren(
      h('h3', { text: 'Temps équivalents' }),
      h(
        'table',
        { class: 'equiv' },
        h('thead', {}, h('tr', {}, h('th', { attrs: { scope: 'col' }, text: 'Distance' }), h('th', { attrs: { scope: 'col' }, text: 'Temps' }), h('th', { attrs: { scope: 'col' }, text: 'Allure' }))),
        h(
          'tbody',
          {},
          STANDARD_DISTANCES.map((d) => {
            const t = riegel(total, km, d.km);
            return h(
              'tr',
              {},
              h('th', { attrs: { scope: 'row' }, text: d.label }),
              h('td', { class: 'num', text: formatClock(t) }),
              h('td', { class: 'num', text: formatPace(t / d.km) }),
            );
          }),
        ),
      ),
      h('p', { class: 'hint', text: 'Équivalences théoriques : sur marathon, l’entraînement et la météo comptent autant que le chrono.' }),
    );
  };
  formEl.addEventListener('input', compute);
  formEl.addEventListener('change', compute);

  must('#calc').replaceChildren(formEl, out);
  compute();

  let touched = false;
  formEl.addEventListener('input', () => {
    touched = true;
  });

  return {
    /** Recopie le temps sur 10 km du formulaire tant que le calculateur n'a pas été modifié. */
    syncT10(t10: number) {
      if (touched || !Number.isFinite(t10) || t10 <= 0) return;
      distance.value = '10k';
      setInput(hours, Math.floor(t10 / 3600));
      setInput(minutes, Math.floor((t10 % 3600) / 60));
      setInput(seconds, Math.round(t10 % 60));
      compute();
    },
  };
})();

function syncCalculatorFromForm(values: PlanFormValues): void {
  calc.syncT10(values.t10);
}

calc.syncT10(initial.t10);
