import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { playDir } from './paths.ts';

export interface Line {
  kind: string;
  tln?: number;
  speaker?: string;
  speaker_id?: string;
  text?: string;
  stage_directions?: string[];
}
export interface Scene { id: string; number: number; setting?: string; tln_start?: number; tln_end?: number; lines: Line[]; }
export interface Act { id: string; number: number; title?: string; scenes: Scene[]; }
export interface PlayText { play: string; title: string; tln_count?: number; acts: Act[]; }

export function loadPlay(slug: string): PlayText {
  return JSON.parse(readFileSync(resolve(playDir(slug), 'text.json'), 'utf8'));
}

export function getScene(play: PlayText, act: number, scene: number): Scene | undefined {
  return play.acts.find((a) => a.number === act)?.scenes.find((s) => s.number === scene);
}

export function indexByTln(play: PlayText): Map<number, Line> {
  const m = new Map<number, Line>();
  for (const a of play.acts) for (const s of a.scenes) for (const l of s.lines) {
    if (l.kind === 'spoken' && l.tln !== undefined) m.set(l.tln, l);
  }
  return m;
}

/** Strip punctuation and case for forgiving matching. */
export function norm(s: string): string {
  return s.replace(/[\s,.;:!?'"`()\[\]{}—–\-_/\\]/g, '').toLowerCase();
}

export function words(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

export interface Tok { tln: number; wi: number; n: string }

/** Flatten spoken lines in [from..to] into normalized tokens tagged (tln, word-index-in-line). */
export function buildTokens(byTln: Map<number, Line>, from: number, to: number): Tok[] {
  const toks: Tok[] = [];
  for (let t = from; t <= to; t++) {
    const line = byTln.get(t);
    if (!line || line.kind !== 'spoken' || !line.text) continue;
    words(line.text).forEach((w, wi) => {
      const n = norm(w);
      if (n) toks.push({ tln: t, wi, n });
    });
  }
  return toks;
}

/** Find an anchor (already normalized) as a substring of the normalized token window,
 *  returning the source words that contain its first and last characters. Shared by
 *  resolve-anchors.ts (candidates) and reanchor.ts (shipped annotations). */
export function matchAnchor(
  byTln: Map<number, Line>,
  from: number,
  to: number,
  targetNorm: string,
): { tlnS: number; wS: number; tlnE: number; wE: number } | null {
  const toks = buildTokens(byTln, from, to);
  let normStr = '';
  const owner: number[] = [];
  for (let k = 0; k < toks.length; k++) {
    const n = toks[k]!.n;
    for (let c = 0; c < n.length; c++) owner.push(k);
    normStr += n;
  }
  const idx = normStr.indexOf(targetNorm);
  if (idx < 0) return null;
  const a = toks[owner[idx]!]!;
  const b = toks[owner[idx + targetNorm.length - 1]!]!;
  return { tlnS: a.tln, wS: a.wi, tlnE: b.tln, wE: b.wi };
}

/** Render a scene as TLN-prefixed lines for an annotator prompt. */
export function renderScene(scene: Scene): string {
  const out: string[] = [];
  if (scene.setting) out.push(`SETTING: ${scene.setting}`, '');
  for (const l of scene.lines) {
    if (l.kind === 'spoken') out.push(`[TLN ${l.tln}] ${l.speaker}: ${l.text}`);
    else if (l.kind === 'stage_direction') out.push(`      (stage direction: ${(l.stage_directions ?? []).join(' / ')})`);
  }
  return out.join('\n');
}
