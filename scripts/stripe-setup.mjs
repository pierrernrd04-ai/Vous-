#!/usr/bin/env node
// Crée (ou retrouve) le produit, les prix et les Payment Links du Pass J-24 sur Stripe.
// Idempotent : relancer le script ne crée pas de doublons.
//
//   STRIPE_SECRET_KEY=sk_live_... SITE_URL=https://traceo-pass.pages.dev node scripts/stripe-setup.mjs
//   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup.mjs --deactivate-launch
//
// La clé peut être une clé restreinte avec l'écriture sur Products, Prices et Payment Links.

const API = process.env.STRIPE_API_BASE || 'https://api.stripe.com/v1';
const SKU = 'pass-j24';
const PRICES = [
  { lookupKey: 'j24_1900', amount: 1900, nickname: 'Lancement (jusqu\'au 18/10/2026 23:59)', role: 'launch' },
  { lookupKey: 'j24_2900', amount: 2900, nickname: 'Prix normal', role: 'regular' },
];
const INVOICE_FOOTER =
  'TVA non applicable, art. 293 B du CGI. Accès immédiat fourni à ta demande expresse ; ' +
  'tu as reconnu renoncer à ton droit de rétractation (art. L221-28 13° du Code de la consommation).';

const key = process.env.STRIPE_SECRET_KEY;
const siteUrl = (process.env.SITE_URL || 'https://traceo-pass.pages.dev').replace(/\/+$/, '');
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

async function findOrCreateProduct() {
  const found = await stripe('GET', '/products/search', { query: `metadata['sku']:'${SKU}' AND active:'true'` });
  if (found.data[0]) return found.data[0];
  return stripe('POST', '/products', {
    name: 'Pass J-24 · Traceo – prépa printemps 2027',
    description:
      'Plan daté 24 semaines (marathon) ou 20 semaines (semi), une boucle Traceo pour chaque séance, ' +
      'export agenda et Traceo Premium jusqu\'au 5/04/2027. Contenu numérique, accès immédiat.',
    metadata: { sku: SKU },
  });
}

async function findOrCreatePrice(productId, spec) {
  const found = await stripe('GET', '/prices', { lookup_keys: [spec.lookupKey], active: true });
  if (found.data[0]) return found.data[0];
  return stripe('POST', '/prices', {
    product: productId, currency: 'eur', unit_amount: spec.amount, nickname: spec.nickname,
    lookup_key: spec.lookupKey, tax_behavior: 'inclusive', metadata: { sku: SKU, role: spec.role },
  });
}

async function findPaymentLink(role) {
  let startingAfter;
  for (;;) {
    const page = await stripe('GET', '/payment_links', { limit: 100, starting_after: startingAfter });
    const hit = page.data.find((l) => l.metadata?.sku === SKU && l.metadata?.role === role);
    if (hit || !page.has_more) return hit;
    startingAfter = page.data.at(-1).id;
  }
}

async function findOrCreatePaymentLink(price, role, regularUrl) {
  const existing = await findPaymentLink(role);
  if (existing) return existing;
  return stripe('POST', '/payment_links', {
    line_items: [{ price: price.id, quantity: 1 }],
    after_completion: { type: 'redirect', redirect: { url: `${siteUrl}/merci/?session_id={CHECKOUT_SESSION_ID}` } },
    customer_creation: 'always',
    billing_address_collection: 'auto',
    invoice_creation: { enabled: true, invoice_data: { footer: INVOICE_FOOTER, metadata: { sku: SKU } } },
    custom_text: { submit: { message: 'Accès immédiat à ton plan après le paiement.' } },
    custom_fields: [{ key: 'emailtraceo', type: 'text', optional: true, label: { type: 'custom', custom: 'E-mail de ton compte Traceo (si différent)' } }],
    inactive_message: regularUrl
      ? `Le prix de lancement est terminé : le Pass est maintenant à 29 € sur ${siteUrl}`
      : undefined,
    metadata: { sku: SKU, role },
  });
}

async function setup() {
  const product = await findOrCreateProduct();
  const [launchPrice, regularPrice] = await Promise.all(PRICES.map((p) => findOrCreatePrice(product.id, p)));
  const regular = await findOrCreatePaymentLink(regularPrice, 'regular');
  const launch = await findOrCreatePaymentLink(launchPrice, 'launch', regular.url);
  console.log(`\nMode ${mode} — produit ${product.id}`);
  console.log(`  19 € : ${launch.url}  (${launch.id}${launch.active ? '' : ', inactif'})`);
  console.log(`  29 € : ${regular.url}  (${regular.id})`);
  console.log('\nÀ reporter :');
  console.log(`  src/config.ts        paymentLinkLaunch: '${launch.url}', paymentLinkRegular: '${regular.url}', stripeEnabled: true`);
  console.log(`  Cloudflare (env)     PAYMENT_LINK_IDS=${launch.id},${regular.id}`);
}

async function deactivateLaunch() {
  const link = await findPaymentLink('launch');
  if (!link) return console.log('Aucun lien de lancement trouvé.');
  if (!link.active) return console.log(`Déjà inactif : ${link.id}`);
  await stripe('POST', `/payment_links/${link.id}`, { active: false });
  console.log(`Lien de lancement désactivé : ${link.id}`);
}

(process.argv.includes('--deactivate-launch') ? deactivateLaunch() : setup()).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
