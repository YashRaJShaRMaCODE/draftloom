import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pages = [
  '../public/tools/clear-copy-check.html',
  '../public/tools/email-tone-template.html',
  '../public/guides/write-clear-client-emails.html',
  '../public/guides/support-reply-template.html',
  '../public/guides/meeting-summary-template.html',
];

test('free tools and guides have unique SEO metadata and canonical URLs', async () => {
  const docs = await Promise.all(pages.map((page) => readFile(new URL(page, import.meta.url), 'utf8')));
  const titles = docs.map((html) => html.match(/<title>(.*?)<\/title>/)?.[1]);
  const canonicals = docs.map((html) => html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]);
  assert.ok(titles.every(Boolean));
  assert.equal(new Set(titles).size, titles.length);
  assert.ok(docs.every((html) => /name="description" content="[^"]{60,}"/.test(html)));
  assert.ok(canonicals.every(Boolean));
  assert.equal(new Set(canonicals).size, canonicals.length);
  const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  assert.ok(canonicals.every((url) => sitemap.includes(`<loc>${url}</loc>`)));
});
