/**
 * Achat du pass : fenêtre modale avec case de renonciation au droit de rétractation
 * (non pré-cochée), puis redirection vers le Payment Link Stripe du prix courant
 * (SPEC section 4), ou vers PayPal en secours, ou état « paiement bientôt disponible ».
 *
 * Partie pure (testée) : `resolveCheckout`, `buildStripeCheckoutUrl`, `buildPaypalUrl`,
 * `clientReferenceId`, `hasWaiverRef`, `isLikelyEmail`.
 * Partie DOM : `openCheckout(options)`, utilisable depuis n'importe quelle page, et
 * `initCheckoutTriggers()` qui branche tout élément `[data-checkout]`
 * (attributs facultatifs `data-race`, `data-level`, `data-race-date`, `data-race-name`).
 * Aucun accès au DOM au chargement du module.
 */
import { KEY_DATES, VAT_MENTION, config, type SiteConfig } from '../config';
import type { Level, RaceKind } from '../shared/api-types';
import { announce, h } from './dom';
import { formatDate } from './format';
import { icon } from './icons';
import { isLevel, isRaceKind } from './labels';
import { supportEmail } from './links';
import { WAIVER_TEXT } from '../shared/legal-texts';
import { priceInfo } from './price';
import { STORAGE_KEYS, isRecord, readJson, readString, writeJson, writeString } from './storage';

/* ================================================================== */
/* Partie pure                                                         */
/* ================================================================== */

/** Préfixe de `client_reference_id` : la renonciation (version 1) a été cochée sur le site. */
export const WAIVER_REF_PREFIX = 'w1-';

/** Texte exact de la case de renonciation (SPEC section 4). */
export { WAIVER_TEXT };

/** Mention imposée pour le paiement PayPal de secours. */
export const PAYPAL_DELAY_TEXT = 'accès envoyé par e-mail sous 2 h (8 h-22 h)';

export type CheckoutMode = 'stripe' | 'paypal' | 'unavailable';

export interface CheckoutParams {
  race: RaceKind;
  level: Level;
  /** Préremplit l'e-mail sur la page Stripe (ignoré s'il est invalide). */
  email?: string;
}

export interface CheckoutTarget {
  mode: CheckoutMode;
  /** URL de paiement prête à ouvrir, `null` si aucun moyen de paiement n'est configuré. */
  url: string | null;
  amount: number;
  label: string;
  isLaunch: boolean;
  sentence: string;
}

/** `w1-<race>-<level>`, ex. `w1-marathon-l2`. */
export function clientReferenceId(race: RaceKind, level: Level): string {
  return `${WAIVER_REF_PREFIX}${race}-${level}`;
}

/** Vrai si la référence prouve que la case de renonciation a été cochée sur le site. */
export function hasWaiverRef(ref: string | null | undefined): boolean {
  return typeof ref === 'string' && ref.startsWith(WAIVER_REF_PREFIX);
}

/** Lit course et niveau d'une référence `w1-<race>-<level>`. */
export function parseClientReference(ref: string | null | undefined): { race: RaceKind; level: Level } | null {
  const match = /^w1-([a-z]+)-([a-z0-9]+)$/.exec(ref ?? '');
  if (!match) return null;
  const [, race, level] = match;
  return isRaceKind(race) && isLevel(level) ? { race, level } : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Contrôle de forme simple d'une adresse e-mail. */
export function isLikelyEmail(value: string): boolean {
  const v = value.trim();
  return v.length <= 254 && EMAIL_RE.test(v);
}

function httpsUrl(raw: string): URL | null {
  if (!raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * Payment Link Stripe + `client_reference_id=w1-<race>-<level>` (+ `prefilled_email`).
 * Les paramètres déjà présents dans l'URL sont conservés.
 * @returns `null` si l'URL de base est vide ou n'est pas en https.
 */
export function buildStripeCheckoutUrl(base: string, params: CheckoutParams): string | null {
  const url = httpsUrl(base);
  if (!url) return null;
  url.searchParams.set('client_reference_id', clientReferenceId(params.race, params.level));
  const email = params.email?.trim();
  if (email && isLikelyEmail(email)) url.searchParams.set('prefilled_email', email);
  else url.searchParams.delete('prefilled_email');
  return url.toString();
}

/**
 * Lien PayPal de secours. Pour un lien `paypal.me/<nom>` sans montant, ajoute
 * le montant courant (`/29EUR`) ; tout autre lien est utilisé tel quel.
 */
export function buildPaypalUrl(base: string, amount: number): string | null {
  const url = httpsUrl(base);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean);
  if (host === 'paypal.me' && segments.length === 1) {
    url.pathname = `/${segments[0]}/${amount}EUR`;
  }
  return url.toString();
}

/**
 * Moyen de paiement applicable :
 * - `stripe` si `stripeEnabled` et le Payment Link du prix courant est une URL https ;
 * - `paypal` si `stripeEnabled === false` et `paypalFallbackUrl` est renseigné ;
 * - `unavailable` sinon (jamais de bouton cassé).
 */
export function resolveCheckout(
  params: CheckoutParams,
  now: Date = new Date(),
  cfg: SiteConfig = config,
): CheckoutTarget {
  const price = priceInfo(now, cfg);
  const base = { amount: price.amount, label: price.label, isLaunch: price.isLaunch, sentence: price.sentence };
  if (cfg.stripeEnabled) {
    const url = buildStripeCheckoutUrl(price.paymentLink, params);
    return { ...base, mode: url ? 'stripe' : 'unavailable', url };
  }
  if (cfg.paypalFallbackUrl.trim()) {
    const url = buildPaypalUrl(cfg.paypalFallbackUrl, price.amount);
    return { ...base, mode: url ? 'paypal' : 'unavailable', url };
  }
  return { ...base, mode: 'unavailable', url: null };
}

/* ================================================================== */
/* Mémoire locale                                                      */
/* ================================================================== */

export interface CheckoutPrefs {
  race: RaceKind;
  level: Level;
  raceDate?: string;
  raceName?: string;
}

function isCheckoutPrefs(v: unknown): v is CheckoutPrefs {
  return (
    isRecord(v) &&
    isRaceKind(v.race) &&
    isLevel(v.level) &&
    (v.raceDate === undefined || typeof v.raceDate === 'string') &&
    (v.raceName === undefined || typeof v.raceName === 'string')
  );
}

/** Course et niveau choisis au moment de l'achat (préremplissage du plan). */
export function readCheckoutPrefs(): CheckoutPrefs | null {
  return readJson(STORAGE_KEYS.checkoutPrefs, isCheckoutPrefs);
}

/** Enregistre localement l'acceptation de la renonciation (horodatage). */
export function recordWaiver(now: Date = new Date()): void {
  writeString(STORAGE_KEYS.waiver, now.toISOString());
}

export function hasRecordedWaiver(): boolean {
  return readString(STORAGE_KEYS.waiver) !== null;
}

/**
 * Transmet au serveur l'accord d'accès immédiat lié à ce jeton (une fois par commande et par
 * appareil) : il l'enregistre et le confirme par e-mail, sur support durable. Sans réseau ou
 * sans service configuré, rien n'est bloqué : le droit de rétractation reste alors acquis.
 */
export function confirmWaiverOnServer(token: string, sid: string, send: (token: string) => Promise<{ ok: boolean }>): void {
  const sent = readString(STORAGE_KEYS.waiverSent) ?? '';
  const list = sent.split(',').filter(Boolean);
  if (!sid || list.includes(sid)) return;
  void send(token).then((result) => {
    if (result.ok) writeString(STORAGE_KEYS.waiverSent, [...list.slice(-9), sid].join(','));
  });
}

/* ================================================================== */
/* Case de renonciation (réutilisée sur /merci/ et /plan/)             */
/* ================================================================== */

export interface WaiverField {
  root: HTMLElement;
  input: HTMLInputElement;
  /** Affiche ou masque l'erreur « case à cocher ». */
  setError(show: boolean): void;
}

export function createWaiverField(idPrefix: string): WaiverField {
  const inputId = `${idPrefix}-waiver`;
  const errorId = `${idPrefix}-waiver-error`;
  const input = h('input', {
    id: inputId,
    attrs: { type: 'checkbox', name: 'waiver', 'aria-describedby': errorId },
  });
  const error = h('p', {
    id: errorId,
    class: 'error',
    attrs: { hidden: true },
    text: 'Coche cette case pour accéder à ton plan tout de suite.',
  });
  const root = h(
    'div',
    { class: 'waiver' },
    h('label', { class: 'check waiver__label', attrs: { for: inputId } }, input, h('span', { text: WAIVER_TEXT })),
    error,
    h(
      'p',
      { class: 'hint' },
      'Détails dans les ',
      h('a', { attrs: { href: '/cgv/', target: '_blank', rel: 'noopener' }, text: 'conditions générales de vente' }),
      ' (nouvel onglet).',
    ),
  );
  const setError = (show: boolean) => {
    error.hidden = !show;
    input.setAttribute('aria-invalid', show ? 'true' : 'false');
  };
  input.addEventListener('change', () => {
    if (input.checked) setError(false);
  });
  return { root, input, setError };
}

/* ================================================================== */
/* Fenêtre modale d'achat                                              */
/* ================================================================== */

export interface CheckoutOptions {
  race?: RaceKind;
  level?: Level;
  email?: string;
  /** Course à date libre choisie (mémorisée pour préremplir le plan). */
  raceDate?: string;
  raceName?: string;
  /** Élément qui reprend le focus à la fermeture (défaut : élément actif à l'ouverture). */
  returnFocus?: HTMLElement | null;
}

let dialog: HTMLDialogElement | null = null;
let returnFocusTo: HTMLElement | null = null;

function getDialog(): HTMLDialogElement {
  if (dialog && dialog.isConnected) return dialog;
  dialog = h('dialog', {
    class: 'modal',
    id: 'checkout-dialog',
    attrs: { 'aria-labelledby': 'checkout-title' },
  });
  dialog.addEventListener('click', (event) => {
    // Clic sur le fond (en dehors du contenu) : fermeture.
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('has-modal');
    returnFocusTo?.focus();
    returnFocusTo = null;
  });
  document.body.appendChild(dialog);
  return dialog;
}

function closeDialog(): void {
  if (!dialog) return;
  if (typeof dialog.close === 'function' && dialog.open) dialog.close();
  else {
    dialog.removeAttribute('open');
    dialog.dispatchEvent(new Event('close'));
  }
}

function showDialog(el: HTMLDialogElement): void {
  document.documentElement.classList.add('has-modal');
  if (typeof el.showModal === 'function') {
    if (!el.open) el.showModal();
  } else {
    el.setAttribute('open', '');
  }
}

function inclusions(): HTMLElement {
  const items = [
    'Ton plan complet daté, semaine par semaine, jusqu’au jour J',
    'Une boucle de la bonne distance pour chaque séance',
    'Export agenda (.ics), version imprimable et image story',
    `Traceo Premium jusqu’au ${formatDate(KEY_DATES.premiumUntil)}`,
  ];
  return h(
    'ul',
    { class: 'ticks' },
    items.map((text) => h('li', {}, icon('check'), h('span', { text }))),
  );
}

function closeButton(): HTMLButtonElement {
  return h(
    'button',
    {
      class: 'modal__close',
      attrs: { type: 'button', 'aria-label': 'Fermer' },
      on: { click: () => closeDialog() },
    },
    icon('close'),
  );
}

function unavailableContent(): (HTMLElement | null)[] {
  const email = supportEmail();
  const onFreePage = location.pathname.startsWith('/gratuit');
  return [
    h('p', { class: 'eyebrow', text: 'Pass J-24 · Traceo' }),
    h('h2', { id: 'checkout-title', text: 'Paiement bientôt disponible' }),
    h(
      'p',
      { class: 'notice', attrs: { role: 'status' } },
      'Le paiement en ligne ouvre très bientôt. En attendant, ta semaine 1 est offerte : de quoi commencer lundi sans rien payer.',
    ),
    onFreePage
      ? h('button', {
          class: 'btn btn--primary btn--lg btn--block',
          attrs: { type: 'button' },
          text: 'Compris',
          on: { click: () => closeDialog() },
        })
      : h('a', { class: 'btn btn--primary btn--lg btn--block', attrs: { href: '/gratuit/' }, text: 'Voir ma semaine 1 gratuite' }),
    email
      ? h(
          'p',
          { class: 'hint center' },
          'Une question ? Écris-moi à ',
          h('a', { attrs: { href: `mailto:${email}` }, text: email }),
          '.',
        )
      : null,
  ];
}

function payContent(target: CheckoutTarget, opts: Required<Pick<CheckoutOptions, 'race' | 'level'>> & CheckoutOptions): HTMLElement[] {
  const isPaypal = target.mode === 'paypal';
  const waiver = createWaiverField('checkout');
  const emailId = 'checkout-email';
  const emailError = h('p', {
    id: `${emailId}-error`,
    class: 'error',
    attrs: { hidden: true },
    text: 'Cette adresse e-mail semble incomplète.',
  });
  const emailInput = h('input', {
    id: emailId,
    attrs: {
      type: 'email',
      name: 'email',
      autocomplete: 'email',
      inputmode: 'email',
      placeholder: 'prenom@exemple.fr',
      'aria-describedby': `${emailId}-hint ${emailId}-error`,
    },
  });
  emailInput.value = opts.email ?? '';
  const hintId = 'checkout-pay-hint';
  const payButton = h(
    'button',
    {
      class: 'btn btn--primary btn--lg btn--block',
      attrs: { type: 'submit', 'aria-disabled': 'true', 'aria-describedby': hintId },
    },
    h('span', { text: `Payer ${target.label}${isPaypal ? ' avec PayPal' : ''}` }),
    icon('arrowRight'),
  );
  const payHint = h('p', { id: hintId, class: 'hint center', text: 'Coche la case ci-dessus pour continuer.' });

  const syncButton = () => {
    payButton.setAttribute('aria-disabled', waiver.input.checked ? 'false' : 'true');
    payHint.hidden = waiver.input.checked;
  };
  waiver.input.addEventListener('change', syncButton);

  const validateEmail = (): boolean => {
    const value = emailInput.value.trim();
    const ok = value === '' || isLikelyEmail(value);
    emailError.hidden = ok;
    emailInput.setAttribute('aria-invalid', ok ? 'false' : 'true');
    return ok;
  };
  emailInput.addEventListener('blur', validateEmail);

  const form = h('form', { class: 'checkout__form', attrs: { novalidate: true } });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!waiver.input.checked) {
      waiver.setError(true);
      waiver.input.focus();
      announce('Coche la case de renonciation pour continuer.', 'assertive');
      return;
    }
    if (!isPaypal && !validateEmail()) {
      emailInput.focus();
      return;
    }
    const finalTarget = resolveCheckout({ race: opts.race, level: opts.level, email: emailInput.value });
    if (!finalTarget.url) {
      renderDialog(opts);
      return;
    }
    recordWaiver();
    const prefs: CheckoutPrefs = { race: opts.race, level: opts.level };
    if (opts.raceDate) prefs.raceDate = opts.raceDate;
    if (opts.raceName) prefs.raceName = opts.raceName;
    writeJson(STORAGE_KEYS.checkoutPrefs, prefs);
    payButton.setAttribute('aria-busy', 'true');
    payButton.replaceChildren(h('span', { class: 'spinner', attrs: { 'aria-hidden': 'true' } }), 'Ouverture du paiement…');
    announce('Ouverture de la page de paiement.');
    window.location.assign(finalTarget.url);
  });

  form.append(
    isPaypal
      ? h(
          'p',
          { class: 'notice' },
          h('strong', { text: 'Paiement par PayPal : ' }),
          `${PAYPAL_DELAY_TEXT}, à l’adresse de ton compte PayPal. Ton lien personnel arrive dans ce message.`,
        )
      : h(
          'div',
          { class: 'field' },
          h('label', { attrs: { for: emailId } }, 'Ton e-mail ', h('span', { class: 'muted', text: '(facultatif)' })),
          emailInput,
          h('p', {
            id: `${emailId}-hint`,
            class: 'hint',
            text: 'Il préremplit la page de paiement. C’est l’adresse qui recevra le reçu et l’activation de Traceo Premium.',
          }),
          emailError,
        ),
    waiver.root,
    payButton,
    payHint,
    h(
      'p',
      { class: 'checkout__secure' },
      icon('lock'),
      h('span', {
        text: isPaypal
          ? 'Tu es redirigé vers PayPal pour payer en toute sécurité.'
          : 'Paiement sécurisé par Stripe. Juste après, tu reviens ici pour ouvrir ton plan.',
      }),
    ),
  );
  syncButton();

  return [
    h('p', { class: 'eyebrow', text: 'Pass J-24 · Traceo' }),
    h('h2', { id: 'checkout-title', text: 'Ton plan complet, jusqu’au jour J' }),
    h(
      'div',
      { class: 'checkout__price' },
      h('span', { class: 'checkout__amount num', text: target.label }),
      h('span', { class: 'checkout__once', text: 'paiement unique' }),
    ),
    h('p', { class: 'checkout__sentence', text: target.isLaunch ? target.sentence : 'Sans abonnement, accès jusqu’au 30 juin 2027.' }),
    h('p', { class: 'hint', text: `Prix TTC · ${VAT_MENTION}` }),
    inclusions(),
    form,
  ];
}

function renderDialog(opts: Required<Pick<CheckoutOptions, 'race' | 'level'>> & CheckoutOptions): void {
  const el = getDialog();
  const target = resolveCheckout({ race: opts.race, level: opts.level, email: opts.email ?? '' });
  const content: (HTMLElement | null)[] = target.mode === 'unavailable' ? unavailableContent() : payContent(target, opts);
  el.replaceChildren(closeButton(), h('div', { class: 'modal__body' }, content));
}

/**
 * Ouvre la fenêtre d'achat. Course et niveau servent à `client_reference_id`
 * (défaut : derniers choix connus, sinon marathon / Finisher).
 */
export function openCheckout(options: CheckoutOptions = {}): void {
  const prefs = readCheckoutPrefs();
  const race = options.race ?? prefs?.race ?? 'marathon';
  const level = options.level ?? prefs?.level ?? 'finisher';
  returnFocusTo =
    options.returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  renderDialog({ ...options, race, level });
  const el = getDialog();
  showDialog(el);
  // Focus sur le premier champ utile (l'e-mail, sinon la case, sinon le bouton).
  const first = el.querySelector<HTMLElement>('#checkout-email, #checkout-waiver, .modal__body .btn');
  first?.focus();
}

let triggersBound = false;

/**
 * Branche (une seule fois, par délégation) tout élément `[data-checkout]`.
 * Sans JavaScript, ces éléments restent des liens normaux (vers /gratuit/ en général).
 */
export function initCheckoutTriggers(defaults: () => CheckoutOptions = () => ({})): void {
  if (triggersBound) return;
  triggersBound = true;
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-checkout]') : null;
    if (!target) return;
    event.preventDefault();
    const base = defaults();
    const race = target.dataset.race;
    const level = target.dataset.level;
    const opts: CheckoutOptions = { ...base, returnFocus: target };
    if (isRaceKind(race)) opts.race = race;
    if (isLevel(level)) opts.level = level;
    if (target.dataset.raceDate) opts.raceDate = target.dataset.raceDate;
    if (target.dataset.raceName) opts.raceName = target.dataset.raceName;
    openCheckout(opts);
  });
  // Retour arrière depuis la page de paiement (cache de navigation) : fenêtre fermée et propre.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) closeDialog();
  });
}
