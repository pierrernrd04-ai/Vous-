import test from 'node:test';
import assert from 'node:assert/strict';
import { newCard, review, dueCards, mastery, dueLabel, STEPS } from '../public/encre/js/memory.js';

const now = new Date('2026-10-29T10:00:00Z');
const DAY = 86_400_000;

test('une nouvelle carte est à revoir tout de suite', () => {
  const c = newCard({ id: 'c1', text: 'Ce qui est encré reste ancré', pageId: 'p', now });
  assert.equal(dueCards([c], now).length, 1);
  assert.equal(mastery(c), 0);
});

test('chaque réussite allonge l’intervalle', () => {
  let c = newCard({ id: 'c1', text: 't', pageId: 'p', now });
  let t = now;
  for (const days of STEPS) {
    c = review(c, true, t);
    assert.equal(new Date(c.due) - t, days * DAY);
    t = new Date(c.due);
  }
  c = review(c, true, t);
  assert.equal(new Date(c.due) - t, STEPS.at(-1) * DAY);
  assert.equal(mastery(c), 1);
});

test('un oubli remet la carte au début, dans dix minutes', () => {
  let c = review(review(newCard({ id: 'c1', text: 't', pageId: 'p', now }), true, now), true, now);
  c = review(c, false, now);
  assert.equal(c.step, -1);
  assert.equal(c.lapses, 1);
  assert.equal(new Date(c.due) - now, 10 * 60_000);
});

test('libellé d’échéance', () => {
  const c = review(newCard({ id: 'c1', text: 't', pageId: 'p', now }), true, now);
  assert.equal(dueLabel(c, now), 'demain');
  assert.equal(dueLabel({ due: now.toISOString() }, now), 'aujourd’hui');
  assert.equal(dueLabel({ due: new Date(now.getTime() + 7 * DAY).toISOString() }, now), 'dans 7 j');
});
