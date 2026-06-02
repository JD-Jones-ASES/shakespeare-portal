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
// Lookup by proper name OR de-dotted alias, normalized to UPPERCASE. Used only by the
// gated singer-SD rule below to resolve a singer named in a stage direction ("[Balthasar
// sings.]") to a character; building it for every play is harmless (read only when gated).
const nameToChar = new Map<string, { id: string; name: string }>();
const charPath = resolve(playDir(slug), 'characters.json');
if (existsSync(charPath)) {
  const chars: { id: string; name: string; aliases?: string[] }[] = JSON.parse(readFileSync(charPath, 'utf8'));
  for (const c of chars) {
    for (const a of c.aliases ?? []) aliasToChar.set(a, { id: c.id, name: c.name });
    nameToChar.set(c.name.toUpperCase(), { id: c.id, name: c.name });
    for (const a of c.aliases ?? []) nameToChar.set(a.replace(/\.$/, '').toUpperCase(), { id: c.id, name: c.name });
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
// Pericles prints one unbracketed dumb-show header, "DUMB SHOW.", inside Gower's Act II
// chorus; it has the shape of a two-word speaker label, so (gated on hasGower in the main
// loop) it is rendered as a stage direction. The play's other dumb shows are already
// bracketed ("[Dumb Show.]") and travel the generic bracket path, so they need no case.
const DUMB_SHOW_HEADER = /^DUMB\s+SHOW\.?$/i;
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
// Henry VIII's "THE PROLOGUE." is immediately followed by verse with NO speaker label
// and NO "Enter Chorus" stage direction (unlike Romeo and Juliet / Henry V, whose explicit
// Chorus label sets the speaker). When the play defines a Prologue speaker, the buffered
// prologue is attributed to it in the framing-header branch below. Gated on the PROLOGUE.
// alias so the other framing plays (which have no such alias) stay byte-identical.
const hasPrologueSpeaker = aliasToChar.has('PROLOGUE.');
// Pericles' Presenter, GOWER, frames every act as a Chorus and speaks the Epilogue. Each
// act-opening chorus is introduced by an "[Enter Gower]" stage direction — in Act I with NO
// speaker label, in Acts II-V with a following "GOWER." label — and is buffered like a Chorus
// prologue (see emitSD) and prepended to the head of the act it introduces. SLUG-GATED to
// Pericles: Henry V (Captain Gower) and Henry IV Part 2 (a messenger Gower) also define a
// "GOWER." alias, so an alias-only gate would wrongly activate this on those shipped plays;
// scoping to the slug keeps all 14 shipped plays byte-identical (confirmed by re-ingest diff).
const hasGower = slug === 'pericles' && aliasToChar.has('GOWER.');
const BARE_PROLOGUE_HEADER = /^\s*PROLOGUE\.?\s*$/i;
const INDUCTION_HEADER = /^\s*INDUCTION\.?\s*$/i;
function isFramingHeader(t: string): boolean {
  if (PROLOGUE_HEADER.test(t)) return true; // "THE PROLOGUE" (Romeo and Juliet)
  if (hasUpperChorus && BARE_PROLOGUE_HEADER.test(t)) return true; // "PROLOGUE." before every act (Henry V)
  // Troilus and Cressida opens with an "armed Prologue" whose header is the bare word
  // "PROLOGUE" (no leading "THE"), and the play defines no uppercase CHORUS. speaker, so neither
  // rule above matches. SLUG-GATED (not on hasPrologueSpeaker) because A Midsummer Night's Dream
  // also defines a "PROLOGUE." alias for Quince's play-within prologue: an alias-only gate would
  // make Midsummer's bare "PROLOGUE" a framing header in the content-start scan. The slug gate
  // keeps all 32 shipped plays byte-identical (confirmed by the re-ingest diff).
  if (slug === 'troilus_and_cressida' && BARE_PROLOGUE_HEADER.test(t)) return true;
  if (hasRumour && INDUCTION_HEADER.test(t)) return true; // "INDUCTION" (Henry IV Part 2)
  return false;
}

// The Taming of the Shrew opens with the two-scene Christopher Sly INDUCTION — a play-within
// frame that precedes "ACT I." and carries its own "SCENE I."/"SCENE II." headers and ~480
// lines. Unlike Henry IV Part 2's single-speech Rumour Induction (buffered by isFramingHeader
// and prepended to Act 1 via the prologue hook), a multi-scene Induction cannot be a flat
// prologue buffer: it is modeled as a pseudo-act numbered 0, titled "INDUCTION.", sitting
// before Act 1 (Folger/MIT render it "Induction, Scene 1/2"; TLN 1 begins in it). The schema
// allows act number 0 and the reader labels act 0 "Induction". GATED on the slug so every
// other play (including H4.2's Rumour) is byte-identical.
const INDUCTION_AS_ACT = slug === 'taming_of_the_shrew';

// Love's Labour's Lost's vendored edition mislabels Act II's sole scene as "SCENE II." (there
// is no "SCENE I."), which would ship as a phantom "Act 2, Scene 2" with no Scene 1. Renumber
// scenes sequentially within each act for this slug so the lone scene becomes 2.1 (matching
// Folger/MIT). GATED on the slug; the missing-ACT-header recovery still keys off the literal
// header number, so plays with genuine scene gaps are unaffected — and every other play, whose
// headers are already sequential, is byte-identical.
const SEQUENTIAL_SCENES = slug === 'loves_labours_lost';

// Much Ado About Nothing's first song, "Sigh no more, ladies," is introduced by the stage
// direction "[Balthasar sings.]" with NO speaker label on the lyric lines, so the song would
// otherwise be folded into the prior speaker (Benedick). When a "[<Name> sings]" direction names
// a known character, set the current speaker to that singer so the unprefixed lyrics that follow
// are attributed correctly (the play's second song, "Pardon, goddess of the night," has its own
// "SONG." prefix and is unaffected). As You Like It has the identical pattern: "Blow, blow, thou
// winter wind" (2.7) is cued by "[AMIENS sings.]" then a "SONG" header and unlabeled lyrics, which
// would otherwise fold into the prior speaker (Duke Senior); widening the gate to that slug
// attributes them to Amiens. (Its other songs need no help: 2.5 "Under the greenwood tree" and 5.4
// "Wedding is great Juno's crown" follow a real AMIENS./HYMEN. prefix, and the two bare-"SONG."
// cues in 4.2/5.3 are caught by a `song` ensemble alias.) GATED on the slugs, so every other
// shipped play — including those with their own "[X sings]" directions whose lyrics ARE prefixed —
// re-ingests byte-identical (confirmed by the original-vs-patched re-ingest hash diff).
const SINGER_SD_SETS_SPEAKER = slug === 'much_ado_about_nothing' || slug === 'as_you_like_it';

// Twelfth Night prints its closing song's cue (5.1, "When that I was and a little tiny boy")
// as a title-case "Song." line; its other two song cues (2.3, 2.4) are the all-caps "SONG"
// that SONG_HEADER already matches. The cue follows the "CLOWN." (Feste) prefix, so unless it
// is recognized as a header the literal word "Song." is emitted as a spurious line of Feste's
// dialogue (SONG_HEADER is case-sensitive). Treat a standalone title-case "Song." as a song
// header for this slug. GATED: Macbeth's title-case "Song." is ALIASED to a song speaker (so
// its lyrics read as that speaker's, and the alias guard below skips this anyway) and every
// other play is byte-identical; a lowercase "air." in the as-yet-unbuilt Two Gentlemen — which
// is dialogue, not a cue — is likewise untouched.
const TITLE_SONG_CUE = slug === 'twelfth_night';

// The Two Gentlemen of Verona's serenade "Who is Silvia?" (4.2) is cued by a bracketed "[SONG]"
// stage direction, with the lyric lines unlabeled, so they would fold into the prior speaker — the
// Host, who has just said "let's hear 'em" and is plainly NOT the singer (Thurio's hired Musicians
// perform it). When gated, a bare "[SONG]" stage direction sets the current speaker to the play's
// `Musicians` ensemble (aliased "SONG.", so nameToChar resolves "SONG" to it) and the lyrics that
// follow attribute to it. GATED on the slug: every other shipped play is byte-identical — their song
// cues are an all-caps SONG/SONG. header caught at the SONG_HEADER branch, a "[X sings]" naming a
// singer (SINGER_SD_SETS_SPEAKER), or a title-case "Song." (TITLE_SONG_CUE); none emits a bare
// "SONG" stage direction out of a "[SONG]" bracket.
const SONG_SD_SETS_SINGER = slug === 'two_gentlemen_of_verona';

// The Merchant of Venice 3.2 cues its song "Tell me where is fancy bred" with a DESCRIPTIVE
// bracketed stage direction — "[A Song, whilst BASSANIO comments on the caskets to himself.]" —
// that names no singer and is followed by unlabeled lyrics, which would otherwise fold into the
// prior speaker (Portia, who has just finished "Away then! I am lock'd in one of them"). Unlike
// Two Gentlemen's bare "[SONG]", the cue is a sentence beginning "A Song", so SONG_SD_SETS_SINGER
// does not match it. When gated, a stage direction beginning "A Song" routes the lyrics to the
// play's `musicians` ensemble (aliased "SONG.", so nameToChar resolves "SONG" to it). GATED on the
// slug; no other shipped play has a "[A Song...]" stage direction, so every other play re-ingests
// byte-identical (confirmed by the original-vs-patched re-ingest hash diff).
const SONG_SD_DESC_SETS_SINGER = slug === 'merchant_of_venice';

// Measure for Measure 5.1 prints a unison cue as "ANGELO and ESCALUS." — the LEADING name is
// undotted, so the dotted-parts unison test (which requires every part to end in '.') misses it,
// and the 19-char line then trips the single-name length cap and is read as dialogue, injecting a
// stray "ANGELO and ESCALUS." line into the Duke's speech. When gated, the "NAME and NAME." form
// (both names known aliases) is accepted as a unison prefix and canonical() joins the two proper
// names ("Angelo and Escalus"), exactly as the dotted-parts path does for "TITINIUS. MESSALA."
// GATED on the slug; every other shipped play is byte-identical (confirmed by the re-ingest diff).
const UNISON_AND_UNDOTTED = slug === 'measure_for_measure';

// Roman numeral -> int via standard subtractive notation. Returns identical values to the
// prior I..X lookup table for 1-10, so every play whose acts never exceed ten scenes
// re-ingests byte-identical; it additionally handles XI+ (Antony and Cleopatra is the first
// play in the canon with an act of more than ten scenes — Act 3 has 13, Act 4 has 15 — so
// "SCENE XI."..."SCENE XV." were previously unrecognized and merged into scene X). Returns 0
// on any non-Roman character, matching the old `?? 0` fallthrough.
const ROMAN_VALUE: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
function romanToInt(s: string): number {
  let total = 0;
  for (let k = 0; k < s.length; k++) {
    const cur = ROMAN_VALUE[s[k]];
    if (cur === undefined) return 0;
    const next = k + 1 < s.length ? ROMAN_VALUE[s[k + 1]] : 0;
    total += next > cur ? -cur : cur;
  }
  return total;
}
const ORDINAL_WORDS: Record<string, number> = {
  FIRST: 1, SECOND: 2, THIRD: 3, FOURTH: 4, FIFTH: 5,
  SIXTH: 6, SEVENTH: 7, EIGHTH: 8, NINTH: 9, TENTH: 10,
};
function toInt(s: string): number {
  if (/^\d+$/.test(s)) return Number(s);
  const up = s.toUpperCase();
  return ORDINAL_WORDS[up] ?? romanToInt(up);
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
  // A unison speech prefix ("PEMBROKE. and BIGOT.", King John 4.3) can exceed the single-
  // name length cap below; accept it when it is two-or-more dotted ALL-CAPS names (optionally
  // joined by "and") and EVERY name is a known character alias. canonical() then collapses it
  // to the joined proper names. Self-gating (requires this play's aliases), so a play with no
  // such prefix is unaffected; JC's <=18-char unison labels already passed the length cap.
  const uni = line.match(/[^.\s]+\./g);
  if (uni && uni.length >= 2 && uni.every((p) => /^[A-Z][A-Z]+\.$/.test(p) && aliasToChar.has(p))) return true;
  // Gated: an undotted-first unison cue ("ANGELO and ESCALUS.", Measure for Measure 5.1) — accept
  // it before the length cap rejects the 19-char line. Both names must be known aliases.
  if (UNISON_AND_UNDOTTED) {
    const m = line.match(/^([A-Z][A-Za-z]+) and ([A-Z][A-Za-z]+)\.$/);
    if (m && aliasToChar.has(m[1] + '.') && aliasToChar.has(m[2] + '.')) return true;
  }
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
  // Gated undotted-first unison ("ANGELO and ESCALUS.", Measure for Measure 5.1): join the two
  // known proper names, mirroring the dotted-parts branch above.
  if (UNISON_AND_UNDOTTED) {
    const m = label.match(/^([A-Z][A-Za-z]+) and ([A-Z][A-Za-z]+)\.$/);
    if (m && aliasToChar.has(m[1] + '.') && aliasToChar.has(m[2] + '.')) {
      return { name: `${aliasToChar.get(m[1] + '.')!.name} and ${aliasToChar.get(m[2] + '.')!.name}` };
    }
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

// Whether to suppress speaker-detection on text that trails an inline stage direction
// (see dispatchText). GATED on the Henry VI edition, whose dense asides produce lines like
// "[Aside.] Not I." (Richard, 3 Henry VI 4.1) where the short reply "Not I." would otherwise
// be misread as a speaker. The eight earlier plays predate this guard and must re-ingest
// byte-identical — notably Hamlet's Ghost cries "[Beneath.] Swear." (1.5), which the generic
// path still folds into a no-op speaker; correcting those would shift Hamlet's TLNs and break
// its shipped annotation anchors, so the guard is intentionally scoped to the Henry VI slugs.
const INLINE_SD_GUARD = HENRY_VI_SLUGS.has(slug);

// Whether to split an inline speaker label that opens a dialogue line mid-speech, e.g.
// "NORFOLK. I thank your Grace," (Henry VIII 1.1) — this edition occasionally prints a new
// speaker's shared half-line on the cue's physical line instead of on its own line, so the
// generic block-start speaker detection misses it and folds the speech into the prior
// speaker. GATED on Henry VIII so every other play re-ingests byte-identical.
const INLINE_SPEAKER_GUARD = slug === 'henry_viii';

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

// Some editions print the first scene of an act on the SAME physical line as the act header,
// e.g. Antony and Cleopatra's "ACT IV. SCENE I. Caesar's Camp at Alexandria." (its other four
// acts use a separate "ACT n." line). Such a line matches neither ACT_HEADER (text follows the
// act number) nor SCENE_HEADER (it begins with ACT), so the scene would be lost. Split it into
// its two canonical lines and let the generic ACT/SCENE paths handle each (including the
// scene-setting wrap). General (not slug-gated); every shipped play has its act and first-scene
// headers on separate lines, so this matches nothing and they re-ingest byte-identical (the
// re-ingest regression diff confirms it).
const ACT_SCENE_COMBINED = /^(\s*ACT\s+(?:[IVXLC]+|\d+|FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH)\.)\s+(SCENE\s+(?:[IVXLC]+|\d+)\b.*)$/i;
allLines = allLines.flatMap((l) => {
  const m = l.match(ACT_SCENE_COMBINED);
  return m ? [m[1].trim(), m[2]] : [l];
});

// The Two Gentlemen of Verona's vendored edition prints a few rapid exchanges (the 1.1
// "nod/ay/noddy" stichomythia and several asides) with the speaker label INLINE on the same
// physical line as the dialogue — either bracketed ("[SPEED] Ay.") or dotted ("PROTEUS. Nod, ay?
// Why, that's noddy."), rather than on its own line. Left as-is, a bracketed label is read as a
// stage direction (so the trailing "Ay." becomes a phantom speaker) and a dotted label folds into
// the prior speaker. Split a leading speaker label (a known alias, in either form) onto its own
// line so the standard speaker-prefix path attributes the dialogue correctly. GATED on the slug,
// and the alias check means only real speaker labels are split — every other play is byte-identical.
if (slug === 'two_gentlemen_of_verona') {
  allLines = allLines.flatMap((l) => {
    let m = l.match(/^\[([A-Z][A-Za-z]+)\]\s+(\S.*)$/); // "[SPEED] Ay."
    if (m && aliasToChar.has(m[1] + '.')) return [m[1] + '.', m[2]];
    m = l.match(/^([A-Z][A-Z]+\.)\s+(\S.*)$/); // "PROTEUS. Nod, ay?..." / "SPEED. [Aside] ..."
    if (m && aliasToChar.has(m[1])) return [m[1], m[2]];
    return [l];
  });
}

// find content start: the first ACT header, or an earlier framing header (a Chorus
// prologue or an Induction) if one precedes it. Plays with no leading framing speech
// are unaffected — the ACT header is still the first match (isFramingHeader reduces to
// the gated "THE PROLOGUE" check). Henry V also needs this because its first ACT header
// is the ordinal-word "ACT FIRST.", now matched by ACT_HEADER.
const firstActIdx = allLines.findIndex((l) => ACT_HEADER.test(l.trim()));
const firstFramingIdx = allLines.findIndex((l) => isFramingHeader(l.trim()));
// The Induction pseudo-act header (Shrew) precedes "ACT I." and must not be skipped as
// front matter. -1 for every other play, so this reduces to the prior framing-vs-act choice.
const firstInductionIdx = INDUCTION_AS_ACT
  ? allLines.findIndex((l) => INDUCTION_HEADER.test(l.trim()))
  : -1;
// Content starts at the earliest valid header: a leading Chorus/Induction framing header, the
// Induction pseudo-act header, or the first ACT header. (Equivalent to the prior framing-or-act
// pick for every shipped play, where firstInductionIdx is -1.)
const startCandidates = [firstFramingIdx, firstInductionIdx, firstActIdx].filter((x) => x >= 0);
let i = startCandidates.length ? Math.min(...startCandidates) : -1;
if (i < 0) {
  console.error('no "ACT ..." header found; cannot parse this file shape.');
  process.exit(3);
}

for (; i < allLines.length; i++) {
  const rawLine = allLines[i] ?? '';
  const trimmed = rawLine.trim();
  let m: RegExpMatchArray | null;

  // Skip Open Shakespeare transcription junk markers — runs of '@' ("@@@" / "@@@@" appear
  // twice in Love's Labour's Lost) — WITHOUT touching speaker state. Left in, they are emitted
  // as stray dialogue or (after a blank) consume the speaker-expectation so the next real
  // speaker label is swallowed into the prior speech. No other vendored source contains '@'
  // (verified by grep), so every shipped play re-ingests byte-identical.
  if (/^@+$/.test(trimmed)) continue;

  // Shrew's "INDUCTION." opens a pseudo-act (number 0) before Act 1 (see INDUCTION_AS_ACT).
  // Must precede the generic paths — "INDUCTION." otherwise passes looksLikeSpeaker and would
  // be mis-read as a speaker label.
  if (INDUCTION_AS_ACT && INDUCTION_HEADER.test(trimmed)) {
    pushAct(0, 'INDUCTION.');
    continue;
  }
  if ((m = trimmed.match(ACT_HEADER))) {
    const n = toInt(m.groups!.num);
    // Troilus and Cressida's vendored edition REPRINTS "ACT n." before every scene (e.g. "ACT I."
    // appears again before 1.2 and 1.3). A repeated act header whose number equals the already-open
    // act must not start a duplicate act — skip it and let the following "SCENE m." add its scene to
    // the current act. GENERAL (not slug-gated): every other shipped play prints each act header once
    // in ascending order, so n === currentAct.number never holds for them and they re-ingest
    // byte-identical (confirmed by the re-ingest diff).
    if (n > 0 && currentAct && n === currentAct.number) { continue; }
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
      // Store a sequential within-act scene number for editions that mis-number a lone scene
      // (Love's Labour's Lost labels Act II's only scene "SCENE II." with no Scene I); the
      // literal header number `n` still drives the missing-ACT-header recovery above. No-op
      // for every other play, whose headers are already sequential.
      const sceneNum = SEQUENTIAL_SCENES && currentAct ? currentAct.scenes.length + 1 : n;
      pushScene(sceneNum, setting);
      continue;
    }
  }
  // A framing-section header ("THE PROLOGUE" / bare "PROLOGUE." / "INDUCTION") opens a
  // Chorus/Induction buffer flushed to the head of the next scene. Gated (isFramingHeader)
  // so plays without a Chorus/Rumour are byte-identical, and guarded against an aliased
  // speaker label so a real "PROLOGUE." speaker is never hijacked.
  if (isFramingHeader(trimmed) && !aliasToChar.has(trimmed)) {
    startPrologue();
    // Henry VIII's "THE PROLOGUE." carries no speaker label or Enter-Chorus direction, so
    // attribute the buffered verse to the Prologue speaker here. Gated on the PROLOGUE.
    // alias (only Henry VIII) so Romeo and Juliet / Henry V / Henry IV Part 2 stay
    // byte-identical — their own Chorus/Rumour label sets the speaker as before.
    if (hasPrologueSpeaker && (PROLOGUE_HEADER.test(trimmed) || (slug === 'troilus_and_cressida' && BARE_PROLOGUE_HEADER.test(trimmed)))) {
      curSpeakerRaw = trimmed;
      curSpeaker = canonical('PROLOGUE.');
      expectSpeaker = false;
    }
    continue;
  }
  // Troilus' vendored edition prints the play title "TROILUS AND CRESSIDA" on its own line between
  // the bare "PROLOGUE" header and the prologue verse; skip it while the Prologue buffer is open so
  // it is not captured as the Prologue's first line. Gated on the slug -> other plays byte-identical.
  if (slug === 'troilus_and_cressida' && inPrologue && trimmed === 'TROILUS AND CRESSIDA') {
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
  if ((SONG_HEADER.test(trimmed) || (TITLE_SONG_CUE && /^Song\.?$/.test(trimmed)) || VERSE_NUMERAL.test(trimmed)) && !aliasToChar.has(trimmed)) {
    emitSD(trimmed);
    continue;
  }
  // Pericles' unbracketed "DUMB SHOW." header (Act II chorus): render as a stage direction
  // and keep the current speaker (Gower), so the verse that follows the dumb show is not lost
  // to a phantom 'Dumb Show' speaker. Gated on hasGower; the bracketed "[Dumb Show.]" used in
  // the other dumb shows is handled by the generic bracket path above.
  if (hasGower && DUMB_SHOW_HEADER.test(trimmed)) {
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
  // An inline speaker label opening a mid-speech line (Henry VIII's "NORFOLK. I thank your
  // Grace,"): split off the leading dotted ALL-CAPS alias as the new speaker and emit the
  // remainder as their dialogue. Gated (INLINE_SPEAKER_GUARD) so other plays are unaffected.
  if (INLINE_SPEAKER_GUARD) {
    const inl = trimmed.match(/^([A-Z][A-Z]+\.)\s+(.+)$/);
    if (inl && aliasToChar.has(inl[1])) {
      curSpeakerRaw = inl[1];
      curSpeaker = canonical(inl[1]);
      expectSpeaker = false;
      emitDialogue(inl[2]);
      continue;
    }
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
  // A "[<Name> sings]" direction names the singer of an otherwise unlabeled song; set the
  // current speaker to that character so the lyric lines that follow are attributed to the
  // singer rather than the prior speaker. GATED (SINGER_SD_SETS_SPEAKER) to Much Ado.
  if (SINGER_SD_SETS_SPEAKER) {
    const sm = text.match(/^(.+?)\s+sings\b/i);
    const singer = sm && nameToChar.get(sm[1].trim().toUpperCase());
    if (singer) { curSpeaker = { id: singer.id, name: singer.name }; curSpeakerRaw = singer.name; }
  }
  // A bare "[SONG]" stage direction (Two Gentlemen of Verona 4.2) names no singer; route the
  // unlabeled serenade that follows to the `Musicians` ensemble. GATED (SONG_SD_SETS_SINGER).
  if (SONG_SD_SETS_SINGER && /^SONG\.?$/i.test(text.trim())) {
    const s = nameToChar.get('SONG');
    if (s) { curSpeaker = { id: s.id, name: s.name }; curSpeakerRaw = s.name; }
  }
  // A descriptive "[A Song, whilst ...]" stage direction (Merchant of Venice 3.2) names no singer;
  // route the unlabeled lyrics that follow to the `musicians` ensemble. GATED (SONG_SD_DESC_SETS_SINGER).
  if (SONG_SD_DESC_SETS_SINGER && /^a song\b/i.test(text.trim())) {
    const s = nameToChar.get('SONG');
    if (s) { curSpeaker = { id: s.id, name: s.name }; curSpeakerRaw = s.name; }
  }
  // An "Enter Chorus"/"Enter Rumour" direction opens a prologue/chorus passage we buffer and
  // prepend to the next scene of the act it introduces. Pericles' Presenter, Gower, is framed
  // the same way: his act-opening chorus is headed by "[Enter Gower]". In Act I that chorus
  // carries NO speaker label, so we also set the speaker to Gower here; in Acts II-V a "GOWER."
  // label follows and re-sets it harmlessly. GATED on hasGower, and fired only at act-open
  // (lastSceneNum === 0), so Gower's MID-act appearances — which sit inside a numbered scene
  // (the 4.4 interlude after its SCENE header, the 5.2 "Enter Gower" carried in the scene
  // setting, and the closing Epilogue after 5.3) — stay in that scene rather than buffering to
  // the next.
  if (!inPrologue) {
    if (/enter\s+(?:chorus|rumour)/i.test(text)) {
      startPrologue();
    } else if (hasGower && lastSceneNum === 0 && /enter\s+gower\b/i.test(text)) {
      startPrologue();
      curSpeaker = canonical('GOWER.');
      curSpeakerRaw = 'GOWER.';
    }
  }
  const sink = currentSink();
  if (!sink) return;
  sink.push({ kind: 'stage_direction', stage_directions: [text.trim()] });
  expectSpeaker = true;
}

/** Split a bracket-bearing line into ordered SD and dialogue segments. */
function handleBracketed(s: string) {
  let rest = s;
  let lastWasSD = false;
  let seenSD = false; // an inline SD has already appeared earlier on this physical line
  while (rest.length) {
    const open = rest.indexOf('[');
    if (open < 0) {
      const txt = rest.trim();
      if (txt) { dispatchText(txt, seenSD); lastWasSD = false; }
      break;
    }
    if (open > 0) {
      const txt = rest.slice(0, open).trim();
      if (txt) { dispatchText(txt, seenSD); lastWasSD = false; }
    }
    const close = rest.indexOf(']', open);
    if (close < 0) {
      emitSD(rest.slice(open + 1).trim());
      lastWasSD = true; seenSD = true;
      break;
    }
    emitSD(rest.slice(open + 1, close).trim());
    lastWasSD = true; seenSD = true;
    rest = rest.slice(close + 1);
  }
  // expectSpeaker is true iff the line ended on a stage direction
  expectSpeaker = lastWasSD;
}

/** A text segment of a bracketed line: a speaker label if we're expecting one, else
 *  dialogue. When INLINE_SD_GUARD is on, text that follows an inline stage direction on the
 *  SAME physical line (afterSD) is always dialogue — an inline "[Aside.] Not I." must not let
 *  the short reply "Not I." (which happens to look like a speech prefix) be read as a new
 *  speaker (emitSD sets expectSpeaker, so without this guard the trailing words are
 *  mis-attributed and the line is lost). Only the leading segment, before any bracket, can be
 *  a speaker. The guard is gated (see INLINE_SD_GUARD) so the earlier plays stay byte-identical. */
function dispatchText(txt: string, afterSD = false) {
  if ((!afterSD || !INLINE_SD_GUARD) && expectSpeaker && looksLikeSpeaker(txt)) {
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
