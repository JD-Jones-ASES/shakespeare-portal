# Build a Play — Autonomous Runbook

End-to-end recipe for taking one Shakespeare play from raw vendored text to a fully-annotated,
validated, shipping reader. Written so a session can begin with:

> **"Read CLAUDE.md. Let's build `<play name>`."**

…and run to completion with minimal human intervention. Work in order; each step's output gates the
next. Slugs are lowercase underscore (e.g. `romeo_and_juliet`) and must match
`shakespeare-material-master/texts/works.json` and `data/catalog/works.json` (`playId`).

Adding a play is **100% data-driven** — no `site/` code changes. The Astro reader discovers
`data/plays/<slug>/text.json` via `import.meta.glob`. Your job is to produce the JSON.

---

## Environment & tooling (read once)

- **OS is Windows.** PowerShell 5.1: no `&&` (parser error) — use `;` or separate lines. **Never pipe
  a native command (`node`, `git`, `npm`) to `Select-Object`/`head`** — it closes the pipe early and
  the command reports **exit 255**, which (when batched in parallel) cancels sibling tool calls. To
  truncate, redirect to a file (`node x.mjs > out.txt 2>&1`) and Read it, or just let it print.
- **Don't batch many independent shell calls in one parallel turn.** One non-zero exit cancels the
  whole batch. Run mutating/independent commands sequentially, or chain with `;`.
- **The build kit** lives in `scripts/pipeline/` and is the path of least resistance. Plain Node ESM,
  runnable **from the repo root** with bare `node` (no `cd`, no tsx juggling):
  - `node scripts/pipeline/extract-speakers.mjs <slug>` — list speech-prefixes to seed characters.
  - `node scripts/pipeline/render-scenes.mjs <slug>` — write per-scene text + print the `scenes` arg.
  - `node scripts/pipeline/postprocess.mjs <slug> [--reset]` — resolve anchors + apply verdicts.
  - `node scripts/pipeline/audit.mjs <slug>` — distribution stats + all 3 validators (exit 1 on fail).
- **The original pipeline `.ts` scripts** (`scripts/generate/*.ts`, `scripts/validate/*.ts`,
  `scripts/ingest/*.ts`, `scripts/build-index.ts`) run via tsx and must be invoked **from inside
  `scripts/`**: `cd scripts ; node --import tsx generate/<x>.ts …`. Do **not** spawn
  `.bin/tsx.cmd` from Node — Windows can't spawn a `.cmd` shim that way (EINVAL). The build-kit
  `.mjs` wrappers already spawn `node --import tsx` with the right cwd; prefer them.
- **`annotate-scene.ts` / `fact-check.ts` are stubs.** Generation runs via the **Workflow tool** using
  the templates in `scripts/pipeline/workflows/`. The deterministic steps (resolve-anchors,
  apply-verdicts, merge-glossary, build-index) are real and runnable.
- You may use **WebSearch / WebFetch** to verify citations and fetch primary sources.
- `_candidates/`, `_review_queue/`, and `_*` files under `data/plays/` are gitignored intermediates.
- `.claude/settings.json` grants broad permissions in this project so the run needs no click-through.

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
- Ground new cards in **public-domain** sources via WebSearch (Plutarch/North 1579, Ovid/Golding 1567,
  Virgil, Livy, Cicero, Suetonius, Geneva Bible 1599, Holinshed). Cite — never quote — modern editions.
- Single quotes inside JSON strings, never unescaped `"`.
- Validate now: `cd scripts ; node --import tsx validate/schema-check.ts` and `… validate/citation-check.ts`.

## Step 5 — Render scenes

`node scripts/pipeline/render-scenes.mjs <slug>` — copy the printed **`scenes` array** (includes a
suggested annotation target per scene).

## Step 6 — Generate + fact-check (Workflow tool)

```
Workflow({
  scriptPath: "scripts/pipeline/workflows/annotate.mjs",
  args: { slug: "<slug>", scenes: <the array from Step 5> }
})
```
Fans out one annotator per scene, then source + interpretation judges per scene (~3 agents/scene).
Writes `_candidates/<a>-<s>.json`, `.source.json`, `.interp.json`.

## Step 7 — Deterministic merge

`node scripts/pipeline/postprocess.mjs <slug> --reset`

Per scene: `resolve-anchors.ts` computes offsets from `anchor_text` (auto-corrects small TLN errors;
drops anything it can't locate), then `apply-verdicts.ts` applies the **2-of-3 gate** → ships to
`annotations.json`, routes split decisions to `_review_queue/`, drops the rest. It stamps the required
`fact_checked*` fields, downgrades confidence on an uncertain verdict, bumps basic→scholar where
needed. Idempotent. Expect **~80-95% ship rate**.

## Step 8 — Glossary

```
Workflow({
  scriptPath: "scripts/pipeline/workflows/glossary.mjs",
  args: { slug: "<slug>", acts: [[1,[1,2,3]], [2,[1,2,3,4]], ...] }   // act -> its scene numbers
})
cd scripts ; node --import tsx generate/merge-glossary.ts <slug> <actCount>
```
Merge dedupes by normalized surface, keeps the shorter definition, caps at 140 chars → `glossary.json`.
Spot-check for garbage surfaces before shipping. Optional rigor: `_candidates/glossary-verify-*.json`
(`{delete:[…],fix:[…]}`) + `apply-glossary-verdicts.ts <slug>`.

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

```
powershell: Get-Process node | Stop-Process -Force   # so Astro re-scans import.meta.glob
```
`preview_start({ name: "site" })` (config already in `.claude/launch.json`), then confirm:
- `/plays/<slug>/` — title, metadata, synopsis, one scene link per scene.
- a dense scene (a famous speech) — TLN-numbered colored speeches, glossary underlines, Notes sidebar
  with real annotations + working reference-card badges.
- `preview_console_logs` clean; `preview_screenshot` as proof; then `preview_stop`.

## Step 11 — Update docs + memory

Update **Project Status** in `CLAUDE.md` (counts, scenes, cards, glossary), bump the README play count,
and update memory if anything non-obvious was learned.

---

## Quality bar (from the shipped plays)

| Metric | Target |
|---|---|
| Annotations / scene | ~1 per 12 spoken lines; 5-25/scene by density |
| Ship rate (fact-check) | 80-95% |
| Glossary entries | ~600-1000 (after dedup) |
| Reference-card links | every classical/historical/biblical allusion that has a card |
| Validators | all three green; **non-negotiable** |

Reference plays: Hamlet (324 / 813 gloss), Midsummer (183 / 724), Julius Caesar (168 / 1030).

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
  **classical_allusion** needs an allowlisted ancient author or recognized lexicon/edition token.

## Gotchas (hard-won)

1. **Unclosed `[` in source** → the bracket-chaser used to swallow the rest of the file (collapsed a
   whole play into "Act 2 Scene 1"). `parse-gutenberg.ts` now stops chasing at a blank line or
   ACT/SCENE header. If a future edition still misbehaves, look for a giant stage direction in text.json.
2. **`node --import tsx` must run from `scripts/`**; from repo root tsx won't resolve. Build-kit
   `.mjs` wrappers handle this — prefer them.
3. **Don't spawn `.bin/tsx.cmd` from Node** (`execFileSync` → EINVAL on Windows). Spawn `node` with
   `--import tsx` and `cwd: scripts/`.
4. **apply-verdicts mutates the shared `annotations.json`** — post-process serially, never in parallel.
5. **Subagent JSON** occasionally has unescaped inner `"` in citations — prompts say "single quotes
   inside strings"; if a candidate won't parse, that's almost always why.
6. **Windows + Astro** caches `import.meta.glob`; kill all node processes before restarting the dev
   server after adding a play.
7. **Reference-card kind must match its file** or citation-check fails on the link.
8. **PowerShell native-command + `Select-Object` pipe = exit 255** (broken pipe), and **parallel tool
   batches cancel on one failure.** Redirect to a file and Read it; run independent commands serially.
9. The tool harness sometimes **batches/delays output**; if a call looks empty, it likely still ran —
   re-check state with a Read rather than blindly re-running a mutating command.
10. **`node --check` on the workflow templates reports "Illegal return statement" — ignore it.** That's
    a false positive; workflow scripts run inside an async wrapper the Workflow tool supplies (top-level
    `return`/`await` and the injected `agent`/`pipeline`/`parallel`/`log`/`args` globals are all legal).
    Run them only via the Workflow tool, never standalone.
11. **Chorus / sonnet prologues are handled (added for Romeo and Juliet).** A `THE PROLOGUE` header that
    precedes the first `ACT`, or an `Enter Chorus` stage direction, opens a buffer that `parse-gutenberg.ts`
    prepends as TLN-numbered Chorus speech to the head of the act it introduces (so R&J's Act 1 prologue is
    TLN 1-14 at the top of 1.1, and the Act 2 prologue heads 2.1). Requires a `chorus` character in
    `characters.json` with aliases for the printed labels (R&J: `Chor.`, `Chorus.`). This also covers a
    play with a Chorus before every act (**Henry V**). The header match requires the word "THE" so a
    play-within-a-play's bare `PROLOGUE` speaker (Midsummer's mechanicals, Hamlet's Mousetrap) is not
    hijacked. Separately, a scene setting that wraps onto a second physical line (ending on a dangling
    word like "the"/"of") is rejoined — verify `setting` fields look complete after ingest.
12. **The Workflow tool may deliver `args` as a JSON string, not an object.** The `annotate.mjs` /
    `glossary.mjs` templates now `JSON.parse` a string arg, so just pass `args` as an object. If a future
    template throws "Workflow args must be…" with 0 agents run, it skipped that normalization.
