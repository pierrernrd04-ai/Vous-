// Pont avec Do It : les notes vocales vivent dans la base de Do It, sur le même site.
// Encré les lit, peut les modifier (le journal Do It suit) ou en faire une page.
import { loadEntries, saveEntry, getValue as getDoItValue } from '../../js/store.js';
import { getTheme, getMood } from '../../js/themes.js';
import { esc } from '../../js/format.js';

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
