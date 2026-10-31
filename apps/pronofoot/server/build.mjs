// Prépare dist/ (l'app statique) pour Netlify : seuls les fichiers de l'app sont publiés.
import { mkdirSync, copyFileSync, rmSync } from 'fs';
const files = ['index.html', 'style.css', 'app.js', 'api.js', 'model.js', 'rating.js', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const f of files) copyFileSync(f, `dist/${f}`);
console.log(`dist/ : ${files.length} fichiers`);
