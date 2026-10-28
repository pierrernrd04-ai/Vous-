#!/usr/bin/env node
// Construit public/index.html (version web autonome du tracker) à partir de app.source.html,
// l'export de l'artefact Claude « Routine & Performance ».
//
//   node apps/tracker/build.mjs
//
// Pour mettre à jour l'appli : remplacer app.source.html par le nouvel export, relancer, pousser.
// Prérequis : npm ci (dans apps/tracker), pour le SDK Claude et esbuild.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { build as esbuild } from 'esbuild';

const dir = new URL('./', import.meta.url);
let src = readFileSync(new URL('app.source.html', dir), 'utf8');
const MODE = process.env.TRACKER_MODE === 'cloud' ? 'cloud' : 'local';
const addon = readFileSync(new URL('addon.js', dir), 'utf8');

// analyse photo et tri : ai.js + SDK Claude, regroupés dans public/ai.js (chargé au premier usage)
const sdk = JSON.parse(readFileSync(new URL('node_modules/@anthropic-ai/sdk/package.json', dir), 'utf8'));
const license = readFileSync(new URL('node_modules/@anthropic-ai/sdk/LICENSE', dir), 'utf8').trim();
const ai = (await esbuild({
  entryPoints: [new URL('ai.js', dir).pathname], bundle: true, write: false, minify: true,
  format: 'iife', platform: 'browser', target: ['safari15'], legalComments: 'none',
  banner: { js: `/* @anthropic-ai/sdk ${sdk.version}\n${license.replace(/\*\//g, '* /')}\n*/` },
})).outputFiles[0].text;
writeFileSync(new URL('public/ai.js', dir), ai);
const aiSrc = `ai.js?v=${createHash('sha256').update(ai).digest('hex').slice(0, 8)}`;
const shim = `window.RP_MODE = '${MODE}';\nwindow.RP_AI_SRC = '${aiSrc}';\n` + readFileSync(new URL('shim.js', dir), 'utf8');

// 1. Retire l'enveloppe ajoutée par Claude autour de l'artefact.
const body = src.indexOf('<body>');
if (body >= 0) src = src.slice(body + 6);
src = src.replace(/<\/body>\s*<\/html>\s*$/, '');

// 2. Remonte <title>, <meta> et <link> du début du fichier dans <head>.
const lead = src.match(/^\s*(?:<(?:title)>[^<]*<\/title>\s*|<(?:meta|link)\b[^>]*>\s*)+/);
let headTags = '';
if (lead) {
  headTags = lead[0].replace(/<meta name="theme-color"[^>]*>/, '');
  src = src.slice(lead[0].length);
}

// 3. Petites adaptations pour la version web.
const patches = [
  // analyse photo de l'assiette et tri automatique : actifs dès qu'une clé Claude est enregistrée (addon.js)
  ["(window.RP_STANDALONE?'':photoCard())", 'photoCard()'],
  ['on=!SA&&S.settings.impPeople!==false', 'on=(!SA||rpAiOn())&&S.settings.impPeople!==false'],
  ['${SA?\'\':`<div class="wrap" style="margin-top:12px"><button class="chip ${on?\'on\':\'\'}" data-a="impPeople"',
    '${SA&&!rpAiOn()?rpAiChip():`<div class="wrap" style="margin-top:12px"><button class="chip ${on?\'on\':\'\'}" data-a="impPeople"'],
  ["mode:S.settings.impPeople===false||window.RP_STANDALONE?'all':'people'", "mode:S.settings.impPeople===false||!rpAiOn()?'all':'people'"],
  // Budget laisse sa place à Do It Sport et Traceo à Fox Bank (addon.js) : leurs vues et la tuile Do It de l'accueil
  ['+transitCard()+v.slice(i)+menusCard()},sport:vSport,hyg:vHyg,beer:vSober,traceo:vTraceo,', '+transitCard()+v.slice(i)+menusCard()},sport:vSport,hyg:vHyg,beer:vSober,traceo:vTraceo,doit:embedHost,foxbank:embedHost,'],
  ["${tile('budget','Budget du mois',N(ms.total),'€',`sur ${i0(st.budget)} € · reste ${i0(st.budget-ms.total)} €`,pctB>1?'bad':pctB>.85?'warn':'good',bar(pctB,pctB>1?'over':''))}",
    "${(()=>{const q=doitDay(S.sel);return tile('doit','Do It Sport',N(q.kcal),'kcal',q.cyc||q.min?`${q.cyc} ${plural(q.cyc,'cycle')} · ${i0(q.min)} min`:'Pas encore de séance',q.kcal>=q.goal?'good':q.kcal?'warn':'none',bar(q.kcal/Math.max(1,q.goal)))})()}"],
  // le lien copié pour Raccourcis garde la clé
  ['const u=location.origin+location.pathname,ok=await copyText(u)', 'const u=location.href.split(\'#\')[0],ok=await copyText(u)'],
  // après saisie de la clé, l'adresse la contient (utile pour l'écran d'accueil)
  ["toast('Sauvegarde connectée.');setTimeout(()=>location.reload(),700)",
    "toast('Sauvegarde connectée.');setTimeout(()=>{location.href=location.pathname+'?k='+encodeURIComponent(k)},700)"],
  ["toast('Clé retirée.');setTimeout(()=>location.reload(),500)", "toast('Clé retirée.');setTimeout(()=>{location.href=location.pathname},500)"],
  // mode local (sans serveur) : pas de champ « clé de sauvegarde »
  ...(MODE === 'local' ? [["<p>Entre la clé de ta sauvegarde (donnée par Claude Code au déploiement) pour retrouver tes journées partout. Sans clé, tout reste sur ce téléphone.</p>",
    "<p><b>Tes journées sont enregistrées dans ce téléphone.</b> Ouvre toujours l'appli depuis son icône sur l'écran d'accueil : Safari et l'icône ne partagent pas leurs données.</p>"],
  ['<div class="grid2" style="grid-template-columns:minmax(0,1fr) auto;margin-bottom:10px"><input class="inp" id="cloudKey" type="password" autocomplete="off" placeholder="Clé de sauvegarde"><button class="btn go" data-a="cloudKey">Connecter</button></div>', '']] : []),
  // quand la connexion revient, renvoie ce qui n'avait pas pu partir
  ["if(!dirty.size&&S.sync!=='error')setSync('ok');",
    "if(snap.drained&&dirty.size){for(const d of [...dirty.keys()])if(!writing[d]){clearTimeout(timers[d]);retried[d]=0;timers[d]=setTimeout(()=>flush(d),60)}}if(!dirty.size&&(S.sync!=='error'||snap.drained))setSync('ok');"],
];
for (const [from, to] of patches) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`Correctif introuvable ou ambigu (${n}) : ${from.slice(0, 60)}…`);
  src = src.replace(from, to);
}
// 4. Le réglage de la clé Claude (addon.js) va à la fin du script de l'appli, dans sa portée.
const end = src.lastIndexOf('})();\n</script>');
if (end < 0) throw new Error('Fin du script de l\'appli introuvable');
src = src.slice(0, end) + addon + src.slice(end);

// 5. Do It Sport : copie de l'appli publiée sur Netlify (sport/source.html), servie à côté du tracker
//    pour s'afficher dans son onglet « Do It » avec les mêmes droits (écran allumé, son, minuteur iPhone).
//    Mettre à jour : curl -o apps/tracker/sport/source.html https://do-it-sport.netlify.app/index.html
const SP = new URL('sport/', dir), SP_OUT = new URL('public/sport/', dir);
mkdirSync(SP_OUT, { recursive: true });
let sp = readFileSync(new URL('source.html', SP), 'utf8');
const hud = sp.match(/<script async src="\/\.netlify\/scripts\/hud[^>]*><\/script>/g) || [];
if (hud.length > 1) throw new Error('Script Netlify ambigu');
sp = sp.replace(hud[0] || '', ''); // ajouté par Netlify à ses pages, inutile ici
const spPatches = [
  // les alarmes écran verrouillé passent toujours par le serveur Netlify de Do It Sport (CORS ouvert)
  ['fetch("/api/alarm",', 'fetch("https://do-it-sport.netlify.app/api/alarm",', 1],
  ['fetch("/api/alarm-cancel",', 'fetch("https://do-it-sport.netlify.app/api/alarm-cancel",', 1],
  [',keepalive:true}', '}', 2],
  // dans l'onglet du tracker, le minuteur de l'iPhone s'ouvre depuis la fenêtre principale
  ['else location.href=url;', 'else{try{(window.top||window).location.href=url}catch(e){location.href=url}}', 1],
  // résumé par jour (calories, cycles, minutes) pour la tuile Do It Sport de l'accueil du tracker
  ['const saveLocal=()=>{try{localStorage.setItem(LKEY,JSON.stringify(S));}catch(e){}};',
    'const saveLocal=()=>{try{localStorage.setItem(LKEY,JSON.stringify(S));}catch(e){}try{const sum={};for(const k in S.days){const t=totals(S.days[k]);sum[k]={kcal:Math.round(t.kcal),cyc:t.cyc,min:Math.round(t.min)};}localStorage.setItem("doitsport-sum",JSON.stringify({goal:S.p.goal,days:sum}));}catch(e){}};', 1],
];
for (const [from, to, want] of spPatches) {
  const n = sp.split(from).length - 1;
  if (n !== want) throw new Error(`Correctif Do It Sport introuvable (${n}/${want}) : ${from.slice(0, 50)}…`);
  sp = sp.split(from).join(to);
}
writeFileSync(new URL('index.html', SP_OUT), sp);
let spSw = readFileSync(new URL('sw.source.js', SP), 'utf8');
if (!spSw.includes('ks.filter(k=>k!==C)')) throw new Error('Service worker Do It Sport : correctif introuvable');
// ne supprime que ses propres caches (le site héberge aussi le tracker, Fox Bank…)
spSw = spSw.replace('ks.filter(k=>k!==C)', 'ks.filter(k=>k.startsWith("doitsport-")&&k!==C)');
writeFileSync(new URL('sw.js', SP_OUT), spSw);
for (const f of ['manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) copyFileSync(new URL(f, SP), new URL(f, SP_OUT));

const build = createHash('sha256').update(ai + shim + src + sp).digest('hex').slice(0, 10);
const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#FFFFFF">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Routine">
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
${headTags.trim()}
<style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style>
<script>
${shim}</script>
</head>
<body>
${src.trim()}
<script>if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));</script>
</body>
</html>
`;
writeFileSync(new URL('public/index.html', dir), html);
const sw = readFileSync(new URL('public/sw.js', dir), 'utf8').replace(/rp-[\w_]+';/, `rp-${build}';`);
writeFileSync(new URL('public/sw.js', dir), sw);
console.log(`public/index.html construit en mode ${MODE} (${Math.round(html.length / 1024)} Ko, version ${build}) ; public/ai.js ${Math.round(ai.length / 1024)} Ko`);
