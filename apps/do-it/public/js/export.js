// Export du journal (Markdown lisible, JSON de sauvegarde) et import.
import { getTheme, getMood } from './themes.js';
import { dayKey, longDate, timeLabel } from './format.js';

export function toMarkdown(entries, customThemes, title = 'Do It · Journal de bord') {
  const sorted = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const lines = [`# ${title}`, '', `_Exporté le ${longDate(new Date())} · ${sorted.length} entrée${sorted.length > 1 ? 's' : ''}_`, ''];
  let currentDay = '';
  for (const e of sorted) {
    const key = dayKey(e.createdAt);
    if (key !== currentDay) {
      currentDay = key;
      lines.push(`## ${longDate(e.createdAt)}`, '');
    }
    const themes = (e.themes || []).map((id) => {
      const t = getTheme(id, customThemes);
      return `${t.emoji} ${t.label}`;
    });
    const mood = getMood(e.mood);
    lines.push(`### ${timeLabel(e.createdAt)} · ${e.title || 'Sans titre'}`, '');
    lines.push(`*${themes.join(' · ')} — humeur : ${mood.emoji} ${mood.label.toLowerCase()}*`, '');
    lines.push(e.text || '', '');
    if (e.highlights?.length) {
      lines.push(...e.highlights.map((h) => `- ${h}`), '');
    }
  }
  return lines.join('\n');
}

export function toBackup(entries, customThemes, settings) {
  const { accessCode, ...shareable } = settings || {};
  return JSON.stringify({ app: 'do-it', version: 1, exportedAt: new Date().toISOString(), settings: shareable, customThemes, entries }, null, 2);
}

/** Lit une sauvegarde JSON ; lève une erreur lisible si le fichier ne convient pas. */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Ce fichier n’est pas une sauvegarde Do It.');
  }
  if (data?.app !== 'do-it' || !Array.isArray(data.entries)) throw new Error('Ce fichier n’est pas une sauvegarde Do It.');
  const entries = data.entries.filter((e) => e && typeof e.id === 'string' && typeof e.createdAt === 'string');
  const customThemes = Array.isArray(data.customThemes) ? data.customThemes.filter((t) => t?.id && t?.label) : [];
  return { entries, customThemes };
}

export function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
