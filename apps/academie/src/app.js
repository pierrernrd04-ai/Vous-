// Kairos Académie : script commun (taille du texte, filtres, mesure d'audience, paiement).
(() => {
  const store = {
    get(k, area = localStorage) { try { return area.getItem(k); } catch { return null; } },
    set(k, v, area = localStorage) { try { area.setItem(k, v); } catch { /* stockage indisponible */ } },
  };
  const body = document.body;
  const page = body.dataset.page || 'info';
  const course = body.dataset.course || '';
  const api = body.dataset.api || '';

  // Taille du texte (3 niveaux, mémorisée).
  const sizes = ['', 'text-lg', 'text-xl'];
  let size = Number(store.get('ka:text') || 0);
  const applySize = () => { sizes.forEach((c) => c && document.documentElement.classList.remove(c)); if (sizes[size]) document.documentElement.classList.add(sizes[size]); };
  applySize();
  document.querySelectorAll('[data-text-size]').forEach((b) => b.addEventListener('click', () => { size = (size + 1) % sizes.length; store.set('ka:text', String(size)); applySize(); }));

  // Mesure d'audience sans cookie : identifiant de session aléatoire, effacé à la fermeture de l'onglet.
  let sid = store.get('ka:sid', sessionStorage);
  if (!sid) { sid = Math.random().toString(36).slice(2, 12); store.set('ka:sid', sid, sessionStorage); }
  let src = store.get('ka:src', sessionStorage);
  if (!src) {
    const params = new URLSearchParams(location.search);
    const utm = params.get('utm_source');
    let ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch { ref = ''; }
    if (ref === location.hostname) ref = '';
    src = (utm || ref || 'direct').toLowerCase().slice(0, 40);
    store.set('ka:src', src, sessionStorage);
  }
  const device = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : (/iPad|Tablet/i.test(navigator.userAgent) ? 'tablet' : 'desktop');
  const track = window.kaTrack = (e, c = course) => {
    if (navigator.webdriver) return;
    const data = JSON.stringify({ e, c, s: sid, r: src, d: device, p: page });
    try {
      if (!navigator.sendBeacon || !navigator.sendBeacon(`${api}/api/t`, data)) {
        fetch(`${api}/api/t`, { method: 'POST', body: data, keepalive: true, mode: 'no-cors' }).catch(() => {});
      }
    } catch { /* hors ligne */ }
  };
  track('view');

  // Filtres du catalogue.
  const chips = document.querySelectorAll('[data-filter]');
  chips.forEach((chip) => chip.addEventListener('click', () => {
    chips.forEach((c) => c.classList.toggle('is-active', c === chip));
    const f = chip.dataset.filter;
    document.querySelectorAll('.course-card[data-cat]').forEach((card) => { card.hidden = !!f && card.dataset.cat !== f; });
  }));

  // Paiement : case de renonciation au droit de rétractation, puis redirection PayPal.
  const dialog = document.getElementById('checkout');
  if (dialog) {
    const consent = dialog.querySelector('[data-consent]');
    const pay = dialog.querySelector('[data-pay]');
    const ready = dialog.querySelector('[data-checkout-ready]');
    const wait = dialog.querySelector('[data-checkout-waitlist]');
    const product = dialog.querySelector('[data-checkout-product]');
    let current = null;
    consent.addEventListener('change', () => { pay.disabled = !consent.checked; });
    document.querySelectorAll('[data-buy]').forEach((btn) => btn.addEventListener('click', () => {
      const slug = btn.dataset.buy;
      const isPass = slug === 'pass-integral';
      current = { slug, link: btn.dataset.link };
      const title = isPass ? 'Pass intégral · toutes les masterclasses' : (document.querySelector('h1')?.textContent || 'Masterclass');
      const price = isPass ? (document.querySelector('#pass .price-big')?.textContent || '') : (document.querySelector('.hero-course .price-big')?.textContent || '25 €');
      product.innerHTML = '';
      const t = document.createElement('span'); t.textContent = page === 'sales' || isPass ? title : 'Masterclass';
      const p = document.createElement('span'); p.textContent = price;
      product.append(t, p);
      const hasLink = /^https:\/\//.test(current.link);
      ready.hidden = !hasLink;
      wait.hidden = hasLink;
      dialog.querySelector('[data-waitlist-course]').value = slug;
      consent.checked = false; pay.disabled = true;
      track('buy_click', slug);
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    }));
    pay.addEventListener('click', () => {
      if (!current || !consent.checked) return;
      store.set('ka:consent', JSON.stringify({ slug: current.slug, at: new Date().toISOString() }));
      track('checkout', current.slug);
      setTimeout(() => { location.href = current.link; }, 150);
    });
  }
})();
