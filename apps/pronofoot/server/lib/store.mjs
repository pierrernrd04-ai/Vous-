// Stockage (Netlify Blobs) et envoi Web Push (VAPID).
import { getStore } from '@netlify/blobs';
import webpush from 'web-push';
import { APP_URL } from './engine.mjs';

const env = (k) => (globalThis.Netlify?.env?.get(k) ?? process.env[k]);
export const store = () => getStore({ name: 'prono', consistency: 'strong' });

// Clés VAPID : générées par le serveur au premier démarrage et gardées dans Blobs.
// La clé privée ne quitte jamais Netlify. Des variables d'environnement peuvent les remplacer.
let keysPromise = null;
export function vapidKeys(s = store()) {
  if (!keysPromise) {
    keysPromise = (async () => {
      const pub = env('VAPID_PUBLIC_KEY'), priv = env('VAPID_PRIVATE_KEY');
      if (pub && priv) return { publicKey: pub, privateKey: priv };
      let k = await s.get('vapid', { type: 'json' });
      if (!k) {
        await s.setJSON('vapid', webpush.generateVAPIDKeys(), { onlyIfNew: true });
        k = await s.get('vapid', { type: 'json' });
      }
      return k;
    })().catch((e) => { keysPromise = null; throw e; });
  }
  return keysPromise;
}
export const publicKey = async (s) => (await vapidKeys(s)).publicKey;

export async function subKey(endpoint) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return 'sub/' + [...new Uint8Array(h)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function loadSubs(s = store()) {
  const { blobs } = await s.list({ prefix: 'sub/' });
  const out = await Promise.all(blobs.map(async (b) => ({ key: b.key, ...(await s.get(b.key, { type: 'json' })) })));
  return out.filter((x) => x.subscription?.endpoint);
}

/** Envoie une notification ; supprime l'abonnement s'il a expiré. Renvoie true si livrée au service push. */
export async function push(sub, payload, { urgent = false, topic } = {}, s = store()) {
  try {
    const k = await vapidKeys(s);
    await webpush.sendNotification(sub.subscription, JSON.stringify(payload), {
      vapidDetails: { subject: env('VAPID_SUBJECT') || APP_URL, publicKey: k.publicKey, privateKey: k.privateKey },
      TTL: urgent ? 600 : 3600,
      urgency: urgent ? 'high' : 'normal',
      ...(topic ? { topic } : {}),
    });
    return true;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) await s.delete(sub.key);
    else console.error('push', e.statusCode, e.body || e.message);
    return false;
  }
}
