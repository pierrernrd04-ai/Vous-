/**
 * Droit de rétractation (/retractation/) : principe des 14 jours (art. L221-18),
 * exception du contenu numérique fourni immédiatement (art. L221-28 13°), cas où
 * le droit est conservé, marche à suivre, remboursement (art. L221-24), modèle
 * officiel de formulaire (annexe à l'art. R221-1) et formulaire en ligne qui
 * prépare l'e-mail de rétractation (avec copie et impression en secours).
 */
import { legal, isToComplete, TO_COMPLETE } from '../legal';
import { storedToken, tokenInfo } from '../lib/access';
import { bootPage } from '../lib/boot';
import { WAIVER_TEXT, isLikelyEmail } from '../lib/checkout';
import { announce, append, copyText, h, must, toast, type Child } from '../lib/dom';
import { daysBetween, formatDate, localTodayIso, parseIsoDate } from '../lib/format';
import { icon } from '../lib/icons';
import { defRow, editorName, legalEmail, legalValue, renderLegalPage } from '../lib/legal-ui';
import { mailtoUrl, supportEmail } from '../lib/links';

bootPage();

const p = (...children: Child[]) => h('p', {}, ...children);
const ul = (...items: Child[][]) => h('ul', {}, items.map((item) => h('li', {}, ...item)));

const WITHDRAWAL_DAYS = 14;
const PRODUCT = 'Pass J-24 · Traceo (programme de préparation au marathon ou au semi-marathon, contenu numérique)';

/* ================================================================== */
/* Texte de la lettre (pur)                                            */
/* ================================================================== */

/** Morceau de texte : chaîne, ou valeur légale encore « À COMPLÉTER ». */
type Segment = string | { todo: true };

interface WithdrawalFields {
  name: string;
  address: string;
  email: string;
  /** Date de commande, ISO. */
  orderDate: string;
  reference: string;
}

function legalSegment(value: string): Segment {
  return isToComplete(value) ? { todo: true } : value;
}

function orBlank(value: string, blank = '……………………'): string {
  return value.trim() || blank;
}

/** Lettre de rétractation (modèle de l'annexe à l'article R221-1), complétée. */
function letterSegments(fields: WithdrawalFields, today: string): Segment[] {
  const order = parseIsoDate(fields.orderDate) ? formatDate(fields.orderDate) : '……………………';
  return [
    'À l’attention de ',
    legalSegment(legal.editor.name),
    ` ${legal.editor.status}, `,
    legalSegment(legal.editor.address),
    ', ',
    legalSegment(legal.editor.email),
    ' :\n\n',
    'Je vous notifie par la présente ma rétractation du contrat portant sur la fourniture du contenu numérique ci-dessous :\n',
    `${PRODUCT}\n\n`,
    `Commandé le : ${order}\n`,
    `Référence du paiement : ${orBlank(fields.reference, 'non indiquée')}\n`,
    `Nom du consommateur : ${orBlank(fields.name)}\n`,
    `Adresse du consommateur : ${orBlank(fields.address, 'non indiquée')}\n`,
    `E-mail utilisé pour l’achat : ${orBlank(fields.email)}\n`,
    `Date : ${formatDate(today)}`,
  ];
}

function segmentsToText(segments: Segment[]): string {
  return segments.map((s) => (typeof s === 'string' ? s : TO_COMPLETE)).join('');
}

function segmentsToNodes(segments: Segment[]): Node[] {
  return segments.map((s) => (typeof s === 'string' ? document.createTextNode(s) : legalValue(TO_COMPLETE)));
}

/* ================================================================== */
/* Formulaire                                                          */
/* ================================================================== */

type FieldKey = 'name' | 'email' | 'orderDate';
type Errors = Partial<Record<FieldKey, string>>;

function validate(fields: WithdrawalFields, today: string): Errors {
  const errors: Errors = {};
  if (fields.name.trim().length < 2) errors.name = 'Indique tes nom et prénom.';
  if (!fields.email.trim()) errors.email = 'Indique l’adresse e-mail utilisée pour l’achat.';
  else if (!isLikelyEmail(fields.email)) errors.email = 'Cette adresse e-mail semble incomplète.';
  if (!fields.orderDate) errors.orderDate = 'Indique la date de ta commande.';
  else if (!parseIsoDate(fields.orderDate)) errors.orderDate = 'Cette date n’est pas valide.';
  else if (fields.orderDate > today) errors.orderDate = 'La date de commande ne peut pas être dans le futur.';
  return errors;
}

/** Préremplissage depuis le lien d'accès enregistré sur cet appareil (s'il existe). */
function prefill(): Partial<WithdrawalFields> {
  const token = storedToken();
  const info = token ? tokenInfo(token) : null;
  if (!info) return {};
  const out: Partial<WithdrawalFields> = {};
  if (info.sub.includes('@')) out.email = info.sub;
  // Ventes PayPal : `paypal:<référence>` ; les jetons émis à la main n'ont pas de référence utile.
  if (info.sid && !info.sid.includes('manuel')) out.reference = info.sid.replace(/^paypal:/, 'PayPal ');
  if (Number.isFinite(info.iat) && info.iat > 0) out.orderDate = localTodayIso(new Date(info.iat * 1000));
  return out;
}

function textField(
  id: string,
  label: string,
  attrs: Record<string, string | number | boolean>,
  hint?: string,
  optional = false,
): { field: HTMLElement; input: HTMLInputElement; error: HTMLElement } {
  const error = h('p', { id: `${id}-error`, class: 'error', attrs: { hidden: true } });
  const hintEl = hint ? h('p', { id: `${id}-hint`, class: 'hint', text: hint }) : null;
  const input = h('input', {
    id,
    attrs: { ...attrs, 'aria-describedby': [hintEl ? `${id}-hint` : '', `${id}-error`].filter(Boolean).join(' ') },
  });
  const field = h(
    'div',
    { class: 'field' },
    h('label', { attrs: { for: id } }, label, optional ? h('span', { class: 'muted', text: ' (facultatif)' }) : null),
    input,
    hintEl,
    error,
  );
  return { field, input, error };
}

function withdrawalForm(): HTMLElement {
  const today = localTodayIso();
  const initial = prefill();
  const email = supportEmail();

  const name = textField('wd-name', 'Nom et prénom', { type: 'text', autocomplete: 'name', required: true });
  const address = textField(
    'wd-address',
    'Adresse postale',
    { type: 'text', autocomplete: 'street-address' },
    'Demandée par le modèle officiel ; utile si tu envoies le formulaire par courrier.',
    true,
  );
  const mail = textField('wd-email', 'E-mail utilisé pour l’achat', {
    type: 'email',
    autocomplete: 'email',
    inputmode: 'email',
    required: true,
  });
  const order = textField('wd-date', 'Date de la commande', { type: 'date', max: today, required: true });
  const reference = textField(
    'wd-ref',
    'Référence du paiement',
    { type: 'text', autocomplete: 'off', spellcheck: false },
    'Sur le reçu Stripe ou PayPal. Elle accélère le remboursement.',
    true,
  );
  mail.input.value = initial.email ?? '';
  order.input.value = initial.orderDate ?? '';
  reference.input.value = initial.reference ?? '';

  const fields = (): WithdrawalFields => ({
    name: name.input.value,
    address: address.input.value,
    email: mail.input.value,
    orderDate: order.input.value,
    reference: reference.input.value,
  });

  const preview = h('p', { id: 'wd-text', class: 'withdraw__text' });
  const deadline = h('p', { class: 'notice notice--warn', attrs: { hidden: true, role: 'status' } });
  const status = h('p', { class: 'notice withdraw__status', attrs: { role: 'status', 'aria-live': 'polite' } });
  const summary = h('div', { class: 'notice notice--danger', attrs: { role: 'alert', hidden: true, tabindex: -1 } });

  const targets: Record<FieldKey, { input: HTMLInputElement; error: HTMLElement }> = {
    name,
    email: mail,
    orderDate: order,
  };
  const touched = new Set<FieldKey>();

  const paint = (errors: Errors) => {
    for (const key of Object.keys(targets) as FieldKey[]) {
      const message = touched.has(key) ? errors[key] : undefined;
      targets[key].error.textContent = message ?? '';
      targets[key].error.hidden = !message;
      targets[key].input.setAttribute('aria-invalid', message ? 'true' : 'false');
    }
  };

  const refresh = () => {
    const values = fields();
    preview.replaceChildren(...segmentsToNodes(letterSegments(values, today)));
    const age = parseIsoDate(values.orderDate) && values.orderDate <= today ? daysBetween(values.orderDate, today) : Number.NaN;
    if (Number.isFinite(age) && age > WITHDRAWAL_DAYS) {
      deadline.textContent = `Ta commande date de ${age} jours : le délai de rétractation de ${WITHDRAWAL_DAYS} jours semble dépassé. Tu peux quand même envoyer ta demande. Et si ton plan présente un défaut, la garantie légale de conformité s’applique (voir les CGV).`;
      deadline.hidden = false;
    } else {
      deadline.hidden = true;
    }
    paint(validate(values, today));
  };

  const touch = (key: FieldKey) => {
    touched.add(key);
    refresh();
  };
  name.input.addEventListener('blur', () => touch('name'));
  mail.input.addEventListener('blur', () => touch('email'));
  order.input.addEventListener('blur', () => touch('orderDate'));
  order.input.addEventListener('change', () => touch('orderDate'));

  const form = h('form', { class: 'withdraw__form', attrs: { novalidate: true, 'aria-describedby': 'wd-intro' } });
  form.addEventListener('input', () => {
    summary.hidden = true;
    refresh();
  });

  const letterText = () => segmentsToText(letterSegments(fields(), today));

  const copyButton = h('button', { class: 'btn', attrs: { type: 'button' } }, icon('copy'), 'Copier le texte');
  copyButton.addEventListener('click', async () => {
    const ok = await copyText(letterText());
    toast(ok ? 'Texte copié : colle-le dans un e-mail ou un courrier.' : 'Copie impossible : sélectionne le texte à la main.', ok ? 'ok' : 'error');
  });
  const printButton = h(
    'button',
    { class: 'btn btn--ghost', attrs: { type: 'button' }, on: { click: () => window.print() } },
    icon('printer'),
    'Imprimer',
  );
  const sendButton = email
    ? h('button', { class: 'btn btn--primary', attrs: { type: 'submit' } }, icon('mail'), 'Préparer l’e-mail de rétractation')
    : null;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    for (const key of Object.keys(targets) as FieldKey[]) touched.add(key);
    const errors = validate(fields(), today);
    refresh();
    const messages = Object.values(errors).filter((m): m is string => Boolean(m));
    if (messages.length > 0) {
      summary.replaceChildren(
        h('strong', { text: messages.length === 1 ? 'Un point à corriger :' : `${messages.length} points à corriger :` }),
        h('ul', {}, messages.map((m) => h('li', { text: m }))),
      );
      summary.hidden = false;
      const first = (Object.keys(targets) as FieldKey[]).find((key) => errors[key]);
      if (first) targets[first].input.focus();
      announce(messages.join(' '), 'assertive');
      return;
    }
    if (!email) return;
    const href = mailtoUrl(email, 'Rétractation · Pass J-24', letterText());
    status.textContent =
      'Ta messagerie s’ouvre avec le message prêt : vérifie-le, puis envoie-le. Rien ne s’ouvre ? Copie le texte et envoie-le à ' +
      `${email}. Garde une copie de ton envoi.`;
    announce(status.textContent);
    window.location.href = href;
  });

  const sendHelp = email
    ? null
    : h(
        'p',
        { class: 'notice notice--warn' },
        'L’adresse e-mail du vendeur n’est pas encore renseignée (',
        legalValue(TO_COMPLETE),
        ') : copie ou imprime le texte, puis envoie-le par courrier à l’adresse indiquée plus haut.',
      );

  append(
    form,
    h(
      'div',
      { class: 'withdraw__fields' },
      summary,
      h('div', { class: 'withdraw__row' }, name.field, mail.field),
      h('div', { class: 'withdraw__row' }, order.field, reference.field),
      address.field,
      deadline,
    ),
    h('div', { class: 'withdraw__preview' }, h('h3', { text: 'Ton texte de rétractation' }), preview),
    h('div', { class: 'legal-actions' }, sendButton, copyButton, printButton),
    sendHelp,
    status,
  );

  refresh();

  return h(
    'div',
    { class: 'withdraw card' },
    h(
      'p',
      { id: 'wd-intro', class: 'muted' },
      email
        ? 'Remplis ces champs : le texte de rétractation se complète tout seul. Le bouton prépare l’e-mail dans ta messagerie, il ne reste qu’à l’envoyer.'
        : 'Remplis ces champs : le texte de rétractation se complète tout seul, prêt à copier ou à imprimer.',
    ),
    form,
  );
}

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */

renderLegalPage(must('#contenu'), {
  eyebrow: 'Tes droits',
  title: 'Droit de rétractation',
  intro: [
    p(
      'Acheter en ligne te donne en principe 14 jours pour changer d’avis. Le Pass J-24 étant un contenu numérique disponible tout de suite, ce droit suit une règle particulière : voici laquelle, et comment te rétracter quand c’est possible.',
    ),
  ],
  sections: [
    {
      id: 'principe',
      title: '1. Le principe : 14 jours',
      body: [
        p(
          'Pour un contrat conclu à distance, le consommateur dispose de 14 jours pour se rétracter, sans avoir à se justifier ni à payer de pénalité (article L221-18 du code de la consommation). Pour un contenu numérique, ce délai court à partir du jour de l’achat.',
        ),
      ],
    },
    {
      id: 'exception',
      title: '2. L’exception du contenu numérique',
      body: [
        p(
          'Selon l’article L221-28 13° du code de la consommation, le droit de rétractation ne peut pas être exercé pour un contenu numérique non fourni sur un support matériel dont l’exécution a commencé après ton accord préalable exprès et ta renonciation expresse à ce droit.',
        ),
        p('C’est le cas du Pass J-24 : au moment de payer, tu coches la case suivante (elle n’est jamais cochée d’avance) :'),
        h('blockquote', { class: 'legal-box' }, p(h('em', { text: `« ${WAIVER_TEXT} »` }))),
        p(
          'Ton plan est alors accessible tout de suite et tu ne peux plus te rétracter. La confirmation de commande envoyée par e-mail reprend cet accord.',
        ),
      ],
    },
    {
      id: 'conserve',
      title: '3. Quand tu gardes ton droit de rétractation',
      body: [
        p('Tu conserves ton droit de rétractation pendant 14 jours si tu n’as pas donné cet accord, par exemple :'),
        ul(
          ['tu as payé sans passer par la fenêtre d’achat du site, donc sans cocher la case ;'],
          ['après le paiement, tu as refusé de cocher la case affichée avant l’ouverture de ton plan.'],
        ),
        p(
          'Dans ce cas, ton plan ne s’ouvre pas tant que tu ne demandes pas l’accès immédiat : tu peux te rétracter, ou attendre la fin du délai pour recevoir ton accès.',
        ),
      ],
    },
    {
      id: 'comment',
      title: '4. Comment te rétracter',
      body: [
        p(
          'Avant la fin du délai de 14 jours, informe le vendeur de ta décision par une déclaration sans ambiguïté (article L221-21) : le formulaire ci-dessous, ou un simple message qui dit clairement que tu te rétractes.',
        ),
        h(
          'dl',
          { class: 'legal-dl' },
          defRow('Vendeur', ...editorName()),
          defRow('E-mail', legalEmail(legal.editor.email)),
          defRow('Courrier', legalValue(legal.editor.address)),
        ),
        p(
          'Le délai est respecté si tu envoies ta décision avant son expiration. C’est à toi de prouver que tu t’es rétracté dans les temps : garde une copie de ton e-mail ou un accusé de réception.',
        ),
      ],
    },
    {
      id: 'remboursement',
      title: '5. Remboursement',
      body: [
        p(
          'Tu es remboursé de la totalité de la somme payée au plus tard 14 jours après la réception de ta décision (article L221-24), avec le même moyen de paiement que celui utilisé pour l’achat, sauf accord exprès de ta part pour un autre moyen, et sans aucun frais. Ton lien d’accès est alors désactivé.',
        ),
      ],
    },
    {
      id: 'formulaire',
      title: '6. Formulaire de rétractation',
      body: [
        withdrawalForm(),
        h('h3', { text: 'Modèle officiel, à imprimer et remplir à la main' }),
        h(
          'div',
          { class: 'legal-box' },
          p('(Annexe à l’article R221-1 du code de la consommation. Complète et renvoie le présent formulaire uniquement si tu souhaites te rétracter du contrat.)'),
          p(
            'À l’attention de ',
            ...editorName(),
            ', ',
            legalValue(legal.editor.address),
            ', ',
            legalEmail(legal.editor.email),
            ' :',
          ),
          p(
            'Je/Nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant sur la vente du bien (*)/pour la prestation de services (*) ci-dessous :',
          ),
          p('Commandé le (*)/reçu le (*) :'),
          p('Nom du (des) consommateur(s) :'),
          p('Adresse du (des) consommateur(s) :'),
          p('Signature du (des) consommateur(s) (uniquement en cas de notification du présent formulaire sur papier) :'),
          p('Date :'),
          p(h('small', { text: '(*) Rayez la mention inutile.' })),
        ),
      ],
    },
    {
      id: 'garantie',
      title: '7. Et si ton plan a un défaut ?',
      body: [
        p(
          'Même quand le droit de rétractation ne s’applique plus, la garantie légale de conformité des contenus numériques reste due (articles L224-25-12 et suivants du code de la consommation) : plan inaccessible, séances manquantes, fonction annoncée qui ne marche pas… Le défaut est corrigé sans frais ; à défaut, tu obtiens une réduction du prix ou le remboursement. Détails dans les ',
          h('a', { attrs: { href: '/cgv/#conformite' }, text: 'conditions générales de vente' }),
          '.',
        ),
      ],
    },
  ],
});
