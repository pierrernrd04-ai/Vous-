// POST /api/t : enregistre un événement de mesure d'audience (sans cookie ni adresse IP).
// Chaque événement est une clé du store « events » : jour/heure-aléa~type~masterclass~session~source~pays~appareil~page.
import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";

const TYPES = new Set(["view", "buy_click", "checkout", "purchase", "module", "quiz_pass", "quiz_fail", "cert"]);
const BOTS = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor/i;
const clean = (v: unknown, max = 40) => String(v ?? "").toLowerCase().replace(/[^a-z0-9.-]/g, "").slice(0, max) || "-";

export default async (req: Request, context: Context) => {
  if (BOTS.test(req.headers.get("user-agent") || "")) return new Response(null, { status: 204 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  const type = clean(body.e, 12);
  if (!TYPES.has(type)) return new Response(null, { status: 400 });
  const iso = new Date().toISOString();
  const key = [
    `${iso.slice(0, 10)}/${iso.slice(11, 19).replace(/:/g, "")}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    clean(body.c),
    clean(body.s, 16),
    clean(body.r),
    clean(context.geo?.country?.code, 2),
    clean(body.d, 7),
    clean(body.p, 12),
  ].join("~");
  await getStore("events").set(key, "1");
  return new Response(null, { status: 204 });
};

export const config: Config = { path: "/api/t", method: "POST" };
