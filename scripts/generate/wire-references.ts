#!/usr/bin/env tsx
/**
 * Attach reference cards to annotations per data/plays/<slug>/references_wiring.json,
 * a map of { "<annotation id>": [{ kind, card_id }, ...] }.
 *
 * Usage: tsx scripts/generate/wire-references.ts <slug>
 *
 * Idempotent: re-running replaces each listed annotation's references[] with the map's.
 * Reports any annotation ids in the map that are not present (e.g. dropped in fact-check).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { playDir } from '../lib/paths.ts';

const slug = process.argv[2];
if (!slug) { console.error('usage: tsx scripts/generate/wire-references.ts <slug>'); process.exit(2); }

const dir = playDir(slug);
const wiringPath = resolve(dir, 'references_wiring.json');
const annPath = resolve(dir, 'annotations.json');
if (!existsSync(wiringPath)) { console.log(`no references_wiring.json for ${slug}; nothing to wire.`); process.exit(0); }

const wiring: Record<string, { kind: string; card_id: string }[]> = JSON.parse(readFileSync(wiringPath, 'utf8'));
const anns: any[] = JSON.parse(readFileSync(annPath, 'utf8'));
const byId = new Map<string, any>(anns.map((a) => [a.id, a]));

let wired = 0;
const missing: string[] = [];
for (const [annId, refs] of Object.entries(wiring)) {
  if (annId.startsWith('_')) continue; // skip _comment
  const ann = byId.get(annId);
  if (!ann) { missing.push(annId); continue; }
  ann.references = refs;
  wired++;
}

writeFileSync(annPath, JSON.stringify(anns, null, 2), 'utf8');
console.log(`wire-references ${slug}: wired ${wired} annotation(s).`);
if (missing.length) {
  console.log(`  not present (skipped): ${missing.join(', ')}`);
}
