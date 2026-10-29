import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, buildUserMessage, normalizeOutput, InputError, SYSTEM_PROMPT, LIMITS } from '../netlify/lib/ecrire.mts';

test('valide et nettoie la requête', () => {
  const input = validateInput({
    segments: [{ text: '  je   suis allé courir ' }, { text: '', question: 'vide' }, { text: 'super', question: ' Et après ? ' }],
    style: 'inconnu',
    customThemes: [{ id: 'Bricolage', label: 'Bricolage', emoji: '🔨' }, { id: '', label: 'x' }],
  });
  assert.deepEqual(input.segments, [{ text: 'je suis allé courir' }, { text: 'super', question: 'Et après ?' }]);
  assert.equal(input.style, 'professionnel');
  assert.deepEqual(input.customThemes, [{ id: 'bricolage', label: 'Bricolage', emoji: '🔨' }]);
});

test('refuse les requêtes vides ou trop longues', () => {
  assert.throws(() => validateInput(null), InputError);
  assert.throws(() => validateInput({ segments: [] }), InputError);
  assert.throws(() => validateInput({ segments: [{ text: '   ' }] }), InputError);
  assert.throws(() => validateInput({ segments: [{ text: 'a'.repeat(LIMITS.segmentChars + 1) }] }), InputError);
  assert.throws(() => validateInput({ segments: [{ text: 'a'.repeat(15000) }, { text: 'b'.repeat(15000) }, { text: 'c'.repeat(15000) }] }), InputError);
});

test('message utilisateur : prises numérotées avec la question posée', () => {
  const msg = buildUserMessage(validateInput({ segments: [{ text: 'un' }, { text: 'deux', question: 'Et ensuite ?' }], style: 'recit', when: 'mercredi' }));
  assert.match(msg, /Moment de l'enregistrement : mercredi/);
  assert.match(msg, /Style demandé : recit/);
  assert.match(msg, /\[Prise 2\] Question posée : « Et ensuite \? »\ndeux/);
});

test('la consigne liste tout le catalogue', () => {
  for (const id of ['humeur', 'sport', 'alcool', 'quotidien']) assert.match(SYSTEM_PROMPT, new RegExp(`- ${id} \\(`));
});

test('normalise la sortie du modèle', () => {
  const out = normalizeOutput({
    title: '« Dix kilomètres. »',
    text: 'Ligne un\nsuite.\n\n\n\nParagraphe deux.',
    summary: ' Résumé. ',
    highlights: ['- point', '', 'deux', 'trois', 'quatre', 'cinq'],
    themes: [{ id: 'Sport', label: 'Sport', emoji: '🏃' }, { id: 'sport', label: 'Sport', emoji: '🏃' }, { id: 'jardinage', label: 'jardinage', emoji: '🌱' }],
    mood: 'génial',
    followUp: 'Et après ?',
  });
  assert.equal(out.title, 'Dix kilomètres');
  assert.equal(out.text, 'Ligne un suite.\n\nParagraphe deux.');
  assert.deepEqual(out.highlights, ['point', 'deux', 'trois', 'quatre']);
  assert.deepEqual(out.themes.map((t) => t.id), ['sport', 'jardinage']);
  assert.equal(out.themes[1].label, 'Jardinage');
  assert.equal(out.mood, 'neutre');
});

test('thème de repli quand le modèle n’en donne aucun', () => {
  const out = normalizeOutput({ title: '', text: 'x', summary: '', highlights: [], themes: [], mood: 'bon', followUp: '' });
  assert.deepEqual(out.themes.map((t) => t.id), ['quotidien']);
  assert.equal(out.title, 'Sans titre');
});
