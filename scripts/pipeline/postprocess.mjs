#!/usr/bin/env node
/**
 * Deterministic post-processing of fact-check candidates into shipped annotations.
 * For every scene that has a candidate file, runs (in this order, SERIALLY):
 *   1. generate/resolve-anchors.ts   (computes tln/word offsets from anchor_text)
 *   2. generate/apply-verdicts.ts    (2-of-3 gate -> annotations.json / _review_queue)
 *
 * Serial on purpose: apply-verdicts.ts mutates the shared annotations.json.
 *
 * Usage:  node scripts/pipeline/postprocess.mjs <slug> [--reset]
 *   --reset  empty annotations.json and clear _review_queue/ first (clean rebuild).
 *
 * WHY THIS EXISTS / WINDOWS NOTE: it spawns the real `node` binary with
 * `--import tsx` and cwd=scripts/ (so tsx resolves). Do NOT shell out to the
 * scripts/node_modules/.bin/tsx.cmd shim from Node — execFileSync cannot spawn a
 * .cmd on Windows (EINVAL). Running the .ts scripts straight from a repo-root cwd
 * also fails (tsx won't resolve); both pitfalls are handled here.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPTS = resolve(ROOT, 'scripts');
const slug = process.argv[2];
const reset = process.argv.includes('--reset');
if (!slug) { console.error('usage: node scripts/pipeline/postprocess.mjs <slug> [--reset]'); process.exit(2); }

const playDir = resolve(ROOT, 'data', 'plays', slug);
const candDir = resolve(playDir, '_candidates');
const annPath = resolve(playDir, 'annotations.json');

const text = JSON.parse(readFileSync(resolve(playDir, 'text.json'), 'utf8'));
const scenes = [];
for (const a of text.acts) for (const s of a.scenes) scenes.push([a.number, s.number]);

function tsx(script, sceneArgs) {
  return execFileSync('node', ['--import', 'tsx', resolve(SCRIPTS, 'generate', script), slug, ...sceneArgs],
    { cwd: SCRIPTS, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

if (reset) {
  writeFileSync(annPath, '[]', 'utf8');
  const rq = resolve(playDir, '_review_queue');
  if (existsSync(rq)) for (const f of readdirSync(rq)) if (f.endsWith('.json')) rmSync(resolve(rq, f));
  console.log('--reset: emptied annotations.json and _review_queue/');
}

let tShip = 0, tRev = 0, tDrop = 0, tUnres = 0, skipped = 0;
for (const [a, s] of scenes) {
  if (!existsSync(resolve(candDir, `${a}-${s}.json`))) { skipped++; continue; }
  const r1 = tsx('resolve-anchors.ts', [String(a), String(s)]);
  const m1 = r1.match(/(\d+)\/(\d+) resolved/);
  if (m1) tUnres += Number(m1[2]) - Number(m1[1]);
  const r2 = tsx('apply-verdicts.ts', [String(a), String(s)]);
  const m2 = r2.match(/(\d+) shipped, (\d+) review, (\d+) dropped/);
  if (m2) { tShip += +m2[1]; tRev += +m2[2]; tDrop += +m2[3]; console.log(`  ${a}-${s}: ${m2[0]}`); }
  else console.log(`  ${a}-${s}: ${r2.trim().split('\n').pop()}`);
}
// Finalize in canonical TLN order. apply-verdicts appends scene-by-scene (TLN-ordered across
// scenes but not guaranteed strictly within a scene), and the review-queue rescue appends items
// onto the end, so sort the shipped file by (tln_start, word_start, word_end, id). The reader
// also sorts at render time (loader.ts annotationsForScene); this keeps the committed DATA
// canonical too, so any consumer that trusts array order shows notes in TLN order.
const finalAnns = JSON.parse(readFileSync(annPath, 'utf8'));
finalAnns.sort((x, y) =>
  (x.tln_start - y.tln_start) || ((x.word_start ?? 0) - (y.word_start ?? 0)) ||
  ((x.word_end ?? 0) - (y.word_end ?? 0)) || String(x.id).localeCompare(String(y.id)));
writeFileSync(annPath, JSON.stringify(finalAnns, null, 2), 'utf8');
const total = finalAnns.length;
console.log(`\npostprocess ${slug}: ${tShip} shipped, ${tRev} review, ${tDrop} dropped, ${tUnres} anchor-unresolved, ${skipped} scene(s) without candidates.`);
console.log(`annotations.json now ${total}.`);
if (tUnres) console.log('Anchor-unresolved candidates were dropped: check the candidate anchor_text matches the source verbatim.');
