#!/usr/bin/env tsx
/**
 * Assign Through-Line Numbers (TLN) to every spoken line in a parsed play.
 *
 * Usage:
 *   tsx scripts/ingest/normalize-tln.ts <slug>
 *
 * Reads:  data/plays/<slug>/text.json (output of parse-gutenberg.ts)
 * Writes: data/plays/<slug>/text.json (in place, adds tln + tln_count + scene tln ranges)
 *
 * Convention: TLN starts at 1 at the first spoken line of Act 1 Scene 1 and increments
 * by 1 per spoken line, ignoring stage directions, scene headers, and blank lines.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { playDir } from '../lib/paths.ts';

const slug = process.argv[2];
if (!slug) {
  console.error('usage: tsx scripts/ingest/normalize-tln.ts <slug>');
  process.exit(2);
}

const path = resolve(playDir(slug), 'text.json');
const data = JSON.parse(readFileSync(path, 'utf8'));

let tln = 0;

for (const act of data.acts) {
  for (const scene of act.scenes) {
    let sceneStart: number | undefined;
    let sceneEnd: number | undefined;
    for (const line of scene.lines) {
      if (line.kind === 'spoken') {
        tln += 1;
        line.tln = tln;
        if (sceneStart === undefined) sceneStart = tln;
        sceneEnd = tln;
      }
    }
    if (sceneStart !== undefined) {
      scene.tln_start = sceneStart;
      scene.tln_end = sceneEnd;
    }
  }
}

data.tln_count = tln;
if (!data.source) data.source = {};
data.source.ingested_at = new Date().toISOString().slice(0, 10);

writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log(`normalize-tln: ${slug} now has ${tln} TLN'd lines.`);
