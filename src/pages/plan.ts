/**
 * Plan complet (/plan/) : jeton depuis `#t=` ou le stockage local, réglages
 * mémorisés, appel à POST /api/plan, vue semaine par semaine (semaine courante
 * ouverte), cartes de séance avec case « fait » persistée et bouton de boucle,
 * export .ics, impression, image story, installation, repli hors ligne.
 */
import { config } from '../config';
import type { Plan, Week } from '../shared/api-types';
import { clearToken, storeToken, storedToken, supportMailto, tokenFromHash, tokenInfo } from '../lib/access';
import { isPlan, postPlan, type ApiFailure } from '../lib/api';
import { bootPage } from '../lib/boot';
import { createWaiverField, hasRecordedWaiver, hasWaiverRef, parseClientReference, readCheckoutPrefs, recordWaiver } from '../lib/checkout';
import { announce, copyText, downloadBlob, h, must, prefersReducedMotion, qs, qsa, toast } from '../lib/dom';
import {
  daysBetween,
  formatDate,
  formatDateLong,
  formatDayMonthLong,
  formatDuration,
  formatKm,
  formatRange,
  localTodayIso,
} from '../lib/format';
import { buildPlanIcs, icsFilename } from '../lib/ics';
import { icon } from '../lib/icons';
import { createInstallButton, mountIosInstallBanner } from '../lib/install-banner';
import { PHASE_LABELS, levelLabel } from '../lib/labels';
import { extractToken, personalPlanUrl } from '../lib/links';
import { createPlanForm } from '../lib/plan-form';
import { DEFAULT_VALUES, inputToValues, isPlanFormValues, valuesToInput, type PlanFormValues } from '../lib/plan-input';
import { phaseBadge, renderPaceTable, renderPhaseChart, renderSessionCard, sessionKey } from '../lib/plan-view';
import { createStoryPanel, type StoryData } from '../lib/share-canvas';
import { STORAGE_KEYS, isRecord, readJson, writeJson } from '../lib/storage';

bootPage();

const app = must('#plan-app');
const headerSettings = qs<HTMLAnchorElement>('#header-settings');

/* ================================================================== */
/* Données locales                                                     */
/* ================================================================== */

interface LastPlan {
  savedAt: string;
  plan: Plan;
}

function isLastPlan(v: unknown): v is LastPlan {
  return isRecord(v) && typeof v.savedAt === 'string' && isPlan(v.plan);
}

type DoneMap = Record<string, string>;

function isDoneMap(v: unknown): v is DoneMap {
  return isRecord(v) && Object.values(v).every((x) => typeof x === 'string');
}

function readDone(): DoneMap {
  return readJson(STORAGE_KEYS.done, isDoneMap) ?? {};
}

function setDone(key: string, done: boolean): void {
  const map = readDone();
  if (done) map[key] = new Date().toISOString();
  else delete map[key];
  writeJson(STORAGE_KEYS.done, map);
}

/** Réglages initiaux : mémorisés, sinon achat, page gratuite ou référence du jeton. */
function initialSettings(token: string): { values: PlanFormValues; fromStorage: boolean } {
  const stored = readJson(STORAGE_KEYS.settings, isPlanFormValues);
  if (stored) return { values: stored, fromStorage: true };
  let values: PlanFormValues = readJson(STORAGE_KEYS.freeForm, isPlanFormValues) ?? { ...DEFAULT_VALUES };
  const prefs = readCheckoutPrefs();
  const fromRef = parseClientReference(tokenInfo(token)?.ref);
  const choice = prefs ?? fromRef;
  if (choice) {
    const partial: Parameters<typeof inputToValues>[0] = { race: choice.race, level: choice.level };
    if (prefs?.raceDate) partial.raceDate = prefs.raceDate;
    if (prefs?.raceName) partial.raceName = prefs.raceName;
    // La course choisie à l'achat prime ; on garde le reste (T10, km…) de la page gratuite.
    if (values.race !== choice.race || prefs?.raceDate) values = inputToValues(partial, values);
    else values = { ...values, level: choice.level };
  }
  return { values, fromStorage: false };
}

/* ================================================================== */
/* États génériques                                                    */
/* ================================================================== */

function focusFirstHeading(): void {
  const heading = app.querySelector<HTMLElement>('h1');
  if (!heading) return;
  heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}

function screen(...children: (Node | null)[]): void {
  headerSettings?.setAttribute('hidden', '');
  app.replaceChildren(h('div', { class: 'wrap wrap--narrow section' }, ...children));
  window.scrollTo({ top: 0 });
  focusFirstHeading();
}

function supportLink(subject: string, body: string, label = 'Écris au support'): HTMLElement {
  const href = supportMailto(subject, body);
  return href
    ? h('a', { attrs: { href }, text: label })
    : h('a', { attrs: { href: '/mentions-legales/' }, text: `${label} (adresse dans les mentions légales)` });
}

function pasteLinkForm(): HTMLElement {
  const inputId = 'paste-link';
  const error = h('p', { id: `${inputId}-error`, class: 'error', attrs: { hidden: true } });
  const input = h('input', {
    id: inputId,
    attrs: {
      type: 'text',
      inputmode: 'url',
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: 'https://…/plan/#t=…',
      'aria-describedby': `${inputId}-error`,
    },
  });
  const form = h(
    'form',
    { class: 'paste-form', attrs: { novalidate: true } },
    h('label', { attrs: { for: inputId }, text: 'Colle ton lien personnel' }),
    h(
      'div',
      { class: 'copy-field' },
      input,
      h('button', { class: 'btn btn--primary', attrs: { type: 'submit' }, text: 'Ouvrir' }),
    ),
    error,
  );
  if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
    const paste = h('button', { class: 'btn btn--sm btn--ghost', attrs: { type: 'button' } }, icon('copy'), 'Coller depuis le presse-papiers');
    paste.addEventListener('click', async () => {
      try {
        input.value = (await navigator.clipboard.readText()).trim();
        input.focus();
      } catch {
        toast('Accès au presse-papiers refusé : colle le lien à la main.', 'error');
      }
    });
    form.append(paste);
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const token = extractToken(input.value);
    if (!token) {
      error.textContent = 'Ce n’est pas un lien personnel valide. Il ressemble à …/plan/#t=… : copie-le en entier.';
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    storeToken(token);
    try {
      history.replaceState(null, '', `/plan/#t=${token}`);
    } catch {
      // Le jeton est quand même enregistré localement.
    }
    void start();
  });
  return form;
}

function renderNoToken(): void {
  screen(
    h(
      'div',
      { class: 'state' },
      h('span', { class: 'state__icon' }, icon('lock')),
      h('h1', { text: 'Ton plan t’attend' }),
      h('p', {
        text: 'Ouvre le lien personnel reçu après ton achat (il se termine par #t=…). Sur une app installée, colle-le ici une seule fois : il sera gardé sur cet appareil.',
      }),
    ),
    h('div', { class: 'card' }, pasteLinkForm()),
    h(
      'div',
      { class: 'state state--compact' },
      h('p', { class: 'muted', text: 'Pas encore de pass ?' }),
      h(
        'div',
        { class: 'cluster' },
        h('a', { class: 'btn btn--primary', attrs: { href: '/', 'data-checkout': '' }, text: 'Je prends mon pass' }),
        h('a', { class: 'btn btn--ghost', attrs: { href: '/gratuit/' }, text: 'Semaine 1 gratuite' }),
      ),
      h(
        'p',
        { class: 'hint' },
        'Lien perdu ? ',
        supportLink('Pass J-24 : lien perdu', 'Bonjour,\n\nJ’ai perdu mon lien personnel Pass J-24.\n\nE-mail utilisé pour le paiement : '),
        ' avec l’e-mail utilisé pour l’achat : on te le renvoie.',
      ),
    ),
  );
}

function renderInvalidToken(message: string): void {
  screen(
    h(
      'div',
      { class: 'state state--error' },
      h('span', { class: 'state__icon' }, icon('alert')),
      h('h1', { text: 'Lien invalide' }),
      h('p', { attrs: { role: 'alert' }, text: message }),
      h(
        'p',
        {},
        supportLink(
          'Pass J-24 : lien invalide',
          'Bonjour,\n\nMon lien personnel Pass J-24 affiche « lien invalide ».\n\nE-mail utilisé pour le paiement : ',
        ),
        ' avec l’e-mail utilisé pour ton achat : on te renvoie un lien qui marche.',
      ),
    ),
    h('div', { class: 'card' }, pasteLinkForm()),
    h(
      'p',
      { class: 'center' },
      h('button', {
        class: 'btn btn--sm btn--ghost',
        attrs: { type: 'button' },
        text: 'Effacer ce lien de cet appareil',
        on: {
          click: () => {
            clearToken();
            try {
              history.replaceState(null, '', '/plan/');
            } catch {
              // Sans conséquence.
            }
            renderNoToken();
          },
        },
      }),
    ),
  );
  announce(`Lien invalide. ${message}`, 'assertive');
}

function renderLoading(): void {
  headerSettings?.setAttribute('hidden', '');
  app.replaceChildren(
    h(
      'div',
      { class: 'wrap section plan-loading', attrs: { 'aria-busy': 'true' } },
      h('p', { class: 'plan-loading__label', attrs: { role: 'status' } }, h('span', { class: 'spinner', attrs: { 'aria-hidden': 'true' } }), 'Chargement de ton plan…'),
      h('span', { class: 'skeleton skeleton--title', attrs: { 'aria-hidden': 'true' } }),
      h('span', { class: 'skeleton skeleton--line', attrs: { 'aria-hidden': 'true' } }),
      h('span', { class: 'skeleton skeleton--block', attrs: { 'aria-hidden': 'true' } }),
      h('span', { class: 'skeleton skeleton--block', attrs: { 'aria-hidden': 'true' } }),
    ),
  );
}

function renderFailure(failure: ApiFailure, retry: () => void): void {
  screen(
    h(
      'div',
      { class: 'state state--error' },
      h('span', { class: 'state__icon' }, icon('alert')),
      h('h1', { text: 'Impossible d’afficher ton plan' }),
      h('p', { attrs: { role: 'alert' }, text: failure.message }),
      h(
        'div',
        { class: 'cluster' },
        h('button', { class: 'btn btn--primary', attrs: { type: 'button' }, on: { click: retry } }, icon('refresh'), 'Réessayer'),
      ),
      h(
        'p',
        { class: 'hint' },
        'Le souci persiste ? ',
        supportLink('Pass J-24 : plan inaccessible', `Bonjour,\n\nMon plan ne s’affiche pas. Message : ${failure.message}\n\nE-mail utilisé pour le paiement : `),
        '.',
      ),
    ),
  );
}

function renderWaiverGate(onConfirm: () => void): void {
  const waiver = createWaiverField('plan');
  const button = h('button', {
    class: 'btn btn--primary btn--lg btn--block',
    attrs: { type: 'button', 'aria-disabled': 'true' },
    text: 'Confirmer et ouvrir mon plan',
  });
  waiver.input.addEventListener('change', () => button.setAttribute('aria-disabled', waiver.input.checked ? 'false' : 'true'));
  button.addEventListener('click', () => {
    if (!waiver.input.checked) {
      waiver.setError(true);
      waiver.input.focus();
      return;
    }
    recordWaiver();
    onConfirm();
  });
  screen(
    h(
      'div',
      { class: 'state' },
      h('span', { class: 'state__icon' }, icon('lock')),
      h('h1', { text: 'Avant d’ouvrir ton plan' }),
      h('p', { text: 'Ton plan est un contenu numérique disponible tout de suite. Pour l’ouvrir maintenant, confirme ta demande d’accès immédiat.' }),
    ),
    h(
      'div',
      { class: 'card plan-waiver' },
      waiver.root,
      button,
      h(
        'p',
        { class: 'hint' },
        'Tu préfères garder ton droit de rétractation de 14 jours ? Ne coche pas et ',
        supportLink(
          'Pass J-24 : je garde mon droit de rétractation',
          'Bonjour,\n\nJe préfère conserver mon droit de rétractation de 14 jours pour mon achat du Pass J-24.\n\nE-mail utilisé pour le paiement : ',
          'écris au support',
        ),
        '.',
      ),
    ),
  );
}

/* ================================================================== */
/* Réglages                                                            */
/* ================================================================== */

function renderSetup(token: string, values: PlanFormValues): void {
  const form = createPlanForm({
    idPrefix: 'setup',
    initial: values,
    submitLabel: 'Générer mon plan',
    onSubmit: (next) => {
      writeJson(STORAGE_KEYS.settings, next);
      void loadPlan(token, next);
    },
  });
  screen(
    h(
      'div',
      { class: 'plan-setup__intro' },
      h('p', { class: 'eyebrow', text: 'Bienvenue' }),
      h('h1', { text: 'Règle ton plan' }),
      h('p', {
        class: 'lead',
        text: 'Vérifie ta course et tes infos : ton plan complet se calcule aussitôt. Tu pourras tout modifier ensuite.',
      }),
    ),
    h('div', { class: 'card' }, form.form),
  );
  setupForm = form;
}

let setupForm: ReturnType<typeof createPlanForm> | null = null;

/* ================================================================== */
/* Vue du plan                                                         */
/* ================================================================== */

function currentWeekIndex(plan: Plan, today: string): number {
  const first = plan.weeks[0];
  const last = plan.weeks[plan.weeks.length - 1];
  if (!first || !last) return 1;
  if (today < first.start) return first.index;
  if (today > last.end) return last.index;
  return plan.weeks.find((w) => w.start <= today && today <= w.end)?.index ?? first.index;
}

function raceTitle(plan: Plan): string {
  return plan.input.raceName?.trim() || (plan.input.race === 'semi' ? 'Semi-marathon' : 'Marathon');
}

function countdownLabel(days: number): string {
  if (days > 0) return `J-${days}`;
  if (days === 0) return 'Jour J !';
  return 'Course passée';
}

function weekProgress(week: Week, done: DoneMap): { done: number; total: number } {
  const total = week.sessions.length;
  const count = week.sessions.filter((s) => done[sessionKey(s)]).length;
  return { done: count, total };
}

function stat(value: string, label: string, extraClass = ''): HTMLElement {
  return h(
    'div',
    { class: ['stat', extraClass] },
    h('span', { class: 'stat__value', text: value }),
    h('span', { class: 'stat__label', text: label }),
  );
}

function openWeek(index: number, scroll = true): void {
  const details = document.getElementById(`semaine-${index}`);
  if (!(details instanceof HTMLDetailsElement)) return;
  details.open = true;
  if (scroll) {
    details.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    details.querySelector('summary')?.focus({ preventScroll: true });
  }
}

function renderWeek(week: Week, isCurrent: boolean, done: DoneMap, onDoneChange: () => void): HTMLDetailsElement {
  const progress = weekProgress(week, done);
  const progressEl = h('span', {
    class: 'week__progress num',
    attrs: { 'aria-label': `${progress.done} séances faites sur ${progress.total}` },
    text: `${progress.done}/${progress.total}`,
  });
  const details = h('details', {
    id: `semaine-${week.index}`,
    class: ['week', `phase--${week.phase}`, isCurrent ? 'is-current' : null, week.deload ? 'is-deload' : null],
  });
  details.open = isCurrent;
  const summary = h(
    'summary',
    { class: 'week__summary' },
    h('span', { class: 'week__index', text: `S${week.index}` }),
    h(
      'span',
      { class: 'week__main' },
      h('strong', { class: 'week__dates', text: formatRange(week.start, week.end) }),
      h('span', { class: 'week__meta' }, `${PHASE_LABELS[week.phase] ?? week.phase} · ${formatKm(week.km)}`),
    ),
    h(
      'span',
      { class: 'week__badges' },
      isCurrent ? h('span', { class: 'badge badge--accent', text: 'Cette semaine' }) : null,
      week.deload ? h('span', { class: 'badge', text: 'Allégée' }) : null,
      progressEl,
    ),
    icon('chevronDown', { class: 'week__chevron' }),
  );

  const refreshProgress = () => {
    const next = weekProgress(week, readDone());
    progressEl.textContent = `${next.done}/${next.total}`;
    progressEl.setAttribute('aria-label', `${next.done} séances faites sur ${next.total}`);
    details.classList.toggle('is-complete', next.done === next.total && next.total > 0);
  };

  const body = h(
    'div',
    { class: 'week__body' },
    h('h3', { class: 'week__title' }, `Semaine ${week.index} · `, h('span', { text: formatRange(week.start, week.end) }), ' ', phaseBadge(week.phase)),
    week.note ? h('p', { class: 'notice', text: week.note }) : null,
    h(
      'div',
      { class: 'session-list' },
      week.sessions.map((session, i) =>
        renderSessionCard(session, {
          idPrefix: `w${week.index}-s${i}`,
          done: Boolean(done[sessionKey(session)]),
          onDoneChange: (isDone) => {
            setDone(sessionKey(session), isDone);
            refreshProgress();
            onDoneChange();
            if (isDone) announce(`Séance « ${session.title} » cochée. Bien joué !`);
          },
        }),
      ),
    ),
  );
  details.append(summary, body);
  if (progress.done === progress.total && progress.total > 0) details.classList.add('is-complete');
  return details;
}

interface RenderContext {
  token: string;
  values: PlanFormValues;
  offline: { savedAt: string; settingsDiffer: boolean } | null;
}

function storyData(plan: Plan, today: string): StoryData {
  const first = plan.weeks[0];
  const start = first?.start ?? today;
  const total = plan.weeks.length;
  const currentIndex = currentWeekIndex(plan, today);
  const daysToRace = daysBetween(today, plan.input.raceDate);
  const daysToStart = daysBetween(today, start);
  const peak = Math.max(...plan.weeks.map((w) => w.km));
  const done = readDone();
  const doneKm = plan.weeks
    .flatMap((w) => w.sessions)
    .filter((s) => done[sessionKey(s)])
    .reduce((sum, s) => sum + s.km, 0);
  let headline = 'Ma prépa commence';
  let highlight = 'lundi.';
  if (daysToStart > 7) highlight = `le ${formatDayMonthLong(start)}.`;
  else if (daysToStart <= 0) {
    headline = 'Ma prépa avance :';
    highlight = `semaine ${currentIndex}/${total}.`;
  }
  let host = location.host;
  try {
    host = new URL(config.siteUrl).host;
  } catch {
    // Repli sur l'hôte courant.
  }
  return {
    eyebrow: `${raceTitle(plan)} · ${formatDate(plan.input.raceDate)}`,
    headline,
    highlight,
    subline: `${total} semaines, du ${formatDayMonthLong(start)} au ${formatDayMonthLong(plan.input.raceDate)}`,
    bars: plan.weeks.map((w) => ({ phase: w.phase, km: w.km, deload: w.deload, current: daysToStart <= 0 && w.index === currentIndex })),
    stats: [
      daysToRace > 0 ? { value: `J-${daysToRace}`, label: 'avant le jour J' } : { value: String(total), label: 'semaines de prépa' },
      doneKm > 0 ? { value: formatKm(doneKm), label: 'déjà courus' } : { value: formatKm(peak), label: 'au plus fort' },
      { value: formatDuration(plan.predicted.raceSec), label: 'temps estimé' },
    ],
    footer: host,
  };
}

function renderPlan(plan: Plan, ctx: RenderContext): void {
  const today = localTodayIso();
  const currentIndex = currentWeekIndex(plan, today);
  const first = plan.weeks[0];
  const daysToRace = daysBetween(today, plan.input.raceDate);
  const daysToStart = first ? daysBetween(today, first.start) : 0;
  const total = plan.weeks.length;

  const allSessions = plan.weeks.flatMap((w) => w.sessions);
  const doneStat = stat('', 'séances faites');
  const refreshDone = () => {
    const done = readDone();
    const count = allSessions.filter((s) => done[sessionKey(s)]).length;
    const value = doneStat.querySelector('.stat__value');
    if (value) value.textContent = `${count}/${allSessions.length}`;
  };
  refreshDone();

  /* ---- En-tête ---- */
  const startLine =
    daysToStart > 0
      ? `Jour 1 : ${formatDateLong(first?.start ?? today, false)} (dans ${daysToStart} jour${daysToStart > 1 ? 's' : ''})`
      : `Semaine ${currentIndex} sur ${total}`;
  const hero = h(
    'section',
    { class: 'plan-hero', attrs: { 'aria-labelledby': 'plan-title' } },
    h(
      'div',
      { class: 'wrap plan-hero__inner' },
      h(
        'div',
        { class: 'plan-hero__copy' },
        h('p', { class: 'eyebrow', text: `${levelLabel(plan.input.race, plan.input.level)} · ${total} semaines` }),
        h('h1', { id: 'plan-title', text: raceTitle(plan) }),
        h('p', { class: 'plan-hero__date' }, formatDateLong(plan.input.raceDate), ' · ', h('strong', { text: startLine })),
      ),
      h('p', { class: 'plan-hero__countdown num', attrs: { 'aria-label': daysToRace > 0 ? `Jour J dans ${daysToRace} jours` : countdownLabel(daysToRace) }, text: countdownLabel(daysToRace) }),
    ),
    h(
      'div',
      { class: 'wrap' },
      h(
        'div',
        { class: 'stats' },
        stat(formatDuration(plan.predicted.raceSec), 'temps estimé'),
        stat(formatKm(Math.round(plan.totalKm)), 'au total'),
        stat(`S${currentIndex}`, daysToStart > 0 ? 'semaine de départ' : 'semaine en cours'),
        doneStat,
      ),
    ),
  );

  const notices: HTMLElement[] = [];
  if (ctx.offline) {
    notices.push(
      h(
        'p',
        { class: 'notice notice--warn', attrs: { role: 'status' } },
        h('strong', { text: 'Hors ligne. ' }),
        `Voici la dernière version enregistrée de ton plan (${formatDateLong(ctx.offline.savedAt.slice(0, 10), false)}).`,
        ctx.offline.settingsDiffer ? ' Tes nouveaux réglages seront appliqués dès que tu seras reconnecté.' : '',
      ),
    );
  }

  /* ---- Outils ---- */
  const install = createInstallButton('btn btn--sm');
  const storyBox = h('div', { class: 'plan-story', attrs: { hidden: true, id: 'story' } });
  let storyMounted = false;
  const storyToggle = h('button', { class: 'btn btn--sm', attrs: { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'story' } }, icon('image'), 'Image story');
  storyToggle.addEventListener('click', () => {
    const open = storyBox.hidden;
    storyBox.hidden = !open;
    storyToggle.setAttribute('aria-expanded', String(open));
    if (open && !storyMounted) {
      storyMounted = true;
      storyBox.append(
        h('h2', { text: 'Ton image story' }),
        h('p', { class: 'muted', text: 'Format 1080 × 1920, prête pour Instagram. Elle reprend tes semaines, ton objectif et tes kilomètres déjà courus.' }),
        createStoryPanel(() => storyData(plan, localTodayIso()), 'ma-prepa-j24.png'),
      );
    }
  });

  const tools = h(
    'nav',
    { class: 'wrap plan-tools no-print', attrs: { 'aria-label': 'Outils du plan' } },
    h(
      'div',
      { class: 'plan-tools__row' },
      h(
        'button',
        {
          class: 'btn btn--sm',
          attrs: { type: 'button' },
          on: {
            click: () => {
              try {
                const ics = buildPlanIcs(plan);
                downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), icsFilename(plan));
                toast('Agenda téléchargé : ouvre le fichier pour ajouter tes séances.');
              } catch {
                toast('Export impossible sur cet appareil.', 'error');
              }
            },
          },
        },
        icon('calendar'),
        'Agenda (.ics)',
      ),
      h('button', { class: 'btn btn--sm', attrs: { type: 'button' }, on: { click: () => window.print() } }, icon('printer'), 'Imprimer / PDF'),
      storyToggle,
      install.button,
      h(
        'button',
        { class: 'btn btn--sm btn--ghost', attrs: { type: 'button' }, on: { click: () => scrollToSettings() } },
        icon('settings'),
        'Réglages',
      ),
    ),
    install.help,
  );

  /* ---- Graphique ---- */
  const chart = h(
    'section',
    { class: 'wrap plan-overview', attrs: { 'aria-labelledby': 'overview-title' } },
    h('h2', { id: 'overview-title', class: 'plan-section-title', text: 'Vue d’ensemble' }),
    h('div', { class: 'card' }, renderPhaseChart(plan.weeks, { currentIndex, onSelect: (index) => openWeek(index) })),
  );

  /* ---- Semaines ---- */
  const done = readDone();
  const weeks = h(
    'section',
    { class: 'wrap plan-weeks', attrs: { 'aria-labelledby': 'weeks-title' } },
    h(
      'div',
      { class: 'plan-weeks__head' },
      h('h2', { id: 'weeks-title', class: 'plan-section-title', text: 'Semaine par semaine' }),
      h('button', {
        class: 'btn btn--sm btn--ghost no-print',
        attrs: { type: 'button' },
        text: 'Tout déplier',
        on: {
          click: (event) => {
            const button = event.currentTarget as HTMLButtonElement;
            const all = qsa<HTMLDetailsElement>('.week', app);
            const openAll = all.some((d) => !d.open);
            for (const d of all) d.open = openAll;
            button.textContent = openAll ? 'Tout replier' : 'Tout déplier';
          },
        },
      }),
    ),
    h('div', { class: 'weeks' }, plan.weeks.map((week) => renderWeek(week, week.index === currentIndex, done, refreshDone))),
  );

  /* ---- Allures ---- */
  const paces = h(
    'section',
    { class: 'wrap plan-paces', attrs: { 'aria-labelledby': 'paces-title' } },
    h('h2', { id: 'paces-title', class: 'plan-section-title', text: 'Tes allures' }),
    renderPaceTable(plan.paces),
  );

  /* ---- Réglages ---- */
  const settingsForm = createPlanForm({
    idPrefix: 'plan',
    initial: ctx.values,
    submitLabel: 'Mettre à jour mon plan',
    onSubmit: (next) => {
      writeJson(STORAGE_KEYS.settings, next);
      void loadPlan(ctx.token, next, { keepPosition: true });
    },
  });
  settingsForms.current = settingsForm;
  const link = personalPlanUrl(ctx.token, location.origin);
  const linkInput = h('input', { id: 'plan-personal-link', attrs: { type: 'text', readonly: true, spellcheck: 'false' } });
  linkInput.value = link;
  linkInput.addEventListener('focus', () => linkInput.select());
  const email = tokenInfo(ctx.token)?.sub ?? '';
  const settings = h(
    'section',
    { id: 'reglages', class: 'wrap wrap--narrow plan-settings no-print', attrs: { 'aria-labelledby': 'settings-title' } },
    h(
      'details',
      { class: 'card plan-settings__box' },
      h('summary', {}, h('span', { id: 'settings-title', text: 'Réglages du plan' }), icon('chevronDown')),
      h('div', { class: 'plan-settings__body' }, h('p', { class: 'muted', text: 'Change de course, d’objectif ou de rythme : le plan se recalcule aussitôt. Tes cases « fait » restent cochées pour les séances inchangées.' }), settingsForm.form),
    ),
    h(
      'div',
      { class: 'card plan-access' },
      h('h2', { text: 'Ton accès' }),
      email ? h('p', { class: 'muted' }, 'Pass au nom de ', h('strong', { text: email }), ', valable jusqu’au 30 juin 2027.') : null,
      h('label', { attrs: { for: 'plan-personal-link' }, text: 'Ton lien personnel (pour tes autres appareils)' }),
      h(
        'div',
        { class: 'copy-field' },
        linkInput,
        h(
          'button',
          {
            class: 'btn',
            attrs: { type: 'button' },
            on: {
              click: async () => {
                const ok = await copyText(link);
                toast(ok ? 'Lien copié.' : 'Copie impossible : sélectionne le lien à la main.', ok ? 'ok' : 'error');
              },
            },
          },
          icon('copy'),
          'Copier',
        ),
      ),
      h('button', {
        class: 'btn btn--sm btn--ghost',
        attrs: { type: 'button' },
        text: 'Oublier ce lien sur cet appareil',
        on: {
          click: () => {
            if (!window.confirm('Effacer ton lien et tes réglages de cet appareil ? Tu pourras rouvrir ton plan avec ton lien personnel.')) return;
            clearToken();
            try {
              history.replaceState(null, '', '/plan/');
            } catch {
              // Sans conséquence.
            }
            renderNoToken();
          },
        },
      }),
    ),
  );

  const health = h(
    'p',
    { class: 'wrap wrap--narrow health-warning plan-health' },
    h('strong', { text: 'Santé : ' }),
    'ce programme est généré automatiquement et ne remplace pas l’avis d’un médecin. Fais un bilan médical avant de commencer. En cas de douleur, de malaise ou de doute, arrête-toi et consulte.',
  );

  const printHead = h(
    'div',
    { class: 'print-only print-head' },
    h('p', { text: `Pass J-24 · ${raceTitle(plan)} · ${formatDateLong(plan.input.raceDate)}` }),
  );

  app.replaceChildren(
    printHead,
    hero,
    notices.length > 0 ? h('div', { class: 'wrap plan-notices' }, ...notices) : '',
    tools,
    h('div', { class: 'wrap' }, storyBox),
    chart,
    weeks,
    paces,
    settings,
    health,
  );
  headerSettings?.removeAttribute('hidden');
  mountIosInstallBanner({ personalLink: () => link });
}

const settingsForms: { current: ReturnType<typeof createPlanForm> | null } = { current: null };

function scrollToSettings(): void {
  const section = document.getElementById('reglages');
  const details = section?.querySelector('details');
  if (details) details.open = true;
  section?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  section?.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
}

headerSettings?.addEventListener('click', (event) => {
  // Garder `#t=…` dans l'adresse : on fait défiler sans changer le fragment.
  event.preventDefault();
  scrollToSettings();
});

/* ================================================================== */
/* Chargement                                                          */
/* ================================================================== */

function sameInput(a: Plan['input'], b: Plan['input']): boolean {
  return (
    a.race === b.race &&
    a.raceDate === b.raceDate &&
    (a.raceName ?? '') === (b.raceName ?? '') &&
    a.level === b.level &&
    a.t10 === b.t10 &&
    a.weeklyKm === b.weeklyKm &&
    a.sessions === b.sessions &&
    a.longRunDay === b.longRunDay
  );
}

async function loadPlan(token: string, values: PlanFormValues, options: { keepPosition?: boolean } = {}): Promise<void> {
  const firstRender = !app.querySelector('.plan-hero');
  if (firstRender || !options.keepPosition) renderLoading();
  else settingsForms.current?.setBusy(true, 'Mise à jour…');

  const input = valuesToInput(values);
  const result = await postPlan(token, input);

  if (result.ok) {
    if (!result.fromCache) writeJson(STORAGE_KEYS.lastPlan, { savedAt: new Date().toISOString(), plan: result.data } satisfies LastPlan);
    renderPlan(result.data, {
      token,
      values,
      offline: result.fromCache ? { savedAt: new Date().toISOString(), settingsDiffer: !sameInput(result.data.input, input) } : null,
    });
    if (!firstRender && options.keepPosition) {
      toast('Plan mis à jour.');
      announce('Ton plan a été recalculé.');
    } else {
      announce('Ton plan est prêt.');
    }
    return;
  }

  if (result.code === 'invalid_token') {
    renderInvalidToken('Ce lien d’accès n’est pas valide ou a expiré.');
    return;
  }

  if (result.code === 'invalid_input' || result.code === 'plan_too_short') {
    const messages = result.details.length > 0 ? result.details : [result.message];
    if (settingsForms.current && app.querySelector('.plan-hero')) {
      settingsForms.current.setBusy(false);
      scrollToSettings();
      settingsForms.current.showServerErrors(messages);
    } else {
      renderSetup(token, values);
      setupForm?.showServerErrors(messages);
    }
    return;
  }

  const last = readJson(STORAGE_KEYS.lastPlan, isLastPlan);
  if (last && (result.code === 'network' || result.code === 'timeout' || result.status >= 500)) {
    renderPlan(last.plan, {
      token,
      values,
      offline: { savedAt: last.savedAt, settingsDiffer: !sameInput(last.plan.input, input) },
    });
    return;
  }
  renderFailure(result, () => void loadPlan(token, values));
}

function proceed(token: string): void {
  const { values, fromStorage } = initialSettings(token);
  if (fromStorage) void loadPlan(token, values);
  else renderSetup(token, values);
}

async function start(): Promise<void> {
  const fromHash = tokenFromHash();
  if (fromHash) storeToken(fromHash, tokenInfo(fromHash)?.ref);
  const token = fromHash ?? storedToken();
  if (!token) {
    renderNoToken();
    return;
  }
  const info = tokenInfo(token);
  if (info && !hasWaiverRef(info.ref) && !hasRecordedWaiver()) {
    renderWaiverGate(() => proceed(token));
    return;
  }
  proceed(token);
}

/* ---- Impression : toutes les semaines dépliées ---- */
let reopened: HTMLDetailsElement[] = [];
window.addEventListener('beforeprint', () => {
  reopened = qsa<HTMLDetailsElement>('.week:not([open])', app);
  for (const d of reopened) d.open = true;
});
window.addEventListener('afterprint', () => {
  for (const d of reopened) d.open = false;
  reopened = [];
});

window.addEventListener('hashchange', () => {
  if (tokenFromHash()) void start();
});

void start();
