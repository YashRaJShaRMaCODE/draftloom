import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDraft, buildEmail } from '../public/tools/tools.js';
import { buildReviewPacket } from '../src/utils/reviewPacket.js';
import { renderTemplate, templateVariables } from '../src/utils/messageTemplates.js';
import { isDraftExpired, purgeExpiredDrafts } from '../src/utils/draftRetention.js';
import { findSensitiveValues, redactSensitiveValues } from '../src/utils/sensitiveData.js';

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

test('review packet includes decision fields and escapes draft and reviewer input', () => {
  const packet = buildReviewPacket({
    original: '<script>alert("draft")</script>', revised: 'Hello & welcome', reviewer: 'A "reviewer"',
    rationales: [{ original: '<before>', revised: 'after', reason: '& clearer' }],
    createdAt: new Date('2026-11-17T00:00:00Z'),
  });
  assert.match(packet, /Changes requested/);
  assert.match(packet, /Print \/ save review as PDF/);
  assert.match(packet, /&lt;script&gt;alert\(&quot;draft&quot;\)&lt;\/script&gt;/);
  assert.match(packet, /A &quot;reviewer&quot;/);
  assert.doesNotMatch(packet, /<script>alert/);
});

test('message templates find unique placeholders and render values as plain text', () => {
  const body = 'Hi {{customer_name}}, your {{product}} update is ready, {{customer_name}}.';
  assert.deepEqual(templateVariables(body), ['customer_name', 'product']);
  assert.equal(renderTemplate(body, { customer_name: '<Alex>', product: 'pilot' }), 'Hi <Alex>, your pilot update is ready, <Alex>.');
});

test('draft retention expires at the selected deadline and ignores missing timestamps', () => {
  const now = 1_800_000_000_000;
  assert.equal(isDraftExpired(now - 15 * 60_000 + 1, 15, now), false);
  assert.equal(isDraftExpired(now - 15 * 60_000, 15, now), true);
  assert.equal(isDraftExpired('', 15, now), false);
  const store = new Map([
    ['clear-writing:draft:v1', 'private draft'],
    ['clear-writing:draft:v1:saved-at', String(now - 15 * 60_000)],
    ['clear-writing:previous-draft:v1', 'previous'],
    ['clear-writing:previous-draft:v1:saved-at', String(now - 10_000)],
  ]);
  const storage = { getItem: (key) => store.get(key) || null, removeItem: (key) => store.delete(key) };
  assert.equal(purgeExpiredDrafts(storage, 15, now), true);
  assert.equal(store.size, 0);
});

test('sensitive-value scanner detects common identifiers and redacts without changing the source', () => {
  const source = 'Contact alex@example.com or +1 (415) 555-0123; token sk_live_1234567890abcdef.';
  const findings = findSensitiveValues(source);
  assert.deepEqual(findings.map(({ type }) => type), ['email address', 'phone number', 'API key or access token']);
  assert.equal(redactSensitiveValues(source, findings), 'Contact [REDACTED: email address] or [REDACTED: phone number]; token [REDACTED: API key or access token].');
  assert.equal(source.includes('alex@example.com'), true);
});
