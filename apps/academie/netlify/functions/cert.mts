// /api/cert : POST délivre un certificat (jeton d'accès de la masterclass exigé), GET ?id= le vérifie.
import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const s = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
  return `KA-${s.slice(0, 4)}-${s.slice(4)}`;
};

// La vérification publique peut aussi être appelée depuis la copie du site hébergée ailleurs (Tiiny Host).
const CORS = { "Access-Control-Allow-Origin": "*" };

export default async (req: Request) => {
  const certs = getStore("certs");
  if (req.method === "GET") {
    const id = (new URL(req.url).searchParams.get("id") || "").toUpperCase();
    if (!/^KA-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(id)) return Response.json({ error: "invalid" }, { status: 400, headers: CORS });
    const cert = await certs.get(id, { type: "json" });
    if (!cert) return Response.json({ error: "not_found" }, { status: 404, headers: CORS });
    return Response.json(cert, { headers: CORS });
  }

  let body: { c?: string; k?: string; n?: string; sc?: number };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  let tokens: Record<string, string> = {};
  try {
    tokens = JSON.parse(Netlify.env.get("ACCESS_TOKENS") || "{}");
  } catch {
    return Response.json({ error: "server_config" }, { status: 500 });
  }
  const course = String(body.c || "");
  const key = String(body.k || "");
  const allowed = course !== "pass-integral" && tokens[course] && (key === tokens[course] || key === tokens["pass-integral"]);
  if (!allowed) return Response.json({ error: "forbidden" }, { status: 403 });
  const name = String(body.n || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  const score = Math.round(Number(body.sc));
  if (name.length < 3 || !(score >= 16 && score <= 20)) return Response.json({ error: "invalid" }, { status: 400 });

  const date = new Date().toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = newId();
    const { modified } = await certs.setJSON(id, { id, name, course, score, date }, { onlyIfNew: true });
    if (modified) {
      await getStore("certs-index").set(`${date.slice(0, 10)}~${course}~${id}`, "1");
      return Response.json({ id, date });
    }
  }
  return Response.json({ error: "retry" }, { status: 503 });
};

export const config: Config = { path: "/api/cert", method: ["GET", "POST"] };
