#!/usr/bin/env tsx
/**
 * Re-resolve the anchor coordinates (tln_start/tln_end/word_start/word_end) of every
 * shipped annotation against the CURRENT text.json, by content. Run after re-ingesting a
 * play whose TLNs may have shifted, so annotations.json stays anchor-valid without
 * regenerating any content. Uses the shared matcher in lib/text.ts.
 *
 * Usage: tsx scripts/generate/reanchor.ts <slug>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { playDir } from '../lib/paths.ts';
import { loadPlay, indexByTln, norm, matchAnchor } from '../lib/text.ts';

const slug = process.argv[2];
if (!slug) { console.error('usage: tsx scripts/generate/reanchor.ts <slug>'); process.exit(2); }

const play = loadPlay(slug);
const byTln = indexByTln(play);
const ranges: { lo: number; hi: number }[] = [];
for (const a of play.acts) for (const s of a.scenes) {
  if (s.tln_start && s.tln_end) ranges.push({ lo: s.tln_start, hi: s.tln_end });
}

const annPath = resolve(playDir(slug), 'annotations.json');
const anns: any[] = JSON.parse(readFileSync(annPath, 'utf8'));

let changed = 0;
const failed: string[] = [];
for (const ann of anns) {
  const target = norm(ann.anchor_text ?? '');
  if (!target) { failed.push(ann.id); continue; }
  const lo = Math.min(ann.tln_start, ann.tln_end ?? ann.tln_start);
  const hi = Math.max(ann.tln_start, ann.tln_end ?? ann.tln_start);
  const scene = ranges.find((r) => lo >= r.lo && lo <= r.hi) ?? { lo: 1, hi: play.tln_count ?? lo };
  const run =
    matchAnchor(byTln, lo - 3, hi + 3, target) ??
    matchAnchor(byTln, lo - 40, hi + 40, target) ??
    matchAnchor(byTln, scene.lo, scene.hi, target);
  if (!run) { failed.push(ann.id); continue; }
  if (run.tlnS !== ann.tln_start || run.tlnE !== ann.tln_end || run.wS !== ann.word_start || run.wE !== ann.word_end) changed++;
  ann.tln_start = run.tlnS;
  ann.tln_end = run.tlnE;
  ann.word_start = run.wS;
  ann.word_end = run.wE;
}

writeFileSync(annPath, JSON.stringify(anns, null, 2), 'utf8');
console.log(`reanchor ${slug}: ${anns.length} annotations, ${changed} re-anchored, ${failed.length} failed.`);
if (failed.length) console.log('  failed:', failed.join(', '));
