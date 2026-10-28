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
const HASH_TAB = { doit: 'doit', budget: 'doit', foxbank: 'foxbank', fox: 'foxbank', traceo: 'foxbank', admin: 'foxbank' };
const hashTab = HASH_TAB[(location.hash || '').slice(1).toLowerCase()];
if (hashTab) S.tab = hashTab;
else if (S.tab === 'budget') S.tab = 'doit';
else if (S.tab === 'traceo') S.tab = 'foxbank';
S._nav = null;
render();
