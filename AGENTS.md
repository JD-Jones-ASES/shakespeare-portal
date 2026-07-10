# Shakespeare Portal — Agent Guide

You are working on a Shakespeare reading portal for students. The defining feature is **explaining what students don't already know**: archaic vocabulary, biblical allusions, classical mythology, historical context for the history plays, sexual puns, rhetorical devices, and topical Elizabethan references. Plain reading apps already exist (MIT, OSS, Folger); this product's differentiator is *layered, source-cited, depth-adjustable annotation*.

This file is the entry point for any coding agent or developer working in the repo. The project is complete; this guide explains how it is built so you can read it, extend it, or build something similar.

## Audience

- **Primary**: High-school students (grades 9–12) and early-college undergraduates encountering Shakespeare in a class.
- **Secondary**: Self-directed adult learners returning to the canon.
- **Assume no priors**: zero biblical literacy, no classical mythology, no Tudor history, no Elizabethan slang. Annotate as if the reader is meeting Shakespeare for the first time.
- **Don't condescend.** Concise, neutral, source-cited prose. Treat the reader as a smart person who simply hasn't met this material before.

## Repo Map

| Path | Read this when… |
|---|---|
| **[docs/BUILD_A_PLAY.md](docs/BUILD_A_PLAY.md)** | **You're building a play end-to-end — the step-by-step runbook. START HERE.** |
| **[docs/BUILD_A_POEM.md](docs/BUILD_A_POEM.md)** | **You're building a poem (Sonnets or a narrative poem) — the poetry runbook.** |
| [README.md](README.md) | You want the human-facing overview |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | You need to understand how pieces connect |
| [docs/CONTENT_STANDARDS.md](docs/CONTENT_STANDARDS.md) | You're writing or reviewing annotation prose |
| [docs/ANNOTATION_SCHEMA.md](docs/ANNOTATION_SCHEMA.md) | You're emitting or parsing annotation JSON |
| [docs/METADATA_SCHEMA.md](docs/METADATA_SCHEMA.md) | You're adding or auditing play-level catalog fields |
| [docs/PIPELINE.md](docs/PIPELINE.md) | You want the conceptual five-stage pipeline (the runbook is the how-to) |
| [docs/UX_PRINCIPLES.md](docs/UX_PRINCIPLES.md) | You're designing or changing the reader UI |
| [docs/LICENSING.md](docs/LICENSING.md) | You're adding a new source or releasing content |
| [schemas/](schemas/) | You need the authoritative JSON Schema for any data file |
| [data/](data/) | The source of truth for all content — read but don't hand-edit annotations |
| [scripts/pipeline/](scripts/pipeline/) | The build kit: `extract-speakers`, `render-scenes`, `postprocess`, `audit` (`.mjs`, run from repo root with bare `node`) + the LLM annotate/glossary templates in `workflows/` |
| [scripts/](scripts/) | The lower-level pipeline (TypeScript via tsx — run from inside `scripts/`: `node --import tsx <x>.ts`) |
| [site/](site/) | The Astro app that renders the portal (100% data-driven; no edits needed to add a play) |
| [shakespeare-material-master/](shakespeare-material-master/) | Vendored "Open Shakespeare" source repo — **READ-ONLY** |

## Key Conventions

- **Through-Line Numbers (TLN)** — the scholarly standard from Hinman (1968), used by Folger and ISE. Every line in a play has one continuous integer across the whole play (not act/scene-relative). All annotations cite TLN, not act.scene.line.
- **Play slugs** — lowercase, underscore-separated (`hamlet`, `henry_iv_part_1`, `midsummer_nights_dream`). Match the slugs in `shakespeare-material-master/texts/works.json`.
- **Annotation IDs** — `<play_slug>-<tln_start>-<short_kebab>` (e.g., `hamlet-723-fishmonger`). Stable across rebuilds; never reuse.
- **Word offsets** — 0-indexed, inclusive on both ends. `word_start: 0, word_end: 0` is the first word on the line.
- **Depth tiers** — `basic` (shown by default for novice readers) vs `scholar` (off by default, surfaces textual variants, deep bawdy, etc.).
- **Confidence** — `high` (multi-source, uncontroversial), `medium` (defensible but contested), `uncertain` (excluded from default depth — surface to humans for review).
- **No emoji** in code, content, or docs unless explicitly requested.

## Building a play (the one workflow that matters)

**To build a whole play, follow [docs/BUILD_A_PLAY.md](docs/BUILD_A_PLAY.md) step by step.** It is the
end-to-end runbook — written so an agent can take a play from raw vendored text to a shipping, validated
reader. The 11 steps in brief:

1. Confirm the vendored source + catalog stub exist (Step 0).
2. **Author `data/plays/<slug>/characters.json` first** (`node scripts/pipeline/extract-speakers.mjs <slug>` to discover labels) — the parser canonicalizes speakers against its aliases.
3. Ingest: `cd scripts ; node --import tsx ingest/parse-gutenberg.ts <slug>` then `… ingest/normalize-tln.ts <slug>`. Verify Act 1 Scene 1 vs MIT/Folger.
4. Upgrade the `data/catalog/works.json` stub to shipping form; author `synopsis.json`.
5. **Author reference cards first** (append to `data/references/{classical,historical,biblical}.json`) — a link to a missing card fails citation-check.
6. `node scripts/pipeline/render-scenes.mjs <slug>` (writes per-scene text, prints the `scenes` arg).
7. Generate + fact-check by running the annotation template through an LLM agent (`scripts/pipeline/workflows/annotate.mjs`): one annotator per scene, then source + interpretation judges per scene.
8. Merge deterministically: `node scripts/pipeline/postprocess.mjs <slug> --reset` (resolve-anchors + 2-of-3 gate → `annotations.json` / `_review_queue/`).
9. Glossary via the same agent pattern (`scripts/pipeline/workflows/glossary.mjs`), then `cd scripts ; node --import tsx generate/merge-glossary.ts <slug> <actCount>`.
10. `cd scripts ; node --import tsx build-index.ts`, then `node scripts/pipeline/audit.mjs <slug>` (stats + all 3 validators; must exit 0).
11. Browser-verify the reader; then update this file's Project Status and the README count.

**Critical facts** (full list in the runbook): the build-kit `.mjs` scripts run from the **repo root**
with bare `node`; the lower-level `.ts` scripts run **only from inside `scripts/`** via
`node --import tsx`. `annotate-scene.ts`/`fact-check.ts` are stubs — the LLM generation runs through the
workflow templates driven by an agent. Adding a play needs **zero `site/` code changes**. (This repo was
developed on Windows/PowerShell; the scripts are cross-platform, but the runbook notes a couple of Windows
shell caveats.)

### Add a reusable reference card (standalone)
1. Decide kind: biblical, classical, or historical.
2. Append to `data/references/<kind>.json` (validates against `schemas/reference-card.schema.json`); preserve existing cards. The card's `kind` must match the file.
3. From an annotation, link via `references: [{ kind: "biblical", card_id: "cain-and-abel" }]`.

### Render the site locally
```
cd site
npm install
npm run dev
```
Visit `http://localhost:4321`. (If you use Claude Code, `.claude/launch.json` defines a `site` preview config.) On Windows, after adding a play, kill stray node processes so Astro re-scans `import.meta.glob`.

## Hard Rules

1. **Never edit anything inside [shakespeare-material-master/](shakespeare-material-master/).** It is vendored, read-only, and may be re-pulled.
2. **Never bypass schema validation in commits.** If a schema rejects valid data, the schema is wrong — fix it explicitly, don't `--no-verify`.
3. **Never publish an annotation without at least one source citation.** Unsourced glosses get `confidence: "uncertain"` and are excluded from the default depth.
4. **Every fact-check must record verifier model IDs + the three verdicts in the annotation object.** Auditing requires this.
5. **`data/` is the source of truth.** The site reads from `data/`; it never writes back. If you want to change content, change the JSON.
6. **All scholarly claims must be falsifiable.** A biblical reference cites book:chapter:verse (Geneva Bible 1599). A classical reference cites the source work and book/line. A historical claim cites a date and a primary or canonical secondary source.
7. **When uncertain, route to the review queue.** `data/plays/<slug>/_review_queue/` (gitignored) is where the fact-checker drops candidates that need human eyes. Don't merge guesses into `annotations.json`.

## Out of Scope

The portal deliberately does not include:

- User accounts, login, persistent reader state
- Social or shared annotation
- Audio narration, video performance footage
- Quizzes, assessments, grade-tracking
- Translation to non-English languages
- Mobile apps (the site is mobile-responsive but not native)

## Project Status

**The project is complete.** All 37 plays and all five canonical poetry works are annotated, validated,
and live on GitHub Pages; the content pipeline is proven and repeatable. What remains is optional polish,
not core work.

- **Shipped: 42 of 43 works** — every play, the **Sonnets** (all 154, grouped under 11 thematic-chapter
  "acts"), and the four narrative poems (*Venus and Adonis*, *The Rape of Lucrece*, *A Lover's Complaint*,
  *The Phoenix and the Turtle*). **11,273 annotations**, **222 source-cited reference cards**, and a
  per-work archaic-vocabulary glossary for each text. Only *The Passionate Pilgrim* is catalog-only — a
  largely non-Shakespearean miscellany held back on scholarly grounds.
- **Live on GitHub Pages**: <https://jd-jones-ases.github.io/shakespeare-portal/>, deployed from `main`
  by `.github/workflows/deploy.yml` (build the search index → `astro build` → deploy). Astro is configured
  with `base: '/shakespeare-portal/'`, so every internal link and `public/` fetch routes through
  `site/src/utils/url.ts` `withBase()` — add it to any new link.
- **Reader features** (all data-driven; adding a work needs no `site/` code): a warm-literary design with a
  light/dark/auto **theme toggle**; **Read / Study depth tiers** (Read = plain-English glosses only; Study
  = full apparatus — source citations, reference cards, bawdy and textual notes); a **character reading
  system** (per-character colors, plus Highlight and Focus modes for reading a part aloud); an instant
  hover/tap **word glossary**; two-way gloss↔line linking; a marginal notes sidebar with reference cards;
  full-corpus **search**; per-act/scene **synopsis**; and a fast-find landing portal.
- **Pipeline** (see [docs/PIPELINE.md](docs/PIPELINE.md) and [docs/BUILD_A_PLAY.md](docs/BUILD_A_PLAY.md)):
  ingest → LLM annotator (one agent per scene) → adversarial **3-judge fact-check** (source +
  interpretation judges + a deterministic anchor judge) → deterministic **2-of-3 merge**
  (`postprocess.mjs` = resolve-anchors + apply-verdicts) → validators → Astro reader. The glossary uses the
  same generate→fact-check pattern. The LLM stages were run by an agent against the prompt templates in
  `scripts/pipeline/workflows/`; the deterministic steps and all validators are real and runnable with bare
  Node. (`scripts/generate/annotate-scene.ts` and `fact-check.ts` are stubs — an SDK was never wired in;
  doing so for a fully headless/CI run is an optional follow-up.)
- **The parser handles every structural device in the canon.** Editions vary wildly — choruses,
  inductions, epilogues, dumb-shows, songs, play-within-a-play prologues, unison speech-prefixes, and
  sprawling minor casts. `scripts/ingest/parse-gutenberg.ts` absorbs these with small, **gated,
  per-edition normalizers**, each verified **byte-identical** against the already-shipped plays via a
  re-ingest diff. Any new parser behavior must preserve that invariant. Many structural quirks need no
  parser change at all — they are handled purely as `characters.json` alias data.
- **Known limitations**: (1) anchor highlighting is word-granular, so at a source's glued `;--`/`,--`
  token a highlight may over-cover by the adjacent word; (2) `_review_queue/`, `_candidates/`, and other
  `_*` files under `data/plays/` are gitignored intermediates — they exist on disk, not in version control;
  a small number of split-decision review-queue items are left for an optional rescue pass.
- **Optional follow-ups** (none required to ship): an accessibility toolbar (dyslexia font, adjustable
  line-height and font-size), a modern-English paraphrase layer, wiring `@anthropic-ai/sdk` into the
  stubbed drivers for a headless pipeline, and clearing the remaining review-queue items.
