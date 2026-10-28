// Génère le site statique de Kairos Académie dans dist/ à partir de content/ et config.json.
// Jetons d'accès : variable d'environnement ACCESS_TOKENS (JSON { slug: jeton }) ou tokens.json en local.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';


const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = process.env.CONTENT_DIR || join(ROOT, 'content');

const cfg = JSON.parse(readFileSync(join(ROOT, 'config.json'), 'utf8'));
// MIRROR=1 : copie statique (Tiiny Host…) dont les statistiques, certificats et formulaires restent servis par Netlify.
const MIRROR = process.env.MIRROR === '1';
const API = MIRROR ? cfg.siteUrl : '';
const DIST_DIR = MIRROR ? 'dist-mirror' : 'dist';
const DIST = join(ROOT, DIST_DIR);

let tokens = {};
if (process.env.ACCESS_TOKENS) tokens = JSON.parse(process.env.ACCESS_TOKENS);
else if (existsSync(join(ROOT, 'tokens.json'))) tokens = JSON.parse(readFileSync(join(ROOT, 'tokens.json'), 'utf8'));
else console.warn('⚠ Aucun jeton d\'accès (ACCESS_TOKENS) : les pages de cours ne seront pas générées.');

const TODO = 'À COMPLÉTER';
const todoKeys = Object.entries(cfg.legal).filter(([, v]) => v === TODO).map(([k]) => k);
if (todoKeys.length) console.warn(`⚠ Mentions légales à compléter dans config.json : ${todoKeys.join(', ')}`);

// ---------- utilitaires ----------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const euro = (n) => `${n} €`;
const write = (rel, html) => {
  const file = join(DIST, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
};
const words = (md) => md.replace(/```[\s\S]*?```/g, ' ').split(/\s+/).filter(Boolean).length;

const CALLOUTS = [
  ['À retenir', 'retenir'], ['Attention', 'attention'], ['Astuce', 'astuce'], ['Exemple', 'exemple'], ['Objectif', 'objectif'],
];
function md(src) {
  let html = marked.parse(src, { gfm: true });
  for (const [label, cls] of CALLOUTS) {
    html = html.replace(new RegExp(`<blockquote>\\s*<p><strong>${label}\\s*:?\\s*</strong>`, 'g'),
      `<blockquote class="callout callout-${cls}"><p><strong>${label} :</strong>`);
  }
  // Tableaux défilants sur mobile, liens externes dans un nouvel onglet.
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
  html = html.replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"');
  return html;
}

const ICONS = {
  'IA & Tech': '<path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2"/><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M10 10h4v4h-4z"/>',
  'Argent & Patrimoine': '<circle cx="12" cy="12" r="8"/><path d="M15 9.5c-.6-1-1.7-1.5-3-1.5-1.9 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.2 2.2-3 2.2-1.4 0-2.6-.6-3.1-1.6M12 6.5v11"/>',
  'Carrière & Business': '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  'Vie numérique': '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/><path d="M10 7.5l2-1.5 2 1.5v3c0 1.2-.9 2.2-2 2.5-1.1-.3-2-1.3-2-2.5z"/>',
  'Maison & Énergie': '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M13 10l-3 5h4l-3 5"/>',
  'Bien-être & Efficacité': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
const icon = (cat, size = 28) => `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[cat] || ICONS['IA & Tech']}</svg>`;
const CAT_CLASS = {
  'IA & Tech': 'cat-ia', 'Argent & Patrimoine': 'cat-argent', 'Carrière & Business': 'cat-carriere',
  'Vie numérique': 'cat-numerique', 'Maison & Énergie': 'cat-maison', 'Bien-être & Efficacité': 'cat-bienetre',
};
const catClass = (cat) => CAT_CLASS[cat] || 'cat-ia';
const cover = (c, extra = '') => `<div class="cover ${catClass(c.category)} ${extra}" aria-hidden="true"><span class="cover-icon">${icon(c.category, 120)}</span><span class="cover-kicker">Masterclass · ${esc(c.duration)}</span><span class="cover-title">${esc(c.title)}</span><span class="cover-brand">Kairos Académie</span></div>`;
const check = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

// ---------- chargement du contenu ----------
const courses = [];
for (const slug of cfg.order) {
  const dir = join(CONTENT, slug);
  const metaFile = join(dir, 'course.json');
  if (!existsSync(metaFile)) { console.warn(`⚠ ${slug} : course.json absent, masterclass ignorée`); continue; }
  let meta;
  try { meta = JSON.parse(readFileSync(metaFile, 'utf8')); } catch (e) { console.warn(`⚠ ${slug} : course.json invalide (${e.message})`); continue; }
  const modDir = join(dir, 'modules');
  const files = existsSync(modDir) ? readdirSync(modDir).filter((f) => f.endsWith('.md')).sort() : [];
  const modules = [];
  let total = 0;
  for (const f of files) {
    const src = readFileSync(join(modDir, f), 'utf8');
    const isBonus = f === 'bonus.md';
    const title = (src.match(/^#\s+(.+)$/m) || [, isBonus ? 'Boîte à outils' : f])[1].trim();
    const w = words(src);
    total += w;
    modules.push({ id: isBonus ? 'bonus' : `m${parseInt(f, 10)}`, file: f, isBonus, title, words: w, md: src, html: md(src.replace(/^#\s+.+$/m, '')) });
  }
  // Le bonus à la fin.
  modules.sort((a, b) => (a.isBonus - b.isBonus) || a.file.localeCompare(b.file));
  courses.push({ ...meta, slug, meta_modules: meta.modules || [], modules, totalWords: total, link: cfg.paymentLinks[slug] || '' });
  console.log(`✓ ${slug} : ${modules.length} fichiers, ${total} mots, ${(meta.quiz || []).length} questions`);
}
const bySlug = Object.fromEntries(courses.map((c) => [c.slug, c]));
const passLink = cfg.paymentLinks['pass-integral'] || '';

// ---------- gabarit ----------
function layout({ title, description, path, body, page, course = '', noindex = false, jsonld = '', scripts = [], og = 'home' }) {
  const url = cfg.siteUrl + path;
  const ogImage = existsSync(join(ROOT, 'src', 'og', `${og}.jpg`)) ? `${cfg.siteUrl}/assets/og/${og}.jpg` : '';
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="${url}">`}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(cfg.brand)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="fr_FR">
${ogImage ? `<meta property="og:image" content="${ogImage}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta name="twitter:card" content="summary_large_image">` : ''}
<meta name="theme-color" content="#14213d">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/style.css">
${jsonld ? `<script type="application/ld+json">${jsonld}</script>` : ''}
</head>
<body data-page="${page}" data-course="${esc(course)}" data-api="${API}">
<a class="skip" href="#contenu">Aller au contenu</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="logo" href="/" aria-label="${esc(cfg.brand)}, accueil"><span class="logo-mark" aria-hidden="true">K</span><span>Kairos <em>Académie</em></span></a>
    <nav class="nav" aria-label="Navigation principale">
      <a href="/#catalogue">Masterclasses</a>
      <a href="/#pass">Pass intégral</a>
      <a href="/certificat/">Certificats</a>
      <a class="btn btn-primary btn-sm nav-cta" href="/#pass">Pass intégral · ${euro(cfg.passPrice)}</a>
      <button class="text-size" type="button" data-text-size aria-label="Agrandir ou réduire le texte">A<span>A</span></button>
    </nav>
  </div>
</header>
<main id="contenu">
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <p class="logo"><span class="logo-mark" aria-hidden="true">K</span><span>Kairos <em>Académie</em></span></p>
      <p class="muted">${esc(cfg.tagline)} Des masterclasses complètes, claires et à jour, au prix d'un livre.</p>
    </div>
    <div>
      <p class="footer-title">Masterclasses</p>
      <ul>${courses.map((c) => `<li><a href="/formations/${c.slug}/">${esc(c.title)}</a></li>`).join('')}</ul>
    </div>
    <div>
      <p class="footer-title">Informations</p>
      <ul>
        <li><a href="/contact/">Contact</a></li>
        <li><a href="/certificat/">Vérifier un certificat</a></li>
        <li><a href="/cgv/">Conditions générales de vente</a></li>
        <li><a href="/mentions-legales/">Mentions légales</a></li>
        <li><a href="/confidentialite/">Confidentialité</a></li>
      </ul>
      <p class="muted small">${esc(cfg.legal.vat)}. Paiement sécurisé par PayPal.</p>
    </div>
  </div>
  <p class="wrap small muted copyright">© ${new Date().getFullYear()} ${esc(cfg.brand)} · ${esc(cfg.legal.editorName)}</p>
</footer>
<script src="/assets/app.js" defer></script>
${scripts.map((s) => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>`;
}

const buyButton = (slug, label, cls = 'btn btn-primary btn-lg') =>
  `<button type="button" class="${cls}" data-buy="${slug}" data-link="${esc(slug === 'pass-integral' ? passLink : (bySlug[slug]?.link || ''))}">${label}</button>`;

const courseCard = (c) => `
<article class="card course-card">
  <a class="cover-link" href="/formations/${c.slug}/" tabindex="-1">${cover(c, 'cover-card')}</a>
  <div class="card-top"><span class="cat">${icon(c.category, 22)} ${esc(c.category)}</span><span class="pill">${esc(c.duration)}</span></div>
  <h3><a href="/formations/${c.slug}/">${esc(c.title)}</a></h3>
  <p>${esc(c.subtitle)}</p>
  <div class="card-bottom"><span class="price">${euro(cfg.price)}</span><a class="btn btn-ghost" href="/formations/${c.slug}/">Découvrir le programme</a></div>
</article>`;

const passBlock = () => `
<section class="pass" id="pass">
  <div class="wrap pass-inner">
    <div>
      <p class="eyebrow">Offre la plus avantageuse</p>
      <h2>Le Pass intégral : les ${courses.length} masterclasses pour ${euro(cfg.passPrice)}</h2>
      <p>Toutes les masterclasses Kairos Académie, présentes et à venir dans ce pack, avec leurs boîtes à outils, leurs quiz et leurs certificats. Acheter les ${courses.length} séparément coûterait ${euro(courses.length * cfg.price)}.</p>
      <ul class="checks">
        <li>${check} Plus de ${Math.round(courses.length * 2.5)} heures de formation, accès à vie</li>
        <li>${check} ${courses.length} certificats de réussite nominatifs et vérifiables</li>
        <li>${check} Idéal à offrir à un parent, un proche ou une équipe</li>
      </ul>
    </div>
    <div class="price-box">
      <p class="price-big">${euro(cfg.passPrice)}</p>
      <p class="muted">au lieu de ${euro(courses.length * cfg.price)} en achats séparés</p>
      ${buyButton('pass-integral', 'Obtenir le Pass intégral')}
      <p class="small muted">Paiement unique · Sans abonnement · PayPal ou carte bancaire</p>
    </div>
  </div>
</section>`;

const checkoutDialog = () => `
<dialog class="checkout" id="checkout" aria-labelledby="checkout-title">
  <form method="dialog" class="checkout-close"><button aria-label="Fermer">×</button></form>
  <h2 id="checkout-title">Votre commande</h2>
  <p class="checkout-product" data-checkout-product></p>
  <div data-checkout-ready>
    <label class="consent"><input type="checkbox" data-consent> <span>Je demande l'accès immédiat au contenu numérique et je reconnais qu'en conséquence je renonce à mon droit de rétractation de 14 jours (article L221-28, 13° du Code de la consommation). J'ai lu les <a href="/cgv/" target="_blank">conditions générales de vente</a>.</span></label>
    <button type="button" class="btn btn-primary btn-lg btn-block" data-pay disabled>Payer en toute sécurité avec PayPal</button>
    <p class="small muted center">Compte PayPal ou carte bancaire. Après le paiement, vous êtes redirigé automatiquement vers votre masterclass.</p>
  </div>
  <div data-checkout-waitlist hidden>
    <p>Le paiement en ligne de cette masterclass ouvre dans quelques heures. Laissez votre e-mail : vous recevez le lien d'achat en priorité.</p>
    <form name="liste-attente" method="POST" action="${API}/merci-message/" data-netlify="true" netlify-honeypot="site-web">
      <input type="hidden" name="form-name" value="liste-attente">
      <input type="hidden" name="masterclass" data-waitlist-course>
      <p hidden><label>Ne pas remplir : <input name="site-web"></label></p>
      <label class="field">Votre e-mail<input type="email" name="email" required autocomplete="email"></label>
      <button class="btn btn-primary btn-block" type="submit">Me prévenir</button>
    </form>
  </div>
</dialog>`;

// ---------- accueil ----------
function homePage() {
  const cats = [...new Set(courses.map((c) => c.category))];
  const body = `
<section class="hero">
  <div class="wrap hero-grid">
  <div class="hero-inner">
    <p class="eyebrow">${courses.length} masterclasses professionnelles · ${euro(cfg.price)} chacune</p>
    <h1>Comprendre les grands sujets du moment. Vraiment. En un après-midi.</h1>
    <p class="lead">IA, arnaques en ligne, épargne, retraite, énergie, carrière, démarches numériques : chaque masterclass Kairos Académie condense ce qu'il faut savoir en 2 h 30 de lecture guidée, d'exercices et de quiz, avec un certificat de réussite à la clé.</p>
    <div class="hero-cta">
      <a class="btn btn-primary btn-lg" href="#catalogue">Voir les masterclasses</a>
      <a class="btn btn-ghost btn-lg" href="#pass">Le Pass intégral à ${euro(cfg.passPrice)}</a>
    </div>
    <ul class="proofs">
      <li>${check} Contenu vérifié et daté (octobre 2026)</li>
      <li>${check} Accès immédiat et à vie</li>
      <li>${check} Certificat de réussite vérifiable</li>
      <li>${check} Texte agrandissable, lecture confortable</li>
    </ul>
  </div>
  <div class="hero-visual" aria-hidden="true">
    ${courses.slice(0, 3).map((c, i) => cover(c, `cover-stack cover-stack-${i}`)).join('')}
    <div class="hero-cert"><p class="cert-mini-brand">Certificat de réussite</p><p class="hero-cert-score">18/20</p><p class="small">Exemple · N° KA-XXXX-XXXX</p></div>
  </div>
  </div>
</section>

<section class="stats-strip" aria-label="Kairos Académie en chiffres">
  <div class="wrap stats-grid">
    <p><strong>${courses.length}</strong><span>masterclasses</span></p>
    <p><strong>${courses.length * 8}</strong><span>modules</span></p>
    <p><strong>${courses.reduce((n, c) => n + (c.quiz || []).length, 0)}</strong><span>questions de quiz corrigées</span></p>
    <p><strong>${Math.round(courses.reduce((n, c) => n + c.totalWords, 0) / 1000)} 000</strong><span>mots de contenu</span></p>
    <p><strong>${euro(cfg.price)}</strong><span>par masterclass, accès à vie</span></p>
  </div>
</section>

<section class="section" id="catalogue">
  <div class="wrap">
    <p class="eyebrow">Le catalogue</p>
    <h2>Choisissez votre masterclass</h2>
    <div class="filters" role="group" aria-label="Filtrer par thème">
      <button type="button" class="chip is-active" data-filter="">Tous les thèmes</button>
      ${cats.map((c) => `<button type="button" class="chip" data-filter="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>
    <div class="grid">
      ${courses.map((c) => courseCard(c).replace('<article class="card course-card">', `<article class="card course-card" data-cat="${esc(c.category)}">`)).join('')}
    </div>
  </div>
</section>

<section class="section alt">
  <div class="wrap">
    <p class="eyebrow">La méthode Kairos</p>
    <h2>Une masterclass, c'est 8 modules, une boîte à outils et un certificat</h2>
    <div class="steps">
      <div class="step"><span class="step-n">1</span><h3>Vous lisez à votre rythme</h3><p>8 modules clairs de 15 à 20 minutes, avec exemples chiffrés, cas pratiques et encadrés « À retenir ». Chaque terme technique est expliqué.</p></div>
      <div class="step"><span class="step-n">2</span><h3>Vous passez à l'action</h3><p>Un exercice concret à la fin de chaque module, et une boîte à outils prête à l'emploi : check-lists, modèles, plan d'action sur 30 jours.</p></div>
      <div class="step"><span class="step-n">3</span><h3>Vous validez vos acquis</h3><p>Un quiz final de 20 questions corrigées. À partir de 16/20, vous obtenez votre certificat de réussite nominatif, vérifiable en ligne.</p></div>
    </div>
  </div>
</section>

${passBlock()}

<section class="section">
  <div class="wrap narrow">
    <p class="eyebrow">Questions fréquentes</p>
    <h2>Avant de commencer</h2>
    ${faqHtml([
      { q: 'Comment se passe l\'achat ?', a: `Vous cliquez sur « Accéder », vous payez ${euro(cfg.price)} via PayPal (compte PayPal ou carte bancaire), puis vous êtes redirigé automatiquement vers votre espace de cours. Pensez à l'ajouter à vos favoris.` },
      { q: 'Dois-je être à l\'aise avec l\'informatique ?', a: 'Non. Les masterclasses se lisent comme un livre, sur ordinateur, tablette ou smartphone. Le bouton « AA » en haut de page agrandit le texte.' },
      { q: 'Le certificat est-il un diplôme ?', a: 'C\'est un certificat de réussite délivré par Kairos Académie après le quiz final. Il atteste de vos acquis mais n\'est pas un diplôme d\'État, n\'est pas inscrit au RNCP et n\'est pas éligible au CPF.' },
      { q: 'Combien de temps ai-je accès ?', a: 'À vie, sans abonnement. Vous pouvez relire les modules et repasser le quiz autant de fois que vous le souhaitez.' },
      { q: 'Puis-je offrir une masterclass ?', a: 'Oui : achetez-la puis transmettez le lien d\'accès à la personne de votre choix. Le Pass intégral est particulièrement apprécié en cadeau.' },
    ])}
  </div>
</section>

<section class="section alt">
  <div class="wrap narrow center">
    <h2>Recevez nos nouvelles masterclasses</h2>
    <p>Un e-mail par mois au plus, avec les nouveautés et les mises à jour importantes. Désinscription en un clic.</p>
    <form class="inline-form" name="newsletter" method="POST" action="${API}/merci-message/" data-netlify="true" netlify-honeypot="site-web">
      <input type="hidden" name="form-name" value="newsletter">
      <p hidden><label>Ne pas remplir : <input name="site-web"></label></p>
      <label class="sr-only" for="nl-email">Votre e-mail</label>
      <input id="nl-email" type="email" name="email" placeholder="votre@email.fr" required autocomplete="email">
      <button class="btn btn-primary" type="submit">Je m'inscris</button>
    </form>
  </div>
</section>
${checkoutDialog()}`;
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'EducationalOrganization', name: cfg.brand, url: cfg.siteUrl, slogan: cfg.tagline,
  });
  write('index.html', layout({
    title: `${cfg.brand} · Masterclasses en ligne à ${euro(cfg.price)} : IA, argent, retraite, numérique`,
    description: `${courses.length} masterclasses professionnelles de 2 h 30 à ${euro(cfg.price)} : IA, cybersécurité, épargne, retraite, énergie, LinkedIn. Accès à vie et certificat de réussite.`,
    path: '/', page: 'home', body, jsonld,
  }));
}

function faqHtml(items) {
  return `<div class="faq">${items.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>`;
}

// ---------- page de vente ----------
function excerpt(c) {
  const m1 = c.modules.find((m) => m.id === 'm1');
  if (!m1) return '';
  const lines = m1.md.replace(/^#\s+.+$/m, '').split('\n');
  const out = [];
  let count = 0;
  for (const line of lines) {
    out.push(line);
    count += line.split(/\s+/).filter(Boolean).length;
    if (count > 420 && line.trim() === '') break;
  }
  return md(out.join('\n'));
}

function salesPage(c) {
  const others = courses.filter((o) => o.slug !== c.slug).slice(0, 3);
  const body = `
<section class="hero hero-course">
  <div class="wrap hero-course-inner">
    <div>
      <p class="breadcrumb"><a href="/">Accueil</a> › <a href="/#catalogue">Masterclasses</a> › ${esc(c.category)}</p>
      <p class="eyebrow">${icon(c.category, 20)} Masterclass · ${esc(c.category)}</p>
      <h1>${esc(c.title)}</h1>
      <p class="lead">${esc(c.subtitle)}</p>
      <p>${esc(c.promise)}</p>
      <ul class="facts">
        <li><strong>${esc(c.duration)}</strong><span>de formation</span></li>
        <li><strong>8 modules</strong><span>+ boîte à outils</span></li>
        <li><strong>20 questions</strong><span>quiz corrigé</span></li>
        <li><strong>Certificat</strong><span>de réussite</span></li>
      </ul>
    </div>
    <aside class="price-box sticky-box" aria-label="Acheter">
      ${cover(c, 'cover-box')}
      <p class="price-big">${euro(cfg.price)}</p>
      <p class="muted">Paiement unique · accès immédiat et à vie</p>
      ${buyButton(c.slug, 'Accéder à la masterclass')}
      <ul class="checks small">
        <li>${check} ${esc(c.level)}</li>
        <li>${check} Lecture sur ordinateur, tablette, smartphone</li>
        <li>${check} Contenu à jour (octobre 2026)</li>
        <li>${check} PayPal ou carte bancaire</li>
      </ul>
      <p class="small"><a href="#pass">Ou les ${courses.length} masterclasses pour ${euro(cfg.passPrice)}</a></p>
    </aside>
  </div>
</section>

<section class="section">
  <div class="wrap two-col">
    <div>
      <p class="eyebrow">Vous vous reconnaissez ?</p>
      <h2>Cette masterclass est faite pour vous si…</h2>
      <ul class="pains">${(c.pain_points || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    </div>
    <div>
      <p class="eyebrow">Pour qui</p>
      <h2>Pensée pour</h2>
      <ul class="checks">${(c.audience || []).map((a) => `<li>${check} ${esc(a)}</li>`).join('')}</ul>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="wrap">
    <p class="eyebrow">Résultats</p>
    <h2>À la fin de la masterclass, vous saurez</h2>
    <ul class="outcomes">${(c.outcomes || []).map((o) => `<li>${check}<span>${esc(o)}</span></li>`).join('')}</ul>
  </div>
</section>

<section class="section" id="programme">
  <div class="wrap narrow">
    <p class="eyebrow">Le programme</p>
    <h2>8 modules progressifs</h2>
    <ol class="programme">
      ${(c.meta_modules || []).map((m) => `<li><div class="prog-head"><span class="prog-n">${m.n}</span><h3>${esc(m.title)}</h3><span class="pill">${esc(m.duration)}</span></div><p>${esc(m.summary)}</p></li>`).join('')}
    </ol>
    <h3 class="bonus-title">Inclus en bonus</h3>
    <ul class="bonuses">${(c.bonuses || []).map((b) => `<li><strong>${esc(b.title)}</strong><span>${esc(b.description)}</span></li>`).join('')}</ul>
  </div>
</section>

<section class="section alt" id="extrait">
  <div class="wrap narrow">
    <p class="eyebrow">Extrait gratuit</p>
    <h2>Lisez le début du module 1</h2>
    <div class="excerpt prose">${excerpt(c)}<div class="excerpt-fade"></div></div>
    <div class="center">${buyButton(c.slug, `Lire la suite · ${euro(cfg.price)}`)}</div>
  </div>
</section>

<section class="section">
  <div class="wrap two-col cert-promo">
    <div>
      <p class="eyebrow">Certificat</p>
      <h2>Validez vos acquis</h2>
      <p>Le quiz final comporte 20 questions de compréhension, corrigées et expliquées. À partir de 16/20, vous générez votre <strong>certificat de réussite nominatif</strong>, avec un identifiant unique vérifiable sur notre site. Ajoutez-le à votre CV ou à votre profil LinkedIn.</p>
      <p class="small muted">Certificat délivré par Kairos Académie. Il ne s'agit pas d'un diplôme d'État ni d'une certification inscrite au RNCP.</p>
    </div>
    <div class="cert-mini" aria-hidden="true">
      <p class="cert-mini-brand">Kairos Académie</p>
      <p class="cert-mini-title">Certificat de réussite</p>
      <p class="cert-mini-name">Votre nom</p>
      <p class="cert-mini-course">${esc(c.title)}</p>
      <p class="cert-mini-id">N° KA-XXXX-XXXX</p>
    </div>
  </div>
</section>

<section class="section alt">
  <div class="wrap narrow">
    <p class="eyebrow">Questions fréquentes</p>
    <h2>Tout ce que vous voulez savoir</h2>
    ${faqHtml(c.faq || [])}
    ${c.disclaimer ? `<p class="disclaimer small">${esc(c.disclaimer)}</p>` : ''}
    <div class="center final-cta">
      ${buyButton(c.slug, `Commencer maintenant · ${euro(cfg.price)}`)}
      <p class="small muted">Accès immédiat après paiement · ${esc(cfg.legal.vat)}</p>
    </div>
  </div>
</section>

${passBlock()}

<section class="section">
  <div class="wrap">
    <h2>Les autres masterclasses</h2>
    <div class="grid">${others.map(courseCard).join('')}</div>
  </div>
</section>

<div class="mobile-buy">${buyButton(c.slug, `Accéder · ${euro(cfg.price)}`, 'btn btn-primary btn-block')}</div>
${checkoutDialog()}`;
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Course', name: c.title, description: c.subtitle, inLanguage: 'fr',
    provider: { '@type': 'Organization', name: cfg.brand, sameAs: cfg.siteUrl },
    offers: { '@type': 'Offer', price: String(cfg.price), priceCurrency: 'EUR', availability: 'https://schema.org/InStock', category: 'Paid', url: `${cfg.siteUrl}/formations/${c.slug}/` },
    hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online', courseWorkload: 'PT2H30M' },
  });
  write(`formations/${c.slug}/index.html`, layout({
    title: c.seo?.title ? `${c.seo.title} · ${cfg.brand}` : `${c.title} · ${cfg.brand}`,
    description: c.seo?.description || c.subtitle, path: `/formations/${c.slug}/`, page: 'sales', course: c.slug, body, jsonld, og: c.slug,
  }));
}

// ---------- espace de cours ----------
function coursePage(c, token) {
  const mods = c.modules;
  const quiz = (c.quiz || []).map((q) => ({ q: q.q, choices: q.choices, answer: q.answer, explanation: q.explanation }));
  const body = `
<div class="read-bar" aria-hidden="true"><span data-read-bar></span></div>
<div class="course-app" data-slug="${c.slug}" data-token="${token}" data-title="${esc(c.title)}" data-duration="${esc(c.duration)}">
  <aside class="course-nav" aria-label="Sommaire de la masterclass">
    <p class="course-nav-title">${esc(c.title)}</p>
    <div class="progress" aria-hidden="true"><span data-progress-bar></span></div>
    <p class="small muted" data-progress-text>0 module terminé sur ${mods.filter((m) => !m.isBonus).length}</p>
    <ol>
      <li><a href="#accueil" data-nav="accueil">Bienvenue</a></li>
      ${mods.map((m) => `<li><a href="#${m.id}" data-nav="${m.id}"><span class="nav-check" aria-hidden="true"></span>${esc(m.title.replace(/^Module\s+\d+\s*[—–-]\s*/, ''))}</a></li>`).join('')}
      <li><a href="#quiz" data-nav="quiz">Quiz final</a></li>
      <li><a href="#certificat" data-nav="certificat">Mon certificat</a></li>
    </ol>
  </aside>
  <div class="course-main">
    <section class="lesson" id="accueil" data-section>
      <p class="eyebrow">Votre masterclass</p>
      <h1>${esc(c.title)}</h1>
      <p class="lead">${esc(c.subtitle)}</p>
      <div class="callout callout-astuce"><p><strong>Bienvenue !</strong> Ajoutez cette page à vos favoris : c'est votre accès personnel et à vie. Votre progression est enregistrée sur cet appareil. Le bouton « AA » en haut agrandit le texte.</p></div>
      <h2>Comment suivre la masterclass</h2>
      <ol>
        <li>Lisez les 8 modules dans l'ordre (15 à 20 minutes chacun) et faites l'exercice pratique de fin de module.</li>
        <li>Gardez la <a href="#bonus">Boîte à outils</a> sous la main : check-lists, modèles et plan d'action.</li>
        <li>Passez le <a href="#quiz">quiz final</a> : 16/20 ou plus et vous obtenez votre certificat de réussite.</li>
      </ol>
      <h2>Au programme</h2>
      <ul class="checks">${(c.outcomes || []).map((o) => `<li>${check} ${esc(o)}</li>`).join('')}</ul>
      ${c.disclaimer ? `<p class="disclaimer small">${esc(c.disclaimer)}</p>` : ''}
      <form class="keep-link" name="acheteurs" method="POST" action="${API}/merci-message/" data-netlify="true" netlify-honeypot="site-web">
        <input type="hidden" name="form-name" value="acheteurs">
        <input type="hidden" name="masterclass" value="${c.slug}">
        <p hidden><label>Ne pas remplir : <input name="site-web"></label></p>
        <p><strong>Recevoir ce lien d'accès par e-mail</strong> (utile pour changer d'appareil ou si vous perdez vos favoris) :</p>
        <div class="inline-form"><label class="sr-only" for="kl-email">Votre e-mail</label><input id="kl-email" type="email" name="email" placeholder="votre@email.fr" required autocomplete="email"><button class="btn btn-ghost" type="submit">Envoyer</button></div>
      </form>
      <p class="welcome-actions"><a class="btn btn-primary btn-lg" href="#m1" data-resume>Commencer le module 1</a></p>
    </section>
    ${mods.map((m, i) => {
      const next = mods[i + 1];
      return `<section class="lesson prose" id="${m.id}" data-section hidden>
      <p class="eyebrow">${m.isBonus ? 'Bonus' : `Module ${i + 1} sur ${mods.filter((x) => !x.isBonus).length}`} · environ ${Math.max(5, Math.round(m.words / 200))} min de lecture</p>
      <h1>${esc(m.title)}</h1>
      ${m.html}
      <div class="lesson-end">
        <a class="btn btn-ghost" href="#${i === 0 ? 'accueil' : mods[i - 1].id}">← ${i === 0 ? 'Sommaire' : 'Précédent'}</a>
        ${m.isBonus ? '' : `<button type="button" class="btn btn-primary" data-complete="${m.id}" data-next="${next ? next.id : 'quiz'}">J'ai terminé ce module · ${next ? 'suite' : 'quiz final'} →</button>`}
        ${m.isBonus ? '<a class="btn btn-primary" href="#quiz">Passer au quiz final →</a>' : ''}
        <button type="button" class="btn btn-ghost" data-print>Imprimer ce module</button>
      </div>
    </section>`;
    }).join('\n')}
    <section class="lesson" id="quiz" data-section hidden>
      <p class="eyebrow">Évaluation finale</p>
      <h1>Quiz final · 20 questions</h1>
      <p>Une seule bonne réponse par question. Il faut 16 bonnes réponses sur 20 pour obtenir le certificat. Vous pouvez recommencer autant de fois que nécessaire.</p>
      <form data-quiz-form></form>
      <div data-quiz-result aria-live="polite"></div>
    </section>
    <section class="lesson" id="certificat" data-section hidden>
      <p class="eyebrow">Certificat de réussite</p>
      <h1>Votre certificat</h1>
      <div data-cert-locked><p>Votre certificat se débloque après le quiz final (16/20 minimum).</p><p><a class="btn btn-primary" href="#quiz">Passer le quiz</a></p></div>
      <div data-cert-form hidden>
        <p>Félicitations ! Indiquez votre nom tel qu'il doit apparaître sur le certificat. Il sera enregistré pour permettre la vérification en ligne.</p>
        <form class="inline-form" data-cert-name-form>
          <label class="sr-only" for="cert-name">Prénom et nom</label>
          <input id="cert-name" name="name" required maxlength="80" placeholder="Prénom Nom" autocomplete="name">
          <button class="btn btn-primary" type="submit">Générer mon certificat</button>
        </form>
      </div>
      <div data-cert-output hidden></div>
    </section>
  </div>
</div>
<script type="application/json" id="quiz-data">${JSON.stringify(quiz).replace(/</g, '\\u003c')}</script>`;
  write(`acces/${c.slug}-${token}/index.html`, layout({
    title: `${c.title} · Mon espace · ${cfg.brand}`, description: c.subtitle, path: `/acces/${c.slug}-${token}/`,
    page: 'course', course: c.slug, body, noindex: true, scripts: ['/assets/course.js'],
  }));
}

function passPage(token) {
  const body = `
<section class="section">
  <div class="wrap">
    <p class="eyebrow">Pass intégral</p>
    <h1>Bienvenue dans votre Pass intégral</h1>
    <p class="lead">Merci pour votre confiance. Voici vos ${courses.length} masterclasses. Ajoutez cette page à vos favoris : c'est votre accès personnel et à vie.</p>
    <div class="grid">
      ${courses.filter((c) => tokens[c.slug]).map((c) => `<article class="card course-card"><div class="card-top"><span class="cat">${icon(c.category, 22)} ${esc(c.category)}</span><span class="pill">${esc(c.duration)}</span></div><h3>${esc(c.title)}</h3><p>${esc(c.subtitle)}</p><div class="card-bottom"><a class="btn btn-primary" href="/acces/${c.slug}-${tokens[c.slug]}/">Ouvrir la masterclass</a></div></article>`).join('')}
    </div>
    <form class="keep-link" name="acheteurs" method="POST" action="${API}/merci-message/" data-netlify="true" netlify-honeypot="site-web">
      <input type="hidden" name="form-name" value="acheteurs">
      <input type="hidden" name="masterclass" value="pass-integral">
      <p hidden><label>Ne pas remplir : <input name="site-web"></label></p>
      <p><strong>Recevoir ce lien d'accès par e-mail :</strong></p>
      <div class="inline-form"><label class="sr-only" for="kp-email">Votre e-mail</label><input id="kp-email" type="email" name="email" placeholder="votre@email.fr" required autocomplete="email"><button class="btn btn-ghost" type="submit">Envoyer</button></div>
    </form>
  </div>
</section>`;
  write(`acces/pass-integral-${token}/index.html`, layout({
    title: `Pass intégral · Mon espace · ${cfg.brand}`, description: 'Vos masterclasses Kairos Académie.', path: `/acces/pass-integral-${token}/`,
    page: 'pass', course: 'pass-integral', body, noindex: true,
  }));
}

// ---------- pages simples ----------
function simplePage(path, title, description, inner, page = 'info', extra = {}) {
  write(`${path.replace(/^\//, '')}index.html`, layout({
    title: `${title} · ${cfg.brand}`, description, path, page, ...extra,
    body: `<section class="section"><div class="wrap narrow prose">${inner}</div></section>`,
  }));
}

const L = cfg.legal;
const v = (x) => (x === TODO ? `<mark>[${TODO}]</mark>` : esc(x));

function legalPages() {
  simplePage('/mentions-legales/', 'Mentions légales', 'Mentions légales du site Kairos Académie.', `
<h1>Mentions légales</h1>
<h2>Éditeur du site</h2>
<p>${v(L.editorName)}, ${v(L.status)}<br>Adresse : ${v(L.address)}<br>SIREN : ${v(L.siren)}<br>E-mail : ${v(L.email)} · Téléphone : ${v(L.phone)}<br>${esc(L.vat)}</p>
<p>Directeur de la publication : ${v(L.publicationDirector)}.</p>
<h2>Hébergeur</h2>
<p>${esc(L.host)}</p>
<h2>Propriété intellectuelle</h2>
<p>L'ensemble des contenus du site et des masterclasses (textes, structure, quiz, modèles, marque « Kairos Académie ») est protégé par le droit d'auteur. Toute reproduction ou diffusion sans autorisation écrite est interdite.</p>
<h2>Nature des contenus</h2>
<p>Les masterclasses ont une vocation pédagogique et d'information générale. Elles ne constituent ni un conseil financier, juridique, fiscal ou médical personnalisé. Pour une situation particulière, consultez un professionnel habilité.</p>
<p class="small muted">Dernière mise à jour : ${esc(L.lastUpdated)}.</p>`, 'legal');

  simplePage('/cgv/', 'Conditions générales de vente', 'Conditions générales de vente des masterclasses Kairos Académie.', `
<h1>Conditions générales de vente</h1>
<p class="small muted">En vigueur au ${esc(L.lastUpdated)}.</p>
<h2>1. Objet et vendeur</h2>
<p>Les présentes conditions régissent la vente des masterclasses en ligne proposées sur ${esc(cfg.siteUrl)} par ${v(L.editorName)}, ${v(L.status)}, SIREN ${v(L.siren)}, ${v(L.address)} (ci-après « Kairos Académie »), à toute personne (ci-après « le Client »).</p>
<h2>2. Produits</h2>
<p>Chaque masterclass est un contenu numérique fourni sans support matériel : 8 modules écrits, une boîte à outils, un quiz final et, en cas de réussite (16/20 minimum), un certificat de réussite. La durée indiquée (environ 2 h 30) est une estimation du temps de lecture et d'exercices. Le Pass intégral donne accès à l'ensemble des masterclasses listées sur la page de l'offre au jour de l'achat.</p>
<p>Le certificat de réussite est délivré par Kairos Académie. Il n'est ni un diplôme, ni un titre inscrit au Répertoire national des certifications professionnelles (RNCP), ni une formation éligible au Compte personnel de formation (CPF).</p>
<h2>3. Prix</h2>
<p>Les prix sont indiqués en euros toutes taxes comprises : ${euro(cfg.price)} par masterclass, ${euro(cfg.passPrice)} pour le Pass intégral. ${esc(L.vat)}. Le prix applicable est celui affiché au moment de la commande.</p>
<h2>4. Commande et paiement</h2>
<p>La commande est passée en cliquant sur le bouton d'achat, en cochant la case de demande d'exécution immédiate, puis en réglant le prix via PayPal (compte PayPal ou carte bancaire). Le paiement est exigible immédiatement. Les données de paiement sont traitées exclusivement par PayPal ; Kairos Académie n'y a jamais accès.</p>
<h2>5. Accès au contenu</h2>
<p>Après paiement, le Client est redirigé vers son espace de cours. L'accès est personnel, sans limitation de durée tant que le site est exploité ; en cas d'arrêt du service, Kairos Académie s'engage à prévenir les clients au moins 3 mois à l'avance et à leur permettre de télécharger ou d'imprimer leurs contenus. En cas de perte du lien d'accès, le Client peut écrire via la <a href="/contact/">page contact</a> en indiquant la référence de sa transaction PayPal.</p>
<h2>6. Droit de rétractation</h2>
<p>Conformément à l'article L221-28, 13° du Code de la consommation, le droit de rétractation ne peut être exercé pour la fourniture d'un contenu numérique sans support matériel dont l'exécution a commencé après accord préalable exprès du consommateur et renoncement exprès à son droit de rétractation. Avant le paiement, le Client demande expressément l'accès immédiat et reconnaît renoncer à son droit de rétractation en cochant la case prévue. La confirmation de cet accord figure sur la page d'accès et peut être demandée par écrit.</p>
<h2>7. Licence d'utilisation</h2>
<p>L'achat confère au Client une licence personnelle, non exclusive et non transférable de consultation. Il peut offrir son achat à un proche en lui transmettant son lien ; toute revente, diffusion publique ou partage collectif du lien ou du contenu est interdit.</p>
<h2>8. Responsabilité</h2>
<p>Les masterclasses sont rédigées avec soin et vérifiées à la date indiquée, mais les règles (fiscales, sociales, techniques) évoluent. Elles constituent une information générale et non un conseil personnalisé. Kairos Académie ne saurait être tenue responsable des décisions prises sur leur seul fondement.</p>
<h2>9. Données personnelles</h2>
<p>Voir la <a href="/confidentialite/">politique de confidentialité</a>.</p>
<h2>10. Réclamations et médiation</h2>
<p>Pour toute réclamation, contactez-nous via la <a href="/contact/">page contact</a>. Nous répondons sous 72 heures ouvrées. En cas de litige non résolu, le Client peut recourir gratuitement au médiateur de la consommation : ${v(L.mediatorName)} (${v(L.mediatorWebsite)}). La plateforme européenne de règlement en ligne des litiges ayant été fermée en juillet 2025, le recours se fait directement auprès du médiateur.</p>
<h2>11. Droit applicable</h2>
<p>Les présentes conditions sont soumises au droit français. À défaut de résolution amiable, les tribunaux français sont compétents, sous réserve des règles protectrices du consommateur.</p>`, 'legal');

  simplePage('/confidentialite/', 'Politique de confidentialité', 'Comment Kairos Académie traite vos données personnelles.', `
<h1>Politique de confidentialité</h1>
<p class="small muted">Dernière mise à jour : ${esc(L.lastUpdated)}.</p>
<h2>Responsable du traitement</h2>
<p>${v(L.editorName)}, ${v(L.address)}, ${v(L.email)}.</p>
<h2>Données traitées</h2>
<ul>
<li><strong>Mesure d'audience</strong> : pages consultées, masterclass concernée, site d'origine (référent ou paramètre utm), pays déduit de la connexion, type d'appareil, et un identifiant de session aléatoire conservé dans l'onglet du navigateur (sessionStorage) et effacé à sa fermeture. Aucune adresse IP n'est enregistrée, aucun cookie publicitaire ni outil tiers n'est utilisé. Finalité : mesurer la fréquentation et améliorer le site. Base légale : intérêt légitime. Ces données sont conservées 13 mois au plus.</li>
<li><strong>Paiement</strong> : traité par PayPal (Europe) S.à r.l. et Cie, S.C.A., responsable de traitement pour ses propres opérations. Nous recevons de PayPal le nom, l'adresse e-mail et le détail de la transaction, conservés 10 ans au titre des obligations comptables.</li>
<li><strong>Certificats</strong> : nom saisi, masterclass, score et date, conservés tant que le certificat doit rester vérifiable.</li>
<li><strong>Formulaires</strong> (contact, liste d'attente, nouvelles masterclasses, envoi du lien d'accès) : adresse e-mail et message, conservés 3 ans après le dernier contact. Vous pouvez vous désinscrire à tout moment.</li>
</ul>
<h2>Destinataires et hébergement</h2>
<p>Les données sont hébergées par Netlify, Inc. (États-Unis), qui adhère au cadre de protection des données UE–États-Unis (Data Privacy Framework). Elles ne sont ni vendues ni cédées.</p>
<h2>Vos droits</h2>
<p>Vous disposez d'un droit d'accès, de rectification, d'effacement, d'opposition et de limitation. Écrivez-nous via la <a href="/contact/">page contact</a>. Vous pouvez introduire une réclamation auprès de la CNIL (www.cnil.fr).</p>`, 'legal');

  simplePage('/contact/', 'Contact', 'Contacter Kairos Académie.', `
<h1>Nous contacter</h1>
<p>Une question avant l'achat, un lien d'accès perdu, une suggestion ? Écrivez-nous, nous répondons sous 72 heures ouvrées. En cas de lien perdu, indiquez la référence de votre transaction PayPal.</p>
<form class="stack-form" name="contact" method="POST" action="${API}/merci-message/" data-netlify="true" netlify-honeypot="site-web">
  <input type="hidden" name="form-name" value="contact">
  <p hidden><label>Ne pas remplir : <input name="site-web"></label></p>
  <label class="field">Votre nom<input name="nom" required autocomplete="name"></label>
  <label class="field">Votre e-mail<input type="email" name="email" required autocomplete="email"></label>
  <label class="field">Sujet<select name="sujet"><option>Question avant achat</option><option>Lien d'accès perdu</option><option>Certificat</option><option>Facture</option><option>Autre</option></select></label>
  <label class="field">Message<textarea name="message" rows="6" required></textarea></label>
  <button class="btn btn-primary btn-lg" type="submit">Envoyer le message</button>
</form>`, 'contact');

  simplePage('/merci-message/', 'Message reçu', 'Merci pour votre message.', `
<h1>Merci, c'est bien reçu</h1>
<p>Votre demande a été enregistrée. Si elle appelle une réponse, nous vous écrivons sous 72 heures ouvrées.</p>
<p><a class="btn btn-primary" href="/">Retour à l'accueil</a></p>`, 'thanks', { noindex: true });

  simplePage('/certificat/', 'Vérifier un certificat', 'Vérifiez l\'authenticité d\'un certificat de réussite Kairos Académie.', `
<h1>Vérifier un certificat</h1>
<p>Chaque certificat de réussite Kairos Académie porte un numéro unique. Saisissez-le pour vérifier son authenticité.</p>
<form class="inline-form" data-verify-form>
  <label class="sr-only" for="cert-id">Numéro du certificat</label>
  <input id="cert-id" name="id" placeholder="KA-XXXX-XXXX" required pattern="KA-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}" autocomplete="off">
  <button class="btn btn-primary" type="submit">Vérifier</button>
</form>
<div data-verify-result aria-live="polite"></div>`, 'cert', { scripts: ['/assets/verify.js'] });

  write('404.html', layout({
    title: `Page introuvable · ${cfg.brand}`, description: 'Page introuvable.', path: '/404', page: '404', noindex: true,
    body: '<section class="section"><div class="wrap narrow center"><h1>Page introuvable</h1><p>Cette page n\'existe pas ou a été déplacée.</p><p><a class="btn btn-primary" href="/">Voir les masterclasses</a></p></div></section>',
  }));

  if (!MIRROR) write('admin/index.html', `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Tableau de bord · ${esc(cfg.brand)}</title><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/style.css"><link rel="stylesheet" href="/assets/admin.css"></head><body class="admin" data-page="admin"><main id="admin" class="wrap"><h1>Tableau de bord</h1><form class="inline-form" data-login><label class="sr-only" for="pw">Mot de passe</label><input id="pw" type="password" placeholder="Mot de passe administrateur" required autocomplete="current-password"><button class="btn btn-primary" type="submit">Ouvrir</button></form><div data-dash hidden></div></main><script src="/assets/admin.js" defer></script></body></html>`);
}

// ---------- assemblage ----------
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(ROOT, 'src'), join(DIST, 'assets'), { recursive: true });

homePage();
for (const c of courses) {
  salesPage(c);
  if (tokens[c.slug] && !MIRROR) coursePage(c, tokens[c.slug]);
}
if (tokens['pass-integral'] && !MIRROR) passPage(tokens['pass-integral']);
legalPages();

write('assets/catalog.json', JSON.stringify(Object.fromEntries(courses.map((c) => [c.slug, { title: c.title, category: c.category, duration: c.duration }]))));
write('robots.txt', `User-agent: *\nDisallow: /acces/\nDisallow: /admin/\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);
const urls = ['/', ...courses.map((c) => `/formations/${c.slug}/`), '/certificat/', '/contact/', '/cgv/', '/mentions-legales/', '/confidentialite/'];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${cfg.siteUrl}${u}</loc></url>`).join('\n')}\n</urlset>\n`);

console.log(`\n${courses.length} masterclasses, ${courses.reduce((n, c) => n + c.totalWords, 0)} mots au total → ${DIST_DIR}/`);
const missingLinks = ['pass-integral', ...courses.map((c) => c.slug)].filter((s) => !cfg.paymentLinks[s]);
if (missingLinks.length) console.warn(`⚠ Liens de paiement PayPal manquants (liste d'attente affichée à la place) : ${missingLinks.join(', ')}`);
