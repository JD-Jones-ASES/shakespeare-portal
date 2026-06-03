#!/usr/bin/env node
/**
 * Extract the privately-authored Sonnets companion textbook into portal inputs.
 * The companion is OUR OWN WORK — a drafting aid the annotator must verify + re-cite,
 * NEVER a citable source. `reflect{}` discussion prompts are intentionally dropped (v1 scope).
 *
 * Reads:  <textbook>/chapters/chNN_.../sonnets/sonnet_NNN_companion.tex  (all 154)
 *         <textbook>/scripts/footnote_manifest.json, glossary_extras.json
 * Writes: data/plays/sonnets/_seeds.json   { "<act>-<sonnet>": "draft notes" }  (annotate.mjs seeds)
 *         data/plays/sonnets/synopsis.json (overview + 11 acts x per-sonnet \mainidea summaries)
 *         data/plays/sonnets/glossary.json (from footnote_manifest + glossary_extras; tooltip defs)
 *
 * Usage:  node scripts/pipeline/extract-sonnet-companion.mjs [textbookPath]
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TB = process.argv[2] || 'C:/Project_Launchpad/private/textbooks/Shakespeare_Sonnets';
const CH_DIR = join(TB, 'chapters');
const OUT = resolve(ROOT, 'data', 'plays', 'sonnets');

// chNN -> act number (ch03 = act 1 ... ch13 = act 11) + a short reader-facing chapter summary.
const ACT_SUMMARY = {
  1: 'The procreation sonnets: the poet urges a beautiful young man to marry and have children so his beauty will not die with him.',
  2: "Praise of the young man's beauty, and the first great claim that the poet's verse — not children — will make him immortal.",
  3: 'A first breach: the young man wrongs the poet, who struggles to forgive a betrayal that also involves his mistress.',
  4: 'Absence and separation: parted from the young man, the poet dwells on distance, sleeplessness, and jealous waiting.',
  5: 'The time-and-mortality sequence: devouring Time defaces all things, and only poetry (or memory) resists it.',
  6: "A rival poet competes for the young man's patronage and praise, stirring the speaker's self-doubt and wounded pride.",
  7: "Estrangement and return: the poet releases the young man ('Farewell, thou art too dear'), feels unworthy, and edges back.",
  8: "The poet returns to his muse and affirms a constant, unalterable love ('Let me not to the marriage of true minds').",
  9: 'Apologies for his own faults and a final envoy, closing the Fair Youth sequence (126 is a twelve-line coda).',
  10: 'The Dark Lady sequence begins: a dark-complexioned mistress, frank desire, jealousy, and self-disgust replace idealized love.',
  11: "The reckoning: lust as sin and sickness, bitter wordplay on 'Will,' and two closing Cupid sonnets (153-154).",
};
const OVERVIEW =
  "Shakespeare's 154 sonnets, first printed by Thomas Thorpe in 1609 as 'Shake-speares Sonnets,' are the most famous sonnet sequence in English. Most (1-126) are addressed to a beautiful young man — urging him first to marry, then promising to immortalize him in verse, and tracing a turbulent love through praise, betrayal, absence, and a rival poet. The last group (127-152) turns to a 'Dark Lady,' a married mistress the poet desires, distrusts, and shares with the young man; two short mythological sonnets (153-154) close the book. Each poem is a Shakespearean sonnet — three quatrains and a couplet in iambic pentameter, rhyming ABAB CDCD EFEF GG — with a 'volta' (turn of thought) usually at line 9 or the couplet. The chapters here follow the sequence's natural movements; the 1609 order is preserved throughout.";

// ---- LaTeX -> plain text helpers (brace-aware) ----
function findClose(s, openIdx) { // openIdx points at '{'
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}
function mapCmd(s, cmd, fn) {
  const tag = '\\' + cmd + '{';
  let out = s;
  for (let guard = 0; guard < 5000; guard++) {
    const idx = out.indexOf(tag);
    if (idx === -1) break;
    const open = idx + tag.length - 1;
    const close = findClose(out, open);
    if (close === -1) break;
    out = out.slice(0, idx) + fn(out.slice(open + 1, close)) + out.slice(close + 1);
  }
  return out;
}
function delatex(s) {
  if (!s) return '';
  let t = s;
  t = t.replace(/(^|[^\\])%.*$/gm, '$1');      // strip line comments (not \%)
  t = mapCmd(t, 'index', () => '');             // drop \index{...}
  t = mapCmd(t, 'sonnetref', (n) => `Sonnet ${n.trim()}`);
  for (const c of ['emph', 'textit', 'textbf', 'textsc', 'text']) t = mapCmd(t, c, (x) => x);
  t = t.replace(/``/g, '"').replace(/''/g, '"').replace(/`/g, "'"); // TeX quotes
  t = t.replace(/---/g, '—').replace(/--/g, '–'); // em/en dashes (escapes: encoding-independent)
  t = t.replace(/~/g, ' ');                                          // nbsp
  t = t.replace(/\\[a-zA-Z]+\b/g, ' ');                              // any stray \cmd
  t = t.replace(/[{}]/g, '');                                        // leftover braces
  t = t.replace(/\\([&%$#_])/g, '$1');                              // escaped specials
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}
function envBody(src, name) {
  const re = new RegExp(`\\\\begin\\{${name}\\}([\\s\\S]*?)\\\\end\\{${name}\\}`);
  const m = src.match(re);
  return m ? m[1] : null;
}
function parseVocab(wordwatch) {
  const out = [];
  const tag = '\\vocabword{';
  let i = 0;
  while ((i = wordwatch.indexOf(tag, i)) !== -1) {
    const o1 = i + tag.length - 1;
    const c1 = findClose(wordwatch, o1);
    if (c1 === -1) break;
    let j = c1 + 1; while (j < wordwatch.length && /\s/.test(wordwatch[j])) j++;
    if (wordwatch[j] !== '{') { i = c1 + 1; continue; }
    const c2 = findClose(wordwatch, j);
    if (c2 === -1) break;
    out.push({ term: delatex(wordwatch.slice(o1 + 1, c1)), def: delatex(wordwatch.slice(j + 1, c2)) });
    i = c2 + 1;
  }
  return out;
}

// ---- walk the 154 companion files ----
const seeds = {};
const scenesByAct = {}; // act -> [{number, summary, themes}]
let count = 0;
for (const ch of readdirSync(CH_DIR)) {
  const m = ch.match(/^ch(\d{2})_/);
  if (!m) continue;
  const chNum = Number(m[1]);
  if (chNum < 3 || chNum > 13) continue;
  const act = chNum - 2;
  const sdir = join(CH_DIR, ch, 'sonnets');
  if (!existsSync(sdir)) continue;
  for (const f of readdirSync(sdir)) {
    const fm = f.match(/^sonnet_(\d+)_companion\.tex$/);
    if (!fm) continue;
    const num = Number(fm[1]);
    const src = readFileSync(join(sdir, f), 'utf8');
    const mainidea = delatex(envBody(src, 'mainidea'));
    const vocab = parseVocab(envBody(src, 'wordwatch') || '');
    const ctxRaw = envBody(src, 'context');
    let ctx = null;
    if (ctxRaw) {
      const tm = ctxRaw.match(/^\s*\{([\s\S]*?)\}([\s\S]*)$/); // {Title} body
      ctx = tm ? { title: delatex(tm[1]), body: delatex(tm[2]) } : { title: '', body: delatex(ctxRaw) };
    }
    const connections = delatex(envBody(src, 'connections'));

    // seed for the annotator (verify + re-cite; never cite these notes)
    const parts = [`OVERVIEW: ${mainidea}`];
    if (vocab.length) parts.push('KEY WORDS:\n' + vocab.map((v) => `- ${v.term}: ${v.def}`).join('\n'));
    if (ctx) parts.push(`CONTEXT${ctx.title ? ' (' + ctx.title + ')' : ''}: ${ctx.body}`);
    if (connections) parts.push(`CONNECTIONS: ${connections}`);
    seeds[`${act}-${num}`] = parts.join('\n\n');

    (scenesByAct[act] = scenesByAct[act] || []).push({ number: num, summary: mainidea, themes: [] });
    count++;
  }
}
for (const a of Object.keys(scenesByAct)) scenesByAct[a].sort((x, y) => x.number - y.number);

// ---- synopsis.json ----
const synAct = [];
for (let a = 1; a <= 11; a++) synAct.push({ number: a, summary: ACT_SUMMARY[a], scenes: scenesByAct[a] || [] });
const synopsis = { play: 'sonnets', overview: OVERVIEW, acts: synAct };

// ---- glossary.json (footnote_manifest + glossary_extras; tooltip-length, deduped) ----
const TBS = join(TB, 'scripts');
const fmJson = JSON.parse(readFileSync(join(TBS, 'footnote_manifest.json'), 'utf8'));
const extras = JSON.parse(readFileSync(join(TBS, 'glossary_extras.json'), 'utf8'));
const gloss = new Map();
function addGloss(word, def) {
  const surface = String(word).toLowerCase().trim();
  const normalized = surface.replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
  if (!normalized || normalized.length < 2) return;
  if (/\s/.test(normalized) && normalized.split(/\s+/).length > 3) return; // glossary = words / short phrases
  let d = delatex(String(def));
  if (d.length > 140) d = d.slice(0, 139).replace(/\s+\S*$/, '') + '…';
  const ex = gloss.get(normalized);
  if (!ex || d.length < ex.definition.length) gloss.set(normalized, { surface, normalized, definition: d });
}
for (const [w, d] of Object.entries(fmJson.global || {})) addGloss(w, d);
for (const s of Object.values(fmJson.sonnet_specific || {})) for (const [w, d] of Object.entries(s)) addGloss(w, d);
for (const [w, d] of Object.entries(extras)) addGloss(w, d);
const glossary = { play: 'sonnets', entries: [...gloss.values()].sort((a, b) => a.surface.localeCompare(b.surface)) };

// ---- write ----
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, '_seeds.json'), JSON.stringify(seeds, null, 2), 'utf8');
writeFileSync(join(OUT, 'synopsis.json'), JSON.stringify(synopsis, null, 2), 'utf8');
writeFileSync(join(OUT, 'glossary.json'), JSON.stringify(glossary, null, 2), 'utf8');
// Per-scene seed files the annotate.mjs Workflow points the annotator at (seedDir arg):
// data/plays/sonnets/_candidates/seed-<act>-<sonnet>.txt
const candDir = join(OUT, '_candidates');
mkdirSync(candDir, { recursive: true });
for (const [key, txt] of Object.entries(seeds)) writeFileSync(join(candDir, `seed-${key}.txt`), txt, 'utf8');
console.log(`extract-sonnet-companion: ${count} sonnets parsed.`);
console.log(`  _seeds.json + _candidates/seed-*.txt: ${Object.keys(seeds).length} seeds`);
console.log(`  synopsis.json: 11 acts, ${synAct.reduce((n, a) => n + a.scenes.length, 0)} sonnet summaries`);
console.log(`  glossary.json: ${glossary.entries.length} entries`);
if (count !== 154) console.error(`WARN: expected 154 companion files, got ${count}`);
