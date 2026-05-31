# UX Principles

The reader UX is the product. Every other piece of the system — schemas, pipeline, prose — exists to serve a student reading the play. These principles are evidence-based, with citations to the research and to the existing tools they're drawn from.

## Principle 1 — Marginal glosses, not pop-ups

Annotation lives in a **persistent right sidebar** that updates as the reader scrolls. Hover (or tap on mobile) on a glossed phrase to focus the corresponding annotation in the sidebar.

**Why**: A Cambridge SSLA study (cited in the UX research) found marginal-gloss reading produced **45.3% vocabulary retention vs. 26.6% for non-glossed**, and ScienceDirect comparative research found marginal glosses **outperform in-text glosses, which outperform pop-up modals** for comprehension. Pop-ups force the reader to choose between losing their place and losing the gloss — both bad.

**Exemplar**: [Internet Shakespeare Editions](https://internetshakespeare.uvic.ca/) uses a sidebar approach with tiered notes.

## Principle 2 — Scene-by-scene chunking

The default navigation unit is the **scene**, not the act and not the whole play. Each scene gets its own URL (`/plays/hamlet/1/5`), its own header (act, scene, location), and a "next scene" link.

**Why**: Acts and scenes are Shakespeare's own structural units; pausing at scene boundaries gives students time to consolidate before more text. Research on pagination vs. continuous scroll finds no comprehension penalty for pagination, and natural rest stops help retention.

**Trade-off**: We lose the cinematic sweep of reading an entire act in flow. Mitigation: an "act view" toggle that concatenates all scenes in one act into one scrolling page. Default to scene.

## Principle 3 — Progressive disclosure for reference depth

The depth toggle has three states: **off** (no annotation), **basic** (default; archaic vocab, key allusions), **scholar** (everything: textual variants, bawdy, contested readings).

Reference cards (biblical, classical, historical) appear as **inline expandable chips** — a short tag like "Luke 16:22 ↗" expands on click into the full card. The card is never on the page until summoned.

**Why**: Advanced readers want the text uncluttered; novices want scaffolding. A single switch lets both groups use the same edition. ISE's three-level annotation system and progressive-disclosure UX literature both back this.

**Anti-pattern avoided**: Stacked footnotes that double the page height with content the reader doesn't yet want.

## Principle 4 — Modern English as toggle, never side-by-side

No facing-page modern translation. A reader can request the modern paraphrase of a passage from a dedicated "modern" pane that slides in over (not next to) the original — and dismisses with a key press.

**Why**: SparkNotes' permanent facing-page format creates **split-attention effect** and trains readers to ignore Shakespeare's English entirely. Research on reading interventions for archaic texts is unkind to this format. Toggle preserves agency without rewarding the lazy path.

**Exception**: For *Troilus and Cressida* and *Coriolanus* — among the syntactically hardest plays — the toggle's default state is debatable. Decide per-play later.

## Principle 5 — Character filter and search as first-class navigation

A persistent **search bar** spans the corpus (every line, every annotation) and supports filters: by play, by character, by theme. A **character filter** highlights or fades speeches by selected characters within the current scene.

**Why**: Students don't only read linearly — they study soliloquies, chase a character's arc, hunt thematic motifs. Open Source Shakespeare's concordance is the gold standard for this; we adopt the user-need, not the 1990s UI.

**Implementation**: MiniSearch or lunr index, pre-built at site build time, hydrated as a client island on first interaction.

## Principle 6 — Accessibility from v1, not bolted on

- **OpenDyslexic** toggle (typeface specifically designed to reduce common dyslexic confusions)
- **Configurable line height** (1.4 / 1.7 / 2.0)
- **Serif / sans-serif** toggle
- **Font size** scale (no fixed pixel sizes for body text — `rem`-based)
- **High-contrast** dark and light themes
- **Keyboard navigation** for every interactive element (depth toggle, character filter, search, scene navigation)
- **Skip links** to main content
- **Semantic HTML** — speaker names in `<dt>`, lines in `<dd>` (or appropriate roles); stage directions in `<em>` or aside roles, not raw `<i>`

**Why**: Shakespeare is required reading. Students who can't read traditional layouts comfortably are still going to be tested on it. Accessibility is a delivery requirement, not a polish item.

## Principle 7 — Mobile = reference, desktop = deep reading

Mobile is a real device but a poor environment for deep reading of long plays. We design mobile for **scene-by-scene reference** — a student looks something up between classes — and design desktop for **flow reading**.

**Implementation**:
- Mobile layout: single column, gloss accessible by tap-to-expand below the line.
- Desktop layout: two-column text + sidebar, with the depth toggle and character filter in a sticky toolbar.
- No mobile-app build. Progressive Web App if a future cycle wants offline.

## Anti-patterns (do not build)

1. **Modal pop-up glosses.** Lowest comprehension scores in the research. Hide the text, lose the place.
2. **Permanent side-by-side modern English.** Trains crutch dependency, kills engagement with Shakespeare's language.
3. **Over-annotation.** Every line annotated = no annotation. Annotate where a smart 10th-grader stumbles, not where you can imagine someone might.
4. **Auto-playing audio or video.** Even when we add audio (deferred), it's opt-in.
5. **Chrome-heavy reading view.** No sticky nav bar covering 15% of the viewport. Reading time wants minimal chrome.
6. **Required login.** Reading is anonymous in v1; no login wall, no email-gate.

## Open UX questions

- **How much to annotate the obviously archaic words** — `doth`, `thou`, `'tis`. Probably a one-time tutorial pane the first session a reader visits, then off-by-default. Decide during pilot.
- **Soliloquy flagging** — a soliloquy badge on the scene/character view. Useful, deferred.
- **Theme browsing** — `/themes/madness/` showing every scene-passage tagged with the theme. Powerful if themes are well-tagged; deferred until annotation coverage is broad.
- **"Where else does this image appear?"** — cross-canon parallel-passage view powered by the `parallel_passage` annotation type. Build this; it's a differentiator.

## Citations (for design defenses)

- Cambridge SSLA: gloss-format vocabulary retention study
- ScienceDirect comparative reading research: marginal vs in-text vs pop-up glosses
- Wiley *JCAL* annotation strategy studies
- Internet Shakespeare Editions annotation guidelines
- Open Source Shakespeare concordance and character views
- Progressive-disclosure literature (UXmatters, Interaction Design Foundation)
- Bionic Reading and OpenDyslexic accessibility research

Specific URLs are tracked in the planning notes (see plan file in your home directory) and should be added to a "Further Reading" page if/when we publish design docs externally.
