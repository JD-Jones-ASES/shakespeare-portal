#!/usr/bin/env tsx
/**
 * Build a MiniSearch-compatible JSON index over the corpus for the client search island.
 *
 * Usage:
 *   tsx scripts/build-index.ts
 *
 * Reads:
 *   data/catalog/works.json
 *   data/plays/<slug>/text.json (every play)
 *   data/plays/<slug>/annotations.json (where present)
 *
 * Writes:
 *   site/public/search-index.json
 *
 * STATUS: SKELETON. The pilot session decides on the exact MiniSearch field weights
 * and stop-word handling. For now, emits a flat array of search documents.
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { CATALOG_PATH, PLAYS_DIR, REPO_ROOT } from './lib/paths.ts';

interface Doc {
  id: string;
  kind: 'play' | 'scene' | 'line' | 'annotation';
  play: string;
  title?: string;
  act?: number;
  scene?: number;
  tln?: number;
  speaker?: string;
  text: string;
  annotation_type?: string;
  depth?: string;
}

const docs: Doc[] = [];

if (existsSync(CATALOG_PATH)) {
  const catalog: { playId: string; title_short: string; synopsis_short?: string }[] = JSON.parse(
    readFileSync(CATALOG_PATH, 'utf8'),
  );
  for (const c of catalog) {
    docs.push({
      id: `play:${c.playId}`,
      kind: 'play',
      play: c.playId,
      title: c.title_short,
      text: [c.title_short, c.synopsis_short ?? ''].join(' ').trim(),
    });
  }
}

function listDirs(dir: string): string[] {
  try {
    return readdirSync(dir).map((d) => resolve(dir, d)).filter((p) => {
      try { return statSync(p).isDirectory(); } catch { return false; }
    });
  } catch {
    return [];
  }
}

for (const playPath of listDirs(PLAYS_DIR)) {
  const slug = playPath.split(/[\\/]/).pop() ?? '';
  const textPath = resolve(playPath, 'text.json');
  const annPath = resolve(playPath, 'annotations.json');

  const sceneRanges: { act: number; scene: number; lo: number; hi: number }[] = [];

  if (existsSync(textPath)) {
    const t = JSON.parse(readFileSync(textPath, 'utf8'));
    for (const act of t.acts ?? []) {
      for (const scene of act.scenes ?? []) {
        if (scene.tln_start && scene.tln_end) {
          sceneRanges.push({ act: act.number, scene: scene.number, lo: scene.tln_start, hi: scene.tln_end });
        }
        const lineTexts: string[] = [];
        for (const line of scene.lines ?? []) {
          if (line.kind === 'spoken' && line.tln) {
            docs.push({
              id: `line:${slug}:${line.tln}`,
              kind: 'line',
              play: slug,
              act: act.number,
              scene: scene.number,
              tln: line.tln,
              speaker: line.speaker,
              text: line.text ?? '',
            });
            lineTexts.push(line.text ?? '');
          }
        }
        docs.push({
          id: `scene:${slug}:${act.number}:${scene.number}`,
          kind: 'scene',
          play: slug,
          act: act.number,
          scene: scene.number,
          text: lineTexts.join(' '),
        });
      }
    }
  }

  if (existsSync(annPath)) {
    const anns: {
      id: string; tln_start: number; type: string; depth: string; summary: string; detail?: string;
    }[] = JSON.parse(readFileSync(annPath, 'utf8'));
    for (const a of anns) {
      const sc = sceneRanges.find((s) => a.tln_start >= s.lo && a.tln_start <= s.hi);
      docs.push({
        id: `ann:${a.id}`,
        kind: 'annotation',
        play: slug,
        act: sc?.act,
        scene: sc?.scene,
        tln: a.tln_start,
        annotation_type: a.type,
        depth: a.depth,
        text: [a.summary, a.detail ?? ''].join(' ').trim(),
      });
    }
  }
}

const outDir = resolve(REPO_ROOT, 'site', 'public');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'search-index.json');
writeFileSync(outPath, JSON.stringify({ generated_at: new Date().toISOString().slice(0, 10), docs }, null, 2), 'utf8');
console.log(`build-index: ${docs.length} docs → ${outPath}`);
