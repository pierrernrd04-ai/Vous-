#!/usr/bin/env node
// Numéro de version de la page des widgets : la page ouverte dans Lively le compare au sien et se recharge
// toute seule quand une nouvelle version est en ligne.   node apps/widgets/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir = new URL('./', import.meta.url);
const h = createHash('sha256');
for (const f of ['index.html', 'link.js', 'sw.js']) h.update(readFileSync(new URL(f, dir)));
const v = h.digest('hex').slice(0, 10);
writeFileSync(new URL('version.json', dir), JSON.stringify({ v }) + '\n');
console.log('widgets version', v);
