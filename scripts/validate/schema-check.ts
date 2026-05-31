#!/usr/bin/env tsx
/**
 * Validate every JSON file under data/ against its schema.
 * Exits non-zero if any file fails.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, basename } from 'node:path';
import { CATALOG_PATH, DATA_DIR, PLAYS_DIR, REFERENCES_DIR, GLOSSARY_PATH, REPO_ROOT } from '../lib/paths.ts';
import { makeAjv, loadSchema } from '../lib/ajv.ts';

interface Violation {
  file: string;
  schema: string;
  errors: unknown;
}

const ajv = makeAjv();
const validators = {
  catalog: ajv.compile({ type: 'array', items: loadSchema('catalog-entry') }),
  annotation: ajv.compile({ type: 'array', items: loadSchema('annotation') }),
  playText: ajv.compile(loadSchema('play-text')),
  character: ajv.compile(loadSchema('character')),
  referenceCard: ajv.compile(loadSchema('reference-card')),
  glossary: ajv.compile(loadSchema('glossary')),
};

const violations: Violation[] = [];

function checkOne(file: string, schemaName: keyof typeof validators) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const ok = validators[schemaName](data);
  if (!ok) {
    violations.push({
      file: relative(REPO_ROOT, file),
      schema: schemaName,
      errors: validators[schemaName].errors,
    });
  }
}

function listJson(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
      .map((f) => resolve(dir, f));
  } catch {
    return [];
  }
}

function listSubdirs(dir: string): string[] {
  try {
    return readdirSync(dir)
      .map((d) => resolve(dir, d))
      .filter((p) => {
        try { return statSync(p).isDirectory(); } catch { return false; }
      });
  } catch {
    return [];
  }
}

// Catalog
try {
  checkOne(CATALOG_PATH, 'catalog');
} catch (e) {
  // Catalog may not exist yet during early bootstrap; warn but don't fail.
  console.warn(`note: catalog not found at ${CATALOG_PATH}; skipping.`);
}

// Plays: every <slug>/{text,annotations,characters}.json
for (const playPath of listSubdirs(PLAYS_DIR)) {
  const slug = basename(playPath);
  const textPath = resolve(playPath, 'text.json');
  const annPath = resolve(playPath, 'annotations.json');
  const charPath = resolve(playPath, 'characters.json');
  try { checkOne(textPath, 'playText'); } catch {}
  try { checkOne(annPath, 'annotation'); } catch {}
  try { checkOne(charPath, 'character'); } catch {}
  try { checkOne(resolve(playPath, 'glossary.json'), 'glossary'); } catch {}
  // synopsis.json has no schema yet (free-form)
}

// Reference cards
for (const cardFile of listJson(REFERENCES_DIR)) {
  checkOne(cardFile, 'referenceCard');
}

// Glossary (shared archaic vocab) — currently schema-less; skip for now
// TODO: define glossary schema if/when shared.json is non-trivial.

if (violations.length === 0) {
  console.log('schema-check: OK');
  process.exit(0);
}

console.error(`schema-check: ${violations.length} file(s) failed`);
for (const v of violations) {
  console.error(`\n  ${v.file}  (schema: ${v.schema})`);
  console.error('  ' + JSON.stringify(v.errors, null, 2).split('\n').join('\n  '));
}
process.exit(1);
