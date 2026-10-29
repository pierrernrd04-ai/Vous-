// Parcours complet d'Encré dans Chromium : notes vocales de Do It, page née d'une note,
// éditeur (raccourcis Markdown, menu « / », cases, surlignage, Retenir), onglets,
// dossiers, mémoire, dictée simulée, synchro avec Do It, persistance, bureau.
// Usage : npm run smoke:encre                 (vérifications seules)
//         npm run smoke:encre -- --shots       (+ docs/screenshots-encre/)
//         npm run smoke:encre -- --shots --video  (+ vidéo de démonstration)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir, rename, readdir, rm } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = fileURLToPath(new URL('../public/', import.meta.url));
const shotsDir = fileURLToPath(new URL('../docs/screenshots-encre/', import.meta.url));
const SHOTS = process.argv.includes('--shots');
const VIDEO = process.argv.includes('--video');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const file = join(root, path.endsWith('/') ? `${path}index.html` : path);
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://localhost:${server.address().port}`;

const fakeSpeech = () => {
  const mk = (transcript, isFinal) => Object.assign([{ transcript, confidence: 0.9 }], { isFinal });
  class FakeRecognition {
    start() {
      const phrases = [...(window.__phrases || ['bonjour'])];
      const finals = [];
      const step = () => {
        if (this.stopped || !phrases.length) return;
        const p = phrases.shift();
        this.onresult?.({ results: [...finals, mk(p, false)] });
        setTimeout(() => {
          if (this.stopped) return;
          finals.push(mk(p, true));
          this.onresult?.({ results: [...finals] });
          setTimeout(step, 250);
        }, 250);
      };
      setTimeout(step, 200);
    }
    stop() { this.stopped = true; setTimeout(() => this.onend?.(), 40); }
    abort() { this.stopped = true; setTimeout(() => this.onend?.(), 10); }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
};

const now = Date.now();
const iso = (h) => new Date(now - h * 3600e3).toISOString();
const NOTES = [
  {
    id: 'n-run', createdAt: iso(2), updatedAt: iso(2), segments: [{ text: 'euh ce matin je suis allé courir dix kilomètres…', at: iso(2), duration: 64 }],
    title: 'Dix kilomètres avant le travail', text: 'Ce matin, j’ai couru dix kilomètres avant d’aller travailler. Les premiers kilomètres étaient difficiles, puis j’ai trouvé mon rythme.\n\nJe me suis senti fier et plein d’énergie toute la matinée.',
    summary: 'J’ai couru dix kilomètres avant le travail et je me suis senti plein d’énergie.', highlights: ['10 km avant le travail', 'Rythme trouvé après un départ difficile'],
    themes: ['sport', 'humeur'], mood: 'excellent', followUp: 'Quel sera ton prochain objectif de course ?', source: 'ai', pending: false, edited: false, style: 'professionnel',
  },
  {
    id: 'n-idea', createdAt: iso(26), updatedAt: iso(26), segments: [{ text: 'j’ai eu une idée de projet…', at: iso(26), duration: 95 }],
    title: 'L’idée d’un carnet de recettes', text: 'J’ai envie de rassembler les recettes de ma grand-mère dans un carnet illustré. Je pourrais commencer par les desserts du dimanche.',
    summary: 'Je veux créer un carnet illustré des recettes de ma grand-mère.', highlights: [], themes: ['projets', 'famille'], mood: 'bon', followUp: 'Par quelle recette commencerais-tu ?', source: 'ai', pending: false, edited: false, style: 'professionnel',
  },
  {
    id: 'n-night', createdAt: iso(50), updatedAt: iso(50), segments: [{ text: 'soirée avec les potes…', at: iso(50), duration: 40 }],
    title: 'Une soirée trop longue', text: 'Soirée avec mes amis, trois bières et un coucher à deux heures. Je suis fatigué aujourd’hui.',
    summary: 'Une soirée tardive avec mes amis m’a fatigué.', highlights: [], themes: ['amis', 'alcool', 'sommeil'], mood: 'bas', followUp: 'Qu’est-ce que tu ferais différemment ?', source: 'ai', pending: false, edited: false, style: 'professionnel',
  },
];

const videoDir = fileURLToPath(new URL('../docs/.video-tmp/', import.meta.url));
const browser = await chromium.launch({ slowMo: VIDEO ? 40 : 0 });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
  colorScheme: 'dark',
  ...(VIDEO ? { recordVideo: { dir: videoDir, size: { width: 390, height: 844 } } } : {}),
});
await context.addInitScript(fakeSpeech);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error' && !/fonts\.(googleapis|gstatic)|Failed to load resource/.test(msg.text())) errors.push(msg.text());
});

const pause = (ms) => page.waitForTimeout(VIDEO ? ms : Math.min(ms, 150));
const typeSlow = (text) => page.keyboard.type(text, { delay: VIDEO ? 45 : 5 });
const shot = async (name) => {
  if (!SHOTS) return;
  await mkdir(shotsDir, { recursive: true });
  await page.screenshot({ path: join(shotsDir, `${name}.jpg`), type: 'jpeg', quality: 82 });
};
const step = (label) => console.log(`✓ ${label}`);
const caretAtEnd = (selector) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  el.focus();
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  getSelection().removeAllRanges();
  getSelection().addRange(r);
}, selector);
// Sélectionne le passage `phrase` à l'intérieur de `selector`, quel que soit le découpage du texte.
const selectPhrase = (selector, phrase) => page.evaluate(([sel, text]) => {
  const el = document.querySelector(sel);
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let full = '';
  for (let n; (n = walker.nextNode());) {
    nodes.push([n, full.length]);
    full += n.textContent;
  }
  const start = full.indexOf(text);
  if (start < 0) throw new Error(`« ${text} » introuvable dans « ${full} »`);
  const at = (pos) => {
    const [node, offset] = nodes.findLast(([, o]) => o <= pos);
    return [node, pos - offset];
  };
  const r = document.createRange();
  r.setStart(...at(start));
  r.setEnd(...at(start + text.length));
  getSelection().removeAllRanges();
  getSelection().addRange(r);
}, [selector, phrase]);
const pageRecord = (id) => page.evaluate(async (pid) => {
  const db = await import('/encre/js/db.js');
  return (await db.getAll('pages')).find((p) => p.id === pid);
}, id);

// 0. Des notes vocales existent déjà dans Do It
await page.goto(`${base}/manifest.webmanifest`);
await page.evaluate(async (notes) => {
  const store = await import('/js/store.js');
  for (const n of notes) await store.saveEntry(n);
}, NOTES);

// 1. Intro animée puis accueil
await page.goto(`${base}/encre/`);
await page.waitForSelector('#splash:not([hidden])');
await page.waitForTimeout(1050);
if (SHOTS) {
  await mkdir(shotsDir, { recursive: true });
  await page.screenshot({ path: join(shotsDir, '01-intro.jpg'), type: 'jpeg', quality: 82, scale: 'css' });
}
await page.waitForSelector('#splash', { state: 'detached', timeout: 5000 });
await page.waitForSelector('.home .wordmark');
await page.waitForTimeout(700);
assert.match(await page.textContent('.resume-title'), /Bienvenue dans Encré/);
assert.equal(await page.locator('.home .nrow').count(), 3);
await shot('02-accueil');
await page.evaluate(() => window.scrollTo(0, 720));
await pause(700);
await shot('03-accueil-suite');
await page.evaluate(() => window.scrollTo(0, 0));
step('intro, accueil avec page de bienvenue et notes vocales de Do It');

// 2. Notes vocales : filtre par thème et ouverture
await page.click('#dock a[href="#/notes"]');
await page.waitForSelector('.notes .ncard');
assert.equal(await page.locator('.ncard').count(), 3);
await pause(500);
await shot('04-notes');
await page.click('.chips [data-id="sport"]');
assert.equal(await page.locator('.ncard').count(), 1);
await page.fill('#notes-search', 'recettes');
await page.click('.chips [data-id="all"]');
await page.fill('#notes-search', 'recettes');
assert.equal(await page.locator('.ncard').count(), 1);
await page.fill('#notes-search', '');
await page.click('.ncard >> text=Dix kilomètres');
await page.waitForSelector('.note-page #note-doc');
await pause(600);
await shot('05-note');
step('notes vocales : filtre, recherche, lecture');

// 3. Modifier la note : Do It suit
await caretAtEnd('#note-title');
await typeSlow(' 🏃');
await page.waitForFunction(() => document.querySelector('#save-state')?.dataset.state === 'saved' && document.querySelector('#save-state').textContent.includes('Do It'), null, { timeout: 4000 });
await page.waitForTimeout(200);
const synced = await page.evaluate(async () => (await (await import('/js/store.js')).loadEntries()).find((e) => e.id === 'n-run'));
assert.equal(synced.title, 'Dix kilomètres avant le travail 🏃');
assert.equal(synced.edited, true);
step('modification d’une note enregistrée dans le journal Do It');

// 4. Transformer la note en page
await page.click('[data-action="note-to-page"]');
await page.waitForSelector('.page #doc');
await page.waitForTimeout(700);
const pageId = await page.getAttribute('.page', 'data-page');
assert.match(await page.textContent('.crumbs'), /Notes vocales/);
assert.match(await page.textContent('.source'), /note vocale/);
await shot('06-page-note');
step('note transformée en page, rangée dans « Notes vocales »');

// 5. Éditeur : Markdown, menu « / », cases à cocher, gras, Retenir
await caretAtEnd('#doc p:nth-of-type(2)');
await page.keyboard.press('Enter');
await typeSlow('## Mon plan');
await page.keyboard.press('Enter');
await typeSlow('[] Courir trois fois cette semaine');
await page.keyboard.press('Enter');
await typeSlow('Dormir avant minuit');
await page.keyboard.press('Enter');
await page.keyboard.press('Enter');
await typeSlow('/');
await page.waitForSelector('.slash:not([hidden]) .slash-item');
await typeSlow('enc');
await pause(400);
await shot('07-menu-slash');
await page.keyboard.press('Enter');
await typeSlow('La régularité bat l’intensité.');
assert.equal(await page.locator('#doc h2').filter({ hasText: 'Mon plan' }).count(), 1);
assert.equal(await page.locator('#doc ul.todo li').count(), 2);
assert.equal(await page.locator('#doc .callout').filter({ hasText: 'régularité' }).count(), 1);

const box = await page.locator('#doc ul.todo li').first().boundingBox();
await page.mouse.click(box.x + 10, box.y + box.height / 2);
assert.equal(await page.getAttribute('#doc ul.todo li >> nth=0', 'data-done'), 'true');

await selectPhrase('#doc .callout', 'La régularité bat');
await page.click('#toolbar [data-tb="retain"]');
await page.waitForSelector('#doc mark[data-card]');
assert.match(await page.textContent('#toast'), /mémoire/);

await selectPhrase('#doc p', 'Ce matin,');
await page.keyboard.press('Control+b');
await page.waitForFunction(() => document.querySelector('#save-state')?.dataset.state === 'saved', null, { timeout: 4000 });
await page.waitForTimeout(700);
const saved = await pageRecord(pageId);
for (const needle of ['<h2>Mon plan</h2>', '<ul class="todo">', 'data-done="true"', '<div class="callout">', 'data-card=', '<b>Ce matin,</b>']) {
  assert.ok(saved.html.includes(needle), `${needle} absent de ${saved.html}`);
}
await page.evaluate(() => getSelection().removeAllRanges());
await page.evaluate(() => document.activeElement.blur());
await page.evaluate(() => window.scrollTo(0, 380));
await pause(500);
await shot('08-page-edition');
step('éditeur : titre, cases à cocher, menu « / », encadré, gras, Retenir, sauvegarde');

// 6. Dictée dans la page
await caretAtEnd('#doc .callout');
await page.evaluate(() => {
  window.__phrases = ['euh en fait demain je commence par un footing léger', 'du coup je préparerai mes affaires ce soir'];
});
await page.click('#toolbar [data-tb="dictate"]');
await page.waitForFunction(() => document.querySelector('#dictation-text')?.textContent.includes('affaires'));
await pause(300);
await shot('09-dictee');
await page.click('#dictation [data-dict="ok"]');
await page.waitForFunction(() => [...document.querySelectorAll('#doc p')].some((p) => p.textContent.startsWith('Demain je commence par un footing léger')));
step('dictée insérée dans la page, nettoyée des « euh » et « en fait »');

// 7. Onglets : une nouvelle page, puis retour
await page.click('#topbar .tab-new');
await page.waitForSelector('#page-title:focus');
await typeSlow('Idées en vrac');
await page.click('#doc');
await typeSlow('- Un carnet de recettes');
await page.keyboard.press('Enter');
await typeSlow('Un podcast sur la course');
await page.waitForTimeout(700);
assert.equal(await page.locator('#topbar .tab').count(), 2);
await shot('10-onglets');
await page.click(`#topbar .tab[href="#/page/${pageId}"]`);
await page.waitForSelector(`.page[data-page="${pageId}"]`);
assert.equal(await page.locator('#topbar .tab.is-active .tab-title').textContent(), 'Dix kilomètres avant le travail 🏃');
step('onglets des pages ouvertes');

// 8. Dossiers : créer, ranger une page
await page.click('[data-action="back"]');
await page.goto(`${base}/encre/#/dossiers`);
await page.waitForSelector('.explorer');
await page.click('.vactions [data-action="new-folder"]');
await page.fill('#sheet input[name="v"]', 'Projets');
await page.keyboard.press('Enter');
await page.waitForSelector('.explorer .is-folder >> text=Projets');
const ideas = page.locator('.explorer .is-page', { hasText: 'Idées en vrac' });
await ideas.locator('[data-action="page-menu"]').click();
await page.click('#sheet [data-choice="move"]');
await page.click('#sheet .menu-item >> text=Projets');
await page.waitForFunction(() => {
  const f = [...document.querySelectorAll('.explorer .is-folder')].find((n) => n.textContent.includes('Projets'));
  return f && f.textContent.includes('Idées en vrac');
});
await pause(500);
await shot('11-dossiers');
step('dossiers : création et rangement d’une page');

// 9. Mémoire : révision du passage retenu
await page.click('#dock a[href="#/memoire"]');
await page.waitForSelector('.memory .mcard');
assert.equal(await page.locator('.mcard').count(), 1);
await pause(400);
await shot('12-memoire');
await page.click('[data-action="start-review"]');
await page.waitForSelector('.flip .cloze');
await page.waitForTimeout(1000);
await shot('13-revision');
await page.click('.flip');
await page.waitForSelector('.rv-actions:not([hidden])');
await pause(900);
await page.click('[data-action="grade"][data-id="1"]');
await page.waitForSelector('.review-done');
const card = await page.evaluate(async () => (await (await import('/encre/js/db.js')).getAll('cards'))[0]);
assert.equal(card.step, 0);
assert.ok(new Date(card.due) > new Date(Date.now() + 20 * 3600e3));
step('mémoire : révision et prochaine échéance demain');

// 10. Persistance
await page.reload();
await page.waitForSelector('body.is-ready');
await page.goto(`${base}/encre/#/dossiers`);
await page.waitForSelector('.explorer .is-folder >> text=Projets');
assert.equal(await page.locator('.explorer .is-page').count(), 3);
step('tout est conservé après rechargement');

assert.deepEqual(errors, []);
const video = page.video();
const storage = await context.storageState({ indexedDB: true });
await context.close();

// 11. Bureau : barre latérale façon Notion
const desk = await browser.newContext({ storageState: storage, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, locale: 'fr-FR', colorScheme: 'dark' });
const dp = await desk.newPage();
dp.on('pageerror', (err) => errors.push(err.message));
await dp.goto(`${base}/encre/`);
await dp.evaluate(() => sessionStorage.setItem('encre-splash', '1'));
await dp.goto(`${base}/encre/#/page/${pageId}`);
await dp.waitForSelector('.sidebar .tree');
await dp.waitForSelector('#splash', { state: 'detached', timeout: 5000 });
await dp.waitForTimeout(900);
if (SHOTS) await dp.screenshot({ path: join(shotsDir, '14-bureau.jpg'), type: 'jpeg', quality: 82 });
assert.equal(await dp.locator('.sidebar .side-tree .is-page').count(), 3);
step('version bureau avec barre latérale');
await desk.close();
await browser.close();
server.close();

if (VIDEO && video) {
  const files = await readdir(videoDir);
  const webm = files.find((f) => f.endsWith('.webm'));
  if (webm) await rename(join(videoDir, webm), fileURLToPath(new URL('../docs/encre-demo.webm', import.meta.url)));
  await rm(videoDir, { recursive: true, force: true });
}
assert.deepEqual(errors, []);
console.log('\nParcours Encré complet OK');
