// Génère marketing/KIT-MARKETING.md : liens suivis (UTM), publications prêtes à poster et e-mails, par masterclass.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'config.json'), 'utf8'));
const courses = cfg.order
  .map((slug) => join(ROOT, 'content', slug, 'course.json'))
  .filter(existsSync)
  .map((f) => JSON.parse(readFileSync(f, 'utf8')));

const link = (slug, source, campaign = 'lancement') => `${cfg.siteUrl}/formations/${slug}/?utm_source=${source}&utm_campaign=${campaign}`;
const list = (arr, n) => (arr || []).slice(0, n).map((x) => `- ${x}`).join('\n');

let out = `# Kit marketing · ${cfg.brand}

Généré automatiquement depuis le contenu des masterclasses (\`npm run marketing\`).
Chaque lien porte un paramètre \`utm_source\` : le tableau de bord (\`/admin/\`, colonne « Sources ») montre ainsi d'où viennent les visiteurs et les acheteurs.

Règles d'or : publier dans les groupes seulement quand le règlement l'autorise, apporter d'abord de la valeur (un conseil concret tiré du module 1), ne jamais acheter de faux avis, ne jamais envoyer d'e-mail à des personnes qui n'ont pas donné leur accord.

## Liens à utiliser

| Canal | Lien Pass intégral |
| --- | --- |
${['facebook', 'linkedin', 'instagram', 'whatsapp', 'email', 'tiktok'].map((s) => `| ${s} | ${cfg.siteUrl}/?utm_source=${s}&utm_campaign=lancement#pass |`).join('\n')}

`;

for (const c of courses) {
  out += `
---

## ${c.title}

Page de vente : ${cfg.siteUrl}/formations/${c.slug}/

### Publication Facebook (groupe ou page)

\`\`\`
${(c.pain_points || [])[0] || c.subtitle}

J'ai réuni l'essentiel dans une masterclass claire de ${c.duration}, pensée pour ${String((c.audience || [])[0] || 'tous').toLowerCase()} :

${list(c.outcomes, 4)}

8 modules, des exercices, une boîte à outils et un certificat de réussite. ${cfg.price} €, accès à vie.
Le début du module 1 est en lecture libre ici : ${link(c.slug, 'facebook')}
\`\`\`

### Publication LinkedIn

\`\`\`
${c.subtitle}

Ce que vous saurez faire à la fin :
${list(c.outcomes, 5)}

Format : ${c.duration}, 8 modules, quiz de 20 questions, certificat de réussite à ajouter à votre profil.
Prix : ${cfg.price} € (accès à vie).

Extrait gratuit : ${link(c.slug, 'linkedin')}
\`\`\`

### Message WhatsApp ou SMS (à vos contacts qui vous l'ont demandé)

\`\`\`
Bonjour ! Tu me parlais de ${c.category.toLowerCase()} : j'ai mis en ligne une masterclass « ${c.title} ». Le début est gratuit, ça devrait t'aider : ${link(c.slug, 'whatsapp')}
\`\`\`

### Légende Instagram / TikTok (vidéo face caméra de 30 s)

\`\`\`
Accroche (3 premières secondes) : « ${(c.pain_points || [])[1] || c.subtitle} »
Conseil express : un point du module 1, en une phrase.
Appel à l'action : « La masterclass complète est en lien dans ma bio, le début est gratuit. »
Lien bio : ${link(c.slug, 'instagram')}
\`\`\`

### E-mail à votre liste (personnes inscrites)

\`\`\`
Objet : ${c.title} (${cfg.price} €, accès à vie)

Bonjour,

${c.promise}

Au programme :
${(c.modules || []).map((m) => `${m.n}. ${m.title}`).join('\n')}

Le début du module 1 est en lecture libre : ${link(c.slug, 'email')}

Bonne lecture,
${cfg.founder}, ${cfg.brand}
\`\`\`
`;
}

mkdirSync(join(ROOT, 'marketing'), { recursive: true });
writeFileSync(join(ROOT, 'marketing', 'KIT-MARKETING.md'), out);
console.log(`Kit marketing : ${courses.length} masterclasses → marketing/KIT-MARKETING.md`);
