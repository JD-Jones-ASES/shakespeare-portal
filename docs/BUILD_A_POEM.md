# Build a Poem — Runbook

Sibling to **[BUILD_A_PLAY.md](BUILD_A_PLAY.md)**, for Shakespeare's **poetry** (the Sonnets + the
narrative poems). A poem is modeled as a **"degenerate play"**: `acts → scenes → spoken lines`, each
spoken line carrying a continuous Through-Line Number and an **empty speaker**. The reader, the
`import.meta.glob` loader, the search index, all three validators, and the whole deterministic
merge/audit pipeline are **reused unchanged** — only the ingest step differs.

## The poem data model

- `text.json` validates against `schemas/play-text.schema.json` (no poem-specific schema).
- Each verse line: `{ "kind":"spoken", "tln":N, "speaker":"", "text":"..." }`. TLN runs `1..N` across
  the whole poem (the TLN convention applied literally).
- Stanza breaks are `{ "kind":"blank" }`. Sub-headings (`THRENOS`, the Lucrece `Argument`) are
  `stage_direction` lines.
- **Sonnets** — 11 acts = thematic chapters; one scene per sonnet (`scene.number` = sonnet number,
  `title` = `"Sonnet N"`). TLN 1–2155.
- **Narrative poems** — 1 act, scenes = neutral reading chunks (~150 lines) so the per-scene annotate
  fan-out and reader pages stay a sane size.
- **Two accommodations:** `SceneReader.astro` suppresses the speaker stripe when `speaker === ""` (the
  only site change); the catalog `act_count` cap was raised 5 → 20 for the Sonnets' 11 chapters.

## Steps

0. **Source + stub.** `shakespeare-material-master/texts/gutenberg/<slug>_gut.txt` exists for all six
   poems, and `data/catalog/works.json` already has a stub. The per-slug ingest config (chunk sizes,
   front-matter skip) lives in `scripts/pipeline/ingest-poem.mjs`.
1. **Ingest.** `node scripts/pipeline/ingest-poem.mjs <slug>` → `data/plays/<slug>/text.json`
   (self-contained: assigns global TLNs, no `normalize-tln.ts`). Verify the printed first/last line +
   `tln_count`; spot-check a known passage vs the source.
2. **Catalog + synopsis + characters.** Upgrade the catalog stub (`line_count`, `synopsis_short`,
   `difficulty_rating`, urls). Author `synopsis.json` (overview + per-scene summaries — for Lucrece the
   prose "Argument" becomes the overview). Author a minimal `characters.json` (allegorical / narrated
   figures; poems have no speakers, so this is context only).
3. **Reference cards FIRST** (`data/references/{classical,historical,biblical}.json`) — a small
   per-poem delta atop the existing banks (the Ovid bank, the Roman/Plutarch bank, the classical-myth
   bank). Ground new cards in public-domain sources.
   Validate: `cd scripts ; node --import tsx validate/schema-check.ts` and `… citation-check.ts`.
4. **Sonnets only — extract the companion.** `node scripts/pipeline/extract-sonnet-companion.mjs`
   reads the 154 `sonnet_NNN_companion.tex` and writes annotate **seeds**, `synopsis.json`, and
   **glossary candidates**. The companion is internal reference material — a drafting aid whose readings
   are fact-checked and re-cited from primary sources, and never cited itself. (`reflect` discussion
   prompts are dropped — out of scope.)
5. **Render scenes.** `node scripts/pipeline/render-scenes.mjs <slug>` → copy the printed `scenes` arg.
6. **Annotate (LLM agent).** Run `annotate.mjs` with `{ slug, scenes }`. The Sonnets also pass
   `{ seeds }` (the annotator verifies + re-cites them). Narrative poems are cold generation (optional
   `guidance` for content-care, e.g. Lucrece). Process the Sonnets a chapter at a time to keep each
   annotate run a sane size.
7. **Merge.** `node scripts/pipeline/postprocess.mjs <slug> --reset` (resolve-anchors + 2-of-3 gate).
8. **Glossary.** Sonnets = the deterministic merge from step 4 → `merge-glossary.ts`. Narrative poems
   = the `glossary.mjs` agent run → `merge-glossary.ts`.
9. **Index + audit.** `cd scripts ; node --import tsx build-index.ts`, then
   `node scripts/pipeline/audit.mjs <slug>` (must exit 0).
10. **Clear the review queue** with a rescue pass (an agent re-cites split-decision items), as for plays.
11. **Browser-verify**: no blank speaker stripe; glossary underlines; Notes sidebar with cited
    annotations + working reference-card badges. Update the README count and `AGENTS.md`.

## Notes / gotchas

- **The Passionate Pilgrim is catalog-only** with a disputed-attribution note: the 1599 octavo was
  printed "by W. Shakespeare" but only ~5 of its 20 poems are his.
- `ingest-poem.mjs` numbers sonnets **positionally** — the Gutenberg source mislabels sonnet 128's
  header as `CXXXIII`; trusting the roman value desyncs the rest.
- Sonnets 99 (15 lines) and 126 (12 lines) are deliberate exceptions; the parser does not force 14.
- Narrative poems display continuous line numbers (TLN from 1) — correct for citation. For the Sonnets,
  the reader shows per-sonnet line numbers 1–N via a display offset while TLN stays globally unique for
  anchoring.
