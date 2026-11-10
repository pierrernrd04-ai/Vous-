// Dates, durées et petits utilitaires d'affichage, en français.

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const dayYearFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const shortFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Clé de jour locale « 2026-10-29 ». */
export function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** « Aujourd'hui », « Hier » ou « Lundi 27 octobre » (avec l'année si ce n'est pas l'année en cours). */
export function dayLabel(date, now = new Date()) {
  const key = dayKey(date);
  if (key === dayKey(now)) return 'Aujourd\'hui';
  if (key === dayKey(addDays(now, -1))) return 'Hier';
  const d = new Date(date);
  return cap((d.getFullYear() === now.getFullYear() ? dayFmt : dayYearFmt).format(d));
}

export function longDate(date) {
  return cap(dayYearFmt.format(new Date(date)));
}

export function todayLabel(now = new Date()) {
  return cap(dayFmt.format(now));
}

export function timeLabel(date) {
  return timeFmt.format(new Date(date)).replace(':', 'h');
}

export function shortDate(date) {
  return shortFmt.format(new Date(date));
}

/** « il y a 3 j », « il y a 2 h »… */
export function ago(date, now = Date.now()) {
  const s = Math.max(0, (now - new Date(date).getTime()) / 1000);
  if (s < 60) return 'à l\'instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 30) return `il y a ${Math.floor(s / 86400)} j`;
  return `le ${shortDate(date)}`;
}

export function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return 'Belle nuit';
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

/** Moment lisible envoyé à l'IA : « mercredi 29 octobre 2026, 21h14 ». */
export function momentLabel(date = new Date()) {
  return `${dayYearFmt.format(date)}, ${timeLabel(date)}`;
}

export function wordCount(text) {
  return (String(text || '').match(/[\p{L}\p{N}'’-]+/gu) || []).length;
}

export function plural(n, one, many = `${one}s`) {
  return `${n.toLocaleString('fr-FR')} ${n > 1 ? many : one}`;
}

/** Typographie française : apostrophe courbe, espace fine avant ? ! : ; et dans les guillemets. */
export function typo(value) {
  return String(value ?? '')
    .replace(/(\p{L})'(?=\p{L})/gu, '$1’')
    .replace(/[ \u00a0]([?!:;»])/g, '\u202f$1')
    .replace(/«[ \u00a0]/g, '«\u202f');
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Valeur brute échappée (champs de saisie, attributs techniques). */
export function attr(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

/** Texte affiché : typographie soignée puis échappement. */
export function esc(value) {
  return attr(typo(value));
}

/** Paragraphes HTML échappés. */
export function paragraphs(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function uid() {
  return (crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
}
