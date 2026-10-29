// Pont avec Do It : les notes vocales vivent dans la base de Do It, sur le même site.
// Encré les lit, en enregistre de nouvelles (même format que Do It, donc visibles
// dans les deux applis), peut les modifier ou en faire une page.
import { loadEntries, saveEntry, getValue as getDoItValue, setValue as setDoItValue } from '../../js/store.js';
import { getTheme, getMood, resolveTheme } from '../../js/themes.js';
import { writeEntry, aiStatus, isRetryable } from '../../js/ai.js';
import { esc, uid, momentLabel } from '../../js/format.js';

// Dans Encré, une note vocale est résumée de façon professionnelle et synthétique.
export const NOTE_STYLE = 'synthese';

export async function loadVoiceNotes() {
  const entries = await loadEntries();
  return entries.filter((e) => e && e.text).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function loadVoiceThemes() {
  return getDoItValue('customThemes', []);
}

/** Enregistre une note modifiée dans Encré : Do It ne la réécrira plus par-dessus. */
export async function saveVoiceNote(entry, { title, text }) {
  const updated = { ...entry, title, text, edited: true, pending: false, updatedAt: new Date().toISOString() };
  await saveEntry(updated);
  return updated;
}

export function themeOf(id, customThemes) {
  return getTheme(id, customThemes);
}

export function moodOf(id) {
  return getMood(id);
}

/** Nouvelle note vocale, au format des entrées de Do It. */
export function newVoiceEntry(segment) {
  const now = new Date().toISOString();
  return {
    id: uid(), createdAt: now, updatedAt: now, segments: [segment],
    title: '', text: '', summary: '', highlights: [], themes: [], mood: 'neutre', followUp: '',
    source: null, reason: null, pending: false, edited: false, style: NOTE_STYLE, origin: 'encre',
  };
}

/**
 * Fait écrire la note par l'IA (repli local si elle ne répond pas), range ses thèmes
 * (les nouveaux thèmes sont partagés avec Do It) et l'enregistre.
 * Renvoie `{ entry, source, reason }`.
 */
export async function writeVoiceNote(entry) {
  const [customThemes, settings] = await Promise.all([loadVoiceThemes(), getDoItValue('settings', {})]);
  const res = await writeEntry({
    segments: entry.segments,
    style: NOTE_STYLE,
    customThemes,
    accessCode: settings?.accessCode || '',
    when: momentLabel(new Date(entry.segments.at(-1)?.at || entry.createdAt)),
  });

  const ids = [];
  let themesChanged = false;
  for (const proposal of res.entry.themes || []) {
    const r = resolveTheme(proposal, customThemes);
    if (!r) continue;
    if (r.isNew) {
      customThemes.push(r.theme);
      themesChanged = true;
    }
    if (!ids.includes(r.id)) ids.push(r.id);
  }
  if (themesChanged) await setDoItValue('customThemes', customThemes);

  Object.assign(entry, {
    title: res.entry.title,
    text: res.entry.text,
    summary: res.entry.summary,
    highlights: res.entry.highlights || [],
    themes: ids.length ? ids : ['quotidien'],
    mood: res.entry.mood,
    followUp: res.entry.followUp,
    source: res.source,
    reason: res.reason || null,
    pending: res.source === 'local' && isRetryable(res.reason),
    edited: false,
    style: NOTE_STYLE,
    updatedAt: new Date().toISOString(),
  });
  await saveEntry(structuredClone(entry));
  return { entry, source: res.source, reason: res.reason, customThemes };
}

/** Notes écrites hors IA (hors-ligne, IA indisponible) : réécrites dès que l'IA répond. */
export async function retryPendingNotes(notes, onUpdated = () => {}) {
  const todo = notes.filter((n) => n.pending && !n.edited);
  if (!todo.length || navigator.onLine === false) return 0;
  const settings = await getDoItValue('settings', {});
  const status = await aiStatus(settings?.accessCode || '');
  if (!status?.ai || (status.needsCode && !status.authorized)) return 0;
  let done = 0;
  for (const note of todo) {
    const res = await writeVoiceNote(note);
    if (res.source !== 'ai') break;
    done += 1;
    onUpdated(note);
  }
  return done;
}

/** Contenu d'une page créée à partir d'une note vocale. */
export function noteToHtml(entry) {
  const paras = String(entry.text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');
  const points = entry.highlights?.length
    ? `<h3>Points clés</h3><ul>${entry.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>`
    : '';
  const followUp = entry.followUp ? `<div class="callout">${esc(entry.followUp)}</div>` : '';
  return `${paras}${points}${followUp}` || '<p><br></p>';
}

/** Bloc à ajouter à la fin d'une page existante. */
export function noteToSection(entry) {
  const paras = String(entry.text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');
  const points = entry.highlights?.length ? `<ul>${entry.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : '';
  return `<hr><h2>${esc(entry.title || 'Note vocale')}</h2>${paras}${points}`;
}
