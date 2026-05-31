# Prototype Test Checklist — Hamlet

This is the manual acceptance walkthrough for the Hamlet prototype: the full play, annotated, with the interactive reader. Run it after any change to the reader or the Hamlet data.

## Start the dev server

```
cd site
npm install      # first time only
npm run dev
```

Open `http://localhost:4321`. (In Claude Code, the `.claude/launch.json` config named `site` starts the same server via the preview tools.)

## 1. Catalog (`/`)

- [ ] All 43 works are listed, grouped by genre (Tragedy, Comedy, History, Romance, Tragicomedy, Poem, Sonnet sequence).
- [ ] Hamlet shows its one-line synopsis; works without annotation show an "Annotation pending" note.
- [ ] The header search box is present on this page.

## 2. Play landing (`/plays/hamlet/`)

- [ ] Title, genre, dates, setting, difficulty, and **content notes** (violence, suicide, mental-health crisis) appear.
- [ ] A **Synopsis** overview paragraph appears.
- [ ] The scene table of contents lists all 5 acts and 20 scenes; **each act has a summary** and **each scene shows a one-line summary**.
- [ ] The character list and cross-reference links (Folger, MIT, Wikipedia) appear.

## 3. Theme (any page)

- [ ] The header has a theme toggle cycling **Auto / Light / Dark**. It flips the page between warm-parchment light and warm-dark immediately.
- [ ] Reload the page: the chosen theme is remembered and there is **no flash** of the wrong theme.

## 4. Scene reader — read & depth (`/plays/hamlet/3/1/`, "To be or not to be")

- [ ] The scene renders in a serif face with TLN line numbers; the **speaker name appears once above each speech** (not on every line), with a thin coloured stripe.
- [ ] Lines with annotations have a dotted underline and a `·` marker.
- [ ] The depth toggle is **Off / Read / Study**. **Read** shows only the plain-English gloss; **Study** adds source citations, extra detail, full reference cards, and the advanced/bawdy/textual-variant notes (which are hidden in Read). **Off** hides the gloss layer.
- [ ] The depth choice persists across scenes (localStorage).

## 4. Two-way gloss linking

- [ ] Click a `·` marker (or click anywhere on an annotated line): the line highlights and the matching note in the sidebar scrolls into view and briefly flashes.
- [ ] Click a note in the sidebar: the corresponding line in the text highlights and scrolls into view.
- [ ] The sidebar scrolls independently on desktop (the text column does not jump when a note is focused).

## 5. Reference cards

- [ ] In a scene with an allusion (e.g. 1/2 "Hyperion", 2/2 "Hecuba"/"Jephthah", 5/1 "Cain's jaw-bone", 5/2 "fall of a sparrow"), the note shows an expandable reference card chip (biblical / classical / historical).
- [ ] Expanding the chip shows a student-friendly explanation, and at **scholar** depth a longer note, plus the source citation.

## 6. Character reading modes (sidebar "Reading mode")

- [ ] **Color speakers**: every speaker name + line stripe is tinted by character (a legend shows the colours) — useful for tracking who is talking. Every speaker has a distinct, legible colour (including minor parts like Francisco).
- [ ] **Highlight**: tick characters to tint their lines in their colour; others stay normal.
- [ ] **Focus**: tick the character(s) you're reading; everyone else dims. **Prev/Next line** buttons appear to jump between the selected lines (for reading a part aloud in class).
- [ ] **Reset** returns to Normal.

## 6b. Word glossary (hover/tap)

- [ ] Archaic words (e.g. "ere", "anon", "marry", "prithee", false-friends like "still"/"want"/"let") have a faint dotted underline; hovering or tapping one shows a short definition tooltip.
- [ ] The "Word definitions on hover" checkbox in the sidebar turns the underlines/tooltips off and on.

## 7. Search (header, any page)

- [ ] Type a word (e.g. `sparrow`, `nunnery`, `Yorick`). A results dropdown appears.
- [ ] Results include lines, scenes, and annotations. Clicking a **line** result lands on the correct scene at that line; clicking an **annotation** result lands on the correct scene with the note anchored.
- [ ] Search works on the catalog and landing pages too, not only inside a scene.

## 8. Navigation

- [ ] "Previous scene" / "Next scene" move correctly, including across act boundaries (e.g. 1/5 → 2/1, 3/4 → 4/1).
- [ ] The "← Hamlet" link returns to the play landing page.

## 9. Responsive / accessibility (light check)

- [ ] Narrow the window: the layout collapses to a single column, the gloss sidebar moves below the text, and the header search wraps to its own row.
- [ ] Tab through the page: the depth toggle, character checkboxes, search box, and links are keyboard-reachable; a "Skip to content" link appears on first Tab.
- [ ] Dark mode (OS preference) renders with readable contrast.

## Known limitations (expected, not bugs)

- Only **Hamlet** is annotated; the other 42 works are catalog entries (and most have no reading text yet).
- Some annotations sit in `data/plays/hamlet/_review_queue/` (the fact-check gate routed them there) and do **not** appear in the reader — this is intentional.
- Anchor highlighting is word-granular, so at the source's glued `;--` punctuation a highlight may include one extra adjacent word.
- Light/dark theming ships; the rest of the accessibility toolbar (OpenDyslexic, line-height, font-size) and a modern-English paraphrase are deferred to a later phase.
- The word glossary (~810 entries) is broad; underlines can look busy on dense lines — use the "Word definitions on hover" toggle to quiet them.

## Automated gates (run before shipping)

```
cd scripts
npm run validate            # schema-check + anchor-check + citation-check
npx tsx ../tests/schema/test-runner.ts   # schema fixture tests
cd ../site && npm run build # static build of all pages
```
All must pass.
