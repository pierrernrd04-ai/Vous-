// Shared helpers: headless Chromium (playwright-core from the repo) + tiny static server.
// No npm install needed: playwright-core is loaded from /home/user/Vous-/node_modules.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TOOLS_DIR = path.resolve(HERE, '..');
export const ROOT = path.resolve(TOOLS_DIR, '..'); // videos/complements
const PW_CORE = process.env.PW_CORE || '/home/user/Vous-/node_modules/playwright-core';
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

export const CHROMIUM_ARGS = [
  '--allow-file-access-from-files',
  '--enable-unsafe-swiftshader', // WebGL (SwiftShader) in headless. NB: '--use-angle=swiftshader'
                                 // makes 2D raster ~2.3x slower, do not add it.
  '--force-color-profile=srgb',
  '--font-render-hinting=none',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--hide-scrollbars',
  '--mute-audio',
];

export async function launch() {
  const { chromium } = await import(pathToFileURL(path.join(PW_CORE, 'index.mjs')).href);
  return chromium.launch({ headless: true, args: CHROMIUM_ARGS });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

/** Static file server rooted at `root` on 127.0.0.1:<random port>. */
export function startServer(root) {
  root = path.resolve(root);
  const srv = http.createServer((req, res) => {
    try {
      const u = new URL(req.url, 'http://x');
      const fp = path.resolve(root, '.' + decodeURIComponent(u.pathname));
      if (!fp.startsWith(root)) { res.writeHead(403); return res.end(); }
      let st;
      try { st = fs.statSync(fp); } catch { res.writeHead(404); return res.end('not found'); }
      const file = st.isDirectory() ? path.join(fp, 'index.html') : fp;
      const data = fs.readFileSync(file);
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(data);
    } catch (e) {
      res.writeHead(500); res.end(String(e));
    }
  });
  return new Promise((resolve) => {
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port, root }));
  });
}

/**
 * Build the URL used to open a scene.
 * mode 'http' (default): serve ROOT (videos/complements) so relative paths such as
 * ../brand/fonts/x.woff2 work and there are no file:// CORS limits (WebGL textures,
 * fetch, ES modules). Scenes outside ROOT are served from their own folder.
 */
export async function sceneUrl(scenePath, { mode = 'http', query = '' } = {}) {
  const abs = path.resolve(scenePath);
  if (!fs.existsSync(abs)) throw new Error(`scene not found: ${abs}`);
  const q = query ? (query.startsWith('?') ? query : '?' + query) : '';
  if (mode === 'file') return { url: pathToFileURL(abs).href + q, close: async () => {} };
  const root = abs.startsWith(ROOT + path.sep) ? ROOT : path.dirname(abs);
  const { srv, port } = await startServer(root);
  const rel = path.relative(root, abs).split(path.sep).map(encodeURIComponent).join('/');
  return { url: `http://127.0.0.1:${port}/${rel}${q}`, close: () => new Promise((r) => srv.close(() => r())) };
}

/** Minimal argv parser: positional args + --key value / --flag. */
export function parseArgs(argv) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const eq = k.indexOf('=');
      if (eq >= 0) { opt[k.slice(0, eq)] = k.slice(eq + 1); continue; }
      const nxt = argv[i + 1];
      if (nxt === undefined || nxt.startsWith('--')) opt[k] = true;
      else { opt[k] = nxt; i++; }
    } else pos.push(a);
  }
  return { pos, opt };
}

/** Open a scene page, wait for fonts/images/__ready. Returns { page, info }. */
export async function openScene(browser, url, { w, h, scale = 1, onConsole = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await ctx.addInitScript(() => { window.__RENDER = true; });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => { errors.push(e); console.error('[scene error]', e.message); });
  if (onConsole) page.on('console', (m) => {
    if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall due to ReadPixels/.test(m.text())) console.error(`[scene ${m.type()}]`, m.text());
  });
  page.on('requestfailed', (r) => console.error('[scene request failed]', r.url(), r.failure()?.errorText));
  await page.goto(url, { waitUntil: 'load' });
  const info = await page.evaluate(async () => {
    if (window.__ready && typeof window.__ready.then === 'function') await window.__ready;
    else if (typeof window.__ready === 'function') await window.__ready();
    await document.fonts.ready;
    await Promise.all([...document.images].map((im) => (im.decode ? im.decode().catch(() => {}) : null)));
    return {
      hasSeek: typeof window.__seek === 'function',
      duration: typeof window.__duration === 'number' ? window.__duration : null,
      fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight} ${f.style}`),
    };
  });
  if (errors.length) throw new Error(`scene threw ${errors.length} error(s) during load: ${errors[0].message}`);
  return { page, ctx, info, errors };
}
