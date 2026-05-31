#!/usr/bin/env tsx
/**
 * Sanity-check the JSON Schemas: the valid fixture validates; the invalid fixture
 * is rejected with a non-empty set of errors covering the deliberate problems.
 *
 * Run:
 *   cd scripts && npm install && cd ..
 *   npx --prefix scripts tsx tests/schema/test-runner.ts
 *
 * Or from scripts/:
 *   npx tsx ../tests/schema/test-runner.ts
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeAjv, loadSchema } from '../../scripts/lib/ajv.ts';

const here = dirname(fileURLToPath(import.meta.url));

interface TestCase {
  name: string;
  schema: 'annotation' | 'catalog-entry' | 'play-text' | 'character' | 'reference-card';
  asArray: boolean;
  file: string;
  expect: 'valid' | 'invalid';
  expectedErrorKeywords?: string[];
}

const cases: TestCase[] = [
  {
    name: 'annotation: valid fixture',
    schema: 'annotation',
    asArray: true,
    file: resolve(here, 'valid-annotation.json'),
    expect: 'valid',
  },
  {
    name: 'annotation: deliberately broken fixture',
    schema: 'annotation',
    asArray: true,
    file: resolve(here, 'invalid-annotation.json'),
    expect: 'invalid',
    expectedErrorKeywords: ['enum', 'minLength', 'pattern', 'minItems', 'minimum'],
  },
  {
    name: 'catalog-entry: minimal sample',
    schema: 'catalog-entry',
    asArray: true,
    file: resolve(here, 'catalog-sample.json'),
    expect: 'valid',
  },
];

const ajv = makeAjv();

function compile(schemaName: TestCase['schema'], asArray: boolean) {
  const inner = loadSchema(schemaName);
  return ajv.compile(asArray ? { type: 'array', items: inner } : inner);
}

let pass = 0;
let fail = 0;

for (const tc of cases) {
  const validator = compile(tc.schema, tc.asArray);
  const data = JSON.parse(readFileSync(tc.file, 'utf8'));
  const ok = validator(data);
  const errors = validator.errors ?? [];
  const errorKeywords = new Set(errors.map((e) => e.keyword));

  let passed = false;
  if (tc.expect === 'valid' && ok) passed = true;
  if (tc.expect === 'invalid' && !ok) {
    if (!tc.expectedErrorKeywords) {
      passed = true;
    } else {
      const missing = tc.expectedErrorKeywords.filter((k) => !errorKeywords.has(k));
      passed = missing.length === 0;
      if (!passed) {
        console.error(`  expected error keywords missing: ${missing.join(', ')}`);
        console.error(`  actual keywords: ${[...errorKeywords].join(', ')}`);
      }
    }
  }

  if (passed) {
    console.log(`PASS  ${tc.name}`);
    pass++;
  } else {
    console.error(`FAIL  ${tc.name}`);
    console.error(`  expected ${tc.expect}; ok=${ok}; errors=${JSON.stringify(errors, null, 2)}`);
    fail++;
  }
}

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
