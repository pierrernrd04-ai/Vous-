// POST /api/ecrire : transforme une transcription vocale en entrée de journal
// (texte réécrit, titre, résumé, thèmes, humeur, relance) avec Claude.
// GET /api/ecrire : indique au navigateur si l'IA est disponible.
//
// Identifiants : la passerelle IA de Netlify fournit ANTHROPIC_API_KEY et
// ANTHROPIC_BASE_URL automatiquement. Une clé Anthropic personnelle définie
// dans les variables du projet est prioritaire.
import type { Config, Context } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import {
  EntrySchema,
  InputError,
  SYSTEM_PROMPT,
  buildUserMessage,
  normalizeOutput,
  validateInput,
  type EntryOutput,
} from '../lib/ecrire.mts';

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

// Do It et Encré publiés sur GitHub Pages appellent cette fonction depuis une autre origine.
const ALLOWED_ORIGINS = ['https://pierrernrd04-ai.github.io'];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  const extra = (Netlify.env.get('DOIT_ALLOWED_ORIGINS') || '').split(',').map((o) => o.trim()).filter(Boolean);
  if (!origin || ![...ALLOWED_ORIGINS, ...extra].includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-doit-code',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function aiConfigured(): boolean {
  return Boolean(Netlify.env.get('ANTHROPIC_API_KEY') || Netlify.env.get('ANTHROPIC_AUTH_TOKEN'));
}

function authorized(req: Request): boolean {
  const code = Netlify.env.get('DOIT_ACCESS_CODE');
  return !code || req.headers.get('x-doit-code') === code;
}

export default async (req: Request, _context: Context) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...cors } });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  if (req.method === 'GET') {
    return json({
      ai: aiConfigured(),
      needsCode: Boolean(Netlify.env.get('DOIT_ACCESS_CODE')),
      authorized: authorized(req),
    });
  }

  if (!authorized(req)) return json({ error: 'code', message: 'Code d\'accès manquant ou incorrect.' }, 401);
  if (!aiConfigured()) return json({ error: 'ai_unavailable', message: 'IA non configurée sur ce site.' }, 503);

  let input;
  try {
    input = validateInput(await req.json());
  } catch (err) {
    const message = err instanceof InputError ? err.message : 'Requête illisible.';
    return json({ error: 'input', message }, 400);
  }

  const model = Netlify.env.get('DOIT_MODEL') || 'claude-opus-5-5';
  const effortEnv = Netlify.env.get('DOIT_EFFORT') as Effort | undefined;
  const effort: Effort = effortEnv && EFFORTS.includes(effortEnv) ? effortEnv : 'low';
  const base = {
    model,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user' as const, content: buildUserMessage(input) }],
  };

  // Sous la limite de 60 s des fonctions Netlify, avec une seule nouvelle tentative.
  const client = new Anthropic({ timeout: 50_000, maxRetries: 1 });
  // Appel direct à l'API Anthropic : repli serveur si le modèle décline.
  // Via la passerelle Netlify (ANTHROPIC_BASE_URL défini), les en-têtes bêta ne passent pas.
  const direct = !Netlify.env.get('ANTHROPIC_BASE_URL');

  try {
    let parsed: EntryOutput | null;
    let stopReason: string | null;
    if (direct) {
      const message = await client.beta.messages.parse({
        ...base,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort, format: betaZodOutputFormat(EntrySchema) },
      });
      parsed = message.parsed_output;
      stopReason = message.stop_reason;
    } else {
      const message = await client.messages.parse({
        ...base,
        output_config: { effort, format: zodOutputFormat(EntrySchema) },
      });
      parsed = message.parsed_output;
      stopReason = message.stop_reason;
    }

    if (stopReason === 'refusal') {
      return json({ error: 'refusal', message: 'Le modèle a décliné cette transcription.' }, 422);
    }
    if (!parsed) {
      return json({ error: 'output', message: `Réponse incomplète (${stopReason ?? 'inconnue'}).` }, 502);
    }
    return json({ entry: normalizeOutput(parsed, input.customThemes), model });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: 'busy', message: 'Trop de demandes, réessaie dans un instant.' }, 429);
    }
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error('Anthropic auth error', err.status, err.message);
      return json({ error: 'ai_unavailable', message: 'Accès à l\'IA refusé.' }, 503);
    }
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      return json({ error: 'timeout', message: 'L\'IA a mis trop de temps à répondre.' }, 504);
    }
    if (err instanceof Anthropic.APIError) {
      console.error('Anthropic API error', err.status, err.message);
      return json({ error: 'upstream', message: 'L\'IA est indisponible pour le moment.' }, 502);
    }
    console.error('ecrire failed', err);
    return json({ error: 'server', message: 'Erreur inattendue.' }, 500);
  }
};

export const config: Config = {
  path: '/api/ecrire',
  method: ['GET', 'POST', 'OPTIONS'],
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
