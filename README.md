# Shakespeare Portal

A reading portal for Shakespeare's plays and poems, built for students who haven't yet absorbed the biblical, classical, and historical context the texts assume.

## What makes it different

Most online Shakespeare editions hand you the text and a glossary. This portal layers:

- **Archaic vocabulary** glossed in the margin (not pop-ups — the research is unkind to pop-ups)
- **Biblical allusions** with Geneva Bible 1599 citations
- **Classical and mythological** references with their source (Ovid, Plutarch, Virgil, Homer)
- **Historical and topical** context for the history plays and Elizabethan in-jokes
- **Sexual puns and wordplay** that modern readers miss
- **Rhetorical devices** named and explained when they carry the meaning

…with a **depth toggle** so advanced readers can hide everything and read the play clean.

## Status

**Complete and live at <https://jd-jones-ases.github.io/shakespeare-portal/>** — deployed from `main` via GitHub Actions.

The portal ships **42 of Shakespeare's 43 works**: all **37 plays**, the complete **Sonnets** (all 154), and the four narrative poems (*Venus and Adonis*, *The Rape of Lucrece*, *A Lover's Complaint*, and *The Phoenix and the Turtle*). Together they carry **11,273 source-cited annotations** wired to **222 cross-referenced reference cards**, plus a per-work archaic-vocabulary glossary for every text — and every annotation passed a three-judge adversarial fact-check before it shipped.

The one work left out of the reader, *The Passionate Pilgrim*, is held back as a largely non-Shakespearean miscellany: it was printed under Shakespeare's name in 1599, but only a handful of its twenty poems are genuinely his.

Each poem is modeled as a "degenerate play," so the same reader, pipeline, and validators serve verse and drama alike. The content pipeline (ingest → annotate → fact-check → validate → build) is documented and repeatable: to add a new work or extend an existing one, follow [docs/BUILD_A_PLAY.md](docs/BUILD_A_PLAY.md) (or [docs/BUILD_A_POEM.md](docs/BUILD_A_POEM.md) for poetry).

## Run locally

```
cd site
npm install
npm run dev
```

Then open `http://localhost:4321`.

To validate data against schemas:

```
cd scripts
npm install
npm run validate
```

## Repo layout

See [AGENTS.md](AGENTS.md#repo-map) for the directory tour.

## Contribute

Annotation writing is the bulk of the work. The pipeline is documented in [docs/PIPELINE.md](docs/PIPELINE.md). The voice and standards are in [docs/CONTENT_STANDARDS.md](docs/CONTENT_STANDARDS.md). Every annotation needs at least one source citation; we use a 3-judge adversarial fact-check before anything ships.

## License

- **Code** (scripts, site, build tooling): [MIT](LICENSE-CODE)
- **Original annotations, metadata, and reference cards**: [CC-BY-SA-4.0](LICENSE-CONTENT)
- **Vendored source texts** (Project Gutenberg, Moby): public domain
- **Open Shakespeare materials** in [shakespeare-material-master/](shakespeare-material-master/): CC-BY-3.0, attribution preserved in [docs/LICENSING.md](docs/LICENSING.md)
