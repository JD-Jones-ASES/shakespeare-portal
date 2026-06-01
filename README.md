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

**Live at <https://jd-jones-ases.github.io/shakespeare-portal/>** — deployed from `main` via GitHub Actions.

**Twelve plays fully annotated and shipping**: *Hamlet* (356 annotations, 813-entry glossary), *A Midsummer Night's Dream* (189, 724), *Julius Caesar* (202, 1030), *Romeo and Juliet* (287, 1004), *Richard II* (262, 891), *Henry IV, Part 1* (369, 1044), *Henry IV, Part 2* (291, 1173), *Henry V* (302, 1125), *Henry VI, Part 1* (262, 1093), *Henry VI, Part 2* (307, 1051), *Henry VI, Part 3* (261, 1054), and *Richard III* (342, 1000) — **3,430 annotations** wired to **94 source-cited reference cards**, every claim through a three-judge fact-check. The eight English history plays — the complete first tetralogy (the three *Henry VI* plays and *Richard III*) together with the Henriad (*Richard II* through *Henry V*) — are built around a shared "spine" of reusable historical reference cards (Edward III's sons, the king's two bodies, Holinshed's Chronicles, the great chain of being, trial by combat, the Salic law, Agincourt), extended for the Wars of the Roses (the red-and-white-rose Temple-garden quarrel, Joan la Pucelle, Jack Cade's rebellion, Towton) and capped by the *Richard III* set (the Princes in the Tower, Bosworth Field, Richmond and the Tudor myth, the stage Machiavel, and More's *History of King Richard III*). Henry V required a gated parser enhancement for its act-by-act Choruses, Induction, and Epilogue; the Henry VI plays needed another for their unbracketed stage directions and separate-line scene settings; *Richard III*'s debut surfaced and fixed a latent inline-stage-direction parsing bug (gated so the earlier plays stay byte-identical). The remaining 31 works appear in the catalog as reading texts pending annotation backfill.

The content pipeline (ingest → annotate → fact-check → validate → build) is proven and repeatable. To build another play, an agent follows [docs/BUILD_A_PLAY.md](docs/BUILD_A_PLAY.md) — the step-by-step runbook.

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

See [CLAUDE.md](CLAUDE.md#repo-map) for the directory tour.

## Contribute

Annotation writing is the bulk of the work. The pipeline is documented in [docs/PIPELINE.md](docs/PIPELINE.md). The voice and standards are in [docs/CONTENT_STANDARDS.md](docs/CONTENT_STANDARDS.md). Every annotation needs at least one source citation; we use a 3-judge adversarial fact-check before anything ships.

## License

- **Code** (scripts, site, build tooling): [MIT](LICENSE-CODE)
- **Original annotations, metadata, and reference cards**: [CC-BY-SA-4.0](LICENSE-CONTENT)
- **Vendored source texts** (Project Gutenberg, Moby): public domain
- **Open Shakespeare materials** in [shakespeare-material-master/](shakespeare-material-master/): CC-BY-3.0, attribution preserved in [docs/LICENSING.md](docs/LICENSING.md)
