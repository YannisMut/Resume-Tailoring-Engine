---
phase: 03-analysis
plan: 01
subsystem: testing
tags: [vitest, tdd, analysis, error-handling]

# Dependency graph
requires:
  - phase: 02-pdf-parsing
    provides: parsePdf service, ResumeStructure type, analyze route, error middleware pattern

provides:
  - JdTooLongError class exported from error.middleware.ts (status 400, code jd_too_long)
  - RED unit test contracts for analyzeResume() in analysis.service.test.ts (9 tests)
  - RED integration test contracts for JD validation and AnalysisResult shape in analyze.route.test.ts (4 new tests)

affects: [03-02, 03-03, 03-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [Nyquist Rule TDD — RED tests written before any service implementation]

key-files:
  created:
    - apps/api/src/__tests__/analysis.service.test.ts
  modified:
    - apps/api/src/middleware/error.middleware.ts
    - apps/api/src/__tests__/analyze.route.test.ts

key-decisions:
  - "JdTooLongError uses status 400 (not 422) and code jd_too_long — distinct from PDF parse errors which use 422"
  - "Unit tests for analyzeResume() import from services/analysis.service.js which does not exist yet — import failure IS the RED state"
  - "Integration tests assert exact AnalysisResult shape (score, gaps, rewrites, resumeStructure) as contract for Plans 03-02 and 03-03"

patterns-established:
  - "RED-first TDD: test files written and committed before any service file exists — import failure confirms tests are real contracts"
  - "JD validation boundary: absent or empty JD = 400 jd_too_long, exactly 5000 chars = 200 (boundary), > 5000 chars = 400 jd_too_long"

requirements-completed: [ANAL-01, ANAL-02, ANAL-03]

# Metrics
duration: 5min
completed: 2026-03-10
---

# Phase 3 Plan 01: Analysis Wave 0 — Error class and RED test contracts

**JdTooLongError class added to error middleware and all analyzeResume() contracts written as failing tests before any service code exists**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-10T22:53:00Z
- **Completed:** 2026-03-10T22:58:14Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added JdTooLongError (status 400, code jd_too_long) to error.middleware.ts without touching any existing class
- Wrote 9 RED unit tests covering all analyzeResume() return value contracts — all fail at import (analysis.service.ts doesn't exist)
- Appended 4 RED integration tests to analyze.route.test.ts covering JD validation (absent, too long, boundary) and AnalysisResult shape — 3 fail, 1 boundary test passes early
- All 6 original Phase 2 route tests remain green

## Task Commits

Each task was committed atomically:

1. **Task 1: Add JdTooLongError to error.middleware.ts** - `28fa775` (feat)
2. **Task 2: Write RED unit tests for analysis.service.ts** - `f519cd9` (test)
3. **Task 3: Write RED integration tests for JD validation and response shape** - `9be231a` (test)

**Plan metadata:** (docs commit — see below)

_Note: TDD tasks committed in RED state per Nyquist Rule — failure is expected and correct_

## Files Created/Modified
- `apps/api/src/middleware/error.middleware.ts` - Added JdTooLongError class (6 lines, additive only)
- `apps/api/src/__tests__/analysis.service.test.ts` - New file: 9 unit test contracts for analyzeResume()
- `apps/api/src/__tests__/analyze.route.test.ts` - Added JdTooLongError import + 4 new integration test cases

## Decisions Made
- JdTooLongError uses status 400 (client error) — distinct from 422 PDF parse errors. Missing JD and oversized JD both use jd_too_long to simplify frontend error handling.
- The "exactly 5000 chars returns 200" boundary test passes even before route validation is implemented (the route currently accepts any valid PDF request). This is expected — the test becomes a regression guard once Plans 03-02/03-03 add validation.
- Unit tests import from `../services/analysis.service.js` with no mock — import failure IS the RED state (no need to mock a non-existent module).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The plan's expectation of "13 failing tests" was slightly off — the analysis.service.test.ts import error surfaces as a single file failure rather than 9 individual test failures in vitest output. The RED state is equivalent.

## Next Phase Readiness
- JdTooLongError class ready for use in Plan 03-03 (route wiring)
- analysis.service.test.ts ready to go GREEN in Plan 03-02 (service implementation)
- analyze.route.test.ts integration tests ready to go GREEN in Plan 03-03 (route update)
- No blockers

---
*Phase: 03-analysis*
*Completed: 2026-03-10*

## Self-Check: PASSED

- FOUND: apps/api/src/middleware/error.middleware.ts
- FOUND: apps/api/src/__tests__/analysis.service.test.ts
- FOUND: apps/api/src/__tests__/analyze.route.test.ts
- FOUND: .planning/phases/03-analysis/03-01-SUMMARY.md
- FOUND commit: 28fa775 (JdTooLongError)
- FOUND commit: f519cd9 (RED unit tests)
- FOUND commit: 9be231a (RED integration tests)
