# Content Pipeline

Five stages, gated:

```
INGEST  →  GENERATE  →  FACT-CHECK  →  VALIDATE  →  BUILD
```

Each stage's output is the next stage's input. The validator gates the commit; the build runs only on validated data.

## Stage 1 — Ingest

**Goal**: Convert plain-text Gutenberg play into structured JSON with TLN.

**Scripts**:
- [`scripts/ingest/parse-gutenberg.ts`](../scripts/ingest/parse-gutenberg.ts) — pattern-matches `ACT N.` / `Scene N.` / `SPEAKER.` / `[stage direction]` from `shakespeare-material-master/texts/gutenberg/<slug>_gut.txt`. Emits a draft `text.json` with line breaks preserved.
- [`scripts/ingest/normalize-tln.ts`](../scripts/ingest/normalize-tln.ts) — walks the structured text, assigns Through-Line Numbers. Stage directions and act/scene headers get no TLN; only spoken lines.

**Output**: `data/plays/<slug>/text.json`. Schema: [`schemas/play-text.schema.json`](../schemas/play-text.schema.json).

**Quality gate**: Hand-spot-check Act 1 Scene 1 against MIT Shakespeare for accuracy. If the speaker labels, line breaks, or stage directions don't match within reason, fix the parser before moving on.

**Preflight — author `characters.json` BEFORE parsing**:
- The parser canonicalizes speaker labels against the alias map in `data/plays/<slug>/characters.json`. For plays whose Gutenberg edition uses ALL-CAPS labels without a trailing dot (e.g. Midsummer's `THESEUS`), the alias map is required — the regex fallback in `looksLikeSpeaker` only catches dot-suffixed labels. Author the character list first with both `BARE` and `BARE.` and the mixed-case `Bare.` variants in `aliases[]`. Include any chorus, numbered, or play-within-a-play roles (e.g. `FIRST FAIRY`, `ALL`, `PYRAMUS`).
- The parser already handles song / verse section markers (`SONG.`, `CHORUS.`, roman-numeral verse markers like `I.`/`II.`): `SONG.` and roman numerals become stage directions; `CHORUS.` routes to whatever speaker has `CHORUS`/`CHORUS.` in its alias map (typically an `all` chorus speaker), preserving correct attribution in lullabies and play-within-a-play interludes.

**Other known issues**:
- Gutenberg uses inconsistent speaker abbreviations across plays (`Ber.` vs `Bernardo.`). The parser canonicalizes against the character list when present.
- Some Gutenberg editions split prose lines at arbitrary widths. The parser rejoins prose paragraphs before TLN assignment.
- First Folio editions (`*_gut_f.txt`) preserve early modern spelling. We use the modern-spelling files (`*_gut.txt`) as primary; the Folio files are available for scholar-depth textual notes.
- Schema caps annotation `summary` at 600 chars — long mythology summaries occasionally need trimming after the annotator subagent runs.

### Poem ingest variant (Phase B)

Poems skip `parse-gutenberg.ts` (which keys on `ACT`/`SCENE`/`SPEAKER` headers poems don't have). A
dedicated, separate ingester — [`scripts/pipeline/ingest-poem.mjs`](../scripts/pipeline/ingest-poem.mjs) —
emits the same `text.json` shape as a **"degenerate play"**: one `spoken` line per verse line with a
continuous TLN and an **empty `speaker`**, blank-line stanzas as `kind:"blank"`, and sub-headings
(`THRENOS`) as stage directions. The Sonnets become 11 thematic-chapter "acts" (one scene per sonnet);
the narrative poems are one act chunked into ~150-line reading scenes. Everything downstream (generate,
fact-check, validate, build) is unchanged. Full how-to: [BUILD_A_POEM.md](BUILD_A_POEM.md).

## Stage 2 — Generate (Sonnet subagents)

**Goal**: Produce candidate annotations for a scene.

**Driver**: [`scripts/generate/annotate-scene.ts`](../scripts/generate/annotate-scene.ts)

**Per-scene flow**:
1. Load `data/plays/<slug>/text.json` and extract the target scene with TLN range.
2. Load `data/plays/<slug>/characters.json` and `synopsis.json` (if present) for context.
3. Spawn one Sonnet subagent per scene, with:
   - Prompt template [`scripts/generate/prompts/annotator.md`](../scripts/generate/prompts/annotator.md)
   - The scene text (with TLN line prefixes)
   - The character list
   - A summary of the prior scene
   - The annotation taxonomy + 8–10 worked examples
4. The subagent returns a JSON array of candidate annotations conforming to [`schemas/annotation.schema.json`](../schemas/annotation.schema.json) (minus the `fact_checked*` fields, which are filled in the next stage).
5. Save to `data/plays/<slug>/_candidates/<act>-<scene>.json` (gitignored).

**Quality target**: 5–25 annotations per scene depending on density. Fewer than 3 → re-prompt. More than 30 → likely over-annotating; reduce.

**Cost discipline**: Spawn scenes in parallel up to the workflow concurrency cap. Don't re-run on already-completed scenes unless prompts change.

## Stage 3 — Fact-check (the adversarial panel)

**Goal**: Catch hallucinations, broken anchors, and bad readings before they ship.

**Driver**: [`scripts/generate/fact-check.ts`](../scripts/generate/fact-check.ts)

**Per-candidate flow** — three judges run in parallel, each with a single lens:

### Judge A — Source correctness
- **Input**: The annotation's `sources[]` claims and `summary`/`detail` text. **No other context.**
- **Question**: Does each cited source actually support what the annotation claims?
- **Default**: `refuted = true` if any cited verse, classical passage, lexicon entry, or scholar's reading appears fabricated, misquoted, or stretched.
- **Tools**: WebSearch / WebFetch for verses and OED-style lookups; the model's own knowledge for canonical scholars.
- **Verdict**: `verified | refuted | uncertain` + one-sentence note.

### Judge B — Anchor correctness
- **Input**: The play's `text.json` and the annotation's `tln_start`, `tln_end`, `word_start`, `word_end`, `anchor_text`. **No prose.**
- **Question**: Does `anchor_text` actually appear at the indicated TLN/word span?
- **Default**: `refuted = true` if the anchor is missing, off by more than one word, or spans a stage direction.
- **Verdict**: `verified | refuted` (no uncertainty allowed; this is deterministic).

### Judge C — Interpretation
- **Input**: The annotation's prose, the surrounding scene, and the character list.
- **Question**: Is the reading defensible — neither a folk-etymology, nor a discredited (e.g., Bowdlerized, Romantic-era) reading, nor an over-reach?
- **Default**: `refuted = true` if the gloss reaches.
- **Verdict**: `verified | refuted | uncertain` + one-sentence note.

### Decision rule
- **All three verified** → ship at depth specified.
- **Two verified, one uncertain** → ship; downgrade `confidence` one notch if not already low.
- **Two verified, one refuted** — if Judge B refuted, drop. Otherwise, route to `_review_queue/`.
- **One verified, two refuted-or-uncertain** → drop.

### Recording
Every annotation persists all three verdicts in `fact_check_verdicts[]`, with the model ID for each judge. This is non-negotiable. We audit.

## Stage 4 — Validate

**Drivers** (all in [`scripts/validate/`](../scripts/validate/)):

### `schema-check.ts`
- Walk every JSON file under `data/`.
- Validate against its schema in `schemas/`.
- Fail commit on any violation.

### `anchor-check.ts`
- For every annotation, load the play's `text.json`.
- Walk to `tln_start`. Extract the line. Compute its word offsets.
- Confirm `anchor_text` appears verbatim at `[word_start..word_end]`.
- Multi-line annotations: confirm `tln_end > tln_start` matches the actual line range.

### `citation-check.ts`
- Biblical: `^(1|2|3)? ?[A-Z][a-z]+ \d+:\d+(-\d+)?( \([A-Za-z ]+\))?$` (Genesis 3:14, 1 Samuel 17:50, Luke 16:22 (Geneva 1599)).
- Classical: source from allowlist (`Ovid`, `Plutarch`, `Virgil`, `Homer`, `Hesiod`, `Seneca`, `Holinshed`, `Boccaccio`, `Chaucer`, `North`, `Golding`) + book.line or page.
- Reference-card cross-references resolve to an existing card.
- Source `name` is non-empty; `citation` is non-empty.

### CI integration (future)
A GitHub Actions workflow runs `npm run validate` on every PR. Failures block merge.

## Stage 5 — Build (Astro)

**Site root**: [`site/`](../site/)

- Astro Content Collections load `data/catalog/works.json`, `data/plays/<slug>/*.json`, `data/references/*.json`, `data/glossary/shared.json`.
- Type-safe queries: the collection schemas import directly from `schemas/`.
- Static site generation: one HTML file per scene, plus the catalog, play landings, about, and search.
- Interactive islands:
  - **Gloss sidebar** (React) — receives the current scene's annotations and renders the gloss column.
  - **Depth toggle** (React) — switches `basic` / `scholar` / `off`.
  - **Search bar** (React) — hits a pre-built MiniSearch index loaded on first interaction.
  - **Character filter** (React) — toggles which characters' speeches are visible.

**Output**: `site/dist/`. Deploy by copying `dist/` to any static host.

## Local recipes

```
# Ingest one play
npx tsx scripts/ingest/parse-gutenberg.ts hamlet
npx tsx scripts/ingest/normalize-tln.ts hamlet

# Generate annotations for one scene
npx tsx scripts/generate/annotate-scene.ts hamlet 1 1

# Fact-check pending candidates
npx tsx scripts/generate/fact-check.ts hamlet

# Validate everything
npx tsx scripts/validate/schema-check.ts
npx tsx scripts/validate/anchor-check.ts
npx tsx scripts/validate/citation-check.ts

# Run the site
cd site && npm run dev
```

## How this actually runs today

This document is the **conceptual** five-stage model. For the **operational** step-by-step (exact
commands, Windows gotchas, the build kit, and the Workflow templates), follow
[BUILD_A_PLAY.md](BUILD_A_PLAY.md) — it is the source of truth for *how* to build a play.

- `annotate-scene.ts` and `fact-check.ts` (the Stage 2/3 drivers shown above) are **stubs** — they were
  never wired to an SDK. In practice, generation runs through the **Workflow tool** using
  `scripts/pipeline/workflows/{annotate,glossary}.mjs` (one Sonnet subagent per scene + per-scene
  source/interpretation judges), and the deterministic merge runs via `scripts/pipeline/postprocess.mjs`
  (which calls the real `resolve-anchors.ts` + `apply-verdicts.ts`).
- The validators and all `scripts/generate/*.ts` deterministic steps are real and runnable now (no SDK
  dependency). The `scripts/pipeline/*.mjs` build kit wraps them with the correct Windows-safe invocation.
- Wiring `@anthropic-ai/sdk` into the stubs for a fully headless/CI run remains the one deferred item.
