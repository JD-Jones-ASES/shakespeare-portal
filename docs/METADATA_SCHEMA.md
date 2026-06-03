# Catalog Metadata Schema

Every play and poem in the catalog has a structured record in `data/catalog/works.json`. Authoritative JSON Schema: [`schemas/catalog-entry.schema.json`](../schemas/catalog-entry.schema.json).

The catalog drives:

- the landing page (`/`) — sortable, filterable list of all works
- the play page (`/plays/<slug>/`) — header, content warnings, recommended grade
- the search and filter UI — genre, theme, difficulty
- the future "recommended for grade X" view

## Fields

| Field | Type | Required | Example | Notes |
|---|---|---|---|---|
| `playId` | string (slug) | yes | `hamlet` | Lowercase, underscore. Matches `shakespeare-material-master/texts/works.json`. |
| `title` | string | yes | `"The Tragedy of Hamlet, Prince of Denmark"` | Canonical Folio (or Quarto) title. Used for citation. |
| `title_short` | string | yes | `"Hamlet"` | The common short title. Used in UI and breadcrumbs. |
| `genre` | enum | yes | `"Tragedy"` | One of: `Tragedy`, `Comedy`, `History`, `Romance`, `Tragicomedy`, `Poem`, `Sonnet_Sequence`. |
| `subgenre` | string | no | `"Revenge tragedy"` | Free-form; e.g. "Problem play," "Late romance." |
| `date_written` | string | yes | `"1600–1601"` | Year or year-range. Use en-dash. |
| `date_first_performed` | string | no | `"1601 (probable)"` | Annotate uncertainty inline. |
| `date_published` | string | no | `"Q1 1603, Q2 1604, F1 1623"` | Edition history. |
| `act_count` | integer | yes | `5` | Plays: 1–5. Poems: 1; the **Sonnets use 11** (one act per thematic chapter — see [BUILD_A_POEM.md](BUILD_A_POEM.md)). Cap raised 5→20 to allow this. |
| `scene_count` | integer | yes | `20` | Total scenes (Folger lineation). Poems: reading chunks; the **Sonnets = 154** (one scene per sonnet). |
| `line_count` | integer | no | `3987` | TLN total; fill in after ingest. |
| `characters_major` | string[] | no | `["Hamlet", "Claudius", "Gertrude", "Ophelia", "Polonius", "Horatio", "Laertes"]` | Top ~10 speaking roles. |
| `primary_sources` | string[] | no | `["Saxo Grammaticus, Gesta Danorum", "Belleforest, Histoires Tragiques"]` | Where Shakespeare got it. |
| `setting` | string | no | `"Elsinore, Denmark — royal court"` | Geographic and political setting. |
| `themes` | string[] | no | `["revenge", "madness", "mortality", "corruption", "performance"]` | Lowercase, controlled vocabulary; see below. |
| `difficulty_rating` | integer (1–5) | no | `4` | 1 = most accessible (*Tempest*); 5 = most demanding (*Coriolanus*, *Troilus*). |
| `curriculum_grade_level` | integer[] | no | `[10, 11, 12]` | US high-school + early college. |
| `common_in_curriculum` | boolean | no | `true` | Taught in >50% of US high schools (proxy: appears in Common Core text exemplars or major AP English lists). |
| `content_warning` | string[] | no | `["violence", "suicide", "intimate-partner abuse"]` | See list below. Surfaced on the play landing page. |
| `synopsis_short` | string | no | `"A Danish prince…"` | One-sentence elevator pitch. |
| `folger_url` | string (URL) | no | `"https://www.folger.edu/explore/shakespeares-works/hamlet/"` | Cross-link for teacher resources. |
| `mit_url` | string (URL) | no | `"https://shakespeare.mit.edu/hamlet/index.html"` | Cross-link to MIT's plain text for sanity-checks. |
| `wikipedia_url` | string (URL) | no | `"https://en.wikipedia.org/wiki/Hamlet"` | For broad context. |

## Controlled vocabularies

### `genre`
- `Tragedy` — *Hamlet*, *Othello*, *Macbeth*, *Lear*, *Romeo and Juliet*, *Julius Caesar*, *Coriolanus*, *Timon of Athens*, *Titus Andronicus*, *Antony and Cleopatra*
- `Comedy` — *Midsummer*, *Much Ado*, *Twelfth Night*, *As You Like It*, *Comedy of Errors*, *Love's Labour's Lost*, *Merry Wives*, *Taming of the Shrew*, *Two Gentlemen of Verona*
- `History` — *Henry IV*, *Henry V*, *Henry VI*, *Henry VIII*, *Richard II*, *Richard III*, *King John*
- `Romance` — *The Tempest*, *Winter's Tale*, *Cymbeline*, *Pericles*
- `Tragicomedy` — *Merchant of Venice*, *Measure for Measure*, *All's Well That Ends Well*, *Troilus and Cressida* (the "problem plays")
- `Poem` — *Venus and Adonis*, *Rape of Lucrece*, *Phoenix and Turtle*, *Lover's Complaint*, *Passionate Pilgrim*
- `Sonnet_Sequence` — *Sonnets*

### `themes` (controlled, extensible)
Lowercase, snake_case if multi-word. Initial set:

`ambition`, `appearance_vs_reality`, `betrayal`, `class`, `corruption`, `death`, `deception`, `family`, `fate`, `forgiveness`, `gender`, `grief`, `honor`, `identity`, `jealousy`, `justice`, `kingship`, `language`, `loyalty`, `madness`, `marriage`, `masculinity`, `memory`, `mercy`, `mortality`, `nature_vs_culture`, `order_vs_chaos`, `performance`, `political_legitimacy`, `power`, `prophecy`, `race`, `religion`, `revenge`, `succession`, `time`, `transformation`, `war`, `youth_vs_age`

Add new themes only when an existing one doesn't fit. Don't fragment ("jealousy" already covers "envy").

### `content_warning`

`violence`, `suicide`, `intimate_partner_violence`, `sexual_assault`, `sexual_coercion`, `infanticide`, `child_abuse`, `elder_abuse`, `mutilation`, `racism`, `antisemitism`, `misogyny`, `religious_persecution`, `enslavement`, `war_atrocity`, `mental_health_crisis`

Use the specific term; don't catch-all "disturbing content."

### `difficulty_rating`

| Rating | Meaning | Examples |
|---|---|---|
| 1 | Accessible to a strong middle-school reader | *Tempest*, *Midsummer Night's Dream* |
| 2 | Typical 9th–10th grade text | *Romeo and Juliet*, *Julius Caesar* |
| 3 | Standard high-school challenge | *Macbeth*, *Othello*, *Merchant of Venice* |
| 4 | Demanding; college intro | *Hamlet*, *Lear*, *Henry IV* |
| 5 | Highly demanding; specialist | *Coriolanus*, *Troilus and Cressida*, *Cymbeline* |

The rating is editorial — based on density of allusion, syntactic difficulty, and length. It is not a quality judgment.

## Editorial process

Catalog entries are hand-authored, not generated. Date ranges come from Folger and Arden introductions; themes from teacher consensus; difficulty ratings from the editorial team's judgment. Cross-check every entry against at least two of: Folger, Arden, ISE, *Riverside Shakespeare*.

Update the catalog by editing `data/catalog/works.json` directly. The schema validator catches typos; a code review catches editorial slippage.
