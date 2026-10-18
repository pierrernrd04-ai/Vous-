// Sauvegarde en ligne du tracker « Routine & Performance » (Cloudflare Pages Function + D1).
//
//   GET    /api/state                 → { ok, now }           (vérifie la clé)
//   GET    /api/state?since=<ms>      → { now, docs: [...] }  (documents modifiés depuis <ms>)
//   GET    /api/state?path=<chemin>   → { doc }               (un document)
//   PUT    /api/state  { path, body } → { updated }
//   DELETE /api/state?path=<chemin>   → { updated }
//
// Authentification : en-tête x-key. Seules les clés dont l'empreinte SHA-256 figure dans
// ALLOWED_SHA (wrangler.toml, liste séparée par des virgules) sont acceptées. Chaque clé a
// son propre espace de données (owner = empreinte de la clé).

const MAX_BODY = 1_900_000;
let ready = null;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function ensureTable(db) {
  ready ??= db
    .batch([
      db.prepare(
        'CREATE TABLE IF NOT EXISTS docs (owner TEXT NOT NULL, path TEXT NOT NULL, body TEXT, updated INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (owner, path))',
      ),
      db.prepare('CREATE INDEX IF NOT EXISTS docs_updated ON docs (owner, updated)'),
    ])
    .catch((err) => {
      ready = null;
      throw err;
    });
  return ready;
}

function validPath(path) {
  return typeof path === 'string' && path.length > 0 && path.length <= 300 && !path.includes('..');
}

export async function onRequest({ request, env }) {
  const key = request.headers.get('x-key') || '';
  if (key.length < 8) return json({ error: 'unauthorized' }, 401);
  const owner = await sha256(key);
  const allowed = String(env.ALLOWED_SHA || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowed.includes(owner)) return json({ error: 'unauthorized' }, 401);
  if (!env.DB) return json({ error: 'no_database' }, 500);

  try {
    await ensureTable(env.DB);
    const url = new URL(request.url);
    const now = Date.now();

    if (request.method === 'GET') {
      const path = url.searchParams.get('path');
      if (path) {
        const row = await env.DB.prepare('SELECT body, updated, deleted FROM docs WHERE owner = ? AND path = ?')
          .bind(owner, path)
          .first();
        return json({ now, doc: row && !row.deleted ? { body: JSON.parse(row.body), updated: row.updated } : null });
      }
      const since = Number(url.searchParams.get('since'));
      if (!url.searchParams.has('since') || !Number.isFinite(since)) return json({ ok: true, now });
      const { results } = await env.DB.prepare(
        'SELECT path, body, updated, deleted FROM docs WHERE owner = ? AND updated > ? ORDER BY updated LIMIT 3000',
      )
        .bind(owner, since)
        .all();
      return json({
        now,
        docs: results.map((r) => ({
          path: r.path,
          updated: r.updated,
          deleted: !!r.deleted,
          body: r.deleted ? null : JSON.parse(r.body),
        })),
      });
    }

    if (request.method === 'PUT' || request.method === 'POST') {
      const text = await request.text();
      if (text.length > MAX_BODY) return json({ error: 'too_large' }, 413);
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return json({ error: 'invalid_json' }, 400);
      }
      if (!data || !validPath(data.path) || typeof data.body !== 'object' || data.body === null) {
        return json({ error: 'invalid_request' }, 400);
      }
      await env.DB.prepare(
        'INSERT INTO docs (owner, path, body, updated, deleted) VALUES (?, ?, ?, ?, 0) ' +
          'ON CONFLICT (owner, path) DO UPDATE SET body = excluded.body, updated = excluded.updated, deleted = 0',
      )
        .bind(owner, data.path, JSON.stringify(data.body), now)
        .run();
      return json({ updated: now });
    }

    if (request.method === 'DELETE') {
      const path = url.searchParams.get('path');
      if (!validPath(path)) return json({ error: 'invalid_request' }, 400);
      await env.DB.prepare('UPDATE docs SET body = NULL, deleted = 1, updated = ? WHERE owner = ? AND path = ?')
        .bind(now, owner, path)
        .run();
      return json({ updated: now });
    }

    return json({ error: 'method_not_allowed' }, 405);
  } catch (err) {
    return json({ error: 'server_error', message: String((err && err.message) || err).slice(0, 200) }, 500);
  }
}
