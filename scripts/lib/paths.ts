import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(here, '..', '..');
export const DATA_DIR = resolve(REPO_ROOT, 'data');
export const SCHEMAS_DIR = resolve(REPO_ROOT, 'schemas');
export const PLAYS_DIR = resolve(DATA_DIR, 'plays');
export const CATALOG_PATH = resolve(DATA_DIR, 'catalog', 'works.json');
export const GLOSSARY_PATH = resolve(DATA_DIR, 'glossary', 'shared.json');
export const REFERENCES_DIR = resolve(DATA_DIR, 'references');
export const VENDOR_DIR = resolve(REPO_ROOT, 'shakespeare-material-master');
export const GUTENBERG_DIR = resolve(VENDOR_DIR, 'texts', 'gutenberg');

export function playDir(slug: string): string {
  return resolve(PLAYS_DIR, slug);
}

// A few vendored modern-spelling files are named differently from the play slug. Map the
// slug to the actual file basename so ingest can find the source. (Titus's modern text is
// filed under its long Folio-style title; its matching titus_andronicus_gut_f.txt is the
// Folio text, scholar-only, so gutenbergFolioPath needs no alias.)
const MODERN_SOURCE_ALIAS: Record<string, string> = {
  titus_andronicus: 'tragedy_of_titus_andronicus',
};

// The vendored modern cymbeline_gut.txt is INCOMPLETE — it is missing Acts III and IV (the
// whole Welsh storyline). A complete modern-spelling text, converted from the vendored
// public-domain Moby Shakespeare XML by scripts/pipeline/_moby-to-gut.mjs, is committed at
// data/sources/cymbeline_gut.txt; point the slug there. Absolute override (the Moby-derived
// text lives outside the read-only vendor dir). One key only, so every other slug is
// unaffected and re-ingests byte-identical.
const FULL_SOURCE_OVERRIDE: Record<string, string> = {
  cymbeline: resolve(DATA_DIR, 'sources', 'cymbeline_gut.txt'),
};

export function gutenbergModernPath(slug: string): string {
  if (FULL_SOURCE_OVERRIDE[slug]) return FULL_SOURCE_OVERRIDE[slug];
  const base = MODERN_SOURCE_ALIAS[slug] ?? slug;
  return resolve(GUTENBERG_DIR, `${base}_gut.txt`);
}

export function gutenbergFolioPath(slug: string): string {
  return resolve(GUTENBERG_DIR, `${slug}_gut_f.txt`);
}
