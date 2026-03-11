---
phase: 04-ai-rewrites
plan: 02
subsystem: api
tags: [openai, vitest, mocking, integration-tests, rewrites]

# Dependency graph
requires:
  - phase: 04-01
    provides: rewriteAllBullets function in ai.service.ts, OpenAiTimeoutError class
  - phase: 03-02
    provides: analyzeResume function and analysis.service.ts
provides:
  - analyzeResume calls rewriteAllBullets and returns populated rewrites in AnalysisResult
  - Integration tests for rewrites shape (AI-01) and 504 ai_timeout on OpenAiTimeoutError (AI-04)
  - ai.service mocked in both analyze.route.test.ts and analysis.service.test.ts
affects: [05-docx-generation, 06-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - vi.mock factory must use vi.fn() directly (not top-level variables) to avoid hoisting ReferenceError
    - Import the mocked module namespace after vi.mock to access mock function for per-test configuration

key-files:
  created: []
  modified:
    - apps/api/src/__tests__/analyze.route.test.ts
    - apps/api/src/__tests__/analysis.service.test.ts

key-decisions:
  - "vi.mock factory must declare vi.fn() inline — top-level const references cause ReferenceError due to hoisting"
  - "analysis.service.test.ts needs its own ai.service mock — direct analyzeResume calls bypass the route mock and hit real OpenAI client"

patterns-established:
  - "Mock pattern: vi.mock(path, () => ({ fn: vi.fn() })) then import * as mock from path; cast mock.fn to ReturnType<typeof vi.fn>"

requirements-completed: [AI-01, AI-04]

# Metrics
duration: 2min
completed: 2026-03-10
---

# Phase 4 Plan 02: AI Rewrites Integration Tests Summary

**POST /api/analyze now returns populated rewrites from rewriteAllBullets, with integration tests covering the RewrittenBullet shape (AI-01) and 504 ai_timeout on OpenAiTimeoutError (AI-04)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T23:10:30Z
- **Completed:** 2026-03-10T23:12:32Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- analysis.service.ts was already async and wired to rewriteAllBullets from Plan 01 — Task 1 verified at zero cost
- Added vi.mock for ai.service.js in analyze.route.test.ts with a default beforeEach return value so all existing route tests get a populated rewrites array
- Added two new integration tests: rewrites shape (checks id/original/rewritten/approved fields) and AI timeout 504 (AI-04)
- Fixed analysis.service.test.ts which was breaking due to analyzeResume now calling rewriteAllBullets without a mock — added ai.service mock so all 9 unit tests run without OPENAI_API_KEY
- Total test count went from 41 to 53, all green

## Task Commits

Each task was committed atomically:

1. **Task 1: Make analyzeResume async and wire rewriteAllBullets** - already committed in Plan 01 (no new commit needed — TypeScript verified clean)
2. **Task 2: Add ai.service mock and new integration tests** - `e70793d`

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `apps/api/src/__tests__/analyze.route.test.ts` - Added ai.service mock, two new integration tests, updated two existing rewrites assertions
- `apps/api/src/__tests__/analysis.service.test.ts` - Added ai.service mock so unit tests don't require OPENAI_API_KEY

## Decisions Made
- vi.mock factory must use `vi.fn()` inline rather than referencing a top-level const — Vitest hoists vi.mock calls above variable declarations, causing a ReferenceError if the factory references a `const` defined later in the file
- Import the mocked module namespace after vi.mock, then cast the exported function to `ReturnType<typeof vi.fn>` to get a properly typed mock reference for per-test setup

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added ai.service mock to analysis.service.test.ts**
- **Found during:** Task 2 (running test suite after analyze.route.test.ts changes)
- **Issue:** analysis.service.test.ts calls analyzeResume directly without mocking ai.service. After Plan 01 made analyzeResume call rewriteAllBullets, these 9 unit tests started failing with "Missing credentials: OPENAI_API_KEY" because the real OpenAI client was being instantiated
- **Fix:** Added vi.mock for ai.service.js with mockResolvedValue([]) at the top of analysis.service.test.ts
- **Files modified:** apps/api/src/__tests__/analysis.service.test.ts
- **Verification:** All 9 analyzeResume unit tests pass green
- **Committed in:** e70793d (Task 2 commit)

**2. [Rule 1 - Bug] Fixed vi.mock factory hoisting ReferenceError in analyze.route.test.ts**
- **Found during:** Task 2 (first test run after adding mock)
- **Issue:** Plan specified `const mockRewriteAllBullets = vi.fn()` before `vi.mock(...)` with a factory referencing it. Vitest hoists vi.mock to the top of the file, so the variable isn't initialized when the factory runs — ReferenceError
- **Fix:** Changed factory to use `vi.fn()` inline, then imported the mocked module namespace and cast the function to `ReturnType<typeof vi.fn>` for per-test mock setup
- **Files modified:** apps/api/src/__tests__/analyze.route.test.ts
- **Verification:** All 12 route tests pass green
- **Committed in:** e70793d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs — both caused by Plan 01 making analyzeResume async)
**Impact on plan:** Both fixes were essential for the test suite to run. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 (AI rewrites) is now complete end-to-end: ai.service, analyzeResume, route, and integration tests all wired and green
- Phase 5 (DOCX generation) can proceed — it receives AnalysisResult with populated rewrites via the stateless round-trip through the client

---
*Phase: 04-ai-rewrites*
*Completed: 2026-03-10*
