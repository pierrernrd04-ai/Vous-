#!/usr/bin/env node
// Compliance lint for copy: flags forbidden wording (brand/brand.js -> AMBREL.forbidden).
//   node tools/lint-copy.mjs <file> [more files...]      (scene.html, *.vo.json, scripts, .md)
// Prints file:line, level and excerpt. Exit code 1 if any 'error'.
// Put "lint-ok" anywhere on a line to silence it (e.g. a line that quotes a forbidden term).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sandbox = {}; sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync(path.join(HERE, '..', 'brand', 'brand.js'), 'utf8'), sandbox);
const AMBREL = sandbox.AMBREL;
const files = process.argv.slice(2);
if (!files.length) { console.error('usage: lint-copy.mjs <file...>'); process.exit(2); }
let errors = 0, warns = 0;
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/lint-ok/.test(line)) return;
    for (const hit of AMBREL.lint(line)) {
      const tag = hit.level === 'error' ? 'ERROR' : 'warn ';
      if (hit.level === 'error') errors++; else warns++;
      console.log(`${f}:${i + 1}  ${tag}  /${hit.term}/  …${hit.excerpt.trim()}…`);
    }
  });
}
console.log(`lint-copy: ${errors} error(s), ${warns} warning(s) in ${files.length} file(s)`);
process.exit(errors ? 1 : 0);
