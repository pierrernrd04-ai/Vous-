// Moteur d'alertes du serveur : compare deux états des matchs, en tire les événements
// (buts, but annulé, rouge, coup d'envoi, mi-temps, fin, 15 min avant, rappel :00/:30)
// et décide quels abonnés doivent les recevoir. Fonctions pures, sans réseau ni stockage.

import { isTop } from '../../api.js';
import { predict, livePredict, pickHit } from '../../model.js';

export const APP_URL = 'https://pierrernrd04-ai.github.io/Vous-/prono/';

const pct = (x) => `${Math.round(x * 100)} %`;
const hhmmParis = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
const minuteOf = (m) => (m.statusName === 'STATUS_HALFTIME' ? 45 : parseInt(m.clock, 10) || 0);

export function quickPrediction(m) {
  return predict({
    neutral: m.neutral,
    home: { form: m.home.form, record: m.home.record },
    away: { form: m.away.form, record: m.away.record },
    market: m.market,
    total: m.total,
  });
}

export function snapshot(m) {
  return { s: m.state, n: m.statusName, h: m.home.score ?? 0, a: m.away.score ?? 0, r: m.reds.length };
}

/**
 * Événements entre l'ancien état (prev : id → snapshot) et les matchs actuels.
 * picks : id → code du prono d'avant-match (figé au premier passage en « pre »).
 */
export function detectEvents(prev, matches, picks = {}) {
  const events = [];
  for (const m of matches) {
    const p = prev[m.id];
    const s = snapshot(m);
    if (!p) continue; // premier passage : on mémorise sans alerter
    const vs = `${m.home.short} ${s.h}-${s.a} ${m.away.short}`;
    const base = { matchId: m.id, league: m.league, homeId: m.home.id, awayId: m.away.id, url: `${APP_URL}?match=${m.id}` };
    if (p.s === 'pre' && m.state === 'in') {
      const pr = quickPrediction(m);
      events.push({ ...base, type: 'kickoff', key: `ko:${m.id}`, title: `Coup d’envoi · ${m.home.short} – ${m.away.short}`, body: `Prono ${picks[m.id] || pr.pick.code} · ${m.leagueLabel}` });
    }
    if (s.h > p.h || s.a > p.a) {
      const team = s.h > p.h ? m.home : m.away;
      const last = [...m.goals].reverse().find((g) => g.teamId === team.id);
      const who = last ? `${last.player}${last.penalty ? ' (pen.)' : ''}${last.own ? ' (c.s.c.)' : ''} ${last.minute}` : m.clock || '';
      let probs = '';
      if (m.state === 'in') {
        const pr = quickPrediction(m);
        const lp = livePredict(pr.xgH, pr.xgA, minuteOf(m), s.h, s.a, m.reds.filter((r) => r.teamId === m.home.id).length, m.reds.filter((r) => r.teamId === m.away.id).length);
        probs = ` · ${m.home.short} ${pct(lp.pH)} / nul ${pct(lp.pD)} / ${m.away.short} ${pct(lp.pA)}`;
      }
      events.push({ ...base, type: 'goal', urgent: true, key: `goal:${m.id}:${s.h}-${s.a}`, title: `⚽ BUT ${team.short} · ${vs}`, body: `${who}${probs}` });
    } else if (s.h < p.h || s.a < p.a) {
      events.push({ ...base, type: 'goal', urgent: true, key: `var:${m.id}:${s.h}-${s.a}`, title: `But annulé · ${vs}`, body: 'Décision de l’arbitre (VAR)' });
    }
    if (s.r > (p.r || 0)) {
      const r = m.reds[m.reds.length - 1];
      const team = r?.teamId === m.home.id ? m.home : m.away;
      events.push({ ...base, type: 'card', urgent: true, key: `red:${m.id}:${s.r}`, title: `🟥 Rouge · ${team.short}`, body: `${r?.player || ''} ${r?.minute || ''} · ${vs}`.trim() });
    }
    if (p.n !== 'STATUS_HALFTIME' && m.statusName === 'STATUS_HALFTIME') {
      events.push({ ...base, type: 'kickoff', key: `ht:${m.id}`, title: `Mi-temps · ${vs}`, body: m.goals.map((g) => `${g.player} ${g.minute}`).join(', ') || 'Pas de but' });
    }
    if (p.s === 'in' && m.state === 'post' && m.completed) {
      const code = picks[m.id];
      const verdict = code ? (pickHit(code, s.h, s.a) ? `Prono ${code} validé ✓` : `Prono ${code} raté ✕`) : '';
      events.push({ ...base, type: 'kickoff', key: `ft:${m.id}`, title: `Fin du match · ${vs}`, body: verdict || m.leagueLabel });
    }
  }
  return events;
}

/** Préférences par défaut d'un abonné. */
export const DEFAULT_PREFS = { scope: 'suivis', teams: [], matches: [], goals: true, cards: true, kickoff: true, prematch: true, reminders: true };

export function followedBy(prefs, m) {
  return (prefs.matches || []).includes(m.id ?? m.matchId) || (prefs.teams || []).includes(m.home?.id ?? m.homeId) || (prefs.teams || []).includes(m.away?.id ?? m.awayId);
}
export function inScope(prefs, m) {
  if (followedBy(prefs, m)) return true;
  if (prefs.scope === 'favoris') return false;
  if (prefs.scope === 'tous') return true;
  return isTop(m.league);
}
const TYPE_PREF = { goal: 'goals', card: 'cards', kickoff: 'kickoff', prematch: 'prematch', reminder: 'reminders' };
export function wants(prefs, ev) {
  const p = { ...DEFAULT_PREFS, ...prefs };
  if (p[TYPE_PREF[ev.type]] === false) return false;
  return inScope(p, ev);
}

/** Matchs suivis de l'abonné qui commencent dans 14 à 16 minutes. */
export function prematchFor(prefs, matches, now = Date.now()) {
  return matches
    .filter((m) => m.state === 'pre' && followedBy(prefs, m) && m.date - now <= 16 * 60e3 && m.date - now > 13 * 60e3)
    .map((m) => {
      const pr = quickPrediction(m);
      return { type: 'prematch', matchId: m.id, key: `pre:${m.id}`, url: `${APP_URL}?match=${m.id}`, title: `Dans 15 min · ${m.home.short} – ${m.away.short}`, body: `Prono ${pr.pick.code} (${pct(pr.pick.p)}, ${pr.reliability.tier.toLowerCase()}) · ${m.leagueLabel}` };
    });
}

/** Rappel de :00 et :30 : les matchs de l'abonné des 3 prochaines heures. */
export function digestFor(prefs, matches, now = Date.now()) {
  const p = { ...DEFAULT_PREFS, ...prefs };
  if (!p.reminders) return null;
  const up = matches
    .filter((m) => m.state === 'pre' && m.date - now > 0 && m.date - now < 3 * 3600e3 && inScope(p, m))
    .map((m) => ({ m, pr: quickPrediction(m), f: followedBy(p, m) }))
    .sort((a, b) => (b.f - a.f) || b.pr.pick.p - a.pr.pick.p);
  if (!up.length) return null;
  const liveN = matches.filter((m) => m.state === 'in' && inScope(p, m)).length;
  const lines = up.slice(0, 5).sort((a, b) => a.m.date - b.m.date).map(({ m, pr }) => `${hhmmParis(m.date)} ${m.home.short}–${m.away.short} → ${pr.pick.code} ${pct(pr.pick.p)}`);
  return {
    type: 'reminder',
    key: 'digest',
    url: APP_URL,
    title: `${up.length} match${up.length > 1 ? 's' : ''} d’ici 3 h${liveN ? ` · ${liveN} en direct` : ''}`,
    body: lines.join('\n') + (up.length > 5 ? `\n+${up.length - 5} autres` : ''),
  };
}

/** Faut-il surveiller de près (toutes les 8 s) ? Oui si un match concerné est en cours ou commence dans 3 min. */
export function needsFastPolling(matches, scopes, now = Date.now()) {
  const relevant = (m) => scopes.some((prefs) => inScope({ ...DEFAULT_PREFS, ...prefs }, m));
  return matches.some((m) => relevant(m) && (m.state === 'in' || (m.state === 'pre' && m.date - now < 3 * 60e3 && m.date - now > -30 * 60e3)));
}
