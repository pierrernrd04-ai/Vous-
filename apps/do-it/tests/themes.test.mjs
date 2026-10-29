import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTheme, slugify, getTheme, THEMES } from '../public/js/themes.js';

test('ids du catalogue uniques', () => {
  assert.equal(new Set(THEMES.map((t) => t.id)).size, THEMES.length);
});

test('rattache un thème proposé au catalogue par id ou libellé', () => {
  assert.equal(resolveTheme({ id: 'sport', label: 'Sport', emoji: '🏃' }).id, 'sport');
  assert.equal(resolveTheme({ id: 'humeurs', label: 'Humeurs', emoji: '🙂' }).id, 'humeur');
  assert.equal(resolveTheme({ id: 'Santé', label: 'santé', emoji: '🩺' }).id, 'sante');
});

test('crée un thème personnel puis le réutilise', () => {
  const first = resolveTheme({ id: 'bricolage', label: 'bricolage', emoji: '🔨' });
  assert.equal(first.isNew, true);
  assert.equal(first.theme.label, 'Bricolage');
  const again = resolveTheme({ id: 'Bricolage', label: 'Bricolage', emoji: '🪛' }, [first.theme]);
  assert.equal(again.isNew, false);
  assert.equal(again.id, 'bricolage');
});

test('slugify et thème inconnu', () => {
  assert.equal(slugify('Vie de Château !'), 'vie-de-chateau');
  assert.equal(getTheme('inconnu').emoji, '🏷️');
});
