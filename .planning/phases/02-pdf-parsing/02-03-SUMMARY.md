---
phase: 02-pdf-parsing
plan: 03
subsystem: api
tags: [multer, express, middleware, file-upload, validation, magic-bytes]

# Dependency graph
requires:
  - phase: 02-pdf-parsing plan 02
    provides: PdfNotPdfError (415) and PdfTooLargeError (413) error classes in error.middleware.ts
provides:
  - uploadMiddleware — composable RequestHandler[] array ready to spread into any route definition
  - Two-layer PDF validation: MIME pre-filter via multer fileFilter + magic bytes check after buffer available
  - Size enforcement: 10MB cap via multer limits, mapped to PdfTooLargeError (413)
affects:
  - 02-05 (analyze route — consumes uploadMiddleware)
  - frontend error handling (INPUT-02, INPUT-03 error codes now wired up)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Composed middleware array pattern — uploadMiddleware as RequestHandler[] spread into routes, not a single handler
    - Two-layer file validation — MIME gate (fileFilter, cheap) then magic bytes gate (after buffer populated)
    - MulterError wrapping — catch-and-rethrow pattern converts library errors to domain errors at the boundary

key-files:
  created:
    - apps/api/src/middleware/upload.middleware.ts
    - apps/api/src/__tests__/upload.middleware.test.ts
  modified: []

key-decisions:
  - "fileFilter silently rejects non-PDF MIME (cb(null, false)) so validateMagicBytes owns the error message — avoids duplicate error paths"
  - "Magic bytes check is a separate RequestHandler (not inside fileFilter) because req.file.buffer is only available after multer runs"
  - "noUncheckedIndexedAccess required destructuring uploadMiddleware as typed tuple to avoid TypeScript errors in tests"

patterns-established:
  - "Middleware composition: export RequestHandler[] not a single handler — consumer does router.post('/path', ...uploadMiddleware, handler)"
  - "MIME-then-magic-bytes: MIME is cheap pre-filter, magic bytes is the authoritative check — spoofed MIME still caught"

requirements-completed: [INPUT-02, INPUT-03]

# Metrics
duration: 2min
completed: 2026-03-10
---

# Phase 2 Plan 03: Upload Middleware Summary

**Multer-based PDF upload middleware with two-layer validation — MIME pre-filter plus magic bytes check — producing differentiated 413/415 errors before any parsing begins**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T02:00:02Z
- **Completed:** 2026-03-10T02:01:48Z
- **Tasks:** 1 (TDD: RED then GREEN)
- **Files modified:** 2

## Accomplishments

- Created `uploadMiddleware` as a composable `RequestHandler[]` — two handlers that can be spread into any route
- Layer 1 wraps multer with memoryStorage and 10MB limit; converts `MulterError LIMIT_FILE_SIZE` to `PdfTooLargeError` (413)
- Layer 2 (`validateMagicBytes`) checks `%PDF` magic bytes after buffer is populated; throws `PdfNotPdfError` (415) for missing file, wrong MIME, or spoofed MIME with correct magic
- 7 unit tests covering all five scenarios: valid PDF, spoofed MIME, wrong magic bytes, no file, size limit

## Task Commits

Each task was committed atomically:

1. **Task 1: Write upload middleware test stubs then implement uploadMiddleware** - `d487d4a` (feat)

**Plan metadata:** (to be committed with SUMMARY and state updates)

_Note: TDD task — tests written first in RED state, then implementation to GREEN, typecheck auto-fixed test file import paths and noUncheckedIndexedAccess issues_

## Files Created/Modified

- `apps/api/src/middleware/upload.middleware.ts` — Exports `uploadMiddleware: RequestHandler[]` with wrapMulter and validateMagicBytes handlers
- `apps/api/src/__tests__/upload.middleware.test.ts` — 7 unit tests covering valid PDF, wrong magic bytes, missing file, MIME rejection, and error class contract

## Decisions Made

- fileFilter silently rejects non-PDF MIME (`cb(null, false)`) so validateMagicBytes owns the error message — avoids duplicate error paths and keeps fileFilter as a cheap first gate only
- Magic bytes check must be a separate RequestHandler (not inside fileFilter) because `req.file.buffer` is only populated after multer completes
- Test file required destructuring `uploadMiddleware` as a typed tuple to satisfy `noUncheckedIndexedAccess: true` in tsconfig.base.json

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript errors in test file from noUncheckedIndexedAccess**
- **Found during:** Task 1 (implementation GREEN phase, typecheck step)
- **Issue:** Array indexing with `uploadMiddleware[0]` and `uploadMiddleware[1]` returns `T | undefined` under `noUncheckedIndexedAccess: true`; import path missing `.js` extension for ESM NodeNext module resolution
- **Fix:** Destructured `uploadMiddleware` as a typed tuple `[RequestHandler, RequestHandler]`; added `.js` extension to error.middleware import
- **Files modified:** `apps/api/src/__tests__/upload.middleware.test.ts`
- **Verification:** `npm run typecheck --workspace=apps/api` exits 0; all 16 tests pass
- **Committed in:** `d487d4a` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - TypeScript type correctness)
**Impact on plan:** Fix was required for typecheck to pass — strict tsconfig settings caught real issues in test array access patterns. No scope creep.

## Issues Encountered

None beyond the TypeScript fix above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `uploadMiddleware` is ready to be consumed by Plan 02-05 (analyze route) via `router.post('/analyze', ...uploadMiddleware, handler)`
- Both INPUT-02 (non-PDF rejection with `pdf_not_pdf` 415) and INPUT-03 (size rejection with `pdf_too_large` 413) are satisfied
- No blockers — Plan 02-04 (pdf.service.ts) can proceed independently; Plan 02-05 wires both together

---
*Phase: 02-pdf-parsing*
*Completed: 2026-03-10*
