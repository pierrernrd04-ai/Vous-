import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanTranscript, classify, detectMood, makeTitle, cleanSentences, localWrite } from '../public/js/local-ai.js';

test('retire les tics de langage et les mots doublés', () => {
  const out = cleanTranscript('euh en fait je je suis allé courir du coup tu vois');
  assert.equal(out, 'Je suis allé courir.');
});

test('garde « nous nous » et « quoi » quand il a du sens', () => {
  assert.equal(cleanTranscript('nous nous sommes vus'), 'Nous nous sommes vus.');
  assert.equal(cleanTranscript('je sais pas quoi dire'), 'Je ne sais pas quoi dire.');
  assert.equal(cleanTranscript("c'était bien quoi"), "C'était bien.");
});

test('rétablit la négation et les formes orales courantes', () => {
  assert.equal(cleanTranscript("j'suis crevé y'a pas moyen"), "Je suis crevé il n'y a pas moyen.");
  assert.equal(cleanTranscript("c'est pas grave"), "Ce n'est pas grave.");
});

test('supprime les groupes répétés et les phrases redites', () => {
  assert.equal(cleanTranscript('je suis allé je suis allé au marché'), 'Je suis allé au marché.');
  assert.equal(cleanTranscript('été été génial'), 'Été génial.');
  assert.deepEqual(cleanSentences('Il pleut. Il pleut. Je reste chez moi.'), ['Il pleut.', 'Je reste chez moi.']);
});

test('ponctuation française : espace fine avant ? et !', () => {
  assert.equal(cleanTranscript('tu viens ?'), 'Tu viens ?');
});

test('classe par thème selon le vocabulaire', () => {
  assert.deepEqual(classify("j'ai couru 10 km ce matin puis séance de muscu").slice(0, 1), ['sport']);
  assert.ok(classify('apéro avec trois bières et un verre de vin').includes('alcool'));
  assert.deepEqual(classify('rien de spécial à signaler'), ['quotidien']);
});

test("estime l'humeur", () => {
  assert.equal(detectMood('journée incroyable, je suis trop heureux'), 'excellent');
  assert.equal(detectMood("je suis content, c'était génial"), 'bon');
  assert.equal(detectMood('je suis fatigué et stressé'), 'bas');
  assert.equal(detectMood('je suis allé au marché'), 'neutre');
});

test('titre court tiré de la première phrase', () => {
  assert.equal(makeTitle(["Aujourd'hui je suis allé courir au parc avec Léa."]), 'Je suis allé courir au parc…');
  assert.equal(makeTitle([]), 'Note vocale');
});

test('localWrite produit une entrée complète', () => {
  const out = localWrite([{ text: 'euh je suis allé courir dix kilomètres' }, { text: 'et je me sentais super bien', question: 'Comment tu te sentais ?' }]);
  assert.equal(out.themes[0], 'sport');
  assert.ok(out.text.startsWith('Je suis allé courir dix kilomètres.'));
  assert.ok(out.followUp.endsWith('?'));
  assert.ok(['bon', 'excellent'].includes(out.mood));
});

test('formes orales commençant par une lettre accentuée', () => {
  assert.equal(cleanTranscript('ça va pas trop'), 'Ça ne va pas trop.');
  assert.equal(cleanTranscript("je ne sais pas à quoi ça sert"), 'Je ne sais pas à quoi ça sert.');
  assert.equal(cleanTranscript("je ne sais pas à quoi"), 'Je ne sais pas à quoi.');
});
