#!/usr/bin/env tsx
/**
 * Spawn a Sonnet subagent to draft candidate annotations for a single scene.
 *
 * Usage:
 *   tsx scripts/generate/annotate-scene.ts <slug> <act> <scene>
 *
 * Reads:
 *   data/plays/<slug>/text.json
 *   data/plays/<slug>/characters.json (if present)
 *   data/plays/<slug>/synopsis.json (if present, used for prior-scene context)
 *   scripts/generate/prompts/annotator.md
 *
 * Writes:
 *   data/plays/<slug>/_candidates/<act>-<scene>.json (gitignored intermediate)
 *
 * STATUS: SDK call is stubbed. The pilot session wires in @anthropic-ai/sdk
 * and decides on caching, retries, and rate-limit handling.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { playDir } from '../lib/paths.ts';

const [slug, actArg, sceneArg] = process.argv.slice(2);
if (!slug || !actArg || !sceneArg) {
  console.error('usage: tsx scripts/generate/annotate-scene.ts <slug> <act> <scene>');
  process.exit(2);
}
const actNum = Number(actArg);
const sceneNum = Number(sceneArg);

const dir = playDir(slug);
const text = JSON.parse(readFileSync(resolve(dir, 'text.json'), 'utf8'));
const act = text.acts.find((a: { number: number }) => a.number === actNum);
if (!act) {
  console.error(`act ${actNum} not found in ${slug}`);
  process.exit(1);
}
const scene = act.scenes.find((s: { number: number }) => s.number === sceneNum);
if (!scene) {
  console.error(`scene ${actNum}.${sceneNum} not found in ${slug}`);
  process.exit(1);
}

let characters: unknown = [];
const charPath = resolve(dir, 'characters.json');
if (existsSync(charPath)) characters = JSON.parse(readFileSync(charPath, 'utf8'));

let synopsis: unknown = null;
const synPath = resolve(dir, 'synopsis.json');
if (existsSync(synPath)) synopsis = JSON.parse(readFileSync(synPath, 'utf8'));

const promptTemplate = readFileSync(resolve(import.meta.dirname, 'prompts', 'annotator.md'), 'utf8');

const sceneText = renderSceneForPrompt(scene);

function renderSceneForPrompt(scene: {
  setting?: string;
  lines: { kind: string; tln?: number; speaker?: string; text?: string; stage_directions?: string[] }[];
}): string {
  const out: string[] = [];
  if (scene.setting) out.push(`SETTING: ${scene.setting}`);
  out.push('');
  for (const line of scene.lines) {
    if (line.kind === 'spoken') {
      out.push(`[TLN ${line.tln}] ${line.speaker}: ${line.text}`);
    } else if (line.kind === 'stage_direction') {
      out.push(`[stage direction] ${(line.stage_directions ?? []).join(' / ')}`);
    }
  }
  return out.join('\n');
}

const prompt = promptTemplate
  .replace('{{PLAY_SLUG}}', slug)
  .replace('{{ACT}}', String(actNum))
  .replace('{{SCENE}}', String(sceneNum))
  .replace('{{SETTING}}', scene.setting ?? '')
  .replace('{{CHARACTERS_JSON}}', JSON.stringify(characters, null, 2))
  .replace('{{PRIOR_SCENE_SUMMARY}}', summarizePrior(text, actNum, sceneNum, synopsis))
  .replace('{{SCENE_TEXT}}', sceneText);

function summarizePrior(
  text: { acts: { number: number; scenes: { number: number }[] }[] },
  a: number,
  s: number,
  syn: unknown,
): string {
  // TODO(pilot): pull from synopsis.json if present. For now, just label.
  if (a === 1 && s === 1) return '(This is the opening scene.)';
  return `(Prior scene: Act ${s > 1 ? a : a - 1}, Scene ${s > 1 ? s - 1 : 'final'}. Summary will be loaded from synopsis.json in the pilot.)`;
}

// --- SDK call (stubbed) ---
async function callSonnet(prompt: string): Promise<string> {
  // TODO(pilot): import('@anthropic-ai/sdk') lazily; configure prompt caching;
  // request claude-sonnet-4-6 with extended thinking off; expect a JSON array reply.
  console.error('annotate-scene: SDK call not yet wired. Printing the assembled prompt to stdout for inspection.');
  console.log(prompt);
  return '[]';
}

const reply = await callSonnet(prompt);
let candidates: unknown;
try {
  candidates = JSON.parse(reply);
} catch {
  console.error('annotate-scene: model reply was not valid JSON; saving raw reply for inspection.');
  candidates = { _raw: reply };
}

const outDir = resolve(dir, '_candidates');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, `${actNum}-${sceneNum}.json`);
writeFileSync(outPath, JSON.stringify(candidates, null, 2), 'utf8');
console.error(`annotate-scene: wrote candidates to ${outPath}`);
