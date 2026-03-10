---
phase: 02-pdf-parsing
plan: "02"
subsystem: api
tags: [error-handling, typescript, vitest, tdd]

requires:
  - phase: 01-foundation
    provides: AppError base class and errorMiddleware in error.middleware.ts

provides:
  - Five differentiated PDF error classes exported from error.middleware.ts
  - PdfNotPdfError (415, pdf_not_pdf) — non-PDF file uploads
  - PdfTooLargeError (413, pdf_too_large) — files exceeding 10MB
  - PdfScannedError (422, pdf_scanned) — image-only PDFs with no text layer
  - PdfEncryptedError (422, pdf_encrypted) — password-protected PDFs
  - PdfCorruptError (422, pdf_corrupt) — corrupt or unreadable PDFs

affects:
  - 02-03-upload-middleware (imports PdfNotPdfError, PdfTooLargeError)
  - 02-04-pdf-service (imports PdfScannedError, PdfEncryptedError, PdfCorruptError)
  - Phase 6 frontend wizard (uses error codes to display targeted help messages)

tech-stack:
  added: []
  patterns:
    - "Each PDF failure mode maps to its own error class — one class per failure mode, never reuse codes"
    - "TDD red-green: tests written and confirmed failing before implementation"

key-files:
  created: []
  modified:
    - apps/api/src/middleware/error.middleware.ts
    - apps/api/src/__tests__/error-middleware.test.ts

key-decisions:
  - "Five distinct error codes (pdf_not_pdf, pdf_too_large, pdf_scanned, pdf_encrypted, pdf_corrupt) locked — frontend wizard depends on exact codes for targeted help messages"
  - "415 used for non-PDF (wrong media type), 413 for oversized (request entity too large), 422 for parseable-but-unusable PDFs — HTTP status codes accurately reflect failure semantics"

patterns-established:
  - "PDF error classes placed between PdfParseError and OpenAiTimeoutError in error.middleware.ts — logically grouped by domain"

requirements-completed: [INPUT-02, INPUT-03, INPUT-04, INPUT-05]

duration: 2min
completed: 2026-03-09
---

# Phase 2 Plan 02: Error Classes Summary

**Five differentiated PDF error classes (415/413/422) added to error.middleware.ts so upload and parsing services can throw specific codes the frontend wizard maps to targeted user help**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T21:57:31Z
- **Completed:** 2026-03-09T21:58:10Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Added five new exported error classes to `error.middleware.ts`, each extending AppError with the exact statusCode and code locked in CONTEXT.md
- Wrote failing tests first (RED), confirmed all 5 failed, then implemented classes (GREEN) — all 9 tests pass
- TypeScript typecheck exits 0 with zero errors
- Existing PdfParseError, OpenAiTimeoutError and AppError tests remain unmodified and green

## Task Commits

1. **Task 1: Add five PDF error classes (TDD red-green)** - `47c7494`

## Files Created/Modified

- `apps/api/src/middleware/error.middleware.ts` - Added PdfNotPdfError, PdfTooLargeError, PdfScannedError, PdfEncryptedError, PdfCorruptError after existing PdfParseError
- `apps/api/src/__tests__/error-middleware.test.ts` - Added `describe('PDF-specific error classes')` block with one test per new class

## Decisions Made

- HTTP status semantics matter: 415 (Unsupported Media Type) for non-PDF, 413 (Request Entity Too Large) for oversized, 422 (Unprocessable Entity) for all PDF content failures
- New classes inserted between PdfParseError and OpenAiTimeoutError to keep error classes grouped by domain

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-03 (upload middleware) can now `import { PdfNotPdfError, PdfTooLargeError }` from error.middleware.ts
- Plan 02-04 (PDF service) can now `import { PdfScannedError, PdfEncryptedError, PdfCorruptError }` from error.middleware.ts
- All error codes are finalized and locked — no changes needed before frontend integration

---
*Phase: 02-pdf-parsing*
*Completed: 2026-03-09*
