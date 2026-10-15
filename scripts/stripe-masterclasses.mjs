#!/usr/bin/env node
// Crée (ou retrouve) un produit, un prix à 49 € et un Payment Link Stripe par masterclass
// listée dans masterclasses/_commun/catalogue.tsv. Idempotent : relancer ne crée pas de doublons.
//
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-masterclasses.mjs
//   STRIPE_SECRET_KEY=sk_live_... BOUTIQUE_URL=https://claude.ai/artifact/... node scripts/stripe-masterclasses.mjs
//
// BOUTIQUE_URL (facultatif) : après paiement, l'acheteur est redirigé vers <BOUTIQUE_URL>#<NN>-<code>,
// qui ouvre son cours (codes dans masterclasses/_commun/codes-acces.json). Sans elle, Stripe affiche
// une page de confirmation et l'accès part par e-mail (voir masterclasses/_commun/sav.md).
// Les URL des liens créés sont aussi écrites dans masterclasses/_commun/liens-paiement.json.
// La clé peut être une clé restreinte avec l'écriture sur Products, Prices et Payment Links.

import { readFileSync, writeFileSync } from 'node:fs';

const API = process.env.STRIPE_API_BASE || 'https://api.stripe.com/v1';
const AMOUNT = 4900;
const CATALOGUE = new URL('../masterclasses/_commun/catalogue.tsv', import.meta.url);
const OUTPUT = new URL('../masterclasses/_commun/payment-links.json', import.meta.url);
const INVOICE_FOOTER =
  'TVA non applicable, art. 293 B du CGI. Accès immédiat fourni à ta demande expresse ; ' +
  'tu as reconnu renoncer à ton droit de rétractation (art. L221-28 13° du Code de la consommation).';

const key = process.env.STRIPE_SECRET_KEY;
const boutique = (process.env.BOUTIQUE_URL || '').replace(/#.*$/, '');
const CODES = new URL('../masterclasses/_commun/codes-acces.json', import.meta.url);
const LINKS = new URL('../masterclasses/_commun/liens-paiement.json', import.meta.url);
if (!key || !/^(sk|rk)_(test|live)_/.test(key)) {
  console.error('STRIPE_SECRET_KEY manquante ou invalide (sk_… ou rk_…).');
  process.exit(1);
}
const mode = key.includes('_live_') ? 'live' : 'test';

function encode(params, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const name = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? encode(item, `${name}[${i}]`, out) : out.append(`${name}[${i}]`, String(item))));
    else if (typeof v === 'object') encode(v, name, out);
    else out.append(name, String(v));
  }
  return out;
}

async function stripe(method, path, params) {
  const url = method === 'GET' && params ? `${API}${path}?${encode(params)}` : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' },
    body: method === 'GET' ? undefined : encode(params || {}),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${body?.error?.message ?? ''}`);
  return body;
}

function readCatalogue() {
  const [, ...rows] = readFileSync(CATALOGUE, 'utf8').trim().split('\n');
  return rows.map((row) => {
    const [num, slug, titre, niche] = row.split('\t');
    return { num, slug, titre, niche, sku: `mc-${slug}` };
  });
}

async function findOrCreateProduct(mc) {
  const found = await stripe('GET', '/products/search', { query: `metadata['sku']:'${mc.sku}' AND active:'true'` });
  if (found.data[0]) return found.data[0];
  return stripe('POST', '/products', {
    name: `Masterclass · ${mc.titre}`,
    description: `Masterclass écrite (${mc.niche}) : modules, exercices, modèles et checklist. Contenu numérique, accès immédiat et à vie.`,
    metadata: { sku: mc.sku },
  });
}

async function findOrCreatePrice(productId, mc) {
  const lookupKey = `${mc.sku}_${AMOUNT}`;
  const found = await stripe('GET', '/prices', { lookup_keys: [lookupKey], active: true });
  if (found.data[0]) return found.data[0];
  return stripe('POST', '/prices', {
    product: productId, currency: 'eur', unit_amount: AMOUNT, lookup_key: lookupKey,
    tax_behavior: 'inclusive', metadata: { sku: mc.sku },
  });
}

async function listMasterclassLinks() {
  const bySku = new Map();
  let startingAfter;
  for (;;) {
    const page = await stripe('GET', '/payment_links', { limit: 100, starting_after: startingAfter });
    for (const link of page.data) if (link.metadata?.sku?.startsWith('mc-')) bySku.set(link.metadata.sku, link);
    if (!page.has_more) return bySku;
    startingAfter = page.data.at(-1).id;
  }
}

function createPaymentLink(price, mc) {
  const codes = JSON.parse(readFileSync(CODES, 'utf8'));
  const afterCompletion = boutique
    ? { type: 'redirect', redirect: { url: `${boutique}#${mc.num}-${codes[mc.num]}` } }
    : { type: 'hosted_confirmation', hosted_confirmation: { custom_message: 'Merci ! Ton accès à la masterclass arrive par e-mail dans les minutes qui suivent. Rien reçu sous 24 h ? Réponds à l\'e-mail de reçu.' } };
  return stripe('POST', '/payment_links', {
    line_items: [{ price: price.id, quantity: 1 }],
    after_completion: afterCompletion,
    customer_creation: 'always',
    billing_address_collection: 'auto',
    invoice_creation: { enabled: true, invoice_data: { footer: INVOICE_FOOTER, metadata: { sku: mc.sku } } },
    custom_text: {
      submit: { message: 'Accès immédiat : en payant, tu demandes l\'accès tout de suite et tu renonces à ton droit de rétractation (art. L221-28 13° C. conso).' },
    },
    metadata: { sku: mc.sku },
  });
}

async function main() {
  const catalogue = readCatalogue();
  const existing = await listMasterclassLinks();
  const out = { mode, generatedAt: new Date().toISOString(), links: {} };
  for (const mc of catalogue) {
    const product = await findOrCreateProduct(mc);
    const price = await findOrCreatePrice(product.id, mc);
    const link = existing.get(mc.sku) ?? (await createPaymentLink(price, mc));
    out.links[mc.slug] = { url: link.url, id: link.id, product: product.id };
    console.log(`${mc.num} ${mc.slug.padEnd(26)} ${link.url}`);
  }
  writeFileSync(OUTPUT, `${JSON.stringify(out, null, 2)}\n`);
  const links = JSON.parse(readFileSync(LINKS, 'utf8'));
  for (const mc of catalogue) links[mc.num] = { ...links[mc.num], stripe: out.links[mc.slug].url };
  writeFileSync(LINKS, `${JSON.stringify(links, null, 2)}\n`);
  console.log(`\nMode ${mode} — ${catalogue.length} liens écrits dans masterclasses/_commun/payment-links.json`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
