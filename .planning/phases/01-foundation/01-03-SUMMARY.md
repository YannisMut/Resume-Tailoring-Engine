---
phase: 01-foundation
plan: "03"
subsystem: api
tags: [express, typescript, error-handling, middleware, cors, helmet]

# Dependency graph
requires:
  - phase: 01-01
    provides: monorepo scaffold, tsconfig.base.json strict mode, vitest test infrastructure
  - phase: 01-02
    provides: "@resume/types Zod schemas and TypeScript types"
provides:
  - AppError base class with statusCode, code, message, retryable fields
  - PdfParseError (422/pdf_unparseable) and OpenAiTimeoutError (504/ai_timeout/retryable) typed subclasses
  - errorMiddleware 4-argument Express error handler returning structured JSON
  - Express 5 app shell with helmet, cors, express.json, health route
  - Error contract for all Phase 2-5 service code to throw against
affects:
  - 02-pdf-parsing
  - 03-openai
  - 04-analyze-route
  - 05-generate-route

# Tech tracking
tech-stack:
  added: [express@5.2.1, helmet@8.1.0, cors@2.8.6, dotenv]
  patterns:
    - "4-argument Express error handler as single catch boundary"
    - "Typed AppError subclasses — services throw typed errors, middleware formats JSON"
    - "errorMiddleware registered last — no try/catch in route handlers"

key-files:
  created:
    - apps/api/src/middleware/error.middleware.ts
    - apps/api/src/index.ts
    - .gitignore
  modified: []

key-decisions:
  - "errorMiddleware is the single catch boundary — no try/catch + next(err) in route handlers (Express 5 propagates async throws automatically)"
  - "AppError subclasses define the error contract ahead of all service implementation — PdfParseError(422) and OpenAiTimeoutError(504/retryable) cover Phase 2 and Phase 3 failure modes"
  - "express.json body parser limited to 1mb — ResumeStructure is a JSON tree not a file upload"

patterns-established:
  - "Error contract first: typed error classes established before any service code is written"
  - "Single error boundary: all route errors flow to errorMiddleware via Express 5 async propagation"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-03-08
---

# Phase 1 Plan 03: Express API Shell with Typed Error Middleware Summary

**Express 5 app shell with helmet/cors/json middleware, AppError subclasses (PdfParseError 422, OpenAiTimeoutError 504), and 4-argument errorMiddleware as the single catch boundary for all Phase 2-5 services**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-08T22:17:36Z
- **Completed:** 2026-03-08T22:22:00Z
- **Tasks:** 2
- **Files modified:** 3 (2 created in plan + 1 deviation fix)

## Accomplishments
- AppError base class and PdfParseError/OpenAiTimeoutError subclasses with exact statusCode, code, retryable contracts
- errorMiddleware 4-argument Express handler — returns structured JSON `{ error, message, retryable }` for AppError, `{ error: 'internal_error' }` for unknown errors
- All 4 Wave 0 error-middleware tests pass GREEN
- Express 5 app with helmet, cors, express.json, GET /health, errorMiddleware registered last
- Zero TypeScript strict mode errors across apps/api

## Task Commits

Each task was committed atomically:

1. **Task 1: Error middleware — typed error classes and 4-argument handler** - `d514384` (feat)
2. **Task 2: Express app shell — entry point with health route and security middleware** - `f55b400` (feat)

**Deviation (auto-fix):** `d1dea9d` (chore: add .gitignore)

## Files Created/Modified
- `apps/api/src/middleware/error.middleware.ts` - AppError, PdfParseError, OpenAiTimeoutError, errorMiddleware
- `apps/api/src/index.ts` - Express 5 app entry point with middleware stack and health route
- `.gitignore` - Excludes node_modules, dist, .turbo, .env from version control

## Decisions Made
- errorMiddleware is the single catch boundary — no try/catch + next(err) in route handlers (Express 5 propagates async throws automatically)
- AppError subclasses define the error contract ahead of all service implementation
- express.json body parser limited to 1mb (ResumeStructure is JSON, not a file upload)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added .gitignore to prevent node_modules commits**
- **Found during:** Task 1 (error middleware commit)
- **Issue:** No .gitignore existed — first npm install caused node_modules to be committed with the task files
- **Fix:** Created .gitignore with node_modules, dist, .turbo, .env exclusions; node_modules removed from tracking
- **Files modified:** .gitignore (created)
- **Verification:** Subsequent commits show only source files, node_modules excluded
- **Committed in:** d1dea9d (separate chore commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Auto-fix necessary for basic repository hygiene. No scope creep.

## Issues Encountered
- node_modules were accidentally included in Task 1 commit due to missing .gitignore — resolved immediately with Rule 2 auto-fix (d1dea9d)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Error contract established: all Phase 2-5 services can import and throw AppError subclasses
- errorMiddleware registered in app shell — no changes needed to index.ts when routes are added in Phases 4-5
- Phase 2 (PDF Parsing) can begin — `PdfParseError` is ready for use in pdf.service.ts
- Phase 3 (OpenAI) can begin — `OpenAiTimeoutError` is ready for use in ai.service.ts

---
*Phase: 01-foundation*
*Completed: 2026-03-08*
