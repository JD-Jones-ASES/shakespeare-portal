# Build a Play — Runbook

End-to-end recipe for taking one Shakespeare play from raw vendored text to a fully-annotated,
validated, shipping reader. Work in order; each step's output gates the next. Slugs are lowercase
underscore (e.g. `romeo_and_juliet`) and must match `shakespeare-material-master/texts/works.json` and
`data/catalog/works.json` (`playId`).

Adding a play is **100% data-driven** — no `site/` code changes. The Astro reader discovers
`data/plays/<slug>/text.json` via `import.meta.glob`. Your job is to produce the JSON.

The deterministic steps (ingest, merge, validate, build) run with bare Node and need no LLM. The two
generation steps (annotate, glossary) are LLM-driven — this repo's corpus was produced by an agent
running the prompt templates in `scripts/pipeline/workflows/`. You can drive them with any capable LLM
agent that can search the web to verify citations.

---

## Environment & tooling (read once)

- **The build kit** lives in `scripts/pipeline/` and is the path of least resistance. Plain Node ESM,
  runnable **from the repo root** with bare `node`:
  - `node scripts/pipeline/extract-speakers.mjs <slug>` — list speech-prefixes to seed characters.
  - `node scripts/pipeline/render-scenes.mjs <slug>` — write per-scene text + print the `scenes` arg.
  - `node scripts/pipeline/postprocess.mjs <slug> [--reset]` — resolve anchors + apply verdicts.
  - `node scripts/pipeline/audit.mjs <slug>` — distribution stats + all 3 validators (exit 1 on fail).
- **The lower-level `.ts` scripts** (`scripts/generate/*.ts`, `scripts/validate/*.ts`,
  `scripts/ingest/*.ts`, `scripts/build-index.ts`) run via tsx and must be invoked **from inside
  `scripts/`**: `cd scripts ; node --import tsx generate/<x>.ts …`. The build-kit `.mjs` wrappers run
  them with the right working directory; prefer the wrappers.
- **`annotate-scene.ts` / `fact-check.ts` are stubs.** Generation runs an LLM agent against the templates
  in `scripts/pipeline/workflows/` (prompts in `scripts/generate/prompts/`). The deterministic steps
  (resolve-anchors, apply-verdicts, merge-glossary, build-index) are real and runnable.
- Use **web search** to verify citations and fetch primary sources during annotation.
- `_candidates/`, `_review_queue/`, and `_*` files under `data/plays/` are gitignored intermediates.
- **Platform note:** this repo was developed on Windows + PowerShell; the scripts are cross-platform. On
  PowerShell, chain commands with `;` (not `&&`), and don't spawn `node_modules/.bin/tsx.cmd` directly from
  Node (`EINVAL`) — run `node --import tsx` with the working directory set to `scripts/`.

---

## Step 0 — Confirm the source

Need both: `shakespeare-material-master/texts/gutenberg/<slug>_gut.txt` (modern spelling; `*_gut_f.txt`
is Folio, scholar-only) and a `data/catalog/works.json` entry with `"playId": "<slug>"`. Most plays
already have a catalog **stub** — upgrade it in place (Step 3), never duplicate it.

## Step 1 — Author `characters.json` BEFORE ingest

The parser canonicalizes speaker labels against `data/plays/<slug>/characters.json` aliases, so it must
exist first. Discover the labels: `node scripts/pipeline/extract-speakers.mjs <slug>`.

Write `data/plays/<slug>/characters.json` — an **array** (schema `character.schema.json`). One entry
per real role; required `id` (lowercase snake_case), `name`, `role`
(`protagonist|antagonist|deuteragonist|major|supporting|minor|chorus|ensemble`). Recommended:
`aliases` (every printed label **exactly**, e.g. `"BRUTUS."` or `"Ham."`), `description` (≤600 chars),
`color` (`#RRGGBB`, mid-tone, legible on light+dark), `relationships`.

- Put **every** prefix shape from extract-speakers in some role's `aliases[]` (incl. `FIRST CITIZEN.`,
  `CITIZENS.`, soldiers, servants, `GHOST.`, `SOOTHSAYER.`). An un-aliased ALL-CAPS label surfaces
  verbatim as the speaker name — a red flag in Step 2.
- One prefix may cover two characters (e.g. JC's `CINNA.` = conspirator + poet) — note it in the
  description; don't split it. The parser joins unison prefixes like `TITINIUS. MESSALA.` if each part
  is a known alias.

## Step 2 — Ingest and verify

```
cd scripts
node --import tsx ingest/parse-gutenberg.ts <slug>
node --import tsx ingest/normalize-tln.ts <slug>
```
Writes `data/plays/<slug>/text.json` (TLN'd). **Verify before continuing:**
- Acts/scenes/tln_count match a known edition.
- No `stage_direction` is hundreds of chars long (a runaway = unclosed `[` swallow; the parser is
  guarded, but check).
- No speaker is ALL-CAPS (missing alias — fix `characters.json` and re-ingest).
- **Hand-spot-check Act 1 Scene 1** vs [MIT](https://shakespeare.mit.edu)/Folger.

`node scripts/pipeline/render-scenes.mjs <slug>` (repo root) prints tln_count + act/scene counts and
writes the scene files Step 6 needs.

## Step 3 — Upgrade catalog + author synopsis

Edit the existing `<slug>` object in `data/catalog/works.json` (schema `catalog-entry.schema.json`) to
shipping form: add `line_count` (= tln_count), `synopsis_short` (≤400), `folger_url`/`mit_url`/
`wikipedia_url`, expand `characters_major` (≤15). `themes` use the controlled snake_case vocabulary;
`date_written` uses an en-dash for ranges.

Author `data/plays/<slug>/synopsis.json` (free-form, no schema — match existing shape):
`{ play, overview, acts:[{ number, summary, scenes:[{ number, summary, themes:[] }] }] }`.

## Step 4 — Author reference cards FIRST

Annotations link to shared cards by `card_id`; `citation-check` fails on an unresolved link, so author
cards **before** annotating. Append to the matching file — `data/references/{classical,historical,
biblical}.json`, each `{ kind, cards:[…] }`. **Preserve all existing cards.** Card schema
(`reference-card.schema.json`): required `id` (kebab `^[a-z0-9][a-z0-9-]*$`), `kind` (must match the
file), `title`, `source:{name,citation}`, `summary_basic` (≤600); optional `detail_scholar` (≤1500),
`related_plays`, `see_also`.

- **Reuse** existing cards where apt (read all three files first).
- Ground new cards in **public-domain** sources (Plutarch/North 1579, Ovid/Golding 1567, Virgil, Livy,
  Cicero, Suetonius, Geneva Bible 1599, Holinshed). Cite — never quote — modern editions.
- Single quotes inside JSON strings, never unescaped `"`.
- Validate now: `cd scripts ; node --import tsx validate/schema-check.ts` and `… validate/citation-check.ts`.

## Step 5 — Render scenes

`node scripts/pipeline/render-scenes.mjs <slug>` — copy the printed **`scenes` array** (includes a
suggested annotation target per scene).

## Step 6 — Generate + fact-check (LLM agent)

Run an LLM agent over the `scenes` array from Step 5, using the template
`scripts/pipeline/workflows/annotate.mjs` (prompts: `scripts/generate/prompts/annotator.md` and
`verifier.md`). It fans out **one annotator per scene**, then **source + interpretation judges** per
scene (~3 agents/scene). The annotator emits candidates conforming to `annotation.schema.json` (minus the
`fact_checked*` fields); the judges return verdicts. Results land in
`data/plays/<slug>/_candidates/<a>-<s>.json` (+ `.source.json`, `.interp.json`).

## Step 7 — Deterministic merge

`node scripts/pipeline/postprocess.mjs <slug> --reset`

Per scene: `resolve-anchors.ts` computes offsets from `anchor_text` (auto-corrects small TLN errors;
drops anything it can't locate), then `apply-verdicts.ts` applies the **2-of-3 gate** → ships to
`annotations.json`, routes split decisions to `_review_queue/`, drops the rest. It stamps the required
`fact_checked*` fields, downgrades confidence on an uncertain verdict, bumps basic→scholar where
needed. Idempotent. Expect **~80-95% ship rate**.

## Step 8 — Glossary

Run the glossary template (`scripts/pipeline/workflows/glossary.mjs`) per act → archaic-vocabulary
candidates, then:
```
cd scripts ; node --import tsx generate/merge-glossary.ts <slug> <actCount>
```
Merge dedupes by normalized surface, keeps the shorter definition, caps at 140 chars → `glossary.json`.
Spot-check for garbage surfaces before shipping. Optional rigor: a glossary-verify pass
(`_candidates/glossary-verify-*.json` as `{delete:[…],fix:[…]}`) + `apply-glossary-verdicts.ts <slug>`.

## Step 9 — Build index, audit, fix

```
cd scripts ; node --import tsx build-index.ts          # -> site/public/search-index.json
node scripts/pipeline/audit.mjs <slug>                  # stats + all 3 validators; exit 1 on any fail
```
Must end green. Common fixes:
- **`references unknown reference card <kind>:<id>`** — the annotation's `kind` must match the file the
  card lives in (e.g. `plutarchs-lives` is classical → `kind:"classical"`). Fix in `annotations.json`
  and the candidate.
- **`maxLength` schema error** — trim `detail` (≤2000) / `summary` (≤600) / glossary `definition` (≤140).
- Never `--no-verify` or weaken a schema to pass. If a schema is genuinely wrong, fix it explicitly.

## Step 10 — Verify in the browser

Run the dev server (`cd site ; npm run dev`) and open the play. On Windows, kill stray `node` processes
first so Astro re-scans `import.meta.glob`. Confirm:
- `/plays/<slug>/` — title, metadata, synopsis, one scene link per scene.
- a dense scene (a famous speech) — TLN-numbered colored speeches, glossary underlines, Notes sidebar
  with real annotations + working reference-card badges.
- the browser console is clean.

## Step 11 — Update docs

Update **Project Status** in `CLAUDE.md` (counts, cards, glossary) and bump the README work count.

---

## Quality bar (from the shipped plays)

| Metric | Target |
|---|---|
| Annotations / scene | ~1 per 12 spoken lines; 5-25/scene by density |
| Ship rate (fact-check) | 80-95% |
| Glossary entries | ~600-1000 (after dedup) |
| Reference-card links | every classical/historical/biblical allusion that has a card |
| Validators | all three green; **non-negotiable** |

Reference plays: Hamlet (~356 annotations / 813 gloss), Midsummer (~189 / 724), Julius Caesar (~202 / 1030).

## Data contract cheat-sheet (what the annotator emits)

- **annotation** (`annotation.schema.json`, `additionalProperties:false`). Candidate fields:
  `id, play, tln_start, tln_end, word_start, word_end, anchor_text, type, depth, summary, [detail],
  sources[], [references[]], confidence, generated_by`. The deterministic step adds `fact_checked`,
  `fact_checked_by` (exactly 3), `fact_checked_at`, `fact_check_verdicts` (exactly 3).
- `id` pattern `^[a-z][a-z0-9_]*-\d+-[a-z0-9-]+$` (the `<tln>` in the id may lag corrected `tln_start`
  by a line — cosmetic; ids only need to be globally unique).
- `type` ∈ `archaic_vocab, biblical_allusion, classical_allusion, historical_topical, bawdy_pun,
  rhetorical_device, wordplay, syntax_grammar, stage_direction_note, textual_variant, parallel_passage,
  cultural_context`.
- `depth` ∈ `basic|scholar`; `confidence` ∈ `high|medium|uncertain`. **basic depth may not be
  `uncertain`** (the merge step bumps it to scholar).
- Caps: `summary` ≤600, `detail` ≤2000, glossary `definition` ≤140, card `summary_basic` ≤600,
  `detail_scholar` ≤1500.
- `sources` ≥1 (non-empty name+citation). **biblical_allusion** needs a `Book C:V` citation;
  **classical_allusion** needs an allowlisted ancient author or recognized lexicon/edition token (see
  `scripts/validate/citation-check.ts` for the allowlist).

## Gotchas

1. **Unclosed `[` in source** → the bracket-chaser used to swallow the rest of the file (collapsing a
   whole play into "Act 2 Scene 1"). `parse-gutenberg.ts` now stops chasing at a blank line or
   ACT/SCENE header. If a future edition still misbehaves, look for a giant stage direction in text.json.
2. **`node --import tsx` must run from `scripts/`**; from the repo root tsx won't resolve. The build-kit
   `.mjs` wrappers handle this — prefer them. Don't spawn `.bin/tsx.cmd` from Node (`EINVAL` on Windows).
3. **`apply-verdicts` mutates the shared `annotations.json`** — post-process serially, never in parallel.
4. **LLM-generated JSON** occasionally has unescaped inner `"` in citations — the prompts say "single
   quotes inside strings"; if a candidate won't parse, that's almost always why.
5. **Windows + Astro** caches `import.meta.glob`; kill all node processes before restarting the dev
   server after adding a play.
6. **Reference-card kind must match its file** or citation-check fails on the link.
7. **Editions vary structurally** — and the parser already handles every device in the shipped canon
   (choruses, inductions, epilogues, dumb-shows, songs, play-within-a-play prologues, unison prefixes)
   through small, **gated, per-edition normalizers**. A `THE PROLOGUE` header before the first `ACT`, or
   an `Enter Chorus` stage direction, opens a buffer prepended as TLN-numbered Chorus speech to the head
   of the act it introduces (requires a `chorus` character with aliases for the printed labels). Most
   structural quirks, though, need no parser change — they are pure `characters.json` alias data. **Any
   new parser behavior must stay byte-identical for the already-shipped plays — run a re-ingest diff.**
8. **The `workflows/*.mjs` templates are agent-orchestration specs, not standalone Node scripts.** They
   use injected `agent`/`parallel`/`log` helpers and top-level `await`, so `node` won't run them directly
   (`node --check` even reports a false "Illegal return statement"). Treat them as the prompt + fan-out
   plan an LLM agent executes.
