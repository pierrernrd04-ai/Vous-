// Espace de cours : navigation, progression, quiz final et certificat.
(() => {
  const app = document.querySelector('.course-app');
  if (!app) return;
  const { slug, token, title, duration } = app.dataset;
  const key = (k) => `ka:${slug}:${k}`;
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(key(k))) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(key(k), JSON.stringify(v)); } catch { /* stockage indisponible */ } };
  const track = (e) => window.kaTrack && window.kaTrack(e, slug);

  // Premier passage sur la page d'accès : achat (retour de PayPal).
  if (!load('opened', false)) { save('opened', new Date().toISOString()); track('purchase'); }

  const sections = [...document.querySelectorAll('[data-section]')];
  const links = [...document.querySelectorAll('[data-nav]')];
  const modules = [...document.querySelectorAll('[data-complete]')].map((b) => b.dataset.complete);
  let done = new Set(load('done', []));

  // Sommaire repliable sur mobile.
  const nav = document.querySelector('.course-nav');
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'btn btn-ghost nav-toggle'; toggle.textContent = 'Afficher le sommaire';
  toggle.addEventListener('click', () => { nav.classList.toggle('open'); toggle.textContent = nav.classList.contains('open') ? 'Masquer le sommaire' : 'Afficher le sommaire'; });
  nav.querySelector('.progress').before(toggle);

  function renderProgress() {
    const n = modules.filter((m) => done.has(m)).length;
    document.querySelector('[data-progress-bar]').style.width = `${Math.round((n / modules.length) * 100)}%`;
    document.querySelector('[data-progress-text]').textContent = `${n} module${n > 1 ? 's' : ''} terminé${n > 1 ? 's' : ''} sur ${modules.length}`;
    links.forEach((a) => a.parentElement.classList.toggle('is-done', done.has(a.dataset.nav)));
  }

  function show() {
    const id = (location.hash || '#accueil').slice(1);
    const target = sections.find((s) => s.id === id) || sections[0];
    sections.forEach((s) => { s.hidden = s !== target; });
    links.forEach((a) => a.classList.toggle('is-current', a.dataset.nav === target.id));
    nav.classList.remove('open');
    setTimeout(() => window.scrollTo(0, 0), 0);
    save('last', target.id);
  }
  const readBar = document.querySelector('[data-read-bar]');
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    readBar.style.width = `${max > 0 ? Math.min(100, (scrollY / max) * 100) : 0}%`;
  };
  addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('hashchange', () => { show(); onScroll(); });
  if (!location.hash && load('last', '')) location.hash = load('last', '');
  show();
  renderProgress();
  const resume = document.querySelector('[data-resume]');
  const firstTodo = modules.find((m) => !done.has(m));
  if (resume && done.size && firstTodo) { resume.href = `#${firstTodo}`; resume.textContent = 'Reprendre là où je me suis arrêté'; }
  if (resume && done.size && !firstTodo) { resume.href = '#quiz'; resume.textContent = 'Passer le quiz final'; }

  document.querySelectorAll('[data-complete]').forEach((b) => b.addEventListener('click', () => {
    if (!done.has(b.dataset.complete)) track('module');
    done.add(b.dataset.complete); save('done', [...done]); renderProgress();
    location.hash = b.dataset.next;
  }));
  document.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', () => window.print()));

  // Cases à cocher des check-lists (mémorisées) et boutons « Copier » sur les modèles.
  document.querySelectorAll('.prose input[type="checkbox"]').forEach((box, i) => {
    box.disabled = false;
    const k = `cb${i}`;
    const state = load('checks', {});
    box.checked = !!state[k];
    box.addEventListener('change', () => { const s = load('checks', {}); s[k] = box.checked; save('checks', s); });
  });
  document.querySelectorAll('.prose pre').forEach((pre) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'copy-btn'; btn.textContent = 'Copier';
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(pre.innerText.replace(/Copier$|Copié !$/, '').trim()); btn.textContent = 'Copié !'; } catch { btn.textContent = 'Sélectionnez le texte'; }
      setTimeout(() => { btn.textContent = 'Copier'; }, 1800);
    });
    pre.appendChild(btn);
  });

  // Quiz final.
  const quiz = JSON.parse(document.getElementById('quiz-data').textContent || '[]');
  const form = document.querySelector('[data-quiz-form]');
  const result = document.querySelector('[data-quiz-result]');
  const PASS = Math.ceil(quiz.length * 0.8);
  quiz.forEach((q, i) => {
    const box = document.createElement('div');
    box.className = 'q';
    const fs = document.createElement('fieldset');
    const lg = document.createElement('legend');
    lg.textContent = `${i + 1}. ${q.q}`;
    fs.appendChild(lg);
    q.choices.forEach((choice, j) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio'; input.name = `q${i}`; input.value = String(j); input.required = true;
      const span = document.createElement('span'); span.textContent = choice;
      label.append(input, span);
      fs.appendChild(label);
    });
    box.appendChild(fs);
    form.appendChild(box);
  });
  const submit = document.createElement('button');
  submit.type = 'submit'; submit.className = 'btn btn-primary btn-lg'; submit.textContent = 'Valider mes réponses';
  form.appendChild(submit);

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    let score = 0;
    [...form.querySelectorAll('.q')].forEach((box, i) => {
      const picked = form.querySelector(`input[name="q${i}"]:checked`);
      const ok = picked && Number(picked.value) === quiz[i].answer;
      if (ok) score++;
      box.classList.toggle('good', !!ok); box.classList.toggle('bad', !ok);
      box.querySelector('.expl')?.remove();
      const p = document.createElement('p');
      p.className = 'expl';
      p.textContent = `${ok ? 'Bonne réponse.' : `Réponse attendue : ${quiz[i].choices[quiz[i].answer]}.`} ${quiz[i].explanation || ''}`;
      box.appendChild(p);
    });
    const passed = score >= PASS;
    const best = Math.max(score, load('best', 0));
    save('best', best);
    track(passed ? 'quiz_pass' : 'quiz_fail');
    result.innerHTML = '';
    const div = document.createElement('div');
    div.className = `result ${passed ? 'pass' : 'fail'}`;
    div.textContent = passed
      ? `Bravo : ${score}/${quiz.length}. Vous avez réussi le quiz final, votre certificat est débloqué.`
      : `${score}/${quiz.length}. Il faut ${PASS}/${quiz.length} pour le certificat. Relisez les explications ci-dessus et les modules concernés, puis réessayez.`;
    result.appendChild(div);
    if (passed) {
      const a = document.createElement('a'); a.className = 'btn btn-primary btn-lg'; a.href = '#certificat'; a.textContent = 'Obtenir mon certificat';
      result.appendChild(a);
    }
    renderCert();
    div.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Certificat.
  const locked = document.querySelector('[data-cert-locked]');
  const certForm = document.querySelector('[data-cert-form]');
  const out = document.querySelector('[data-cert-output]');
  function renderCert() {
    const cert = load('cert', null);
    const best = load('best', 0);
    locked.hidden = best >= PASS || !!cert;
    certForm.hidden = !(best >= PASS) || !!cert;
    out.hidden = !cert;
    if (!cert) return;
    const date = new Date(cert.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const verify = `${location.origin}/certificat/?id=${encodeURIComponent(cert.id)}`;
    out.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'certificate';
    el.innerHTML = `<p class="c-brand">Kairos Académie</p><p class="c-title">Certificat de réussite</p><p class="c-text">Ce certificat atteste que</p><p class="c-name"></p><p class="c-text">a suivi et validé la masterclass</p><p class="c-course"></p><p class="c-text"></p><div class="c-foot"><div><p class="c-sign">Pierre Renard</p><p>Fondateur, Kairos Académie</p></div><div><p>N° <strong class="c-id"></strong></p><p>Vérification : <span class="c-verify"></span></p></div></div>`;
    el.querySelector('.c-name').textContent = cert.name;
    el.querySelector('.c-course').textContent = title;
    el.querySelectorAll('.c-text')[2].textContent = `Durée : ${duration} · Score au quiz final : ${cert.score}/${quiz.length} · Délivré le ${date}`;
    el.querySelector('.c-id').textContent = cert.id;
    el.querySelector('.c-verify').textContent = verify.replace(/^https?:\/\//, '');
    const actions = document.createElement('div');
    actions.className = 'lesson-end no-print';
    actions.innerHTML = '<button type="button" class="btn btn-primary">Imprimer ou enregistrer en PDF</button><a class="btn btn-ghost" target="_blank" rel="noopener">Ajouter à mon profil LinkedIn</a>';
    actions.querySelector('button').addEventListener('click', () => { document.body.classList.add('printing-cert'); window.print(); setTimeout(() => document.body.classList.remove('printing-cert'), 500); });
    const d = new Date(cert.date);
    actions.querySelector('a').href = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(title)}&organizationName=${encodeURIComponent('Kairos Académie')}&issueYear=${d.getFullYear()}&issueMonth=${d.getMonth() + 1}&certId=${encodeURIComponent(cert.id)}&certUrl=${encodeURIComponent(verify)}`;
    const note = document.createElement('p');
    note.className = 'small muted no-print';
    note.textContent = 'Certificat de réussite délivré par Kairos Académie. Il ne s\'agit pas d\'un diplôme d\'État ni d\'une certification inscrite au RNCP.';
    out.append(el, actions, note);
  }
  document.querySelector('[data-cert-name-form]').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const name = ev.target.querySelector("input").value.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (name.length < 3) return;
    const btn = ev.target.querySelector('button');
    btn.disabled = true; btn.textContent = 'Génération…';
    const score = load('best', 0);
    let cert;
    try {
      const res = await fetch(`${document.body.dataset.api || ''}/api/cert`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ c: slug, k: token, n: name, sc: score }) });
      if (!res.ok) throw new Error(String(res.status));
      cert = await res.json();
    } catch {
      btn.disabled = false; btn.textContent = 'Générer mon certificat';
      alert('Le certificat n\'a pas pu être enregistré. Vérifiez votre connexion et réessayez.');
      return;
    }
    save('cert', { id: cert.id, date: cert.date, name, score });
    track('cert');
    renderCert();
  });
  renderCert();
})();
