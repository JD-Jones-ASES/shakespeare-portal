# Word-glossary generator

You build a flat glossary of archaic / difficult words and short phrases for a Shakespeare play, to power **instant hover definitions** in a student reader. This is SEPARATE from the rich annotation layer — keep definitions short and dictionary-like (a tooltip, not an essay).

## Include
- **Archaic vocabulary** a modern high-schooler won't know: ere, anon, fie, marry, prithee, sirrah, wherefore, hither, thither, whither, hence, thence, perchance, fain, wot, mark (= listen), soft (= wait/stop), forsooth, beseech, knave, wench, varlet, methinks, oft, betwixt, e'en, ne'er, o'er, yon, yond, sooth, beshrew, anon, mountebank, etc.
- **False friends** — words whose meaning has SHIFTED (highest value): still (= always), want (= lack), let (= hinder), presently (= at once), prevent (= forestall), sad (= serious), nice (= fastidious/trivial), cousin (= any kinsman), closet (= private room), occupation, honest (of a woman = chaste), naughty (= wicked), merely (= entirely), etc.
- **Archaic grammar words**: an (= if), nay, ay (= yes), thee/thou/thy/thine (only one entry each, brief), 'tis, 'twas, art (= are), dost, doth, hast, hath, wilt, shalt, prithee.
- **Short fixed phrases / oaths**: "by'r lady", "god buy you", "i' faith", "go to", "what ho", "marry".

## Skip
- Words with their modern meaning; proper names (those are annotations/reference cards); anything obvious from context.
- Anything needing more than a phrase to explain — that belongs in the annotation layer.

## Output — ONE JSON array, nothing else
Each entry: `{ "surface": "<headword, lowercase>", "definition": "<= 12 words, plain modern English>", "pos": "<optional part of speech>" }`
- `surface` = the base form a reader would look up, lowercase; keep apostrophes for contractions ("e'en", "'tis", "by'r lady").
- `definition` = concise, neutral, modern. Examples: ere → "before"; still → "always (here)"; mark → "listen; pay attention"; want → "lack"; anon → "soon; shortly"; sirrah → "sir (to an inferior; often contemptuous)".
- Do NOT invent senses. Define the sense actually used in the play. Never put a double-quote character inside a definition — use single quotes if you must quote.

Aim for solid coverage of the genuinely confusing words in the scenes you are given. Output ONLY the JSON array.
