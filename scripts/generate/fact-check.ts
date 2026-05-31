#!/usr/bin/env tsx
/**
 * Run the 3-judge adversarial fact-check panel over candidate annotations.
 *
 * Usage:
 *   tsx scripts/generate/fact-check.ts <slug> [<act> <scene>]
 *
 * Reads:
 *   data/plays/<slug>/_candidates/*.json  (or a single file if act+scene given)
 *   data/plays/<slug>/text.json
 *   scripts/generate/prompts/verifier.md  (templated by lens)
 *
 * Writes:
 *   data/plays/<slug>/annotations.json    (survivors, merged)
 *   data/plays/<slug>/_review_queue/<id>.json  (split-decision candidates)
 *
 * Decision rule (per docs/PIPELINE.md):
 *   - All three verified → ship.
 *   - Two verified, one uncertain → ship; downgrade confidence one notch.
 *   - Two verified, one refuted (not anchor judge) → review_queue.
 *   - Anchor judge refuted → drop.
 *   - Otherwise → drop.
 *
 * STATUS: SDK call is stubbed. Logic for the decision rule and merge is real.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { playDir } from '../lib/paths.ts';

const [slug, actArg, sceneArg] = process.argv.slice(2);
if (!slug) {
  console.error('usage: tsx scripts/generate/fact-check.ts <slug> [<act> <scene>]');
  process.exit(2);
}

const dir = playDir(slug);
const candidatesDir = resolve(dir, '_candidates');
if (!existsSync(candidatesDir)) {
  console.error(`no candidates directory at ${candidatesDir}; nothing to do.`);
  process.exit(0);
}

const files = actArg && sceneArg
  ? [`${actArg}-${sceneArg}.json`]
  : readdirSync(candidatesDir).filter((f) => f.endsWith('.json'));

const verifierTemplate = readFileSync(
  resolve(import.meta.dirname, 'prompts', 'verifier.md'),
  'utf8',
);

interface Candidate {
  id: string;
  play: string;
  type: string;
  depth: 'basic' | 'scholar';
  summary: string;
  detail?: string;
  sources: { name: string; citation: string }[];
  anchor_text: string;
  tln_start: number;
  tln_end: number;
  word_start: number;
  word_end: number;
  confidence: 'high' | 'medium' | 'uncertain';
  [k: string]: unknown;
}

interface Verdict {
  judge: 'source' | 'anchor' | 'interpretation';
  model: string;
  verdict: 'verified' | 'refuted' | 'uncertain';
  note: string;
}

const MODEL_SOURCE = 'claude-sonnet-4-6';
const MODEL_ANCHOR = 'claude-sonnet-4-6';
const MODEL_INTERP = 'claude-opus-4-7';

async function judge(lens: 'source' | 'anchor' | 'interpretation', candidate: Candidate, playText: unknown): Promise<Verdict> {
  // TODO(pilot): wire the actual SDK call. Each lens gets the verifier prompt
  // templated with only the inputs documented in docs/PIPELINE.md:
  //   - source: candidate.sources + candidate.summary/detail
  //   - anchor: candidate.{tln_start,tln_end,word_start,word_end,anchor_text} + playText
  //   - interpretation: candidate.summary/detail + surrounding scene + character list
  const _prompt = verifierTemplate
    .replace('{{LENS}}', lens)
    .replace('{{CANDIDATE_JSON}}', JSON.stringify(candidate, null, 2));
  void _prompt;
  // Stub: refuse everything until SDK is wired, so we never accidentally ship un-checked content.
  return {
    judge: lens,
    model: lens === 'source' ? MODEL_SOURCE : lens === 'anchor' ? MODEL_ANCHOR : MODEL_INTERP,
    verdict: 'refuted',
    note: 'SDK not wired yet; defaulting to refuted to fail-safe.',
  };
}

function decide(v: Verdict[]): 'ship' | 'review' | 'drop' {
  const refuted = v.filter((x) => x.verdict === 'refuted');
  const verified = v.filter((x) => x.verdict === 'verified');
  const anchorRefuted = v.find((x) => x.judge === 'anchor')?.verdict === 'refuted';
  if (anchorRefuted) return 'drop';
  if (verified.length === 3) return 'ship';
  if (verified.length === 2 && refuted.length === 0) return 'ship';     // 2v + 1 uncertain
  if (verified.length === 2 && refuted.length === 1) return 'review';   // 2v + 1 refuted (not anchor)
  return 'drop';
}

function downgrade(c: 'high' | 'medium' | 'uncertain'): 'high' | 'medium' | 'uncertain' {
  return c === 'high' ? 'medium' : c === 'medium' ? 'uncertain' : 'uncertain';
}

const playText = JSON.parse(readFileSync(resolve(dir, 'text.json'), 'utf8'));

const existingPath = resolve(dir, 'annotations.json');
const existing: Candidate[] = existsSync(existingPath)
  ? JSON.parse(readFileSync(existingPath, 'utf8'))
  : [];
const existingIds = new Set(existing.map((a) => a.id));

const reviewDir = resolve(dir, '_review_queue');
mkdirSync(reviewDir, { recursive: true });

let shipped = 0;
let reviewed = 0;
let dropped = 0;

for (const file of files) {
  const candidates: Candidate[] = JSON.parse(readFileSync(resolve(candidatesDir, file), 'utf8'));
  if (!Array.isArray(candidates)) continue;
  for (const c of candidates) {
    if (existingIds.has(c.id)) continue;
    const verdicts = await Promise.all([
      judge('source', c, playText),
      judge('anchor', c, playText),
      judge('interpretation', c, playText),
    ]);
    const outcome = decide(verdicts);

    const uncertainCount = verdicts.filter((v) => v.verdict === 'uncertain').length;
    const adjustedConfidence = uncertainCount > 0 ? downgrade(c.confidence) : c.confidence;

    const finalized = {
      ...c,
      confidence: adjustedConfidence,
      fact_checked: true,
      fact_checked_by: [MODEL_SOURCE, MODEL_ANCHOR, MODEL_INTERP],
      fact_checked_at: new Date().toISOString().slice(0, 10),
      fact_check_verdicts: verdicts,
    };

    if (outcome === 'ship') {
      existing.push(finalized);
      existingIds.add(finalized.id);
      shipped++;
    } else if (outcome === 'review') {
      writeFileSync(
        resolve(reviewDir, `${finalized.id}.json`),
        JSON.stringify(finalized, null, 2),
        'utf8',
      );
      reviewed++;
    } else {
      dropped++;
    }
  }
}

writeFileSync(existingPath, JSON.stringify(existing, null, 2), 'utf8');
console.log(`fact-check: ${shipped} shipped, ${reviewed} → _review_queue/, ${dropped} dropped.`);
