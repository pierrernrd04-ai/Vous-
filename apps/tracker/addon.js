/* Version web : clé Claude pour l'analyse photo de l'assiette et le tri automatique des photos.
   Inséré par build.mjs à la fin du script de l'appli, dans la même portée que ses fonctions. */
function rpAiOn() { return !!(window.RP_AI && window.RP_AI.hasKey()); }
function rpAiChip() { return `<div class="wrap" style="margin-top:12px"><button class="chip" data-a="aiSetup">${ic('sparkle', 14)} Activer le tri automatique</button></div>`; }
if (window.RP_STANDALONE && window.RP_AI) {
  const AI = window.RP_AI, WHERE = 'Mes apps › Analyse photo par Claude';
  let pending = null;

  const aiCard = () => AI.hasKey()
    ? `<div class="apps-note" id="aiCard"><b>${ic('sparkle', 15)} Analyse photo par Claude</b>
      <p><b>Activée.</b> Photo de l'assiette dans l'onglet Alimentation, tri automatique de ta galerie (photos avec des personnes) dans l'onglet Photos. Clé ${esc(AI.keyHint())}, gardée dans ce téléphone.</p>
      <button class="btn ghost sm" data-a="aiKeyForget" style="margin-bottom:10px">Retirer la clé</button></div>`
    : `<div class="apps-note" id="aiCard"><b>${ic('sparkle', 15)} Analyse photo par Claude</b>
      <p>Pour analyser ton assiette en photo et trier ta galerie automatiquement, colle ta clé API Claude. Elle reste dans ce téléphone et n'est envoyée qu'à Claude.</p>
      <div class="grid2" style="grid-template-columns:minmax(0,1fr) auto;margin-bottom:10px"><input class="inp" id="aiKey" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="sk-ant-…"><button class="btn go" data-a="aiKeySave">Activer</button></div>
      <p>Crée ta clé sur platform.claude.com › API Keys. Paiement à l'usage : quelques centimes par assiette. Fixe une limite mensuelle (Limits) pour être tranquille.</p>
      <a class="btn ghost sm" href="https://platform.claude.com/settings/keys" target="_blank" rel="noopener" style="margin-bottom:10px">${ic('ext', 14)} Créer ma clé</a></div>`;
  const aiOpen = () => {
    ACT.appsOpen();
    setTimeout(() => { const c = $('#aiCard'); if (c) c.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 350);
  };

  const _xferNote = xferNote;
  xferNote = () => aiCard() + _xferNote();

  /* sans clé, la photo de l'assiette ouvre directement le réglage, puis l'analyse part dès que la clé est validée */
  const _analyzePhoto = analyzePhoto;
  analyzePhoto = (file) => {
    if (!AI.hasKey()) { pending = file; aiOpen(); toast('Ajoute ta clé Claude pour analyser ton assiette.'); return; }
    return _analyzePhoto(file);
  };

  const _photoErr = photoErr;
  photoErr = (e) => {
    const c = e && e.code;
    if (c === 'ai_key' || c === 'no_sample') return `Ajoute ta clé Claude pour analyser tes assiettes : ${WHERE}.`;
    if (c === 'ai_key_bad') return `Ta clé Claude est refusée : vérifie-la dans ${WHERE}.`;
    if (c === 'ai_credit') return "Ton compte Claude n'a plus de crédit : recharge-le sur platform.claude.com (Billing), puis réessaie.";
    if (c === 'refused') return "Claude n'a pas pu analyser cette photo. Essaie avec une autre photo de ton assiette.";
    if (c === 'rate_limited') return "Trop d'analyses d'affilée : réessaie dans une minute.";
    if (c === 'offline') return "Pas de connexion : l'analyse a besoin d'internet. Réessaie dès que tu as du réseau.";
    return _photoErr(e);
  };

  const keyMsg = ['Tri automatique non activé', `Ajoute ta clé Claude dans ${WHERE}, puis touche « Réessayer ». Ou importe tout sans tri.`];
  Object.assign(IMP_MSG, {
    nosample: keyMsg, ai_key: keyMsg, not_granted: keyMsg,
    ai_key_bad: ['Clé Claude refusée', `Vérifie ta clé dans ${WHERE}, puis touche « Réessayer ». Ou importe tout sans tri.`],
    ai_credit: ['Plus de crédit Claude', 'Recharge ton compte sur platform.claude.com (Billing), puis touche « Réessayer ». Les photos déjà triées sont gardées.'],
    rate_limited: ['Claude fait une pause', "Trop de demandes d'affilée. Attends une minute, puis touche « Réessayer » : les photos déjà triées sont gardées."],
    session_expired: ['Connexion à Claude perdue', 'Touche « Réessayer » : rien n\'est perdu.'],
  });

  Object.assign(ACT, {
    aiSetup() { aiOpen(); },
    async aiKeySave(t) {
      const k = (($('#aiKey') || {}).value || '').trim();
      if (!/^sk-ant-\S{16,}$/.test(k)) { toast('Colle la clé complète : elle commence par sk-ant-'); return; }
      t.disabled = true; t.textContent = 'Vérification…';
      const r = await AI.check(k);
      if (!r.ok) {
        t.disabled = false; t.textContent = 'Activer';
        toast(r.code === 'ai_key_bad' ? 'Clé refusée : vérifie-la.' : 'Claude est injoignable : vérifie ta connexion et réessaie.');
        return;
      }
      AI.setKey(k); haptic('success'); toast('Analyse photo activée.');
      appsRefresh(); render();
      if (pending) { const f = pending; pending = null; ACT.appsClose(); analyzePhoto(f); }
    },
    aiKeyForget() { AI.clearKey(); toast('Clé retirée.'); appsRefresh(); render(); },
  });
}

/* Applis du même site dans un onglet du tracker : Do It Sport à la place de Budget, Fox Bank à la place de Traceo.
   Chacune tourne dans un cadre gardé en vie quand on change d'onglet (un minuteur en cours n'est jamais coupé). */
const EMBED = {
  doit: { src: 'sport/index.html', title: 'Do It Sport', bg: '#040B1C', bgDark: '#040B1C' },
  foxbank: { src: 'foxbank/index.html', title: 'Fox Bank', bg: '#F3F4F7', bgDark: '#0B0F17' },
};
Object.assign(ICONS, {
  doit: '<path d="M9 9.5V7a3 3 0 0 1 6 0v2.5"/><circle cx="12" cy="15" r="6"/><path d="M10 15h4"/>',
  fox: '<path d="M4 4.5 9 9h6l5-4.5.5 9L12 21l-8.5-7.5Z"/><path d="M9.5 13.5h.01M14.5 13.5h.01"/><path d="m10.5 17.2 1.5 1.3 1.5-1.3"/>',
});
function swapTab(from, to) { const i = TABS.findIndex((t) => t[0] === from); if (i >= 0) TABS.splice(i, 1, to); }
swapTab('budget', ['doit', 'Do It', 'doit']);
swapTab('traceo', ['foxbank', 'Fox Bank', 'fox']);
{ const i = TABS.findIndex((t) => t[0] === 'hyg'); if (i >= 0) TABS.splice(i, 1); } // onglet Hygiène retiré
/* ses cartes Hydratation, Sommeil et Humeur & énergie passent dans Accueil (sans la routine d'hygiène) */
function hygCards() { const h = vHyg(), a = h.indexOf('<section'), b = h.indexOf('<section', a + 8); return b > 0 ? h.slice(b) : ''; }
/* la routine d'hygiène ne compte plus dans la note du jour : les autres parts sont remises sur 100 */
score = function (d, st) {
  const t = tasksFor(d.date), tk = t.total ? t.done / t.total : 0;
  const sp = Math.min(1, act(d, st).kcal / 450);
  const n = nutri(d), nu = n.food > 0 ? Math.max(0, 1 - Math.abs(n.k - st.kcalGoal) / st.kcalGoal * 1.5) : 0;
  const al = d.beer == null ? 0.5 : d.beer === 0 ? 1 : d.beer === 1 ? 0.35 : 0;
  const w = Math.min(1, (d.water || 0) / st.waterGoal);
  return Math.round((tk * 18 + sp * 22 + nu * 18 + al * 16 + w * 8) / 82 * 100);
};
function doitDay(id) {
  let j = null;
  try { j = JSON.parse(localStorage.getItem('doitsport-sum') || 'null'); } catch (e) {}
  const d = (j && j.days && j.days[id]) || {};
  return { kcal: d.kcal || 0, cyc: d.cyc || 0, min: d.min || 0, goal: (j && j.goal) || 300 };
}
function embedHost() { const e = EMBED[S.tab]; return `<section class="card" style="text-align:center"><p class="hint">Ouverture de ${esc(e ? e.title : '')}…</p></section>`; }
const embeds = {};
function embedSync() {
  if (!embedSync.css) {
    embedSync.css = document.createElement('style');
    embedSync.css.textContent = '.embedWrap{position:fixed;left:0;right:0;top:0;z-index:29;padding-top:env(safe-area-inset-top,0px)}.embedWrap iframe{display:block;width:100%;height:100%;border:0}html.embed-on,html.embed-on body{overflow:hidden}html.embed-on .fab{display:none}'
      + Object.entries(EMBED).map(([k, e]) => `#embed-${k}{background:${e.bg}}@media (prefers-color-scheme:dark){#embed-${k}{background:${e.bgDark}}}`).join('');
    document.head.appendChild(embedSync.css);
    addEventListener('resize', () => { const el = embeds[S.tab]; if (el) embedPlace(el); });
  }
  const cur = EMBED[S.tab] ? S.tab : null;
  if (cur && !embeds[cur]) {
    const el = document.createElement('div');
    el.className = 'embedWrap'; el.id = 'embed-' + cur;
    el.innerHTML = `<iframe src="${EMBED[cur].src}" title="${esc(EMBED[cur].title)}" allow="screen-wake-lock; autoplay; fullscreen; clipboard-write"></iframe>`;
    document.body.appendChild(el); embeds[cur] = el;
  }
  for (const [k, el] of Object.entries(embeds)) { el.hidden = k !== cur; if (k === cur) embedPlace(el); }
  document.documentElement.classList.toggle('embed-on', !!cur);
}
function embedPlace(el) { const nav = document.querySelector('.nav'); el.style.bottom = (nav ? nav.offsetHeight : 0) + 'px'; }
const _renderEmbed = render;
render = function () { _renderEmbed.apply(this, arguments); embedSync(); };
// pas de photo de motivation par-dessus une appli d'onglet (ni le bouton Musique du tracker : Do It Sport a le sien)
const _motivReadyEmbed = motivReady;
motivReady = () => !EMBED[S.tab] && _motivReadyEmbed();
// la tuile Do It Sport de l'accueil suit la séance en direct (même site, même stockage)
addEventListener('storage', (e) => { if (e.key === 'doitsport-sum' && S.tab === 'home') softRender(); });
const HASH_TAB = { doit: 'doit', budget: 'doit', foxbank: 'foxbank', fox: 'foxbank', traceo: 'foxbank', admin: 'foxbank', hygiene: 'home', hyg: 'home',
  home: 'home', accueil: 'home', food: 'food', repas: 'food', sport: 'sport', beer: 'beer', sobriete: 'beer', photos: 'photos', todo: 'todo', taches: 'todo' };
// #onglet, éventuellement suivi de &lien=… (ouverture depuis un widget du PC)
const hashTab = HASH_TAB[(location.hash || '').slice(1).split('&')[0].toLowerCase()];
if (hashTab) S.tab = hashTab;
else if (S.tab === 'budget') S.tab = 'doit';
else if (S.tab === 'traceo') S.tab = 'foxbank';
else if (S.tab === 'hyg') S.tab = 'home';
S._nav = null;
render();

/* Barre d'onglets : une icône fixe et un titre toujours visible par onglet (plus de jeux d'icônes qui tournent),
   et un grand titre en tête de chaque onglet du tracker. */
const TAB_UI = {
  home: { l: 'Accueil', t: 'Ma journée', s: "L'essentiel d'aujourd'hui, en un coup d'œil" },
  food: { l: 'Repas', t: 'Repas', s: 'Calories, macros et fibres de la journée' },
  sport: { l: 'Sport', t: 'Sport', s: 'Dépense, marche, natation et salle' },
  beer: { l: 'Sobriété', t: 'Sobriété', s: "Zéro alcool, un jour après l'autre" },
  photos: { l: 'Photos', t: 'Photos', s: 'Pierre qui avance, et toute ta galerie' },
  doit: { l: 'Do It' },
  todo: { l: 'Tâches', t: 'Tâches', s: "Ce qu'il reste à faire" },
  foxbank: { l: 'Banque' },
};
{
  const st = document.createElement('style');
  st.textContent = `
.nav{padding:6px max(4px,env(safe-area-inset-right,0px)) calc(4px + env(safe-area-inset-bottom,0px)) max(4px,env(safe-area-inset-left,0px))}
.nav .nav-in{display:grid;grid-template-columns:repeat(var(--tabs,9),minmax(0,1fr));gap:0;max-width:720px}
.nav .nav-in button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;height:54px;padding:0 1px;border-radius:14px;background:none;color:var(--muted);min-width:0}
.nav .nav-in button span.ni{max-width:none;width:44px;height:28px;border-radius:999px;display:grid;place-items:center;transition:background .25s,color .25s}
.nav .nav-in button span.nl{max-width:100%;overflow:hidden;text-overflow:clip;white-space:nowrap;font:600 10px/1.15 Geist,ui-sans-serif,system-ui,sans-serif;letter-spacing:.005em;transition:color .25s}
.nav .nav-in button.on{background:none;padding:0 1px}
.nav .nav-in button.on span.ni{background:var(--accent);color:var(--on-accent)}
.nav .nav-in button.on span.nl{max-width:100%;color:var(--fg,var(--text,currentColor))}
@media (max-width:385px){.nav .nav-in button span.nl{font-size:9.4px;letter-spacing:-.01em}}
@media (min-width:600px){.nav .nav-in button span.nl{font-size:11.5px}.nav .nav-in button{height:58px}}
.ptitle{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:2px 2px 4px}
.ptitle>div{min-width:0}
.ptitle h1{margin:0;font:700 30px/1.05 Geist,ui-sans-serif,system-ui,sans-serif;letter-spacing:-.035em;text-wrap:balance}
.ptitle p{margin:6px 0 0;font:500 14px/1.35 Geist,ui-sans-serif,system-ui,sans-serif;color:var(--muted);letter-spacing:-.005em}
.ptitle .pb{flex:none;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:var(--accent);color:var(--on-accent)}
@media (min-width:600px){.ptitle h1{font-size:36px}}`;
  document.body.appendChild(st); // après les styles de l'appli (dans <body>), pour passer devant à force égale
}
renderChrome = function () {
  const t = TODAY(), isT = S.sel === t;
  $('#dlabel').innerHTML = isT ? `<em>Aujourd'hui</em><span>${esc(shortDate(S.sel))}</span>` : `${S.sel > t ? '<em>À venir</em>' : ''}<span>${esc(shortDate(S.sel))}</span>`;
  $('#btn-next').disabled = S.tab !== 'todo' && S.sel >= t;
  if (S._nav !== S.tab) {
    S._nav = S.tab;
    const nav = $('#nav');
    nav.style.setProperty('--tabs', TABS.length);
    nav.innerHTML = TABS.map(([k, l, i], n) => {
      const u = TAB_UI[k] || { l }, on = S.tab === k;
      return `<button class="${on ? 'on' : ''}" style="--n:${n}" data-a="tab" data-v="${k}" aria-label="${esc(u.l)}" ${on ? 'aria-current="page"' : ''}><span class="ni">${ic(i, 21)}</span><span class="nl">${esc(u.l)}</span></button>`;
    }).join('');
  }
  const p = $('#soberPill'); if (p) p.innerHTML = `${ic('shield', 16)}<span>Jour ${progDay()}</span>`;
};
const _renderTitles = render;
render = function () {
  _renderTitles.apply(this, arguments);
  const u = TAB_UI[S.tab], m = $('#main'), tab = TABS.find((x) => x[0] === S.tab);
  if (u && u.t && m && !m.querySelector(':scope > .ptitle')) {
    m.insertAdjacentHTML('afterbegin', `<header class="ptitle"><div><h1>${esc(u.t)}</h1><p>${esc(u.s)}</p></div><span class="pb" aria-hidden="true">${ic(tab ? tab[2] : 'home', 22)}</span></header>`);
  }
};

/* Mise à jour automatique : à l'ouverture et à chaque retour dans l'appli, si une nouvelle version est en ligne,
   l'appli se recharge (une fois par version). Pas pendant une séance Do It ou dans Fox Bank : un bouton le propose. */
function rpCheckUpdate() {
  if (!window.RP_BUILD) return;
  try { navigator.serviceWorker && navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {}); } catch (e) {}
  fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (!j || !j.v || j.v === window.RP_BUILD) return;
    let tried = ''; try { tried = sessionStorage.getItem('rp-upd') || ''; } catch (e) {}
    const go = () => { try { sessionStorage.setItem('rp-upd', j.v); } catch (e) {} location.reload(); };
    if (tried === j.v || EMBED[S.tab] || isTyping() || S.sheet) { toast('Nouvelle version du tracker disponible.', { label: 'Mettre à jour', fn: go }); return; }
    go();
  }).catch(() => {});
}
setTimeout(rpCheckUpdate, 1500);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') rpCheckUpdate(); });
setInterval(rpCheckUpdate, 15 * 60e3);
S._nav = null;
render();

/* Widgets du bureau Windows (Lively Wallpaper) : chaque modification part, chiffrée, vers les widgets et vers le tracker
   ouvert sur le PC (et inversement). Relais ntfy.sh, code de liaison à 12 caractères : voir apps/widgets/link.js. */
if (window.RP_STANDALONE && window.RPLink) {
  const L = window.RPLink, CK = 'rp-link', MK = 'rp-link-meta', RK = 'rp-link-rate';
  const LS_SYNC = ['foxbank-v1', 'doitsport-v1', 'doitsport-sum'];
  const DOC_RE = /^(settings|todos|\d{4}-\d{2}-\d{2})$/, SNAP_DAYS = 40, SNAP_EVERY = 6 * 3600e3;
  const WIDGETS_URL = new URL('widgets/', location.href).href.split('#')[0].split('?')[0];
  const jget = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
  const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let cfg = jget(CK, null), meta = jget(MK, {}), rate = jget(RK, { d: '', n: 0 });
  let conn = null, live = 'off', pubT = null, pubKind = 'd', lastPub = 0, gotSnap = false, helloT = null, sending = false;
  const queue = new Set(), lsLast = {};
  LS_SYNC.forEach((k) => { lsLast[k] = localStorage.getItem(k); });
  Object.assign(ICONS, { desk: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>' });

  const saveCfg = () => jset(CK, cfg);
  const docIds = () => ['settings', 'todos', ...Object.keys(S.docs).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))];
  function docVal(id) {
    if (id.startsWith('ls:')) { const v = localStorage.getItem(id.slice(3)); return v == null ? undefined : v; }
    if (id === 'settings') return S.settings;
    if (id === 'todos') return S.todos;
    return S.docs[id];
  }

  /* --- résumé lu par les widgets (calculé ici, avec les mêmes formules que l'appli) --- */
  const FOX_B = { courses: 30000, logement: 60000, transport: 12000, sorties: 12000, shopping: 10000, abonnements: 5000, sante: 5000, autres: 6000 };
  function foxSum(T) {
    const j = jget('foxbank-v1', null);
    if (!j || !j.cfg) return null;
    const c = j.cfg, a0 = c.anchor || { amount: 0, at: 0 }, debit = c.debit !== false, months = j.months || {};
    const mo = months[T.slice(0, 7)] || { e: [], v: [] };
    let tin = 0, tout = 0;
    for (const m of Object.values(months)) {
      for (const v of m.v || []) if (v.t > a0.at) tin += v.a;
      if (debit) for (const e of m.e || []) if (e.t > a0.at) tout += e.a;
    }
    const cats = {};
    let spent = 0, today = 0, recv = 0;
    for (const e of mo.e || []) { cats[e.c] = (cats[e.c] || 0) + e.a; spent += e.a; if (e.d === T) today += e.a; }
    for (const v of mo.v || []) recv += v.a;
    const bud = Object.values({ ...FOX_B, ...(c.budgets || {}) }).reduce((s, x) => s + (+x || 0), 0);
    const last = [...(mo.e || [])].sort((p, q) => q.t - p.t).slice(0, 3).map((e) => [String(e.n || '').slice(0, 40), e.a, e.c, e.d]);
    return { bal: a0.amount + tin - tout, set: !!(a0.set || a0.at), spent, recv, today, budget: bud, top: Object.entries(cats).sort((p, q) => q[1] - p[1]).slice(0, 4), last };
  }
  function linkSum() {
    const T = TODAY(), st = S.settings, d = S.docs[T] || blank(T), n = nutri(d), a = act(d, st), bl = balance(d, st), t = tasksFor(T), bs = beerStats(T), dz = doitDay(T);
    const week = [...Array(7)].map((_, i) => { const id = addDays(T, i - 6), x = S.docs[id]; return [id, x ? score(x, st) : 0, x ? x.steps || 0 : 0, x ? Math.round(nutri(x).k) : 0, doitDay(id).kcal]; });
    const todo = relTasks(T).filter((x) => !x.d).sort((p, q) => (p.time || '99').localeCompare(q.time || '99')).slice(0, 6)
      .map((x) => [String(x.t || '').slice(0, 70), x.time || '', x.due && x.due < T ? 1 : 0]);
    for (const r of st.routine || []) if (todo.length < 6 && !(d.rt && d.rt[r])) todo.push([String(r).slice(0, 70), '', 0, 1]);
    const w = S.meteo;
    return {
      date: T, at: Date.now(), dt: Object.values(meta).reduce((x, y) => (y > x ? y : x), 0), score: score(d, st), week,
      kcal: Math.round(n.k), kcalGoal: st.kcalGoal, p: Math.round(n.p), g: Math.round(n.g), l: Math.round(n.l), meals: (d.food || []).length,
      out: Math.round(bl.out), diff: Math.round(bl.diff),
      steps: d.steps || 0, stepsGoal: st.stepsGoal, km: Math.round(a.w.km * 10) / 10, act: Math.round(a.kcal),
      swim: Math.round(a.s.min), gym: d.gym && d.gym.min ? [d.gym.min, d.gym.s || ''] : null,
      water: d.water || 0, waterGoal: st.waterGoal, sleep: d.sleep, sq: d.sq, mood: d.mood, energy: d.energy,
      beer: d.beer, sober: bs.streak, saved: Math.round(bs.saved),
      tasks: { open: t.open, done: t.done, total: t.total, list: todo },
      doit: { kcal: dz.kcal, min: dz.min, cyc: dz.cyc, goal: dz.goal },
      fox: foxSum(T),
      wx: w ? { t: w.t, code: w.code, tmin: w.tmin, tmax: w.tmax, pop: w.pop, city: w.city, date: w.date } : null,
      quotes: [0, 11, 23, 37].map((k) => pick(QUOTES, T, k)),
    };
  }

  /* --- envoi : regroupé (les relais acceptent 17 280 messages par jour, ntfy.sh 250) --- */
  function bump(n) { const T = TODAY(); if (rate.d !== T) rate = { d: T, n: 0 }; rate.n += n; jset(RK, rate); }
  function schedule(kind, ms) {
    if (!cfg) return;
    if (kind === 's') pubKind = 's';
    const T = TODAY(), used = rate.d === T ? rate.n : 0, gap = used > 3000 ? 60e3 : 1000;
    const at = Math.max(Date.now() + (ms == null ? 500 : ms), lastPub + gap);
    if (pubT && pubT.at <= at) return;
    clearTimeout(pubT && pubT.id);
    pubT = { at, id: setTimeout(publish, at - Date.now()) };
  }
  async function publish(bg) {
    pubT = null;
    if (!cfg || !conn) return;
    if (sending) { schedule(null, 800); return; }
    const kind = pubKind; pubKind = 'd';
    let ids = [...queue];
    if (kind === 's') {
      const from = addDays(TODAY(), -SNAP_DAYS);
      ids = [...new Set([...ids, ...docIds().filter((k) => !/^\d/.test(k) || k >= from), ...LS_SYNC.map((k) => 'ls:' + k)])];
    }
    queue.clear();
    const docs = {};
    for (const id of ids) { const v = docVal(id); if (v !== undefined && meta[id] > 0) docs[id] = { t: meta[id], v }; }
    // un résumé impossible à calculer ne doit jamais bloquer l'envoi des données
    let sum = null;
    try { sum = linkSum(); } catch (e) { cfg.sumErr = String(e && e.message || e).slice(0, 80); }
    const msg = { v: 1, k: kind, dev: cfg.dev, at: Date.now(), docs, sum };
    sending = true; lastPub = Date.now();
    try {
      const r = await conn.send(msg, bg === true);
      bump(r.n);
      if (kind === 's') cfg.snap = msg.at;
      cfg.sent = msg.at; cfg.relays = [r.ok, r.of]; cfg.err = ''; if (sum) cfg.sumDate = sum.date; saveCfg();
      for (const k of LS_SYNC) if (docs['ls:' + k]) lsLast[k] = docs['ls:' + k].v;
    } catch (e) {
      ids.forEach((id) => queue.add(id)); if (kind === 's') pubKind = 's';
      cfg.err = (e && e.code) || 'relay'; cfg.errAt = Date.now(); saveCfg();
      schedule(null, cfg.err === 'rate' ? 60e3 : 10000);
    } finally { sending = false; linkPaint(); }
  }
  function touched(id) {
    if (!cfg || !(DOC_RE.test(id) || id.startsWith('ls:'))) return;
    meta[id] = Date.now(); jset(MK, meta); queue.add(id); schedule();
  }
  const _saveLink = save;
  save = function (id) { _saveLink.apply(this, arguments); if (!S.ro) touched(id); };
  const _saveManyLink = saveMany;
  saveMany = function (ids) { const r = _saveManyLink.apply(this, arguments); if (!S.ro) (ids || []).forEach(touched); return r; };
  // Fox Bank et Do It Sport (dans leurs onglets) écrivent dans le même stockage : on suit leurs changements
  addEventListener('storage', (e) => {
    if (!cfg || !LS_SYNC.includes(e.key) || e.newValue == null || e.newValue === lsLast[e.key]) return;
    lsLast[e.key] = e.newValue; touched('ls:' + e.key);
  });
  // l'appli passe en arrière-plan : on envoie tout de suite ce qui attend
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pubT && cfg) { clearTimeout(pubT.id); publish(true); }
    if (document.visibilityState === 'visible') setTimeout(routine, 4000);
  });

  /* --- réception --- */
  const embedReload = new Set();
  const pings = {};
  function onData(m, info) {
    if (!cfg) return;
    if (info && info.time > (cfg.last || 0)) { cfg.last = info.time; saveCfg(); }
    cfg.heard = Date.now();
    if (m && m.k === 'ping') { if (m.dev === cfg.dev && pings[m.id]) pings[m.id](info); return; }
    if (!m || m.v !== 1 || m.dev === cfg.dev) return;
    if (m.k === 'h') {
      // un widget ne demande que le résumé, un tracker qui arrive demande tout
      if (hasData()) { if (m.want === 'sum') { if (m.at > (cfg.sent || 0)) schedule(null, 1500); } else if (m.at > (cfg.snap || 0)) schedule('s', 1500); }
      return;
    }
    if (m.k === 's') { gotSnap = true; if (!cfg.got) { cfg.got = true; saveCfg(); } }
    let changed = false, theme = false;
    for (const [id, d] of Object.entries(m.docs || {})) {
      if (!d || !(d.t > (meta[id] || 0))) continue;
      if (id.startsWith('ls:')) {
        const k = id.slice(3);
        if (!LS_SYNC.includes(k) || typeof d.v !== 'string') continue;
        try { localStorage.setItem(k, d.v); } catch (e) { continue; }
        lsLast[k] = d.v; embedReload.add(k === 'foxbank-v1' ? 'foxbank' : 'doit');
      } else if (DOC_RE.test(id) && d.v && typeof d.v === 'object') {
        apply(id, d.v); if (id === 'settings') theme = true;
      } else continue;
      meta[id] = d.t; queue.delete(id); changed = true;
    }
    if (!changed) return;
    // enregistré tout de suite (pas après le délai habituel) : l'appli peut être fermée dans la seconde
    clearTimeout(lsT);
    try { localStorage.setItem(LS_KEY, JSON.stringify({ docs: S.docs, settings: S.settings, todos: S.todos, meteo: S.meteo })); } catch (e) {}
    jset(MK, meta);
    if (theme && typeof applyTheme === 'function') try { applyTheme(); } catch (e) {}
    if (m.k === 's' && !cfg.src && !cfg.welcomed) { cfg.welcomed = true; saveCfg(); toast('Tes données du téléphone sont arrivées.'); }
    refresh();
  }
  function refresh() {
    for (const k of [...embedReload]) {
      const el = embeds[k], f = el && el.querySelector('iframe');
      if (!f) { embedReload.delete(k); continue; }
      let busy = false;
      try { const a = f.contentDocument && f.contentDocument.activeElement; busy = !el.hidden && !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); } catch (e) {}
      if (busy) continue; // rechargé dès que la saisie est finie
      embedReload.delete(k);
      try { f.contentWindow.location.reload(); } catch (e) { f.src = f.src; }
    }
    if (embedReload.size) setTimeout(refresh, 2000);
    if (S.sheet) return; // une fiche ouverte : on ne redessine pas sous les doigts
    softRender();
  }

  /* --- connexion --- */
  const hasData = () => Object.values(meta).some((t) => t > 1);
  function routine() {
    if (!cfg || !conn || !hasData()) return;
    // le téléphone (source) republie tout au plus toutes les 6 h si quelque chose a changé (le relais garde 12 h),
    // et chaque appareil envoie un résumé frais au premier lancement de la journée
    // (et un résumé à chaque retour dans l'appli après 15 min : les widgets restent toujours à jour)
    const newer = Object.values(meta).some((t) => t > (cfg.snap || 0));
    if (cfg.src && newer && Date.now() - (cfg.snap || 0) > SNAP_EVERY) schedule('s', 0);
    else if (cfg.sumDate !== TODAY() || Date.now() - (cfg.sent || 0) > 15 * 60e3 || cfg.err) schedule(null, 0);
  }
  function start() {
    if (conn) conn.close();
    gotSnap = false;
    conn = L.connect(cfg.code, {
      since: cfg.last || 0,
      onData,
      onStatus: (s) => { live = s; linkPaint(); },
    });
    conn.ready.then(() => setTimeout(routine, 5000)).catch(() => { live = 'retry'; linkPaint(); });
    clearTimeout(helloT);
    // appareil qui rejoint, encore sans données ou absent plus de 11 h : il demande tout
    // (le téléphone répond dès qu'il est ouvert, les widgets du PC aussi s'ils ont une copie)
    const gap = Date.now() / 1000 - (cfg.last || 0) > 11 * 3600;
    if (!cfg.src && (!cfg.got || gap)) helloT = setTimeout(() => { if (!gotSnap && conn) conn.send({ v: 1, k: 'h', dev: cfg.dev, at: Date.now() }).then((r) => bump(r.n)).catch(() => {}); }, 6000);
  }
  function enable(code, src) {
    cfg = { code, dev: L.rid(8), src: !!src, last: 0, snap: 0 };
    // source (en général l'iPhone) : ses données font foi. Appareil qui rejoint : ses propres données ne
    // passent qu'à défaut (date la plus ancienne possible), celles du téléphone les remplacent.
    const t = src ? Date.now() : 1;
    for (const id of docIds()) if (!meta[id]) meta[id] = t;
    for (const k of LS_SYNC) if (localStorage.getItem(k) != null && !meta['ls:' + k]) meta['ls:' + k] = t;
    jset(MK, meta); saveCfg(); start();
  }
  function disable() {
    if (conn) conn.close();
    conn = null; cfg = null; live = 'off'; queue.clear();
    try { localStorage.removeItem(CK); localStorage.removeItem(MK); } catch (e) {}
    meta = {};
  }

  /* --- réglage dans « Mes apps » --- */
  const linkUrl = () => WIDGETS_URL + '#' + cfg.code;
  const ago = (ms) => { const s = Math.round((Date.now() - ms) / 1000); return s < 60 ? `il y a ${Math.max(1, s)} s` : s < 3600 ? `il y a ${Math.round(s / 60)} min` : `à ${new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`; };
  const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Mac/.test(navigator.platform || '') && navigator.maxTouchPoints > 1);
  const MOBILE = IOS || /Android/i.test(navigator.userAgent);
  const STANDALONE = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  // dans Safari, le tracker n'a pas les mêmes données que l'appli de l'écran d'accueil : c'est elle qu'il faut relier
  const safariNote = () => IOS && !STANDALONE ? `<p style="padding:10px 12px;border-radius:12px;background:rgba(255,92,122,.16);color:var(--hero-fg,inherit)"><b>Tu es dans Safari.</b> Ouvre plutôt le tracker depuis son icône sur l'écran d'accueil : Safari et l'appli gardent des données séparées, et c'est l'appli qu'il faut relier.</p>` : '';
  const ERR = { rate: 'relais saturés', offline: "pas d'internet", relay: 'relais injoignables' };
  function linkLines() {
    const st = live === 'live' ? 'En direct' : live === 'retry' ? 'Reconnexion…' : 'Connexion…';
    const sent = cfg.err ? `Dernier envoi échoué ${ago(cfg.errAt)} (${ERR[cfg.err] || cfg.err}) : nouvel essai automatique`
      : cfg.sent ? `Dernier envoi ${ago(cfg.sent)}${cfg.relays ? `, reçu par ${cfg.relays[0]} relais sur ${cfg.relays[1]}` : ''}` : 'Rien envoyé pour le moment';
    return [st + ' · chiffré de bout en bout', sent];
  }
  function linkCard() {
    if (!cfg) {
      const join = `<p class="small muted" style="margin:0 0 6px">${MOBILE ? 'Déjà activé sur un autre appareil ? Tape son code :' : "Tape le code affiché sur ton iPhone (Widgets PC) :"}</p>
      <div class="grid2" style="grid-template-columns:minmax(0,1fr) auto;margin-bottom:10px"><input class="inp" id="linkCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX" maxlength="16"><button class="btn ${MOBILE ? 'ghost' : 'go'}" data-a="linkJoin">Relier</button></div>`;
      const on = `<button class="btn block ${MOBILE ? 'go' : 'ghost'}" data-a="linkOn" style="margin-bottom:10px">${ic('desk', 17)} ${MOBILE ? 'Activer les widgets PC' : 'Créer un nouveau code ici'}</button>`;
      return `<div class="apps-note" id="linkCard"><b>${ic('desk', 15)} Widgets du PC (Lively Wallpaper)</b>
      <p>Ta journée en widgets animés sur le bureau de ton PC Windows, mis à jour en direct dès que tu remplis le tracker. Un clic sur un widget ouvre le tracker sur le PC.</p>
      ${safariNote()}${MOBILE ? on + join : join + on}</div>`;
    }
    const [l1, l2] = linkLines();
    return `<div class="apps-note" id="linkCard"><b>${ic('desk', 15)} Widgets du PC : activés</b>
      <p>Code de liaison : <b class="num" style="font-size:17px;letter-spacing:.06em">${esc(cfg.code)}</b></p>
      ${safariNote()}
      <p>Sur le PC, ouvre <b>${esc(WIDGETS_URL.replace(/^https:\/\//, ''))}</b> dans Chrome et tape ce code (ou envoie-toi le lien ci-dessous). Les 4 derniers caractères s'affichent aussi en bas des widgets : ils doivent être identiques.</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px"><button class="btn go sm" data-a="linkTest">${ic('bolt', 14)} Tester la liaison</button><button class="btn ghost sm" data-a="linkCopy">${ic('copy', 14)} Copier le lien</button>${navigator.share ? `<button class="btn ghost sm" data-a="linkShare">${ic('ext', 14)} Envoyer le lien</button>` : ''}<button class="btn ghost sm" data-a="linkPush">${ic('repeat', 14)} Tout renvoyer</button></div>
      <p class="small muted" id="linkState" style="margin:0 0 4px">${esc(l1)}</p>
      <p class="small muted" id="linkSent" style="margin:0 0 10px">${esc(l2)}</p>
      <button class="btn ghost sm" data-a="linkOff" style="margin-bottom:10px">Désactiver sur cet appareil</button></div>`;
  }
  function linkPaint() {
    if (!cfg) return;
    const [l1, l2] = linkLines(), a = $('#linkState'), b = $('#linkSent');
    if (a) a.textContent = l1;
    if (b) b.textContent = l2;
  }
  setInterval(linkPaint, 15000);
  const _xferLink = xferNote;
  xferNote = () => linkCard() + _xferLink();
  const linkOpen = () => {
    ACT.appsOpen();
    setTimeout(() => { const c = $('#linkCard'); if (c) c.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 350);
  };
  // raccourci dans la rangée de boutons de l'accueil
  const _renderLink = render;
  render = function () {
    _renderLink.apply(this, arguments);
    const r = S.tab === 'home' && $('#main .scrollx');
    if (r && !r.querySelector('[data-a="linkOpen"]')) r.insertAdjacentHTML('afterbegin', `<button class="chip" data-a="linkOpen">${ic('desk', 15)} Widgets PC</button>`);
  };
  Object.assign(ACT, {
    linkOpen,
    linkOn() { enable(L.newCode(), true); schedule('s', 300); haptic('success'); toast('Widgets PC activés : tape le code sur ton PC.'); appsRefresh(); },
    linkJoin() {
      const c = L.parse(($('#linkCode') || {}).value);
      if (!c) { toast('Code incomplet : 12 caractères, comme 7KQ2-M9XF-3HWD.'); return; }
      enable(c, false); haptic('success'); toast('Appareil relié : récupération des données…'); appsRefresh();
    },
    linkCopy() {
      const u = linkUrl();
      (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast('Lien copié.'), () => toast(u));
    },
    linkShare() { navigator.share({ title: 'Mes widgets PC', text: 'Widgets du tracker pour Lively Wallpaper', url: linkUrl() }).catch(() => {}); },
    linkPush() { schedule('s', 0); toast('Envoi de toutes tes données…'); },
    // aller-retour par les relais : le message de test revient à l'iPhone et s'affiche aussi sur les widgets du PC
    async linkTest(t) {
      if (!conn) return;
      const id = L.rid(8), t0 = Date.now();
      t.disabled = true;
      const back = new Promise((ok) => { pings[id] = ok; setTimeout(() => ok(null), 12000); });
      let sent = null;
      try { sent = await conn.send({ v: 1, k: 'ping', id, dev: cfg.dev, at: t0 }); } catch (e) { cfg.err = (e && e.code) || 'relay'; cfg.errAt = Date.now(); }
      const info = sent ? await back : null;
      delete pings[id]; t.disabled = false;
      if (info) { cfg.err = ''; toast(`Liaison OK : aller-retour en ${(Math.max(1, Date.now() - t0) / 1000).toFixed(1).replace('.', ',')} s, ${sent.ok} relais sur ${sent.of}. Regarde ton PC.`); haptic('success'); }
      else toast(sent ? "Envoyé, mais rien n'est revenu : vérifie ta connexion internet." : `Échec de l'envoi (${ERR[cfg.err] || cfg.err}). Vérifie ta connexion internet.`);
      saveCfg(); linkPaint();
      if (info) schedule(null, 0); // et un résumé frais pour les widgets
    },
    linkOff() { disable(); toast('Widgets PC désactivés sur cet appareil.'); appsRefresh(); },
  });

  // ouvert depuis un widget du PC : …/Vous-/#onglet&lien=CODE relie ce navigateur tout seul
  // (après le #, le code n'est jamais envoyé au serveur ; il est retiré de l'adresse aussitôt)
  const hp = (location.hash || '').slice(1).split('&'), hl = hp.findIndex((x) => /^lien=/i.test(x));
  const lien = hl >= 0 ? L.parse(decodeURIComponent(hp[hl].slice(5))) : null;
  if (hl >= 0) { hp.splice(hl, 1); history.replaceState(null, '', location.pathname + location.search + (hp.join('&') ? '#' + hp.join('&') : '')); }
  if (lien && (!cfg || cfg.code !== lien)) { enable(lien, false); setTimeout(() => toast('Tracker relié à tes widgets : tes données arrivent.'), 1200); }
  else if (cfg) start();
  if ((location.hash || '').split('&')[0].toLowerCase() === '#widgets') setTimeout(linkOpen, 600);
  window.RP_LINK = { sum: linkSum, state: () => ({ cfg, live, queue: [...queue], meta: Object.keys(meta).length, rate }) };
}
