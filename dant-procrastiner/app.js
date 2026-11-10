import { saintOfDay } from './saints.js';

const C = await loadCore();
const { CATS, catById, HOUR } = C;
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let link = null, snapT = 0; // widgets PC (plus bas)
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function loadCore() {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'core.js';
    s.onload = () => resolve(window.DantCore);
    s.onerror = reject;
    document.head.append(s);
  });
}

// ---------- État ----------
let state = await C.get('state');
if (!state) {
  const now = Date.now();
  const at = (days, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d.getTime(); };
  state = {
    v: 1,
    reminders: [
      { id: uid(), title: 'Boire un grand verre d’eau 💧', cat: 'alcool', due: now - 5 * 60e3, repeat: 'none', nag: true, note: 'Exemple : coche-le pour voir ce qui se passe 😉', createdAt: now },
      { id: uid(), title: '20 minutes de sport', cat: 'sport', due: at(0, 18), repeat: 'daily', nag: true, note: '', createdAt: now },
      { id: uid(), title: 'Appeler un proche', cat: 'famille', due: at(1, 19), repeat: 'weekly', nag: true, note: 'Juste pour prendre des nouvelles.', createdAt: now },
    ],
    settings: { quiet: true, quietStart: 22, quietEnd: 8, sound: true, place: null },
    history: {},
  };
  await save();
}
let nags = (await C.get('nags')) || {};
let current = 'all';
let showDone = false;

async function save() { await C.set('state', state); pushSnap(); }

// ---------- Horloge, date, saint ----------
const fmtDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });
const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const pad = (n) => String(n).padStart(2, '0');
let lastMin = -1, lastDay = -1;
function tickClock() {
  const d = new Date();
  $('#hhmm').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sec = $('#sec');
  sec.textContent = pad(d.getSeconds());
  sec.classList.remove('flip'); void sec.offsetWidth; sec.classList.add('flip');
  if (d.getDate() !== lastDay) {
    lastDay = d.getDate();
    $('#dayName').textContent = fmtDay.format(d);
    $('#dateLine').textContent = fmtDate.format(d);
    const s = saintOfDay(d);
    $('#saintText').textContent = s.holiday ? `${s.holiday} · ${s.line}` : s.line;
  }
  if (d.getMinutes() !== lastMin) { lastMin = d.getMinutes(); render(); }
}

// ---------- Météo (Open-Meteo, sans clé) ----------
const WMO = [
  [[0], '☀️', 'Grand soleil', 'sun'], [[1], '🌤️', 'Plutôt ensoleillé', 'sun'], [[2], '⛅', 'Éclaircies', ''], [[3], '☁️', 'Couvert', ''],
  [[45, 48], '🌫️', 'Brouillard', ''], [[51, 53, 55, 56, 57], '🌦️', 'Bruine', 'rain'], [[61, 63, 66], '🌧️', 'Pluie', 'rain'], [[65, 67], '🌧️', 'Grosse pluie', 'rain'],
  [[71, 73, 75, 77, 85, 86], '❄️', 'Neige', ''], [[80, 81, 82], '🌦️', 'Averses', 'rain'], [[95, 96, 99], '⛈️', 'Orage', 'rain'],
];
async function locate() {
  if (state.settings.place) return state.settings.place;
  const fallback = { lat: 48.8566, lon: 2.3522, name: 'Paris' };
  if (!navigator.geolocation) return fallback;
  const pos = await new Promise((res) => navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 9000, maximumAge: 30 * 60e3 }));
  if (!pos) return fallback;
  const place = { lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3), name: 'Ma position' };
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${place.lat}&longitude=${place.lon}&localityLanguage=fr`);
    const j = await r.json();
    place.name = j.city || j.locality || j.principalSubdivision || place.name;
  } catch (e) {}
  if (JSON.stringify(state.settings.lastPlace) !== JSON.stringify(place)) { state.settings.lastPlace = place; save(); }
  return place;
}
async function loadWeather() {
  $('#wLabel').textContent = 'Météo…';
  try {
    const p = await locate();
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`);
    const j = await r.json();
    const code = j.current.weather_code;
    const w = WMO.find(([codes]) => codes.includes(code)) || WMO[2];
    const night = !j.current.is_day && code <= 1;
    const ico = $('#wIco');
    ico.textContent = night ? '🌙' : w[1];
    ico.className = `w-ico ${night ? '' : w[3]}`;
    $('#wTemp').textContent = `${Math.round(j.current.temperature_2m)}°`;
    $('#wLabel').textContent = night ? 'Nuit claire' : w[2];
    $('#wCity').textContent = `📍 ${p.name}`;
    $('#wMinMax').innerHTML = `<span class="mx">↑${Math.round(j.daily.temperature_2m_max[0])}°</span> <span class="mn">↓${Math.round(j.daily.temperature_2m_min[0])}°</span>`;
  } catch (e) {
    $('#wLabel').textContent = 'Météo indisponible';
  }
}

// ---------- Punchlines ----------
const PUNCH = [
  'Pas <em>dans</em> une heure. <strong>Maintenant.</strong>',
  'Demain, c’est le jour préféré des <em>procrastinateurs</em>. <strong>Pas le tien.</strong>',
  'Le meilleur moment, c’était il y a une heure. <strong>Le deuxième, c’est maintenant.</strong>',
  '<em>Dan’t</em> attendre d’avoir envie. <strong>L’envie vient en faisant.</strong>',
  'Cinq minutes. <strong>Juste cinq minutes</strong>, et on voit après.',
  'Ton canapé t’aime. <em>Mais</em> <strong>tes objectifs aussi.</strong>',
  'Fais-le <strong>maintenant</strong>, et savoure <em>après</em>.',
];
let punchI = 0;
function rotatePunch() {
  const el = $('#punchLine');
  el.classList.add('out');
  setTimeout(() => { punchI = (punchI + 1) % PUNCH.length; el.innerHTML = PUNCH[punchI]; el.classList.remove('out'); }, 400);
}

// ---------- Temps relatif ----------
function rel(t, now = Date.now()) {
  const diff = t - now, a = Math.abs(diff);
  const m = Math.round(a / 60e3), h = Math.floor(a / HOUR), d = Math.round(a / (24 * HOUR));
  let s;
  if (m < 1) s = 'maintenant';
  else if (m < 60) s = `${m} min`;
  else if (h < 24) s = `${h} h${m % 60 && h < 6 ? ` ${pad(m % 60)}` : ''}`;
  else s = `${d} j`;
  if (s === 'maintenant') return s;
  return diff < 0 ? `en retard de ${s}` : `dans ${s}`;
}
const fmtWhen = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
function whenLabel(t) {
  const d = new Date(t), today = new Date();
  const tm = new Date(today); tm.setDate(tm.getDate() + 1);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.toDateString() === today.toDateString()) return `Aujourd’hui ${hm}`;
  if (d.toDateString() === tm.toDateString()) return `Demain ${hm}`;
  return `${fmtWhen.format(d)} ${hm}`;
}

// ---------- Onglets ----------
function setCatVars(el, id) {
  const c = id === 'all' ? { color: '#ff2e93', on: '#ffffff' } : catById(id);
  el.style.setProperty('--cat', c.color);
  el.style.setProperty('--on-cat', c.on);
}
function renderTabs() {
  const now = Date.now();
  const tabs = [{ id: 'all', name: 'Tout', emo: '✨' }, ...CATS];
  $('#tabs').innerHTML = tabs.map((t) => {
    const items = state.reminders.filter((r) => !r.done && (t.id === 'all' || r.cat === t.id));
    const late = items.filter((r) => C.baseOf(r) <= now).length;
    const c = t.id === 'all' ? { color: '#ff2e93', on: '#fff' } : t;
    return `<button class="tab" role="tab" data-cat="${t.id}" aria-selected="${t.id === current}" style="--cat:${c.color};--on-cat:${c.on}">
      <span class="t-emo">${t.emo}</span>${t.name}${items.length ? `<span class="t-count ${late ? 'late' : ''}">${late || items.length}</span>` : ''}</button>`;
  }).join('');
}
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (!b || b.dataset.cat === current) return;
  current = b.dataset.cat;
  render();
  b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  haptic(8);
});

// ---------- Liste ----------
const CHECK_SVG = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function itemHTML(r, i, now) {
  const c = catById(r.cat);
  const base = C.baseOf(r);
  const late = !r.done && base <= now;
  const soon = !r.done && !late && base - now < HOUR;
  const n = nags[r.id];
  const rep = r.repeat === 'daily' ? '🔁 chaque jour' : r.repeat === 'weekly' ? '🔁 chaque semaine' : '';
  const when = r.done ? `✅ fait ${whenLabel(r.doneAt).toLowerCase()}` : r.snoozeUntil > now ? `⏳ reporté, ${rel(r.snoozeUntil, now)}` : `${late ? '⏰' : '🕒'} ${whenLabel(r.due)} · ${rel(base, now)}`;
  return `<article class="item ${late ? 'late' : ''} ${r.done ? 'done' : ''}" data-id="${r.id}" style="--c:${c.color};--i:${i}">
    <button class="check" data-act="toggle" aria-label="${r.done ? 'Marquer comme pas fait' : 'Marquer comme fait'}">${CHECK_SVG}</button>
    <div class="i-body">
      <p class="i-title">${esc(r.title)}</p>
      ${r.note ? `<p class="i-note">${esc(r.note)}</p>` : ''}
      <div class="i-meta">
        <span class="chip when ${late ? 'late' : soon ? 'soon' : ''}">${when}</span>
        ${current === 'all' ? `<span class="chip cat">${c.emo} ${c.name}</span>` : ''}
        ${rep ? `<span class="chip">${rep}</span>` : ''}
        ${!r.done && r.nag ? `<span class="chip nag">🔔 ${late && n && n.base === base ? `relancé ${n.count}×` : 'toutes les heures'}</span>` : ''}
      </div>
    </div>
    <div class="i-actions">
      <button class="mini" data-act="edit" aria-label="Modifier">✏️</button>
      ${!r.done ? '<button class="mini" data-act="ics" aria-label="Ajouter à l’agenda">📅</button>' : ''}
    </div>
  </article>`;
}

function render() {
  const now = Date.now();
  renderTabs();
  const wrap = document.documentElement;
  setCatVars(wrap, current);
  const cat = current === 'all' ? null : catById(current);
  $('#catTitle').textContent = cat ? `${cat.emo} ${cat.name}` : 'Tout';
  $('#catSub').textContent = cat ? cat.sub : 'Tous tes rappels, tous thèmes confondus.';

  const mine = state.reminders.filter((r) => current === 'all' || r.cat === current);
  const open = mine.filter((r) => !r.done).sort((a, b) => C.baseOf(a) - C.baseOf(b));
  const done = mine.filter((r) => r.done).sort((a, b) => b.doneAt - a.doneAt);
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
  const groups = [
    ['late', '🔥 En retard', open.filter((r) => C.baseOf(r) <= now)],
    ['today', '☀️ Aujourd’hui', open.filter((r) => C.baseOf(r) > now && r.due <= endToday)],
    ['later', '🚀 À venir', open.filter((r) => C.baseOf(r) > now && r.due > endToday)],
  ];

  // progression du jour : faits aujourd'hui / (faits aujourd'hui + encore dus aujourd'hui)
  const todayKey = C.dayKey(now);
  const doneToday = mine.filter((r) => (r.doneAt && C.dayKey(r.doneAt) === todayKey) || (r.lastDone && C.dayKey(r.lastDone) === todayKey)).length;
  const dueToday = open.filter((r) => r.due <= endToday).length;
  const pct = doneToday + dueToday ? Math.round((doneToday / (doneToday + dueToday)) * 100) : (mine.length ? 100 : 0);
  $('#ringFg').style.strokeDashoffset = String(113.1 * (1 - pct / 100));
  $('#ringPct').textContent = `${pct}%`;

  let i = 0, html = '';
  for (const [k, label, list] of groups) {
    if (!list.length) continue;
    html += `<h3 class="group-title ${k}"><span class="gdot"></span>${label} · ${list.length}</h3>`;
    html += list.map((r) => itemHTML(r, i++, now)).join('');
  }
  if (!open.length) {
    html += `<div class="empty"><span class="e-emo">${cat ? cat.emo : '🌈'}</span><h3>${done.length ? 'Tout est fait. Respect.' : 'Rien ici pour l’instant'}</h3>
      <p>${done.length ? 'Tu viens de prouver que tu ne procrastines pas.' : 'Ajoute un rappel, je m’occupe de te relancer.'}</p>
      <button class="btn pink" data-act="new">＋ Nouveau rappel</button></div>`;
  }
  if (done.length) {
    html += `<h3 class="group-title"><span class="gdot"></span>✅ Fait · ${done.length}<button data-act="toggleDone">${showDone ? 'Masquer' : 'Afficher'}</button></h3>`;
    if (showDone) html += done.slice(0, 30).map((r) => itemHTML(r, i++, now)).join('');
  }
  $('#list').innerHTML = html;

  // stats
  const allLate = state.reminders.filter((r) => !r.done && C.baseOf(r) <= now).length;
  $('#stLate').textContent = allLate;
  $('#stLate').parentElement.classList.toggle('hot', allLate > 0);
  $('#stToday').textContent = state.history[todayKey] || 0;
  $('#stStreak').textContent = streak();
  document.title = allLate ? `(${allLate}) ⏰ Dan't Procrastiner` : "Dan't Procrastiner";
  $('#bellBtn .bell').classList.toggle('ring-it', allLate > 0);
  if (navigator.setAppBadge) (allLate ? navigator.setAppBadge(allLate) : navigator.clearAppBadge()).catch(() => {});
}

function streak() {
  let n = 0;
  const d = new Date();
  if (!state.history[C.dayKey(d)]) d.setDate(d.getDate() - 1);
  while (state.history[C.dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

$('#list').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'new') return openEdit();
  if (act === 'toggleDone') { showDone = !showDone; return render(); }
  const el = b.closest('.item');
  const r = state.reminders.find((x) => x.id === el.dataset.id);
  if (!r) return;
  if (act === 'edit') return openEdit(r);
  if (act === 'ics') return downloadICS([r]);
  if (act === 'toggle') {
    if (r.done) { r.done = false; r.doneAt = 0; await save(); return render(); }
    await complete(r.id, b);
  }
});

const CHEERS = ['Bien joué ! 💥', 'Et un de moins ! 🔥', 'Machine de guerre ⚡', 'Zéro procrastination 😎', 'Tu gères ! 🌈', 'Respect. 🙌'];
async function complete(id, checkBtn) {
  const r = state.reminders.find((x) => x.id === id);
  if (!r) return;
  const el = document.querySelector(`.item[data-id="${id}"]`);
  const c = catById(r.cat);
  if (checkBtn) {
    el.classList.add('done');
    checkBtn.classList.add('burst');
    const rect = checkBtn.getBoundingClientRect();
    confetti(rect.left + rect.width / 2, rect.top + rect.height / 2, [c.color, '#ff2e93', '#39ff88', '#7fd3ff', '#ffffff']);
  } else {
    confetti(innerWidth / 2, innerHeight / 3, [c.color, '#ff2e93', '#39ff88', '#7fd3ff']);
  }
  haptic([20, 40, 30]);
  chime();
  C.applyAction(state, id, 'done', Date.now());
  await save();
  const msg = r.repeat !== 'none' ? `Prochaine fois : ${whenLabel(r.due).toLowerCase()}` : 'Coché et classé.';
  toast(CHEERS[Math.floor(Math.random() * CHEERS.length)], msg, '🎉');
  setTimeout(() => { if (el) el.classList.add('leaving'); setTimeout(render, 280); }, checkBtn ? 650 : 0);
}

// ---------- Feuilles ----------
function openSheet(wrap) {
  wrap.hidden = false;
  wrap.classList.remove('closing');
}
function closeSheet(wrap) {
  wrap.classList.add('closing');
  setTimeout(() => { wrap.hidden = true; wrap.classList.remove('closing'); }, 280);
}
document.querySelectorAll('.sheet-wrap').forEach((w) => w.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSheet(w); }));
addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.sheet-wrap:not([hidden])').forEach(closeSheet); });

// ---------- Ajout / modification ----------
const IDEAS = {
  sport: ['20 min de course', 'Séance de muscu', '10 000 pas', 'Étirements', 'Préparer mon sac de sport'],
  alcool: ['Soirée sans alcool', 'Un verre d’eau entre chaque verre', 'Max 2 verres ce soir', 'Noter ma conso de la semaine'],
  food: ['Manger des légumes', 'Préparer mes repas', 'Boire 1,5 L d’eau', 'Pas de grignotage', 'Petit-déj complet'],
  courses: ['Faire les courses', 'Racheter du lait', 'Faire la liste', 'Pharmacie', 'Retirer un colis'],
  prod: ['Répondre aux mails', 'Bosser 25 min sans téléphone', 'Ranger mon bureau', 'Payer les factures', 'Planifier ma semaine'],
  famille: ['Appeler maman', 'Appeler papa', 'Envoyer un message à la famille', 'Prévoir un repas ensemble', 'Penser à un anniversaire'],
};
const ed = { id: null, cat: 'prod', repeat: 'none' };
const form = $('#editForm');
function fillWhen(t) {
  const d = new Date(t);
  $('#fDate').value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  $('#fTime').value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function renderPickers() {
  $('#catPick').innerHTML = CATS.map((c) => `<button type="button" data-cat="${c.id}" aria-pressed="${c.id === ed.cat}" style="--c:${c.color}"><span>${c.emo}</span>${c.name}</button>`).join('');
  $('#ideas').innerHTML = IDEAS[ed.cat].map((t, i) => `<button type="button" style="--i:${i}">${t}</button>`).join('');
  form.querySelectorAll('#fRepeat button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === ed.repeat)));
  setCatVars(form, ed.cat);
}
function openEdit(r) {
  ed.id = r ? r.id : null;
  ed.cat = r ? r.cat : current === 'all' ? 'prod' : current;
  ed.repeat = r ? r.repeat : 'none';
  $('#editTitle').textContent = r ? 'Modifier le rappel' : 'Nouveau rappel';
  $('#fTitle').value = r ? r.title : '';
  $('#fNote').value = r ? r.note || '' : '';
  $('#fNag').checked = r ? r.nag : true;
  $('#fDelete').hidden = !r;
  const t = new Date(Date.now() + HOUR); t.setMinutes(0, 0, 0);
  fillWhen(r ? r.due : t.getTime());
  renderPickers();
  openSheet($('#editWrap'));
  if (!r) setTimeout(() => $('#fTitle').focus(), 350);
}
$('#fab').addEventListener('click', () => { haptic(10); openEdit(); });
$('#catPick').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { ed.cat = b.dataset.cat; renderPickers(); haptic(6); } });
$('#ideas').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { $('#fTitle').value = b.textContent; haptic(6); } });
$('#fRepeat').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { ed.repeat = b.dataset.v; renderPickers(); } });
$('#quickWhen').addEventListener('click', (e) => {
  const q = e.target.closest('button')?.dataset.q;
  if (!q) return;
  const d = new Date();
  if (q === '1h') d.setTime(d.getTime() + HOUR);
  if (q === 'tonight') d.setHours(20, 0, 0, 0);
  if (q === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); }
  fillWhen(d.getTime());
  haptic(6);
});
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const [y, mo, da] = $('#fDate').value.split('-').map(Number);
  const [h, mi] = $('#fTime').value.split(':').map(Number);
  const due = new Date(y, mo - 1, da, h, mi).getTime();
  const data = { title: $('#fTitle').value.trim(), note: $('#fNote').value.trim(), cat: ed.cat, due, repeat: ed.repeat, nag: $('#fNag').checked, snoozeUntil: 0 };
  if (!data.title) return;
  if (ed.id) {
    const r = state.reminders.find((x) => x.id === ed.id);
    Object.assign(r, data);
    if (r.done && due > Date.now()) { r.done = false; r.doneAt = 0; }
  } else {
    state.reminders.push({ id: uid(), createdAt: Date.now(), done: false, ...data });
  }
  await save();
  closeSheet($('#editWrap'));
  current = current === 'all' ? 'all' : ed.cat;
  render();
  toast(ed.id ? 'Rappel modifié' : 'C’est noté !', `${whenLabel(due)}${data.nag ? ', puis relance toutes les heures' : ''}`, catById(ed.cat).emo);
  tick();
  if (notifStatus() !== 'granted') setTimeout(() => $('#notifCta').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 500, iterations: 2 }), 600);
});
$('#fDelete').addEventListener('click', async () => {
  state.reminders = state.reminders.filter((r) => r.id !== ed.id);
  await save();
  closeSheet($('#editWrap'));
  render();
  toast('Rappel supprimé', '', '🗑️');
});

// ---------- Notifications ----------
const hasNotif = 'Notification' in window;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
let reg = null;

async function setupSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    reg = await navigator.serviceWorker.getRegistration();
    if (reg && 'periodicSync' in reg) {
      try {
        const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
        if (st.state === 'granted') await reg.periodicSync.register('dant-check', { minInterval: HOUR });
      } catch (e) {}
    }
  } catch (e) { reg = null; }
}

function notifStatus() {
  if (!hasNotif) return isIOS && !standalone ? 'ios' : 'unsupported';
  return Notification.permission; // granted | denied | default
}
function renderNotifUI() {
  const s = notifStatus();
  const cta = $('#notifCta');
  $('#bellBtn .dot').hidden = s === 'granted';
  cta.hidden = s === 'granted';
  const txt = {
    default: ['Active les notifications', 'Sinon je ne peux pas te relancer toutes les heures. Et tu vas procrastiner. On le sait tous les deux.', 'Activer'],
    denied: ['Notifications bloquées', 'Autorise-les dans les réglages du navigateur (icône 🔒 à côté de l’adresse), puis reviens ici.', 'Comment ?'],
    ios: ['Installe l’appli sur ton iPhone', 'Partager ⬆️ puis « Sur l’écran d’accueil ». Ouvre Dan’t depuis l’icône : les notifications deviennent possibles.', 'Voir'],
    unsupported: ['Notifications indisponibles ici', 'Ajoute tes rappels à ton agenda (📅) pour être relancé à coup sûr.', 'Agenda'],
  }[s];
  if (txt) { $('#ncTitle').textContent = txt[0]; $('#ncSub').textContent = txt[1]; $('#ncBtn').textContent = txt[2]; }
  $('#notifState').textContent = {
    granted: '✅ Activées. Tu seras relancé à l’heure prévue, puis toutes les heures tant que ce n’est pas fait.',
    default: '⚠️ Pas encore activées.',
    denied: '⛔ Bloquées par le navigateur. Débloque-les dans les réglages du site.',
    ios: '📲 Sur iPhone, installe d’abord l’appli sur l’écran d’accueil, puis active-les ici.',
    unsupported: 'Ce navigateur ne gère pas les notifications. Utilise l’agenda ci-dessous.',
  }[s];
  $('#sEnable').hidden = s !== 'default';
}
async function askNotif() {
  const s = notifStatus();
  if (s === 'default') {
    const p = await Notification.requestPermission();
    renderNotifUI();
    if (p === 'granted') {
      confetti(innerWidth / 2, 160, ['#39ff88', '#ff2e93', '#7fd3ff']);
      toast('Notifications activées !', 'Plus d’excuses maintenant 😏', '🔔');
      await setupSW();
      tick();
    }
  } else if (s === 'unsupported') downloadICS(state.reminders.filter((r) => !r.done));
  else openSettings();
}
$('#ncBtn').addEventListener('click', askNotif);
$('#sEnable').addEventListener('click', askNotif);
$('#bellBtn').addEventListener('click', () => (notifStatus() === 'default' ? askNotif() : openSettings()));
$('#sTest').addEventListener('click', async () => {
  if (notifStatus() !== 'granted') return askNotif();
  if (reg?.active) reg.active.postMessage({ type: 'test' });
  else new Notification('🔔 Test réussi !', { body: 'Les relances arriveront comme ça.', icon: 'icons/icon-192.png' });
  toast('Notification envoyée', 'Regarde en haut de ton écran', '📨');
});

// Vérification : le SW s'en charge (il garde la trace des relances) ; sans SW, la page le fait elle-même.
async function tick() {
  if (notifStatus() !== 'granted') return inAppCheck();
  if (reg?.active) reg.active.postMessage({ type: 'tick' });
  else {
    const due = await C.check(async (r, count, msg) => new Notification(msg.title, { body: msg.body, tag: r.id, icon: 'icons/icon-192.png' }));
    if (due.length) onNagged(due.map((d) => d.r.id));
  }
}
// Sans permission : rappels dans l'appli seulement (toast + son), avec la même cadence horaire.
async function inAppCheck() {
  const due = await C.check(async () => {});
  if (due.length) onNagged(due.map((d) => d.r.id));
}
async function onNagged(ids) {
  nags = (await C.get('nags')) || {};
  render();
  const r = state.reminders.find((x) => x.id === ids[0]);
  if (!r || document.hidden) return;
  const msg = C.message(r, nags[r.id]?.count || 1);
  alarm(msg.title, msg.body.split('\n')[0], r.id);
}

navigator.serviceWorker?.addEventListener('message', async (e) => {
  const m = e.data || {};
  if (m.type === 'nagged') onNagged(m.ids);
  if (m.type === 'action') {
    if (m.action === 'done') await complete(m.id);
    else { C.applyAction(state, m.id, 'snooze', Date.now()); await save(); render(); toast('Reporté d’une heure', 'Je reviens te voir 😉', '⏳'); }
  }
  if (m.type === 'focus') highlight(m.id);
});
function highlight(id) {
  const r = state.reminders.find((x) => x.id === id);
  if (!r) return;
  current = 'all'; render();
  const el = document.querySelector(`.item[data-id="${id}"]`);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.animate([{ boxShadow: '0 0 0 0 #ff2e93' }, { boxShadow: '0 0 0 8px rgba(255,46,147,0)' }], { duration: 900, iterations: 3 }); }
}

// ---------- Agenda (.ics) : alarmes natives garanties ----------
function icsDate(t) {
  const d = new Date(t);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}
const icsText = (s) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
function downloadICS(list) {
  if (!list.length) return toast('Rien à exporter', 'Aucun rappel en cours', '📅');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', "PRODID:-//Dan't Procrastiner//FR", 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const now = icsDate(Date.now());
  for (const r of list) {
    const c = catById(r.cat);
    const start = Math.max(C.baseOf(r), Date.now() + 60e3);
    const rrule = r.repeat === 'daily' ? 'RRULE:FREQ=DAILY' : r.repeat === 'weekly' ? 'RRULE:FREQ=WEEKLY' : null;
    const count = r.nag ? 7 : 1; // échéance + 6 relances horaires
    for (let k = 0; k < count; k++) {
      const t = start + k * HOUR;
      const title = k === 0 ? `${c.emo} ${r.title}` : `${k === 1 ? '😤' : '🔥'} Relance ${k} : ${r.title}`;
      lines.push('BEGIN:VEVENT', `UID:${r.id}-${k}@dant-procrastiner`, `DTSTAMP:${now}`, `DTSTART:${icsDate(t)}`, `DTEND:${icsDate(t + 10 * 60e3)}`,
        `SUMMARY:${icsText(title)}`, `DESCRIPTION:${icsText(`${r.note ? `${r.note}\n` : ''}Dan't procrastiner ! Si c'est fait, supprime les relances suivantes.`)}`,
        ...(rrule ? [rrule] : []), 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(title)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = list.length === 1 ? `${list[0].title.replace(/[^\p{L}\p{N} ]/gu, '').trim() || 'rappel'}.ics` : 'dant-procrastiner.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Ouvre le fichier', 'pour l’ajouter à ton agenda avec ses alarmes', '📅');
}

// ---------- Réglages ----------
function openSettings() {
  const s = state.settings;
  $('#sQuiet').checked = s.quiet;
  $('#sQuietStart').value = `${pad(s.quietStart)}:00`;
  $('#sQuietEnd').value = `${pad(s.quietEnd)}:00`;
  $('#quietHours').hidden = !s.quiet;
  $('#sSound').checked = s.sound;
  $('#cityState').textContent = s.place ? `Ville choisie : ${s.place.name}` : 'Position automatique (Paris si refusée).';
  renderNotifUI();
  renderLinkUI();
  openSheet($('#setWrap'));
}
$('#settingsBtn').addEventListener('click', openSettings);
$('#sQuiet').addEventListener('change', async (e) => { state.settings.quiet = e.target.checked; $('#quietHours').hidden = !e.target.checked; await save(); });
$('#sQuietStart').addEventListener('change', async (e) => { state.settings.quietStart = +e.target.value.split(':')[0]; await save(); });
$('#sQuietEnd').addEventListener('change', async (e) => { state.settings.quietEnd = +e.target.value.split(':')[0]; await save(); });
$('#sSound').addEventListener('change', async (e) => { state.settings.sound = e.target.checked; await save(); });
$('#sIcsAll').addEventListener('click', () => downloadICS(state.reminders.filter((r) => !r.done)));
$('#sCityBtn').addEventListener('click', async () => {
  const q = $('#sCity').value.trim();
  if (!q) return;
  try {
    const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=fr`)).json();
    const p = j.results?.[0];
    if (!p) return toast('Ville introuvable', q, '🤷');
    state.settings.place = { lat: p.latitude, lon: p.longitude, name: p.name };
    await save();
    $('#cityState').textContent = `Ville choisie : ${p.name}`;
    loadWeather();
  } catch (e) { toast('Pas de réseau', 'Réessaie dans un instant', '📡'); }
});
$('#sCityAuto').addEventListener('click', async () => { state.settings.place = null; await save(); $('#cityState').textContent = 'Position automatique.'; loadWeather(); });
$('#weather').addEventListener('click', loadWeather);
$('#sExport').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  a.download = `dant-sauvegarde-${C.dayKey(Date.now())}.json`;
  a.click();
});
$('#sImport').addEventListener('change', async (e) => {
  try {
    const j = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(j.reminders)) throw new Error();
    state = { ...state, ...j, settings: { ...state.settings, ...j.settings } };
    await save(); render(); toast('Sauvegarde importée', `${j.reminders.length} rappels`, '💾');
  } catch (err) { toast('Fichier illisible', 'Ce n’est pas une sauvegarde Dan’t', '⚠️'); }
});
let installEvt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('#sInstall').hidden = false; });
$('#sInstall').addEventListener('click', async () => { if (installEvt) { installEvt.prompt(); installEvt = null; $('#sInstall').hidden = true; } });
if (standalone) $('#installBlock').hidden = true;

// ---------- Widgets PC : relais chiffré partagé avec les widgets Lively (link.js) ----------
const DEV = (() => { try { let d = localStorage.getItem('dant-dev'); if (!d) { d = uid(); localStorage.setItem('dant-dev', d); } return d; } catch (e) { return uid(); } })();
const WIDGETS_URL = new URL('widgets/', location.href).href;
function linkStart() {
  if (link) { link.close(); link = null; }
  const code = state.settings.linkCode;
  if (!code || !window.RPLink) return;
  link = RPLink.connect(code, { since: state.settings.linkSince || 0, onData: onLinkData });
  pushSnap();
}
async function onLinkData(m, meta) {
  if (!m || m.app !== 'dant' || m.dev === DEV) return;
  if (meta.time > (state.settings.linkSince || 0)) state.settings.linkSince = meta.time;
  if (m.k === 'h') pushSnap();
  if (m.k === 'a') {
    // l'action ne vaut que pour l'échéance vue sur le PC : un message rejoué ne coche jamais deux fois
    const r = state.reminders.find((x) => x.id === m.id);
    if (!r || r.done || C.baseOf(r) !== m.base) return;
    if (m.action === 'done') await complete(m.id);
    else { C.applyAction(state, m.id, 'snooze', Date.now()); await save(); render(); toast('Reporté depuis le PC', r.title, '🖥️'); }
  }
}
// un instantané léger : rappels en cours et faits aujourd'hui, série, ville de la météo
function pushSnap() {
  if (!link) return;
  clearTimeout(snapT);
  snapT = setTimeout(() => {
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const keep = state.reminders.filter((r) => !r.done || r.doneAt >= since.getTime())
      .map(({ id, title, cat, due, snoozeUntil, repeat, nag, done, doneAt, lastDone }) => ({ id, title, cat, due, snoozeUntil, repeat, nag, done, doneAt, lastDone }));
    const hist = {};
    for (let i = 0; i < 60; i++) { const k = C.dayKey(Date.now() - i * 864e5); if (state.history[k]) hist[k] = state.history[k]; }
    link.send({ app: 'dant', v: 1, k: 's', dev: DEV, at: Date.now(), reminders: keep, history: hist, place: state.settings.place || state.settings.lastPlace || null }, true).catch(() => {});
  }, 1200);
}
function renderLinkUI() {
  const code = state.settings.linkCode;
  $('#pcCode').hidden = !code; $('#pcCode').textContent = code || '';
  $('#pcOn').hidden = !!code; $('#pcCopy').hidden = !code; $('#pcOff').hidden = !code;
  $('#pcState').textContent = code
    ? 'Activés ✅ Sur le PC, ouvre le lien des widgets et tape ce code, ou copie directement le lien complet pour Lively.'
    : 'Tes rappels en direct sur le bureau Windows (Lively Wallpaper). Coche un rappel sur le PC, il est coché ici aussi.';
}
$('#pcOn').addEventListener('click', async () => {
  state.settings.linkCode = RPLink.newCode(); state.settings.linkSince = 0;
  await save(); renderLinkUI(); linkStart();
  toast('Widgets PC activés', state.settings.linkCode, '🖥️', 5000);
});
$('#pcCopy').addEventListener('click', async () => {
  const url = `${WIDGETS_URL}#${state.settings.linkCode}`;
  try { await navigator.clipboard.writeText(url); toast('Lien copié', 'Colle-le dans Lively sur le PC', '📋'); }
  catch (e) { prompt('Copie ce lien :', url); }
});
$('#pcOff').addEventListener('click', async () => {
  state.settings.linkCode = null; await save(); if (link) link.close(); link = null; renderLinkUI();
});

// ---------- Toasts, son, vibration ----------
function toast(title, sub, ico = '✨', ms = 2800, actions = '') {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span class="t-ico">${ico}</span><span class="t-txt">${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</span>${actions}`;
  $('#toasts').append(t);
  const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 350); };
  setTimeout(kill, ms);
  return { el: t, kill };
}
function alarm(title, sub, id) {
  const t = toast(title, sub, '⏰', 9000, '<button data-a="done">Fait ✅</button><button class="alt" data-a="snooze">1 h</button>');
  t.el.classList.add('alarm');
  t.el.addEventListener('click', async (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (!a) return;
    t.kill();
    if (a === 'done') complete(id);
    else { C.applyAction(state, id, 'snooze', Date.now()); await save(); render(); }
  });
  haptic([200, 100, 200, 100, 300]);
  chime(true);
}
function haptic(p) { if (state.settings.sound && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} }
let actx;
function chime(alert = false) {
  if (!state.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = alert ? [880, 660, 880, 660] : [660, 880, 1320];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t0 = actx.currentTime + i * 0.11;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + 0.25);
    });
  } catch (e) {}
}

// ---------- Confettis ----------
const cv = $('#confetti'), cx = cv.getContext('2d');
let parts = [], raf = 0;
function confetti(x, y, colors) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio;
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, r: 4 + Math.random() * 6, c: colors[i % colors.length], rot: Math.random() * 6, vr: (Math.random() - .5) * .4, life: 1, shape: i % 3 });
  }
  if (!raf) raf = requestAnimationFrame(frame);
}
function frame() {
  cx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  cx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => p.life > 0 && p.y < innerHeight + 20);
  for (const p of parts) {
    p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.009;
    cx.save(); cx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5)); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.c;
    if (p.shape === 0) cx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
    else if (p.shape === 1) { cx.beginPath(); cx.arc(0, 0, p.r / 2.4, 0, Math.PI * 2); cx.fill(); }
    else { cx.beginPath(); cx.moveTo(0, -p.r / 2); cx.lineTo(p.r / 2, p.r / 2); cx.lineTo(-p.r / 2, p.r / 2); cx.fill(); }
    cx.restore();
  }
  raf = parts.length ? requestAnimationFrame(frame) : 0;
  if (!raf) cx.clearRect(0, 0, innerWidth, innerHeight);
}

// ---------- Démarrage ----------
tickClock();
setInterval(tickClock, 1000);
render();
renderNotifUI();
loadWeather();
setInterval(loadWeather, 20 * 60e3);
setInterval(rotatePunch, 8000);
await setupSW();
tick();
setInterval(tick, 30e3);
linkStart();
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); render(); pushSnap(); } });
const focusId = new URLSearchParams(location.search).get('r');
if (focusId) { history.replaceState(null, '', location.pathname); setTimeout(() => highlight(focusId), 400); }
