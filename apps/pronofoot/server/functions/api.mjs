// API d'abonnement aux alertes : /api/vapid, /api/subscribe, /api/unsubscribe, /api/test, /api/status.
// CORS ouvert : l'app est servie depuis GitHub Pages, l'API depuis Netlify.
import { store, subKey, push, publicKey } from '../lib/store.mjs';
import { DEFAULT_PREFS } from '../lib/engine.mjs';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'no-store' } });

function cleanPrefs(p = {}) {
  const ids = (a) => (Array.isArray(a) ? a.filter((x) => /^\d{1,12}$/.test(String(x))).map(String).slice(0, 500) : []);
  const bool = (k) => (typeof p[k] === 'boolean' ? p[k] : DEFAULT_PREFS[k]);
  return {
    scope: ['suivis', 'favoris', 'tous'].includes(p.scope) ? p.scope : 'suivis',
    teams: ids(p.teams), matches: ids(p.matches),
    goals: bool('goals'), cards: bool('cards'), kickoff: bool('kickoff'), prematch: bool('prematch'), reminders: bool('reminders'),
  };
}
const validSub = (s) => s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.endpoint.length < 1000 && s.keys?.p256dh && s.keys?.auth;

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const route = new URL(req.url).pathname.replace(/^\/api\//, '');
  const s = store();
  try {
    if (route === 'vapid' && req.method === 'GET') return json({ publicKey: await publicKey(s) });
    if (route === 'status' && req.method === 'GET') {
      const hb = await s.get('heartbeat', { type: 'json' });
      return json({ ok: !!hb && Date.now() - hb.at < 3 * 60e3, ...hb });
    }
    if (req.method !== 'POST') return json({ error: 'not found' }, 404);
    const body = await req.json().catch(() => ({}));
    if (route === 'subscribe') {
      if (!validSub(body.subscription)) return json({ error: 'abonnement invalide' }, 400);
      const key = await subKey(body.subscription.endpoint);
      const prev = await s.get(key, { type: 'json' });
      await s.setJSON(key, { subscription: body.subscription, prefs: cleanPrefs(body.prefs), createdAt: prev?.createdAt || Date.now(), updatedAt: Date.now() });
      return json({ ok: true, created: !prev });
    }
    if (route === 'unsubscribe') {
      if (typeof body.endpoint !== 'string') return json({ error: 'endpoint manquant' }, 400);
      await s.delete(await subKey(body.endpoint));
      return json({ ok: true });
    }
    if (route === 'test') {
      if (typeof body.endpoint !== 'string') return json({ error: 'endpoint manquant' }, 400);
      const key = await subKey(body.endpoint);
      const sub = await s.get(key, { type: 'json' });
      if (!sub) return json({ error: 'abonnement inconnu' }, 404);
      const ok = await push({ key, ...sub }, { title: '⚽ BUT PSG · PSG 1-0 Marseille', body: 'Test du serveur d’alertes : tout fonctionne, même app fermée.', tag: 'test' }, { urgent: true }, s);
      return json({ ok });
    }
    return json({ error: 'not found' }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: 'erreur serveur' }, 500);
  }
};

export const config = { path: '/api/*' };
