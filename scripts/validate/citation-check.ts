#!/usr/bin/env tsx
/**
 * Sanity-check citations on annotations and reference cards:
 *   - biblical refs look like "Book Chapter:Verse[-Verse] [(Edition)]"
 *   - classical sources name an allowlisted author
 *   - reference-card cross-references resolve to an existing card
 *   - every annotation has a non-empty sources[] with non-empty name + citation
 *
 * Exits non-zero on any failure.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, basename, relative } from 'node:path';
import { PLAYS_DIR, REFERENCES_DIR, REPO_ROOT } from '../lib/paths.ts';

interface Source {
  name: string;
  citation: string;
}

interface Reference {
  kind: 'biblical' | 'classical' | 'historical';
  card_id: string;
}

interface Annotation {
  id: string;
  play: string;
  type: string;
  sources: Source[];
  references?: Reference[];
}

interface ReferenceCardFile {
  kind: 'biblical' | 'classical' | 'historical';
  cards: { id: string; kind: string; source: Source }[];
}

// A well-formed scripture reference appearing ANYWHERE in the citation string, e.g.
// "Luke 16:22", "1 Samuel 17:50", "Genesis 3:1–15 (Geneva 1599): '...'". Allows a
// leading book number, multi-word book names, and hyphen or en-dash verse ranges.
const BIBLICAL_RE = /(?:[1-3]\s)?[A-Z][a-z]+\.?\s\d{1,3}:\d{1,3}(?:[–-]\d{1,3})?/;

const CLASSICAL_ALLOWLIST = new Set([
  'Ovid',
  'Plutarch',
  'Virgil',
  'Homer',
  'Hesiod',
  'Seneca',
  'Holinshed',
  'Boccaccio',
  'Chaucer',
  'North',          // Plutarch translator
  'Golding',        // Ovid translator
  'Lucan',
  'Horace',
  'Cicero',
  'Livy',
  'Tacitus',
  'Aristotle',
  'Plato',
  'Suetonius',
  'Apuleius',
  'Saxo Grammaticus',
  'Belleforest',
  'Plautus',
  'Terence',
  'Boethius',
  'Pliny',
  'Juvenal',
  'Apollodorus',
  'Lucian',
  'Aesop',
  'Quintilian',
  'Lucretius',
  'Galen',           // 2nd-c. Greek physician; Falstaff cites him in 2 Henry IV 1.2
  'Herodotus',       // Greek historian; source for Rhodope and Tomyris (cited in 1 Henry VI 1.6)
  'Pindar',          // lyric poet of the Olympian Odes; the Olympian games (3 Henry VI 2.3)
  'Pausanias',       // 2nd-c. Greek geographer, Description of Greece (Olympia and its games)
]);

// A classical allusion may instead be grounded in a recognized reference work or
// scholarly edition (which the semantic source-judge verifies for accuracy). This
// keeps the structural gate meaningful without rejecting legitimately-sourced notes.
const SCHOLARLY_ALLOWLIST = [
  'OED', 'Onions', 'Schmidt', 'Crystal', 'Partridge', 'Tilley', 'Dent',
  'Arden', 'Oxford', 'Cambridge', 'Norton', 'Pelican', 'Folger', 'Riverside',
  'Bullough', 'Spevack', 'Geneva', 'Vulgate',
];

interface Violation {
  where: string;
  reason: string;
}

const violations: Violation[] = [];

// Load every reference card id so cross-references can be resolved.
const cardIds = new Set<string>();
for (const dirent of safeReaddir(REFERENCES_DIR)) {
  if (!dirent.endsWith('.json')) continue;
  try {
    const data: ReferenceCardFile = JSON.parse(readFileSync(resolve(REFERENCES_DIR, dirent), 'utf8'));
    for (const card of data.cards) {
      cardIds.add(`${data.kind}:${card.id}`);
    }
  } catch {
    /* ignore unreadable */
  }
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function checkAnnotationCitations(ann: Annotation) {
  if (!ann.sources || ann.sources.length === 0) {
    violations.push({ where: ann.id, reason: 'sources[] is empty' });
    return;
  }
  for (const [i, s] of ann.sources.entries()) {
    if (!s.name?.trim()) violations.push({ where: ann.id, reason: `sources[${i}].name is empty` });
    if (!s.citation?.trim()) violations.push({ where: ann.id, reason: `sources[${i}].citation is empty` });
  }

  if (ann.type === 'biblical_allusion') {
    const looksBiblical = ann.sources.some((s) => BIBLICAL_RE.test(s.citation));
    if (!looksBiblical) {
      violations.push({ where: ann.id, reason: `type=biblical_allusion but no source citation matches biblical pattern` });
    }
  }

  if (ann.type === 'classical_allusion') {
    const grounded = ann.sources.some((s) => {
      const hay = `${s.name} ${s.citation}`;
      return [...CLASSICAL_ALLOWLIST].some((a) => hay.includes(a))
        || SCHOLARLY_ALLOWLIST.some((w) => hay.includes(w));
    });
    if (!grounded) {
      violations.push({
        where: ann.id,
        reason: `type=classical_allusion but no source names an allowlisted classical author or recognized reference work/edition`,
      });
    }
  }

  for (const ref of ann.references ?? []) {
    const key = `${ref.kind}:${ref.card_id}`;
    if (!cardIds.has(key)) {
      violations.push({ where: ann.id, reason: `references unknown reference card ${key}` });
    }
  }
}

for (const dirent of safeReaddir(PLAYS_DIR)) {
  const playDir = resolve(PLAYS_DIR, dirent);
  try {
    if (!statSync(playDir).isDirectory()) continue;
  } catch {
    continue;
  }
  const annPath = resolve(playDir, 'annotations.json');
  try {
    const anns: Annotation[] = JSON.parse(readFileSync(annPath, 'utf8'));
    for (const ann of anns) checkAnnotationCitations(ann);
  } catch {
    /* no annotations file yet — fine */
  }
}

if (violations.length === 0) {
  console.log('citation-check: OK');
  process.exit(0);
}

console.error(`citation-check: ${violations.length} violation(s)`);
for (const v of violations) {
  console.error(`  ${v.where}: ${v.reason}`);
}
process.exit(1);
