#!/usr/bin/env tsx
/**
 * Merge fact-check verdicts into final annotations.
 *
 * Combines, per candidate:
 *   - the deterministic anchor verdict (from resolve-anchors: _anchor_ok)
 *   - the source judge verdict   (_candidates/<a>-<s>.source.json)
 *   - the interpretation verdict (_candidates/<a>-<s>.interp.json)
 * applies the decision rule from docs/PIPELINE.md, and appends survivors to
 * data/plays/<slug>/annotations.json. Split decisions go to _review_queue/.
 *
 * Usage: tsx scripts/generate/apply-verdicts.ts <slug> <act> <scene>
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { playDir } from '../lib/paths.ts';

const [slug, actArg, sceneArg] = process.argv.slice(2);
if (!slug || !actArg || !sceneArg) {
  console.error('usage: tsx scripts/generate/apply-verdicts.ts <slug> <act> <scene>');
  process.exit(2);
}

const SOURCE_MODEL = 'claude-sonnet-4-6';
const INTERP_MODEL = 'claude-sonnet-4-6';
const ANCHOR_MODEL = 'resolve-anchors.ts (deterministic)';
const TODAY = new Date().toISOString().slice(0, 10);

const ALLOWED = new Set([
  'id', 'play', 'tln_start', 'tln_end', 'word_start', 'word_end', 'anchor_text',
  'type', 'depth', 'summary', 'detail', 'references', 'sources', 'confidence', 'generated_by',
]);

type Verdict = 'verified' | 'refuted' | 'uncertain';
interface JudgeOut { id: string; verdict: Verdict; note: string }

const dir = playDir(slug);
const candidates: any[] = JSON.parse(readFileSync(resolve(dir, '_candidates', `${actArg}-${sceneArg}.json`), 'utf8'));

function loadVerdicts(kind: 'source' | 'interp'): Map<string, JudgeOut> {
  const p = resolve(dir, '_candidates', `${actArg}-${sceneArg}.${kind}.json`);
  const m = new Map<string, JudgeOut>();
  if (!existsSync(p)) { console.warn(`warning: missing ${kind} verdicts at ${p}`); return m; }
  for (const v of JSON.parse(readFileSync(p, 'utf8')) as JudgeOut[]) m.set(v.id, v);
  return m;
}
const sourceV = loadVerdicts('source');
const interpV = loadVerdicts('interp');

function downgrade(c: string): string {
  return c === 'high' ? 'medium' : c === 'medium' ? 'uncertain' : 'uncertain';
}

function clean(c: any): any {
  const out: any = {};
  for (const k of Object.keys(c)) {
    if (!ALLOWED.has(k)) continue;
    // Drop a null/undefined optional 'detail': some annotator subagents emit `"detail": null`,
    // which fails schema-check (detail must be a string). A real detail string (or an empty
    // string, as some shipped plays carry) is preserved, and a missing detail was never copied —
    // so this is byte-identical for every prior play (none have a null detail).
    if (k === 'detail' && c[k] == null) continue;
    out[k] = c[k];
  }
  return out;
}

const ship: any[] = [];
const review: any[] = [];
const dropped: { id: string; reason: string }[] = [];

for (const c of candidates) {
  if (!c._anchor_ok) { dropped.push({ id: c.id, reason: 'anchor unresolved' }); continue; }
  const s = sourceV.get(c.id) ?? { id: c.id, verdict: 'uncertain' as Verdict, note: 'no source verdict returned' };
  const ip = interpV.get(c.id) ?? { id: c.id, verdict: 'uncertain' as Verdict, note: 'no interpretation verdict returned' };

  const verdicts = [
    { judge: 'anchor', model: ANCHOR_MODEL, verdict: 'verified' as Verdict, note: `anchor located deterministically at TLN ${c.tln_start}` },
    { judge: 'source', model: SOURCE_MODEL, verdict: s.verdict, note: s.note?.slice(0, 480) ?? '' },
    { judge: 'interpretation', model: INTERP_MODEL, verdict: ip.verdict, note: ip.note?.slice(0, 480) ?? '' },
  ];

  const refutedCount = [s, ip].filter((v) => v.verdict === 'refuted').length;
  const verifiedCount = 1 + [s, ip].filter((v) => v.verdict === 'verified').length;
  const uncertainCount = [s, ip].filter((v) => v.verdict === 'uncertain').length;

  const finalized = clean(c);
  // sanitize id: lowercase, drop apostrophes, replace any other invalid char with '-'
  if (typeof finalized.id === 'string') {
    finalized.id = finalized.id.toLowerCase().replace(/['’`]/g, '').replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
  }
  finalized.fact_checked = true;
  finalized.fact_checked_by = [ANCHOR_MODEL, SOURCE_MODEL, INTERP_MODEL];
  finalized.fact_checked_at = TODAY;
  finalized.fact_check_verdicts = verdicts;
  if (!finalized.generated_by) finalized.generated_by = 'claude-sonnet-4-6';

  let decision: 'ship' | 'review' | 'drop';
  if (refutedCount >= 1 && verifiedCount >= 2) decision = 'review';   // 2 verified + 1 refuted
  else if (refutedCount >= 1) decision = 'drop';                       // <=1 verified with a refutation
  else if (verifiedCount >= 2) decision = 'ship';                      // 3 verified, or 2 verified + uncertain
  else decision = 'drop';                                              // too uncertain

  if (decision === 'ship') {
    if (uncertainCount > 0) {
      finalized.confidence = downgrade(finalized.confidence);
      // an uncertain note must not surface at basic depth — move it to scholar
      if (finalized.confidence === 'uncertain' && finalized.depth === 'basic') finalized.depth = 'scholar';
    }
    ship.push(finalized);
  } else if (decision === 'review') {
    review.push({ ...finalized, _review_reason: `source=${s.verdict}, interp=${ip.verdict}` });
  } else {
    dropped.push({ id: c.id, reason: `source=${s.verdict}, interp=${ip.verdict}` });
  }
}

// merge into annotations.json (dedupe by id)
const annPath = resolve(dir, 'annotations.json');
const existing: any[] = existsSync(annPath) ? JSON.parse(readFileSync(annPath, 'utf8')) : [];
const byId = new Map<string, any>(existing.map((a) => [a.id, a]));
for (const a of ship) byId.set(a.id, a);
const merged = [...byId.values()].sort((a, b) => a.tln_start - b.tln_start);
writeFileSync(annPath, JSON.stringify(merged, null, 2), 'utf8');

if (review.length) {
  const rq = resolve(dir, '_review_queue');
  mkdirSync(rq, { recursive: true });
  for (const r of review) writeFileSync(resolve(rq, `${r.id}.json`), JSON.stringify(r, null, 2), 'utf8');
}

console.log(`apply-verdicts ${slug} ${actArg}.${sceneArg}: ${ship.length} shipped, ${review.length} review, ${dropped.length} dropped. (annotations.json now ${merged.length})`);
if (dropped.length) for (const d of dropped) console.log(`  drop ${d.id}: ${d.reason}`);
