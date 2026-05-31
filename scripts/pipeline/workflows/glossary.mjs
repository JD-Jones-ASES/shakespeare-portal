// Workflow template: generate the per-act archaic-vocabulary glossary for any play.
// Run with the Workflow tool:
//   Workflow({ scriptPath: "scripts/pipeline/workflows/glossary.mjs",
//              args: { slug: "<slug>", acts: [[1,[1,2,3]], [2,[1,2,3,4]], ...] } })
// (acts = [actNumber, [sceneNumbers]]; one subagent per act.)
//
// Writes data/plays/<slug>/_candidates/glossary-<act>.json (arrays of {surface,definition,pos?}).
// Then merge (run from scripts/):  node --import tsx generate/merge-glossary.ts <slug> <actCount>
//
// NOTE: `node --check` reports "Illegal return statement" on this file — that is a FALSE
// POSITIVE. Workflow scripts run inside an async wrapper the Workflow tool supplies; top-level
// return/await and the injected globals (agent, parallel, log, args) are legal. Run only via Workflow.
export const meta = {
  name: 'glossary-play',
  description: 'Generate per-act archaic-vocabulary glossary candidates (args: {slug, acts:[[act,[scenes]]]})',
  phases: [{ title: 'Glossary', detail: 'one lexicographer subagent per act' }],
}

// `args` may arrive as an object or as a JSON string depending on how the caller
// passes it; normalize both.
const input = typeof args === 'string' ? JSON.parse(args) : args
const slug = input && input.slug
const acts = input && input.acts
const guidance = input && input.guidance // optional play-specific instruction appended to every lexicographer prompt
if (!slug || !Array.isArray(acts) || !acts.length) {
  throw new Error('Workflow args must be { slug: string, acts: [[actNumber, [sceneNumbers]], ...] }')
}
const D = `data/plays/${slug}/_candidates`
const PLAY = slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function glossPrompt(act, sceneNums, guidance) {
  const files = sceneNums.map((s) => `${D}/scene-${act}-${s}.txt`).join('\n  - ')
  return [
    `You are a lexicographer building a hover-glossary for students reading ${PLAY}. Produce the archaic / difficult-word glossary for ACT ${act} (scenes ${sceneNums.join(', ')}).`,
    '',
    'READ these scene files (TLN-prefixed play text):',
    '  - ' + files,
    '',
    'TASK: extract every word or short phrase a modern high-school reader would NOT understand at sight, and give a SHORT plain-English gloss of the sense USED IN THIS TEXT.',
    'INCLUDE: archaic words (wherefore, hie, sirrah, anon, marry, prithee, ere, fain, beseech); archaic SENSES of familiar words / false friends (still=always, want=lack, prevent=forestall, owe=own, envy=malice, rude=rough, sad=serious, presently=at once); contractions ("o\'er", "\'tis", "ne\'er", "\'gainst", "e\'en"); short idioms and oaths.',
    'EXCLUDE: proper nouns (people, places) and ordinary modern words whose meaning is unchanged. Anything needing more than a phrase belongs in the annotation layer, not here.',
    ...(guidance ? ['', `PLAY-SPECIFIC GUIDANCE: ${guidance}`] : []),
    '',
    'STYLE for each definition:',
    '- 12 words or fewer, plain modern English; <=140 characters hard cap.',
    '- Define ONLY the sense used here. Do not invent senses.',
    '- Do NOT use double-quote characters inside any string; use single quotes if needed (prevents JSON breakage).',
    '- surface = the headword lowercased, keeping internal apostrophes (e.g. "o\'er", "\'tis", "wherefore").',
    '- pos = part of speech if obvious (optional).',
    '',
    `OUTPUT: use the Write tool to write a JSON array to ${D}/glossary-${act}.json. Each element:`,
    '  { "surface": "wherefore", "definition": "why; for what reason", "pos": "adverb" }',
    'Aim for thorough coverage (roughly 120-200 entries for a full act, fewer for a short one). Duplicates across acts are fine - a later merge step dedupes by normalized surface and keeps the shortest definition.',
    '',
    `VALIDATE before finishing: confirm the file parses (node -e "JSON.parse(require('fs').readFileSync('${D}/glossary-${act}.json','utf8'))"). The usual failure is an unescaped double-quote inside a definition - replace with single quotes.`,
    'Return ONE line: the entry count you wrote.',
  ].join('\n')
}

log(`${PLAY} glossary: ${acts.length} act(s)`)
const counts = await parallel(
  acts.map(([act, sceneNums]) => () =>
    agent(glossPrompt(act, sceneNums, guidance), { label: `glossary act ${act}`, phase: 'Glossary', model: 'sonnet' })),
)
log(`glossary candidates written for ${counts.filter(Boolean).length}/${acts.length} acts. Next: merge-glossary.ts ${slug} ${acts.length}`)
return { acts: acts.length }
