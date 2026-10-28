// Tableau de bord : visiteurs, consultations, paiements, achats, certificats.
(() => {
  const root = document.querySelector('[data-dash]');
  const login = document.querySelector('[data-login]');
  const PRICES = { 'pass-integral': 89 };
  const PRICE = 25;
  const LABELS = { view: 'Visite', buy_click: 'Clic « Acheter »', checkout: 'Départ vers PayPal', purchase: 'Achat (accès ouvert)', module: 'Module terminé', quiz_pass: 'Quiz réussi', quiz_fail: 'Quiz échoué', cert: 'Certificat délivré' };
  const PAGES = { home: 'Accueil', sales: 'Page de vente', course: 'Espace de cours', pass: 'Pass intégral', cert: 'Certificats', legal: 'Pages légales', contact: 'Contact', thanks: 'Merci', info: 'Autre', '404': 'Page introuvable' };
  let catalog = {};
  let days = 30;
  let password = '';
  try { password = sessionStorage.getItem('ka:admin') || ''; } catch { /* indisponible */ }

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n);
  const eur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
  const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1).replace('.', ',')} %` : '–');
  const title = (slug) => (slug === 'pass-integral' ? 'Pass intégral' : catalog[slug]?.title || slug);

  login.addEventListener('submit', (e) => { e.preventDefault(); password = login.querySelector('input').value; load(); });
  if (password) load();

  async function load() {
    root.hidden = false;
    root.innerHTML = '<p class="muted">Chargement…</p>';
    try {
      const [res, cat] = await Promise.all([
        fetch(`/api/stats?days=${days}`, { headers: { Authorization: `Bearer ${password}` } }),
        fetch('/assets/catalog.json').then((r) => r.json()).catch(() => ({})),
      ]);
      catalog = cat;
      if (res.status === 401) { root.innerHTML = '<p class="result fail">Mot de passe incorrect (ou variable ADMIN_PASSWORD absente sur Netlify).</p>'; return; }
      if (!res.ok) throw new Error(res.status);
      try { sessionStorage.setItem('ka:admin', password); } catch { /* indisponible */ }
      login.hidden = true;
      render(await res.json());
    } catch (err) {
      root.innerHTML = `<p class="result fail">Impossible de charger les statistiques (${esc(err.message)}).</p>`;
    }
  }

  function parse(key) {
    const [stamp, type, course, sid, src, cc, dev, page] = key.split('~');
    const [day, rest] = stamp.split('/');
    const t = rest.slice(0, 6);
    return { day, time: `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`, type, course: course === '-' ? '' : course, sid, src, cc: cc === '-' ? '?' : cc.toUpperCase(), dev, page };
  }

  function count(list, keyFn) {
    const m = new Map();
    for (const x of list) { const k = keyFn(x); m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }

  function bars(series, label) {
    const max = Math.max(1, ...series.map((s) => s.v));
    const w = 100 / series.length;
    const step = Math.max(1, Math.ceil(series.length / 8));
    return `<figure class="chart"><figcaption>${esc(label)}</figcaption>
      <svg viewBox="0 0 100 44" preserveAspectRatio="none" role="img" aria-label="${esc(label)}">
        <line x1="0" y1="40" x2="100" y2="40" class="axis"/>
        ${series.map((s, i) => { const h = (s.v / max) * 36; return `<rect x="${i * w + w * 0.15}" y="${40 - h}" width="${w * 0.7}" height="${Math.max(h, 0)}" rx="0.6"><title>${esc(s.label)} : ${fmt(s.v)}</title></rect>`; }).join('')}
      </svg>
      <div class="chart-x">${series.map((s, i) => `<span style="left:${(i + 0.5) * w}%">${i % step === 0 ? esc(s.short) : ''}</span>`).join('')}</div>
      <p class="chart-max small muted">Maximum : ${fmt(max === 1 && !series.some((s) => s.v) ? 0 : max)}</p>
    </figure>`;
  }

  const table = (head, rows) => `<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${head.length}" class="muted">Aucune donnée pour l'instant.</td></tr>`}</tbody></table></div>`;

  function render(data) {
    const ev = data.events.map(parse).sort((a, b) => (a.day + a.time < b.day + b.time ? 1 : -1));
    const views = ev.filter((e) => e.type === 'view');
    const sessions = new Set(views.map((e) => e.sid));
    const of = (type) => ev.filter((e) => e.type === type);
    const purchases = of('purchase');
    const revenue = purchases.reduce((n, e) => n + (PRICES[e.course] || PRICE), 0);
    const certs = data.certs.map((k) => { const [day, course, id] = k.split('~'); return { day, course, id }; });

    const dayList = Array.from({ length: data.days }, (_, i) => new Date(Date.now() - (data.days - 1 - i) * 86400000).toISOString().slice(0, 10));
    const short = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
    const perDay = (fn) => dayList.map((d) => ({ label: short(d), short: short(d), v: fn(d) }));
    const sessByDay = perDay((d) => new Set(views.filter((e) => e.day === d).map((e) => e.sid)).size);
    const buyByDay = perDay((d) => purchases.filter((e) => e.day === d).length);

    const slugs = [...new Set([...Object.keys(catalog), 'pass-integral'])];
    const courseRows = slugs.map((s) => {
      const salesViews = views.filter((e) => e.course === s && e.page === 'sales').length;
      const clicks = ev.filter((e) => e.course === s && e.type === 'buy_click').length;
      const go = ev.filter((e) => e.course === s && e.type === 'checkout').length;
      const buys = purchases.filter((e) => e.course === s).length;
      return { s, salesViews, clicks, go, buys, mods: ev.filter((e) => e.course === s && e.type === 'module').length, quiz: ev.filter((e) => e.course === s && e.type === 'quiz_pass').length, cert: certs.filter((c) => c.course === s).length };
    }).sort((a, b) => b.buys - a.buys || b.salesViews - a.salesViews);

    const bySession = new Map();
    views.forEach((e) => { if (!bySession.has(e.sid)) bySession.set(e.sid, e); });
    const firstTouch = [...bySession.values()];
    const buyerSessions = new Set(purchases.map((e) => e.sid));
    const sources = count(firstTouch, (e) => e.src).map(([src, n]) => [esc(src), fmt(n), fmt(firstTouch.filter((e) => e.src === src && buyerSessions.has(e.sid)).length)]);
    const countries = count(firstTouch, (e) => e.cc).slice(0, 12).map(([c, n]) => [esc(c), fmt(n), pct(n, firstTouch.length)]);
    const devices = count(firstTouch, (e) => e.dev).map(([d, n]) => [esc(d), fmt(n), pct(n, firstTouch.length)]);
    const pages = count(views, (e) => e.page).map(([p, n]) => [esc(PAGES[p] || p), fmt(n)]);

    const pp = data.paypal || {};
    const ppBlock = pp.configured
      ? (pp.error ? `<p class="result fail">PayPal : ${esc(pp.error)}</p>` : table(['Date', 'Client', 'E-mail', 'Produit', 'Montant', 'Frais', 'Statut'], pp.sales.map((s) => [esc(new Date(s.date).toLocaleString('fr-FR')), esc(s.name), esc(s.email), esc(s.item), eur(s.amount), eur(s.fee), esc(s.status)])))
      : '<p class="muted">Pour afficher ici chaque vente PayPal réelle (nom, e-mail, produit, montant), ajoutez les variables PAYPAL_CLIENT_ID et PAYPAL_CLIENT_SECRET dans Netlify (voir le guide de lancement). En attendant, la colonne « Achats » compte les ouvertures d\'accès après paiement, et l\'onglet Activité de PayPal fait foi.</p>';

    const kpis = [
      ['Visiteurs', fmt(sessions.size), 'sessions distinctes'],
      ['Pages vues', fmt(views.length), ''],
      ['Clics « Acheter »', fmt(of('buy_click').length), `${pct(of('buy_click').length, sessions.size)} des visiteurs`],
      ['Départs vers PayPal', fmt(of('checkout').length), ''],
      ['Achats', fmt(purchases.length), `conversion ${pct(purchases.length, sessions.size)}`],
      ['Chiffre d\'affaires estimé', eur(revenue), 'avant frais PayPal'],
      ['Certificats délivrés', fmt(certs.length), 'toutes périodes'],
    ];

    root.innerHTML = `
      <div class="dash-head">
        <p class="muted small">Mis à jour le ${esc(new Date(data.generatedAt).toLocaleString('fr-FR'))}</p>
        <div class="filters" role="group" aria-label="Période">${[1, 7, 30, 90].map((d) => `<button type="button" class="chip ${d === days ? 'is-active' : ''}" data-days="${d}">${d === 1 ? 'Aujourd\'hui' : `${d} jours`}</button>`).join('')}<button type="button" class="chip" data-refresh>Actualiser</button></div>
      </div>
      <div class="kpis">${kpis.map(([l, v, s]) => `<div class="kpi"><p class="kpi-label">${esc(l)}</p><p class="kpi-value">${v}</p><p class="kpi-sub">${esc(s)}</p></div>`).join('')}</div>
      <div class="charts">${bars(sessByDay, 'Visiteurs par jour')}${bars(buyByDay, 'Achats par jour')}</div>
      <h2>Par masterclass</h2>
      ${table(['Masterclass', 'Vues page de vente', 'Clics « Acheter »', 'Vers PayPal', 'Achats', 'Conversion', 'Modules terminés', 'Quiz réussis', 'Certificats'], courseRows.map((r) => [esc(title(r.s)), fmt(r.salesViews), fmt(r.clicks), fmt(r.go), `<strong>${fmt(r.buys)}</strong>`, pct(r.buys, r.salesViews), fmt(r.mods), fmt(r.quiz), fmt(r.cert)]))}
      <h2>Ventes PayPal</h2>
      ${ppBlock}
      <div class="dash-cols">
        <div><h2>Sources</h2>${table(['Source', 'Visiteurs', 'Acheteurs'], sources)}</div>
        <div><h2>Pays</h2>${table(['Pays', 'Visiteurs', 'Part'], countries)}</div>
        <div><h2>Appareils</h2>${table(['Appareil', 'Visiteurs', 'Part'], devices)}</div>
        <div><h2>Pages</h2>${table(['Type de page', 'Vues'], pages)}</div>
      </div>
      <h2>Activité en direct</h2>
      ${table(['Date', 'Heure (UTC)', 'Événement', 'Masterclass', 'Source', 'Pays', 'Appareil'], ev.slice(0, 60).map((e) => [esc(short(e.day)), esc(e.time), esc(LABELS[e.type] || e.type), esc(e.course ? title(e.course) : '–'), esc(e.src), esc(e.cc), esc(e.dev)]))}
      <h2>Derniers certificats</h2>
      ${table(['Date', 'Masterclass', 'Numéro'], certs.sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 30).map((c) => [esc(c.day), esc(title(c.course)), `<a href="/certificat/?id=${esc(c.id)}" target="_blank">${esc(c.id)}</a>`]))}
      <p class="small muted">Les e-mails laissés dans les formulaires (acheteurs, liste d'attente, newsletter, contact) sont dans Netlify → projet kairos-academie → Forms.</p>`;
    root.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => { days = Number(b.dataset.days); load(); }));
    root.querySelector('[data-refresh]').addEventListener('click', load);
  }
})();
