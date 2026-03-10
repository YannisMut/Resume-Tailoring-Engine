---
phase: 03-analysis
plan: "03"
subsystem: api-route
tags: [route, validation, zod, analysis, integration]
dependency_graph:
  requires: [03-02]
  provides: [POST /api/analyze full contract]
  affects: [apps/api/src/routes/analyze.route.ts]
tech_stack:
  added: [zod (AnalyzeRequestSchema)]
  patterns: [JD validation before parsePdf, Express 5 async throw propagation]
key_files:
  created: []
  modified:
    - apps/api/src/routes/analyze.route.ts
    - apps/api/src/__tests__/analyze.route.test.ts
decisions:
  - "AnalyzeRequestSchema uses .trim().min(1).max(5000) — trim normalises whitespace before the length check, consistent with API UX expectations"
  - "3 pre-existing route tests updated to include jobDescription and match new AnalysisResult shape — the old contract (returning raw ResumeStructure) is superseded by plan 03-01"
metrics:
  duration: "4 min"
  completed: "2026-03-10"
  tasks_completed: 1
  files_modified: 2
---

# Phase 3 Plan 03: Wire analyze route — full AnalysisResult response Summary

**One-liner:** POST /api/analyze now validates jobDescription with Zod, calls analyzeResume(), and returns score + gaps + rewrites + resumeStructure — closing Phase 3.

## What Was Built

Updated `analyze.route.ts` to match the full analysis contract defined in Phase 3 planning:

1. Added `AnalyzeRequestSchema` (Zod) — `z.string().trim().min(1).max(5000)` validates the `jobDescription` field
2. Validation runs **before** `parsePdf` so a missing or oversized JD fails fast without touching the PDF
3. On failure, throws `JdTooLongError` (400 / `jd_too_long`) — caught automatically by `errorMiddleware`
4. After a successful parse, calls `analyzeResume(resume, jobDescription)` and returns the full `AnalysisResult`

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire JD validation and analysis service into analyze route | f7ae445 | analyze.route.ts, analyze.route.test.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 3 stale pre-existing route tests**
- **Found during:** Task 1 verification (vitest run)
- **Issue:** Three tests from Phase 2 called POST /api/analyze without a `jobDescription` field and checked for the old raw `ResumeStructure` response shape. After the route was updated, these tests received 400 (jd_too_long) instead of their expected 422/200 outcomes.
- **Fix:** Added `.field('jobDescription', '...')` to the two PDF-error tests (pdf_encrypted, pdf_scanned) so JD validation passes and the PDF error path is exercised. Updated the "returns 200 with valid ResumeStructure" test to assert the new `AnalysisResult` shape (`score`, `gaps`, `rewrites`, `resumeStructure`) rather than the former raw `ResumeStructure` fields at the root.
- **Files modified:** apps/api/src/__tests__/analyze.route.test.ts
- **Commit:** f7ae445

## Verification

- `npx vitest run` — 41 tests across 5 files, all green
- `npx tsc --noEmit` — zero type errors
- Response shape confirmed: `{ score: number, gaps: string[], rewrites: [], resumeStructure: object }`

## Self-Check: PASSED

- analyze.route.ts: FOUND
- analyze.route.test.ts: FOUND
- 03-03-SUMMARY.md: FOUND
- commit f7ae445: FOUND
