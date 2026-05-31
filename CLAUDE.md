# Shakespeare Portal — Agent Guide

You are working on a Shakespeare reading portal for students. The defining feature is **explaining what students don't already know**: archaic vocabulary, biblical allusions, classical mythology, historical context for the history plays, sexual puns, rhetorical devices, and topical Elizabethan references. Plain reading apps already exist (MIT, OSS, Folger); this product's differentiator is *layered, source-cited, depth-adjustable annotation*.

## Audience

- **Primary**: High-school students (grades 9–12) and early-college undergraduates encountering Shakespeare in a class.
- **Secondary**: Self-directed adult learners returning to the canon.
- **Assume no priors**: zero biblical literacy, no classical mythology, no Tudor history, no Elizabethan slang. Annotate as if the reader is meeting Shakespeare for the first time.
- **Don't condescend.** Concise, neutral, source-cited prose. Treat the reader as a smart person who simply hasn't met this material before.

## Repo Map

| Path | Read this when… |
|---|---|
| **[docs/BUILD_A_PLAY.md](docs/BUILD_A_PLAY.md)** | **You're building a play end-to-end — the autonomous runbook. START HERE.** |
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
| [scripts/pipeline/](scripts/pipeline/) | The build kit: `extract-speakers`, `render-scenes`, `postprocess`, `audit` (`.mjs`, run from repo root with bare `node`) + Workflow templates in `workflows/` |
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
autonomous runbook — written so this session can start from "Read CLAUDE.md. Let's build `<play>`." and
run to a shipping, validated reader with minimal intervention. The 11 steps in brief:

1. Confirm the vendored source + catalog stub exist (Step 0).
2. **Author `data/plays/<slug>/characters.json` first** (`node scripts/pipeline/extract-speakers.mjs <slug>` to discover labels) — the parser canonicalizes speakers against its aliases.
3. Ingest: `cd scripts ; node --import tsx ingest/parse-gutenberg.ts <slug>` then `… ingest/normalize-tln.ts <slug>`. Verify Act 1 Scene 1 vs MIT/Folger.
4. Upgrade the `data/catalog/works.json` stub to shipping form; author `synopsis.json`.
5. **Author reference cards first** (append to `data/references/{classical,historical,biblical}.json`) — a link to a missing card fails citation-check.
6. `node scripts/pipeline/render-scenes.mjs <slug>` (writes per-scene text, prints the `scenes` arg).
7. Generate + fact-check via the **Workflow tool**: `scripts/pipeline/workflows/annotate.mjs`.
8. Merge deterministically: `node scripts/pipeline/postprocess.mjs <slug> --reset` (resolve-anchors + 2-of-3 gate → `annotations.json` / `_review_queue/`).
9. Glossary via Workflow `scripts/pipeline/workflows/glossary.mjs`, then `cd scripts ; node --import tsx generate/merge-glossary.ts <slug> <actCount>`.
10. `cd scripts ; node --import tsx build-index.ts`, then `node scripts/pipeline/audit.mjs <slug>` (stats + all 3 validators; must exit 0).
11. Browser-verify with the preview tools; then update this file's Project Status, the README count, and memory.

**Critical environment facts** (full list in the runbook): the OS is **Windows** — in PowerShell use `;` not `&&`, and never pipe `node`/`git`/`npm` to `Select-Object` (broken pipe → exit 255 → cancels parallel sibling calls). The build-kit `.mjs` scripts run from the **repo root** with bare `node`; the `.ts` scripts run **only from inside `scripts/`** via `node --import tsx`. `annotate-scene.ts`/`fact-check.ts` are stubs — generation goes through the Workflow templates. Adding a play needs **zero `site/` code changes**.

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
Visit `http://localhost:4321`. (When driving via the preview tools, `.claude/launch.json` defines a `site` config — `preview_start({ name: "site" })`.) On Windows, after adding a play, kill stray node processes so Astro re-scans `import.meta.glob`.

## Hard Rules

1. **Never edit anything inside [shakespeare-material-master/](shakespeare-material-master/).** It is vendored, read-only, and may be re-pulled.
2. **Never bypass schema validation in commits.** If a schema rejects valid data, the schema is wrong — fix it explicitly, don't `--no-verify`.
3. **Never publish an annotation without at least one source citation.** Unsourced glosses get `confidence: "uncertain"` and are excluded from the default depth.
4. **Every fact-check session must record verifier model IDs + the three verdicts in the annotation object.** Auditing requires this.
5. **`data/` is the source of truth.** The site reads from `data/`; it never writes back. If you want to change content, change the JSON.
6. **All scholarly claims must be falsifiable.** A biblical reference cites book:chapter:verse (Geneva Bible 1599). A classical reference cites the source work and book/line. A historical claim cites a date and a primary or canonical secondary source.
7. **When uncertain, route to the review queue.** `data/plays/<slug>/_review_queue/` (gitignored) is where the fact-checker drops candidates that need human eyes. Don't merge guesses into `annotations.json`.

## Out of Scope (v1)

- User accounts, login, persistent reader state
- Social or shared annotation
- Audio narration, video performance footage
- Quizzes, assessments, grade-tracking
- Translation to non-English languages
- Mobile apps (we are mobile-responsive but not native)

These may come later. Don't build for them now.

## Project Status

- **Plays shipping** (4):
  - **Hamlet** — 5 acts, 20 scenes, 3897 TLN'd lines; **324 annotations**, **24 reference cards** (30 links), 32 in `_review_queue/`, **813-entry glossary**.
  - **A Midsummer Night's Dream** — 5 acts, 10 scenes, 2106 TLN'd lines; **183 annotations** (95% ship rate from 192 candidates), wired to **7 reference cards** (6 new + reused `hercules`) via 16 links, 6 in `_review_queue/`, **724-entry glossary**.
  - **Julius Caesar** — 5 acts, 18 scenes, 2585 TLN'd lines; **168 annotations** (80% ship rate from 210 candidates), wired to **18 reference cards** (14 new Roman/classical/historical + reused `alexander-and-caesar`, `fortunes-wheel`, `the-antique-roman`, `sixth-commandment`), 34 in `_review_queue/`, **1030-entry glossary**. Heavy on `historical_topical` (42) and `classical_allusion` (29) — Plutarch's *Lives* (North 1579) is the play's source. Required a parse-gutenberg fix (unclosed `[` at source line 1113 was swallowing the rest of the file).
  - **Romeo and Juliet** — 5 acts, 24 scenes, 3059 TLN'd lines; **262 annotations** (88% ship rate from ~298 candidates), wired to **13 reference cards** via 34 links — 11 new (classical: `phaethon`, `diana-goddess`, `echo-nymph`, `helen-of-troy`; historical: `petrarch-and-the-sonnet`, `prince-of-cats`, `queen-mab`, `shrift-and-confession`, `palmers-and-pilgrims`, `elizabethan-plague`, `mandrake-folklore`) + reused `cupid-arrows`, `pyramus-thisbe`, `fortunes-wheel`, `sixth-commandment` — 25 in `_review_queue/`, **1004-entry glossary**. Rich in `archaic_vocab` (104), `rhetorical_device` (36), `classical_allusion` (14), `bawdy_pun` (13). Required a **gated `parse-gutenberg.ts` enhancement**: the Act 1 Chorus prologue ('star-cross'd lovers') sits *before* `ACT I.` and the Act 2 prologue is a title-case `Chorus.`; both are now buffered (triggered by `THE PROLOGUE`/`Enter Chorus`) and prepended as TLN-numbered Chorus speech to the head of the act they introduce (Act 1 prologue = TLN 1-14). Two wrapped scene settings (3.5, 5.3) are rejoined. Hamlet/Midsummer/JC verified unaffected by static analysis (the change is gated behind a `chorus` speaker / "THE PROLOGUE" header / dangling-word setting, none of which they contain).
  - 38 other works are catalog-only.
- **Reader features (all live & verified in-browser)**:
  - **Warm-literary design system** with light/dark/auto **theme toggle** (`components/ThemeToggle.tsx`, no-flash inline script in `Base.astro`, tokens under `:root[data-theme]`); serif play text (EB Garamond).
  - **Read / Study depth tiers** (`DepthToggle.tsx`): Read = clean plain-English glosses only; Study = full apparatus (detail, source citations, full reference cards, plus `bawdy_pun`/`textual_variant`/scholar notes). Markers for Study-only notes are hidden in Read.
  - **Character reading system** (`components/ReadingControls.tsx`): per-character colors (`color` field in `characters.json`); modes Normal / Color-speakers / Highlight / **Focus** (with Prev/Next-line cue jumps for reading a part aloud) for classroom reading. Speaker name printed **once per speech** with a colored stripe (Folger style).
  - **Instant hover/tap word glossary** (`components/SceneReader.astro` + `site/src/data/glossary.ts`): archaic words get a subtle underline + tooltip (`.gloss-term` + `data-def`); "word help" on/off toggle.
  - Two-way gloss↔line linking (`ReaderInteractions.astro`); marginal gloss sidebar with reference cards; **full-play search** (header `SearchBar.tsx` + `build-index.ts`); per-act/scene **synopsis** on the landing page. Manual test script: [docs/PROTOTYPE_TEST.md](docs/PROTOTYPE_TEST.md).
- **Pipeline proven on four plays**: ingest → Sonnet annotator subagents → deterministic anchor resolution (`resolve-anchors.ts`, shared matcher in `lib/text.ts`) → adversarial fact-check (source + interpretation Sonnet judges + deterministic anchor judge, merged by `apply-verdicts.ts`) → validators → Astro reader. Glossary uses the same generate→fact-check pattern (`merge-glossary.ts`, `apply-glossary-verdicts.ts`). **`reanchor.ts`** re-resolves shipped annotations after a re-ingest so TLN shifts don't break anchors. All 3 validators pass; the site builds. Julius Caesar was run via the **Workflow** tool (one annotator subagent per scene → source+interp judges per scene), then the deterministic merge steps run serially from inside `scripts/` (must use `node --import tsx …` from `scripts/`; `node`'s `execFileSync` can't spawn the `.bin/tsx.cmd` shim on Windows — EINVAL). Romeo and Juliet ran the same way (24 annotators + 48 judges, then a 5-act glossary fan-out). The `workflows/annotate.mjs` and `workflows/glossary.mjs` templates were hardened to accept `args` delivered as a JSON **string** as well as an object (`const input = typeof args === 'string' ? JSON.parse(args) : args`) — without it the Workflow tool can throw "Workflow args must be…" before any agent runs.
- **Next**: rescue `_review_queue/` items with stronger citations (97 total across the four plays); then a fifth play — **Henry V** is a strong candidate (first history: Holinshed sourcing + French/dialect scenes; its per-act Choruses are already handled by the R&J prologue/Chorus buffering) or a prose comedy (Much Ado / Twelfth Night) to harden prose ingest. Deferred: accessibility toolbar, modern-English paraphrase, wiring `@anthropic-ai/sdk` into `annotate-scene.ts`/`fact-check.ts` for headless/CI runs (still stubbed; the prototype ran via interactive subagents).
- **Known limitations**: (1) anchor highlighting is word-granular, so at a source's glued `;--`/`,--` token a highlight may over-cover by the adjacent word; (2) annotator/glossary subagents occasionally emit JSON with unescaped inner double-quotes in citations — prompts include "use single quotes inside strings"; (3) `_review_queue/`, `_candidates/`, and `_*` files are gitignored — they exist on disk but not in version control; (4) on Windows, Astro's dev-server caches `import.meta.glob`; after adding a play's `text.json`, kill stray `node` processes before restarting; (5) some Gutenberg editions have an unclosed `[` stage-direction bracket that, before the guard added to `parse-gutenberg.ts`, made the bracket-chaser swallow the rest of the file — the parser now stops chasing at a blank line or ACT/SCENE header.
