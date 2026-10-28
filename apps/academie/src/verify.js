// Vérification publique d'un certificat de réussite.
(() => {
  const form = document.querySelector('[data-verify-form]');
  const out = document.querySelector('[data-verify-result]');
  if (!form) return;
  async function verify(id) {
    out.innerHTML = '<p class="muted">Vérification…</p>';
    try {
      const [res, catalog] = await Promise.all([
        fetch(`/api/cert?id=${encodeURIComponent(id)}`),
        fetch('/assets/catalog.json').then((r) => r.json()).catch(() => ({})),
      ]);
      out.innerHTML = '';
      const box = document.createElement('div');
      if (!res.ok) {
        box.className = 'result fail';
        box.textContent = `Aucun certificat ne correspond au numéro ${id}.`;
      } else {
        const c = await res.json();
        const date = new Date(c.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        box.className = 'result pass';
        box.textContent = `Certificat authentique : ${c.name} a validé la masterclass « ${catalog[c.course]?.title || c.course} » le ${date}, avec un score de ${c.score}/20.`;
      }
      out.appendChild(box);
    } catch {
      out.innerHTML = '<p class="result fail">Vérification impossible pour le moment. Réessayez plus tard.</p>';
    }
  }
  form.addEventListener('submit', (ev) => { ev.preventDefault(); verify(form.querySelector("input").value.trim().toUpperCase()); });
  const id = new URLSearchParams(location.search).get('id');
  if (id) { form.querySelector("input").value = id; verify(id.toUpperCase()); }
})();
