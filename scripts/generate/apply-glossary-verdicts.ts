#!/usr/bin/env tsx
/**
 * Apply glossary verification verdicts (deletes + fixes) to glossary.json.
 * Usage: tsx scripts/generate/apply-glossary-verdicts.ts <slug>
 * Reads _candidates/glossary-verify-*.json = { delete:[normalized...], fix:[{normalized,definition}] }
 */
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { playDir } from '../lib/paths.ts';

const slug = process.argv[2];
if (!slug) { console.error('usage: tsx scripts/generate/apply-glossary-verdicts.ts <slug>'); process.exit(2); }

const dir = playDir(slug);
const gPath = resolve(dir, 'glossary.json');
const g = JSON.parse(readFileSync(gPath, 'utf8'));

const del = new Set<string>();
const fix = new Map<string, string>();
const cand = resolve(dir, '_candidates');
for (const f of existsSync(cand) ? readdirSync(cand) : []) {
  if (!/^glossary-verify-.*\.json$/.test(f)) continue;
  const v = JSON.parse(readFileSync(resolve(cand, f), 'utf8'));
  for (const d of v.delete ?? []) del.add(String(d).toLowerCase());
  for (const x of v.fix ?? []) if (x.normalized && x.definition) fix.set(String(x.normalized).toLowerCase(), String(x.definition).slice(0, 140));
}

const before = g.entries.length;
g.entries = g.entries
  .filter((e: any) => !del.has(e.normalized))
  .map((e: any) => (fix.has(e.normalized) ? { ...e, definition: fix.get(e.normalized) } : e));

writeFileSync(gPath, JSON.stringify(g, null, 2), 'utf8');
console.log(`apply-glossary-verdicts ${slug}: ${before} -> ${g.entries.length} entries (${del.size} deletes, ${fix.size} fixes applied).`);
