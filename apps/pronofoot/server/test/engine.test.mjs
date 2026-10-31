import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import webpush from 'web-push';

const FIX = process.env.PRONO_FIXTURE || '/tmp/claude-0/-home-user-Vous-/76a555b0-b9e0-5b4f-bceb-481308b86126/scratchpad/all2.json';
const board = JSON.parse(fs.readFileSync(FIX));
let current = structuredClone(board);
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, o) => (String(url).includes('site.api.espn.com') ? new Response(JSON.stringify(current), { headers: { 'content-type': 'application/json' } }) : realFetch(url, o));
// l'API ne prend que la date ; on simule « maintenant » au jour de la capture
const { tick } = await import('../functions/watch.mjs');
const { detectEvents, snapshot, digestFor, wants } = await import('../lib/engine.mjs');

const ev = () => current.events.find((e) => e.competitions[0].altGameNote === 'English Premier League');
const sent = [];
const send = async (sub, payload, opts) => { sent.push({ sub: sub.key, ...payload, ...opts }); return true; };
const subs = [
  { key: 'sub/top', prefs: { scope: 'suivis' } },
  { key: 'sub/fav', prefs: { scope: 'favoris', teams: [] } },
  { key: 'sub/nogoal', prefs: { scope: 'tous', goals: false } },
];
const state = { snap: {}, sent: {}, picks: {}, digestSlot: null };
const T0 = new Date(ev().competitions[0].date).getTime() - 20 * 60e3;

test('premier passage : mémorise sans alerter', async () => {
  const r = await tick({ first: false, s: {}, subs, state, now: T0, send });
  assert.ok(r.matches.length > 100);
  assert.equal(sent.length, 0);
});

test('coup d’envoi, but, rouge, mi-temps, fin', async () => {
  const c = ev().competitions[0];
  const set = (st) => { c.status = { ...c.status, displayClock: st.clock, type: { ...c.status.type, ...st.type } }; };
  set({ clock: "1'", type: { state: 'in', name: 'STATUS_FIRST_HALF', completed: false } });
  await tick({ first: false, s: {}, subs, state, now: T0 + 20 * 60e3, send });
  assert.ok(sent.some((x) => x.title.startsWith('Coup d’envoi') && x.sub === 'sub/top'));
  sent.length = 0;
  c.competitors[0].score = '1';
  c.details = [{ scoringPlay: true, team: { id: c.competitors[0].id }, clock: { displayValue: "23'" }, athletesInvolved: [{ displayName: 'Cole Palmer' }] }];
  set({ clock: "23'", type: {} });
  await tick({ first: false, s: {}, subs, state, now: T0 + 43 * 60e3, send });
  const goal = sent.find((x) => x.title.startsWith('⚽ BUT'));
  assert.ok(goal, 'notification de but');
  assert.match(goal.body, /Cole Palmer 23'/);
  assert.match(goal.body, /%/);
  assert.equal(goal.urgent, true);
  assert.ok(!sent.some((x) => x.sub === 'sub/nogoal'), 'buts désactivés respectés');
  assert.ok(!sent.some((x) => x.sub === 'sub/fav'), 'favoris seulement respecté');
  // pas de doublon au passage suivant
  sent.length = 0;
  await tick({ first: false, s: {}, subs, state, now: T0 + 43.2 * 60e3, send });
  assert.equal(sent.filter((x) => x.title.startsWith('⚽')).length, 0, 'pas de doublon');
  c.details.push({ redCard: true, team: { id: c.competitors[1].id }, clock: { displayValue: "31'" }, athletesInvolved: [{ displayName: 'Bruno Fernandes' }] });
  await tick({ first: false, s: {}, subs, state, now: T0 + 51 * 60e3, send });
  assert.ok(sent.some((x) => x.title.startsWith('🟥')));
  set({ clock: "45'", type: { name: 'STATUS_HALFTIME' } });
  await tick({ first: false, s: {}, subs, state, now: T0 + 66 * 60e3, send });
  assert.ok(sent.some((x) => x.title.startsWith('Mi-temps')));
  c.competitors[0].score = '0';
  set({ clock: "50'", type: { name: 'STATUS_SECOND_HALF' } });
  await tick({ first: false, s: {}, subs, state, now: T0 + 72 * 60e3, send });
  assert.ok(sent.some((x) => x.title.startsWith('But annulé')));
  c.competitors[0].score = '2';
  set({ clock: "FT", type: { state: 'post', name: 'STATUS_FULL_TIME', completed: true } });
  sent.length = 0;
  await tick({ first: false, s: {}, subs, state, now: T0 + 130 * 60e3, send });
  const ft = sent.find((x) => x.title.startsWith('Fin du match'));
  assert.ok(ft); assert.match(ft.body, /Prono . (validé|raté)/);
});

test('équipe suivie : alerte 15 min avant', async () => {
  current = structuredClone(board);
  const c = ev().competitions[0];
  const teamSub = { key: 'sub/team', prefs: { scope: 'favoris', teams: [c.competitors[0].id] } };
  sent.length = 0;
  const st = { snap: {}, sent: {}, picks: {}, digestSlot: null };
  await tick({ first: true, s: {}, subs: [teamSub], state: st, now: new Date(c.date).getTime() - 15 * 60e3, send });
  assert.ok(sent.some((x) => x.title.startsWith('Dans 15 min')), JSON.stringify(sent.map((x) => x.title)));
});

test('rappel de :00 / :30', () => {
  const matches = [];
  const d = digestFor({ scope: 'tous' }, [{ id: '1', state: 'pre', date: new Date(Date.now() + 3600e3), league: 'Ligue 1', leagueLabel: 'Ligue 1', home: { id: 'a', short: 'PSG', form: '', record: '' }, away: { id: 'b', short: 'OM', form: '', record: '' }, market: { home: 1.5, draw: 4.2, away: 6 }, reds: [], goals: [] }], Date.now());
  assert.match(d.title, /1 match d’ici 3 h/);
  assert.match(d.body, /PSG–OM → 1/);
});

test('chiffrement Web Push (VAPID + aes128gcm)', () => {
  const keys = webpush.generateVAPIDKeys();
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const sub = { endpoint: 'https://web.push.apple.com/QGxxx', keys: { p256dh: ecdh.getPublicKey('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
  const r = webpush.generateRequestDetails(sub, JSON.stringify({ title: 'But' }), { vapidDetails: { subject: 'https://example.com', publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 600, urgency: 'high' });
  assert.equal(r.headers['Content-Encoding'], 'aes128gcm');
  assert.equal(r.headers.Urgency, 'high');
  assert.match(r.headers.Authorization, /^vapid t=/);
});
