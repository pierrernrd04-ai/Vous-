/**
 * Build Vite multi-pages (SPEC section 4).
 *
 * - Entrées : `index.html` à la racine + tout `<dossier>/index.html` de premier niveau.
 * - `__SITE_URL__` dans le HTML est remplacé par l'URL publique (env `SITE_URL`
 *   au build, sinon `config.siteUrl`).
 * - Garde-fou : le build échoue si un module navigateur importe `src/engine/`.
 * - Avertissements si des mentions légales ou les Payment Links restent à renseigner.
 * - Fichiers de `public/` post-traités après écriture (`robots.txt`, `sw.js`,
 *   `manifest.webmanifest`) : `__SITE_URL__`, `__BUILD_ID__` (empreinte du build,
 *   change dès qu'un fichier change) et `__PRECACHE_URLS__` (tableau JSON des URL
 *   émises par Vite, pages en forme `/dossier/`, sans source maps ni pages `/courses/`).
 * - Plugin `races` (build/races-plugin.ts) : pages /courses/<slug>/ et sitemap.xml.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { racesPlugin } from './build/races-plugin.ts';
import { config as baseConfig, type CheckoutOverrides, type SiteConfig } from './src/config.ts';
import { missingLegalFields } from './src/legal.ts';

const ROOT = dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = resolve(ROOT, 'src/engine');

/**
 * Paiement réglable au build (variables d'environnement Cloudflare Pages ou locales),
 * prioritaires sur src/config.ts : `PUBLIC_STRIPE_ENABLED` (true/false),
 * `PUBLIC_PAYMENT_LINK_LAUNCH`, `PUBLIC_PAYMENT_LINK_REGULAR`, `PUBLIC_PAYPAL_URL`.
 * Ces valeurs sont publiques (elles finissent dans le bundle) : jamais de secret ici.
 */
function checkoutOverridesFromEnv(env: NodeJS.ProcessEnv): CheckoutOverrides {
  const overrides: CheckoutOverrides = {};
  const flag = env.PUBLIC_STRIPE_ENABLED?.trim().toLowerCase();
  if (flag === 'true' || flag === '1') overrides.stripeEnabled = true;
  else if (flag === 'false' || flag === '0') overrides.stripeEnabled = false;
  const launch = env.PUBLIC_PAYMENT_LINK_LAUNCH?.trim();
  if (launch) overrides.paymentLinkLaunch = launch;
  const regular = env.PUBLIC_PAYMENT_LINK_REGULAR?.trim();
  if (regular) overrides.paymentLinkRegular = regular;
  const paypal = env.PUBLIC_PAYPAL_URL?.trim();
  if (paypal) overrides.paypalFallbackUrl = paypal;
  return overrides;
}

const CHECKOUT_OVERRIDES = checkoutOverridesFromEnv(process.env);
/** Configuration effective du bundle (src/config.ts + variables `PUBLIC_*`). */
const config: SiteConfig = { ...baseConfig, ...CHECKOUT_OVERRIDES };

const SITE_URL = (process.env.SITE_URL?.trim() || config.siteUrl).replace(/\/+$/, '');

/** Dossiers de premier niveau qui ne sont jamais des pages. */
const NON_PAGE_DIRS = new Set([
  'android',
  'build',
  'coverage',
  'data',
  'dist',
  'docs',
  'functions',
  'ios',
  'node_modules',
  'playwright-report',
  'public',
  'scripts',
  'src',
  'test-results',
  'tests',
]);

/** Pages HTML d'entrée : `index.html` + `<dossier>/index.html`. */
function discoverPages(rootDir: string): Record<string, string> {
  const input: Record<string, string> = {};
  const home = resolve(rootDir, 'index.html');
  if (existsSync(home)) input.index = home;
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || NON_PAGE_DIRS.has(entry.name)) continue;
    const page = resolve(rootDir, entry.name, 'index.html');
    if (existsSync(page)) input[entry.name] = page;
  }
  if (Object.keys(input).length === 0) throw new Error(`Aucune page HTML trouvée dans ${rootDir}`);
  return input;
}

function isInside(dir: string, file: string): boolean {
  return file === dir || file.startsWith(dir + sep);
}

/** Le moteur de plan reste côté serveur : tout import depuis le navigateur fait échouer le build. */
function noEngineInClient(): Plugin {
  return {
    name: 'traceo:no-engine-in-client',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!importer) return null;
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      if (!resolved || resolved.external) return resolved;
      const file = resolve(resolved.id.split('?')[0] ?? resolved.id);
      if (isInside(ENGINE_DIR, file)) {
        const from = importer.startsWith(ROOT) ? importer.slice(ROOT.length + 1) : importer;
        this.error(
          `Import interdit de src/engine/ dans le code navigateur (« ${source} » depuis ${from}). ` +
            'Le plan est calculé par /api/preview et /api/plan ; pour les types, importer src/shared/api-types.ts.',
        );
      }
      return resolved;
    },
  };
}

/** Remplace `__SITE_URL__` dans les pages HTML (canonical, OG…). */
function siteUrlInHtml(siteUrl: string): Plugin {
  return {
    name: 'traceo:site-url',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replaceAll('__SITE_URL__', siteUrl),
    },
  };
}

/**
 * Vrai si un vrai moyen de paiement est activé : Stripe avec au moins un Payment Link réel
 * (les liens de test Stripe contiennent `/test_`), ou PayPal.
 */
function sellsForReal(effective: SiteConfig): boolean {
  const isTestLink = (url: string): boolean => url.includes('/test_');
  const stripeLinks = [effective.paymentLinkLaunch, effective.paymentLinkRegular].filter((url) => url.length > 0);
  const realStripe = effective.stripeEnabled && stripeLinks.some((url) => !isTestLink(url));
  const paypal = !effective.stripeEnabled && effective.paypalFallbackUrl.length > 0;
  return realStripe || paypal;
}

/**
 * Vérifie au build les informations obligatoires avant la mise en vente. Mentions
 * manquantes : simple avertissement tant que rien n'est vendu (aperçu, tests), mais le
 * build échoue dès qu'un vrai moyen de paiement est activé (art. L111-1, L221-5, L616-1
 * du code de la consommation, art. 1-1 LCEN).
 */
function launchChecklist(): Plugin {
  return {
    name: 'traceo:launch-checklist',
    apply: 'build',
    configResolved(resolved) {
      const warnings: string[] = [];
      const legalMissing = missingLegalFields();
      if (legalMissing.length > 0 && sellsForReal(config)) {
        throw new Error(
          `Mentions légales incomplètes alors que le paiement est activé : ${legalMissing.join(', ')}. ` +
            'Renseigne src/legal.ts (adresse, e-mail, téléphone, SIREN, médiateur) avant toute vente.',
        );
      }
      if (legalMissing.length > 0) {
        warnings.push(`src/legal.ts : valeurs « À COMPLÉTER » → ${legalMissing.join(', ')}`);
      }
      if (config.stripeEnabled && (!config.paymentLinkLaunch || !config.paymentLinkRegular)) {
        warnings.push('src/config.ts : stripeEnabled est vrai mais un Payment Link est vide.');
      }
      if (!config.stripeEnabled && !config.paypalFallbackUrl) {
        warnings.push('src/config.ts : ni Stripe (stripeEnabled) ni PayPal (paypalFallbackUrl) : aucun moyen de paiement.');
      }
      for (const warning of warnings) resolved.logger.warn(`⚠ ${warning}`);
    },
  };
}

/** URL servie pour un fichier émis : `plan/index.html` → `/plan/`. */
function publicUrl(fileName: string): string {
  if (fileName === 'index.html') return '/';
  if (fileName.endsWith('/index.html')) return `/${fileName.slice(0, -'index.html'.length)}`;
  return `/${fileName}`;
}

/**
 * Pré-cache du service worker : le shell de l'application. Les pages SEO `/courses/…`
 * (une par course) et le sitemap n'y entrent pas, pour ne pas télécharger ~500 Ko à
 * l'installation ; une page de course visitée reste mise en cache par le service worker.
 */
function isPrecached(url: string): boolean {
  return !url.startsWith('/courses/') && url !== '/sitemap.xml';
}

/** Post-traite les fichiers texte de public/ copiés dans dist/ (voir l'en-tête). */
function publicPlaceholders(siteUrl: string): Plugin {
  const TARGETS = ['robots.txt', 'sw.js', 'manifest.webmanifest'];
  let outDir = '';
  return {
    name: 'traceo:public-placeholders',
    apply: 'build',
    configResolved(resolved) {
      outDir = resolve(resolved.root, resolved.build.outDir);
    },
    writeBundle(_options, bundle) {
      const hash = createHash('sha256');
      const urls: string[] = [];
      for (const fileName of Object.keys(bundle).sort()) {
        const output = bundle[fileName];
        if (!output) continue;
        hash.update(fileName);
        hash.update(output.type === 'chunk' ? output.code : output.source);
        if (fileName.endsWith('.map')) continue;
        const url = publicUrl(fileName);
        if (isPrecached(url)) urls.push(url);
      }
      const targets = TARGETS.map((name) => resolve(outDir, name)).filter((file) => existsSync(file));
      for (const file of targets) hash.update(readFileSync(file));
      const buildId = hash.digest('hex').slice(0, 12);

      for (const file of targets) {
        const source = readFileSync(file, 'utf8');
        const next = source
          .replaceAll('__SITE_URL__', siteUrl)
          .replaceAll('__BUILD_ID__', buildId)
          .replaceAll('__PRECACHE_URLS__', JSON.stringify(urls));
        if (next !== source) writeFileSync(file, next);
      }
    },
  };
}

export default defineConfig({
  root: ROOT,
  appType: 'mpa',
  publicDir: 'public',
  define: {
    __CHECKOUT_OVERRIDES__: JSON.stringify(CHECKOUT_OVERRIDES),
  },
  plugins: [
    noEngineInClient(),
    siteUrlInHtml(SITE_URL),
    launchChecklist(),
    racesPlugin({ siteUrl: SITE_URL }),
    publicPlaceholders(SITE_URL),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      input: discoverPages(ROOT),
    },
  },
  server: {
    // `npm run pages:dev` (wrangler, port 8788) sert les Functions ; `npm run dev` les relaie.
    proxy: {
      '/api': process.env.API_ORIGIN ?? 'http://127.0.0.1:8788',
    },
  },
});
