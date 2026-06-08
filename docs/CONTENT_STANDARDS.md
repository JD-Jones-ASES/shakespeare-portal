# Content Standards

This document governs every piece of original prose that ships in the portal: annotations, reference cards, synopses, character descriptions, and editorial copy. If you fork the project or add new works, follow these standards so new prose stays consistent with the released corpus.

## Voice

- **Clear and concrete.** Prefer the specific noun and verb. Replace "the bard" with "Shakespeare," "the protagonist" with the character's name.
- **Neutral.** Do not editorialize the play. "Iago is the play's master manipulator" is fine; "Iago is one of literature's greatest villains" is not — that's a verdict, not a gloss.
- **Brief.** A basic-depth annotation is **1–2 sentences**. A scholar-depth annotation is **up to 4 sentences**. Long reference cards (biblical, classical, historical) cap at ~150 words.
- **Address the reader directly when useful.** "If you've never read the Book of Jonah, here's what Shakespeare assumes you know." Don't over-use; default to third person.
- **Never condescend.** No "as you may know," no "obviously," no "of course." Assume the reader is new to the material and intelligent.
- **No filler.** Skip "It's interesting to note that…" and "Shakespeare seems to be suggesting…". Just say it.

## When to annotate

Annotate if and only if **a smart but unprepared tenth-grader would stumble**. Concretely:

- An archaic word whose modern meaning is wrong or absent ("doth," "anon," "wherefore")
- A reference to scripture, mythology, history, or current Elizabethan events that affects the meaning
- A sexual pun whose vehicle the modern reader will miss
- A rhetorical device that carries the argument (a chiasmus structuring a soliloquy is worth flagging; a routine metaphor is not)
- A passage whose syntax inverts modern word order in a way that changes who is doing what to whom

## When NOT to annotate

- **The obvious.** Don't gloss "to be" or "the king is dead." Trust the reader.
- **The atmospheric.** A line that is beautiful and mostly clear doesn't need a sentence praising it.
- **Plot recap.** Synopses cover plot. Don't repeat the synopsis inside an annotation.
- **Anything you can't source.** If you can't cite a verse, a classical passage, an OED entry, or a peer-reviewed reading, the annotation does not ship at basic depth.
- **Performance choices.** "Olivier emphasized this line by…" is theater history, not annotation. Keep it out unless it's the *only* way to gloss meaning.

## Depth tiers

- **`basic`** — Default-on for the novice reader. The minimal information needed to understand the line. Cite the source briefly inline ("Geneva Bible, Luke 16:22"). No textual variants. Bawdy is included only when the meaning is otherwise lost.
- **`scholar`** — Off by default. Surface textual variants (quarto vs folio), deeper bawdy, source-comparison (Holinshed vs Plutarch), prosody, contested readings. Confidence may be `medium`; cite the dispute.

A reader can turn on/off either tier independently. The UI default is `basic` on, `scholar` off.

## Source citation requirements

Every annotation ships with at least one entry in `sources[]`. Sources fall into these categories:

| Category | Citation format | Example |
|---|---|---|
| Bible | Book Chapter:Verse (Geneva 1599) | "Luke 16:22 (Geneva 1599)" |
| Classical poem/prose | Author, *Work* Book.Line | "Ovid, *Metamorphoses* 6.146" |
| Lexicon | Onions / Schmidt / OED s.v. headword | "OED s.v. *fishmonger* n. 2.a" |
| Historical record | Specific document or canonical secondary | "Holinshed, *Chronicles* (1587), vol. 3, p. 821" |
| Modern critical edition | Editor, Edition, year, page | "Jenkins (Arden 2, 1982), p. 245" |
| Reference work | Title, edition, entry | "Crystal & Crystal, *Shakespeare's Words*, s.v. *fishmonger*" |

A citation that says "various editors note…" is not a citation. Name the editor, the edition, the page.

## Fact-check protocol

Every candidate annotation passes through a 3-judge adversarial panel before merge:

- **Judge A — Source correctness.** Reads only the cited source claim. Default to "refuted" if the verse/passage/entry doesn't say what the annotation claims.
- **Judge B — Anchor correctness.** Reads only the play text. Default to "refuted" if `anchor_text` does not appear at `tln_start` within `[word_start..word_end]`.
- **Judge C — Interpretation.** Reads the gloss and the surrounding scene. Default to "refuted" if the reading is a stretch, a folk-etymology, a discredited (e.g. Bowdlerized) reading, or otherwise tendentious.

**Keep iff ≥2 of 3 verify.** Otherwise: drop (Judge B refutes is fatal) or route to `_review_queue/` for human eyes.

Each judge writes a one-sentence verdict + a `confidence` field. The annotation persists all three verdicts in `fact_check_verdicts[]`.

## Confidence

- **`high`** — Multi-source, uncontroversial reading. Ships at basic depth.
- **`medium`** — Defensible; one or two scholars dispute it. Ships at basic depth with a brief "Some editors read this as…" hedge.
- **`uncertain`** — Plausible but unsupported by primary sources or in active scholarly dispute. **Never ships at basic depth.** Scholar depth only, with the dispute named.

## Content warnings

Several plays contain material that warrants warning: *Titus Andronicus* (mutilation, rape, infanticide), *Lucrece* (rape), *Othello* (intimate-partner murder), *Lear* (eye gouging, elder abuse), *Measure for Measure* (sexual coercion), most histories (war atrocity). The catalog entry for each play carries `content_warning[]`. The play landing page surfaces the warnings above the read button — not as a barrier, as information.

Inside annotations, do not editorialize. Note the act and what it is. Don't moralize.

## Bawdy guidance

Many of Shakespeare's puns are sexual; many are not. Decide which by **whether the meaning is otherwise lost**.

- Annotate `bene-dick` ≈ "blessed penis" in *Much Ado* 2.1 — without it, the joke and the character name vanish.
- Don't annotate every double meaning of "die" in the sonnets — the orgasmic sense is well-trodden and explained in the *Sonnets* introduction once.
- At basic depth, prefer clinical terms ("a sexual pun on…"). At scholar depth, name the body part or act. The audience is high-school and up; this is not a children's site, but it is also not a smutty one.

## Style mechanics

- **American English** spelling. (Shakespeare predates the split; the modern reader is overwhelmingly Anglophone-school.)
- **Italics** for play titles, books, and Latin/Greek (*Hamlet*, *Metamorphoses*, *amor patris*).
- **Quotation marks** for cited lines from the play.
- **TLN citation inside scholar prose** when referring to a specific line ("Compare TLN 412.").
- **No emoji.** Anywhere. Ever.
