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
