// Grille de navigation multi-niveaux pour les bots (sol, toits, passerelles)
// et recherche de chemin A*.
import { rayAABB } from './util.js';

const CELL = 1;
const CLEAR_R = 0.3;
const STEP = 0.55;
const MAX_DROP = 4.6;

export class NavGrid {
  constructor(world) {
    this.world = world;
    this.nx = Math.floor(world.W / CELL);
    this.nz = Math.floor(world.D / CELL);
    this.ox = -world.W / 2;
    this.oz = -world.D / 2;
    this._buckets();
    this._nodes();
    this._edges();
  }

  _buckets() {
    const { nx, nz } = this;
    this.bucket = Array.from({ length: nx * nz }, () => []);
    for (const b of this.world.solids) {
      const i0 = Math.max(0, Math.floor((b.min[0] - 0.4 - this.ox) / CELL));
      const i1 = Math.min(nx - 1, Math.floor((b.max[0] + 0.4 - this.ox) / CELL));
      const j0 = Math.max(0, Math.floor((b.min[2] - 0.4 - this.oz) / CELL));
      const j1 = Math.min(nz - 1, Math.floor((b.max[2] + 0.4 - this.oz) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.bucket[j * nx + i].push(b);
    }
  }

  _clear(cx, h, cz, list) {
    const y0 = h + 0.05, y1 = h + 1.7;
    for (const b of list) {
      if (cx + CLEAR_R > b.min[0] && cx - CLEAR_R < b.max[0] && cz + CLEAR_R > b.min[2] && cz - CLEAR_R < b.max[2] && y1 > b.min[1] && y0 < b.max[1]) return false;
    }
    return true;
  }

  _nodes() {
    const { nx, nz } = this;
    this.cellNodes = Array.from({ length: nx * nz }, () => []);
    const xs = [], ys = [], zs = [], cells = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const cx = this.ox + (i + 0.5) * CELL, cz = this.oz + (j + 0.5) * CELL;
      const list = this.bucket[j * nx + i];
      const heights = [0];
      for (const b of list) {
        if (cx >= b.min[0] && cx <= b.max[0] && cz >= b.min[2] && cz <= b.max[2] && b.max[1] > 0.01) heights.push(b.max[1]);
      }
      heights.sort((a, b) => a - b);
      let last = -99;
      for (const h of heights) {
        if (h - last < 0.05) continue;
        last = h;
        if (!this._clear(cx, h, cz, list)) continue;
        if (h < 0.3 && this.world.inHazard([cx, h, cz])) continue;
        const id = xs.length;
        xs.push(cx); ys.push(h); zs.push(cz); cells.push(j * nx + i);
        this.cellNodes[j * nx + i].push(id);
      }
    }
    this.count = xs.length;
    this.x = Float32Array.from(xs); this.y = Float32Array.from(ys); this.z = Float32Array.from(zs);
    this.cell = Int32Array.from(cells);
  }

  _segmentBlocked(x1, z1, x2, z2, y, lists) {
    const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz);
    const o = [x1, y, z1], d = [dx / L, 0, dz / L];
    for (const list of lists) for (const b of list) {
      if (rayAABB(o, d, b.min, b.max, L) < L) return true;
    }
    return false;
  }

  _edges() {
    const { nx, nz } = this;
    const adj = new Array(this.count);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    this.nearWall = new Uint8Array(this.count);
    for (let n = 0; n < this.count; n++) {
      const c = this.cell[n], i = c % nx, j = (c / nx) | 0, h = this.y[n];
      const out = [];
      let sameLevel = 0;
      for (const [di, dj] of dirs) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
        const diag = di !== 0 && dj !== 0;
        for (const m of this.cellNodes[nj * nx + ni]) {
          const dh = this.y[m] - h;
          if (dh > STEP || dh < -MAX_DROP) continue;
          const y = Math.max(h, this.y[m]) + 0.35;
          const lists = [this.bucket[c], this.bucket[nj * nx + ni]];
          if (this._segmentBlocked(this.x[n], this.z[n], this.x[m], this.z[m], y, lists)) continue;
          if (this._segmentBlocked(this.x[n], this.z[n], this.x[m], this.z[m], y + 0.9, lists)) continue;
          if (diag) {
            // Pas de coupe de coin : les deux voisins orthogonaux doivent exister au même niveau.
            const okA = this.cellNodes[j * nx + ni].some((k) => Math.abs(this.y[k] - h) <= STEP);
            const okB = this.cellNodes[nj * nx + i].some((k) => Math.abs(this.y[k] - h) <= STEP);
            if (!okA || !okB) continue;
          }
          if (Math.abs(dh) <= STEP && !diag) sameLevel++;
          out.push(m, diag ? 1.414 : 1);
        }
      }
      if (sameLevel < 4) this.nearWall[n] = 1;
      adj[n] = out;
    }
    this.adj = adj;
    this.g = new Float32Array(this.count);
    this.f = new Float32Array(this.count);
    this.parent = new Int32Array(this.count);
    this.mark = new Uint32Array(this.count);
    this.closed = new Uint32Array(this.count);
    this.gen = 0;
    // Noeuds « ouverts » pour les patrouilles (loin des murs)
    this.open = [];
    for (let n = 0; n < this.count; n++) if (!this.nearWall[n] && this.adj[n].length >= 8) this.open.push(n);
  }

  nearest(p) {
    const i0 = Math.floor((p[0] - this.ox) / CELL), j0 = Math.floor((p[2] - this.oz) / CELL);
    let best = -1, bestD = Infinity;
    for (let r = 0; r <= 3 && best < 0; r++) {
      for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
        if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) continue;
        if (r > 0 && Math.abs(i - i0) !== r && Math.abs(j - j0) !== r) continue;
        for (const n of this.cellNodes[j * this.nx + i]) {
          const dy = this.y[n] - p[1];
          if (dy > 0.8) continue;
          const d = Math.hypot(this.x[n] - p[0], this.z[n] - p[2]) + Math.abs(dy) * 2;
          if (d < bestD) { bestD = d; best = n; }
        }
      }
    }
    return best;
  }

  randomOpen() { return this.open[Math.floor(Math.random() * this.open.length)]; }

  pos(n) { return [this.x[n], this.y[n], this.z[n]]; }

  /** Chemin A* entre deux positions ; renvoie une liste de points [x,y,z]. */
  findPath(from, to, maxIter = 5000) {
    const s = this.nearest(from), t = this.nearest(to);
    if (s < 0 || t < 0) return null;
    if (s === t) return [this.pos(t)];
    const gen = ++this.gen;
    const { g, f, parent, mark, closed, x, y, z } = this;
    const heap = new Heap();
    const hfn = (n) => Math.hypot(x[n] - x[t], z[n] - z[t]) + Math.abs(y[n] - y[t]);
    g[s] = 0; f[s] = hfn(s); parent[s] = -1; mark[s] = gen;
    heap.push(s, f[s]);
    let iter = 0;
    while (heap.size && iter++ < maxIter) {
      const n = heap.pop();
      if (n === t) break;
      if (closed[n] === gen) continue;
      closed[n] = gen;
      const a = this.adj[n];
      for (let k = 0; k < a.length; k += 2) {
        const m = a[k];
        if (closed[m] === gen) continue;
        const cost = g[n] + a[k + 1] + (this.nearWall[m] ? 0.7 : 0) + Math.max(0, y[m] - y[n]) * 0.5;
        if (mark[m] !== gen || cost < g[m]) {
          mark[m] = gen; g[m] = cost; f[m] = cost + hfn(m); parent[m] = n;
          heap.push(m, f[m]);
        }
      }
    }
    if (mark[t] !== gen) return null;
    const path = [];
    for (let n = t; n !== -1; n = parent[n]) path.push(this.pos(n));
    path.reverse();
    return this._smooth(path);
  }

  /** Supprime les points intermédiaires alignés sur un même niveau. */
  _smooth(path) {
    if (path.length < 3) return path;
    const out = [path[0]];
    let anchor = 0;
    let flat = true;
    for (let k = 2; k < path.length; k++) {
      const a = path[anchor], b = path[k];
      if (Math.abs(path[k - 1][1] - a[1]) >= 0.05 || Math.abs(b[1] - a[1]) >= 0.05) flat = false;
      const clear = flat && k - anchor < 10 &&
        this.world.lineOfSight([a[0], a[1] + 0.4, a[2]], [b[0], b[1] + 0.4, b[2]]) &&
        this._wideClear(a, b);
      if (!clear) {
        out.push(path[k - 1]);
        anchor = k - 1;
        flat = Math.abs(path[k][1] - path[anchor][1]) < 0.05;
      }
    }
    out.push(path[path.length - 1]);
    return out;
  }

  _wideClear(a, b) {
    // Vérifie deux rayons parallèles décalés du rayon du corps.
    const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1;
    const px = -dz / L * 0.32, pz = dx / L * 0.32;
    return this.world.lineOfSight([a[0] + px, a[1] + 0.4, a[2] + pz], [b[0] + px, b[1] + 0.4, b[2] + pz]) &&
      this.world.lineOfSight([a[0] - px, a[1] + 0.4, a[2] - pz], [b[0] - px, b[1] + 0.4, b[2] - pz]);
  }
}

/** Tas binaire min (entrées dupliquées autorisées, priorité figée à l'insertion). */
class Heap {
  constructor() { this.n = []; this.p = []; }
  get size() { return this.n.length; }
  push(node, pri) {
    const n = this.n, p = this.p;
    n.push(node); p.push(pri);
    let i = n.length - 1;
    while (i > 0) {
      const q = (i - 1) >> 1;
      if (p[q] <= p[i]) break;
      [n[q], n[i]] = [n[i], n[q]]; [p[q], p[i]] = [p[i], p[q]]; i = q;
    }
  }
  pop() {
    const n = this.n, p = this.p;
    const top = n[0];
    const ln = n.pop(), lp = p.pop();
    if (n.length) {
      n[0] = ln; p[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < n.length && p[l] < p[m]) m = l;
        if (r < n.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [n[m], n[i]] = [n[i], n[m]]; [p[m], p[i]] = [p[i], p[m]]; i = m;
      }
    }
    return top;
  }
}
