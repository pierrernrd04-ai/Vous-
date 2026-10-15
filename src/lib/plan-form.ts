/**
 * Formulaire de plan (page gratuite et réglages du plan) : course, objectif,
 * temps sur 10 km, kilométrage, séances, jour de sortie longue.
 * Validation en ligne (au départ du champ et à l'envoi), erreurs reliées aux
 * champs (`aria-describedby`, `aria-invalid`), résumé annoncé à l'envoi.
 */
import type { Level, RaceKind } from '../shared/api-types';
import { announce, h } from './dom';
import { addDaysIso, formatDateShort, localTodayIso } from './format';
import { LEVELS, RACE_PRESETS, levelHint, levelLabel } from './labels';
import {
  MAX_DAYS_AHEAD,
  MIN_PLAN_WEEKS,
  RACE_NAME_MAX,
  WEEKLY_KM_MAX,
  WEEKLY_KM_MIN,
  validateValues,
  type FieldErrors,
  type FieldName,
  type PlanFormValues,
  type RaceChoice,
} from './plan-input';

export interface PlanFormOptions {
  /** Préfixe des id (plusieurs formulaires possibles sur une page). */
  idPrefix: string;
  initial: PlanFormValues;
  submitLabel: string;
  onSubmit: (values: PlanFormValues) => void;
  /** Appelé à chaque modification valide ou non (ex. calculateur d'allures). */
  onChange?: (values: PlanFormValues) => void;
}

export interface PlanFormHandle {
  form: HTMLFormElement;
  getValues(): PlanFormValues;
  setValues(values: PlanFormValues): void;
  setBusy(busy: boolean, label?: string): void;
  /** Erreurs du serveur (liste de phrases en français). */
  showServerErrors(messages: string[]): void;
}

function radioGroup<T extends string>(
  name: string,
  legend: string,
  options: { value: T; label: string; hint?: string }[],
  extraClass = '',
  describedBy?: string,
): { fieldset: HTMLFieldSetElement; inputs: HTMLInputElement[] } {
  const inputs: HTMLInputElement[] = [];
  const choices = h(
    'div',
    { class: ['choices', extraClass] },
    options.map((option) => {
      const input = h('input', { attrs: { type: 'radio', name, value: option.value } });
      inputs.push(input);
      return h(
        'label',
        { class: option.hint ? 'choice choice--card' : 'choice' },
        input,
        h(
          'span',
          {},
          option.hint ? h('strong', { text: option.label }) : option.label,
          option.hint ? h('small', { text: option.hint }) : null,
        ),
      );
    }),
  );
  const fieldset = h(
    'fieldset',
    { class: 'field', attrs: describedBy ? { 'aria-describedby': describedBy } : {} },
    h('legend', { text: legend }),
    choices,
  );
  return { fieldset, inputs };
}

function checkedValue(inputs: HTMLInputElement[]): string | undefined {
  return inputs.find((i) => i.checked)?.value;
}

function setChecked(inputs: HTMLInputElement[], value: string): void {
  for (const input of inputs) input.checked = input.value === value;
}

function errorEl(id: string): HTMLParagraphElement {
  return h('p', { id, class: 'error', attrs: { hidden: true } });
}

export function createPlanForm(options: PlanFormOptions): PlanFormHandle {
  const p = options.idPrefix;
  const today = localTodayIso();
  const id = (suffix: string) => `${p}-${suffix}`;

  /* ---- Course ---- */
  const presetError = errorEl(id('preset-error'));
  const preset = radioGroup<RaceChoice>(
    id('preset'),
    'Ta course',
    [
      { value: 'marathon', label: 'Marathon', hint: `${formatDateShort(RACE_PRESETS.marathon.date)} 2027 · Paris` },
      { value: 'semi', label: 'Semi-marathon', hint: `${formatDateShort(RACE_PRESETS.semi.date)} 2027 · Paris` },
      { value: 'autre', label: 'Autre course', hint: 'Date libre, au printemps ou plus tard' },
    ],
    'choices--cards',
    id('preset-error'),
  );
  preset.fieldset.append(presetError);

  const distance = radioGroup<RaceKind>(id('race'), 'Distance', [
    { value: 'marathon', label: 'Marathon' },
    { value: 'semi', label: 'Semi-marathon' },
  ]);
  const dateInput = h('input', {
    id: id('date'),
    attrs: {
      type: 'date',
      name: 'raceDate',
      min: addDaysIso(today, MIN_PLAN_WEEKS * 7),
      max: addDaysIso(today, MAX_DAYS_AHEAD),
      'aria-describedby': `${id('date-hint')} ${id('date-error')}`,
    },
  });
  const dateError = errorEl(id('date-error'));
  const nameInput = h('input', {
    id: id('name'),
    attrs: {
      type: 'text',
      name: 'raceName',
      maxlength: RACE_NAME_MAX,
      autocomplete: 'off',
      placeholder: 'ex. Semi de ma ville',
      'aria-describedby': id('name-error'),
    },
  });
  const nameError = errorEl(id('name-error'));
  const other = h(
    'div',
    { class: 'plan-form__other', attrs: { hidden: true } },
    distance.fieldset,
    h(
      'div',
      { class: 'field' },
      h('label', { attrs: { for: id('date') }, text: 'Date de la course' }),
      dateInput,
      h('p', { id: id('date-hint'), class: 'hint', text: 'Au moins 8 semaines à partir d’aujourd’hui.' }),
      dateError,
    ),
    h(
      'div',
      { class: 'field' },
      h('label', { attrs: { for: id('name') } }, 'Nom de la course ', h('span', { class: 'muted', text: '(facultatif)' })),
      nameInput,
      nameError,
    ),
  );

  /* ---- Objectif ---- */
  const levelInputs: HTMLInputElement[] = [];
  const levelChoices = h('div', { class: 'choices choices--cards' });
  const levelFieldset = h('fieldset', { class: 'field' }, h('legend', { text: 'Ton objectif' }), levelChoices);
  const renderLevels = (race: RaceKind, selected: Level) => {
    levelInputs.length = 0;
    levelChoices.replaceChildren(
      ...LEVELS.map((level) => {
        const input = h('input', { attrs: { type: 'radio', name: id('level'), value: level } });
        input.checked = level === selected;
        levelInputs.push(input);
        return h(
          'label',
          { class: 'choice choice--card' },
          input,
          h('span', {}, h('strong', { text: levelLabel(race, level) }), h('small', { text: levelHint(race, level) })),
        );
      }),
    );
  };

  /* ---- Temps sur 10 km ---- */
  const t10Error = errorEl(id('t10-error'));
  const minInput = h('input', {
    id: id('t10-min'),
    attrs: {
      type: 'number',
      name: 't10min',
      inputmode: 'numeric',
      min: 30,
      max: 90,
      step: 1,
      required: true,
      'aria-describedby': `${id('t10-hint')} ${id('t10-error')}`,
    },
  });
  const secInput = h('input', {
    id: id('t10-sec'),
    attrs: {
      type: 'number',
      name: 't10sec',
      inputmode: 'numeric',
      min: 0,
      max: 59,
      step: 1,
      'aria-describedby': `${id('t10-hint')} ${id('t10-error')}`,
    },
  });
  const t10Fieldset = h(
    'fieldset',
    { class: 'field' },
    h('legend', { text: 'Ton temps actuel sur 10 km' }),
    h(
      'div',
      { class: 'time-inputs' },
      h('label', { class: 'time-input' }, minInput, h('span', { text: 'min' }), h('span', { class: 'sr-only', text: 'minutes' })),
      h('label', { class: 'time-input' }, secInput, h('span', { text: 's' }), h('span', { class: 'sr-only', text: 'secondes' })),
    ),
    h('p', {
      id: id('t10-hint'),
      class: 'hint',
      text: 'Un chrono récent, même à l’entraînement. Pas d’idée ? Mets ton temps sur 10 km en courant à l’aise, sans forcer.',
    }),
    t10Error,
  );

  /* ---- Kilométrage ---- */
  const kmError = errorEl(id('km-error'));
  const kmInput = h('input', {
    id: id('km'),
    attrs: {
      type: 'number',
      name: 'weeklyKm',
      inputmode: 'numeric',
      min: WEEKLY_KM_MIN,
      max: WEEKLY_KM_MAX,
      step: 1,
      required: true,
      'aria-describedby': `${id('km-hint')} ${id('km-error')}`,
    },
  });
  const kmField = h(
    'div',
    { class: 'field' },
    h('label', { attrs: { for: id('km') }, text: 'Tes kilomètres par semaine en ce moment' }),
    h('div', { class: 'input-suffix' }, kmInput, h('span', { attrs: { 'aria-hidden': 'true' }, text: 'km' })),
    h('p', { id: id('km-hint'), class: 'hint', text: 'La moyenne de tes 4 dernières semaines. 0 si tu reprends.' }),
    kmError,
  );

  /* ---- Séances et sortie longue ---- */
  const sessions = radioGroup<'3' | '4' | '5'>(id('sessions'), 'Séances par semaine', [
    { value: '3', label: '3' },
    { value: '4', label: '4' },
    { value: '5', label: '5' },
  ]);
  sessions.fieldset.append(
    h('p', { class: 'hint', text: '4 séances, c’est le bon compromis pour la plupart des coureurs.' }),
  );
  const longRun = radioGroup<'sat' | 'sun'>(id('longrun'), 'Sortie longue le', [
    { value: 'sat', label: 'Samedi' },
    { value: 'sun', label: 'Dimanche' },
  ]);

  /* ---- Envoi ---- */
  const submit = h('button', {
    class: 'btn btn--primary btn--lg btn--block',
    attrs: { type: 'submit' },
    text: options.submitLabel,
  });
  const summary = h('div', {
    id: id('errors'),
    class: 'notice notice--danger',
    attrs: { role: 'alert', hidden: true, tabindex: -1 },
  });

  const form = h(
    'form',
    { class: 'plan-form', attrs: { novalidate: true, 'aria-describedby': id('errors') } },
    summary,
    preset.fieldset,
    other,
    levelFieldset,
    t10Fieldset,
    kmField,
    h('div', { class: 'plan-form__row' }, sessions.fieldset, longRun.fieldset),
    submit,
  );

  /* ---- Lecture / écriture ---- */
  const readNumber = (input: HTMLInputElement): number => (input.value.trim() === '' ? Number.NaN : Number(input.value));

  let currentLevel: Level = options.initial.level;

  const getValues = (): PlanFormValues => {
    const presetValue = (checkedValue(preset.inputs) as RaceChoice | undefined) ?? 'marathon';
    const distanceValue = (checkedValue(distance.inputs) as RaceKind | undefined) ?? 'marathon';
    const race: RaceKind = presetValue === 'autre' ? distanceValue : presetValue;
    const minutes = readNumber(minInput);
    const seconds = secInput.value.trim() === '' ? 0 : readNumber(secInput);
    const validParts = Number.isInteger(minutes) && Number.isInteger(seconds) && seconds >= 0 && seconds < 60;
    return {
      preset: presetValue,
      race,
      raceDate: dateInput.value,
      raceName: nameInput.value,
      level: (checkedValue(levelInputs) as Level | undefined) ?? currentLevel,
      t10: validParts ? minutes * 60 + seconds : Number.NaN,
      weeklyKm: readNumber(kmInput),
      sessions: Number(checkedValue(sessions.inputs) ?? '4') as 3 | 4 | 5,
      longRunDay: (checkedValue(longRun.inputs) as 'sat' | 'sun' | undefined) ?? 'sun',
    };
  };

  const syncRace = () => {
    const values = getValues();
    other.hidden = values.preset !== 'autre';
    renderLevels(values.race, values.level);
  };

  const setValues = (values: PlanFormValues) => {
    setChecked(preset.inputs, values.preset);
    setChecked(distance.inputs, values.race);
    dateInput.value = values.preset === 'autre' ? values.raceDate : '';
    nameInput.value = values.preset === 'autre' ? values.raceName : '';
    currentLevel = values.level;
    if (Number.isFinite(values.t10)) {
      minInput.value = String(Math.floor(values.t10 / 60));
      secInput.value = String(Math.round(values.t10 % 60)).padStart(2, '0');
    }
    if (Number.isFinite(values.weeklyKm)) kmInput.value = String(values.weeklyKm);
    setChecked(sessions.inputs, String(values.sessions));
    setChecked(longRun.inputs, values.longRunDay);
    other.hidden = values.preset !== 'autre';
    renderLevels(values.race, values.level);
  };

  /* ---- Erreurs ---- */
  const fieldErrors: Record<FieldName, { el: HTMLElement; inputs: HTMLElement[] }> = {
    preset: { el: presetError, inputs: preset.inputs },
    raceDate: { el: dateError, inputs: [dateInput] },
    raceName: { el: nameError, inputs: [nameInput] },
    t10: { el: t10Error, inputs: [minInput, secInput] },
    weeklyKm: { el: kmError, inputs: [kmInput] },
  };
  const touched = new Set<FieldName>();

  const paint = (errors: FieldErrors, only?: Set<FieldName>) => {
    for (const [name, target] of Object.entries(fieldErrors) as [FieldName, (typeof fieldErrors)[FieldName]][]) {
      if (only && !only.has(name)) continue;
      const message = errors[name];
      target.el.textContent = message ?? '';
      target.el.hidden = !message;
      for (const input of target.inputs) {
        if (input instanceof HTMLInputElement && input.type === 'radio') continue;
        input.setAttribute('aria-invalid', message ? 'true' : 'false');
      }
    }
  };

  const validateTouched = () => paint(validateValues(getValues(), today), touched);

  const touch = (name: FieldName) => {
    touched.add(name);
    validateTouched();
  };

  minInput.addEventListener('blur', () => touch('t10'));
  secInput.addEventListener('blur', () => touch('t10'));
  kmInput.addEventListener('blur', () => touch('weeklyKm'));
  dateInput.addEventListener('blur', () => touch('raceDate'));
  dateInput.addEventListener('change', () => touch('raceDate'));
  nameInput.addEventListener('blur', () => touch('raceName'));

  form.addEventListener('input', () => {
    summary.hidden = true;
    if (touched.size > 0) validateTouched();
    options.onChange?.(getValues());
  });
  form.addEventListener('change', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.name === id('level')) currentLevel = target.value as Level;
    if (target instanceof HTMLInputElement && (target.name === id('preset') || target.name === id('race'))) {
      syncRace();
      touch('preset');
    }
    options.onChange?.(getValues());
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = getValues();
    const errors = validateValues(values, today);
    for (const name of Object.keys(fieldErrors) as FieldName[]) touched.add(name);
    paint(errors);
    const messages = Object.values(errors).filter((m): m is string => Boolean(m));
    if (messages.length > 0) {
      summary.replaceChildren(
        h('strong', { text: messages.length === 1 ? 'Un point à corriger :' : `${messages.length} points à corriger :` }),
        h('ul', {}, messages.map((m) => h('li', { text: m }))),
      );
      summary.hidden = false;
      const firstName = (Object.keys(fieldErrors) as FieldName[]).find((name) => errors[name]);
      const first = firstName ? fieldErrors[firstName].inputs[0] : null;
      first?.focus();
      announce(messages.join(' '), 'assertive');
      return;
    }
    summary.hidden = true;
    options.onSubmit(values);
  });

  setValues(options.initial);

  return {
    form,
    getValues,
    setValues,
    setBusy(busy, label) {
      submit.disabled = busy;
      submit.setAttribute('aria-busy', busy ? 'true' : 'false');
      submit.replaceChildren(
        ...(busy ? [h('span', { class: 'spinner', attrs: { 'aria-hidden': 'true' } })] : []),
        label ?? options.submitLabel,
      );
    },
    showServerErrors(messages) {
      if (messages.length === 0) {
        summary.hidden = true;
        return;
      }
      summary.replaceChildren(
        h('strong', { text: 'Petit souci avec ces réglages :' }),
        h('ul', {}, messages.map((m) => h('li', { text: m }))),
      );
      summary.hidden = false;
      summary.focus();
    },
  };
}
