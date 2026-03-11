---
phase: 05-docx-generation
plan: "02"
subsystem: api-docx
tags: [tdd, green, docx, wave-1, implementation]
dependency_graph:
  requires: [05-01-docx-test-stubs]
  provides: [docx-service, generate-route, OUT-01]
  affects: [05-03-human-visual-verify]
tech_stack:
  added: []
  patterns: [tdd-green, pure-helper-exports, express-5-async-propagation, zod-validation]
key_files:
  created:
    - apps/api/src/services/docx.service.ts
    - apps/api/src/routes/generate.route.ts
  modified:
    - apps/api/src/index.ts
decisions:
  - "docx v9 used with static import (not dynamic) — confirmed CJS-compatible per RESEARCH.md, no worker setup needed unlike pdfjs-dist"
  - "Defensive Buffer.from(buf) wrapping after Packer.toBuffer — guards against older jszip returning Uint8Array instead of Buffer"
  - "Bullet numbering uses OOXML numbering reference (not list style) to match docx v9 declarative API"
  - "No try/catch in route handler — Express 5 propagates async throws to errorMiddleware automatically"
metrics:
  duration: 2min
  completed_date: "2026-03-11"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
requirements_satisfied: [OUT-01]
---

# Phase 5 Plan 02: DOCX Service Implementation Summary

Wave 1 TDD GREEN — implement `docx.service.ts` and `generate.route.ts` so all RED test contracts from Plan 05-01 pass, delivering the core DOCX generation endpoint.

## What Was Built

**apps/api/src/services/docx.service.ts** — DOCX generation service with four exported functions:
- `normalizeFontName(raw)` — strips 6-char uppercase subset prefixes (e.g. `ABCDEF+Calibri` → `Calibri`) then applies substitution map for problematic PDF font names (e.g. `Garamond` → `Times New Roman`)
- `spacingFromStyle(style)` — converts `spaceBefore`/`spaceAfter`/`lineSpacingPt` from points to TWIPs (× 20), setting `LineRuleType.EXACT` for line spacing
- `selectBulletText(bulletText, rewritten)` — returns `rewritten.rewritten` when approved, `bulletText` otherwise (including when `rewritten` is undefined)
- `generateDocx(structure, bullets)` — builds a full OOXML Document from `ResumeStructure` + `RewrittenBullet[]`, preserving page dimensions, margins, header lines, section headings, job titles, subtitles, and bullet points with a standard bullet list style

**apps/api/src/routes/generate.route.ts** — Express router for `POST /generate`:
- Validates request body with Zod using `ResumeStructureSchema` and `RewrittenBulletSchema`
- Returns 400 JSON on validation failure
- Calls `generateDocx`, streams Buffer response with correct DOCX Content-Type and Content-Disposition headers

**apps/api/src/index.ts** (modified) — registered `generateRouter` under `/api` after `analyzeRouter`, before `errorMiddleware`.

## Verification Results

- `docx.service.test.ts`: 13 tests — all GREEN
- `generate.route.test.ts`: 4 tests — all GREEN
- Full suite: **70 tests across 8 test files, 0 failures**

## Decisions Made

1. Static `docx` import used (not dynamic) — confirmed CJS-compatible in RESEARCH.md, no ESM worker complexity needed unlike pdfjs-dist.
2. Defensive `Buffer.isBuffer(buf) ? buf : Buffer.from(buf)` after `Packer.toBuffer` — guards against older jszip versions returning Uint8Array.
3. No try/catch in route handler — Express 5 async error propagation to `errorMiddleware` is the established project pattern.
4. Bullet numbering via OOXML `numbering.config` reference — matches docx v9 declarative API and produces standard bullet list rendering.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 5e56460 | Implement DOCX generation service — generateDocx and helper functions |
| 2 | 8161b9f | Add POST /api/generate route and register it in the Express app |
