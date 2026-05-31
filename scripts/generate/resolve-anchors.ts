#!/usr/bin/env tsx
/**
 * Deterministically compute tln_start/tln_end/word_start/word_end for candidate
 * annotations from their anchor_text. Models are unreliable at counting word offsets
 * and sometimes pick an imprecise TLN range; this removes both burdens — the annotator
 * need only supply an accurate anchor_text that occurs somewhere in (or near) the scene.
 *
 * Matching is punctuation- and case-insensitive (see norm()), so the source's glued
 * "word;--word" tokens and the model's " / " line-break markers both resolve cleanly.
 * Offsets are set to the source words that CONTAIN the anchor's first/last characters,
 * which the anchor-check validator accepts (it uses substring containment).
 *
 * Usage:
 *   tsx scripts/generate/resolve-anchors.ts <slug> <act> <scene>
 *
 * Reads/writes (in place): data/plays/<slug>/_candidates/<act>-<scene>.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { playDir } from '../lib/paths.ts';
import { loadPlay, indexByTln, getScene, norm, matchAnchor } from '../lib/text.ts';

const [slug, actArg, sceneArg] = process.argv.slice(2);
if (!slug || !actArg || !sceneArg) {
  console.error('usage: tsx scripts/generate/resolve-anchors.ts <slug> <act> <scene>');
  process.exit(2);
}

const file = resolve(playDir(slug), '_candidates', `${actArg}-${sceneArg}.json`);
const candidates: any[] = JSON.parse(readFileSync(file, 'utf8'));
const play = loadPlay(slug);
const byTln = indexByTln(play);
const scene = getScene(play, Number(actArg), Number(sceneArg));
const sceneLo = scene?.tln_start ?? 1;
const sceneHi = scene?.tln_end ?? (play.tln_count ?? 1);

// (anchor matcher lives in ../lib/text.ts as matchAnchor — shared with reanchor.ts)

let ok = 0;
let corrected = 0;
const failures: { id: string; reason: string }[] = [];

for (const c of candidates) {
  const target = norm(c.anchor_text ?? '');
  if (!target) { c._anchor_ok = false; failures.push({ id: c.id, reason: 'empty anchor_text' }); continue; }

  const lo = Math.min(c.tln_start, c.tln_end ?? c.tln_start);
  const hi = Math.max(c.tln_start, c.tln_end ?? c.tln_start);

  // tight window (auto-corrects small TLN errors), then wide, then whole scene.
  const run = matchAnchor(byTln, lo - 3, hi + 3, target) ?? matchAnchor(byTln, lo - 30, hi + 30, target) ?? matchAnchor(byTln, sceneLo, sceneHi, target);
  if (!run) { c._anchor_ok = false; failures.push({ id: c.id, reason: `anchor "${c.anchor_text}" not found in scene ${actArg}.${sceneArg}` }); continue; }

  if (run.tlnS !== c.tln_start || run.tlnE !== (c.tln_end ?? c.tln_start)) corrected++;
  c.tln_start = run.tlnS;
  c.tln_end = run.tlnE;
  c.word_start = run.wS;
  c.word_end = run.wE;
  c._anchor_ok = true;
  ok++;
}

writeFileSync(file, JSON.stringify(candidates, null, 2), 'utf8');
console.log(`resolve-anchors: ${slug} ${actArg}.${sceneArg} — ${ok}/${candidates.length} resolved (${corrected} TLN-corrected).`);
if (failures.length) {
  console.log('  unresolved (will not ship):');
  for (const f of failures) console.log(`    ${f.id}: ${f.reason}`);
}
