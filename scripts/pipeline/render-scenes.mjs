#!/usr/bin/env node
/**
 * Render every scene of a play as a compact TLN-prefixed text file, so annotator
 * subagents read a small per-scene file instead of the whole (large) text.json.
 *
 * Usage:  node scripts/pipeline/render-scenes.mjs <slug>
 * Reads:  data/plays/<slug>/text.json
 * Writes: data/plays/<slug>/_candidates/scene-<act>-<scene>.txt   (gitignored)
 *
 * Also prints a ready-to-paste `scenes` array for workflows/annotate.mjs, with a
 * suggested per-scene annotation target (~1 per 12 spoken lines, min 4).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const slug = process.argv[2];
if (!slug) { console.error('usage: node scripts/pipeline/render-scenes.mjs <slug>'); process.exit(2); }

const playDir = resolve(ROOT, 'data', 'plays', slug);
const text = JSON.parse(readFileSync(resolve(playDir, 'text.json'), 'utf8'));
const outDir = resolve(playDir, '_candidates');
mkdirSync(outDir, { recursive: true });

let n = 0;
const sceneArg = [];
for (const act of text.acts) {
  for (const sc of act.scenes) {
    const out = [`ACT ${act.number} SCENE ${sc.number}`];
    if (sc.setting) out.push(`SETTING: ${sc.setting}`);
    out.push(`TLN range: ${sc.tln_start}-${sc.tln_end}`, '');
    for (const l of sc.lines) {
      if (l.kind === 'spoken') out.push(`[TLN ${l.tln}] ${l.speaker}: ${l.text}`);
      else if (l.kind === 'stage_direction') out.push(`      (stage: ${(l.stage_directions ?? []).join(' / ')})`);
    }
    writeFileSync(resolve(outDir, `scene-${act.number}-${sc.number}.txt`), out.join('\n'), 'utf8');
    const spoken = sc.lines.filter((l) => l.kind === 'spoken').length;
    sceneArg.push(`[${act.number},${sc.number},${Math.max(4, Math.round(spoken / 12))}]`);
    n++;
  }
}
console.log(`render-scenes ${slug}: wrote ${n} scene files to ${outDir}`);
console.log(`tln_count=${text.tln_count} acts=${text.acts.length} scenes=${n}`);
console.log(`\nscenes arg for workflows/annotate.mjs:\n[${sceneArg.join(',')}]`);
