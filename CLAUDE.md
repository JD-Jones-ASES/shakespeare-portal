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
| [docs/BUILD_LOG.md](docs/BUILD_LOG.md) | You want the per-play changelog, the reference-card ledger, or the parser-quirk history |
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

The portal ships **28 of 43 plays** and is **live on GitHub Pages**. The per-play changelog, the
reference-card ledger, and the session-by-session pipeline/parser history now live in
**[docs/BUILD_LOG.md](docs/BUILD_LOG.md)** — consult it for the detail behind any shipped play. This
section stays high-level.

- **Shipped (28 of 43)** — **7,881 annotations**, **173 reference cards**, per-play glossaries (~720–1,170 entries each), all `_review_queue/`s clear corpus-wide. The 4 pilots (Hamlet, A Midsummer Night's Dream, Julius Caesar, Romeo and Juliet); all 10 English histories (Richard II, Henry IV Parts 1–2, Henry V, Henry VI Parts 1–3, Richard III, King John, Henry VIII); the 4 romances (The Tempest, Pericles, Cymbeline, The Winter's Tale); 3 framing/pageant comedies (The Taming of the Shrew, Love's Labour's Lost, The Comedy of Errors); the 3 Roman tragedies (Coriolanus, Titus Andronicus, Antony and Cleopatra); the 2 Holinshed tragedies (Macbeth, King Lear); the 2 festive comedies (Much Ado About Nothing, Twelfth Night). 15 works remain catalog-only. **Per-play detail (TLN counts, annotation/glossary tallies, card deltas, speaker quirks) → [docs/BUILD_LOG.md](docs/BUILD_LOG.md).**
- **Reference cards: 173 total.** Corpus-wide infrastructure: the history "spine" (`edward-iii-and-his-sons`, `the-kings-two-bodies`, `the-great-chain-of-being`, `de-casibus-tragedy`, `trial-by-combat`, `holinshed-chronicles`, `pilate-washing-hands`) + `divine-right-of-kings`/`the-vice`/`fortunes-wheel`/`cain-and-abel`; the Roman/Plutarch bank (Julius Caesar + Coriolanus — `plutarchs-lives`, `the-roman-triumph`, `the-antique-roman`, `pompey-the-great`, `the-tribunes-of-the-people`, `the-roman-consulship`…); the **Ovid bank** (Titus — `ovids-metamorphoses`, `philomela`, `tarquin-and-lucrece`, `seneca-and-revenge-tragedy`; forward-reusable for the Phase-B poems); the **Antony and Cleopatra delta** (Egyptian/battle/triumvirate — `cleopatra-as-isis`, `the-barge-on-the-cydnus`, `the-battle-of-actium`, `the-asp`, `the-ptolemies-and-egypt`, `the-second-triumvirate`, `augustus-and-the-pax-romana`); the **Holinshed-tragedy delta** (Macbeth — the weird sisters/`Daemonologie`, equivocation/Gunpowder Plot, the King's-Evil, Banquo's Stuart line; King Lear — Harsnett's devils, the King Leir legend, the division of Britain, Dover cliff, the eclipses); the **festive-comedy delta** (Much Ado — `the-cuckolds-horns`, `nothing-and-noting`, `chastity-and-the-double-standard`, `the-constable-and-the-watch`, `hero-and-leander`; Twelfth Night — `twelfth-night-and-the-lord-of-misrule`, `puritanism-and-revelry`, `illyria`, `arion-and-the-dolphin`, `elysium`, `pythagoras-and-the-transmigration-of-souls`); and the classical-myth banks. The **targeted-delta** thesis — author a small per-play card delta, reuse the rest — has held every session (a 12th time with Much Ado and Twelfth Night, reusing the comedy/love banks — `cupid-arrows`, `diana-goddess`, `petrarch-and-the-sonnet`, `the-stage-machiavel`, `falconry-and-the-haggard`). Per-session card ledger → [docs/BUILD_LOG.md](docs/BUILD_LOG.md).
- **Live on GitHub Pages**: <https://jd-jones-ases.github.io/shakespeare-portal/> — public repo `JD-Jones-ASES/shakespeare-portal`, deployed by `.github/workflows/deploy.yml` (CI builds the search index, then `astro build`, then `deploy-pages`). Astro `base: '/shakespeare-portal/'`; every internal link routes through `site/src/utils/url.ts` `withBase()` (add it to any new link or `public/` fetch). The landing page (`pages/index.astro`) is a status-aware launch: hero + a 28-of-43 progress bar, a build-time **stats band**, a **"Now open"** shelf of the live plays as rich cards, and a genre-grouped **"In the wings"** catalog of the rest. (The progress bar / stats band are build-time computed from `data/`, so they update automatically.)
- **Accuracy**: a 2026-05-31 sweep verified every reference card and audited all `medium`/`uncertain` annotations; it cleared the then-open review queues by fixing citations honestly, not cutting glosses (per memory `review-queue-citation-policy`). Detail in [docs/BUILD_LOG.md](docs/BUILD_LOG.md).
- **Reader features (all live & verified in-browser)**:
  - **Warm-literary design system** with light/dark/auto **theme toggle** (`components/ThemeToggle.tsx`, no-flash inline script in `Base.astro`, tokens under `:root[data-theme]`); serif play text (EB Garamond).
  - **Read / Study depth tiers** (`DepthToggle.tsx`): Read = clean plain-English glosses only; Study = full apparatus (detail, source citations, full reference cards, plus `bawdy_pun`/`textual_variant`/scholar notes). Markers for Study-only notes are hidden in Read.
  - **Character reading system** (`components/ReadingControls.tsx`): per-character colors (`color` field in `characters.json`); modes Normal / Color-speakers / Highlight / **Focus** (with Prev/Next-line cue jumps for reading a part aloud) for classroom reading. Speaker name printed **once per speech** with a colored stripe (Folger style).
  - **Instant hover/tap word glossary** (`components/SceneReader.astro` + `site/src/data/glossary.ts`): archaic words get a subtle underline + tooltip (`.gloss-term` + `data-def`); "word help" on/off toggle.
  - Two-way gloss↔line linking (`ReaderInteractions.astro`); marginal gloss sidebar with reference cards; **full-play search** (header `SearchBar.tsx` + `build-index.ts`); per-act/scene **synopsis** on the landing page. Manual test script: [docs/PROTOTYPE_TEST.md](docs/PROTOTYPE_TEST.md).
- **Pipeline** (proven on all 24): ingest → annotator subagents via the **Workflow** tool → adversarial 3-judge fact-check (source + interpretation Sonnet judges + a deterministic anchor judge) → deterministic 2-of-3 merge (`postprocess.mjs` = resolve-anchors + apply-verdicts) → validators → Astro reader; the glossary uses the same generate→fact-check pattern (`merge-glossary.ts`). `reanchor.ts` re-resolves shipped annotations after a re-ingest. **Process rules (hard-won):** run **at most one heavy annotate Workflow at a time, and keep heavy local node work (postprocess/build-index/audit) off the machine while it runs** — concurrent heavy load silently drops candidate files (the workflow still reports "completed"; Session 11's Lear annotate lost 23/26 scenes to local-node contention, recovered by re-running with the machine quiet) — a light ~5-agent glossary alongside is fine. `apply-verdicts.ts` now drops a null/undefined `detail` (some annotators emit `detail: null`, which fails schema-check; the fix is byte-identical for prior plays, which carry no null detail). Clear review queues with the Opus rescue Workflow (`workflows/_rescue-queues.mjs`; update its `PLAYS` array + `meta.description`) → `_merge-rescued.mjs <slug>` → `_sort-annotations.mjs <slug>` (the merge appends rescued items, so audit flags a non-failing `tln_order`). The deterministic `.ts` steps must run from inside `scripts/` via `node --import tsx` (Windows can't spawn `.bin/tsx.cmd` from Node). The classical-citation allowlist has gained `Herodotus`, `Pindar`, `Pausanias`, `Xenophon`, `Diogenes Laertius`, `Diodorus Siculus`, `Musaeus`, `Heliodorus` across sessions. **Session-by-session history → [docs/BUILD_LOG.md](docs/BUILD_LOG.md).**
- **The parser handles every structural device in the canon** (feature-complete after Session 8). It carries gated, per-play normalizers — each verified **byte-identical for prior shipped plays** via the re-ingest regression diff — for Chorus/Induction/Epilogue devices (Romeo and Juliet, Henry V, Henry IV Part 2, Henry VIII), the Henry VI edition (unbracketed SDs + separate-line settings), inline stage directions (Henry VI), Pericles' per-act Gower presenter + dumb-shows, and the Taming of the Shrew's Sly Induction-as-pseudo-act (act 0). Session 10 added two **general (non-gated)** header fixes for Antony and Cleopatra — proper Roman-numeral parsing for scenes above X (its Act 3 has 13 scenes, Act 4 has 15) and splitting a combined `ACT n. SCENE m.` header line — both proven **byte-identical for all 23 prior plays** by an original-vs-patched re-ingest hash diff. Session 11 (Macbeth + King Lear) needed **no parser change** — both are standard structure (Lear's title-case `Scene I.` headers and abbreviated speaker prefixes parse like Hamlet, via the case-insensitive `SCENE_HEADER` regex + complete `characters.json` aliases). Session 12 (Much Ado About Nothing + Twelfth Night) added two **gated, byte-identical-verified** song-attribution fixes: Much Ado attributes an unprefixed song to the singer named in its `[X sings.]` stage direction (so 'Sigh no more' is Balthasar's, not Benedick's), and Twelfth Night reads its closing title-case `Song.` cue as a header (so the song stays Feste's, with no stray 'Song.' line) — plus a pure-`characters.json` alias for Sir Andrew's hyphenated `AGUE-CHEEK.` speech-prefix (the shape heuristic rejects the hyphen). **Any new parser behavior must stay byte-identical for shipped plays — run the re-ingest diff.** Each normalizer is documented in [docs/BUILD_LOG.md](docs/BUILD_LOG.md#known-limitations--parser-history-per-play-gated-normalizers).
- **Next**: **Session 12 (festive comedies): Much Ado About Nothing + Twelfth Night is COMPLETE** — shipped 2026-06-02 (memory `festive-comedies-build-notes`; roadmap `canon-completion-roadmap`; full plan `C:\Users\jdj32\.claude\plans\tidy-prancing-seal.md`). Reuse-clustered: both reuse the comedy/love banks (`cupid-arrows`, `diana-goddess`, `petrarch-and-the-sonnet`, `the-stage-machiavel` for Don John, `falconry-and-the-haggard`) plus an 11-card delta (Much Ado: the cuckold's horns, the 'nothing'/'noting' pun, the chastity double standard, the constable and the Watch, Hero and Leander; Twelfth Night: the Lord of Misrule, Puritanism, Illyria, Arion, Elysium, Pythagoras). Two **gated, byte-identical-verified** song-attribution parser fixes (Much Ado's `[Balthasar sings.]` → singer-as-speaker; Twelfth Night's title-case `Song.` cue → header) plus Sir Andrew's `AGUE-CHEEK.` alias; `Musaeus`/`Heliodorus` added to the classical-citation allowlist. The portal now ships **28 plays / 7,881 annotations / 173 reference cards**, all `_review_queue/`s empty corpus-wide (66 rescued, 0 cut; concurrency rule held — 0 candidate loss on both plays). **Next = Session 13** (reuse-clustered remainder per the roadmap — As You Like It + Two Gentlemen of Verona, then problem plays Merchant + Measure, All's Well + Troilus, then mop-up Merry Wives + Othello + Timon). Deferred infrastructure: accessibility toolbar, modern-English paraphrase, wiring `@anthropic-ai/sdk` into the stubbed `annotate-scene.ts`/`fact-check.ts` for headless/CI; the `_*.mjs` helper tidy (Phase-C).
- **Known limitations (cross-cutting)**: (1) anchor highlighting is word-granular, so at a source's glued `;--`/`,--` token a highlight may over-cover by the adjacent word; (2) annotator/glossary subagents occasionally emit JSON with unescaped inner double-quotes in citations — prompts include "use single quotes inside strings"; (3) `_review_queue/`, `_candidates/`, and `_*` files are gitignored — they exist on disk but not in version control; (4) on Windows, Astro's dev-server caches `import.meta.glob`; after adding a play's `text.json`, kill stray `node` processes before restarting; (5) some Gutenberg editions have an unclosed `[` stage-direction bracket that could make the bracket-chaser swallow the rest of the file — `parse-gutenberg.ts` now stops chasing at a blank line or ACT/SCENE header. The per-play **gated parser normalizers** (Henry VI edition, inline-SD, Gower presenter, Sly Induction pseudo-act, etc.) are documented in [docs/BUILD_LOG.md](docs/BUILD_LOG.md#known-limitations--parser-history-per-play-gated-normalizers).
