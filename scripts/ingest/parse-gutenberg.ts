#!/usr/bin/env tsx
/**
 * Parse a Project Gutenberg / Open Shakespeare modern-spelling text into a structured PlayText.
 *
 * Usage:
 *   tsx scripts/ingest/parse-gutenberg.ts <slug>
 *
 * Reads:
 *   shakespeare-material-master/texts/gutenberg/<slug>_gut.txt
 *   data/plays/<slug>/characters.json   (optional; used to canonicalize speaker labels)
 *   data/catalog/works.json             (optional; used for the canonical title)
 * Writes:
 *   data/plays/<slug>/text.json (draft — no TLN yet; run normalize-tln.ts next)
 *
 * Format handled (verified against hamlet_gut.txt):
 *   - Front matter precedes the first "ACT" line and is skipped.
 *   - "ACT I." / "Scene I. <setting>" headers (roman or arabic numerals).
 *   - Blank-line-delimited blocks. A block's first line is a SPEAKER label
 *     (e.g. "Ham.", "P. King.", "1 Clown."); the remaining lines are spoken text.
 *   - Stage directions are whole-line "[...]" (may span multiple physical lines).
 *   - Missing act headers (e.g. Hamlet has no "ACT II.") are recovered: a scene
 *     whose number is <= the current act's last scene number starts a new act.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { gutenbergModernPath, playDir, CATALOG_PATH } from '../lib/paths.ts';

const slug = process.argv[2];
if (!slug) {
  console.error('usage: tsx scripts/ingest/parse-gutenberg.ts <slug>');
  process.exit(2);
}

const sourcePath = gutenbergModernPath(slug);
if (!existsSync(sourcePath)) {
  console.error(`source not found: ${sourcePath}`);
  process.exit(1);
}
const raw = readFileSync(sourcePath, 'utf8');
let allLines = raw.split(/\r?\n/);

// ---- canonicalization map from characters.json (alias -> {id, name}) ----
const aliasToChar = new Map<string, { id: string; name: string }>();
const charPath = resolve(playDir(slug), 'characters.json');
if (existsSync(charPath)) {
  const chars: { id: string; name: string; aliases?: string[] }[] = JSON.parse(readFileSync(charPath, 'utf8'));
  for (const c of chars) {
    for (const a of c.aliases ?? []) aliasToChar.set(a, { id: c.id, name: c.name });
  }
}

// ---- canonical title from catalog ----
let title = '';
if (existsSync(CATALOG_PATH)) {
  const catalog: { playId: string; title: string }[] = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  title = catalog.find((c) => c.playId === slug)?.title ?? '';
}

// ---- patterns ----
// Act headers: roman ("ACT I."), arabic ("ACT 1."), or a spelled-out ordinal
// ("ACT FIRST.") — Henry V's edition mixes ordinal-word odd acts with roman even acts.
const ACT_HEADER = /^\s*ACT\s+(?<num>[IVXLC]+|\d+|FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH)\.?\s*$/i;
const SCENE_HEADER = /^\s*Scene\s+(?<num>[IVXLC]+|\d+)\.?\s*(?<setting>.*)$/i;
// Song / verse section markers (e.g. "SONG.", "CHORUS.", "I.", "II.") that appear
// inside lyric passages and must NOT be misread as speaker labels.
const SONG_HEADER = /^(?:SONG|AIR|EPILOGUE|EPITAPH)\.?$/;
const VERSE_NUMERAL = /^[IVXLC]+\.$/;
const CHORUS_HEADER = /^CHORUS\.?$/;
// A "THE PROLOGUE" header (Romeo and Juliet's Act 1 Chorus prologue precedes the
// first ACT header and would otherwise be skipped as front matter). Requires the
// leading "THE" so a play-within-a-play's bare "PROLOGUE" speaker (e.g. the
// mechanicals in A Midsummer Night's Dream) is NOT misread as a chorus prologue.
const PROLOGUE_HEADER = /^\s*THE\s+PROLOGUE\.?\s*$/i;
// A scene setting that wraps onto a second physical line ends on a dangling
// function word (e.g. "...overlooking the" + "Garden."); used to rejoin them.
const SETTING_DANGLES = /\b(?:the|a|an|of|to|and|in|on|at|with|from|for|by|near|before)$/i;

// --- framing-speech support (Chorus prologues, Inductions, Epilogues) ---
// Each new behavior below is GATED on the play defining the relevant speaker in
// characters.json, so plays without a Chorus/Rumour stay byte-identical. Henry V uses an
// uppercase CHORUS. speaker and a bare "PROLOGUE." header (no leading "THE") before every
// act; Romeo and Juliet uses a title-case Chorus and a "THE PROLOGUE" header, so the
// bare-prologue rule never fires for it. Henry IV Part 2 opens with an "INDUCTION" spoken
// by RUMOUR. "EPILOGUE." is handled where SONG_HEADER is tested (it is aliased to a
// Chorus/Dancer in those two plays so it reads as speech, not a stage direction).
const hasUpperChorus = aliasToChar.has('CHORUS.');
const hasRumour = aliasToChar.has('RUMOUR.');
const BARE_PROLOGUE_HEADER = /^\s*PROLOGUE\.?\s*$/i;
const INDUCTION_HEADER = /^\s*INDUCTION\.?\s*$/i;
function isFramingHeader(t: string): boolean {
  if (PROLOGUE_HEADER.test(t)) return true; // "THE PROLOGUE" (Romeo and Juliet)
  if (hasUpperChorus && BARE_PROLOGUE_HEADER.test(t)) return true; // "PROLOGUE." before every act (Henry V)
  if (hasRumour && INDUCTION_HEADER.test(t)) return true; // "INDUCTION" (Henry IV Part 2)
  return false;
}

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
const ORDINAL_WORDS: Record<string, number> = {
  FIRST: 1, SECOND: 2, THIRD: 3, FOURTH: 4, FIFTH: 5,
  SIXTH: 6, SEVENTH: 7, EIGHTH: 8, NINTH: 9, TENTH: 10,
};
function toInt(s: string): number {
  if (/^\d+$/.test(s)) return Number(s);
  const up = s.toUpperCase();
  return ORDINAL_WORDS[up] ?? ROMAN[up] ?? 0;
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'my', 'is', 'in', 'it', 'that', 'you', 'we', 'i',
  'his', 'her', 'with', 'like', 'for', 'go', 'so', 'no', 'be', 'and', 'or', 'but',
  'this', 'thee', 'thou', 'thy', "e'en", 'say', 'come', 'here', 'there',
]);

/** A block-start line is a speaker label if it is a known alias, or it has the shape
 *  of a speech prefix: ends with '.', 1-4 tokens, every token a digit, "and", or a
 *  short Capitalized word. Sentences are rejected because they carry lowercase words. */
function looksLikeSpeaker(line: string): boolean {
  if (aliasToChar.has(line)) return true;
  if (!line.endsWith('.')) return false;
  if (line.length > 18) return false;
  const tokens = line.replace(/\.$/, '').split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 4) return false;
  for (const t of tokens) {
    const bare = t.replace(/\.$/, '');
    if (/^\d+$/.test(bare)) continue;              // 1, 2
    if (bare === 'and') continue;                  // "Ros. and Guil."
    if (/^[A-Z][A-Za-z']{0,11}$/.test(bare)) {     // Ros, Guil, King, Clown, Priest, Player, Ambassador, Gentleman
      if (STOPWORDS.has(bare.toLowerCase()) && bare.length > 1) return false;
      continue;
    }
    return false;
  }
  return true;
}

function canonical(label: string): { id?: string; name: string } {
  const hit = aliasToChar.get(label);
  if (hit) return { id: hit.id, name: hit.name };
  // Unison speech prefix: two-or-more all-caps dotted names speaking together,
  // e.g. "TITINIUS. MESSALA." or "VARRO. CLAUDIUS." The editions don't define a
  // joint alias, so resolve each part and join their proper names ("Titinius and
  // Messala"). Only collapses when EVERY part is a known character; otherwise
  // falls through to the raw label so an unmapped speaker stays visible.
  const parts = label.match(/[^.\s]+\./g);
  if (parts && parts.length >= 2 && parts.every((p) => /^[A-Z][A-Z]+\.$/.test(p) && aliasToChar.has(p))) {
    const names = parts.map((p) => aliasToChar.get(p)!.name);
    return { name: names.join(' and ') };
  }
  return { name: label.replace(/\.$/, '') };
}

interface DraftLine {
  kind: 'spoken' | 'stage_direction' | 'blank';
  speaker?: string;
  speaker_id?: string;
  speaker_raw?: string;
  text?: string;
  stage_directions?: string[];
}
interface DraftScene { id: string; number: number; setting?: string; lines: DraftLine[]; }
interface DraftAct { id: string; number: number; title: string; scenes: DraftScene[]; }

const acts: DraftAct[] = [];
let currentAct: DraftAct | null = null;
let currentScene: DraftScene | null = null;
let curSpeaker: { id?: string; name: string } | null = null;
let curSpeakerRaw: string | null = null;
let expectSpeaker = false;
let lastSceneNum = 0;
// A Chorus prologue / Induction is buffered here and prepended to the first scene of
// the act it introduces. Re-armable: each framing trigger reopens the buffer and
// pushScene flushes-then-clears it, so a Chorus before every act (Henry V) lands at the
// head of each act in turn. Only populated when a framing speaker / direction is present
// (Romeo and Juliet's Chorus, Henry V's Chorus, Henry IV Part 2's Rumour) — other plays
// are unaffected.
let inPrologue = false;
let pendingPrologue: DraftLine[] | null = null;

function startPrologue() {
  if (!inPrologue) {
    inPrologue = true;
    if (!pendingPrologue) pendingPrologue = [];
  }
}
/** Where new lines go: the buffered prologue while it is open, else the scene. */
function currentSink(): DraftLine[] | null {
  if (inPrologue && pendingPrologue) return pendingPrologue;
  return currentScene ? currentScene.lines : null;
}

function pushAct(num: number, titleText: string) {
  currentAct = { id: `${slug}-${num}`, number: num, title: titleText, scenes: [] };
  acts.push(currentAct);
  lastSceneNum = 0;
  curSpeaker = null;
  curSpeakerRaw = null;
}
function pushScene(num: number, setting: string | undefined) {
  if (!currentAct) pushAct(1, 'ACT I.');
  currentScene = { id: `${currentAct!.id}-${num}`, number: num, setting: setting?.trim() || undefined, lines: [] };
  currentAct!.scenes.push(currentScene);
  lastSceneNum = num;
  expectSpeaker = true;
  curSpeaker = null;
  curSpeakerRaw = null;
  // Prepend a buffered Chorus prologue so it reads at the head of the act it
  // introduces (the first scene opened after the prologue was buffered).
  if (inPrologue && pendingPrologue && pendingPrologue.length) {
    currentScene.lines.unshift(...pendingPrologue);
  }
  if (inPrologue) {
    inPrologue = false;
    pendingPrologue = null;
  }
}

// --- Henry VI edition normalization (gated on slug) -----------------------------
// The vendored Open Shakespeare transcription of the three Henry VI plays differs from
// every other shipped text in two ways the generic parser mis-handles:
//   (1) MANY stage directions are NOT wrapped in [ ] — e.g. the opening "Dead March.
//       Enter the funeral of King Henry the Fifth..." or a mid-scene "Here alarum; they
//       are beaten back by the English..." — so they would be read as dialogue under the
//       previous speaker; and
//   (2) a scene's setting is sometimes printed on the line AFTER the SCENE header
//       ("SCENE I" / blank / "Westminster Abbey.") instead of inline, and a two-word
//       setting like "Westminster Abbey." is otherwise mistaken for a speaker label.
// This pass rewrites both shapes into the canonical bracketed-SD / inline-setting form
// the parser already understands. It is GATED on the slug, so the eight shipped plays
// never execute it and stay byte-identical (confirmed by a re-ingest diff). It relies on
// a structural invariant of THIS edition: a dialogue block always begins with a speaker
// label and never contains an internal blank line, so any blank-delimited block that is
// neither bracketed, nor a header, nor speaker-led is a stage direction (or, immediately
// after a setting-less SCENE header, the scene's setting).
const HENRY_VI_SLUGS = new Set(['henry_vi_part_1', 'henry_vi_part_2', 'henry_vi_part_3']);

// High-confidence stage-direction openers — words that begin a stage direction but
// essentially never begin a line of dialogue. A non-speaker-led block is wrapped as an
// unbracketed stage direction ONLY when its first line matches this; otherwise it is left
// untouched (this edition splits long speeches with internal blank lines, so a block can
// be a dialogue continuation that carries no speaker label — wrapping that would destroy
// real dialogue and shift every later TLN, whereas leaving a true SD as dialogue is a
// harmless blemish). Cue lines that sit INSIDE a speaker-led block (e.g. Bedford's "Here
// sound retreat...") are never tested here — the block is classified as a speech first.
const SD_CUE = /^(?:Enter|Re-?enter|Exeunt|Exit|Alarums?|Alarms?|Excursions?|Flourish|Sennet|Tucket|Retreat|Hautboys|Cornets|Drums?|Trumpets?|Skirmish|Dead March|A dead march|A flourish|A short alarum|An alarum|A parley|A noise|A sennet|A long flourish|Sound|Here alarum|Here an alarum|Here they fight|Here they skirmish|They fight|They march)\b/;

function normalizeHenryVIEdition(src: string[]): string[] {
  const out: string[] = [];
  let settinglessScene = false; // the most recent SCENE header carried no inline setting
  let i = 0;
  while (i < src.length) {
    const line = src[i] ?? '';
    const trimmed = line.trim();
    if (trimmed === '') { out.push(line); i++; continue; }
    if (ACT_HEADER.test(trimmed)) { out.push(line); settinglessScene = false; i++; continue; }
    const sm = trimmed.match(SCENE_HEADER);
    if (sm) {
      out.push(line);
      settinglessScene = (sm.groups?.setting ?? '').trim() === '';
      i++;
      continue;
    }
    // Gather the current blank-delimited block.
    let j = i;
    while (j < src.length && (src[j] ?? '').trim() !== '') j++;
    const block = src.slice(i, j);
    const first = (block[0] ?? '').trim();
    const hasBracket = block.some((l) => l.includes('[') || l.includes(']'));

    if (first.startsWith('[')) {
      // already a (possibly multi-line) bracketed stage direction
      for (const l of block) out.push(l);
      settinglessScene = false;
    } else if (settinglessScene && block.length === 1) {
      // the scene's setting, printed on its own line: fold it into the SCENE header
      let k = out.length - 1;
      while (k >= 0 && out[k].trim() === '') k--;
      if (k >= 0) {
        const head = out[k].replace(/\s*$/, '');
        out[k] = head + (/[.:!?]$/.test(head) ? ' ' : '. ') + first;
      } else {
        out.push(line);
      }
      settinglessScene = false;
    } else if (looksLikeSpeaker(first)) {
      // a speaker-led block (a speech, which may itself span an internal blank line
      // elsewhere) — leave it for the generic parser to attribute
      for (const l of block) out.push(l);
      settinglessScene = false;
    } else if (!hasBracket && SD_CUE.test(first)) {
      // an unbracketed stage direction (single- or multi-line): wrap the block in [ ]
      const w = block.slice();
      w[0] = w[0].replace(/^(\s*)/, '$1[');
      const last = w.length - 1;
      w[last] = w[last].replace(/\s*$/, '') + ']';
      for (const l of w) out.push(l);
      settinglessScene = false;
    } else {
      // neither speaker-led nor a recognized stage cue: a dialogue continuation after an
      // internal blank, or a stray bracket fragment. The generic parser keeps it under the
      // current speaker, so leave it untouched.
      for (const l of block) out.push(l);
      settinglessScene = false;
    }
    i = j;
  }
  return out;
}

if (HENRY_VI_SLUGS.has(slug)) allLines = normalizeHenryVIEdition(allLines);

// find content start: the first ACT header, or an earlier framing header (a Chorus
// prologue or an Induction) if one precedes it. Plays with no leading framing speech
// are unaffected — the ACT header is still the first match (isFramingHeader reduces to
// the gated "THE PROLOGUE" check). Henry V also needs this because its first ACT header
// is the ordinal-word "ACT FIRST.", now matched by ACT_HEADER.
const firstActIdx = allLines.findIndex((l) => ACT_HEADER.test(l.trim()));
const firstFramingIdx = allLines.findIndex((l) => isFramingHeader(l.trim()));
let i =
  firstFramingIdx >= 0 && (firstActIdx < 0 || firstFramingIdx < firstActIdx)
    ? firstFramingIdx
    : firstActIdx;
if (i < 0) {
  console.error('no "ACT ..." header found; cannot parse this file shape.');
  process.exit(3);
}

for (; i < allLines.length; i++) {
  const rawLine = allLines[i] ?? '';
  const trimmed = rawLine.trim();
  let m: RegExpMatchArray | null;

  if ((m = trimmed.match(ACT_HEADER))) {
    const n = toInt(m.groups!.num);
    if (n > 0) { pushAct(n, trimmed); continue; }
  }
  if ((m = trimmed.match(SCENE_HEADER))) {
    const n = toInt(m.groups!.num);
    if (n > 0) {
      let setting = (m.groups!.setting ?? '').trim();
      // Rejoin a setting that wraps onto the next physical line(s). Guarded to
      // only fire when the setting ends on a dangling function word, so a real
      // following speaker label or stage direction is never swallowed.
      while (setting && SETTING_DANGLES.test(setting) && i + 1 < allLines.length) {
        const nxt = (allLines[i + 1] ?? '').trim();
        if (nxt === '' || ACT_HEADER.test(nxt) || SCENE_HEADER.test(nxt) || nxt.includes('[')) break;
        i += 1;
        setting += ' ' + nxt;
      }
      if (currentAct && n <= lastSceneNum) {
        // missing ACT header (e.g. Hamlet's ACT II) — open the next act
        pushAct(currentAct.number + 1, `ACT ${currentAct.number + 1}.`);
      }
      pushScene(n, setting);
      continue;
    }
  }
  // A framing-section header ("THE PROLOGUE" / bare "PROLOGUE." / "INDUCTION") opens a
  // Chorus/Induction buffer flushed to the head of the next scene. Gated (isFramingHeader)
  // so plays without a Chorus/Rumour are byte-identical, and guarded against an aliased
  // speaker label so a real "PROLOGUE." speaker is never hijacked.
  if (isFramingHeader(trimmed) && !aliasToChar.has(trimmed)) {
    startPrologue();
    continue;
  }
  if (trimmed === '') {
    const sink = currentSink();
    if (sink) sink.push({ kind: 'blank' });
    expectSpeaker = true;
    continue;
  }
  if (trimmed.includes('[')) {
    // A line with brackets: pure stage direction, or an inline "[SD] dialogue"
    // (asides), or "dialogue [SD]". Accumulate physical lines until brackets balance.
    let s = trimmed;
    while (countChar(s, '[') > countChar(s, ']') && i + 1 < allLines.length) {
      const nxt = (allLines[i + 1] ?? '').trim();
      // Never chase a closing bracket across a blank line or an act/scene
      // header: an unclosed '[' (a Gutenberg typo) would otherwise swallow the
      // rest of the play. Stop here; handleBracketed copes with the missing ']'.
      if (nxt === '' || ACT_HEADER.test(nxt) || SCENE_HEADER.test(nxt)) break;
      i += 1;
      s += ' ' + nxt;
    }
    handleBracketed(s);
    continue;
  }
  // Song / verse section markers ("SONG.", "I.", "II.") sit inside lyric passages;
  // render them as stage directions and don't break the speaker. EXCEPTION: if the token
  // is a defined speaker alias, fall through to the speaker path — Henry V / Henry IV
  // Part 2 alias "EPILOGUE." to a Chorus/Dancer so the epilogue reads as speech.
  if ((SONG_HEADER.test(trimmed) || VERSE_NUMERAL.test(trimmed)) && !aliasToChar.has(trimmed)) {
    emitSD(trimmed);
    continue;
  }
  // "CHORUS." / "CHORUS" switches the speaker to the group "All" if that
  // alias is defined; otherwise treat as a section marker.
  if (CHORUS_HEADER.test(trimmed)) {
    if (aliasToChar.has(trimmed) || aliasToChar.has('CHORUS') || aliasToChar.has('CHORUS.')) {
      const key = aliasToChar.has(trimmed) ? trimmed : (aliasToChar.has('CHORUS.') ? 'CHORUS.' : 'CHORUS');
      curSpeakerRaw = trimmed;
      curSpeaker = canonical(key);
      expectSpeaker = false;
    } else {
      emitSD(trimmed);
    }
    continue;
  }
  if (expectSpeaker && looksLikeSpeaker(trimmed)) {
    curSpeakerRaw = trimmed;
    curSpeaker = canonical(trimmed);
    expectSpeaker = false;
    continue;
  }
  // A performance rubric on a framing speech (e.g. "Spoken by a Dancer." under Henry IV
  // Part 2's Epilogue) is a stage direction, not dialogue. Gated to framing plays so the
  // shipped plays are byte-identical.
  if ((hasUpperChorus || hasRumour) && /^(?:spoken|sung|said) by\b/i.test(trimmed)) {
    emitSD(trimmed);
    continue;
  }
  emitDialogue(trimmed);
  // else: stray line with no speaker (front-matter remnant) — dropped inside emitDialogue
}

function countChar(s: string, ch: string): number {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

function emitDialogue(text: string) {
  const sink = currentSink();
  if (!sink || !curSpeaker || text.trim() === '') return;
  sink.push({
    kind: 'spoken',
    speaker: curSpeaker.name,
    speaker_id: curSpeaker.id,
    speaker_raw: curSpeakerRaw ?? undefined,
    text: text.trim(),
  });
  expectSpeaker = false;
}

function emitSD(text: string) {
  if (text.trim() === '') return;
  // An "Enter Chorus" direction opens a prologue/chorus passage we buffer and
  // prepend to the next scene of the act it introduces.
  if (!inPrologue && /enter\s+(?:chorus|rumour)/i.test(text)) startPrologue();
  const sink = currentSink();
  if (!sink) return;
  sink.push({ kind: 'stage_direction', stage_directions: [text.trim()] });
  expectSpeaker = true;
}

/** Split a bracket-bearing line into ordered SD and dialogue segments. */
function handleBracketed(s: string) {
  let rest = s;
  let lastWasSD = false;
  while (rest.length) {
    const open = rest.indexOf('[');
    if (open < 0) {
      const txt = rest.trim();
      if (txt) { dispatchText(txt); lastWasSD = false; }
      break;
    }
    if (open > 0) {
      const txt = rest.slice(0, open).trim();
      if (txt) { dispatchText(txt); lastWasSD = false; }
    }
    const close = rest.indexOf(']', open);
    if (close < 0) {
      emitSD(rest.slice(open + 1).trim());
      lastWasSD = true;
      break;
    }
    emitSD(rest.slice(open + 1, close).trim());
    lastWasSD = true;
    rest = rest.slice(close + 1);
  }
  // expectSpeaker is true iff the line ended on a stage direction
  expectSpeaker = lastWasSD;
}

/** A text segment of a bracketed line: a speaker label if we're expecting one, else dialogue. */
function dispatchText(txt: string) {
  if (expectSpeaker && looksLikeSpeaker(txt)) {
    curSpeakerRaw = txt;
    curSpeaker = canonical(txt);
    expectSpeaker = false;
  } else {
    emitDialogue(txt);
  }
}

// Safety: a trailing Chorus/epilogue with no following scene — append it to the
// last scene so the buffered lines are never silently dropped.
if (inPrologue && pendingPrologue && pendingPrologue.length && currentScene) {
  currentScene.lines.push(...pendingPrologue);
  inPrologue = false;
  pendingPrologue = null;
}

if (acts.length === 0) {
  console.error('no acts parsed.');
  process.exit(3);
}

// strip speaker_id when undefined to keep JSON clean
const out = {
  play: slug,
  title,
  source: {
    edition: 'Project Gutenberg / Open Shakespeare, modern spelling',
    file: `shakespeare-material-master/texts/gutenberg/${slug}_gut.txt`,
  },
  acts: acts.map((a) => ({
    id: a.id,
    number: a.number,
    title: a.title,
    scenes: a.scenes.map((s) => ({
      id: s.id,
      number: s.number,
      setting: s.setting,
      lines: s.lines.map((l) => {
        if (l.kind === 'spoken') {
          const base: Record<string, unknown> = { kind: 'spoken', speaker: l.speaker, text: l.text };
          if (l.speaker_id) base.speaker_id = l.speaker_id;
          if (l.speaker_raw) base.speaker_raw = l.speaker_raw;
          return base;
        }
        if (l.kind === 'stage_direction') return { kind: 'stage_direction', stage_directions: l.stage_directions };
        return { kind: 'blank' };
      }),
    })),
  })),
};

const dir = playDir(slug);
mkdirSync(dir, { recursive: true });
const outPath = resolve(dir, 'text.json');
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

const sceneCount = acts.reduce((n, a) => n + a.scenes.length, 0);
const spokenCount = acts.reduce((n, a) => n + a.scenes.reduce((m, s) => m + s.lines.filter((l) => l.kind === 'spoken').length, 0), 0);
console.log(`parse-gutenberg: ${slug} → ${acts.length} acts, ${sceneCount} scenes, ${spokenCount} spoken lines.`);
console.log(`  wrote ${outPath}`);
console.log(`  next: tsx scripts/ingest/normalize-tln.ts ${slug}`);
