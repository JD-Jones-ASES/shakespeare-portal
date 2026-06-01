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

**Sixteen plays fully annotated and shipping**: *Hamlet* (356 annotations, 813-entry glossary), *A Midsummer Night's Dream* (189, 724), *Julius Caesar* (202, 1030), *Romeo and Juliet* (287, 1004), *Richard II* (262, 891), *Henry IV, Part 1* (369, 1044), *Henry IV, Part 2* (291, 1173), *Henry V* (302, 1125), *Henry VI, Part 1* (262, 1093), *Henry VI, Part 2* (307, 1051), *Henry VI, Part 3* (281, 1054), *Richard III* (364, 1000), *King John* (254, 1027), *Henry VIII* (303, 1000), *The Tempest* (247, 959), and *Pericles* (248, 863) — **4,524 annotations** wired to **119 source-cited reference cards**, every claim through a three-judge fact-check. **All ten of Shakespeare's English history plays now ship**: the complete first tetralogy (the three *Henry VI* plays and *Richard III*), the Henriad (*Richard II* through *Henry V*), and the two outliers — *King John* and the late, Fletcher-co-authored *Henry VIII*. They are built around a shared "spine" of reusable historical reference cards (Edward III's sons, the king's two bodies, Holinshed's Chronicles, the great chain of being, de casibus tragedy, trial by combat, the Salic law, Agincourt) extended play by play: the Wars of the Roses set for the first tetralogy (the Temple-garden quarrel, Joan la Pucelle, Jack Cade, Towton, the Princes in the Tower, Bosworth, the Tudor myth), the Angevin succession / papal interdict / Richard the Lionheart for *King John*, and Cardinal Wolsey / the King's Great Matter / the break with Rome / Foxe's *Acts and Monuments* for *Henry VIII*. Each unusual edition needed a small, gated parser enhancement kept byte-identical for the already-shipped plays — Henry V's act-by-act Choruses, the Henry VI plays' unbracketed stage directions, *Richard III*'s inline asides, and now *Henry VIII*'s speaker-less Prologue/Epilogue, *King John*'s over-length unison speech-prefix, and *Pericles*'s per-act Gower Presenter with dumb-shows. The first two **romances** now ship as well — *The Tempest* (which needed no parser change at all: its masque of the goddesses Iris, Ceres, and Juno is handled purely as character data) and *Pericles* (whose narrator, the medieval poet Gower, speaks a rhymed chorus before every act). The remaining 27 works appear in the catalog as reading texts pending annotation backfill.

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
