/**
 * Mentions légales (/mentions-legales/) : éditeur, directeur de la publication,
 * hébergeur (art. 6, III de la LCEN), valeurs tirées de src/legal.ts.
 */
import { legal } from '../legal';
import { bootPage } from '../lib/boot';
import { h, must } from '../lib/dom';
import { defRow, editorName, legalEmail, legalLink, legalValue, renderLegalPage } from '../lib/legal-ui';

bootPage();

const p = (...children: (Node | string)[]) => h('p', {}, ...children);

renderLegalPage(must('#contenu'), {
  eyebrow: 'Informations légales',
  title: 'Mentions légales',
  intro: [
    p(
      'Conformément à l’article 1-1 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique (LCEN), voici l’identité de l’éditeur, de l’hébergeur et des prestataires qui stockent les données du site Pass J-24 · Traceo.',
    ),
  ],
  sections: [
    {
      id: 'editeur',
      title: 'Éditeur du site',
      body: [
        h(
          'dl',
          { class: 'legal-dl' },
          defRow('Nom', ...editorName()),
          defRow('Statut', 'Entrepreneur individuel (micro-entreprise)'),
          defRow('Adresse', legalValue(legal.editor.address)),
          defRow('E-mail', legalEmail(legal.editor.email)),
          defRow('Téléphone', legalValue(legal.editor.phone)),
          defRow('SIREN', legalValue(legal.editor.siren)),
          defRow('TVA', legalValue(legal.editor.vat)),
        ),
      ],
    },
    {
      id: 'publication',
      title: 'Directeur de la publication',
      body: [p(legalValue(legal.editor.publicationDirector), '.')],
    },
    {
      id: 'hebergeur',
      title: 'Hébergeur',
      body: [
        h(
          'dl',
          { class: 'legal-dl' },
          defRow('Société', legalValue(legal.host.name)),
          defRow('Adresse', legalValue(legal.host.address)),
          defRow('Téléphone', legalValue(legal.host.phone)),
          defRow('Site', legalLink(legal.host.website)),
        ),
        p(
          'Le site est servi par le service Cloudflare Pages. Les paiements sont traités par Stripe ou, le cas échéant, par PayPal : voir la ',
          h('a', { attrs: { href: '/confidentialite/' }, text: 'politique de confidentialité' }),
          '.',
        ),
      ],
    },
    {
      id: 'stockage',
      title: 'Stockage des données',
      body: [
        p('Les données traitées par l’éditeur sont stockées par :'),
        h(
          'ul',
          {},
          h('li', { text: 'Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis (hébergement, calcul du plan, registre des rétractations et des accords d’accès immédiat) ;' }),
          h('li', { text: 'Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Grand Canal Dock, Dublin D02 H210, Irlande (paiements par carte) ;' }),
          h('li', { text: 'PayPal (Europe) S.à r.l. et Cie, S.C.A., 22-24 boulevard Royal, L-2449 Luxembourg (paiements PayPal, le cas échéant) ;' }),
          h('li', { text: 'Resend, Inc., 2261 Market Street #5039, San Francisco, CA 94114, États-Unis (envoi des e-mails de confirmation et des accusés de réception).' }),
        ),
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      body: [
        p(
          'Pour toute question sur le site, ta commande ou tes données : ',
          legalEmail(legal.editor.email),
          '. Une réponse t’est apportée dans les meilleurs délais.',
        ),
      ],
    },
    {
      id: 'propriete',
      title: 'Propriété intellectuelle',
      body: [
        p(
          'Les textes, programmes générés, visuels, logos et le code du site sont protégés par le droit d’auteur. Toute reproduction, diffusion ou revente sans autorisation écrite de l’éditeur est interdite. L’acheteur du pass peut utiliser son plan pour son usage personnel, l’imprimer et partager son image story.',
        ),
      ],
    },
    {
      id: 'courses',
      title: 'Noms de courses',
      body: [
        p(
          'Pass J-24 n’est lié à aucun organisateur de course ni à aucune marque d’équipement sportif. Les noms et dates de courses sont cités uniquement pour indiquer l’épreuve que tu prépares et caler ton plan sur sa date.',
        ),
      ],
    },
    {
      id: 'sante',
      title: 'Avertissement santé',
      body: [
        p(
          'Le Pass J-24 est un programme généré automatiquement à partir des informations que tu fournis. Il ne remplace ni l’avis d’un médecin ni un encadrement sportif individuel. Avant de commencer une préparation, fais un bilan avec ton médecin. En cas de douleur, de malaise ou de doute, arrête-toi et consulte.',
        ),
      ],
    },
    {
      id: 'donnees',
      title: 'Données personnelles',
      body: [
        p(
          'Le site ne dépose aucun cookie publicitaire ni de mesure d’audience. Le détail des données utilisées et de tes droits est dans la ',
          h('a', { attrs: { href: '/confidentialite/' }, text: 'politique de confidentialité' }),
          '. Les conditions de vente sont dans les ',
          h('a', { attrs: { href: '/cgv/' }, text: 'CGV' }),
          '.',
        ),
      ],
    },
  ],
});
