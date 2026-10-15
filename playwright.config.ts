/**
 * Tests de bout en bout (tests/e2e) sur Chromium, écran mobile 360 × 740.
 *
 * Par défaut, construit le site puis le sert avec `wrangler pages dev` (Functions
 * comprises) sur le port 8788. Si un serveur répond déjà sur ce port (hors CI), il est
 * réutilisé : il doit alors servir un `dist/` construit avec les variables `PUBLIC_*`
 * ci-dessous (paiement Stripe factice, pour tester la fenêtre d'achat) et le même
 * `TOKEN_SECRET`.
 *
 * Secret des jetons de test : `E2E_TOKEN_SECRET`, sinon `TOKEN_SECRET` de `.dev.vars`,
 * sinon un secret réservé aux tests. `E2E_TOKEN` permet de fournir un jeton tout fait
 * (ex. sortie de `npm run token`).
 * `E2E_BASE_URL=https://… npm run e2e` vise un site déjà déployé (pas de serveur local).
 * `E2E_SCREENSHOTS=1` enregistre les captures 360 px dans docs/screenshots/.
 */
import { existsSync, readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 8788);
const LOCAL_URL = `http://127.0.0.1:${PORT}`;
const BASE_URL = process.env.E2E_BASE_URL ?? LOCAL_URL;

/** `TOKEN_SECRET` du fichier `.dev.vars` local, s'il existe (format `CLÉ=valeur`). */
function devVarsSecret(): string | undefined {
  if (!existsSync('.dev.vars')) return undefined;
  for (const line of readFileSync('.dev.vars', 'utf8').split(/\r?\n/)) {
    const match = /^\s*TOKEN_SECRET\s*=\s*(.*?)\s*$/.exec(line);
    if (match?.[1]) return match[1].replace(/^(["'])(.*)\1$/, '$2');
  }
  return undefined;
}

// Secret réservé aux tests (≥ 32 caractères), jamais utilisé en production.
process.env.E2E_TOKEN_SECRET ??= devVarsSecret() ?? 'e2e-secret-only-for-local-tests-0123456789';
const TOKEN_SECRET = process.env.E2E_TOKEN_SECRET;

/** Paiement factice pour le build de test : la fenêtre d'achat affiche le bouton Stripe. */
const E2E_CHECKOUT_ENV = {
  PUBLIC_STRIPE_ENABLED: 'true',
  PUBLIC_PAYMENT_LINK_LAUNCH: 'https://buy.stripe.com/test_e2e_lancement',
  PUBLIC_PAYMENT_LINK_REGULAR: 'https://buy.stripe.com/test_e2e_normal',
} as const;

// Chromium préinstallé : la version de @playwright/test correspond à la révision
// présente dans PLAYWRIGHT_BROWSERS_PATH ; sinon, repli sur le binaire de /opt.
const FALLBACK_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(FALLBACK_CHROMIUM) ? FALLBACK_CHROMIUM : undefined);

const bindings = [
  `TOKEN_SECRET=${TOKEN_SECRET}`,
  `SITE_URL=${LOCAL_URL}`,
  'PAYMENT_LINK_IDS=plink_test_x',
  'STRIPE_KEY=rk_test_e2e_unused',
]
  .map((binding) => `--binding ${binding}`)
  .join(' ');

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: BASE_URL,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    // Le service worker est testé à la main (hors ligne) ; ici, il fausserait page.route().
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 360, height: 740 },
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command:
          `npm run build && npx wrangler pages dev dist --ip 127.0.0.1 --port ${PORT} ` +
          `--compatibility-date=2026-09-01 ${bindings}`,
        url: LOCAL_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: 'pipe',
        env: { WRANGLER_SEND_METRICS: 'false', SITE_URL: LOCAL_URL, ...E2E_CHECKOUT_ENV },
      },
});
