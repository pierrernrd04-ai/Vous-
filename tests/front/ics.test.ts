/**
 * Export agenda .ics (src/lib/ics.ts) : RFC 5545 — fins de ligne CRLF, échappement
 * des TEXT, lignes repliées à 75 octets sans couper l'UTF-8, événements journée
 * entière, UID stables.
 */
import { describe, expect, it } from 'vitest';
import { generatePlan } from '../../src/engine/index';
import {
  ICS_CRLF,
  ICS_MAX_LINE_OCTETS,
  buildPlanIcs,
  escapeIcsText,
  foldIcsLine,
  icsDate,
  icsFilename,
  icsUtcStamp,
  unfoldIcs,
} from '../../src/lib/ics';
import type { Plan, Session } from '../../src/shared/api-types';

/** Espace insécable de `formatKm` (« 8,5 km »). */
const NB = '\u00a0';
const encoder = new TextEncoder();
const octets = (text: string) => encoder.encode(text).length;

const APP = 'https://traceorun.pages.dev/app';
const NOW = new Date('2026-10-14T08:30:00Z');

function session(overrides: Partial<Session> & Pick<Session, 'date' | 'dow' | 'type'>): Session {
  return {
    title: 'Endurance fondamentale',
    km: 8,
    durationMin: 50,
    paces: [{ label: 'EF', secPerKm: 375 }],
    steps: ['Échauffement 10 min, puis course à l’aise, sans forcer'],
    loopKm: 8,
    ...overrides,
  };
}

/** Petit plan écrit à la main : contrôles exacts. */
const FIXTURE: Plan = {
  input: {
    race: 'semi',
    raceDate: '2027-03-07',
    raceName: 'Semi de Paris',
    level: 'l2',
    t10: 3000,
    weeklyKm: 25,
    sessions: 3,
    longRunDay: 'sun',
  },
  weeks: [
    {
      index: 1,
      start: '2026-10-19',
      end: '2026-10-25',
      phase: 'base',
      deload: false,
      km: 26,
      sessions: [
        session({ date: '2026-10-20', dow: 'tue', type: 'ef', title: 'Footing, lignes droites', km: 7, loopKm: 7 }),
        session({
          date: '2026-10-22',
          dow: 'thu',
          type: 'qualite',
          title: 'Fartlek; 8 × 1 min',
          km: 8.5,
          loopKm: 8.5,
          steps: ['15 min EF', '8 × (1 min vite, 1 min lent)', 'Retour au calme\nfacile'],
        }),
        session({ date: '2026-10-25', dow: 'sun', type: 'sl', title: 'Sortie longue', km: 11, durationMin: 75, loopKm: 11 }),
      ],
    },
    {
      index: 2,
      start: '2027-03-01',
      end: '2027-03-07',
      phase: 'affutage',
      deload: false,
      km: 30,
      sessions: [
        session({ date: '2027-03-07', dow: 'sun', type: 'course', title: 'Semi de Paris', km: 21.1, paces: [], steps: [], loopKm: null }),
      ],
    },
  ],
  paces: { ef: 375, seuil: 290, as10: 300, allure_course: 320, recup: 405 },
  predicted: { raceSec: 6630 },
  totalKm: 56,
};

function physicalLines(ics: string): string[] {
  return ics.split(ICS_CRLF).slice(0, -1);
}

function events(ics: string): string[] {
  return unfoldIcs(ics).split('BEGIN:VEVENT').slice(1);
}

describe('escapeIcsText', () => {
  it('échappe antislash, point-virgule, virgule et retours à la ligne', () => {
    expect(escapeIcsText('a\\b;c,d\ne\r\nf\rg')).toBe('a\\\\b\\;c\\,d\\ne\\nf\\ng');
  });

  it('laisse le reste intact (accents, deux-points, guillemets)', () => {
    expect(escapeIcsText('Allure : 5:30/km « EF » ’')).toBe('Allure : 5:30/km « EF » ’');
  });
});

describe('foldIcsLine', () => {
  it('ne touche pas une ligne de 75 octets ou moins', () => {
    const line = `SUMMARY:${'x'.repeat(75 - 'SUMMARY:'.length)}`;
    expect(octets(line)).toBe(75);
    expect(foldIcsLine(line)).toBe(line);
  });

  it('replie une longue ligne en lignes de 75 octets au plus, espace de continuation compris', () => {
    const line = `DESCRIPTION:${'abcdefghij'.repeat(30)}`;
    const folded = foldIcsLine(line);
    const parts = folded.split(ICS_CRLF);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.slice(1).every((p) => p.startsWith(' '))).toBe(true);
    for (const part of parts) expect(octets(part)).toBeLessThanOrEqual(ICS_MAX_LINE_OCTETS);
    expect(octets(parts[0] ?? '')).toBe(ICS_MAX_LINE_OCTETS);
    expect(unfoldIcs(folded)).toBe(line);
  });

  it('ne coupe jamais un caractère UTF-8 multi-octets', () => {
    const line = `DESCRIPTION:${'é’🏃'.repeat(40)}`;
    const folded = foldIcsLine(line);
    for (const part of folded.split(ICS_CRLF)) {
      expect(octets(part)).toBeLessThanOrEqual(ICS_MAX_LINE_OCTETS);
      // Un découpage au milieu d'une séquence produirait U+FFFD au décodage.
      expect(new TextDecoder('utf-8', { fatal: true }).decode(encoder.encode(part))).toBe(part);
    }
    expect(unfoldIcs(folded)).toBe(line);
  });
});

describe('dates', () => {
  it('icsDate convertit une date ISO et refuse une date invalide', () => {
    expect(icsDate('2026-10-19')).toBe('20261019');
    expect(() => icsDate('2026-02-30')).toThrow(RangeError);
    expect(() => icsDate('19/10/2026')).toThrow(RangeError);
  });

  it('icsUtcStamp donne un horodatage UTC sans millisecondes', () => {
    expect(icsUtcStamp(new Date('2026-10-14T08:30:05.123Z'))).toBe('20261014T083005Z');
  });
});

describe('buildPlanIcs (plan écrit à la main)', () => {
  const ics = buildPlanIcs(FIXTURE, { now: NOW, appUrl: APP, domain: 'pass.test' });

  it('est un VCALENDAR complet, en CRLF uniquement, terminé par CRLF', () => {
    expect(ics.startsWith(`BEGIN:VCALENDAR${ICS_CRLF}VERSION:2.0${ICS_CRLF}`)).toBe(true);
    expect(ics.endsWith(`END:VCALENDAR${ICS_CRLF}`)).toBe(true);
    expect(ics.replaceAll(ICS_CRLF, '')).not.toMatch(/[\r\n]/);
    expect(ics).toContain('PRODID:-//Traceo//Pass J-24//FR');
  });

  it('a des lignes physiques de 75 octets au plus', () => {
    for (const line of physicalLines(ics)) expect(octets(line)).toBeLessThanOrEqual(ICS_MAX_LINE_OCTETS);
  });

  it('crée un événement journée entière par séance', () => {
    const list = events(ics);
    expect(list).toHaveLength(4);
    const first = list[0] ?? '';
    expect(first).toContain(`DTSTART;VALUE=DATE:20261020${ICS_CRLF}`);
    expect(first).toContain(`DTEND;VALUE=DATE:20261021${ICS_CRLF}`);
    expect(first).toContain(`DTSTAMP:20261014T083000Z${ICS_CRLF}`);
    expect(first).toContain('TRANSP:TRANSPARENT');
    // Fin de mois : le lendemain du 31 est bien le 1er.
    const race = list[3] ?? '';
    expect(race).toContain('DTSTART;VALUE=DATE:20270307');
    expect(race).toContain('DTEND;VALUE=DATE:20270308');
  });

  it('échappe les textes (point-virgule, virgule, retour à la ligne)', () => {
    const quality = events(ics)[1] ?? '';
    expect(quality).toContain(`SUMMARY:Fartlek\\; 8 × 1 min · 8\\,5${NB}km`);
    expect(quality).toContain('Retour au calme\\nfacile');
    expect(quality).not.toMatch(/DESCRIPTION:[^\r]*[^\\][;,]/);
  });

  it('ajoute le lien de boucle aux séances qui en ont une, pas à la course', () => {
    const [ef, quality, , race] = events(ics);
    expect(ef).toContain(`URL:${APP}?km=7${ICS_CRLF}`);
    expect(quality).toContain(`URL:${APP}?km=8.5${ICS_CRLF}`);
    expect(quality).toContain(`Générer ma boucle de 8\\,5${NB}km : ${APP}?km=8.5`);
    expect(race).not.toContain('URL:');
    expect(race).toContain(`SUMMARY:Jour J · Semi de Paris · 21\\,1${NB}km`);
  });

  it('a des UID uniques et stables d’un export à l’autre', () => {
    const uids = (text: string) => events(text).map((e) => /UID:([^\r]+)/.exec(e)?.[1]);
    const again = buildPlanIcs(FIXTURE, { now: new Date('2027-01-01T00:00:00Z'), appUrl: APP, domain: 'pass.test' });
    const first = uids(ics);
    expect(new Set(first).size).toBe(first.length);
    expect(uids(again)).toEqual(first);
    expect(first[0]).toBe('j24-2026-10-20-ef@pass.test');
  });

  it('rappelle l’avertissement santé dans chaque description', () => {
    for (const event of events(ics)) expect(event).toContain('consulte un médecin');
  });

  it('propose un nom de fichier parlant', () => {
    expect(icsFilename(FIXTURE)).toBe('pass-j24-semi-2027-03-07.ics');
  });
});

describe('buildPlanIcs (plan complet du moteur)', () => {
  const plan = generatePlan(
    {
      race: 'marathon',
      raceDate: '2027-04-04',
      raceName: 'Marathon de Paris',
      level: 'l2',
      t10: 3000,
      weeklyKm: 30,
      sessions: 5,
      longRunDay: 'sun',
    },
    '2026-10-14',
  );
  const ics = buildPlanIcs(plan, { now: NOW });
  const sessionCount = plan.weeks.reduce((n, w) => n + w.sessions.length, 0);

  it('respecte les règles de forme sur 24 semaines', () => {
    expect(plan.weeks).toHaveLength(24);
    for (const line of physicalLines(ics)) expect(octets(line)).toBeLessThanOrEqual(ICS_MAX_LINE_OCTETS);
    expect(ics.replaceAll(ICS_CRLF, '')).not.toMatch(/[\r\n]/);
  });

  it('exporte toutes les séances avec des UID uniques', () => {
    const list = events(ics);
    expect(list).toHaveLength(sessionCount);
    const uids = list.map((e) => /UID:([^\r]+)/.exec(e)?.[1]);
    expect(new Set(uids).size).toBe(sessionCount);
  });

  it('termine par la course, le jour J', () => {
    const last = events(ics).at(-1) ?? '';
    expect(last).toContain('DTSTART;VALUE=DATE:20270404');
    expect(last).toContain('SUMMARY:Jour J · Marathon de Paris');
  });
});
