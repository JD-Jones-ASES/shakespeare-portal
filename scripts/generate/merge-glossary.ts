#!/usr/bin/env tsx
/**
 * Merge per-act glossary candidates into one deduped glossary.json for a play.
 *
 * Usage: tsx scripts/generate/merge-glossary.ts <slug> [actCount]
 *
 * Reads:  data/plays/<slug>/_candidates/glossary-<n>.json  (arrays of {surface, definition, pos?})
 * Writes: data/plays/<slug>/glossary.json                  ({ play, entries:[{surface,normalized,definition,pos?}] })
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { playDir } from '../lib/paths.ts';

const slug = process.argv[2];
const actCount = Number(process.argv[3] ?? 5);
if (!slug) { console.error('usage: tsx scripts/generate/merge-glossary.ts <slug> [actCount]'); process.exit(2); }

/** Match key: lowercase, trim surrounding punctuation, keep internal apostrophes/hyphens/spaces. */
export function normGloss(s: string): string {
  return s.toLowerCase().trim().replace(/^[^a-z0-9'’-]+/u, '').replace(/[^a-z0-9'’-]+$/u, '').replace(/’/g, "'");
}

const dir = playDir(slug);
const byKey = new Map<string, { surface: string; normalized: string; definition: string; pos?: string }>();
let raw = 0;

// Start at act 0 to pick up an INDUCTION pseudo-act's glossary-0.json (The Taming of the
// Shrew). Plays without an Induction have no glossary-0.json, so the existsSync check below
// skips it and their merged glossary is byte-identical.
for (let a = 0; a <= actCount; a++) {
  const p = resolve(dir, '_candidates', `glossary-${a}.json`);
  if (!existsSync(p)) continue;
  let arr: any[];
  try { arr = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { console.warn(`skip glossary-${a}.json (parse error)`); continue; }
  for (const e of arr) {
    raw++;
    const surface = String(e.surface ?? '').trim();
    const definition = String(e.definition ?? '').trim().slice(0, 140);
    if (!surface || !definition) continue;
    const normalized = normGloss(surface);
    if (!normalized) continue;
    if (byKey.has(normalized)) {
      // keep the shorter definition (more tooltip-friendly)
      const cur = byKey.get(normalized)!;
      if (definition.length < cur.definition.length) cur.definition = definition;
      continue;
    }
    byKey.set(normalized, { surface: surface.toLowerCase(), normalized, definition, pos: e.pos ? String(e.pos) : undefined });
  }
}

const entries = [...byKey.values()].sort((x, y) => x.normalized.localeCompare(y.normalized));
const out = { play: slug, entries };
const outPath = resolve(dir, 'glossary.json');
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
const multi = entries.filter((e) => e.normalized.includes(' ')).length;
console.log(`merge-glossary ${slug}: ${raw} raw -> ${entries.length} unique (${multi} multi-word). wrote ${outPath}`);
