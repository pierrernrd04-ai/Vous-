import { describe, expect, it } from 'vitest';
import {
  TOKEN_EXP_SEC,
  TOKEN_MAX_LENGTH,
  TOKEN_VERSION,
  base64urlDecode,
  base64urlEncode,
  buildTokenPayload,
  readTokenPayloadUnverified,
  signToken,
  timingSafeEqual,
  verifyToken,
  type TokenPayload,
} from '../../src/shared/token';
import { NOW_SEC, TEST_SECRET } from './helpers';

const OTHER_SECRET = 'un-autre-secret-0123456789-abcdefghijklmnop';

function payload(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    v: 1,
    sub: 'coureuse@example.fr',
    sid: 'cs_live_a1B2c3D4',
    ref: 'w1-marathon-l2',
    iat: NOW_SEC,
    exp: TOKEN_EXP_SEC,
    ...overrides,
  };
}

/** Signe une partie 1 arbitraire avec HMAC-SHA256, pour fabriquer des jetons « bien signés mais invalides ». */
async function signRaw(body: string, secret = TEST_SECRET): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  return `${body}.${base64urlEncode(sig)}`;
}

function encodeJson(value: unknown): string {
  return base64urlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

describe('constantes', () => {
  it('expire le 30/06/2027 à 23:59:59, heure de Paris', () => {
    expect(TOKEN_EXP_SEC).toBe(Date.UTC(2027, 5, 30, 21, 59, 59) / 1000);
    expect(TOKEN_VERSION).toBe(1);
  });

  it('buildTokenPayload fixe la version et l’expiration', () => {
    expect(buildTokenPayload({ email: 'a@b.fr', sid: 'cs_test_x', nowSec: 100 })).toEqual({
      v: 1,
      sub: 'a@b.fr',
      sid: 'cs_test_x',
      ref: '',
      iat: 100,
      exp: TOKEN_EXP_SEC,
    });
  });
});

describe('signToken / verifyToken', () => {
  it('aller-retour : le payload est restitué à l’identique', async () => {
    const token = await signToken(payload(), TEST_SECRET);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
    await expect(verifyToken(token, TEST_SECRET, NOW_SEC)).resolves.toEqual(payload());
  });

  it('partie 1 = base64url du JSON du payload, clés dans l’ordre v, sub, sid, ref, iat, exp', async () => {
    const token = await signToken({ exp: TOKEN_EXP_SEC, iat: 1, ref: '', sid: 's', sub: 'x@y.fr', v: 1 }, TEST_SECRET);
    const [body = ''] = token.split('.');
    const json = new TextDecoder().decode(base64urlDecode(body) ?? new Uint8Array());
    expect(json).toBe(`{"v":1,"sub":"x@y.fr","sid":"s","ref":"","iat":1,"exp":${TOKEN_EXP_SEC}}`);
  });

  it('est déterministe et gère les caractères non ASCII', async () => {
    const p = payload({ sub: 'éloïse.müller@exemple.fr' });
    const a = await signToken(p, TEST_SECRET);
    expect(await signToken(p, TEST_SECRET)).toBe(a);
    expect((await verifyToken(a, TEST_SECRET, NOW_SEC))?.sub).toBe('éloïse.müller@exemple.fr');
  });

  it('accepte un id PayPal comme sid et une référence vide', async () => {
    const p = payload({ sid: 'paypal:5TY12345AB678901C', ref: '', sub: '' });
    await expect(verifyToken(await signToken(p, TEST_SECRET), TEST_SECRET, NOW_SEC)).resolves.toEqual(p);
  });

  it('refuse un payload modifié (signature d’origine conservée)', async () => {
    const token = await signToken(payload(), TEST_SECRET);
    const signature = token.split('.')[1];
    const forged = `${encodeJson(payload({ sub: 'pirate@example.fr' }))}.${signature}`;
    await expect(verifyToken(forged, TEST_SECRET, NOW_SEC)).resolves.toBeNull();
  });

  it('refuse toute altération d’un caractère, dans le payload comme dans la signature', async () => {
    const token = await signToken(payload(), TEST_SECRET);
    for (const index of [0, 5, token.indexOf('.') - 1, token.indexOf('.') + 1, token.length - 2]) {
      const original = token.charAt(index);
      const replacement = original === 'A' ? 'B' : 'A';
      const altered = token.slice(0, index) + replacement + token.slice(index + 1);
      await expect(verifyToken(altered, TEST_SECRET, NOW_SEC), `index ${index}`).resolves.toBeNull();
    }
  });

  it('refuse une signature encodée de façon non canonique', async () => {
    const token = await signToken(payload(), TEST_SECRET);
    const last = token.charAt(token.length - 1);
    // 43 caractères pour 32 octets : les 2 derniers bits du dernier caractère sont du remplissage.
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const variant = alphabet.charAt(alphabet.indexOf(last) | 1);
    expect(variant).not.toBe(last);
    await expect(verifyToken(token.slice(0, -1) + variant, TEST_SECRET, NOW_SEC)).resolves.toBeNull();
  });

  it('refuse un jeton signé avec un autre secret', async () => {
    const token = await signToken(payload(), OTHER_SECRET);
    await expect(verifyToken(token, TEST_SECRET, NOW_SEC)).resolves.toBeNull();
  });

  it('expire à exp (inclus) et reste valide juste avant', async () => {
    const token = await signToken(payload(), TEST_SECRET);
    await expect(verifyToken(token, TEST_SECRET, TOKEN_EXP_SEC - 1)).resolves.not.toBeNull();
    await expect(verifyToken(token, TEST_SECRET, TOKEN_EXP_SEC)).resolves.toBeNull();
    await expect(verifyToken(token, TEST_SECRET, TOKEN_EXP_SEC + 86_400)).resolves.toBeNull();
  });

  it('utilise l’heure courante par défaut', async () => {
    const expired = await signToken(payload({ iat: 1000, exp: 2000 }), TEST_SECRET);
    await expect(verifyToken(expired, TEST_SECRET)).resolves.toBeNull();
    const farFuture = await signToken(payload({ exp: 4_102_444_800 }), TEST_SECRET);
    await expect(verifyToken(farFuture, TEST_SECRET)).resolves.not.toBeNull();
  });

  it('refuse les jetons mal formés sans lever d’exception', async () => {
    const valid = await signToken(payload(), TEST_SECRET);
    const malformed = [
      '',
      'abc',
      '.',
      `${valid}.`,
      `.${valid}`,
      `${valid}.${valid.split('.')[1]}`,
      valid.replace('.', '..'),
      `${valid.split('.')[0]}=.${valid.split('.')[1]}`,
      valid.replace(/-/g, '+').replace(/_/g, '/') + '+',
      `a${valid}`.slice(0, TOKEN_MAX_LENGTH + 1).padEnd(TOKEN_MAX_LENGTH + 1, 'A'),
      ` ${valid}`,
    ];
    for (const token of malformed) {
      await expect(verifyToken(token, TEST_SECRET, NOW_SEC), token.slice(0, 20)).resolves.toBeNull();
    }
    // Types inattendus (ex. corps JSON non contrôlé).
    for (const value of [undefined, null, 42, {}, ['a.b']]) {
      await expect(verifyToken(value as unknown as string, TEST_SECRET, NOW_SEC)).resolves.toBeNull();
    }
  });

  it('refuse un payload bien signé mais invalide', async () => {
    const bodies = [
      base64urlEncode(new TextEncoder().encode('pas du json')),
      base64urlEncode(new Uint8Array([0xff, 0xfe, 0xfd])),
      encodeJson(null),
      encodeJson([1, 2]),
      encodeJson({ ...payload(), v: 2 }),
      encodeJson({ ...payload(), sid: '' }),
      encodeJson({ ...payload(), iat: '1' }),
      encodeJson({ ...payload(), exp: 1.5 }),
      encodeJson({ ...payload(), exp: NOW_SEC - 10, iat: NOW_SEC }),
      encodeJson({ v: 1, sub: 'a@b.fr', sid: 'x', iat: 1, exp: TOKEN_EXP_SEC }),
    ];
    for (const body of bodies) {
      await expect(verifyToken(await signRaw(body), TEST_SECRET, NOW_SEC)).resolves.toBeNull();
    }
  });

  it('ne restitue jamais de champ inconnu', async () => {
    const token = await signRaw(encodeJson({ ...payload(), admin: true }));
    const result = await verifyToken(token, TEST_SECRET, NOW_SEC);
    expect(result).toEqual(payload());
    expect(result).not.toHaveProperty('admin');
  });

  it('exige un secret d’au moins 32 caractères', async () => {
    const short = 'trop-court';
    await expect(signToken(payload(), short)).rejects.toThrow(RangeError);
    const token = await signToken(payload(), TEST_SECRET);
    await expect(verifyToken(token, TEST_SECRET.slice(0, 31), NOW_SEC)).resolves.toBeNull();
  });

  it('refuse de signer un payload invalide', async () => {
    const invalid: unknown[] = [
      { ...payload(), v: 2 },
      { ...payload(), exp: NOW_SEC },
      { ...payload(), sid: '' },
      { ...payload(), ref: 'x'.repeat(201) },
      { ...payload(), iat: -1 },
    ];
    for (const p of invalid) {
      await expect(signToken(p as TokenPayload, TEST_SECRET)).rejects.toThrow(TypeError);
    }
  });
});

describe('readTokenPayloadUnverified', () => {
  it('lit le payload sans vérifier signature ni expiration', async () => {
    const token = await signToken(payload({ iat: 1, exp: 2 }), OTHER_SECRET);
    expect(readTokenPayloadUnverified(token)).toEqual(payload({ iat: 1, exp: 2 }));
    expect(readTokenPayloadUnverified('n.importe.quoi')).toBeNull();
    expect(readTokenPayloadUnverified('%%%.abc')).toBeNull();
  });
});

describe('base64url', () => {
  it('correspond à Buffer (base64url) pour toutes les longueurs', () => {
    for (let length = 0; length <= 70; length++) {
      const bytes = new Uint8Array(length).map((_, i) => (i * 37 + length * 11) & 0xff);
      const encoded = base64urlEncode(bytes);
      expect(encoded).toBe(Buffer.from(bytes).toString('base64url'));
      if (length > 0) expect(base64urlDecode(encoded)).toEqual(bytes);
    }
  });

  it('refuse le remplissage, l’alphabet standard et les longueurs impossibles', () => {
    expect(base64urlDecode('')).toBeNull();
    expect(base64urlDecode('QQ==')).toBeNull();
    expect(base64urlDecode('a+b/')).toBeNull();
    expect(base64urlDecode('abcde')).toBeNull();
    expect(base64urlDecode('QR')).toBeNull(); // bits de remplissage non nuls
    expect(base64urlDecode('QQ')).toEqual(new Uint8Array([0x41]));
  });
});

describe('timingSafeEqual', () => {
  it('compare le contenu et la longueur', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array(), new Uint8Array())).toBe(true);
  });
});
