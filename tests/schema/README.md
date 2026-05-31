# Schema fixtures and tests

Two fixtures plus a runner to confirm the JSON Schemas in `../../schemas/` behave as documented.

## Files

- `valid-annotation.json` — a complete, well-formed annotation that should validate cleanly against `schemas/annotation.schema.json`.
- `invalid-annotation.json` — a deliberately-broken annotation. Errors include:
  - `id` doesn't match the `<slug>-<tln>-<short>` pattern
  - `play` uses wrong case (`Hamlet` vs `hamlet`)
  - `tln_start` is 0 (minimum: 1)
  - `tln_end` is negative
  - `word_start > word_end`
  - `anchor_text` is empty
  - `type` isn't in the enum
  - `depth` isn't `basic | scholar`
  - `summary` is empty
  - `sources` is empty
  - `fact_checked: true` without `fact_check_verdicts`/`fact_checked_by`/`fact_checked_at`
- `catalog-sample.json` — a minimal valid catalog entry (the required-only subset).
- `test-runner.ts` — loads each fixture, runs it through Ajv against the relevant schema, and asserts the expected outcome.

## How to run

From the repo root, after installing pipeline dependencies once:

```
cd scripts && npm install
npx tsx ../tests/schema/test-runner.ts
```

Or from anywhere with `tsx` on PATH:

```
npx tsx tests/schema/test-runner.ts
```

Expected output (when all pass):

```
PASS  annotation: valid fixture
PASS  annotation: deliberately broken fixture
PASS  catalog-entry: minimal sample

3 passed, 0 failed.
```

Exit code 0 = all schemas behave as documented. Non-zero = something drifted.
