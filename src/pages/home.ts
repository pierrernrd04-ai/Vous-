/**
 * Page d'accueil (/) : prix et compte à rebours (bascule seule à 29 €), boutons
 * d'achat, jour 1, graphique indicatif des phases, données structurées
 * (Product + Offer, FAQPage).
 */
import { KEY_DATES, config } from '../config';
import type { Phase } from '../shared/api-types';
import { bootPage } from '../lib/boot';
import { qs, qsa } from '../lib/dom';
import { addDaysIso, daysBetween, formatDateLong, localTodayIso, parseIsoDate } from '../lib/format';
import { renderPhaseChart } from '../lib/plan-view';
import { priceInfo } from '../lib/price';

bootPage();

/* ---------- Jour 1 ---------- */
function nextMonday(todayIso: string): string {
  const date = parseIsoDate(todayIso);
  if (!date) return todayIso;
  const dow = date.getUTCDay(); // 0 = dimanche
  const delta = dow === 1 ? 0 : (8 - dow) % 7;
  return addDaysIso(todayIso, delta);
}

function renderDayOne(): void {
  const box = qs('#day1');
  const left = qs('[data-day1-left]');
  if (!box || !left) return;
  const today = localTodayIso();
  const days = daysBetween(today, KEY_DATES.planStart);
  if (days > 1) left.textContent = `(dans ${days} jours)`;
  else if (days === 1) left.textContent = '(demain)';
  else if (days === 0) left.textContent = '(c’est aujourd’hui !)';
  else {
    const label = box.querySelector('span');
    if (label) {
      label.textContent = `Prochain départ : ${formatDateLong(nextMonday(today), false)}, plan ajusté à ta date de course.`;
    }
  }
}

/* ---------- Graphique indicatif des phases (marathon, moins de 4 h 30) ---------- */
interface DemoWeek {
  index: number;
  start: string;
  phase: Phase;
  deload: boolean;
  km: number;
}

/** Volumes d'exemple qui suivent les règles de la SPEC (+10 % max, allègements, affûtage). */
function demoMarathonWeeks(): DemoWeek[] {
  const deloads = new Set([4, 7, 10, 14, 18]);
  const taper: Record<number, number> = { 22: 0.8, 23: 0.65, 24: 0.45 };
  const peak = 58;
  const weeks: DemoWeek[] = [];
  let last = 30;
  for (let i = 1; i <= 24; i++) {
    const phase: Phase = i <= 8 ? 'base' : i <= 16 ? 'developpement' : i <= 21 ? 'specifique' : 'affutage';
    let km: number;
    const taperRatio = taper[i];
    if (taperRatio !== undefined) km = peak * taperRatio;
    else if (deloads.has(i)) km = last * 0.72;
    else {
      km = i === 1 ? last : Math.min(peak, last * 1.1);
      last = km;
    }
    weeks.push({
      index: i,
      start: addDaysIso(KEY_DATES.planStart, (i - 1) * 7),
      phase,
      deload: deloads.has(i),
      km: Math.round(km),
    });
  }
  return weeks;
}

function renderPhases(): void {
  const container = qs('#phases-chart');
  if (!container) return;
  container.replaceChildren(renderPhaseChart(demoMarathonWeeks()));
}

/* ---------- Données structurées ---------- */
function addJsonLd(data: unknown): void {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

function structuredData(): void {
  const site = config.siteUrl.replace(/\/+$/, '');
  const price = priceInfo();
  addJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Pass J-24 · Traceo',
    description:
      'Programme de préparation marathon (24 semaines) ou semi (20 semaines) généré automatiquement, daté jusqu’au jour J, avec une boucle Traceo pour chaque séance et Traceo Premium jusqu’au 5 avril 2027.',
    image: `${site}/icons/og-image.png`,
    brand: { '@type': 'Brand', name: 'Traceo' },
    offers: {
      '@type': 'Offer',
      price: price.amount.toFixed(2),
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      url: `${site}/`,
      ...(price.isLaunch ? { priceValidUntil: config.launchPriceEnd.slice(0, 10) } : {}),
    },
  });

  const questions = qsa<HTMLDetailsElement>('#faq details').map((details) => {
    const question = details.querySelector('summary')?.textContent?.trim() ?? '';
    const answer = details.querySelector('.faq__body')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return { '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } };
  });
  if (questions.length > 0) {
    addJsonLd({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: questions });
  }
}

renderDayOne();
renderPhases();
structuredData();
