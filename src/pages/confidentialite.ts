/**
 * Politique de confidentialité (/confidentialite/) : RGPD (règlement (UE) 2016/679)
 * et loi Informatique et Libertés. Responsable de traitement tiré de src/legal.ts,
 * traitements (calcul du plan, achat, Premium, support, sécurité), stockage local
 * sans cookie, prestataires (Cloudflare, Stripe, PayPal), transferts, droits, CNIL.
 * Bouton d'effacement des données du site sur l'appareil.
 */
import { KEY_DATES } from '../config';
import { legal } from '../legal';
import { supportMailto } from '../lib/access';
import { bootPage } from '../lib/boot';
import { announce, h, must, toast, type Child } from '../lib/dom';
import { formatDate } from '../lib/format';
import { icon } from '../lib/icons';
import { defRow, editorName, legalEmail, legalValue, renderLegalPage } from '../lib/legal-ui';
import { clearAllSiteData, clearOfflinePlanCache } from '../lib/storage';
import { TOKEN_EXPIRES_AT } from '../shared/token';

bootPage();

const p = (...children: Child[]) => h('p', {}, ...children);
const ul = (...items: Child[][]) => h('ul', {}, items.map((item) => h('li', {}, ...item)));
const ext = (href: string, text: string) => h('a', { attrs: { href, rel: 'noopener' }, text });

const accessUntil = formatDate(TOKEN_EXPIRES_AT.slice(0, 10));
const premiumUntil = formatDate(KEY_DATES.premiumUntil);

interface Processing {
  title: string;
  data: Child[];
  purpose: Child[];
  basis: Child[];
  retention: Child[];
}

const PROCESSINGS: Processing[] = [
  {
    title: 'Calcul de ton plan',
    data: ['Ta course et sa date, ton objectif, ton temps sur 10 km, tes kilomètres par semaine, ton nombre de séances et le jour de ta sortie longue.'],
    purpose: ['Calculer ta semaine 1 gratuite et ton plan complet.'],
    basis: ['Mesures précontractuelles et exécution du contrat (art. 6.1.b du RGPD).'],
    retention: [
      'Rien n’est enregistré sur le serveur après le calcul. L’aperçu gratuit, qui n’est lié à aucune identité, peut rester jusqu’à 1 h dans le cache technique de l’hébergeur.',
    ],
  },
  {
    title: 'Achat et accès au plan',
    data: [
      'Ton adresse e-mail, ton nom (titulaire de la carte), ton pays et, si Stripe la demande, ton adresse de facturation, l’e-mail de ton compte Traceo si tu l’indiques, la référence, la date et le montant du paiement, la course et le niveau choisis, ton lien personnel (il contient ton e-mail, la référence du paiement et sa date d’expiration). Tes données bancaires sont saisies chez Stripe ou PayPal : le vendeur n’y a jamais accès.',
      ' Ces données sont nécessaires pour conclure et exécuter le contrat : sans adresse e-mail, le paiement et l’envoi de ton accès sont impossibles. Les réponses au formulaire servent uniquement au calcul du plan ; l’e-mail de ton compte Traceo est facultatif.',
    ],
    purpose: ['Encaisser le paiement, t’ouvrir l’accès au plan, te renvoyer ton lien si tu le perds, tenir la comptabilité.'],
    basis: ['Exécution du contrat (art. 6.1.b) et obligations comptables et fiscales (art. 6.1.c).'],
    retention: [
      `Pendant ton accès (jusqu’au ${accessUntil}), puis 10 ans pour les pièces comptables (art. L123-22 du code de commerce).`,
    ],
  },
  {
    title: 'Activation de Traceo Premium',
    data: ['L’adresse e-mail utilisée pour l’achat.'],
    purpose: [`Activer Traceo Premium sur ton compte jusqu’au ${premiumUntil}.`],
    basis: ['Exécution du contrat (art. 6.1.b).'],
    retention: ['Jusqu’à la fin de l’avantage, puis archivage avec les données de commande.'],
  },
  {
    title: 'Preuve de l’accès immédiat et rétractation en ligne',
    data: [
      'Pour l’accord d’accès immédiat : la référence de la commande, ton e-mail, la date et l’heure de l’accord et la version du texte de la case. Pour la fonction « Renoncer au contrat ici » : tes nom et prénom, l’e-mail et la référence de la commande, l’adresse de l’accusé de réception, la date et l’heure de la déclaration.',
    ],
    purpose: [
      'Te confirmer ton accord ou ta rétractation par e-mail (support durable), prouver ces démarches (art. L221-7 du code de la consommation) et traiter le remboursement.',
    ],
    basis: ['Obligations légales (art. 6.1.c du RGPD).'],
    retention: ['5 ans (délai de prescription, art. 2224 du code civil).'],
  },
  {
    title: 'Support, réclamations, rétractation',
    data: ['Ton adresse e-mail et le contenu de tes messages.'],
    purpose: ['Répondre à tes questions, traiter une réclamation, une demande de rétractation ou de mise en conformité.'],
    basis: ['Exécution du contrat (art. 6.1.b) et obligations légales (art. 6.1.c).'],
    retention: ['Jusqu’à 5 ans après le dernier échange (délai de prescription, art. 2224 du code civil).'],
  },
  {
    title: 'Sécurité et fonctionnement du site',
    data: ['Adresse IP, type de navigateur, pages demandées, date et heure (journaux techniques).'],
    purpose: ['Servir les pages, protéger le site contre les abus et les attaques, diagnostiquer les pannes.'],
    basis: ['Intérêt légitime à garder le site sûr et disponible (art. 6.1.f).'],
    retention: ['Durée courte fixée par l’hébergeur, uniquement pour ces finalités.'],
  },
];

function processingCard(item: Processing): HTMLElement {
  return h(
    'li',
    { class: 'legal-card' },
    h('h3', { text: item.title }),
    h(
      'dl',
      {},
      h('div', {}, h('dt', { text: 'Données' }), h('dd', {}, ...item.data)),
      h('div', {}, h('dt', { text: 'Pourquoi' }), h('dd', {}, ...item.purpose)),
      h('div', {}, h('dt', { text: 'Base légale' }), h('dd', {}, ...item.basis)),
      h('div', {}, h('dt', { text: 'Durée' }), h('dd', {}, ...item.retention)),
    ),
  );
}

function clearDataBlock(): HTMLElement {
  const status = h('p', { class: 'hint', attrs: { role: 'status', 'aria-live': 'polite' } });
  const button = h(
    'button',
    { class: 'btn btn--sm', attrs: { type: 'button' } },
    icon('close'),
    'Effacer mes données sur cet appareil',
  );
  button.addEventListener('click', async () => {
    const ok = window.confirm(
      'Effacer ton lien d’accès, tes réglages, tes séances cochées et la copie hors ligne de ton plan sur cet appareil ? Garde ton lien personnel : il te permettra de rouvrir ton plan.',
    );
    if (!ok) return;
    const count = clearAllSiteData();
    await clearOfflinePlanCache();
    const message =
      count > 0
        ? 'C’est fait : les données du site ont été effacées de cet appareil.'
        : 'Aucune donnée du site n’était enregistrée sur cet appareil.';
    status.textContent = message;
    toast(message);
    announce(message);
  });
  return h('div', { class: 'legal-actions' }, button, status);
}

function rightsMailBlock(): HTMLElement | null {
  const href = supportMailto(
    'Pass J-24 : exercice de mes droits sur mes données',
    'Bonjour,\n\nJe souhaite exercer mon droit (accès / rectification / effacement / limitation / opposition / portabilité) concernant mes données.\n\nE-mail utilisé pour l’achat : \n\nPrécisions : ',
  );
  if (!href) return null;
  return h(
    'div',
    { class: 'legal-actions' },
    h('a', { class: 'btn btn--sm btn--primary', attrs: { href } }, icon('mail'), 'Exercer mes droits par e-mail'),
  );
}

renderLegalPage(must('#contenu'), {
  eyebrow: 'Tes données',
  title: 'Politique de confidentialité',
  intro: [
    p(
      'Voici quelles données sont utilisées quand tu visites ce site et quand tu achètes le Pass J-24, pourquoi, combien de temps, et comment exercer tes droits, conformément au règlement général sur la protection des données (RGPD) et à la loi Informatique et Libertés.',
    ),
    p(
      h('strong', { text: 'En bref : ' }),
      'pas de compte à créer, pas de publicité, pas de mesure d’audience, aucun cookie de suivi. Le strict nécessaire pour calculer ton plan, encaisser ton paiement et t’ouvrir l’accès.',
    ),
  ],
  sections: [
    {
      id: 'responsable',
      title: '1. Responsable du traitement',
      body: [
        h(
          'dl',
          { class: 'legal-dl' },
          defRow('Responsable', ...editorName(), ', entrepreneur individuel'),
          defRow('Adresse', legalValue(legal.editor.address)),
          defRow('Contact', legalEmail(legal.editor.email)),
        ),
        p('Pour toute question sur tes données, écris à cette adresse : c’est la même personne qui te répond.'),
      ],
    },
    {
      id: 'traitements',
      title: '2. Données utilisées et pourquoi',
      body: [
        p('Chaque usage a une finalité précise, une base légale et une durée de conservation limitée :'),
        h('ul', { class: 'legal-cards' }, PROCESSINGS.map(processingCard)),
        p(
          'Le plan est calculé automatiquement à partir de tes réponses, selon des règles générales de préparation. Ce calcul n’entraîne aucune décision produisant des effets juridiques à ton égard (art. 22 du RGPD).',
        ),
      ],
    },
    {
      id: 'appareil',
      title: '3. Ce qui reste sur ton appareil',
      body: [
        p(
          'Le site n’utilise pas de cookie. Pour fonctionner, il enregistre quelques informations dans le stockage local de ton navigateur (localStorage), uniquement sur ton appareil :',
        ),
        ul(
          ['ton lien d’accès et la référence de ton achat ;'],
          ['tes réglages de plan et tes réponses au formulaire gratuit ;'],
          ['les séances que tu as cochées « fait » ;'],
          ['la date à laquelle tu as demandé l’accès immédiat au contenu (case de renonciation au droit de rétractation) ;'],
          ['la course et le niveau choisis au moment de l’achat ;'],
          ['si tu as refermé le bandeau d’installation de l’app.'],
        ),
        p(
          'Pour l’usage hors ligne, le navigateur garde aussi une copie des pages du site et de la dernière version de ton plan (cache du service worker).',
        ),
        p(
          'Ces informations servent uniquement à te fournir le service que tu demandes : elles ne nécessitent donc pas de consentement (article 82 de la loi Informatique et Libertés). Seuls ton lien d’accès et tes réglages sont envoyés au serveur, au moment de calculer ton plan. L’image story et l’export agenda (.ics) sont fabriqués directement dans ton navigateur : ils ne passent par aucun serveur.',
        ),
        p('Tu peux tout effacer à tout moment depuis les réglages de ton navigateur, ou avec ce bouton :'),
        clearDataBlock(),
      ],
    },
    {
      id: 'jamais',
      title: '4. Ce que le site ne fait pas',
      body: [
        ul(
          ['aucun cookie publicitaire, aucun outil de mesure d’audience, aucun pixel de réseau social ;'],
          ['aucun script ni aucune police chargés depuis un service tiers : tout est servi par le site lui-même ;'],
          ['aucune vente, location ou cession de tes données ;'],
          ['aucun envoi de lettre d’information ou de publicité sans ton accord.'],
        ),
      ],
    },
    {
      id: 'destinataires',
      title: '5. Qui reçoit tes données',
      body: [
        p('Tes données sont utilisées par le vendeur seul, avec l’aide de ces prestataires, chacun pour ce qui le concerne :'),
        ul(
          [
            h('strong', { text: 'Cloudflare, Inc.' }),
            ' (États-Unis) : hébergement du site et du serveur qui calcule ton plan (Cloudflare Pages). ',
            ext('https://www.cloudflare.com/fr-fr/privacypolicy/', 'Sa politique de confidentialité'),
            '.',
          ],
          [
            h('strong', { text: 'Stripe Payments Europe, Ltd.' }),
            ' (Irlande) : paiement par carte et portefeuilles (Apple Pay, Google Pay). Stripe est aussi responsable de ses propres traitements (lutte contre la fraude, obligations financières). ',
            ext('https://stripe.com/fr/privacy', 'Sa politique de confidentialité'),
            '.',
          ],
          [
            h('strong', { text: 'PayPal (Europe) S.à r.l. et Cie, S.C.A.' }),
            ' (Luxembourg), seulement si tu paies par PayPal. ',
            ext('https://www.paypal.com/fr/legalhub/privacy-full', 'Sa politique de confidentialité'),
            '.',
          ],
          [
            h('strong', { text: 'Resend, Inc.' }),
            ' (États-Unis) : envoi des e-mails de confirmation de commande et des accusés de réception de rétractation. ',
            ext('https://resend.com/legal/privacy-policy', 'Sa politique de confidentialité'),
            '.',
          ],
        ),
        p(
          'Le bouton « Générer ma boucle de X km » ouvre l’application Traceo dans un nouvel onglet, avec seulement la distance dans l’adresse. Traceo applique alors ses propres règles de confidentialité.',
        ),
      ],
    },
    {
      id: 'transferts',
      title: '6. Transferts hors de l’Union européenne',
      body: [
        p(
          'Certains prestataires (Cloudflare, Stripe, PayPal, Resend) peuvent traiter des données hors de l’Union européenne, notamment aux États-Unis. Ces transferts sont encadrés par la décision d’adéquation de la Commission européenne du 10 juillet 2023 (cadre de protection des données UE–États-Unis) pour les entreprises certifiées et, à défaut, par les clauses contractuelles types de la Commission européenne.',
        ),
      ],
    },
    {
      id: 'securite',
      title: '7. Sécurité',
      body: [
        p(
          'Le site est servi uniquement en HTTPS, avec une politique de sécurité stricte du contenu. Ton lien personnel est signé : le serveur vérifie sa signature à chaque calcul du plan. Le paiement se fait sur les pages sécurisées de Stripe ou de PayPal.',
        ),
        p(
          'Ton lien personnel donne accès à ton plan : ne le partage pas. S’il a circulé, écris au support pour en recevoir un nouveau.',
        ),
      ],
    },
    {
      id: 'droits',
      title: '8. Tes droits',
      body: [
        p('Sur les données qui te concernent, tu disposes des droits suivants :'),
        ul(
          [h('strong', { text: 'accès' }), ' : savoir quelles données sont utilisées et en obtenir une copie (art. 15 du RGPD) ;'],
          [h('strong', { text: 'rectification' }), ' : corriger une donnée inexacte, par exemple ton adresse e-mail (art. 16) ;'],
          [h('strong', { text: 'effacement' }), ' : demander la suppression de tes données, sauf celles que la loi oblige à conserver (art. 17) ;'],
          [h('strong', { text: 'limitation' }), ' : geler l’utilisation d’une donnée le temps d’un examen (art. 18) ;'],
          [h('strong', { text: 'portabilité' }), ' : recevoir tes données dans un format lisible par une machine (art. 20) ;'],
          [h('strong', { text: 'opposition' }), ' : t’opposer à un traitement fondé sur l’intérêt légitime (art. 21) ;'],
          [h('strong', { text: 'directives' }), ' : décider du sort de tes données après ton décès (art. 85 de la loi Informatique et Libertés).'],
        ),
        p(
          'Pour les exercer, écris à ',
          legalEmail(legal.editor.email),
          ' ou par courrier à l’adresse indiquée à l’article 1. Une réponse t’est apportée dans un délai d’un mois (prolongeable de deux mois pour une demande complexe, tu en seras alors informé). Une pièce d’identité ne peut t’être demandée qu’en cas de doute raisonnable sur ton identité.',
        ),
        rightsMailBlock(),
      ],
    },
    {
      id: 'cnil',
      title: '9. Réclamation auprès de la CNIL',
      body: [
        p(
          'Si tu estimes que tes droits ne sont pas respectés, tu peux adresser une réclamation à la Commission nationale de l’informatique et des libertés (CNIL) :',
        ),
        h(
          'dl',
          { class: 'legal-dl' },
          defRow('En ligne', ext('https://www.cnil.fr/fr/plaintes', 'cnil.fr/fr/plaintes')),
          defRow('Courrier', 'CNIL, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07'),
        ),
      ],
    },
    {
      id: 'modifications',
      title: '10. Modifications',
      body: [
        p(
          'Cette politique peut évoluer, par exemple si un prestataire change ou si une fonction est ajoutée. La date de dernière mise à jour figure en haut de la page ; un changement important sera signalé sur le site.',
        ),
      ],
    },
  ],
});
