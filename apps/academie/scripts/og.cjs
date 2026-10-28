// Génère les images de partage (1200 × 630) dans src/og/ : node scripts/og.cjs (Playwright requis, en local).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const css = fs.readFileSync(path.join(ROOT, 'src', 'style.css'), 'utf8');
const CAT = { 'IA & Tech': 'cat-ia', 'Argent & Patrimoine': 'cat-argent', 'Carrière & Business': 'cat-carriere', 'Vie numérique': 'cat-numerique', 'Maison & Énergie': 'cat-maison', 'Bien-être & Efficacité': 'cat-bienetre' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const courses = cfg.order.map((s) => path.join(ROOT, 'content', s, 'course.json')).filter(fs.existsSync).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));

const card = (cls, kicker, title, sub) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}
body{margin:0;width:1200px;height:630px;background:#14213d}
.og{width:1200px;height:630px;aspect-ratio:auto;border-radius:0;padding:64px 72px;gap:18px}
.og .cover-kicker{font-size:22px}.og .cover-title{font-size:64px;line-height:1.08;max-width:960px}
.og .cover-icon{right:40px;top:40px}.og .cover-icon svg{width:300px;height:300px}
.og .sub{font:500 28px/1.35 var(--sans);color:rgba(255,255,255,.88);max-width:900px}
.og .row{display:flex;gap:18px;align-items:center;margin-top:14px}
.og .price{background:var(--gold);color:#14213d;font:800 30px/1 var(--sans);padding:14px 22px;border-radius:999px}
.og .brand{font:700 26px/1 var(--serif);color:#fff}.og .brand em{font-style:normal;color:var(--gold)}
</style></head><body><div class="cover og ${cls}"><span class="cover-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="9"/></svg></span>
<span class="cover-kicker">${esc(kicker)}</span><span class="cover-title">${esc(title)}</span><span class="sub">${esc(sub)}</span>
<div class="row"><span class="price">${esc(cfg.price)} € · accès à vie</span><span class="brand">Kairos <em>Académie</em></span></div></div></body></html>`;

(async () => {
  const out = path.join(ROOT, 'src', 'og');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const jobs = [['home', card('cat-ia', `${courses.length} masterclasses · certificat de réussite`, 'Comprendre les grands sujets du moment, en un après-midi', 'IA, arnaques en ligne, épargne, retraite, énergie, carrière, démarches numériques.')]];
  for (const c of courses) jobs.push([c.slug, card(CAT[c.category] || 'cat-ia', `Masterclass · ${c.duration} · ${c.category}`, c.title, c.subtitle)]);
  for (const [name, html] of jobs) {
    await page.setContent(html);
    await page.screenshot({ path: path.join(out, `${name}.jpg`), type: 'jpeg', quality: 86 });
  }
  await browser.close();
  console.log(`${jobs.length} images → src/og/`);
})();
