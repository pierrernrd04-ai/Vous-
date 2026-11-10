// Mémoire : révision espacée des passages surlignés « à retenir ».
// Chaque bonne réponse allonge l'intervalle ; un oubli le remet au début.

export const STEPS = [1, 3, 7, 16, 35, 90]; // jours

const DAY = 86_400_000;

export function newCard({ id, text, pageId, now = new Date() }) {
  return { id, text, pageId, createdAt: now.toISOString(), due: now.toISOString(), step: -1, reps: 0, lapses: 0 };
}

/** Carte mise à jour après une révision. */
export function review(card, remembered, now = new Date()) {
  if (remembered) {
    const step = Math.min(card.step + 1, STEPS.length - 1);
    return { ...card, step, reps: card.reps + 1, due: new Date(now.getTime() + STEPS[step] * DAY).toISOString(), lastReview: now.toISOString() };
  }
  // À revoir : dans dix minutes, et l'intervalle repart de zéro.
  return { ...card, step: -1, lapses: card.lapses + 1, due: new Date(now.getTime() + 10 * 60_000).toISOString(), lastReview: now.toISOString() };
}

export function dueCards(cards, now = new Date()) {
  return cards.filter((c) => new Date(c.due) <= now).sort((a, b) => a.due.localeCompare(b.due));
}

/** Niveau de maîtrise de 0 à 1, pour la jauge. */
export function mastery(card) {
  return Math.max(0, card.step + 1) / STEPS.length;
}

/** « dans 3 j », « demain », « aujourd'hui ». */
export function dueLabel(card, now = new Date()) {
  const days = Math.round((new Date(card.due) - now) / DAY);
  if (days <= 0) return 'aujourd’hui';
  if (days === 1) return 'demain';
  return `dans ${days} j`;
}
