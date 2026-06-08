# Annotation Schema

The single most important data shape in the project. The authoritative JSON Schema is at [`schemas/annotation.schema.json`](../schemas/annotation.schema.json); this document explains the *why* and gives examples.

## Granularity: TLN + word-span

We anchor every annotation to a **Through-Line Number** (the line number from the start of the play, ignoring acts and scenes) plus a **word-span offset** within that line. This is the scholarly standard (Hinman 1968, Folger Digital Texts, Internet Shakespeare Editions) and survives differences in lineation across editions.

- `tln_start` (integer) — the TLN of the first line the annotation covers.
- `tln_end` (integer) — the TLN of the last line. Equal to `tln_start` when the annotation is on one line.
- `word_start` (integer) — 0-indexed offset of the first word on line `tln_start`.
- `word_end` (integer) — 0-indexed offset of the last word on line `tln_end`. Inclusive.
- `anchor_text` (string) — the exact substring of the play text being annotated, used by the validator to confirm we're glossing what we think we're glossing.

For a single word: `tln_start == tln_end` and `word_start == word_end`.

For a multi-line annotation, `word_start` indexes into `tln_start` and `word_end` into `tln_end`.

**Poems** use the same anchoring: a poem is ingested as a "degenerate play" where every
verse line is a `spoken` line with a continuous TLN and an empty `speaker`, so `tln_start`/`anchor_text`
work identically. (The reader displays a Sonnet's lines as 1–14 via a display-only offset, but the
stored TLN stays globally unique for anchoring.) See [BUILD_A_POEM.md](BUILD_A_POEM.md).

## Annotation types (taxonomy)

| Type | What it covers | Example |
|---|---|---|
| `archaic_vocab` | Word whose modern meaning is wrong or absent | "wherefore" = why, not where (*Romeo & Juliet* 2.2) |
| `biblical_allusion` | Scripture echo or reference | "Abraham's bosom" (*Richard III* 4.3) → Luke 16:22 |
| `classical_allusion` | Greco-Roman myth, lit, or history | "Hyperion to a satyr" (*Hamlet* 1.2) → Hesiod, *Theogony* |
| `historical_topical` | Tudor politics, court events, contemporary Elizabethan refs | *Henry VIII* 5.4 — Cranmer's prophecy → James I succession |
| `bawdy_pun` | Sexual innuendo; depth-gated `scholar` unless meaning is lost | "country matters" (*Hamlet* 3.2) |
| `rhetorical_device` | Named figure carrying the argument | Chiasmus in "Fair is foul and foul is fair" (*Macbeth* 1.1) |
| `wordplay` | Non-sexual pun, homophone, anagram | "Not a mouse stirring" (*Hamlet* 1.1) — quiet *and* alert |
| `syntax_grammar` | Archaic word order, ellipsis, case | "That glib and oily art" (*Lear* 1.1) — adjective as noun |
| `stage_direction_note` | Implied blocking, props, theatrical context | "Hautboys. Servants… pass over the stage" (*Macbeth* 1.7) |
| `textual_variant` | Quarto/folio difference, editorial emendation | Q2 "sallied" vs F1 "solid" (*Hamlet* 1.2.129) |
| `parallel_passage` | Same image/phrase elsewhere in the canon | *Sonnets* 18 echo in *Merchant of Venice* 5.1 |
| `cultural_context` | Elizabethan daily life, professions, customs (catch-all) | "fishmonger" (*Hamlet* 2.2) — slang for pimp |

When in doubt between `cultural_context` and one of the more specific types, choose the specific one.

## Full annotation example

```json
{
  "id": "hamlet-723-fishmonger",
  "play": "hamlet",
  "tln_start": 723,
  "tln_end": 723,
  "word_start": 4,
  "word_end": 4,
  "anchor_text": "fishmonger",
  "type": "cultural_context",
  "depth": "basic",
  "summary": "Elizabethan slang for a pimp or procurer; Hamlet's insult feigns madness while accusing Polonius of using Ophelia as bait.",
  "detail": "Partridge (1968) records 'fishmonger' as Elizabethan cant for a man who deals in women, parallel to 'mutton-monger.' The double meaning lets Hamlet rage at Polonius without breaking the pretense of madness. Compare 2.2 'Then you are a fishmonger'—Hamlet's quickness to land on this insult suggests he suspects Polonius is staging the encounter.",
  "references": [
    { "kind": "biblical", "card_id": "" }
  ],
  "sources": [
    { "name": "Partridge, Shakespeare's Bawdy", "citation": "Partridge, E. (1968). Shakespeare's Bawdy. Routledge. p. 121." },
    { "name": "OED s.v. fishmonger", "citation": "OED s.v. fishmonger n. 2.a (slang, obsolete): a procurer." }
  ],
  "confidence": "high",
  "generated_by": "claude-sonnet-4-6",
  "fact_checked": true,
  "fact_checked_by": ["claude-sonnet-4-6", "claude-sonnet-4-6", "claude-opus-4-7"],
  "fact_checked_at": "2026-05-30",
  "fact_check_verdicts": [
    { "judge": "source", "model": "claude-sonnet-4-6", "verdict": "verified", "note": "Partridge and OED both confirm the sense." },
    { "judge": "anchor", "model": "claude-sonnet-4-6", "verdict": "verified", "note": "Word 'fishmonger' appears at TLN 723 word 4 in Folger lineation." },
    { "judge": "interpretation", "model": "claude-opus-4-7", "verdict": "verified", "note": "Reading is standard since Theobald; no major dissent." }
  ]
}
```

(Note: the `references[]` entry with empty `card_id` in the example would be omitted in real data — included here to show the shape.)

## Field rules

### Required
- `id` — `<slug>-<tln_start>-<short_kebab>`. Stable across rebuilds.
- `play` — slug from `data/catalog/works.json`.
- `tln_start`, `tln_end`, `word_start`, `word_end`, `anchor_text` — anchoring.
- `type` — one of the 12 taxonomy values.
- `depth` — `basic` or `scholar`.
- `summary` — 1–2 sentences for basic, up to 4 for scholar.
- `sources` — at least one entry with `name` and `citation`.
- `confidence` — `high`, `medium`, or `uncertain`.
- `generated_by` — the model ID (or "human") that produced the candidate.
- `fact_checked` — boolean. Must be `true` to ship at basic depth.

### Optional
- `detail` — longer prose, scholar tier or for basic when the summary is too thin alone.
- `references[]` — links to reusable reference cards (avoid repeating the same biblical context across 50 annotations).
- `fact_check_verdicts[]` — the three judge results. Required when `fact_checked` is true.
- `fact_checked_by` — array of model IDs (one per judge).
- `fact_checked_at` — ISO date.
- `note_internal` — editorial notes for future revisers; not rendered. Use sparingly.

### Forbidden
- `tln_start > tln_end`
- `word_start > word_end` when `tln_start == tln_end`
- `confidence: "uncertain"` with `depth: "basic"`
- `fact_checked: true` with empty `fact_check_verdicts[]`
- `sources: []`
- Citing a "scholar" without a named editor, edition, and page

## Reference cards

Some context recurs across plays (the Trojan War, Geneva-Bible literacy, the Wars of the Roses). Rather than repeat the explanation in every annotation, we keep **reference cards** in `data/references/<kind>.json` and link them from annotations:

```json
{
  "references": [
    { "kind": "biblical", "card_id": "abraham-bosom" }
  ]
}
```

A card looks like:

```json
{
  "id": "abraham-bosom",
  "kind": "biblical",
  "title": "Abraham's bosom",
  "source": {
    "name": "Geneva Bible 1599",
    "citation": "Luke 16:22 — 'And it came to pass that the beggar died, and was carried by the angels into Abraham's bosom.'"
  },
  "summary_basic": "In the Geneva Bible's parable of Lazarus and the rich man, 'Abraham's bosom' is where the righteous poor rest after death — Heaven, in effect. Elizabethan readers heard it as a shorthand for salvation.",
  "detail_scholar": "The image is rabbinic in origin; the Geneva Bible's marginal note glosses it as 'a place of comfort.' Shakespeare uses the phrase straight in *Richard III* 4.3 (the murdered princes 'in Abraham's bosom') and ironically in *Henry V* 2.3 (Mistress Quickly mishears it as 'Arthur's bosom' over Falstaff's deathbed).",
  "related_plays": ["richard_iii", "henry_v"]
}
```

See [`schemas/reference-card.schema.json`](../schemas/reference-card.schema.json) for the full shape.
