#!/usr/bin/env node
// Construit public/index.html (version web autonome du tracker) à partir de app.source.html,
// l'export de l'artefact Claude « Routine & Performance ».
//
//   node apps/tracker/build.mjs
//
// Pour mettre à jour l'appli : remplacer app.source.html par le nouvel export, relancer, pousser.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const dir = new URL('./', import.meta.url);
let src = readFileSync(new URL('app.source.html', dir), 'utf8');
const MODE = process.env.TRACKER_MODE === 'cloud' ? 'cloud' : 'local';
const shim = `window.RP_MODE = '${MODE}';\n` + readFileSync(new URL('shim.js', dir), 'utf8');

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

const build = createHash('sha256').update(src + shim).digest('hex').slice(0, 10);
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
console.log(`public/index.html construit en mode ${MODE} (${Math.round(html.length / 1024)} Ko, version ${build})`);
