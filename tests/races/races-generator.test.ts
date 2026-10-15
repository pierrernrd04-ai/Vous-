/**
 * Générateur des pages courses (build/races-plugin.ts), sur deux courses d'exemple :
 * title, canonical, JSON-LD (Product/Offer, FAQPage, BreadcrumbList), dates de départ,
 * semaine de Noël, appels à l'action, index par mois, sitemap et branchement Vite.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import * as constants from '../../src/engine/constants';
import * as engine from '../../src/engine';
import * as labels from '../../src/lib/labels';
import * as price from '../../src/lib/price';
import {
  type Race,
  buildSitemap,
  createRaceDeps,
  freeWeekUrl,
  frenchSpaces,
  htmlFileToPath,
  loadRaceDeps,
  parseDisallow,
  raceFacts,
  racesPlugin,
  raceTitle,
  renderRacePages,
  startMondayFor,
} from '../../build/races-plugin';

const NBSP = String.fromCharCode(0xa0);
const SPACES_RE = new RegExp(`[${String.fromCharCode(0xa0, 0x202f)}]`, 'g');
/** Espaces insécables → espaces, pour comparer du texte lisible. */
const plain = (text: string) => text.replace(SPACES_RE, ' ');

const deps = createRaceDeps({ engine, constants, labels, price });

const SITE = 'https://exemple.test';
/** Jeudi 15/10/2026, pendant le prix de lancement. */
const NOW = new Date('2026-10-15T08:00:00Z');

const PARIS: Race = {
  slug: 'marathon-de-paris',
  name: 'Marathon de Paris',
  city: 'Paris',
  region: 'Île-de-France',
  kind: 'marathon',
  date: '2027-04-04',
  dateStatus: 'confirmée',
  sourceUrl: 'https://www.exemple-presse.fr/marathon-paris-2027',
  participantsApprox: 57000,
  notes: '50e édition ; dossards attribués par tirage au sort.',
};

/** Semi un samedi, date estimée. */
const SAMEDI: Race = {
  slug: 'semi-du-samedi',
  name: 'Semi-marathon du Samedi',
  city: 'Annecy',
  region: 'Auvergne-Rhône-Alpes',
  kind: 'semi',
  date: '2027-05-15',
  dateStatus: 'estimée',
  sourceUrl: 'https://exemple-course.fr/edition-2026',
  notes: 'Édition 2026 : samedi 16 mai.',
};

const pages = renderRacePages({ deps, races: [SAMEDI, PARIS], siteUrl: `${SITE}/`, now: NOW });
const byPath = new Map(pages.map((page) => [page.path, page]));
const parisHtml = byPath.get('/courses/marathon-de-paris/')?.html ?? '';
const samediHtml = byPath.get('/courses/semi-du-samedi/')?.html ?? '';
const indexHtml = byPath.get('/courses/')?.html ?? '';

function decode(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function title(html: string): string {
  return decode(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '');
}

function metaContent(html: string, attr: 'name' | 'property', key: string): string {
  const re = new RegExp(`<meta ${attr}="${key}" content="([^"]*)">`);
  return decode(re.exec(html)?.[1] ?? '');
}

function canonical(html: string): string {
  return /<link rel="canonical" href="([^"]+)">/.exec(html)?.[1] ?? '';
}

type JsonNode = Record<string, unknown>;

function jsonLdGraph(html: string): JsonNode[] {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  expect(scripts).toHaveLength(1);
  const data = JSON.parse(scripts[0]?.[1] ?? 'null') as JsonNode;
  expect(data['@context']).toBe('https://schema.org');
  return data['@graph'] as JsonNode[];
}

function node(graph: JsonNode[], type: string): JsonNode {
  const found = graph.find((n) => n['@type'] === type);
  expect(found, `${type} absent du JSON-LD`).toBeDefined();
  return found as JsonNode;
}

describe('renderRacePages', () => {
  it('produit l’index et une page par course, aux bons chemins', () => {
    expect(pages.map((p) => [p.file, p.path])).toEqual([
      ['courses/index.html', '/courses/'],
      ['courses/marathon-de-paris/index.html', '/courses/marathon-de-paris/'],
      ['courses/semi-du-samedi/index.html', '/courses/semi-du-samedi/'],
    ]);
    expect(new Set(pages.map((p) => p.inputName)).size).toBe(pages.length);
    for (const page of pages) {
      expect(page.html.startsWith('<!doctype html>\n<html lang="fr">')).toBe(true);
      expect(page.html).toContain('<link rel="stylesheet" href="/src/styles/base.css">');
      expect(page.html).toContain('<link rel="stylesheet" href="/src/styles/course.css">');
      expect(page.html).toContain('<script type="module" src="/src/pages/course.ts"></script>');
    }
  });

  it('donne un title unique et daté, une description, un canonical et les balises OG', () => {
    expect(title(parisHtml)).toBe(`Plan marathon de Paris 2027${NBSP}: ta prépa datée de 24${NBSP}semaines`);
    expect(title(samediHtml)).toBe(`Plan semi-marathon du Samedi 2027${NBSP}: ta prépa datée de 20${NBSP}semaines`);
    expect(canonical(parisHtml)).toBe(`${SITE}/courses/marathon-de-paris/`);
    expect(canonical(samediHtml)).toBe(`${SITE}/courses/semi-du-samedi/`);
    expect(metaContent(parisHtml, 'property', 'og:url')).toBe(`${SITE}/courses/marathon-de-paris/`);
    expect(metaContent(parisHtml, 'property', 'og:title')).toBe(title(parisHtml));
    expect(metaContent(parisHtml, 'property', 'og:locale')).toBe('fr_FR');
    expect(metaContent(parisHtml, 'name', 'twitter:card')).toBe('summary_large_image');

    const description = plain(metaContent(parisHtml, 'name', 'description'));
    expect(description).toBe(
      'Marathon de Paris le dimanche 4 avril 2027 : ta prépa de 24 semaines commence le lundi 19 octobre 2026. Plan daté, semaine 1 offerte, une boucle par séance.',
    );
    expect(description.length).toBeLessThanOrEqual(170);
    expect(plain(metaContent(samediHtml, 'name', 'description'))).toContain('(date estimée : samedi 15 mai 2027)');
  });

  it('a un H1 avec le mot-clé de la course', () => {
    expect(plain(parisHtml)).toMatch(/<h1 id="page-title">Plan marathon de Paris <span class="grad-text">2027<\/span><\/h1>/);
  });

  it('émet un JSON-LD valide : Product + Offer en EUR, FAQPage, BreadcrumbList', () => {
    const graph = jsonLdGraph(parisHtml);
    const product = node(graph, 'Product');
    expect(product.name).toBe('Pass J-24 · Traceo');
    expect(product.offers).toMatchObject({
      '@type': 'Offer',
      price: '19.00',
      priceCurrency: 'EUR',
      priceValidUntil: '2026-10-18',
      url: `${SITE}/courses/marathon-de-paris/`,
    });

    const faq = node(graph, 'FAQPage');
    const questions = faq.mainEntity as JsonNode[];
    expect(questions.length).toBe((parisHtml.match(/<details>/g) ?? []).length);
    expect(questions.length).toBeGreaterThanOrEqual(5);
    for (const question of questions) {
      expect(question['@type']).toBe('Question');
      expect(String(question.name)).not.toBe('');
      expect(String((question.acceptedAnswer as JsonNode).text).length).toBeGreaterThan(20);
    }
    expect(plain(JSON.stringify(questions))).toContain('Pour la prépa complète de 24 semaines, commence le lundi 19 octobre 2026.');

    const breadcrumb = node(graph, 'BreadcrumbList');
    expect(breadcrumb.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Courses de printemps', item: `${SITE}/courses/` },
      { '@type': 'ListItem', position: 3, name: 'Marathon de Paris 2027', item: `${SITE}/courses/marathon-de-paris/` },
    ]);
  });

  it('n’invente aucune donnée d’organisateur ni d’événement', () => {
    for (const html of [parisHtml, samediHtml, indexHtml]) {
      const json = JSON.stringify(jsonLdGraph(html));
      expect(json).not.toMatch(/organizer|SportsEvent|"Event"|performer/);
    }
  });

  it('calcule les lundis de départ à 24, 20 et 16 semaines et la semaine allégée de Noël', () => {
    for (const start of ['2026-10-19', '2026-11-16', '2026-12-14']) {
      expect(parisHtml).toContain(`data-start-option data-start="${start}"`);
    }
    expect(plain(parisHtml)).toContain('Noël : semaine allégée en S10 (21 – 27 déc.)');
    const facts = raceFacts(PARIS, '2026-10-15', deps);
    expect(facts.options.map((o) => [o.weeks, o.start, o.nominal])).toEqual([
      [24, '2026-10-19', true],
      [20, '2026-11-16', false],
      [16, '2026-12-14', false],
    ]);
    expect(facts.options[0]?.christmas).toEqual({ index: 10, start: '2026-12-21', end: '2026-12-27', deload: true });
    expect(facts.options[0]?.deloads.map((w) => w.index)).toEqual([4, 7, 10, 14, 18]);
    expect(facts.options[0]?.taperStart).toBe('2027-03-15');
  });

  it('cale un semi du samedi sur la semaine de la course (12, 16, 20 semaines)', () => {
    expect(startMondayFor('2027-05-15', 20)).toBe('2026-12-28');
    const facts = raceFacts(SAMEDI, '2026-10-15', deps);
    expect(facts.options.map((o) => [o.weeks, o.start])).toEqual([
      [20, '2026-12-28'],
      [16, '2027-01-25'],
      [12, '2027-02-22'],
    ]);
    expect(facts.current).toMatchObject({ status: 'ok', deferred: true, shortened: false });
    expect(facts.options.every((o) => o.christmas === null || o.christmas.index === 1)).toBe(true);
  });

  it('signale clairement une date estimée', () => {
    expect(samediHtml).toContain('Date estimée');
    expect(plain(samediHtml)).toContain('La date 2027 n’était pas encore annoncée quand cette page a été mise à jour, le 15 octobre 2026.');
    expect(parisHtml).toContain('Date confirmée');
    expect(parisHtml).not.toContain('race-estimate');
  });

  it('propose la semaine 1 gratuite préremplie et l’achat avec la course', () => {
    const free = '/gratuit/?race=marathon&amp;date=2027-04-04&amp;name=Marathon+de+Paris';
    expect(freeWeekUrl(PARIS)).toBe('/gratuit/?race=marathon&date=2027-04-04&name=Marathon+de+Paris');
    expect(parisHtml).toContain(`href="${free}" data-free-link>Voir ma semaine 1 gratuite`);
    expect((parisHtml.match(/data-course-checkout/g) ?? []).length).toBe(2);
    expect(parisHtml).toContain('data-race-page data-race="marathon" data-race-date="2027-04-04" data-race-name="Marathon de Paris"');
    expect(parisHtml).toMatch(/<input type="radio" name="level" value="finisher" checked>/);
    expect(plain(parisHtml)).toContain('Moins de 4 h 30');
  });

  it('respecte la SPEC : avertissement santé, pas de « officiel », pas de style en ligne', () => {
    for (const html of [parisHtml, samediHtml, indexHtml]) {
      expect(html).not.toMatch(/officiel|coach/i);
      expect(html).not.toMatch(/\sstyle="/);
      expect(html).toContain('ne remplace pas l’avis d’un médecin');
      expect(html).toContain('n’est lié à aucun organisateur de course');
    }
    expect(parisHtml).toContain('Ta santé d’abord');
    expect(parisHtml).toContain('href="https://www.exemple-presse.fr/marathon-paris-2027" target="_blank" rel="noopener nofollow"');
  });

  it('liste les courses par mois sur l’index, avec un JSON-LD ItemList', () => {
    expect(title(indexHtml)).toBe(`Marathons et semis de printemps 2027 en France${NBSP}: dates et plans`);
    expect(canonical(indexHtml)).toBe(`${SITE}/courses/`);
    const april = indexHtml.indexOf('>Avril 2027</h2>');
    const may = indexHtml.indexOf('>Mai 2027</h2>');
    expect(april).toBeGreaterThan(0);
    expect(may).toBeGreaterThan(april);
    expect(indexHtml.indexOf('href="/courses/marathon-de-paris/"')).toBeGreaterThan(april);
    expect(indexHtml.indexOf('href="/courses/semi-du-samedi/"')).toBeGreaterThan(may);
    expect(plain(indexHtml)).toContain('Prépa de 24 semaines dès le lundi 19 octobre 2026');

    const graph = jsonLdGraph(indexHtml);
    const list = node(graph, 'ItemList');
    expect(list.numberOfItems).toBe(2);
    expect((list.itemListElement as JsonNode[]).map((item) => item.url)).toEqual([
      `${SITE}/courses/marathon-de-paris/`,
      `${SITE}/courses/semi-du-samedi/`,
    ]);
    node(graph, 'BreadcrumbList');
  });

  it('ajuste le titre quand la prépa complète n’est plus possible', () => {
    const late = raceFacts(PARIS, '2027-01-20', deps).current;
    expect(late).toMatchObject({ status: 'ok', shortened: true });
    expect(plain(raceTitle(PARIS, late))).toBe('Plan marathon de Paris 2027 : ta prépa datée de 10 semaines');
    expect(raceFacts(PARIS, '2027-03-01', deps).current).toEqual({ status: 'too-short' });
    expect(raceFacts(PARIS, '2027-04-05', deps).current).toEqual({ status: 'past' });
    expect(plain(raceTitle(PARIS, { status: 'past' }))).toBe('Plan marathon de Paris 2027 : les dates de ta prépa');
    const long = { ...SAMEDI, name: 'Semi de la Très Grande Course du Grand Paris Métropole' };
    expect(plain(raceTitle(long, raceFacts(long, '2026-10-15', deps).current))).toBe(
      'Plan semi de la Très Grande Course du Grand Paris Métropole 2027 : ta prépa datée',
    );
  });
});

describe('typographie', () => {
  it('pose les espaces insécables français', () => {
    expect(frenchSpaces('Départ à 9 h 15 : 7 000 dossards, +10 % ! « jour J »')).toBe(
      `Départ à 9${NBSP}h 15${NBSP}: 7${NBSP}000 dossards, +10${NBSP}%${NBSP}! «${NBSP}jour${NBSP}J${NBSP}»`,
    );
    expect(frenchSpaces('24 semaines, 2 jours, 42 km, S10')).toBe(`24${NBSP}semaines, 2${NBSP}jours, 42${NBSP}km, S10`);
    expect(frenchSpaces('2 hommes')).toBe('2 hommes');
  });
});

describe('sitemap et robots', () => {
  it('liste chaque page une fois, accueil en premier, avec lastmod', () => {
    const xml = buildSitemap(`${SITE}/`, ['/gratuit/', '/', ...pages.map((p) => p.path), '/gratuit/'], '2026-10-15');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')).toBe(true);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([
      `${SITE}/`,
      `${SITE}/courses/`,
      `${SITE}/courses/marathon-de-paris/`,
      `${SITE}/courses/semi-du-samedi/`,
      `${SITE}/gratuit/`,
    ]);
    expect((xml.match(/<lastmod>2026-10-15<\/lastmod>/g) ?? []).length).toBe(locs.length);
  });

  it('lit les Disallow de robots.txt et convertit les chemins de pages', () => {
    expect(parseDisallow('User-agent: *\nAllow: /\nDisallow: /merci/\ndisallow:/plan/\nDisallow:\nSitemap: x')).toEqual([
      '/merci/',
      '/plan/',
    ]);
    expect(htmlFileToPath('index.html')).toBe('/');
    expect(htmlFileToPath('gratuit/index.html')).toBe('/gratuit/');
    expect(htmlFileToPath('courses/x/index.html')).toBe('/courses/x/');
  });
});

describe('racesPlugin (branchement Vite)', () => {
  const root = mkdtempSync(join(tmpdir(), 'races-plugin-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'races.json'), JSON.stringify([PARIS, SAMEDI]));
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>Accueil</title>');

  type Hook = (...args: unknown[]) => unknown;
  const call = (hook: unknown, thisArg: unknown, ...args: unknown[]): unknown => {
    const fn = typeof hook === 'function' ? hook : (hook as { handler: Hook }).handler;
    return (fn as Hook).apply(thisArg, args);
  };

  it('ajoute les pages aux entrées du build et les sert depuis la mémoire', async () => {
    const plugin = racesPlugin({ siteUrl: SITE, dataFile: 'races.json', now: () => NOW, deps });
    const home = join(root, 'index.html');
    const result = (await call(plugin.config, {}, { root, build: { rolldownOptions: { input: { index: home } } } }, {
      command: 'build',
      mode: 'production',
    })) as { build: { rolldownOptions: { input: Record<string, string> } } };
    const input = result.build.rolldownOptions.input;
    expect(input).toEqual({
      index: home,
      courses: join(root, 'courses/index.html'),
      'courses-marathon-de-paris': join(root, 'courses/marathon-de-paris/index.html'),
      'courses-semi-du-samedi': join(root, 'courses/semi-du-samedi/index.html'),
    });
    const id = call(plugin.resolveId, {}, input['courses-marathon-de-paris']);
    expect(id).toBe(join(root, 'courses/marathon-de-paris/index.html'));
    expect(call(plugin.resolveId, {}, `${String(id)}?html-proxy&index=0.js`)).toBeNull();
    expect(call(plugin.resolveId, {}, home)).toBeNull();
    const html = String(call(plugin.load, {}, id));
    expect(title(html)).toBe(`Plan marathon de Paris 2027${NBSP}: ta prépa datée de 24${NBSP}semaines`);

    call(plugin.configResolved, {}, { root, publicDir: '', build: { rolldownOptions: { input } } });
    const emitted: { fileName: string; source: string }[] = [];
    call(plugin.generateBundle, { emitFile: (file: { fileName: string; source: string }) => emitted.push(file) }, {}, {});
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.fileName).toBe('sitemap.xml');
    expect(emitted[0]?.source).toContain(`<loc>${SITE}/courses/semi-du-samedi/</loc>`);
    expect(emitted[0]?.source).toContain(`<loc>${SITE}/</loc>`);
  });

  it('n’ajoute aucune entrée en développement', async () => {
    const plugin = racesPlugin({ siteUrl: SITE, dataFile: 'races.json', now: () => NOW, deps });
    expect(await call(plugin.config, {}, { root }, { command: 'serve', mode: 'development' })).toBeUndefined();
  });

  it('fait échouer le build si les données sont invalides', async () => {
    writeFileSync(join(root, 'bad.json'), JSON.stringify([{ ...PARIS, date: '2027-07-01' }]));
    const plugin = racesPlugin({ siteUrl: SITE, dataFile: 'bad.json', now: () => NOW, deps });
    await expect(call(plugin.config, {}, { root }, { command: 'build', mode: 'production' })).rejects.toThrow(
      /hors de la fenêtre/,
    );
  });

  it('charge le moteur, les libellés et les prix par le module runner de Vite', async () => {
    const loaded = await loadRaceDeps();
    expect(loaded.nominalWeeks).toEqual({ marathon: 24, semi: 20 });
    expect(loaded.minWeeks).toBe(8);
    expect(loaded.levelLabel('marathon', 'l3')).toBe(labels.levelLabel('marathon', 'l3'));
    expect(loaded.priceInfo(NOW).amount).toBe(19);
    const [viaRunner, direct] = [loaded, deps].map((d) =>
      renderRacePages({ deps: d, races: [PARIS], siteUrl: SITE, now: NOW }).map((p) => p.html),
    );
    expect(viaRunner).toEqual(direct);
  }, 30_000);
});
