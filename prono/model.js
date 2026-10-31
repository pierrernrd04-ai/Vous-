// Moteur de pronostic v2.
// 1. Buts attendus : notation des équipes du championnat (rating.js : buts + tirs cadrés,
//    décroissance temporelle) ; à défaut, heuristique forme récente + classement.
// 2. Loi de Poisson avec correction Dixon-Coles : grille complète des scores.
// 3. Mise en commun logarithmique avec les probabilités du marché (poids 0,85),
//    le meilleur réglage mesuré sur 1 971 matchs des 5 grands championnats.
// 4. Fiabilité : taux de réussite réellement observé à chaque niveau de probabilité.
// Module pur, sans DOM : utilisé par l'app, le backtest et le service d'alertes.

const HOME_BASE = 1.45;
const AWAY_BASE = 1.15;
const TEAM_MEAN = (HOME_BASE + AWAY_BASE) / 2;
const RHO = -0.08;
const MAX_GOALS = 10;
export const MARKET_WEIGHT = 0.85;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function americanToDecimal(ml) {
  const n = typeof ml === 'string' ? parseFloat(ml.replace(/[^\d.+-]/g, '')) : ml;
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

export function devig(decimals) {
  if (decimals.some((d) => !d || d <= 1)) return null;
  const inv = decimals.map((d) => 1 / d);
  const s = inv.reduce((a, b) => a + b, 0);
  return inv.map((x) => x / s);
}

const FACT = [1];
for (let i = 1; i <= 20; i++) FACT[i] = FACT[i - 1] * i;
export const poisson = (k, l) => (Math.exp(-l) * l ** k) / FACT[k];

function tau(h, a, lh, la) {
  if (h === 0 && a === 0) return 1 - lh * la * RHO;
  if (h === 0 && a === 1) return 1 + lh * RHO;
  if (h === 1 && a === 0) return 1 + la * RHO;
  if (h === 1 && a === 1) return 1 - RHO;
  return 1;
}

/** Grille des scores (en partant de base = score actuel) et marchés dérivés. */
export function scoreMatrix(lh, la, base = [0, 0], dc = true) {
  const cells = [];
  let total = 0;
  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = Math.max(poisson(h, lh) * poisson(a, la) * (dc ? tau(h, a, lh, la) : 1), 0);
      cells.push({ h: h + base[0], a: a + base[1], p });
      total += p;
    }
  }
  let home = 0, draw = 0, away = 0, over25 = 0, btts = 0;
  for (const c of cells) {
    c.p /= total;
    if (c.h > c.a) home += c.p; else if (c.h === c.a) draw += c.p; else away += c.p;
    if (c.h + c.a > 2.5) over25 += c.p;
    if (c.h > 0 && c.a > 0) btts += c.p;
  }
  cells.sort((x, y) => y.p - x.p);
  return { home, draw, away, over25, btts, scores: cells.slice(0, 6) };
}

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

export function formToPpg(form) {
  if (!form) return null;
  const pts = { W: 3, D: 1, L: 0 };
  const val = [...form.toUpperCase()].filter((c) => c in pts).map((c) => pts[c]);
  return val.length ? val.reduce((a, b) => a + b, 0) / val.length : null;
}

export function recordToPpg(summary) {
  const m = /^(\d+)-(\d+)-(\d+)$/.exec(summary || '');
  if (!m) return null;
  const [w, d, l] = m.slice(1).map(Number);
  const n = w + d + l;
  return n ? (3 * w + d) / n : null;
}

export function teamFormStats(games) {
  if (!games || !games.length) return null;
  let wsum = 0, gf = 0, ga = 0, pts = 0;
  games.forEach((g, i) => {
    const w = Math.pow(0.85, i);
    wsum += w; gf += w * g.gf; ga += w * g.ga;
    pts += w * (g.gf > g.ga ? 3 : g.gf === g.ga ? 1 : 0);
  });
  return { n: games.length, gf: gf / wsum, ga: ga / wsum, ppg: pts / wsum };
}

/**
 * Fiabilité mesurée : part des pronos justes dans le backtest pour cette probabilité
 * (1 971 matchs, 5 grands championnats, saisons 2025-26 et 2026-27, avec cotes).
 */
export const CALIBRATION = [
  { min: 0.75, tier: 'Très sûr', key: 't5', hit: 0.875, dc: 0.977, n: 88 },
  { min: 0.65, tier: 'Sûr', key: 't4', hit: 0.756, dc: 0.917, n: 193 },
  { min: 0.55, tier: 'Solide', key: 't3', hit: 0.611, dc: 0.845, n: 380 },
  { min: 0.45, tier: 'Serré', key: 't2', hit: 0.505, dc: 0.785, n: 576 },
  { min: 0, tier: 'Incertain', key: 't1', hit: 0.418, dc: 0.717, n: 734 },
];
export const reliability = (p) => CALIBRATION.find((c) => p >= c.min);

/**
 * input = {
 *   home/away: { form?, record?, games?, standing? },
 *   rating?: { lh, la, gh, ga } buts attendus issus de la notation du championnat,
 *   power?: { home: {att, def}, away: {att, def} },
 *   h2h?, market?: {home, draw, away} décimales, total?: {line, over, under}, neutral?
 * }
 */
export function predict(input) {
  const { home = {}, away = {}, h2h = [], market, total, neutral, rating } = input;
  const signals = [];
  let lh = neutral ? TEAM_MEAN : HOME_BASE;
  let la = neutral ? TEAM_MEAN : AWAY_BASE;
  let source = 'heuristique';
  const fh = teamFormStats(home.games);
  const fa = teamFormStats(away.games);
  const sh = home.standing, sa = away.standing;

  if (rating && rating.gh >= 4 && rating.ga >= 4) {
    lh = rating.lh; la = rating.la; source = 'notation';
    signals.push(`Notation du championnat (buts et tirs cadrés, saison en cours + précédente) : ${lh.toFixed(2)} buts attendus contre ${la.toFixed(2)}`);
  } else {
    const shrink = (x, n) => (x * n + TEAM_MEAN * 3) / (n + 3) / TEAM_MEAN;
    if (fh && fa) {
      lh *= shrink(fh.gf, fh.n) * shrink(fa.ga, fa.n);
      la *= shrink(fa.gf, fa.n) * shrink(fh.ga, fh.n);
      source = 'forme';
    }
    if (sh?.gp > 0 && sa?.gp > 0) {
      const k = Math.exp(clamp(0.12 * (sh.gd / sh.gp - sa.gd / sa.gp) + 0.1 * (sh.pts / sh.gp - sa.pts / sa.gp), -0.6, 0.6));
      lh *= k; la /= k;
    } else {
      const ph = formToPpg(home.form) ?? recordToPpg(home.record);
      const pa = formToPpg(away.form) ?? recordToPpg(away.record);
      if (ph != null && pa != null) { const k = Math.exp(clamp(0.12 * (ph - pa), -0.35, 0.35)); lh *= k; la /= k; }
    }
  }
  if (fh && fa) signals.push(`Forme (5 derniers, pondérée) : ${fh.gf.toFixed(1)} marqués / ${fh.ga.toFixed(1)} encaissés contre ${fa.gf.toFixed(1)} / ${fa.ga.toFixed(1)} · ${fh.ppg.toFixed(1)} pts/match contre ${fa.ppg.toFixed(1)}`);
  if (sh?.gp > 0 && sa?.gp > 0) signals.push(`Classement : ${sh.rank}e (${sh.pts} pts, ${sh.gd > 0 ? '+' : ''}${sh.gd}) contre ${sa.rank}e (${sa.pts} pts, ${sa.gd > 0 ? '+' : ''}${sa.gd})`);
  if (h2h.length) {
    const w = h2h.filter((g) => g.homeGoals > g.awayGoals).length;
    const d = h2h.filter((g) => g.homeGoals === g.awayGoals).length;
    signals.push(`Face-à-face : ${w}V ${d}N ${h2h.length - w - d}D sur les ${h2h.length} derniers (effet faible, peu prédictif)`);
  }

  // Volume de buts calé sur la ligne plus/moins du marché
  let totalSource = null;
  if (total?.line && total.over && total.under) {
    const p = devig([total.over, total.under]);
    const t = p && totalFromMarket(total.line, p[0]);
    if (t) { const r = t / (lh + la); lh *= r; la *= r; totalSource = t; }
  }
  lh = clamp(lh, 0.15, 5);
  la = clamp(la, 0.15, 5);
  const model = scoreMatrix(lh, la);

  const marketP = market ? devig([market.home, market.draw, market.away]) : null;
  let p = [model.home, model.draw, model.away];
  if (marketP) {
    const q = p.map((x, i) => Math.exp(MARKET_WEIGHT * Math.log(marketP[i]) + (1 - MARKET_WEIGHT) * Math.log(Math.max(x, 1e-6))));
    const s = q.reduce((a, b) => a + b, 0);
    p = q.map((x) => x / s);
    signals.push(`Cotes du marché intégrées (elles pèsent 85 % : sur 2 saisons testées, elles sont le meilleur prédicteur)`);
  }
  if (totalSource) signals.push(`Volume de buts calé sur le marché : ${totalSource.toFixed(2)} buts attendus au total`);

  const [pH, pD, pA] = p;
  const best = pick(pH, pD, pA);
  const rel = reliability(best.p);
  // sans cotes, le modèle seul est moins fiable : on dégrade d'un cran l'affichage
  const quality = marketP ? (source === 'notation' ? 'complète' : 'bonne') : source === 'notation' ? 'moyenne' : 'faible';

  // Pas de « value bets » : testés sur 2 saisons, ils perdaient environ 20 % des mises.
  const value = [];

  return {
    pH, pD, pA,
    model: { pH: model.home, pD: model.draw, pA: model.away },
    market: marketP ? { pH: marketP[0], pD: marketP[1], pA: marketP[2] } : null,
    xgH: lh, xgA: la,
    over25: model.over25, btts: model.btts, scores: model.scores,
    pick: best, reliability: rel, quality, source, value, signals,
  };
}

/** Probabilités en cours de match à partir du score et de la minute. */
export function livePredict(xgH, xgA, minute, hs, as, redsH = 0, redsA = 0) {
  const played = clamp(minute, 0, 95);
  const left = Math.max(90 + (played > 45 ? 4 : 2) - played, 1) / 90;
  // un carton rouge coûte environ 30 % d'attaque et donne 15 % à l'adversaire
  const kh = Math.pow(0.7, redsH) * Math.pow(1.15, redsA);
  const ka = Math.pow(0.7, redsA) * Math.pow(1.15, redsH);
  const m = scoreMatrix(Math.max(xgH * left * kh, 0.01), Math.max(xgA * left * ka, 0.01), [hs, as], false);
  return { pH: m.home, pD: m.draw, pA: m.away, scores: m.scores.slice(0, 3), remH: Math.max(xgH * left * kh, 0.01), remA: Math.max(xgA * left * ka, 0.01) };
}

/**
 * Qui va marquer : probabilités par équipe (au moins un but, premier but, aucun but).
 * lh / la : buts attendus (avant-match, ou sur le temps restant en direct).
 */
export function goalOdds(lh, la) {
  const none = Math.exp(-lh - la);
  return {
    home: 1 - Math.exp(-lh),
    away: 1 - Math.exp(-la),
    both: (1 - Math.exp(-lh)) * (1 - Math.exp(-la)),
    none,
    firstHome: (lh / (lh + la)) * (1 - none),
    firstAway: (la / (lh + la)) * (1 - none),
  };
}

/**
 * Buteur à tout moment : probabilité que chaque joueur marque au moins un but.
 * players : [{ name, goals, matches, shots }] (meilleurs buteurs et tireurs de la saison)
 * teamXg : buts attendus de l'équipe pour ce match ; teamGoals / teamGP : buts et matchs de la saison
 * starters : noms du onze de départ quand il est publié (sinon null)
 */
export function scorerProbs(players, teamXg, teamGoals, teamGP, starters = null) {
  if (!players?.length || !(teamXg > 0)) return [];
  const gp = teamGP || Math.max(...players.map((p) => p.matches || 0), 1);
  const goalsTot = teamGoals || Math.max(players.reduce((a, p) => a + (p.goals || 0), 0) * 1.6, gp * 1.3);
  return players.map((p) => {
    const m = Math.min(p.matches || gp, gp);
    // part des buts de l'équipe quand il joue
    const perApp = (gp / Math.max(m, 1));
    const sGoals = ((p.goals || 0) / goalsTot) * perApp;
    const sShots = p.shots != null ? ((p.shots * 0.11) / goalsTot) * perApp : null; // ~11 % des tirs finissent au fond
    let share = sShots == null ? sGoals : p.goals > 0 ? 0.7 * sGoals + 0.3 * sShots : 0.75 * sShots;
    share = (share * m + 0.06) / (m + 1); // prudence sur les petits échantillons
    share = clamp(share, 0.02, 0.55);
    // temps de jeu attendu : titulaire ≈ 90 %, remplaçant ≈ 25 %, inconnu selon ses matchs joués
    const onPitch = starters ? (starters.has(p.name) ? 0.92 : 0.25) : 0.85 * clamp(m / gp, 0.8, 1);
    const prob = 1 - Math.exp(-teamXg * share * onPitch);
    return { name: p.name, prob, goals: p.goals || 0, matches: p.matches, shots: p.shots, starter: starters ? starters.has(p.name) : null };
  }).sort((a, b) => b.prob - a.prob);
}

export function pick(pH, pD, pA) {
  const simple = [
    { code: '1', label: 'Victoire domicile', p: pH },
    { code: 'N', label: 'Match nul', p: pD },
    { code: '2', label: 'Victoire extérieur', p: pA },
  ].sort((a, b) => b.p - a.p);
  const doubles = [
    { code: '1N', label: 'Domicile ou nul', p: pH + pD },
    { code: 'N2', label: 'Extérieur ou nul', p: pA + pD },
    { code: '12', label: 'Pas de nul', p: pH + pA },
  ].sort((a, b) => b.p - a.p);
  return { ...simple[0], kind: 'simple', alt: simple[0].p < 0.55 ? doubles[0] : null };
}

export const outcomeOf = (hs, as) => (hs > as ? '1' : hs === as ? 'N' : '2');
export const pickHit = (code, hs, as) => code.includes(outcomeOf(hs, as));
