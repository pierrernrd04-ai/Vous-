/**
 * Tests de bout en bout (tests/e2e) sur Chromium, écran mobile 360 px.
 *
 * Par défaut, construit le site puis le sert avec `wrangler pages dev` (Functions
 * comprises) sur le port 8788, avec des secrets de test.
 * `E2E_BASE_URL=https://… npm run e2e` vise un site déjà déployé (pas de serveur local).
 * Les tests peuvent signer leurs jetons avec `process.env.E2E_TOKEN_SECRET`.
 */
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 8788);
const LOCAL_URL = `http://127.0.0.1:${PORT}`;
const BASE_URL = process.env.E2E_BASE_URL ?? LOCAL_URL;

// Secret réservé aux tests (≥ 32 caractères), jamais utilisé en production.
process.env.E2E_TOKEN_SECRET ??= 'e2e-secret-only-for-local-tests-0123456789';
const TOKEN_SECRET = process.env.E2E_TOKEN_SECRET;

// Chromium préinstallé : la version de @playwright/test correspond à la révision
// présente dans PLAYWRIGHT_BROWSERS_PATH ; sinon, repli sur le binaire de /opt.
const FALLBACK_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(FALLBACK_CHROMIUM) ? FALLBACK_CHROMIUM : undefined);

const bindings = [
  `TOKEN_SECRET=${TOKEN_SECRET}`,
  `SITE_URL=${LOCAL_URL}`,
  'PAYMENT_LINK_IDS=plink_e2e_launch,plink_e2e_regular',
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
  expect: { timeout: 5_000 },
  use: {
    baseURL: BASE_URL,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 360, height: 780 },
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
        env: { WRANGLER_SEND_METRICS: 'false', SITE_URL: LOCAL_URL },
      },
});
