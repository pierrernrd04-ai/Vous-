/**
 * Export agenda `.ics` du plan (RFC 5545). Fonctions pures, testées.
 *
 * - Un événement « journée entière » par séance (`DTSTART;VALUE=DATE`, `DTEND` = lendemain).
 * - UID stable : dérivé de la date et du type de séance (pas de l'heure d'export),
 *   donc réimporter le plan met à jour les événements au lieu de les dupliquer.
 * - Fins de ligne `\r\n`, échappement des TEXT (`\\`, `;`, `,`, retours à la ligne),
 *   lignes repliées à 75 octets sans couper un caractère UTF-8.
 */
import { config } from '../config';
import type { Plan, Session, Week } from '../shared/api-types';
import { addDaysIso, formatKm, formatMinutes, formatPace, parseIsoDate } from './format';
import { PHASE_LABELS, SESSION_TYPE_LABELS } from './labels';
import { loopUrl } from './links';

export const ICS_CRLF = '\r\n';
export const ICS_MAX_LINE_OCTETS = 75;

const encoder = new TextEncoder();

function octets(text: string): number {
  return encoder.encode(text).length;
}

/** Échappement d'une valeur TEXT (RFC 5545 §3.3.11). */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Repli d'une ligne de contenu (RFC 5545 §3.1) : chaque ligne physique fait au plus
 * 75 octets (espace de continuation compris), sans couper une séquence UTF-8.
 */
export function foldIcsLine(line: string): string {
  if (octets(line) <= ICS_MAX_LINE_OCTETS) return line;
  const chunks: string[] = [];
  let current = '';
  let currentOctets = 0;
  let limit = ICS_MAX_LINE_OCTETS;
  for (const char of line) {
    const size = octets(char);
    if (currentOctets + size > limit) {
      chunks.push(current);
      current = '';
      currentOctets = 0;
      limit = ICS_MAX_LINE_OCTETS - 1; // la ligne suivante commence par une espace
    }
    current += char;
    currentOctets += size;
  }
  chunks.push(current);
  return chunks.join(`${ICS_CRLF} `);
}

/** Inverse du repli (utile pour les tests et la relecture). */
export function unfoldIcs(text: string): string {
  return text.replace(/\r\n[ \t]/g, '');
}

/** `2026-10-19` → `20261019` */
export function icsDate(iso: string): string {
  if (!parseIsoDate(iso)) throw new RangeError(`Date ISO invalide : ${iso}`);
  return iso.replaceAll('-', '');
}

/** Instant → `20261014T100000Z` (UTC). */
export function icsUtcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export interface IcsOptions {
  /** Horodatage `DTSTAMP` (défaut : maintenant). */
  now?: Date;
  /** Base du lien « Générer ma boucle » (défaut : config.traceoAppUrl). */
  appUrl?: string;
  /** Domaine des UID (défaut : hôte de config.siteUrl). */
  domain?: string;
}

function defaultDomain(): string {
  try {
    return new URL(config.siteUrl).hostname || 'traceo-pass';
  } catch {
    return 'traceo-pass';
  }
}

function raceTitle(plan: Plan): string {
  return plan.input.raceName?.trim() || (plan.input.race === 'semi' ? 'Semi-marathon' : 'Marathon');
}

function sessionSummary(plan: Plan, session: Session): string {
  if (session.type === 'course') return `Jour J · ${raceTitle(plan)} · ${formatKm(session.km)}`;
  return `${session.title} · ${formatKm(session.km)}`;
}

function sessionDescription(week: Week, session: Session, appUrl: string): string {
  const lines: string[] = [];
  lines.push(`Semaine ${week.index} · ${PHASE_LABELS[week.phase] ?? week.phase}${week.deload ? ' (allégée)' : ''}`);
  const facts = [SESSION_TYPE_LABELS[session.type] ?? session.type, formatKm(session.km)];
  if (session.durationMin > 0) facts.push(`environ ${formatMinutes(session.durationMin)}`);
  lines.push(facts.join(' · '));
  if (session.paces.length > 0) {
    lines.push(`Allures : ${session.paces.map((p) => `${p.label} ${formatPace(p.secPerKm)}`).join(' · ')}`);
  }
  for (const step of session.steps) lines.push(`• ${step}`);
  if (session.loopKm !== null) {
    lines.push(`Générer ma boucle de ${formatKm(session.loopKm)} : ${loopUrl(session.loopKm, appUrl)}`);
  }
  lines.push(
    'Programme généré automatiquement. En cas de douleur, de malaise ou de doute, arrête-toi et consulte un médecin.',
  );
  return lines.join('\n');
}

/** Nom de fichier proposé au téléchargement. */
export function icsFilename(plan: Plan): string {
  return `pass-j24-${plan.input.race}-${plan.input.raceDate}.ics`;
}

/** Calendrier complet du plan, prêt à télécharger (`text/calendar`). */
export function buildPlanIcs(plan: Plan, options: IcsOptions = {}): string {
  const stamp = icsUtcStamp(options.now ?? new Date());
  const appUrl = options.appUrl ?? config.traceoAppUrl;
  const domain = options.domain ?? defaultDomain();
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Traceo//Pass J-24//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`Pass J-24 · ${raceTitle(plan)}`)}`,
  ];

  const seen = new Map<string, number>();
  for (const week of plan.weeks) {
    for (const session of week.sessions) {
      const base = `j24-${session.date}-${session.type}`;
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      const uid = `${base}${count > 1 ? `-${count}` : ''}@${domain}`;
      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDate(session.date)}`,
        `DTEND;VALUE=DATE:${icsDate(addDaysIso(session.date, 1))}`,
        `SUMMARY:${escapeIcsText(sessionSummary(plan, session))}`,
        `DESCRIPTION:${escapeIcsText(sessionDescription(week, session, appUrl))}`,
      );
      if (session.loopKm !== null) lines.push(`URL:${loopUrl(session.loopKm, appUrl)}`);
      lines.push('TRANSP:TRANSPARENT', 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join(ICS_CRLF) + ICS_CRLF;
}
