/**
 * Page de retour après paiement (/merci/?session_id=cs_…) : vérification par
 * /api/unlock, enregistrement du jeton, lien personnel à conserver (copie, envoi
 * par e-mail), « Ouvrir mon plan », « Installer l'app ». Si la référence ne prouve
 * pas la renonciation (ne commence pas par `w1-`), la case est réaffichée avant
 * d'ouvrir le plan.
 */
import { STRIPE_SESSION_ID_RE, type UnlockResponse } from '../shared/api-types';
import { storeToken, storedToken, supportMailto } from '../lib/access';
import { postWaiver, unlock, type ApiFailure } from '../lib/api';
import { bootPage } from '../lib/boot';
import { confirmWaiverOnServer, createWaiverField, hasRecordedWaiver, hasWaiverRef, recordWaiver } from '../lib/checkout';
import { announce, copyText, h, must, toast } from '../lib/dom';
import { icon } from '../lib/icons';
import { createInstallButton, mountIosInstallBanner } from '../lib/install-banner';
import { mailtoUrl, personalPlanUrl } from '../lib/links';

bootPage();

const root = must('#merci');
const params = new URLSearchParams(location.search);
const sessionId = (params.get('session_id') ?? '').trim();

function focusHeading(): void {
  const heading = root.querySelector<HTMLElement>('h1');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: false });
  }
}

function supportBlock(extra: string): HTMLElement {
  const lines = ['Bonjour,', '', 'Je n’arrive pas à ouvrir mon Pass J-24 après mon paiement.'];
  if (sessionId) lines.push(`Référence de paiement : ${sessionId}`);
  if (extra) lines.push(`Message affiché : ${extra}`);
  lines.push('', 'E-mail utilisé pour le paiement : ');
  const body = lines.join('\n');
  const href = supportMailto('Accès Pass J-24 après paiement', body);
  return h(
    'p',
    { class: 'hint' },
    'Ton achat n’est pas perdu. ',
    href
      ? h('a', { attrs: { href }, text: 'Écris au support' })
      : h('a', { attrs: { href: '/mentions-legales/' }, text: 'Écris au support (adresse dans les mentions légales)' }),
    ' en indiquant l’e-mail utilisé pour payer : tu reçois ton lien personnel à la main.',
  );
}

function renderLoading(attempt: number): void {
  root.replaceChildren(
    h(
      'div',
      { class: 'state' },
      h('span', { class: 'state__icon' }, h('span', { class: 'spinner', attrs: { 'aria-hidden': 'true' } })),
      h('h1', { text: 'Vérification de ton paiement…' }),
      h('p', {
        attrs: { role: 'status' },
        text:
          attempt > 1
            ? `Nouvelle tentative (${attempt}/3). Ça peut prendre quelques secondes.`
            : 'On vérifie auprès de Stripe. Garde cette page ouverte, ça ne prend que quelques secondes.',
      }),
    ),
  );
}

function renderError(failure: Pick<ApiFailure, 'code' | 'message'>, retry: boolean): void {
  const title =
    failure.code === 'not_paid'
      ? 'Paiement pas encore confirmé'
      : failure.code === 'invalid_session_id'
        ? 'Lien de retour incomplet'
        : failure.code === 'unknown_payment_link'
          ? 'Paiement non reconnu'
          : 'Vérification impossible pour le moment';
  root.replaceChildren(
    h(
      'div',
      { class: ['state', failure.code === 'not_paid' ? 'state--warn' : 'state--error'] },
      h('span', { class: 'state__icon' }, icon(failure.code === 'not_paid' ? 'clock' : 'alert')),
      h('h1', { text: title }),
      h('p', { attrs: { role: 'alert' }, text: failure.message }),
      h(
        'div',
        { class: 'cluster' },
        retry
          ? h(
              'button',
              { class: 'btn btn--primary', attrs: { type: 'button' }, on: { click: () => void run() } },
              icon('refresh'),
              'Réessayer',
            )
          : null,
        h('a', { class: 'btn btn--ghost', attrs: { href: '/' }, text: 'Retour à l’accueil' }),
      ),
      supportBlock(failure.message),
    ),
  );
  announce(`${title}. ${failure.message}`, 'assertive');
  focusHeading();
}

function renderMissing(): void {
  root.replaceChildren(
    h(
      'div',
      { class: 'state state--warn' },
      h('span', { class: 'state__icon' }, icon('info')),
      h('h1', { text: 'Aucun paiement à vérifier' }),
      h('p', {
        text: 'Cette page s’ouvre automatiquement après ton paiement. Si tu viens de payer et que tu es arrivé ici sans ton lien, pas d’inquiétude.',
      }),
      h(
        'div',
        { class: 'cluster' },
        h('a', { class: 'btn btn--primary', attrs: { href: '/' }, text: 'Découvrir le pass' }),
        h('a', { class: 'btn btn--ghost', attrs: { href: '/gratuit/' }, text: 'Semaine 1 gratuite' }),
      ),
      supportBlock(''),
    ),
  );
}

function linkSection(data: UnlockResponse): HTMLElement {
  const link = personalPlanUrl(data.token, location.origin);
  const planHref = `/plan/#t=${data.token}`;
  const input = h('input', {
    id: 'personal-link',
    attrs: { type: 'text', readonly: true, spellcheck: 'false', 'aria-describedby': 'personal-link-hint' },
  });
  input.value = link;
  input.addEventListener('focus', () => input.select());
  const copy = h('button', { class: 'btn btn--primary', attrs: { type: 'button' } }, icon('copy'), 'Copier');
  copy.addEventListener('click', async () => {
    const ok = await copyText(link);
    if (ok) {
      toast('Lien copié. Colle-le dans tes notes ou envoie-le-toi.');
      copy.replaceChildren(icon('check'), 'Copié');
      window.setTimeout(() => copy.replaceChildren(icon('copy'), 'Copier'), 2500);
    } else {
      input.focus();
      input.select();
      toast('Copie automatique impossible : le lien est sélectionné, copie-le à la main.', 'error');
    }
  });
  const mailBody = `Mon lien personnel Pass J-24 (à garder, valable jusqu’au 30 juin 2027) :\n${link}`;
  const mailHref = mailtoUrl(data.email.includes('@') ? data.email : '', 'Mon lien Pass J-24', mailBody);
  const install = createInstallButton('btn btn--lg');

  return h(
    'section',
    { class: 'card card--accent merci__link', attrs: { 'aria-labelledby': 'link-title' } },
    h('h2', { id: 'link-title', text: 'Ton lien personnel' }),
    h('p', {
      id: 'personal-link-hint',
      text: 'Il ouvre ton plan sur tous tes appareils, jusqu’au 30 juin 2027. Garde-le précieusement : ajoute-le à tes favoris ou envoie-le-toi par e-mail. Ne le partage pas, il est à ton nom.',
    }),
    h('label', { class: 'sr-only', attrs: { for: 'personal-link' }, text: 'Ton lien personnel' }),
    h('div', { class: 'copy-field' }, input, copy),
    h(
      'div',
      { class: 'merci__actions' },
      h('a', { class: 'btn btn--primary btn--lg', attrs: { href: planHref } }, 'Ouvrir mon plan', icon('arrowRight')),
      install.button,
      h('a', { class: 'btn btn--ghost', attrs: { href: mailHref } }, icon('mail'), 'M’envoyer le lien'),
    ),
    install.help,
  );
}

function waiverSection(onConfirm: () => void): HTMLElement {
  const waiver = createWaiverField('merci');
  const button = h('button', {
    class: 'btn btn--primary btn--lg btn--block',
    attrs: { type: 'button', 'aria-disabled': 'true' },
    text: 'Confirmer et afficher mon lien',
  });
  waiver.input.addEventListener('change', () => {
    button.setAttribute('aria-disabled', waiver.input.checked ? 'false' : 'true');
  });
  button.addEventListener('click', () => {
    if (!waiver.input.checked) {
      waiver.setError(true);
      waiver.input.focus();
      return;
    }
    recordWaiver();
    onConfirm();
  });
  const support = supportMailto(
    'Pass J-24 : je garde mon droit de rétractation',
    'Bonjour,\n\nJe préfère conserver mon droit de rétractation de 14 jours pour mon achat du Pass J-24.\n\nE-mail utilisé pour le paiement : ',
  );
  return h(
    'section',
    { class: 'card merci__waiver', attrs: { 'aria-labelledby': 'waiver-title' } },
    h('h2', { id: 'waiver-title', text: 'Une dernière étape' }),
    h('p', { text: 'Ton plan est un contenu numérique disponible tout de suite. Pour l’ouvrir maintenant, confirme ta demande d’accès immédiat :' }),
    waiver.root,
    button,
    h(
      'p',
      { class: 'hint' },
      'Tu préfères garder ton droit de rétractation de 14 jours ? Ne coche pas la case et ',
      support
        ? h('a', { attrs: { href: support }, text: 'écris au support' })
        : h('a', { attrs: { href: '/retractation/' }, text: 'consulte la page rétractation' }),
      ' : tu pourras te rétracter et être remboursé, ou recevoir ton accès à la fin du délai.',
    ),
  );
}

function renderSuccess(data: UnlockResponse): void {
  const container = h('div', { class: 'merci__ok' });
  const intro = h(
    'div',
    { class: 'state merci__hello' },
    h('span', { class: 'state__icon' }, icon('check')),
    h('p', { class: 'eyebrow', text: 'Paiement confirmé' }),
    h('h1', { text: 'Merci ! Ton plan est prêt.' }),
    data.email
      ? h(
          'p',
          {},
          'Achat enregistré pour ',
          h('strong', { text: data.email }),
          '. Traceo Premium sera activé à la main sous 24 h pour cette adresse.',
        )
      : h('p', { text: 'Traceo Premium sera activé à la main sous 24 h, pour l’adresse e-mail utilisée au paiement.' }),
  );

  const next = h(
    'section',
    { class: 'merci__next', attrs: { 'aria-labelledby': 'next-title' } },
    h('h2', { id: 'next-title', text: 'Et maintenant ?' }),
    h(
      'ol',
      { class: 'merci__steps' },
      h('li', {}, h('strong', { text: 'Ouvre ton plan' }), ' et vérifie tes réglages : course, date, objectif, séances.'),
      h('li', {}, h('strong', { text: 'Ajoute tes séances à ton agenda' }), ' avec l’export .ics, ou imprime ton plan.'),
      h('li', {}, h('strong', { text: 'Lundi, génère ta première boucle' }), ' depuis la séance du jour, et cours !'),
    ),
  );
  const health = h('p', {
    class: 'health-warning',
    text: 'Santé : ce programme est généré automatiquement et ne remplace pas l’avis d’un médecin. En cas de douleur, de malaise ou de doute, arrête-toi et consulte.',
  });

  const showLink = () => {
    container.replaceChildren(intro, linkSection(data), next, health);
    mountIosInstallBanner({ personalLink: () => personalPlanUrl(data.token, location.origin) });
  };

  if (!hasWaiverRef(data.ref) && !hasRecordedWaiver()) {
    container.replaceChildren(
      intro,
      waiverSection(() => {
        confirmWaiverOnServer(data.token, sessionId, postWaiver);
        showLink();
        const title = root.querySelector<HTMLElement>('#link-title');
        title?.setAttribute('tabindex', '-1');
        title?.focus();
        announce('Merci. Ton lien personnel est affiché.');
      }),
      health,
    );
  } else {
    showLink();
  }
  root.replaceChildren(container);
  announce('Paiement confirmé. Ton plan est prêt.');
  focusHeading();
}

const RETRYABLE = new Set(['network', 'timeout', 'stripe_unavailable', 'internal_error', 'bad_response']);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(): Promise<void> {
  const delays = [0, 2000, 5000];
  let last: ApiFailure | null = null;
  for (let attempt = 1; attempt <= delays.length; attempt++) {
    renderLoading(attempt);
    await wait(delays[attempt - 1] ?? 0);
    const result = await unlock(sessionId);
    if (result.ok) {
      storeToken(result.data.token, result.data.ref);
      // Accord donné avant le paiement (case de la fenêtre d'achat ou de la page Stripe) :
      // il est enregistré et confirmé par e-mail, sur support durable.
      if (hasWaiverRef(result.data.ref)) confirmWaiverOnServer(result.data.token, sessionId, postWaiver);
      renderSuccess(result.data);
      return;
    }
    last = result;
    if (!RETRYABLE.has(result.code)) break;
  }
  if (last) {
    const retry = last.code !== 'invalid_session_id' && last.code !== 'unknown_payment_link';
    renderError(last, retry);
  }
}

/**
 * Sans `session_id` mais avec un accès enregistré : écran neutre. Le contenu du jeton n'est
 * pas vérifié ici (seul /api/plan le fait), il n'est donc pas présenté comme un achat confirmé.
 */
function renderStoredAccess(): void {
  root.replaceChildren(
    h(
      'div',
      { class: 'state' },
      h('span', { class: 'state__icon' }, icon('lock')),
      h('h1', { text: 'Ton accès est enregistré sur cet appareil' }),
      h('p', {
        text: 'Ouvre ton plan : ton accès est vérifié à chaque ouverture. Ton lien personnel se trouve ensuite dans « Ton accès », en bas de la page du plan.',
      }),
      h(
        'div',
        { class: 'cluster' },
        h('a', { class: 'btn btn--primary btn--lg', attrs: { href: '/plan/' } }, 'Ouvrir mon plan', icon('arrowRight')),
      ),
      supportBlock(''),
    ),
  );
  focusHeading();
}

function start(): void {
  if (!sessionId) {
    if (storedToken()) renderStoredAccess();
    else renderMissing();
    return;
  }
  if (!STRIPE_SESSION_ID_RE.test(sessionId)) {
    renderError(
      {
        code: 'invalid_session_id',
        message: 'Le lien de retour du paiement est incomplet ou abîmé. Ouvre le lien reçu juste après ton paiement.',
      },
      false,
    );
    return;
  }
  void run();
}

start();
