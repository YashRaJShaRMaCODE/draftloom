import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDraft, buildEmail } from '../public/tools/tools.js';

test('copy check counts words and identifies long sentences and filler phrases', () => {
  const result = analyzeDraft('I really need a review. This is a long sentence with enough words to cross the twenty four word threshold and become something the writer should consider breaking into two shorter sentences for clarity.');
  assert.equal(result.words, 34);
  assert.equal(result.sentences, 2);
  assert.equal(result.longSentences.length, 1);
  assert.deepEqual(result.foundFillers, ['really']);
});

test('email planner uses selected tone and safe placeholders', () => {
  assert.equal(buildEmail({ topic: 'the pilot', ask: 'review the scope', tone: 'formal' }),
    'Dear [Name],\n\nI am writing regarding the pilot.\n\nWould you kindly review the scope?\n\nBest,\n[Your name]');
});
