// Parcours complet dans Chromium : accueil, dictée simulée, écriture par l'IA
// (réponse simulée), relance, journal, thèmes, bilan, mode local, persistance.
// Usage : npm run smoke            (vérifications seules)
//         npm run smoke -- --shots (met aussi à jour docs/screenshots/)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = fileURLToPath(new URL('../public/', import.meta.url));
const shotsDir = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
const SHOTS = process.argv.includes('--shots');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const file = join(root, path.endsWith('/') ? 'index.html' : path);
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://localhost:${server.address().port}`;

// Dictée simulée : chaque session énonce les phrases de window.__phrases.
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
          setTimeout(step, 80);
        }, 80);
      };
      setTimeout(step, 60);
    }
    stop() { this.stopped = true; setTimeout(() => this.onend?.(), 40); }
    abort() { this.stopped = true; setTimeout(() => this.onend?.(), 10); }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
};

const FIRST = {
  title: 'Dix kilomètres et un apéro mérité',
  text: "Ce matin, je suis allé courir et j'ai bouclé dix kilomètres. J'en suis ressorti vraiment content, avec la sensation d'avoir bien lancé ma journée.\n\nLe soir, j'ai retrouvé mes amis pour un apéro, autour de trois bières.",
  summary: "J'ai couru dix kilomètres le matin, puis j'ai pris un apéro avec mes amis le soir.",
  highlights: ['10 km courus le matin', 'Apéro entre amis : 3 bières'],
  themes: [{ id: 'sport', label: 'Sport', emoji: '🏃' }, { id: 'alcool', label: 'Alcool', emoji: '🍷' }, { id: 'amis', label: 'Amis & sorties', emoji: '🎉' }],
  mood: 'bon',
  followUp: 'Comment ton corps a-t-il récupéré après ces dix kilomètres ?',
};
const SECOND = {
  ...FIRST,
  text: `${FIRST.text}\n\nLe lendemain, j'avais les jambes lourdes mais la tête légère : une bonne fatigue.`,
  highlights: [...FIRST.highlights, 'Jambes lourdes, tête légère'],
  followUp: 'Quel sera ton prochain objectif de course ?',
};
const THIRD = {
  title: 'Une étagère enfin montée',
  text: "J'ai passé l'après-midi à monter l'étagère du salon. Il m'a fallu deux heures, mais le résultat me plaît.",
  summary: "J'ai monté l'étagère du salon en deux heures.",
  highlights: [],
  themes: [{ id: 'bricolage', label: 'Bricolage', emoji: '🔨' }, { id: 'quotidien', label: 'Quotidien', emoji: '🗓️' }],
  mood: 'bon',
  followUp: 'Quel est le prochain chantier à la maison ?',
};

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
await context.addInitScript(fakeSpeech);
const page = await context.newPage();

const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error' && !/fonts\.(googleapis|gstatic)|Failed to load resource/.test(msg.text())) errors.push(msg.text());
});

let apiMode = 'ai';
const posted = [];
await page.route('**/api/ecrire', async (route) => {
  const req = route.request();
  if (req.method() === 'GET') return route.fulfill({ json: { ai: apiMode === 'ai', needsCode: false, authorized: true } });
  const body = req.postDataJSON();
  posted.push(body);
  await new Promise((r) => setTimeout(r, 1600));
  if (apiMode !== 'ai') return route.fulfill({ status: 503, json: { error: 'ai_unavailable', message: 'IA non configurée.' } });
  const entry = body.segments.length > 1 ? SECOND : /étagère/.test(body.segments[0].text) ? THIRD : FIRST;
  return route.fulfill({ json: { entry, model: 'test' } });
});

const shot = async (name) => {
  if (!SHOTS) return;
  await mkdir(shotsDir, { recursive: true });
  await page.screenshot({ path: join(shotsDir, `${name}.jpg`), type: 'jpeg', quality: 82 });
};
const step = (label) => console.log(`✓ ${label}`);

// 1. Accueil
await page.goto(base);
await page.waitForSelector('#onboarding:not([hidden])');
await page.waitForTimeout(700);
await shot('01-accueil');
await page.fill('#onboarding-name', 'Alex');
await page.click('#onboarding-form button[type="submit"]');
await page.waitForSelector('#onboarding', { state: 'hidden' });
assert.match(await page.textContent('#hello'), /Alex/);
await page.waitForTimeout(400);
await shot('02-parler');
step('accueil et prénom');

// 2. Dictée puis écriture
await page.evaluate(() => {
  window.__phrases = ["euh bon en fait aujourd'hui je suis allé courir le matin", "j'ai fait dix kilomètres du coup j'étais trop content", "et puis le soir on a pris un apéro avec les potes j'ai bu trois bières quoi"];
});
await page.click('#orb');
await page.waitForSelector('#stage[data-state="listening"]');
await page.waitForFunction(() => document.querySelector('#live').textContent.includes('trois bières'));
await shot('03-ecoute');
await page.click('#orb');
await page.waitForSelector('#stage[data-state="processing"]');
await page.waitForSelector('#feed .entry.is-writing');
await shot('04-ecriture');
await page.waitForFunction(() => document.querySelector('#feed .entry-title')?.textContent.includes('Dix kilomètres'));
assert.equal(posted[0].segments.length, 1);
assert.match(posted[0].segments[0].text, /^euh bon en fait aujourd'hui je suis allé courir le matin j'ai fait dix kilomètres/);
assert.equal(posted[0].style, 'professionnel');
const chips = await page.$$eval('#feed .entry .chips .chip', (els) => els.map((e) => e.textContent.trim()));
assert.deepEqual(chips, ['🏃Sport', '🍷Alcool', '🎉Amis & sorties']);
assert.match(await page.textContent('#feed .followup-q'), /récupéré/);
await page.waitForTimeout(1800);
if (SHOTS) {
  await page.waitForSelector('#toast:not(.is-visible)', { timeout: 6000 });
  await page.evaluate(() => window.scrollTo(0, document.querySelector('#feed .entry').getBoundingClientRect().top + window.scrollY - 96));
  await page.waitForTimeout(300);
}
await shot('05-recit');
step('dictée, écriture, thèmes, relance');

// 3. Relance : on répond à voix haute, l'entrée est réécrite
await page.evaluate(() => {
  window.__phrases = ["le lendemain j'avais les jambes lourdes mais la tête légère"];
});
await page.click('#feed [data-action="reply"]');
await page.waitForSelector('#reply-banner:not([hidden])');
assert.match(await page.textContent('#reply-question'), /récupéré/);
await page.waitForFunction(() => document.querySelector('#live').textContent.includes('tête légère'));
await shot('06-reponse');
await page.click('#orb');
await page.waitForFunction(() => document.querySelector('#feed .followup-q')?.textContent.includes('prochain objectif'));
assert.equal(posted[1].segments.length, 2);
assert.match(posted[1].segments[1].question, /récupéré/);
assert.match(await page.textContent('#feed .entry'), /2 prises/);
assert.equal(await page.locator('#feed .entry').count(), 1);
step('dialogue : relance et réponse fusionnées dans le même récit');

// 4. Nouveau thème créé par l'IA
await page.evaluate(() => {
  window.__phrases = ["cet après-midi j'ai monté l'étagère du salon ça m'a pris deux heures"];
});
await page.click('#orb');
await page.waitForFunction(() => document.querySelector('#live').textContent.includes('étagère'));
await page.click('#orb');
await page.waitForFunction(() => [...document.querySelectorAll('#feed .entry-title')].some((e) => e.textContent.includes('étagère')));
step('thème personnel créé (Bricolage)');

// 5. Journal, onglets, recherche
await page.click('.tabbar [data-nav="journal"]');
await page.waitForSelector('#view-journal:not([hidden])');
const tabs = await page.$$eval('#tabs .chip', (els) => els.map((e) => e.textContent.trim()));
assert.ok(tabs[0].startsWith('Tout') && tabs[0].endsWith('2'));
assert.ok(tabs.some((t) => t.includes('Bricolage')));
await page.waitForTimeout(400);
await shot('07-journal');
await page.click('#tabs [data-id="sport"]');
assert.equal(await page.locator('#timeline .entry').count(), 1);
assert.match(page.url(), /#journal\/sport$/);
await page.click('#tabs [data-id="all"]');
await page.fill('#search', 'etagere');
assert.equal(await page.locator('#timeline .entry').count(), 1);
await page.fill('#search', '');
step('journal : onglets par thème et recherche sans accents');

// 6. Fiche d'un récit
await page.click('#timeline .entry >> nth=1');
await page.waitForSelector('#sheet[open]');
assert.match(await page.textContent('#sheet .sheet-title'), /Dix kilomètres/);
assert.equal(await page.locator('#sheet .raw-seg').count(), 2);
await page.waitForTimeout(500);
await shot('08-fiche');
await page.click('#sheet [data-action="set-mood"][data-value="excellent"]');
await page.click('#sheet [data-action="close-sheet"]');
step('fiche : humeur modifiable');

// 7. Thèmes et bilan
await page.click('.tabbar [data-nav="themes"]');
assert.equal(await page.locator('#theme-grid .tile').count(), 5);
await page.waitForTimeout(1400);
assert.equal(await page.textContent('#theme-grid .tile[data-id="amis"] .tile-emoji'), '🎉');
await shot('09-themes');
await page.click('#theme-grid .tile[data-id="bricolage"]');
await page.waitForSelector('#view-journal:not([hidden])');
assert.equal(await page.locator('#timeline .entry').count(), 1);
await page.click('.tabbar [data-nav="bilan"]');
const stats = await page.$$eval('#stats .stat-value', (els) => els.map((e) => e.textContent));
assert.equal(stats[0], '1');
assert.equal(stats[1], '2');
await page.waitForTimeout(400);
await shot('10-bilan');
step('thèmes et bilan');

// 8. Persistance après rechargement
await page.reload();
await page.waitForSelector('body.is-ready');
assert.equal(await page.locator('#onboarding').isHidden(), true);
await page.click('.tabbar [data-nav="journal"]');
assert.equal(await page.locator('#timeline .entry').count(), 2);
step('journal conservé après rechargement (IndexedDB)');

// 9. Mode local quand l'IA est indisponible
apiMode = 'down';
await page.click('.tabbar [data-nav="parler"]');
await page.evaluate(() => {
  window.__phrases = ['euh je me sens un peu fatigué ce soir', 'en fait je je suis stressé par le travail'];
});
await page.click('#orb');
await page.waitForFunction(() => document.querySelector('#live').textContent.includes('travail'));
await page.click('#orb');
await page.waitForFunction(() => document.querySelector('#feed .entry .badge')?.textContent === 'Mode local');
const localText = await page.textContent('#feed .entry .entry-text');
assert.ok(!/euh|en fait/.test(localText), localText);
assert.match(localText, /^Je me sens un peu fatigué ce soir je suis stressé par le travail\.$/);
assert.match(await page.textContent('#toast'), /mode local/);
step('mode local : texte nettoyé et classé sans IA');

// 10. Sombre, écrire au clavier
assert.equal(await page.getAttribute('html', 'data-theme'), 'light');
await page.click('.tabbar [data-nav="bilan"]');
await page.click('[data-action="set-appearance"][data-value="dark"]');
await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
await page.click('.tabbar [data-nav="parler"]');
await page.waitForTimeout(400);
await shot('11-sombre');
await page.click('#keyboard-btn');
await page.waitForSelector('#composer[open]');
await page.click('#composer button[value="cancel"]');
step('fond blanc par défaut, mode sombre et saisie au clavier');

assert.deepEqual(errors, []);
await browser.close();
server.close();
console.log('\nParcours complet OK');
