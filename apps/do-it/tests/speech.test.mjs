import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeResults, joinText } from '../public/js/speech.js';

test('ajoute les résultats successifs', () => {
  assert.equal(mergeResults(['bonjour', 'je suis là']), 'bonjour je suis là');
});

test('résultats cumulés (Chrome Android) : pas de doublon', () => {
  assert.equal(mergeResults(['je suis', 'je suis allé', 'je suis allé courir']), 'je suis allé courir');
});

test('ignore un résultat déjà contenu à la fin', () => {
  assert.equal(mergeResults(['je suis allé courir', 'courir']), 'je suis allé courir');
});

test('joinText ignore les morceaux vides', () => {
  assert.equal(joinText(' a ', '', null, 'b'), 'a b');
});
