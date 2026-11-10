// Code commun à la page et au service worker (script classique : importScripts dans sw.js, <script> dans la page).
(function (root) {
  const HOUR = 3600e3;

  const CATS = [
    { id: 'sport', name: 'Sport', emo: '🏋️', color: '#39ff88', on: '#0b1633', sub: 'Bouge, transpire, kiffe.' },
    { id: 'alcool', name: 'Alcool', emo: '🍷', color: '#ff2e93', on: '#ffffff', sub: 'Garder le contrôle, verre après verre.' },
    { id: 'food', name: 'Nourriture', emo: '🥗', color: '#b8ff3d', on: '#0b1633', sub: 'Bien manger, c’est bien vivre.' },
    { id: 'courses', name: 'Courses', emo: '🛒', color: '#7fd3ff', on: '#0b1633', sub: 'Le frigo ne va pas se remplir tout seul.' },
    { id: 'prod', name: 'Productivité', emo: '⚡', color: '#2f7bff', on: '#ffffff', sub: 'Une tâche. Puis la suivante.' },
    { id: 'famille', name: 'Famille', emo: '💞', color: '#ff7ac0', on: '#0b1633', sub: 'Ceux qui comptent vraiment.' },
  ];
  const catById = (id) => CATS.find((c) => c.id === id) || CATS[4];

  // ---------- IndexedDB clé/valeur ----------
  let dbp;
  function db() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open('dant-procrastiner', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbp;
  }
  async function get(key) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const r = d.transaction('kv').objectStore('kv').get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function set(key, value) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------- Règles de relance ----------
  // Base d'un rappel : son échéance, ou la fin du report « dans 1 h ».
  const baseOf = (r) => Math.max(r.due, r.snoozeUntil || 0);

  function inQuiet(settings, now) {
    if (!settings || !settings.quiet) return false;
    const h = new Date(now).getHours();
    const s = settings.quietStart, e = settings.quietEnd;
    return s === e ? false : s < e ? h >= s && h < e : h >= s || h < e;
  }

  // Renvoie les rappels à notifier maintenant : à l'échéance, puis toutes les heures tant que ce n'est pas fait.
  function dueNow(state, nags, now) {
    if (inQuiet(state.settings, now)) return [];
    const out = [];
    for (const r of state.reminders || []) {
      if (r.done) continue;
      const base = baseOf(r);
      if (now < base) continue;
      const n = nags[r.id];
      const fresh = !n || n.base !== base;
      if (fresh || (r.nag && now - n.at >= HOUR - 60e3)) {
        out.push({ r, count: fresh ? 1 : n.count + 1 });
      }
    }
    return out;
  }

  const LINES = {
    sport: ['Tes baskets t’attendent. Elles commencent à se vexer.', 'Dix minutes suffisent pour commencer. Go !', 'Ton futur toi te dit merci d’avance.'],
    alcool: ['Un verre d’eau, maintenant. Ton foie t’applaudit.', 'Tu gères. Garde le cap.', 'Ce soir, c’est toi qui décides, pas le verre.'],
    food: ['Un vrai repas, pas un paquet de chips.', 'Ton corps mérite mieux qu’un sandwich debout.', 'Prépare-le maintenant, tu seras content ce soir.'],
    courses: ['Le frigo résonne quand on parle dedans.', 'Liste en main, cinq minutes et c’est plié.', 'Courses faites = semaine sereine.'],
    prod: ['Juste 5 minutes. Le reste suivra.', 'Le plus dur, c’est d’ouvrir le fichier.', 'Fais-le maintenant, savoure après.'],
    famille: ['Un appel de 3 minutes peut illuminer leur journée.', 'Ils pensent à toi. Fais-leur signe.', 'Les gens qu’on aime, on ne les remet pas à demain.'],
  };

  function message(r, count) {
    const cat = catById(r.cat);
    const lines = LINES[cat.id] || LINES.prod;
    const line = lines[(count - 1) % lines.length];
    let title;
    if (count === 1) title = `${cat.emo} C’est l’heure : ${r.title}`;
    else if (count === 2) title = `😤 Toujours pas fait ? ${r.title}`;
    else if (count === 3) title = `⏰ 3e relance : ${r.title}`;
    else title = `🔥 ${count - 1} h de retard : ${r.title}`;
    const tail = count === 1 ? 'Dan’t procrastiner !' : count < 4 ? 'Pas dans une heure. Maintenant.' : 'On avait dit : dan’t procrastiner. 😏';
    return { title, body: `${line}\n${tail}` };
  }

  // Avance un rappel récurrent à sa prochaine échéance future.
  function nextDue(r, now) {
    const step = r.repeat === 'weekly' ? 7 : 1;
    const d = new Date(r.due);
    do d.setDate(d.getDate() + step); while (d.getTime() <= now);
    return d.getTime();
  }

  // Applique « fait » ou « dans 1 h » à l'état (utilisé par la page et par le SW quand la page est fermée).
  function applyAction(state, id, action, now) {
    const r = (state.reminders || []).find((x) => x.id === id);
    if (!r) return null;
    if (action === 'done') {
      const key = dayKey(now);
      state.history = state.history || {};
      state.history[key] = (state.history[key] || 0) + 1;
      if (r.repeat && r.repeat !== 'none') { r.due = nextDue(r, now); r.snoozeUntil = 0; r.lastDone = now; }
      else { r.done = true; r.doneAt = now; }
    } else if (action === 'snooze') {
      r.snoozeUntil = now + HOUR;
    }
    return r;
  }

  function dayKey(t) {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Une passe de vérification : notifie ce qui est dû et retient l'heure de chaque relance.
  let running = null;
  function check(show) {
    if (running) return running;
    running = (async () => {
      const now = Date.now();
      const state = await get('state');
      if (!state) return [];
      const nags = (await get('nags')) || {};
      const due = dueNow(state, nags, now);
      for (const { r, count } of due) {
        await show(r, count, message(r, count));
        nags[r.id] = { base: baseOf(r), at: now, count };
      }
      // oublie les rappels supprimés
      const ids = new Set(state.reminders.map((r) => r.id));
      for (const id of Object.keys(nags)) if (!ids.has(id)) delete nags[id];
      await set('nags', nags);
      return due;
    })().finally(() => { running = null; });
    return running;
  }

  root.DantCore = { HOUR, CATS, catById, get, set, baseOf, inQuiet, dueNow, message, nextDue, applyAction, dayKey, check };
})(typeof self !== 'undefined' ? self : this);
