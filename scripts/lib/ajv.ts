import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SCHEMAS_DIR } from './paths.ts';

export function makeAjv() {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictTypes: false,
    strictRequired: false, // allow conditional `required` in allOf/then without redeclaring properties locally
  });
  addFormats(ajv);
  return ajv;
}

export function loadSchema(name: string): object {
  const path = resolve(SCHEMAS_DIR, `${name}.schema.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

export const SCHEMA_NAMES = [
  'annotation',
  'play-text',
  'catalog-entry',
  'character',
  'reference-card',
] as const;
