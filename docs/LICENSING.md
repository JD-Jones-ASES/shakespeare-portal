# Licensing

This portal mixes several licenses. The right behavior depends on which part of the repo you're touching.

## At a glance

| What | License | File |
|---|---|---|
| Source code (scripts, site, schemas) | MIT | [LICENSE-CODE](../LICENSE-CODE) |
| Original annotations, reference cards, synopses, metadata, prose docs | CC-BY-SA-4.0 | [LICENSE-CONTENT](../LICENSE-CONTENT) |
| Vendored Open Shakespeare materials | CC-BY-3.0 | [shakespeare-material-master/](../shakespeare-material-master/) (see its README) |
| Shakespeare's text itself | Public domain | n/a |
| Project Gutenberg modern-spelling editions | Public domain (with Gutenberg trademark restrictions on the name) | n/a |
| Folger Digital Texts (future ingest) | CC-BY-NC 3.0 | upstream |
| Cited scholarly works (Onions, Schmidt, Shaheen, Partridge, Crystal & Crystal, Arden, Cambridge, Oxford editions) | © respective rights-holders | not republished |

## Why the dual license

- **Code under MIT** invites reuse — a teacher who wants to fork the project for a Bible-allusion edition shouldn't have to copyleft their school's IT codebase.
- **Content under CC-BY-SA-4.0** keeps the *editorial work* (the annotations, the synopses, the metadata) free and ensures derivatives stay free. This matches the spirit of Wikipedia, Wikisource, and the Open Shakespeare project itself.
- Attribution + ShareAlike is the right balance for educational annotation: anyone can use it, including in classrooms and textbooks, but they can't lock it behind a paywall or fork-and-close.

## What you can and can't reuse from the source repo

The vendored [shakespeare-material-master/](../shakespeare-material-master/) is the "Open Shakespeare" project (CC-BY-3.0). We:

- ✅ Use the plain-text plays as ingest input
- ✅ Cite the project in our README and this doc
- ✅ Keep its LICENSE and README intact

We don't:

- ❌ Modify files inside that directory in place
- ❌ Strip its attribution
- ❌ Claim its texts as ours

## What you can't reuse from scholarly editions

The texts of Shakespeare's plays are public domain. The **editorial apparatus** of modern scholarly editions (Arden, Oxford, Cambridge, New Cambridge, Pelican, Norton, Folger) is **copyrighted**. This includes:

- Their footnotes and glosses
- Their introductions
- Their textual notes
- Their chosen lineation and emendations (sometimes contested as copyrightable; we don't test this)

This is why our pipeline writes **original** annotations, using public-domain reference works (Onions 1911, Schmidt 1902) plus our own research, fact-checked against the texts directly. We **cite** Arden et al. but never republish their prose.

When in doubt: paraphrase the underlying fact, cite the editor.

## Public-domain scholarly works we can seed from

| Work | Date | License | What it gives us |
|---|---|---|---|
| Onions, *Shakespeare Glossary* | 1911 | Public domain | 14,000 archaic-word definitions; the most reliable glossary for students. |
| Schmidt, *Shakespeare-Lexicon* | 1902 | Public domain | Complete concordance + word-frequency. |
| *Encyclopaedia Britannica*, 11th ed. | 1911 | Public domain | Vendored as `shakespeare-material-master/ancillary/britannica-11th.txt`; useful for biographical context. |
| Geneva Bible | 1599 | Public domain | The bible Shakespeare quoted; cite this edition for all biblical references. |
| Holinshed's *Chronicles* | 1577/1587 | Public domain | The history plays' principal source. |
| Plutarch (North's translation) | 1579 | Public domain | The Roman tragedies' principal source. |
| Ovid's *Metamorphoses* (Golding 1567 or modern PD translation) | 1567 | Public domain | The classical-allusion deep well. |

These can be quoted, paraphrased, and excerpted freely. The Geneva Bible in particular should be our default biblical citation source.

## Restricted scholarly works we can only *reference*

| Work | Why restricted | How we use it |
|---|---|---|
| Naseeb Shaheen, *Biblical References in Shakespeare's Plays* (1999) | © Shaheen | We cite her by chapter and page when we agree with a reading; we never republish her catalogue. |
| Eric Partridge, *Shakespeare's Bawdy* (1968) | © Partridge estate / Routledge | We cite for individual senses; never republish. |
| David & Ben Crystal, *Shakespeare's Words* (2002) | © Crystal | Reference; the web edition at shakespeareswords.com is the public-facing version we link out to. |
| Arden, Oxford, Cambridge editions | © respective publishers | Cited as "Editor (Edition, year), p. N" when supporting a contested reading. |
| Folger Digital Texts (TEI) | CC-BY-NC 3.0 | If/when we ingest them, we satisfy the BY (attribution) and NC (non-commercial) clauses. Our free public-education site qualifies as NC; a future commercial fork would not. |

## Folger TEI: a longer note

The [Folger Digital Texts](https://www.folgerdigitaltexts.org/) project releases all of Shakespeare in TEI-Simple XML under CC-BY-NC 3.0. It's the highest-quality, most-structured, scholarly-validated machine-readable Shakespeare available for free.

We would ingest it as a v2 quality upgrade *as long as we remain non-commercial*. The license is incompatible with charging tuition, embedding in a paid textbook, or running ads. If the project ever pivots to commercial, we fall back to Gutenberg + Moby (both public domain).

**Decision for v1**: Use Gutenberg (already vendored). Treat Folger TEI as a future upgrade, not a v1 dependency.

## Trademark notes

- **"Project Gutenberg"** is a trademark of the Gutenberg Literary Archive Foundation; we use Gutenberg-sourced *text* freely (it's public domain) but do not use the name in marketing.
- **"Folger"**, **"Arden"**, **"Cambridge"** are publishers' marks; we use them for attribution only.

## Required attribution in deployed site

The deployed site footer must include:

1. "Code MIT-licensed; original content CC-BY-SA-4.0"
2. "Plain texts sourced from Project Gutenberg and the Open Shakespeare project (CC-BY-3.0)"
3. Links to LICENSE-CODE and LICENSE-CONTENT in the repo
4. Optionally: a "Sources and methods" link to a public version of [CONTENT_STANDARDS.md](CONTENT_STANDARDS.md)

## Contributor license

Contributions of original prose to the repo are licensed CC-BY-SA-4.0 to the project on commit (standard CC inbound = outbound). Contributors of code license to the project under MIT. No CLA is currently required; if contributor volume grows, revisit.
