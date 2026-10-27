#!/usr/bin/env node
// Construit public/index.html (Fox Bank installable sur l'écran d'accueil) à partir de app.html,
// le même fichier que celui publié comme artefact Claude.
//
//   node apps/foxbank/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const dir = new URL('./', import.meta.url);
let src = readFileSync(new URL('app.html', dir), 'utf8');

// <title>, <meta> et <link> du début du fichier vont dans <head>
const lead = src.match(/^\s*(?:<title>[^<]*<\/title>\s*|<(?:meta|link)\b[^>]*>\s*)+/);
let headTags = '';
if (lead) { headTags = lead[0].replace(/<meta name="claude:[^>]*>\s*/, ''); src = src.slice(lead[0].length); }

const build = createHash('sha256').update(src).digest('hex').slice(0, 10);
const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#F3F4F7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B0F17" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Fox Bank">
<meta name="referrer" content="no-referrer">
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
${headTags.trim()}
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${src.trim()}
<script>if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));</script>
</body>
</html>
`;
writeFileSync(new URL('public/index.html', dir), html);
const sw = readFileSync(new URL('public/sw.js', dir), 'utf8').replace(/'fox-[\w]+'/, `'fox-${build}'`);
writeFileSync(new URL('public/sw.js', dir), sw);
console.log(`public/index.html construit (${Math.round(html.length / 1024)} Ko, version ${build})`);
