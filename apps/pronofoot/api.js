// Accès aux données football (API publique ESPN, CORS ouvert, sans clé).
// Normalise les matchs et extrait les variables utiles au modèle.

import { americanToDecimal } from './model.js';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all';

export const ymd = (d) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

async function getJSON(url, { signal } = {}) {
  const r = await fetch(url, { signal, cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// Compétitions mises en avant (filtre « Top »)
const TOP = [
  /^Ligue 1$/, /^Ligue 2$/, /^English Premier League$/, /^LALIGA$/, /^Serie A$/, /^Bundesliga$/,
  /^Liga Portugal$/, /^Eredivisie$/, /^Belgian Pro League$/, /^EFL Championship$/, /^SPFL Premiership$/,
  /^Turkish Super Lig$/, /^Saudi Pro League$/, /^MLS$/, /^Brazil Serie A$/, /^Argentine LPF$/, /^Liga MX$/,
  /Champions League/, /Europa League/, /Conference League/, /World Cup/, /Nations League/, /^UEFA/,
  /Coupe de France/, /FA Cup/, /Copa del Rey/, /Coppa Italia/, /DFB/, /Copa Libertadores/, /Copa Sudamericana/,
  /Friendly/, /Euro/, /Africa Cup/, /Copa Am[ée]rica/, /Supercup|Super Cup|Trophée des Champions/,
];
const LEAGUE_FR = {
  'English Premier League': 'Premier League',
  LALIGA: 'LaLiga',
  'LALIGA 2': 'LaLiga 2',
  'EFL Championship': 'Championship',
  'Turkish Super Lig': 'Süper Lig',
  'Brazil Serie A': 'Brasileirão',
  'Argentine LPF': 'Liga Profesional (ARG)',
  'NCAAM Soccer': 'NCAA (H)',
  'NCAAW Soccer': 'NCAA (F)',
};
const PRIORITY = ['Ligue 1', 'Champions League', 'English Premier League', 'LALIGA', 'Serie A', 'Bundesliga', 'Europa League', 'Conference League', 'Ligue 2'];

export function leaguePriority(name) {
  const i = PRIORITY.findIndex((p) => name.includes(p));
  if (i >= 0) return i;
  return TOP.some((r) => r.test(name)) ? 50 : 100;
}
export const isTop = (name) => TOP.some((r) => r.test(name)) && !/NCAA|Women|Femenil|Liga F$|WSL|Féminine/i.test(name);

function parseOdds(c) {
  const o = c.odds?.[0];
  if (!o) return {};
  const ml = o.moneyline;
  const home = americanToDecimal(ml?.home?.close?.odds ?? ml?.home?.open?.odds ?? o.homeTeamOdds?.moneyLine);
  const away = americanToDecimal(ml?.away?.close?.odds ?? ml?.away?.open?.odds ?? o.awayTeamOdds?.moneyLine);
  const draw = americanToDecimal(o.drawOdds?.moneyLine);
  const market = home && away && draw ? { home, draw, away } : null;
  let total = null;
  const line = parseFloat(String(o.total?.over?.close?.line ?? '').replace(/[ou]/, '')) || o.overUnder;
  const over = americanToDecimal(o.total?.over?.close?.odds ?? o.overOdds);
  const under = americanToDecimal(o.total?.under?.close?.odds ?? o.underOdds);
  if (line && over && under) total = { line, over, under };
  return { market, total, provider: o.provider?.displayName || o.provider?.name };
}

function normalizeEvent(e) {
  const c = e.competitions[0];
  const side = (ha) => {
    const t = c.competitors.find((x) => x.homeAway === ha) || c.competitors[ha === 'home' ? 0 : 1];
    return {
      id: t.team.id,
      name: t.team.displayName,
      short: t.team.shortDisplayName || t.team.displayName,
      abbr: t.team.abbreviation,
      logo: t.team.logo,
      score: t.score != null && t.score !== '' ? Number(t.score) : null,
      form: t.form || '',
      record: t.records?.[0]?.summary || '',
      winner: !!t.winner,
    };
  };
  const st = c.status || e.status;
  const league = c.altGameNote || e.season?.slug || 'Football';
  const goals = (c.details || [])
    .filter((d) => d.scoringPlay)
    .map((d) => ({
      teamId: d.team?.id,
      minute: d.clock?.displayValue || '',
      player: d.athletesInvolved?.[0]?.displayName || '',
      penalty: !!d.penaltyKick,
      own: !!d.ownGoal,
    }));
  const reds = (c.details || []).filter((d) => d.redCard).map((d) => ({ teamId: d.team?.id, minute: d.clock?.displayValue, player: d.athletesInvolved?.[0]?.displayName || '' }));
  return {
    id: e.id,
    date: new Date(c.date || e.date),
    league,
    leagueLabel: LEAGUE_FR[league] || league,
    state: st.type.state, // pre | in | post
    completed: !!st.type.completed,
    statusName: st.type.name,
    statusShort: st.type.shortDetail,
    clock: st.displayClock,
    venue: c.venue?.fullName || '',
    city: c.venue?.address?.city || '',
    neutral: !!c.neutralSite,
    home: side('home'),
    away: side('away'),
    goals,
    reds,
    ...parseOdds(c),
    link: e.links?.[0]?.href,
  };
}

/** Tous les matchs de foot du jour ESPN donné. */
export async function fetchDay(date, opts) {
  const data = await getJSON(`${BASE}/scoreboard?dates=${ymd(date)}&limit=1000`, opts);
  return (data.events || []).map(normalizeEvent);
}

/** Analyse approfondie : forme détaillée, classement, face-à-face, buteurs. */
export async function fetchDetails(match, opts) {
  const s = await getJSON(`${BASE}/summary?event=${match.id}`, opts);
  const gamesFor = (teamId) => {
    const block = (s.lastFiveGames || []).find((b) => b.team?.id === teamId);
    return (block?.events || []).map((g) => {
      const isHome = g.homeTeamId === teamId;
      const hs = Number(g.homeTeamScore), as = Number(g.awayTeamScore);
      return {
        date: g.gameDate,
        opponent: g.opponent?.displayName || '',
        opponentLogo: g.opponent?.logo,
        home: isHome,
        gf: isHome ? hs : as,
        ga: isHome ? as : hs,
        result: g.gameResult,
        competition: g.competitionName || '',
      };
    });
  };
  const standingOf = (teamId) => {
    for (const grp of s.standings?.groups || []) {
      const entry = (grp.standings?.entries || []).find((x) => x.id === teamId);
      if (entry) {
        const v = (n) => Number(entry.stats.find((x) => x.name === n)?.value ?? NaN);
        return { rank: v('rank'), gp: v('gamesPlayed'), pts: v('points'), gd: v('pointDifferential'), w: v('wins'), d: v('ties'), l: v('losses'), group: grp.header };
      }
    }
    return null;
  };
  const table = [];
  for (const grp of s.standings?.groups || []) {
    for (const entry of grp.standings?.entries || []) {
      const v = (n) => entry.stats.find((x) => x.name === n)?.value;
      table.push({ id: entry.id, name: entry.team, rank: v('rank'), gp: v('gamesPlayed'), pts: v('points'), gd: v('pointDifferential') });
    }
  }
  const h2h = [];
  for (const series of s.seasonseries || []) {
    for (const ev of series.events || []) {
      if (!ev.statusType?.completed) continue;
      const ch = ev.competitors.find((x) => x.team?.id === match.home.id);
      const ca = ev.competitors.find((x) => x.team?.id === match.away.id);
      if (!ch || !ca) continue;
      h2h.push({ date: ev.date, homeGoals: Number(ch.score), awayGoals: Number(ca.score), venueHome: ch.homeAway === 'home' });
    }
  }
  const leaders = {};
  for (const L of s.leaders || []) {
    const tid = L.team?.id;
    leaders[tid] = (L.leaders || []).map((cat) => ({
      category: cat.displayName,
      players: (cat.leaders || []).slice(0, 3).map((x) => ({ name: x.athlete?.displayName, value: x.displayValue })),
    }));
  }
  const lineups = {};
  for (const r of s.rosters || []) {
    const tid = r.team?.id;
    lineups[tid] = (r.roster || []).filter((p) => p.starter).map((p) => ({ name: p.athlete?.displayName, pos: p.position?.abbreviation, jersey: p.jersey }));
  }
  const odds = s.pickcenter?.[0] || s.odds?.[0];
  let market = match.market, total = match.total;
  if (!market && odds?.homeTeamOdds?.moneyLine && odds?.awayTeamOdds?.moneyLine && odds?.drawOdds?.moneyLine) {
    market = {
      home: americanToDecimal(odds.homeTeamOdds.moneyLine),
      draw: americanToDecimal(odds.drawOdds.moneyLine),
      away: americanToDecimal(odds.awayTeamOdds.moneyLine),
    };
  }
  if (!total && odds?.overUnder && odds?.overOdds && odds?.underOdds) {
    total = { line: odds.overUnder, over: americanToDecimal(odds.overOdds), under: americanToDecimal(odds.underOdds) };
  }
  return {
    homeGames: gamesFor(match.home.id),
    awayGames: gamesFor(match.away.id),
    homeStanding: standingOf(match.home.id),
    awayStanding: standingOf(match.away.id),
    table: table.slice(0, 40),
    h2h: h2h.slice(0, 6),
    leaders,
    lineups,
    market,
    total,
    fetchedAt: Date.now(),
  };
}
