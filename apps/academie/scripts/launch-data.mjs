// Données de la page de pilotage (artefact) : fiches PayPal, liens suivis et publications prêtes à copier.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'config.json'), 'utf8'));
const tokens = process.env.ACCESS_TOKENS ? JSON.parse(process.env.ACCESS_TOKENS) : JSON.parse(readFileSync(join(ROOT, 'tokens.json'), 'utf8'));
const courses = cfg.order.map((s) => join(ROOT, 'content', s, 'course.json')).filter(existsSync).map((f) => JSON.parse(readFileSync(f, 'utf8')));

// PayPal refuse < > " ' & dans le nom du produit.
const ppName = (s) => s.replace(/'/g, '’').replace(/[<>"&]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 127);
const link = (slug, source) => `${cfg.siteUrl}/formations/${slug}/?utm_source=${source}&utm_campaign=lancement`;
const bullets = (arr, n) => (arr || []).slice(0, n).map((x) => `• ${x}`).join('\n');

const products = courses.map((c) => ({
  slug: c.slug,
  title: c.title,
  category: c.category,
  name: ppName(`Masterclass ${c.title}`),
  price: `${cfg.price}.00`,
  description: `${c.subtitle} Masterclass en ligne (${c.duration}) : 8 modules, boîte à outils, quiz final et certificat de réussite Kairos Académie. Accès immédiat et à vie. ${cfg.legal.vat}.`.slice(0, 2048),
  returnUrl: `${cfg.siteUrl}/acces/${c.slug}-${tokens[c.slug]}/`,
  salesUrl: `${cfg.siteUrl}/formations/${c.slug}/`,
  posts: {
    facebook: `${(c.pain_points || [])[0] || c.subtitle}\n\nJ'ai réuni l'essentiel dans une masterclass claire de ${c.duration} :\n\n${bullets(c.outcomes, 4)}\n\n8 modules, des exercices, une boîte à outils et un certificat de réussite. ${cfg.price} €, accès à vie.\nLe début du module 1 est en lecture libre : ${link(c.slug, 'facebook')}`,
    linkedin: `${c.subtitle}\n\nCe que vous saurez faire à la fin :\n${bullets(c.outcomes, 5)}\n\nFormat : ${c.duration}, 8 modules, quiz de 20 questions, certificat de réussite à ajouter à votre profil.\nPrix : ${cfg.price} € (accès à vie).\n\nExtrait gratuit : ${link(c.slug, 'linkedin')}`,
    whatsapp: `Bonjour ! Tu me parlais de ${c.category.toLowerCase()} : j'ai mis en ligne une masterclass « ${c.title} ». Le début est gratuit, ça devrait t'aider : ${link(c.slug, 'whatsapp')}`,
    instagram: `${(c.pain_points || [])[1] || c.subtitle}\n\nLa masterclass complète « ${c.title} » : ${c.duration}, 8 modules, certificat de réussite. ${cfg.price} €, accès à vie.\nLien en bio, le début est gratuit.\n\n#formation #${c.category.toLowerCase().replace(/[^a-zà-ÿ]+/g, '')} #masterclass`,
    email: `Objet : ${c.title} (${cfg.price} €, accès à vie)\n\nBonjour,\n\n${c.promise}\n\nAu programme :\n${(c.modules || []).map((m) => `${m.n}. ${m.title}`).join('\n')}\n\nLe début du module 1 est en lecture libre : ${link(c.slug, 'email')}\n\nBonne lecture,\n${cfg.founder}, ${cfg.brand}`,
  },
}));
products.push({
  slug: 'pass-integral', title: 'Pass intégral', category: 'Offre groupée',
  name: ppName(`Pass intégral - les ${courses.length} masterclasses Kairos Académie`),
  price: `${cfg.passPrice}.00`,
  description: `Les ${courses.length} masterclasses Kairos Académie (plus de ${Math.round(courses.length * 2.5)} heures de formation) : accès immédiat et à vie, boîtes à outils, quiz et ${courses.length} certificats de réussite. ${cfg.legal.vat}.`,
  returnUrl: `${cfg.siteUrl}/acces/pass-integral-${tokens['pass-integral']}/`,
  salesUrl: `${cfg.siteUrl}/#pass`,
  posts: null,
});

const channels = ['facebook', 'linkedin', 'instagram', 'whatsapp', 'email', 'tiktok'];
console.log(JSON.stringify({
  siteUrl: cfg.siteUrl,
  adminUrl: `${cfg.siteUrl}/admin/`,
  netlifyUrl: 'https://app.netlify.com/projects/kairos-academie',
  formsUrl: 'https://app.netlify.com/projects/kairos-academie/forms',
  legal: cfg.legal,
  products,
  trackedHome: channels.map((s) => ({ source: s, url: `${cfg.siteUrl}/?utm_source=${s}&utm_campaign=lancement` })),
}));
