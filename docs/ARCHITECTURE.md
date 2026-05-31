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
            │   spawns Sonnet subagent     │
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
            │   gates every commit
            ▼
   site/  (Astro)
            │   Content Collections load data/**/*.json
            │   Static HTML per scene + interactive islands
            ▼
   Public free educational site (e.g. Cloudflare Pages)
```

**Data flows downstream only.** The site never writes back to `data/`. If a reader wants to leave a note, that's a future feature (out of scope for v1).

## Why static

- **Cost** — A static site fits the free tier of every modern host. We can serve every play to every student forever with zero marginal cost.
- **Offline** — Once a student loads a play, they can read it on a school bus, on a plane, in a basement. No API key, no fetch failures.
- **Determinism** — The same TLN renders the same annotation every time. Reviewers can audit the live site exactly as the model produced it.
- **No API key shipped** — On-demand annotation would require either an embedded key (insecure) or a paid relay (operational burden).
- **Speed** — Pre-rendered HTML beats every SPA's first-paint, especially on the cheap Chromebooks most US public schools run.

The trade-off: the catalog of annotations is fixed at build time. A new reader question doesn't get a live answer. We accept this; it's the right call for v1. A "hybrid" with an ask-button is a deliberate v2 decision, not a default.

## Why Astro

- **MDX-friendly** — Reference cards and synopses are mostly prose with the occasional embed; MDX is a comfortable middle ground.
- **Islands** — Only the gloss sidebar, depth toggle, search bar, and character filter need JavaScript. Everything else is static HTML. Lighthouse loves this.
- **Content Collections** — Type-safe loading of `data/**/*.json` against the JSON Schemas in `schemas/`.
- **Routing** — File-system routing makes `plays/[slug]/[act]/[scene].astro` trivial.

## Repository invariants

These hold at all times:

1. **`data/` is canonical.** Generated artifacts (search index, sitemap, bundled HTML) live in `site/dist/` and are derived.
2. **One slug per work.** Slugs match `shakespeare-material-master/texts/works.json` exactly. Never alias.
3. **TLN is the only line citation.** No annotation references "Act 3 Scene 1 line 56." The TLN is unambiguous; lineation conventions vary across editions.
4. **Schemas gate everything.** No JSON file lands in `data/` without passing `scripts/validate/schema-check.ts`.
5. **Provenance is required.** Every annotation declares `generated_by`, `fact_checked`, `fact_checked_by` (model IDs), and `fact_check_verdicts` (the three judge results).

## Build environment

- **Node 20+** for scripts and the Astro site.
- **TypeScript** throughout. The `scripts/*.ts` pipeline runs via `tsx` — invoke **from inside `scripts/`** (`node --import tsx <x>.ts`), or use the `scripts/pipeline/*.mjs` build kit (plain Node ESM, runnable from the repo root with bare `node`).
- **Package managers** — `npm` is the default. The user may prefer `pnpm`; both work. Don't commit a `pnpm-lock.yaml` and a `package-lock.json` at the same time.
- **OS** — primary development on Windows + PowerShell. Scripts must run on Windows (no `find | xargs`, no POSIX-only paths). PowerShell caveats: no `&&` (use `;`); never pipe a native command to `Select-Object`/`head` (broken pipe → exit 255). Don't spawn `.bin/tsx.cmd` from Node's `execFileSync` (EINVAL) — spawn `node --import tsx` with `cwd: scripts/`. See [BUILD_A_PLAY.md](BUILD_A_PLAY.md) for the full list.

## Deferred decisions

- **Hosting** — Cloudflare Pages, Netlify, and GitHub Pages all work. Pick when ready to publish.
- **Analytics** — Only privacy-respecting (Plausible, Cloudflare Web Analytics). Not in v1.
- **Search** — v1 uses a pre-built lunr or MiniSearch index loaded as an island. Server-backed search (Algolia, Pagefind) deferred unless lunr struggles with the corpus.
- **TEI ingest** — Folger Digital Texts (CC-BY-NC) is the long-term canonical source. Gutenberg suffices for v1 to ship.
