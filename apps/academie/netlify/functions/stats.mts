// GET /api/stats?days=30 : données du tableau de bord (mot de passe ADMIN_PASSWORD exigé).
// Renvoie les événements bruts (agrégés dans le navigateur), les certificats, les formulaires
// et, si PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET sont définis, les ventes PayPal réelles.
import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

const dayKey = (offset: number) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);

async function paypalSales(days: number) {
  const id = Netlify.env.get("PAYPAL_CLIENT_ID");
  const secret = Netlify.env.get("PAYPAL_CLIENT_SECRET");
  if (!id || !secret) return { configured: false, sales: [] };
  const auth = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!auth.ok) return { configured: true, error: `PayPal auth ${auth.status}`, sales: [] };
  const { access_token } = await auth.json();
  const end = new Date();
  const start = new Date(end.getTime() - Math.min(days, 31) * 86400000);
  const url = new URL("https://api-m.paypal.com/v1/reporting/transactions");
  url.searchParams.set("start_date", start.toISOString().replace(/\.\d+Z$/, "Z"));
  url.searchParams.set("end_date", end.toISOString().replace(/\.\d+Z$/, "Z"));
  url.searchParams.set("fields", "transaction_info,payer_info,cart_info");
  url.searchParams.set("page_size", "500");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!res.ok) return { configured: true, error: `PayPal ${res.status}`, sales: [] };
  const data = await res.json();
  const sales = (data.transaction_details || [])
    .filter((t: any) => Number(t.transaction_info?.transaction_amount?.value) > 0)
    .map((t: any) => ({
      date: t.transaction_info.transaction_initiation_date,
      amount: Number(t.transaction_info.transaction_amount.value),
      fee: Number(t.transaction_info.fee_amount?.value || 0),
      currency: t.transaction_info.transaction_amount.currency_code,
      status: t.transaction_info.transaction_status,
      id: t.transaction_info.transaction_id,
      name: [t.payer_info?.payer_name?.given_name, t.payer_info?.payer_name?.surname].filter(Boolean).join(" "),
      email: t.payer_info?.email_address || "",
      item: t.cart_info?.item_details?.[0]?.item_name || t.transaction_info.transaction_subject || "",
    }));
  return { configured: true, sales };
}

export default async (req: Request) => {
  const password = Netlify.env.get("ADMIN_PASSWORD");
  if (!password || req.headers.get("authorization") !== `Bearer ${password}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30));
  const events = getStore("events");
  const lists = await Promise.all(Array.from({ length: days }, (_, i) => events.list({ prefix: `${dayKey(i)}/` })));
  const rows = lists.flatMap((l) => l.blobs.map((b) => b.key));
  const { blobs: certKeys } = await getStore("certs-index").list();
  let paypal: Awaited<ReturnType<typeof paypalSales>> | { configured: boolean; error: string; sales: never[] };
  try {
    paypal = await paypalSales(days);
  } catch (e) {
    paypal = { configured: true, error: String(e), sales: [] };
  }
  return Response.json(
    { generatedAt: new Date().toISOString(), days, events: rows, certs: certKeys.map((b) => b.key), paypal },
    { headers: { "Cache-Control": "no-store" } },
  );
};

export const config: Config = { path: "/api/stats", method: "GET" };
