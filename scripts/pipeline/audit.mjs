#!/usr/bin/env node
/**
 * One-stop final check for a play: prints the annotation distribution + counts,
 * then runs all three validators. Exit code is non-zero if any validator fails.
 *
 * Usage: node scripts/pipeline/audit.mjs <slug>
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPTS = resolve(ROOT, 'scripts');
const slug = process.argv[2];
if (!slug) { console.error('usage: node scripts/pipeline/audit.mjs <slug>'); process.exit(2); }

const playDir = resolve(ROOT, 'data', 'plays', slug);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const a = readJson(resolve(playDir, 'annotations.json'));
const g = existsSync(resolve(playDir, 'glossary.json')) ? readJson(resolve(playDir, 'glossary.json')).entries.length : 0;
const c = existsSync(resolve(playDir, 'characters.json')) ? readJson(resolve(playDir, 'characters.json')).length : 0;
const rqDir = resolve(playDir, '_review_queue');
const rq = existsSync(rqDir) ? readdirSync(rqDir).filter((f) => f.endsWith('.json')).length : 0;

// Safety net: annotations.json should be in canonical TLN order (postprocess + the rescue merge
// both sort it). Report any drift here at the mandatory final gate — it is a data-hygiene signal,
// not a correctness failure (the reader re-sorts at render time), so it does not fail the audit.
let outOfOrder = 0;
for (let i = 1; i < a.length; i++) {
  const p = a[i - 1], q = a[i];
  if (p.tln_start > q.tln_start || (p.tln_start === q.tln_start && (p.word_start ?? 0) > (q.word_start ?? 0))) outOfOrder++;
}

const by = (k) => a.reduce((m, x) => ((m[x[k]] = (m[x[k]] || 0) + 1), m), {});
const cards = {}; let links = 0;
for (const x of a) if (x.references) for (const r of x.references) { links++; const k = `${r.kind}:${r.card_id}`; cards[k] = (cards[k] || 0) + 1; }

console.log(`AUDIT ${slug}`);
console.log(`  annotations=${a.length}  glossary=${g}  characters=${c}  review_queue=${rq}  tln_order=${outOfOrder === 0 ? 'OK' : outOfOrder + ' OUT-OF-ORDER (run node scripts/pipeline/_sort-annotations.mjs ' + slug + ')'}`);
console.log(`  type=${JSON.stringify(by('type'))}`);
console.log(`  confidence=${JSON.stringify(by('confidence'))}  depth=${JSON.stringify(by('depth'))}`);
console.log(`  reference links=${links} across ${Object.keys(cards).length} cards`);
console.log(`  card usage=${JSON.stringify(cards)}`);

console.log('\nVALIDATORS:');
let failed = false;
for (const v of ['schema-check.ts', 'anchor-check.ts', 'citation-check.ts']) {
  try {
    const out = execFileSync('node', ['--import', 'tsx', resolve(SCRIPTS, 'validate', v)],
      { cwd: SCRIPTS, encoding: 'utf8' });
    console.log(`  ${v}: ${out.trim().split('\n').pop()}`);
  } catch (e) {
    failed = true;
    console.log(`  ${v}: FAIL`);
    console.log(((e.stdout || '') + (e.stderr || '')).trim().split('\n').slice(-12).map((l) => '    ' + l).join('\n'));
  }
}
process.exitCode = failed ? 1 : 0;
console.log(failed ? '\nFAILED — fix the violations above before shipping.' : '\nAll validators passed.');
