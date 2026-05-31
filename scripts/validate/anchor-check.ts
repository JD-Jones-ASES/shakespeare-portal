#!/usr/bin/env tsx
/**
 * For every annotation, confirm:
 *   - tln_start and tln_end exist in the play's text.json
 *   - anchor_text is present at [word_start..word_end] on the anchored line(s)
 *
 * Exits non-zero on any mismatch.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, basename, relative } from 'node:path';
import { PLAYS_DIR, REPO_ROOT } from '../lib/paths.ts';

interface Line {
  kind: string;
  tln?: number;
  text?: string;
}

interface Scene {
  lines: Line[];
}

interface Act {
  scenes: Scene[];
}

interface PlayText {
  play: string;
  acts: Act[];
}

interface Annotation {
  id: string;
  play: string;
  tln_start: number;
  tln_end: number;
  word_start: number;
  word_end: number;
  anchor_text: string;
}

interface Violation {
  annotation_id: string;
  reason: string;
}

function indexLinesByTln(play: PlayText): Map<number, string> {
  const map = new Map<number, string>();
  for (const act of play.acts) {
    for (const scene of act.scenes) {
      for (const line of scene.lines) {
        if (line.kind === 'spoken' && line.tln !== undefined && line.text !== undefined) {
          map.set(line.tln, line.text);
        }
      }
    }
  }
  return map;
}

function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

function checkAnnotation(ann: Annotation, byTln: Map<number, string>): string | null {
  if (ann.tln_start > ann.tln_end) {
    return `tln_start (${ann.tln_start}) > tln_end (${ann.tln_end})`;
  }
  const startLine = byTln.get(ann.tln_start);
  if (startLine === undefined) {
    return `tln_start ${ann.tln_start} not found in play text`;
  }
  const endLine = byTln.get(ann.tln_end);
  if (endLine === undefined) {
    return `tln_end ${ann.tln_end} not found in play text`;
  }

  // Construct the anchored span as words.
  let spanWords: string[] = [];
  if (ann.tln_start === ann.tln_end) {
    const words = wordsOf(startLine);
    if (ann.word_start > ann.word_end) {
      return `word_start (${ann.word_start}) > word_end (${ann.word_end}) on single line`;
    }
    if (ann.word_end >= words.length) {
      return `word_end ${ann.word_end} exceeds line word count ${words.length}`;
    }
    spanWords = words.slice(ann.word_start, ann.word_end + 1);
  } else {
    // Multi-line: from word_start of start line to word_end of end line, with everything between.
    const startWords = wordsOf(startLine);
    const endWords = wordsOf(endLine);
    if (ann.word_start >= startWords.length) {
      return `word_start ${ann.word_start} exceeds start line word count ${startWords.length}`;
    }
    if (ann.word_end >= endWords.length) {
      return `word_end ${ann.word_end} exceeds end line word count ${endWords.length}`;
    }
    spanWords.push(...startWords.slice(ann.word_start));
    for (let tln = ann.tln_start + 1; tln < ann.tln_end; tln++) {
      const mid = byTln.get(tln);
      if (mid === undefined) {
        return `intermediate TLN ${tln} not found`;
      }
      spanWords.push(...wordsOf(mid));
    }
    spanWords.push(...endWords.slice(0, ann.word_end + 1));
  }

  const candidate = spanWords.join(' ');
  // Forgiving compare: collapse all whitespace and case.
  const norm = (s: string) => s.replace(/[\s,.;:!?'"`()\[\]{}—–\-_/\\]/g, '').toLowerCase();
  if (!norm(candidate).includes(norm(ann.anchor_text))) {
    return `anchor_text "${ann.anchor_text}" not present at TLN ${ann.tln_start} words [${ann.word_start}..${ann.word_end}] (got "${candidate}")`;
  }
  return null;
}

function listPlaySubdirs(): string[] {
  try {
    return readdirSync(PLAYS_DIR)
      .map((d) => resolve(PLAYS_DIR, d))
      .filter((p) => {
        try { return statSync(p).isDirectory(); } catch { return false; }
      });
  } catch {
    return [];
  }
}

const violations: Violation[] = [];
let checked = 0;

for (const playDir of listPlaySubdirs()) {
  const slug = basename(playDir);
  const textPath = resolve(playDir, 'text.json');
  const annPath = resolve(playDir, 'annotations.json');
  let text: PlayText;
  let anns: Annotation[];
  try {
    text = JSON.parse(readFileSync(textPath, 'utf8'));
  } catch {
    continue; // no text yet for this play
  }
  try {
    anns = JSON.parse(readFileSync(annPath, 'utf8'));
  } catch {
    continue;
  }
  const byTln = indexLinesByTln(text);
  for (const ann of anns) {
    if (ann.play !== slug) {
      violations.push({ annotation_id: ann.id, reason: `play field "${ann.play}" doesn't match directory "${slug}"` });
      continue;
    }
    const err = checkAnnotation(ann, byTln);
    if (err) violations.push({ annotation_id: ann.id, reason: err });
    checked++;
  }
}

if (violations.length === 0) {
  console.log(`anchor-check: OK (${checked} annotation(s) checked)`);
  process.exit(0);
}

console.error(`anchor-check: ${violations.length} violation(s) in ${checked} annotation(s)`);
for (const v of violations) {
  console.error(`  ${v.annotation_id}: ${v.reason}`);
}
process.exit(1);
