/**
 * scripts/token.mjs : ses jetons doivent passer `verifyToken` (même algorithme que
 * src/shared/token.ts), en appel direct comme en ligne de commande.
 */
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  TOKEN_EXP_SEC,
  TOKEN_SECRET_MIN_LENGTH,
  TOKEN_VERSION,
  signToken,
  unixNow,
  verifyToken,
  type TokenPayload,
} from '../../src/shared/token';
import { NOW_SEC, TEST_SECRET } from './helpers';

const SCRIPT = fileURLToPath(new URL('../../scripts/token.mjs', import.meta.url));

/** Surface exportée par le script (module JavaScript sans déclaration de types). */
interface TokenScript {
  TOKEN_VERSION: number;
  TOKEN_EXP_SEC: number;
  TOKEN_SECRET_MIN_LENGTH: number;
  createToken(options: { email: string; ref?: string; secret: string; nowSec?: number }): Promise<string>;
  buildPayload(fields: { email: string; ref?: string; nowSec?: number }): TokenPayload;
  parseDevVars(text: string): Record<string, string>;
  normalizeSiteUrl(raw: string): string;
  planLink(siteUrl: string, token: string): string;
}

let script: TokenScript;
let tmp: string;

beforeAll(async () => {
  const specifier = pathToFileURL(SCRIPT).href;
  script = (await import(/* @vite-ignore */ specifier)) as TokenScript;
  tmp = mkdtempSync(join(tmpdir(), 'token-script-'));
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Lance le script dans un environnement minimal (aucune variable héritée par accident). */
function run(args: string[], env: Record<string, string>): Promise<RunResult> {
  return new Promise((resolvePromise) => {
    execFile(
      process.execPath,
      [SCRIPT, ...args],
      {
        env: { PATH: process.env.PATH ?? '', DEV_VARS_FILE: join(tmp, 'absent.dev.vars'), ...env },
        timeout: 15_000,
      },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
        resolvePromise({ code, stdout, stderr });
      },
    );
  });
}

function extractLink(stdout: string): { link: string; token: string } {
  const match = /^(https?:\/\/\S+\/plan\/#t=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+))$/m.exec(stdout);
  expect(match, stdout).not.toBeNull();
  return { link: match?.[1] ?? '', token: match?.[2] ?? '' };
}

const stillIssuable = unixNow() < TOKEN_EXP_SEC;

describe('scripts/token.mjs — module', () => {
  it('partage les constantes de src/shared/token.ts', () => {
    expect(script.TOKEN_VERSION).toBe(TOKEN_VERSION);
    expect(script.TOKEN_EXP_SEC).toBe(TOKEN_EXP_SEC);
    expect(script.TOKEN_SECRET_MIN_LENGTH).toBe(TOKEN_SECRET_MIN_LENGTH);
  });

  it('produit un jeton accepté par verifyToken', async () => {
    const token = await script.createToken({
      email: 'acheteur@exemple.fr',
      ref: '5TY12345AB678901C',
      secret: TEST_SECRET,
      nowSec: NOW_SEC,
    });
    await expect(verifyToken(token, TEST_SECRET, NOW_SEC)).resolves.toEqual({
      v: 1,
      sub: 'acheteur@exemple.fr',
      sid: 'paypal:5TY12345AB678901C',
      ref: '5TY12345AB678901C',
      iat: NOW_SEC,
      exp: TOKEN_EXP_SEC,
    });
    await expect(verifyToken(token, `${TEST_SECRET}x`, NOW_SEC)).resolves.toBeNull();
  });

  it('produit exactement le même jeton que signToken', async () => {
    const payload = script.buildPayload({ email: ' support@exemple.fr ', nowSec: NOW_SEC });
    expect(payload).toEqual({
      v: 1,
      sub: 'support@exemple.fr',
      sid: `paypal:manuel-${NOW_SEC}`,
      ref: '',
      iat: NOW_SEC,
      exp: TOKEN_EXP_SEC,
    });
    const fromScript = await script.createToken({
      email: ' support@exemple.fr ',
      secret: TEST_SECRET,
      nowSec: NOW_SEC,
    });
    expect(fromScript).toBe(await signToken(payload, TEST_SECRET));
  });

  it('valide e-mail, référence, secret et date', async () => {
    expect(() => script.buildPayload({ email: 'pas-un-email', nowSec: NOW_SEC })).toThrow(/e-mail/);
    expect(() => script.buildPayload({ email: 'a@b.fr', ref: 'avec espace', nowSec: NOW_SEC })).toThrow(/Référence/);
    expect(() => script.buildPayload({ email: 'a@b.fr', nowSec: TOKEN_EXP_SEC })).toThrow(/30\/06\/2027/);
    await expect(script.createToken({ email: 'a@b.fr', secret: 'court', nowSec: NOW_SEC })).rejects.toThrow(
      /32 caractères/,
    );
  });

  it('lit le format .dev.vars et normalise SITE_URL', () => {
    expect(
      script.parseDevVars(
        [
          '# commentaire',
          'TOKEN_SECRET="avec des guillemets # pas un commentaire"',
          "SITE_URL='https://exemple.fr/'",
          'export AUTRE = valeur   # commentaire de fin',
          'ligne invalide',
          '',
        ].join('\r\n'),
      ),
    ).toEqual({
      TOKEN_SECRET: 'avec des guillemets # pas un commentaire',
      SITE_URL: 'https://exemple.fr/',
      AUTRE: 'valeur',
    });
    expect(script.normalizeSiteUrl('https://traceo-pass.pages.dev///')).toBe('https://traceo-pass.pages.dev');
    expect(script.planLink('https://x.fr', 'a.b')).toBe('https://x.fr/plan/#t=a.b');
    expect(() => script.normalizeSiteUrl('ftp://x.fr')).toThrow();
    expect(() => script.normalizeSiteUrl('pas une url')).toThrow();
  });
});

describe.skipIf(!stillIssuable)('scripts/token.mjs — ligne de commande', () => {
  it('imprime le jeton et le lien SITE_URL/plan/#t=<jeton>, vérifiable', async () => {
    const result = await run(['acheteur@exemple.fr', 'w1-marathon-l2'], {
      TOKEN_SECRET: TEST_SECRET,
      SITE_URL: 'https://traceo-pass.pages.dev/',
    });
    expect(result.code, result.stderr).toBe(0);
    const { link, token } = extractLink(result.stdout);
    expect(link).toBe(`https://traceo-pass.pages.dev/plan/#t=${token}`);
    expect(result.stdout.split('\n')).toContain(token);

    const payload = await verifyToken(token, TEST_SECRET);
    expect(payload).toMatchObject({ v: 1, sub: 'acheteur@exemple.fr', ref: 'w1-marathon-l2', exp: TOKEN_EXP_SEC });
    expect(result.stdout + result.stderr).not.toContain(TEST_SECRET);
  });

  it('se rabat sur .dev.vars et le signale', async () => {
    const devVars = join(tmp, '.dev.vars');
    writeFileSync(devVars, `TOKEN_SECRET=${TEST_SECRET}\nSITE_URL=http://127.0.0.1:8788\n`);
    const result = await run(['dev@exemple.fr'], { DEV_VARS_FILE: devVars });
    expect(result.code, result.stderr).toBe(0);
    const { link, token } = extractLink(result.stdout);
    expect(link.startsWith('http://127.0.0.1:8788/plan/#t=')).toBe(true);
    expect(result.stderr).toContain('.dev.vars');
    expect((await verifyToken(token, TEST_SECRET))?.sub).toBe('dev@exemple.fr');
  });

  it('l’environnement prime sur .dev.vars', async () => {
    const devVars = join(tmp, 'prime.dev.vars');
    writeFileSync(devVars, `TOKEN_SECRET=secret-local-0123456789-abcdefghijklmnop\nSITE_URL=http://127.0.0.1:8788\n`);
    const result = await run(['a@b.fr'], {
      DEV_VARS_FILE: devVars,
      TOKEN_SECRET: TEST_SECRET,
      SITE_URL: 'https://prod.exemple.fr',
    });
    const { link, token } = extractLink(result.stdout);
    expect(link.startsWith('https://prod.exemple.fr/plan/#t=')).toBe(true);
    await expect(verifyToken(token, TEST_SECRET)).resolves.not.toBeNull();
  });

  it.each([
    ['sans argument', [], {}, /Usage/],
    ['TOKEN_SECRET absent', ['a@b.fr'], {}, /TOKEN_SECRET est introuvable/],
    ['TOKEN_SECRET trop court', ['a@b.fr'], { TOKEN_SECRET: 'court' }, /32 caractères/],
    ['e-mail invalide', ['pas-un-email'], { TOKEN_SECRET: TEST_SECRET }, /e-mail invalide/],
    ['référence invalide', ['a@b.fr', 'réf/€'], { TOKEN_SECRET: TEST_SECRET }, /Référence invalide/],
  ] as [string, string[], Record<string, string>, RegExp][])(
    'échoue proprement : %s',
    async (_label, args, env, message) => {
      const result = await run(args, env);
      expect(result.code).toBe(1);
      expect(result.stderr).toMatch(message);
      expect(result.stdout).not.toMatch(/#t=/);
    },
  );
});
