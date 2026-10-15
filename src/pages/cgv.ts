/**
 * Conditions générales de vente (/cgv/) : contenu numérique vendu par un
 * micro-entrepreneur à des consommateurs. Prix TTC et mention art. 293 B du CGI,
 * accès immédiat et renonciation au droit de rétractation (art. L221-28 13°),
 * garantie légale de conformité des contenus numériques (art. L224-25-12 et s.),
 * réclamations et médiation (valeurs de src/legal.ts).
 */
import { KEY_DATES, VAT_MENTION, config, formatEuros } from '../config';
import { legal } from '../legal';
import { WAIVER_TEXT, PAYPAL_DELAY_TEXT } from '../lib/checkout';
import { bootPage } from '../lib/boot';
import { h, must, type Child } from '../lib/dom';
import { formatDate } from '../lib/format';
import { defRow, editorName, legalEmail, legalLink, legalValue, renderLegalPage } from '../lib/legal-ui';
import { TOKEN_EXPIRES_AT } from '../shared/token';

bootPage();

const p = (...children: Child[]) => h('p', {}, ...children);
const ul = (...items: Child[][]) => h('ul', {}, items.map((item) => h('li', {}, ...item)));

const launchEnd = new Date(config.launchPriceEnd);
const launchEndLabel = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
}).format(launchEnd);
const accessUntil = formatDate(TOKEN_EXPIRES_AT.slice(0, 10));
const premiumUntil = formatDate(KEY_DATES.premiumUntil);

renderLegalPage(must('#contenu'), {
  eyebrow: 'Pass J-24 · Traceo',
  title: 'Conditions générales de vente',
  intro: [
    p(
      'Ces conditions s’appliquent à l’achat du Pass J-24 · Traceo sur ce site par un consommateur. En passant commande, tu les acceptes. Elles sont rédigées en français et tutoient l’acheteur, sans que cela change leur portée.',
    ),
  ],
  sections: [
    {
      id: 'vendeur',
      title: '1. Vendeur',
      body: [
        h(
          'dl',
          { class: 'legal-dl' },
          defRow('Vendeur', ...editorName(), ', entrepreneur individuel (micro-entreprise)'),
          defRow('Adresse', legalValue(legal.editor.address)),
          defRow('E-mail', legalEmail(legal.editor.email)),
          defRow('Téléphone', legalValue(legal.editor.phone)),
          defRow('SIREN', legalValue(legal.editor.siren)),
          defRow('TVA', legalValue(legal.editor.vat)),
        ),
        p('Voir aussi les ', h('a', { attrs: { href: '/mentions-legales/' }, text: 'mentions légales' }), '.'),
      ],
    },
    {
      id: 'produit',
      title: '2. Le produit',
      body: [
        p(
          'Le Pass J-24 est un contenu numérique, fourni sans support matériel : un programme de préparation au marathon ou au semi-marathon, généré automatiquement à partir des informations que tu indiques (course, date, objectif, temps sur 10 km, kilométrage, séances par semaine, jour de sortie longue). Il comprend :',
        ),
        ul(
          ['le plan complet daté : marathon en 24 semaines, semi en 20 semaines, ou toute autre date de course située à au moins 8 semaines ;'],
          ['3 niveaux d’objectif, modifiables à tout moment, avec recalcul du plan ;'],
          ['pour chaque séance, un bouton « Générer ma boucle de X km » qui ouvre l’application Traceo avec la bonne distance ;'],
          ['l’export des séances au format agenda (.ics), une version imprimable (PDF via l’impression du navigateur) et une image story 1080 × 1920 ;'],
          [
            `Traceo Premium jusqu’au ${premiumUntil}, activé à la main sous 24 h à partir de l’adresse e-mail utilisée pour l’achat (si ton compte Traceo utilise une autre adresse, signale-le au support).`,
          ],
        ),
        p(
          `L’accès au plan se fait par un lien personnel, valable jusqu’au ${accessUntil}. Il fonctionne sur un navigateur récent (Chrome, Safari, Firefox ou Edge à jour) avec une connexion internet ; après un premier chargement, la dernière version du plan reste consultable hors ligne sur le même appareil.`,
        ),
        p(
          'Le programme est généré automatiquement selon des règles générales de préparation. Il ne constitue ni un avis médical, ni un encadrement sportif personnalisé : aucun éducateur sportif ne suit tes séances.',
        ),
      ],
    },
    {
      id: 'prix',
      title: '3. Prix',
      body: [
        p(
          `Le prix est indiqué en euros, toutes taxes comprises (TTC). ${VAT_MENTION}. Il s’agit d’un paiement unique, sans abonnement ni renouvellement.`,
        ),
        ul(
          [h('strong', { text: formatEuros(config.priceLaunch) }), ` pour toute commande passée jusqu’au ${launchEndLabel} (heure de Paris) ;`],
          [h('strong', { text: formatEuros(config.priceRegular) }), ' pour toute commande passée ensuite.'],
        ),
        p('Le prix applicable est celui affiché au moment de la commande. Il n’y a aucun frais supplémentaire (pas de frais de livraison).'),
      ],
    },
    {
      id: 'commande',
      title: '4. Commande',
      body: [
        p('Pour commander :'),
        h(
          'ol',
          {},
          h('li', { text: 'tu cliques sur un bouton d’achat ; une fenêtre récapitule le contenu du pass et son prix ;' }),
          h('li', {}, 'tu coches la case « ', h('em', { text: WAIVER_TEXT }), ' » (elle n’est jamais cochée d’avance ; sans elle, le paiement ne s’ouvre pas) ;'),
          h('li', { text: 'tu paies sur la page sécurisée de Stripe ou, le cas échéant, de PayPal ;' }),
          h('li', { text: 'tu reçois ton accès (voir l’article 6).' }),
        ),
        p(
          'Le contrat est conclu à la validation du paiement. La confirmation de la commande (reçu de paiement), qui reprend ta demande d’accès immédiat et ta renonciation au droit de rétractation, t’est envoyée par e-mail : c’est la confirmation sur support durable prévue par l’article L221-13 du code de la consommation. Garde-la.',
        ),
      ],
    },
    {
      id: 'paiement',
      title: '5. Paiement',
      body: [
        p(
          'Le paiement est exigible à la commande. Il se fait par carte bancaire ou par les autres moyens proposés sur la page de paiement (par exemple Apple Pay ou Google Pay), via Stripe Payments Europe, Ltd., ou, le cas échéant, via PayPal (Europe) S.à r.l. et Cie, S.C.A. Tes données bancaires sont traitées directement par ces prestataires : le vendeur n’y a jamais accès.',
        ),
      ],
    },
    {
      id: 'acces',
      title: '6. Accès au contenu',
      body: [
        ul(
          ['Paiement par Stripe : tu es redirigé vers une page qui vérifie le paiement et affiche aussitôt ton lien personnel d’accès.'],
          [`Paiement par PayPal : ${PAYPAL_DELAY_TEXT}, à l’adresse de ton compte PayPal.`],
        ),
        p(
          'Ton lien est personnel : ne le partage pas. En cas de perte, écris au support depuis l’adresse utilisée pour l’achat : il te sera renvoyé. Si tu n’as rien reçu dans les délais annoncés, écris au support.',
        ),
      ],
    },
    {
      id: 'retractation',
      title: '7. Droit de rétractation',
      body: [
        p(
          'En principe, le consommateur dispose de 14 jours pour se rétracter d’un contrat conclu à distance (article L221-18 du code de la consommation). Toutefois, selon l’article L221-28 13° du même code, ce droit ne peut pas être exercé pour la fourniture d’un contenu numérique non fourni sur un support matériel dont l’exécution a commencé après ton accord préalable exprès et ta renonciation expresse à ce droit.',
        ),
        p(
          'Le Pass J-24 est fourni immédiatement : en cochant la case lors de la commande, tu demandes cet accès immédiat et tu reconnais perdre ton droit de rétractation. Tu ne peux donc plus te rétracter une fois l’accès ouvert.',
        ),
        p(
          'Si tu n’as pas donné cet accord (par exemple si tu as payé sans passer par la case, ou si tu as refusé de la cocher ensuite), tu conserves ton droit de rétractation pendant 14 jours à compter de la conclusion du contrat. La marche à suivre et le formulaire sont sur la page ',
          h('a', { attrs: { href: '/retractation/' }, text: 'Rétractation' }),
          '. Le remboursement intervient au plus tard 14 jours après réception de ta décision, avec le même moyen de paiement, sans frais.',
        ),
      ],
    },
    {
      id: 'conformite',
      title: '8. Garantie légale de conformité',
      body: [
        p(
          'Le vendeur est tenu de te fournir un contenu numérique conforme au contrat et répond des défauts de conformité, dans les conditions des articles L224-25-12 et suivants du code de la consommation. Cette garantie s’applique même si tu as renoncé à ton droit de rétractation.',
        ),
        p(
          'Pour la mettre en œuvre, écris au support (',
          legalEmail(legal.editor.email),
          ') en décrivant le problème : plan inaccessible, séances manquantes ou incohérentes, fonction annoncée qui ne marche pas…',
        ),
        h(
          'div',
          { class: 'legal-box' },
          p(
            'Le consommateur dispose d’un délai de deux ans à compter de la fourniture du contenu numérique pour obtenir la mise en œuvre de la garantie légale de conformité en cas d’apparition d’un défaut de conformité. Durant un délai d’un an à compter de la date de fourniture, le consommateur n’est tenu d’établir que l’existence du défaut de conformité et non la date d’apparition de celui-ci.',
          ),
          p(
            'La garantie légale de conformité emporte obligation de fournir toutes les mises à jour nécessaires au maintien de la conformité du contenu numérique.',
          ),
          p(
            'La garantie légale de conformité donne au consommateur droit à la mise en conformité du contenu numérique sans retard injustifié suivant sa demande, sans frais et sans inconvénient majeur pour lui.',
          ),
          p(
            'Le consommateur peut obtenir une réduction du prix en conservant le contenu numérique, ou il peut mettre fin au contrat en se faisant rembourser intégralement contre renoncement au contenu numérique, si : 1° le professionnel refuse de mettre le contenu numérique en conformité ; 2° la mise en conformité du contenu numérique est retardée de manière injustifiée ; 3° la mise en conformité du contenu numérique ne peut intervenir sans frais imposés au consommateur ; 4° la mise en conformité du contenu numérique occasionne un inconvénient majeur pour le consommateur ; 5° la non-conformité du contenu numérique persiste en dépit de la tentative de mise en conformité du professionnel restée infructueuse.',
          ),
          p(
            'Le consommateur a également droit à une réduction du prix ou à la résolution du contrat lorsque le défaut de conformité est si grave qu’il justifie que la réduction du prix ou la résolution du contrat soit immédiate. Le consommateur n’est alors pas tenu de demander la mise en conformité du contenu numérique au préalable.',
          ),
          p(
            'Toute période d’indisponibilité du contenu numérique en vue de sa remise en conformité suspend la garantie qui restait à courir jusqu’à la fourniture du contenu numérique de nouveau conforme.',
          ),
          p(
            'Ces droits résultent de l’application des articles L224-25-1 et suivants du code de la consommation. Le professionnel qui fait obstacle de mauvaise foi à la mise en œuvre de la garantie légale de conformité encourt une amende civile d’un montant maximal de 300 000 euros, qui peut être porté jusqu’à 10 % du chiffre d’affaires moyen annuel (article L242-18-1 du code de la consommation).',
          ),
          p(
            'Le consommateur bénéficie également de la garantie légale des vices cachés en application des articles 1641 à 1649 du code civil, pendant une durée de deux ans à compter de la découverte du défaut. Cette garantie donne droit à une réduction de prix si le contenu numérique est conservé ou à un remboursement intégral contre renonciation au contenu numérique.',
          ),
        ),
      ],
    },
    {
      id: 'responsabilite',
      title: '9. Santé, sécurité et responsabilité',
      body: [
        p(
          'La course à pied d’endurance sollicite fortement l’organisme. Avant de commencer, fais un bilan avec ton médecin. Adapte ou interromps le programme en cas de douleur, de malaise, de fatigue inhabituelle ou de doute, et consulte.',
        ),
        p(
          'Les boucles proposées par Traceo sont générées automatiquement à partir de données cartographiques : vérifie toujours que le parcours est praticable et sûr, et respecte le code de la route.',
        ),
        p(
          'Le vendeur est responsable de la bonne exécution du contrat dans les conditions prévues par la loi. Sa responsabilité ne peut être engagée en cas d’usage du programme contraire à ces recommandations, ou si l’inexécution est due à toi, à un tiers ou à un cas de force majeure.',
        ),
      ],
    },
    {
      id: 'propriete',
      title: '10. Propriété intellectuelle',
      body: [
        p(
          'Le plan est réservé à ton usage personnel. Tu peux l’imprimer et partager ton image story ; tu ne peux pas revendre, diffuser ou partager ton lien d’accès ou le contenu du plan.',
        ),
      ],
    },
    {
      id: 'donnees',
      title: '11. Données personnelles',
      body: [
        p(
          'Les données nécessaires à la commande sont traitées selon la ',
          h('a', { attrs: { href: '/confidentialite/' }, text: 'politique de confidentialité' }),
          '.',
        ),
      ],
    },
    {
      id: 'reclamations',
      title: '12. Réclamations et médiation',
      body: [
        p('Pour toute réclamation, écris d’abord au vendeur : ', legalEmail(legal.editor.email), ', ou par courrier à l’adresse indiquée à l’article 1.'),
        p(
          'Si le litige n’est pas résolu après cette réclamation écrite, tu peux recourir gratuitement au médiateur de la consommation (articles L611-1 et suivants du code de la consommation), dans un délai d’un an à compter de ta réclamation écrite :',
        ),
        h(
          'dl',
          { class: 'legal-dl' },
          defRow('Médiateur', legalValue(legal.mediator.name)),
          defRow('Adresse', legalValue(legal.mediator.address)),
          defRow('Site', legalLink(legal.mediator.website)),
        ),
      ],
    },
    {
      id: 'droit',
      title: '13. Droit applicable',
      body: [
        p(
          'Ces conditions sont soumises au droit français. En cas de litige, tu peux saisir, à ton choix, la juridiction du lieu où tu demeurais au moment de la conclusion du contrat ou de la survenance du fait dommageable, ou toute autre juridiction compétente selon la loi (article R631-3 du code de la consommation).',
        ),
      ],
    },
  ],
});
