#!/usr/bin/env node
/**
 * List the distinct speech-prefix shapes in a raw Gutenberg play text, with first-
 * appearance line and frequency, to seed data/plays/<slug>/characters.json BEFORE
 * ingest. The parser canonicalizes speakers against that file's aliases, so author
 * it first (include each label exactly as it appears, e.g. "BRUTUS." or "Ham.").
 *
 * Usage: node scripts/pipeline/extract-speakers.mjs <slug>
 * Reads: shakespeare-material-master/texts/gutenberg/<slug>_gut.txt   (read-only)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const slug = process.argv[2];
if (!slug) { console.error('usage: node scripts/pipeline/extract-speakers.mjs <slug>'); process.exit(2); }

// A few vendored modern-spelling files are named differently from the play slug;
// mirror scripts/lib/paths.ts MODERN_SOURCE_ALIAS so this helper resolves them too.
const MODERN_SOURCE_ALIAS = { titus_andronicus: 'tragedy_of_titus_andronicus' };
const base = MODERN_SOURCE_ALIAS[slug] ?? slug;
const file = resolve(ROOT, 'shakespeare-material-master', 'texts', 'gutenberg', `${base}_gut.txt`);
const lines = readFileSync(file, 'utf8').split(/\r?\n/);

const STOP = new Set(['the', 'a', 'an', 'and', 'to', 'of', 'my', 'is', 'in', 'it', 'that', 'you',
  'we', 'i', 'his', 'her', 'with', 'for', 'so', 'no', 'be', 'or', 'but', 'this', 'thee', 'thou', 'thy']);

/** Mirrors the heuristic in scripts/ingest/parse-gutenberg.ts looksLikeSpeaker(). */
function looksLikeSpeaker(t) {
  if (!t.endsWith('.') || t.length > 22) return false;
  const toks = t.replace(/\.$/, '').split(/\s+/).filter(Boolean);
  if (toks.length === 0 || toks.length > 4) return false;
  for (const tok of toks) {
    const bare = tok.replace(/\.$/, '');
    if (/^\d+$/.test(bare) || bare.toLowerCase() === 'and') continue;
    if (/^[A-Z][A-Za-z']{0,15}$/.test(bare)) {
      if (STOP.has(bare.toLowerCase()) && bare.length > 1) return false;
      continue;
    }
    return false;
  }
  return true;
}

let start = lines.findIndex((l) => /^\s*ACT\s+([IVXLC]+|\d+)\.?\s*$/i.test(l));
if (start < 0) start = 0;
const seen = new Map();
for (let i = start; i < lines.length; i++) {
  const t = lines[i].trim();
  if (/^ACT\s+([IVXLC]+|\d+)\.?$/i.test(t) || /^SCENE\b/i.test(t)) continue;
  if (looksLikeSpeaker(t)) {
    if (!seen.has(t)) seen.set(t, { first: i + 1, count: 0 });
    seen.get(t).count++;
  }
}
const rows = [...seen.entries()].sort((a, b) => b[1].count - a[1].count);
console.log(`extract-speakers ${slug}: ${rows.length} distinct speech-prefix shapes\n  count   firstLine  label`);
for (const [label, { first, count }] of rows) {
  console.log(`  ${String(count).padStart(4)}   L${String(first).padStart(5)}   ${label}`);
}
console.log('\nAuthor characters.json with one entry per real role; put each printed label in that role’s aliases[].');
