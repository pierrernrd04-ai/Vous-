// Moteur de pronostic : modèle de Poisson bivarié (correction Dixon-Coles)
// alimenté par la forme récente, le classement et les confrontations directes,
// puis combiné avec les probabilités implicites du marché quand des cotes existent.
// Module pur : aucune dépendance au DOM, testable sous Node.

const HOME_BASE = 1.45; // buts attendus moyens à domicile (moyenne des grands championnats)
const AWAY_BASE = 1.15; // buts attendus moyens à l'extérieur
const TEAM_MEAN = (HOME_BASE + AWAY_BASE) / 2;
const RHO = -0.08; // corrélation Dixon-Coles des scores faibles
const MAX_GOALS = 10;
const MARKET_WEIGHT = 0.6; // le marché agrège énormément d'information : il pèse plus lourd

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** Cote américaine (+150 / -120) vers cote décimale. */
export function americanToDecimal(ml) {
  const n = typeof ml === 'string' ? parseFloat(ml.replace(/[^\d.+-]/g, '')) : ml;
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

/** Probabilités implicites sans marge du bookmaker. */
export function devig(decimals) {
  if (decimals.some((d) => !d || d <= 1)) return null;
  const inv = decimals.map((d) => 1 / d);
  const s = inv.reduce((a, b) => a + b, 0);
  return inv.map((x) => x / s);
}

function factorial(n) {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}
export const poisson = (k, l) => (Math.exp(-l) * l ** k) / factorial(k);

function tau(h, a, lh, la) {
  if (h === 0 && a === 0) return 1 - lh * la * RHO;
  if (h === 0 && a === 1) return 1 + lh * RHO;
  if (h === 1 && a === 0) return 1 + la * RHO;
  if (h === 1 && a === 1) return 1 - RHO;
  return 1;
}

/** Matrice des scores et marchés dérivés. */
export function scoreMatrix(lh, la) {
  const m = [];
  let total = 0;
  for (let h = 0; h <= MAX_GOALS; h++) {
    m[h] = [];
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = poisson(h, lh) * poisson(a, la) * tau(h, a, lh, la);
      m[h][a] = Math.max(p, 0);
      total += m[h][a];
    }
  }
  let home = 0, draw = 0, away = 0, over25 = 0, btts = 0;
  const scores = [];
  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = m[h][a] / total;
      if (h > a) home += p; else if (h === a) draw += p; else away += p;
      if (h + a > 2.5) over25 += p;
      if (h > 0 && a > 0) btts += p;
      scores.push({ h, a, p });
    }
  }
  scores.sort((x, y) => y.p - x.p);
  return { home, draw, away, over25, btts, scores: scores.slice(0, 5) };
}

/** Total de buts attendu correspondant à la ligne over/under du marché. */
export function totalFromMarket(line, pOver) {
  if (!Number.isFinite(line) || !Number.isFinite(pOver)) return null;
  let lo = 0.3, hi = 7;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    let under = 0;
    for (let k = 0; k <= Math.floor(line); k++) under += poisson(k, mid);
    if (1 - under < pOver) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Forme « WDLWW » (ou « VNDVV ») vers points par match. */
export function formToPpg(form) {
  if (!form) return null;
  const pts = { W: 3, V: 3, D: 1, N: 1, L: 0 };
  const chars = [...form.toUpperCase()].filter((c) => c in pts);
  if (!chars.length) return null;
  // ESPN : W = victoire, D = nul, L = défaite
  const val = chars.map((c) => (c === 'D' ? 1 : pts[c]));
  return val.reduce((a, b) => a + b, 0) / val.length;
}

/** Bilan « V-N-D » vers points par match. */
export function recordToPpg(summary) {
  const m = /^(\d+)-(\d+)-(\d+)$/.exec(summary || '');
  if (!m) return null;
  const [w, d, l] = m.slice(1).map(Number);
  const n = w + d + l;
  return n ? (3 * w + d) / n : null;
}

/**
 * Agrège les derniers matchs d'une équipe.
 * games : [{ gf, ga, home: bool, result: 'W'|'D'|'L' }] du plus récent au plus ancien.
 */
export function teamFormStats(games) {
  if (!games || !games.length) return null;
  let wsum = 0, gf = 0, ga = 0, pts = 0;
  games.forEach((g, i) => {
    const w = Math.pow(0.85, i); // les matchs récents comptent plus
    wsum += w;
    gf += w * g.gf;
    ga += w * g.ga;
    pts += w * (g.gf > g.ga ? 3 : g.gf === g.ga ? 1 : 0);
  });
  return { n: games.length, gf: gf / wsum, ga: ga / wsum, ppg: pts / wsum };
}

/**
 * Calcule le pronostic.
 * input = {
 *   home: { form?, record?, games?, standing?: { gp, gd, pts, rank } },
 *   away: { ... },
 *   h2h?: [{ homeGoals, awayGoals }] du point de vue de l'équipe à domicile du match,
 *   market?: { home, draw, away } cotes décimales,
 *   total?: { line, over, under } cotes décimales,
 *   neutral?: bool
 * }
 */
export function predict(input) {
  const { home = {}, away = {}, h2h = [], market, total, neutral } = input;
  const signals = [];
  let lh = neutral ? TEAM_MEAN : HOME_BASE;
  let la = neutral ? TEAM_MEAN : AWAY_BASE;
  let dataPoints = 0;

  // 1. Attaque / défense sur les derniers matchs (avec rétrécissement vers la moyenne)
  const fh = teamFormStats(home.games);
  const fa = teamFormStats(away.games);
  const shrink = (x, n) => (x * n + TEAM_MEAN * 3) / (n + 3) / TEAM_MEAN;
  if (fh && fa) {
    lh *= shrink(fh.gf, fh.n) * shrink(fa.ga, fa.n);
    la *= shrink(fa.gf, fa.n) * shrink(fh.ga, fh.n);
    dataPoints += 2;
    signals.push(`Forme pondérée : ${fh.gf.toFixed(1)} buts marqués / ${fh.ga.toFixed(1)} encaissés contre ${fa.gf.toFixed(1)} / ${fa.ga.toFixed(1)}`);
  }

  // 2. Niveau de saison : différence de buts par match et points par match
  const sh = home.standing, sa = away.standing;
  if (sh?.gp > 0 && sa?.gp > 0) {
    const gdDiff = sh.gd / sh.gp - sa.gd / sa.gp;
    const ppgDiff = sh.pts / sh.gp - sa.pts / sa.gp;
    const k = Math.exp(clamp(0.12 * gdDiff + 0.1 * ppgDiff, -0.6, 0.6));
    lh *= k;
    la /= k;
    dataPoints += 2;
    signals.push(`Classement : ${sh.rank ? sh.rank + 'e' : '?'} (${sh.pts} pts) contre ${sa.rank ? sa.rank + 'e' : '?'} (${sa.pts} pts)`);
  } else {
    const ph = formToPpg(home.form) ?? recordToPpg(home.record);
    const pa = formToPpg(away.form) ?? recordToPpg(away.record);
    if (ph != null && pa != null) {
      const k = Math.exp(clamp(0.12 * (ph - pa), -0.35, 0.35));
      lh *= k;
      la /= k;
      dataPoints += 1;
    }
  }

  // 3. Confrontations directes (effet faible, très bruité)
  if (h2h.length) {
    const diff = h2h.reduce((s, g) => s + Math.sign(g.homeGoals - g.awayGoals), 0) / h2h.length;
    const k = Math.exp(clamp(0.08 * diff, -0.08, 0.08));
    lh *= k;
    la /= k;
    dataPoints += 1;
    const w = h2h.filter((g) => g.homeGoals > g.awayGoals).length;
    const d = h2h.filter((g) => g.homeGoals === g.awayGoals).length;
    signals.push(`Face-à-face : ${w}V ${d}N ${h2h.length - w - d}D sur les ${h2h.length} derniers`);
  }

  // 4. Calage du volume de buts sur la ligne over/under du marché
  if (total?.line && total.over && total.under) {
    const p = devig([total.over, total.under]);
    const t = p && totalFromMarket(total.line, p[0]);
    if (t) {
      const r = t / (lh + la);
      lh *= r;
      la *= r;
      dataPoints += 1;
    }
  }

  lh = clamp(lh, 0.15, 5);
  la = clamp(la, 0.15, 5);
  const model = scoreMatrix(lh, la);

  // 5. Mélange avec le marché
  const marketP = market ? devig([market.home, market.draw, market.away]) : null;
  let p = [model.home, model.draw, model.away];
  if (marketP) {
    p = p.map((x, i) => MARKET_WEIGHT * marketP[i] + (1 - MARKET_WEIGHT) * x);
    dataPoints += 3;
  }

  const [pH, pD, pA] = p;
  const best = pick(pH, pD, pA);
  const coverage = clamp(dataPoints / 10, 0, 1);
  const confidence = Math.round(100 * clamp(best.p * (0.55 + 0.45 * coverage), 0, 0.99));

  const value = [];
  // Value : seulement si le modèle dispose de vraies données (forme détaillée + classement)
  if (marketP && fh && fa && sh?.gp > 0 && sa?.gp > 0) {
    const names = ['1', 'N', '2'];
    const modelP = [model.home, model.draw, model.away];
    modelP.forEach((mp, i) => {
      const edge = mp - marketP[i];
      const dec = [market.home, market.draw, market.away][i];
      if (edge > 0.07 && mp * dec > 1.08) value.push({ outcome: names[i], edge, odds: dec });
    });
  }

  return {
    pH, pD, pA,
    model: { pH: model.home, pD: model.draw, pA: model.away },
    market: marketP ? { pH: marketP[0], pD: marketP[1], pA: marketP[2] } : null,
    xgH: lh, xgA: la,
    over25: model.over25, btts: model.btts,
    scores: model.scores,
    pick: best,
    confidence,
    coverage,
    value,
    signals,
  };
}

/** Choix du pronostic : simple si net, double chance sinon. */
export function pick(pH, pD, pA) {
  const simple = [
    { code: '1', label: 'Victoire domicile', p: pH },
    { code: 'N', label: 'Match nul', p: pD },
    { code: '2', label: 'Victoire extérieur', p: pA },
  ].sort((a, b) => b.p - a.p);
  if (simple[0].p >= 0.5 || (simple[0].code === 'N' && simple[0].p >= 0.34)) return { ...simple[0], kind: 'simple' };
  const doubles = [
    { code: '1N', label: 'Domicile ou nul', p: pH + pD },
    { code: 'N2', label: 'Extérieur ou nul', p: pA + pD },
    { code: '12', label: 'Pas de nul', p: pH + pA },
  ].sort((a, b) => b.p - a.p);
  return { ...simple[0], kind: 'simple', alt: doubles[0] };
}

/** Le pronostic était-il juste ? */
export function outcomeOf(hs, as) {
  return hs > as ? '1' : hs === as ? 'N' : '2';
}
export function pickHit(code, hs, as) {
  return code.includes(outcomeOf(hs, as));
}
