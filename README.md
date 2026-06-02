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

**Twenty-one plays fully annotated and shipping**: *Hamlet* (356 annotations, 813-entry glossary), *A Midsummer Night's Dream* (189, 724), *Julius Caesar* (202, 1030), *Romeo and Juliet* (287, 1004), *Richard II* (262, 891), *Henry IV, Part 1* (369, 1044), *Henry IV, Part 2* (291, 1173), *Henry V* (302, 1125), *Henry VI, Part 1* (262, 1093), *Henry VI, Part 2* (307, 1051), *Henry VI, Part 3* (281, 1054), *Richard III* (364, 1000), *King John* (254, 1027), *Henry VIII* (303, 1000), *The Tempest* (247, 959), *Pericles* (248, 863), *Cymbeline* (386, 1054), *The Winter's Tale* (325, 1130), *The Taming of the Shrew* (238, 1016), *Love's Labour's Lost* (243, 1040), *The Comedy of Errors* (152, 888), *Coriolanus* (344, 1054), and *Titus Andronicus* (232, 1028) — **6,444 annotations** wired to **146 source-cited reference cards**, every claim through a three-judge fact-check. **All ten of Shakespeare's English history plays now ship**: the complete first tetralogy (the three *Henry VI* plays and *Richard III*), the Henriad (*Richard II* through *Henry V*), and the two outliers — *King John* and the late, Fletcher-co-authored *Henry VIII*. They are built around a shared "spine" of reusable historical reference cards (Edward III's sons, the king's two bodies, Holinshed's Chronicles, the great chain of being, de casibus tragedy, trial by combat, the Salic law, Agincourt) extended play by play: the Wars of the Roses set for the first tetralogy (the Temple-garden quarrel, Joan la Pucelle, Jack Cade, Towton, the Princes in the Tower, Bosworth, the Tudor myth), the Angevin succession / papal interdict / Richard the Lionheart for *King John*, and Cardinal Wolsey / the King's Great Matter / the break with Rome / Foxe's *Acts and Monuments* for *Henry VIII*. Each unusual edition needed a small, gated parser enhancement kept byte-identical for the already-shipped plays — Henry V's act-by-act Choruses, the Henry VI plays' unbracketed stage directions, *Richard III*'s inline asides, and now *Henry VIII*'s speaker-less Prologue/Epilogue, *King John*'s over-length unison speech-prefix, and *Pericles*'s per-act Gower Presenter with dumb-shows. All four **romances** of this group now ship — *The Tempest* (whose masque of the goddesses Iris, Ceres, and Juno is handled purely as character data), *Pericles* (whose narrator, the medieval poet Gower, speaks a rhymed chorus before every act), and now *Cymbeline* and *The Winter's Tale*, both of which reuse that machinery with no parser change: Cymbeline's descending god Jupiter and the family ghosts who summon him are character data like the Tempest's masque, and the Winter's Tale's Time-as-Chorus simply speaks his own scene. (Cymbeline's vendored modern text was missing its entire Welsh middle — Acts 3 and 4 — and was completed from the public-domain Moby Shakespeare edition.) Three **framing and pageant comedies** complete this round: *The Taming of the Shrew*, whose Christopher Sly Induction is rendered as a pseudo-act before Act 1 ('Induction, Scene 1', where the through-line numbering begins); *Love's Labour's Lost*, whose Nine Worthies pageant, Masque of Muscovites, and closing Spring/Winter songs are handled purely as character data; and *The Comedy of Errors*, whose two sets of identical twins are kept apart by their full speech-prefixes — none needing more than a small, gated parser touch kept byte-identical for the already-shipped plays. The first two **Roman tragedies** now ship as well — *Coriolanus* (drawn from Plutarch, reusing the *Julius Caesar* Roman bank, with new cards for Menenius's fable of the belly, the tribunes of the people, and the consulship) and *Titus Andronicus* (Shakespeare's most violent and most Ovidian play, whose new "Ovid bank" — Ovid's *Metamorphoses*, Senecan revenge tragedy, and the figure of the Moor on the English stage — is built to carry forward into the narrative poems, and whose racial and sexual violence is annotated with clinical, contextual care); neither needed any parser change. The remaining 20 works appear in the catalog as reading texts pending annotation backfill.

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
