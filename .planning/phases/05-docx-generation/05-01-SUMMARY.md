---
phase: 05-docx-generation
plan: "01"
subsystem: api-docx
tags: [tdd, red-tests, docx, wave-0]
dependency_graph:
  requires: []
  provides: [docx-service-contract, generate-route-contract]
  affects: [05-02-docx-service-implementation, 05-03-human-visual-verify]
tech_stack:
  added: [docx@9.x]
  patterns: [nyquist-tdd, red-import-failure, pure-helper-exports]
key_files:
  created:
    - apps/api/src/__tests__/docx.service.test.ts
    - apps/api/src/__tests__/generate.route.test.ts
  modified:
    - apps/api/package.json
decisions:
  - "RED state is import failure (not assertion failure) — confirms tests are real contracts not post-hoc validators"
  - "Pure helper exports (normalizeFontName, spacingFromStyle, selectBulletText) enable isolated testing without mocking docx internals"
  - "generateDocx integration test uses real docx library (no mock) to verify Buffer output"
  - "generate.route.test.ts mocks docx.service so integration test does not depend on real OOXML generation"
metrics:
  duration: 2min
  completed_date: "2026-03-11"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
requirements_satisfied: [OUT-01]
---

# Phase 5 Plan 01: Wave 0 DOCX Test Stubs Summary

Wave 0 TDD — install docx package and write RED test contracts for the DOCX generation service and Express route before any implementation exists.

## What Was Built

Installed the `docx` npm package (v9.6.1) in `apps/api` and wrote two failing test files that define the full implementation contract for Plan 02:

**apps/api/src/__tests__/docx.service.test.ts** — Unit tests for the DOCX service pure helpers and Buffer output:
- `generateDocx` returns a non-empty Buffer
- `selectBulletText` selects `rewritten` text for approved bullets, `original` for unapproved, falls back when no rewrite exists
- `normalizeFontName` strips subset prefixes (ABCDEF+Calibri -> Calibri) and substitutes known problematic fonts (Garamond -> Times New Roman)
- `spacingFromStyle` converts point values to TWIPs (x 20) and sets LineRuleType.EXACT for line spacing

**apps/api/src/__tests__/generate.route.test.ts** — Integration tests for POST /api/generate:
- 200 with correct DOCX Content-Type header on valid body
- 400 on missing resumeStructure
- 400 on non-array bullets
- 400 on empty body

Both files fail at import (module not found) — the RED state confirming they are real contracts written before implementation.

## Verification Results

- docx.service.test.ts: FAIL at import (Cannot find module '../services/docx.service.js') — RED confirmed
- generate.route.test.ts: FAIL at import (Cannot find module '../routes/generate.route.js') — RED confirmed
- All 6 pre-existing test files: PASS (53 tests pass, 0 regressions)
- docx in apps/api/package.json dependencies: confirmed (^9.6.1)

## Decisions Made

1. Pure helpers exported from service: `normalizeFontName`, `spacingFromStyle`, `selectBulletText` — enables isolated unit testing without mocking docx internals. Mock-free approach is simpler and tests real behavior.
2. `generateDocx` tested with real docx library (no mock needed) — `Buffer.isBuffer(result)` and `result.length > 0` are sufficient integration proof.
3. `generate.route.test.ts` mocks `docx.service.js` to decouple integration test from OOXML generation complexity.
4. RED state via import failure (not assertion failure) — strongest possible contract guarantee before implementation.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 3bfa725 | Add RED test stubs for docx service and install docx package |
| 2 | cb7554e | Add RED integration test stubs for POST /api/generate route |
