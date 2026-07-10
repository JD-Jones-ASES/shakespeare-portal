# Architecture

## Big picture

```
shakespeare-material-master/  (READ-ONLY, vendored)
  texts/gutenberg/<slug>_gut.txt
            │
            ▼
   scripts/ingest/parse-gutenberg.ts
            │   detects ACT / Scene / speakers / stage directions
            ▼
   scripts/ingest/normalize-tln.ts
            │   assigns Through-Line Numbers
            ▼
   data/plays/<slug>/text.json   ◄────────┐
            │                              │
            ▼                              │ (read for context)
   scripts/generate/annotate-scene.ts      │
            │   LLM annotator, one per scene│
            ▼                              │
   data/plays/<slug>/_candidates/<a>-<s>.json
            │                              │
            ▼                              │
   scripts/generate/fact-check.ts          │
            │   3-judge adversarial panel  │
            │   (source / anchor / interp) │
            ▼                              │
   data/plays/<slug>/annotations.json  ────┘
   data/plays/<slug>/_review_queue/<id>.json  (when judges disagree)
            │
            ▼
   scripts/validate/{schema,anchor,citation}-check.ts
            │   run locally before every push (no CI gates)
            ▼
   site/  (Astro)
            │   glob loaders (site/src/data/loader.ts) read data/**/*.json
            │   Static HTML per scene + interactive islands
            ▼
   Public free educational site (GitHub Pages)
```

**Data flows downstream only.** The site never writes back to `data/`. If a reader wants to leave a note, that's a possible future feature, out of scope here.

The generation stages (annotate, fact-check) are LLM-driven; the rest is deterministic. See [PIPELINE.md](PIPELINE.md).

## The parser

Editions vary wildly in structure — choruses, inductions, epilogues, dumb-shows, songs,
play-within-a-play prologues, unison speech-prefixes, sprawling minor casts. `parse-gutenberg.ts`
absorbs these with small, **gated, per-edition normalizers**, each verified **byte-identical** against
the already-shipped plays via a re-ingest diff, so a fix for one edition can't silently change another.
In practice most structural quirks need no parser change at all — they are handled purely as
`characters.json` alias data.

## Why static

- **Cost** — A static site fits the free tier of every modern host. We can serve every play to every student forever with zero marginal cost.
- **Offline** — Once a student loads a play, they can read it on a school bus, on a plane, in a basement. No API key, no fetch failures.
- **Determinism** — The same TLN renders the same annotation every time. Reviewers can audit the live site exactly as the model produced it.
- **No API key shipped** — On-demand annotation would require either an embedded key (insecure) or a paid relay (operational burden).
- **Speed** — Pre-rendered HTML beats every SPA's first-paint, especially on the cheap Chromebooks most US public schools run.

The trade-off: the catalog of annotations is fixed at build time. A new reader question doesn't get a live answer. That's the right call here; a "hybrid" with an ask-button would be a deliberate future addition, not a default.

## Why Astro

- **MDX-friendly** — Reference cards and synopses are mostly prose with the occasional embed; MDX is a comfortable middle ground.
- **Islands** — Only the gloss sidebar, depth toggle, search bar, and character filter need JavaScript. Everything else is static HTML. Lighthouse loves this.
- **Data-driven loading** — `site/src/data/loader.ts` glob-imports `data/**/*.json`
  (`import.meta.glob` + `getStaticPaths`), so adding a work needs zero site code. (Astro Content
  Collections were considered but never adopted; correctness comes from the pipeline validators
  against `schemas/`, not from collection types.)
- **Routing** — File-system routing makes `plays/[slug]/[act]/[scene].astro` trivial.

## Repository invariants

These hold at all times:

1. **`data/` is canonical.** Generated artifacts (search index, sitemap, bundled HTML) live in `site/dist/` and are derived.
2. **One slug per work.** Slugs match `shakespeare-material-master/texts/works.json` exactly. Never alias.
3. **TLN is the only line citation.** No annotation references "Act 3 Scene 1 line 56." The TLN is unambiguous; lineation conventions vary across editions.
4. **Schemas gate everything — as protocol, enforced locally.** No JSON file lands in `data/` without
   passing `scripts/validate/schema-check.ts` (run it, or `audit.mjs`, before committing data). There are
   no CI gates or git hooks: CI is index + `astro build` only, so an unvalidated push can deploy — the
   discipline is the runbook's, not the machine's.
5. **Provenance is required.** Every annotation declares `generated_by`, `fact_checked`, `fact_checked_by` (model IDs), and `fact_check_verdicts` (the three judge results).

## Build environment

- **Node 20+** for scripts and the Astro site.
- **TypeScript** throughout. The `scripts/*.ts` pipeline runs via `tsx` — invoke **from inside `scripts/`** (`node --import tsx <x>.ts`), or use the `scripts/pipeline/*.mjs` build kit (plain Node ESM, runnable from the repo root with bare `node`).
- **Package managers** — `npm` is the default. You may prefer `pnpm`; both work. Don't commit a `pnpm-lock.yaml` and a `package-lock.json` at the same time.
- **OS** — primary development was on Windows + PowerShell, and the scripts are cross-platform (no `find | xargs`, no POSIX-only paths). On PowerShell, chain commands with `;` (not `&&`), and run `node --import tsx` with `cwd: scripts/` rather than spawning `node_modules/.bin/tsx.cmd` directly (`EINVAL`).

## Possible future enhancements

- **Analytics** — only privacy-respecting (Plausible, Cloudflare Web Analytics) if added at all.
- **Search** — currently a pre-built MiniSearch index loaded as an island. A server-backed search (Algolia, Pagefind) would only be worth it if the in-browser index struggled with the corpus.
- **TEI ingest** — Folger Digital Texts (CC-BY-NC) would be a richer canonical source than Gutenberg; the modern-spelling Gutenberg texts were sufficient to ship.
- **On-demand annotation, reader notes, accessibility toolbar, modern-English paraphrase** — all deliberately out of scope for the static, free, offline-friendly edition.
