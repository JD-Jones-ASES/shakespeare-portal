// Workflow template: annotate + adversarially fact-check scenes of any play.
// Run with the Workflow tool:
//   Workflow({ scriptPath: "scripts/pipeline/workflows/annotate.mjs",
//              args: { slug: "<slug>", scenes: [[act,scene,target], ...] } })
// Get the `scenes` array (with suggested targets) from: node scripts/pipeline/render-scenes.mjs <slug>
//
// Writes per scene (gitignored intermediates the deterministic step consumes):
//   data/plays/<slug>/_candidates/<a>-<s>.json          (candidate annotations)
//   data/plays/<slug>/_candidates/<a>-<s>.source.json   (source-judge verdicts)
//   data/plays/<slug>/_candidates/<a>-<s>.interp.json   (interpretation-judge verdicts)
// Then run: node scripts/pipeline/postprocess.mjs <slug> --reset
//
// NOTE: `node --check` reports "Illegal return statement" on this file — that is a FALSE
// POSITIVE. Workflow scripts run inside an async wrapper the Workflow tool supplies, where
// top-level return/await and the injected globals (agent, pipeline, parallel, log, args) are
// all legal. Do not "fix" it; run it only via the Workflow tool.
export const meta = {
  name: 'annotate-play',
  description: 'Annotate + adversarially fact-check scenes of a play (args: {slug, scenes:[[act,scene,target]]})',
  phases: [
    { title: 'Annotate', detail: 'one annotator subagent per scene' },
    { title: 'Fact-check', detail: 'source + interpretation judge per scene' },
  ],
}

// `args` may arrive as an object or as a JSON string depending on how the caller
// passes it; normalize both.
const input = typeof args === 'string' ? JSON.parse(args) : args
const slug = input && input.slug
const scenes = input && input.scenes
const guidance = input && input.guidance // optional play-specific instruction appended to every annotator prompt
if (!slug || !Array.isArray(scenes) || !scenes.length) {
  throw new Error('Workflow args must be { slug: string, scenes: [[act,scene,target], ...] }')
}
const D = `data/plays/${slug}/_candidates`
const PLAY = slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function annotatePrompt(a, s, n, guidance) {
  return [
    `You are a Shakespeare scholar-annotator for a student study portal. Annotate ${PLAY}, Act ${a} Scene ${s}.`,
    '',
    'READ FIRST:',
    `- Scene text (TLN-prefixed lines): ${D}/scene-${a}-${s}.txt`,
    `- Characters: data/plays/${slug}/characters.json`,
    `- Reference cards you may link: data/references/classical.json, data/references/historical.json, data/references/biblical.json (each is { kind, cards:[{id,title,...}] }).`,
    '',
    'VOICE (project content standards): basic notes 1-2 sentences; scholar up to 4. Neutral, concrete, source-cited. Use characters’ names. American spelling. NO emoji. No condescension ("as you know") or filler ("it is interesting that"). Annotate only what a smart, unprepared 10th-grader would stumble on: archaic vocabulary, biblical/classical/mythological allusion, historical/topical context, rhetorical devices that carry meaning, wordplay/puns, comprehension-blocking syntax. Do NOT annotate the obvious, plot recap, or atmosphere. Bawdy/innuendo only when meaning is otherwise lost: type bawdy_pun, depth scholar.',
    '',
    `TARGET about ${n} strong annotations (fewer is fine on a thin scene; quality over quantity).`,
    ...(guidance ? ['', `PLAY-SPECIFIC GUIDANCE: ${guidance}`] : []),
    '',
    `OUTPUT: use the Write tool to write a JSON array to ${D}/${a}-${s}.json. Each element:`,
    '{',
    `  "id": "${slug}-<tln_start>-<short-kebab>",  // kebab tail = lowercase letters/digits/hyphens, 1-3 words`,
    `  "play": "${slug}",`,
    '  "tln_start": <int TLN of first anchored line, from the [TLN n] prefix>,',
    '  "tln_end": <int TLN of last anchored line; equal to tln_start for one line>,',
    '  "word_start": 0, "word_end": 0,   // leave 0 - a deterministic resolver recomputes offsets',
    '  "anchor_text": "<EXACT verbatim substring copied from the line text(s); 2-10 distinctive words>",',
    '  "type": "archaic_vocab|biblical_allusion|classical_allusion|historical_topical|bawdy_pun|rhetorical_device|wordplay|syntax_grammar|stage_direction_note|textual_variant|parallel_passage|cultural_context",',
    '  "depth": "basic|scholar",',
    '  "summary": "<=600 chars, the gloss the student reads",',
    '  "detail": "<optional <=2000 chars deeper context>",',
    '  "sources": [ { "name": "<short>", "citation": "<full>" } ],   // AT LEAST ONE, required',
    '  "references": [ { "kind": "classical|historical|biblical", "card_id": "<existing card id>" } ],  // OPTIONAL',
    '  "confidence": "high|medium|uncertain",',
    '  "generated_by": "claude-sonnet-4-6"',
    '}',
    '',
    'ANCHORING IS CRITICAL: anchor_text must be copied VERBATIM from a line’s text in the scene file (you may span consecutive TLN lines). A deterministic resolver locates it and sets the word offsets, so the exact characters of anchor_text plus the right tln_start/tln_end are what matter. Keep anchors short and unique; never anchor inside a stage direction.',
    '',
    'CITATIONS (a validator enforces these):',
    '- Every annotation needs >=1 source with non-empty name AND citation. Never "various editors note".',
    '- classical_allusion: at least one source naming an allowlisted ancient author/work (Plutarch, North, Ovid, Virgil, Homer, Hesiod, Seneca, Livy, Cicero, Suetonius, Pliny, Lucan, Horace, Tacitus, Plautus, Terence, Apuleius, Boccaccio, Chaucer, Holinshed, Golding) with book/line where possible.',
    '- biblical_allusion: at least one citation in Book Chapter:Verse form, e.g. "Genesis 4:8 (Geneva 1599)".',
    '- other types: cite a REAL source - a dated event, an ancient source, or a public-domain lexicon ("Onions, Shakespeare Glossary, s.v. <word>"; "Schmidt, Shakespeare-Lexicon, s.v. <word>"; "OED s.v. <word>"). You may CITE (never quote) a modern edition by editor/edition/page.',
    '- confidence: high=uncontroversial; medium=defensible but contested (hedge briefly); uncertain=genuinely disputed (then depth MUST be scholar).',
    '',
    'REFERENCE CARDS: link via references[] ONLY when the note is squarely about that card’s subject; otherwise omit. The card_id must exist, and its kind must match the file it lives in (a card in classical.json => kind:"classical"). Read the three reference files to get exact ids.',
    '',
    `VALIDATE before finishing: confirm the file parses (e.g. node -e "JSON.parse(require('fs').readFileSync('${D}/${a}-${s}.json','utf8'))"). The usual failure is an unescaped double-quote inside a string - use single quotes inside prose.`,
    'Return ONE line: the number of annotations you wrote.',
  ].join('\n')
}

function judgePrompt(kind, a, s) {
  if (kind === 'source') {
    return [
      `You are Judge A (SOURCE correctness) in an adversarial fact-check of ${PLAY} Act ${a} Scene ${s}. Be skeptical; catch fabricated, misattributed, or stretched sources.`,
      `READ: ${D}/${a}-${s}.json.`,
      'For EACH annotation, judge ONLY whether its sources[] actually support its summary/detail claims. Use your knowledge of the classical authors, the Geneva Bible (1599), and standard lexicography; use WebSearch / WebFetch to check a specific verse, passage, or date when unsure.',
      'Verdict per annotation: "verified" (sources real and supportive), "refuted" (a citation is invented, misattributed, misquoted, or does not support the claim), or "uncertain". Default to "refuted" if a citation looks invented or the claim overreaches its source. Do NOT judge anchoring or interpretation here.',
      `WRITE (Write tool) a JSON array to ${D}/${a}-${s}.source.json, one entry per annotation, same ids: [ { "id": "...", "verdict": "verified|refuted|uncertain", "note": "<one sentence>" } ].`,
      'Confirm it parses. Return counts verified/refuted/uncertain.',
    ].join('\n')
  }
  return [
    `You are Judge C (INTERPRETATION) in an adversarial fact-check of ${PLAY} Act ${a} Scene ${s}. Be skeptical; catch over-readings, folk etymologies, anachronisms, and discredited (Bowdlerized / Romantic-era) readings.`,
    `READ: candidates ${D}/${a}-${s}.json and the scene ${D}/scene-${a}-${s}.txt for context.`,
    'For EACH annotation, judge ONLY whether the gloss/interpretation is defensible given the text and context (NOT whether the source exists - another judge does that). Verdict: "verified" (sound, mainstream-defensible), "refuted" (reaches, misreads the line, or is discredited), or "uncertain". Default to "refuted" if it overreaches.',
    `WRITE (Write tool) a JSON array to ${D}/${a}-${s}.interp.json, one entry per annotation, same ids: [ { "id": "...", "verdict": "verified|refuted|uncertain", "note": "<one sentence>" } ].`,
    'Confirm it parses. Return counts verified/refuted/uncertain.',
  ].join('\n')
}

log(`${PLAY}: annotating + fact-checking ${scenes.length} scene(s)`)
const results = await pipeline(
  scenes,
  ([a, s, n]) => agent(annotatePrompt(a, s, n, guidance), { label: `annotate ${a}.${s}`, phase: 'Annotate', model: 'sonnet' }),
  (_r, [a, s]) => parallel([
    () => agent(judgePrompt('source', a, s), { label: `source ${a}.${s}`, phase: 'Fact-check', model: 'sonnet' }),
    () => agent(judgePrompt('interp', a, s), { label: `interp ${a}.${s}`, phase: 'Fact-check', model: 'sonnet' }),
  ]),
)
log(`done: ${results.filter(Boolean).length}/${scenes.length} scenes fact-checked. Next: node scripts/pipeline/postprocess.mjs ${slug} --reset`)
return { scenes: scenes.length }
