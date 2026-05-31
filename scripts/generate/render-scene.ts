#!/usr/bin/env tsx
/**
 * Print a scene as TLN-prefixed text for feeding into an annotator prompt.
 * Usage: tsx scripts/generate/render-scene.ts <slug> <act> <scene>
 */
import { loadPlay, getScene, renderScene } from '../lib/text.ts';

const [slug, actArg, sceneArg] = process.argv.slice(2);
if (!slug || !actArg || !sceneArg) {
  console.error('usage: tsx scripts/generate/render-scene.ts <slug> <act> <scene>');
  process.exit(2);
}
const play = loadPlay(slug);
const scene = getScene(play, Number(actArg), Number(sceneArg));
if (!scene) { console.error(`scene ${actArg}.${sceneArg} not found`); process.exit(1); }
console.log(renderScene(scene));
