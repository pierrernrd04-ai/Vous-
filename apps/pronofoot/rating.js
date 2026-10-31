// Notation des équipes d'un championnat : modèle de Poisson (Maher / Dixon-Coles)
// ajusté sur tous les matchs joués, avec décroissance temporelle et mélange
// buts réels / tirs cadrés (plus stables que les buts, donc plus prédictifs).
// Paramètres réglés par backtest sur 5 grands championnats (voir README).

export const DEFAULTS = {
  xi: 0.003,        // décroissance par jour (demi-vie ≈ 230 jours)
  sotWeight: 0.6,   // part des tirs cadrés dans la mesure d'attaque/défense
  prior: 2,         // matchs fictifs « moyens » ajoutés à chaque équipe (régularisation)
  iterations: 40,
  windowDays: 420,
};

/**
 * matches : [{ t: ms, h: idDom, a: idExt, hg, ag, hst?, ast? }] (matchs terminés)
 * Renvoie { att, def, muH, muA, n, teams } ou null si trop peu de données.
 */
export function fitRatings(matches, now = Date.now(), opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const rows = [];
  let sg = 0, ss = 0;
  for (const m of matches) {
    const age = (now - m.t) / 864e5;
    if (age < 0 || age > o.windowDays) continue;
    rows.push({ ...m, w: Math.exp(-o.xi * age) });
    if (m.hst != null && m.ast != null) { sg += m.hg + m.ag; ss += m.hst + m.ast; }
  }
  if (rows.length < 20) return null;
  const conv = ss > 0 ? sg / ss : 0.32; // buts par tir cadré dans ce championnat
  let wsum = 0, hsum = 0, asum = 0;
  for (const r of rows) {
    const mix = (g, st) => (st == null ? g : (1 - o.sotWeight) * g + o.sotWeight * conv * st);
    r.xh = mix(r.hg, r.hst);
    r.xa = mix(r.ag, r.ast);
    wsum += r.w; hsum += r.w * r.xh; asum += r.w * r.xa;
  }
  const muH = hsum / wsum, muA = asum / wsum;
  const teams = new Set();
  rows.forEach((r) => { teams.add(r.h); teams.add(r.a); });
  const att = {}, def = {}, games = {};
  teams.forEach((t) => { att[t] = 1; def[t] = 1; games[t] = 0; });
  rows.forEach((r) => { games[r.h] += r.w; games[r.a] += r.w; });
  const P = o.prior;
  for (let it = 0; it < o.iterations; it++) {
    const an = {}, ad = {}, dn = {}, dd = {};
    teams.forEach((t) => { an[t] = P; ad[t] = P; dn[t] = P; dd[t] = P; });
    for (const r of rows) {
      an[r.h] += r.w * r.xh; ad[r.h] += r.w * muH * def[r.a];
      an[r.a] += r.w * r.xa; ad[r.a] += r.w * muA * def[r.h];
      dn[r.h] += r.w * r.xa; dd[r.h] += r.w * muA * att[r.a];
      dn[r.a] += r.w * r.xh; dd[r.a] += r.w * muH * att[r.h];
    }
    teams.forEach((t) => { att[t] = an[t] / ad[t]; def[t] = dn[t] / dd[t]; });
  }
  return { att, def, muH, muA, n: rows.length, games, conv };
}

/** Buts attendus pour une affiche, ou null si une équipe est inconnue. */
export function expectedGoals(r, home, away, neutral = false) {
  if (!r || !(home in r.att) || !(away in r.att)) return null;
  const mu = (r.muH + r.muA) / 2;
  const bh = neutral ? mu : r.muH, ba = neutral ? mu : r.muA;
  return { lh: bh * r.att[home] * r.def[away], la: ba * r.att[away] * r.def[home], gh: r.games[home], ga: r.games[away] };
}

/** Classement de puissance : attaque, défense et indice global (écart de buts attendu face à une équipe moyenne). */
export function powerTable(r) {
  if (!r) return [];
  return Object.keys(r.att).map((t) => ({
    id: t,
    att: r.att[t],
    def: r.def[t],
    power: (r.muH + r.muA) / 2 * (r.att[t] - r.def[t]),
  })).sort((a, b) => b.power - a.power);
}
