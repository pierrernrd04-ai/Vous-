/* Version web : analyse photo de l'assiette et tri automatique des photos, sans l'appli Claude.
   Dans Claude, l'appli obtient ces fonctions par window.claude.use('sample'). Ici, shim.js lui donne
   un objet équivalent qui charge ce fichier au premier usage et appelle l'API Claude avec la clé
   personnelle de l'utilisateur. Regroupé avec le SDK par build.mjs (esbuild) dans public/ai.js. */
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5-5';
// assiette : estimation détaillée ; tri des planches de photos : un simple oui/non par photo
const EFFORT = { default: 'medium', quick: 'low' };
const MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const SYSTEM = 'Réponds uniquement avec un objet JSON valide, sans balises Markdown ni texte autour.';

let client = null, clientKey = '', noFallback = false;

function clientFor(key) {
  if (!client || clientKey !== key) {
    client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, timeout: 120000, maxRetries: 2 });
    clientKey = key;
  }
  return client;
}

function base64(blob) {
  return new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] || '');
    r.onerror = () => ko(r.error);
    r.readAsDataURL(blob);
  });
}

function parseJson(text) {
  const t = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try { return JSON.parse(t); } catch {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
  throw { code: 'invalid_json' };
}

/* erreurs du SDK → codes que l'appli sait afficher */
function codeOf(e) {
  if (e instanceof Anthropic.APIUserAbortError) return { code: 'cancelled' };
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return { code: 'ai_key_bad' };
  if (e instanceof Anthropic.RateLimitError) return { code: 'rate_limited' };
  if (e instanceof Anthropic.BadRequestError) {
    if (/credit|billing|balance/i.test(e.message)) return { code: 'ai_credit' };
    if (/image/i.test(e.message)) return { code: 'image_rejected' };
    return { code: 'upstream_error' };
  }
  if (e instanceof Anthropic.APIConnectionTimeoutError) return { code: 'upstream_error' };
  if (e instanceof Anthropic.APIConnectionError) return { code: 'offline' };
  if (e instanceof Anthropic.APIError && e.status === 402) return { code: 'ai_credit' };
  return { code: 'upstream_error' }; // Claude surchargé ou erreur passagère
}

/* repli automatique sur un autre modèle si Claude décline ; sans ce réglage si le compte ne l'accepte pas */
async function create(c, body, signal) {
  if (!noFallback) {
    try {
      return await c.beta.messages.create({ ...body, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, { signal });
    } catch (e) {
      if (!(e instanceof Anthropic.BadRequestError) || !/fallback|beta/i.test(e.message)) throw e;
      noFallback = true;
    }
  }
  return c.messages.create(body, { signal });
}

async function json(prompt, opts, key) {
  const content = [];
  try {
    for (const im of opts.images || []) {
      content.push({ type: 'image', source: { type: 'base64', media_type: MEDIA.includes(im.type) ? im.type : 'image/jpeg', data: await base64(im) } });
    }
  } catch { throw { code: 'image_rejected' }; }
  content.push({ type: 'text', text: prompt });
  let msg;
  try {
    msg = await create(clientFor(key), {
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: EFFORT[opts.modelTier] || 'medium' },
      messages: [{ role: 'user', content }],
    }, opts.signal);
  } catch (e) { throw codeOf(e); }
  if (msg.stop_reason === 'refusal') throw { code: 'refused' };
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  if (!text.trim()) throw { code: msg.stop_reason === 'max_tokens' ? 'invalid_json' : 'empty_completion' };
  return parseJson(text);
}

/* vérifie une clé sans rien facturer (lecture de la fiche du modèle) */
async function check(key) {
  try { await clientFor(key).models.retrieve(MODEL); return { ok: true }; }
  catch (e) { return { ok: false, code: codeOf(e).code }; }
}

window.RP_AI_IMPL = { json, check };
