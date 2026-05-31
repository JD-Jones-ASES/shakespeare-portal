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

export function gutenbergModernPath(slug: string): string {
  return resolve(GUTENBERG_DIR, `${slug}_gut.txt`);
}

export function gutenbergFolioPath(slug: string): string {
  return resolve(GUTENBERG_DIR, `${slug}_gut_f.txt`);
}
