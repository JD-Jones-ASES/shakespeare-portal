#!/usr/bin/env node
/**
 * Ingest a Shakespeare POEM (not a play) from a vendored Gutenberg text into the
 * standard data/plays/<slug>/text.json shape — a "degenerate play": acts -> scenes
 * -> spoken lines, each with a continuous Through-Line Number and an EMPTY speaker
 * (poems have no speaker; the reader suppresses the speaker stripe for "").
 *
 * Deliberately SEPARATE from scripts/ingest/parse-gutenberg.ts so the play parser
 * stays byte-identical (zero regression risk to the 37 shipped plays). Self-contained:
 * assigns global TLNs directly, so normalize-tln.ts is not needed.
 *
 * Usage:  node scripts/pipeline/ingest-poem.mjs <slug>
 * Reads:  shakespeare-material-master/texts/gutenberg/<slug>_gut.txt
 * Writes: data/plays/<slug>/text.json
 *
 * Models:
 *  - 'sonnets'  : Roman-numeral headers; each sonnet a scene; the companion textbook's
 *                 11 thematic chapters become acts (verified ranges below).
 *  - 'stanzaic' : blank-line stanzas chunked into reading scenes (narrative poems);
 *                 strips right-margin line numbers; blank line between stanzas preserved.
 *  - 'single'   : one scene; blank-line stanzas; sub-headings (e.g. THRENOS) as stage
 *                 directions.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const INGESTED_AT = '2026-06-02';

// Verified against the companion textbook chapter folders ch03..ch13 (ranges sum to 154).
const SONNET_CHAPTERS = [
  { title: 'The Case for Posterity', from: 1, to: 17 },
  { title: 'Praise and Beauty', from: 18, to: 32 },
  { title: 'Shadows and Forgiveness', from: 33, to: 42 },
  { title: 'Love from Afar', from: 43, to: 58 },
  { title: 'Devouring Time', from: 59, to: 77 },
  { title: 'The Rival Poet', from: 78, to: 86 },
  { title: 'Estrangement and Return', from: 87, to: 99 },
  { title: 'Constancy and the Muse', from: 100, to: 116 },
  { title: 'Farewell to the Fair Youth', from: 117, to: 126 },
  { title: 'The Dark Lady: Desire', from: 127, to: 141 },
  { title: 'The Dark Lady: Reckoning', from: 142, to: 154 },
];

const CONFIG = {
  sonnets: { title: 'Shake-speares Sonnets', mode: 'sonnets', startAfter: /^by William Shakespeare$/i },
  venus_and_adonis: { title: 'Venus and Adonis', mode: 'stanzaic', startAfter: /^VENUS AND ADONIS$/, chunkStanzas: 28 },
  rape_of_lucrece: { title: 'The Rape of Lucrece', mode: 'stanzaic', startAfter: /^_{5,}$/, chunkStanzas: 30 },
  lovers_complaint: { title: "A Lover's Complaint", mode: 'stanzaic', startAfter: /^by William Shakespeare$/i, chunkStanzas: 16 },
  phoenix_and_the_turtle: { title: 'The Phoenix and the Turtle', mode: 'single', startAfter: /^by William Shakespeare$/i, headings: [/^THRENOS\.?$/i] },
};

const slug = process.argv[2];
if (!slug || !CONFIG[slug]) {
  console.error('usage: node scripts/pipeline/ingest-poem.mjs <slug>\n  slug one of: ' + Object.keys(CONFIG).join(', '));
  process.exit(2);
}
const cfg = CONFIG[slug];

const srcRel = `shakespeare-material-master/texts/gutenberg/${slug}_gut.txt`;
const raw = readFileSync(resolve(ROOT, srcRel), 'utf8').replace(/\r\n/g, '\n').split('\n');

// skip front matter: drop everything up to & including the LAST line matching startAfter
let start = 0;
for (let i = 0; i < raw.length; i++) if (cfg.startAfter.test(raw[i].trim())) start = i + 1;
let lines = raw.slice(start);
while (lines.length && !lines[0].trim()) lines.shift();

function clean(s) {
  return s.replace(/\s{2,}\d+\s*$/, '').trim(); // strip right-margin line numbers, drop indent
}
function romanToInt(s) {
  const m = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let n = 0;
  for (let i = 0; i < s.length; i++) { const c = m[s[i]]; const nx = m[s[i + 1]] || 0; n += c < nx ? -c : c; }
  return n;
}

let tln = 0;
const acts = [];

if (cfg.mode === 'sonnets') {
  const sonnets = []; // { num, lines:[] }
  let cur = null;
  for (const ln of lines) {
    const t = ln.trim();
    if (!t) continue;
    // A header is a roman-numeral alone on its line. Number sonnets POSITIONALLY (Nth
    // header = sonnet N): the Gutenberg source mislabels #128's header as 'CXXXIII', so
    // trusting the roman value desyncs the rest. Verse never produces an all-roman line.
    // Sonnets may run 12-15 lines (99 has 15, 126 has 12).
    if (/^[IVXLCDM]{1,9}$/.test(t)) {
      const pos = sonnets.length + 1;
      if (romanToInt(t) !== pos) console.error(`NOTE: sonnet ${pos} header printed as '${t}' (=${romanToInt(t)}) in source; numbering by position.`);
      cur = { num: pos, lines: [] };
      sonnets.push(cur);
    } else if (cur) {
      cur.lines.push(clean(ln));
    }
  }
  if (sonnets.length !== 154) console.error(`WARN: parsed ${sonnets.length} sonnets (expected 154)`);
  const odd = sonnets.filter((s) => s.lines.length < 12 || s.lines.length > 15);
  if (odd.length) console.error('WARN: unusual line counts: ' + odd.map((s) => `#${s.num}=${s.lines.length}`).join(', '));

  SONNET_CHAPTERS.forEach((ch, idx) => {
    const actNum = idx + 1;
    const scenes = [];
    for (const s of sonnets.filter((x) => x.num >= ch.from && x.num <= ch.to)) {
      const linesOut = [];
      const tlnStart = tln + 1;
      for (const vl of s.lines) { tln++; linesOut.push({ kind: 'spoken', tln, speaker: '', text: vl }); }
      scenes.push({ id: `${slug}-${actNum}-${s.num}`, number: s.num, title: `Sonnet ${s.num}`, tln_start: tlnStart, tln_end: tln, lines: linesOut });
    }
    acts.push({ id: `${slug}-${actNum}`, number: actNum, title: ch.title, scenes });
  });
} else {
  // stanzaic / single: blank-line-delimited stanzas
  const stanzas = [];
  let cur = [];
  const flush = () => { if (cur.length) { stanzas.push(cur); cur = []; } };
  for (const ln of lines) {
    const t = ln.trim();
    if (!t) { flush(); continue; }
    const isHeading = (cfg.headings || []).some((re) => re.test(t));
    cur.push(isHeading ? { heading: t } : { text: clean(ln) });
  }
  flush();

  const chunk = cfg.mode === 'single' ? Math.max(1, stanzas.length) : (cfg.chunkStanzas || 25);
  const scenes = [];
  for (let i = 0; i < stanzas.length; i += chunk) {
    const group = stanzas.slice(i, i + chunk);
    const linesOut = [];
    const tlnStart = tln + 1;
    group.forEach((st, gi) => {
      if (gi > 0) linesOut.push({ kind: 'blank' });
      for (const item of st) {
        if (item.heading) linesOut.push({ kind: 'stage_direction', stage_directions: [item.heading] });
        else { tln++; linesOut.push({ kind: 'spoken', tln, speaker: '', text: item.text }); }
      }
    });
    const sceneNo = scenes.length + 1;
    const scene = { id: `${slug}-1-${sceneNo}`, number: sceneNo, tln_start: tlnStart, tln_end: tln, lines: linesOut };
    if (cfg.mode !== 'single') { scene.title = `Part ${sceneNo}`; scene.setting = `Lines ${tlnStart}–${tln}`; }
    scenes.push(scene);
  }
  acts.push({ id: `${slug}-1`, number: 1, title: cfg.title, scenes });
}

const out = {
  play: slug,
  title: cfg.title,
  source: { edition: 'Project Gutenberg / Open Shakespeare, modern spelling', file: srcRel, ingested_at: INGESTED_AT },
  acts,
  tln_count: tln,
};
const playDir = resolve(ROOT, 'data', 'plays', slug);
mkdirSync(playDir, { recursive: true });
writeFileSync(resolve(playDir, 'text.json'), JSON.stringify(out, null, 2), 'utf8');

const nScenes = acts.reduce((a, ac) => a + ac.scenes.length, 0);
const allSpoken = acts.flatMap((a) => a.scenes.flatMap((s) => s.lines.filter((l) => l.kind === 'spoken')));
console.log(`ingest-poem ${slug}: ${acts.length} act(s), ${nScenes} scene(s), tln_count=${tln}`);
console.log(`first: [TLN ${allSpoken[0].tln}] ${allSpoken[0].text}`);
console.log(`last:  [TLN ${allSpoken[allSpoken.length - 1].tln}] ${allSpoken[allSpoken.length - 1].text}`);
