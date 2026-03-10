---
phase: 02-pdf-parsing
plan: "04"
subsystem: api
tags: [pdfjs-dist, pdf-parsing, text-extraction, y-proximity-clustering, zod-validation]

requires:
  - phase: 02-pdf-parsing plan 01
    provides: ResumeStructureSchema, HeaderLine, TextStyle, Section, SectionItem, Bullet types
  - phase: 02-pdf-parsing plan 02
    provides: PdfEncryptedError, PdfScannedError, PdfCorruptError error classes

provides:
  - "parsePdf(buffer: Buffer): Promise<ResumeStructure> — validated PDF-to-structure extraction"
  - "Y-proximity line clustering algorithm (LINE_Y_TOLERANCE=2.0pt)"
  - "Font normalization with ABCDEF+ subset prefix stripping and bold/italic detection"
  - "Heading detection via fontSize >= 1.2x median body font size"
  - "Header block capture (pre-heading lines) in ResumeStructure.header"
  - "Bullet ID generation: {section-slug}-{sectionIdx}-item-{itemIdx}-bullet-{bulletIdx}"

affects:
  - "02-05: analyze route imports parsePdf from this service"
  - "Phase 5 DOCX generation: reads TextStyle values produced here"

tech-stack:
  added: []
  patterns:
    - "pdfjs-dist loaded with GlobalWorkerOptions.workerSrc = '' for Node.js (no worker thread)"
    - "Error detection by err.name string check (PasswordException, InvalidPDFException) not instanceof"
    - "marginLeft derived from heading X positions — more stable than body text which is often indented"
    - "Font fallback returns full FONT_FALLBACK (Calibri/22/false/false/#000000) when fontName absent"

key-files:
  created:
    - apps/api/src/services/pdf.service.ts
  modified:
    - apps/api/src/__tests__/pdf.service.test.ts

key-decisions:
  - "marginLeft is derived from the minimum X of heading lines, not body lines — headings anchor to page margin"
  - "Font fallback uses literal FONT_FALLBACK values (not the item's actual height) for missing fontName — preserves spec contract"
  - "Test module isolation: static import at top-level instead of vi.resetModules() per test — avoids instanceof failures across module reload boundaries"

patterns-established:
  - "pdfjs-dist: use name-based error detection (err.name === 'PasswordException') not instanceof — PasswordException is not exported"
  - "Zod validation as the final gate: ResumeStructureSchema.parse() catches any structural inconsistency before returning"
  - "Two-pass layout analysis: first pass clusters lines, second pass classifies using computed median height"

requirements-completed: [INPUT-01, INPUT-04, INPUT-05]

duration: 12min
completed: 2026-03-10
---

# Phase 2 Plan 04: PDF Service Summary

**parsePdf() service using pdfjs-dist Y-proximity clustering, heading-based font classification, and Zod-validated ResumeStructure output — with full error handling for encrypted, scanned, and corrupt PDFs**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-10T17:24:00Z
- **Completed:** 2026-03-10T17:36:01Z
- **Tasks:** 2 (Task 1 was already committed; Task 2 implemented and tested)
- **Files modified:** 2

## Accomplishments

- parsePdf() service correctly extracts text from PDF buffers and returns validated ResumeStructure
- All 5 error cases handled: encrypted, scanned, corrupt (via InvalidPDFException), corrupt (no bullets), corrupt (Zod validation fail)
- Y-proximity clustering groups text items into logical lines at 2.0pt tolerance
- Heading detection by font size ratio (1.2x median) classifies section structure
- Font fallback (Calibri/22 half-pts) applied when PDF font metadata is missing — parsing succeeds instead of throwing
- 22/22 tests pass, zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Install pdfjs-dist@5.5.207** - `0d9482d` (chore) — committed in prior session
2. **Task 2: Write tests + implement parsePdf** - `2552cc0` (feat/fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/api/src/services/pdf.service.ts` — Core parsePdf() implementation with Y-proximity clustering, heading classification, font normalization, and Zod validation
- `apps/api/src/__tests__/pdf.service.test.ts` — 6 unit tests covering all error paths and happy path; fixed to use static imports for correct instanceof behavior

## Decisions Made

- marginLeft is anchored to heading X positions (not body text) because headings are flush to the left margin while body/bullet text is indented
- Font fallback uses the literal FONT_FALLBACK constants rather than converting the actual item height — matches the spec ("Calibri/22 half-points") and keeps behavior predictable
- Tests use top-level static import of parsePdf (not vi.resetModules() per test) to prevent instanceof failures caused by different module instances

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed marginLeft calculation inflating indent threshold**
- **Found during:** Task 2 (running test suite)
- **Issue:** Original code computed marginLeft from all non-heading lines including pre-heading header lines (e.g. "John Doe" at x=100). This pushed marginLeft up to 90, making the actual bullet at x=90 appear flush-left and thus not a bullet.
- **Fix:** Changed marginLeft to use the minimum X of heading lines only — headings are reliably aligned to the page left margin.
- **Files modified:** apps/api/src/services/pdf.service.ts
- **Verification:** "valid PDF" test passes (1 section, header detected, bullet detected)
- **Committed in:** 2552cc0

**2. [Rule 1 - Bug] Fixed font fallback using actual item height instead of spec constant**
- **Found during:** Task 2 (font-fallback test failure: expected 22, got 28)
- **Issue:** Fallback code returned `{ ...FONT_FALLBACK, fontSize: Math.round(heightPts * 2) }` which overrode the spec-defined 22 with the actual item height (14 pts → 28 half-pts).
- **Fix:** Return `{ ...FONT_FALLBACK }` without overriding fontSize.
- **Files modified:** apps/api/src/services/pdf.service.ts
- **Verification:** font-fallback test passes with fontSize=22
- **Committed in:** 2552cc0

**3. [Rule 1 - Bug] Fixed test instanceof failures from vi.resetModules()**
- **Found during:** Task 2 (all 6 pdf.service tests failing with instanceof mismatch)
- **Issue:** The test file used `vi.resetModules()` in beforeEach combined with per-test `await import('../services/pdf.service.js')`. This caused the service to load a fresh copy of error.middleware.js on each test, so the thrown PdfEncryptedError/etc came from different class instances than the top-level imports.
- **Fix:** Added top-level `import { parsePdf }` and removed vi.resetModules() — vi.clearAllMocks() between tests is sufficient since the getDocument mock is reassigned per test.
- **Files modified:** apps/api/src/__tests__/pdf.service.test.ts
- **Verification:** All 6 pdf.service tests pass with correct instanceof checks
- **Committed in:** 2552cc0

---

**Total deviations:** 3 auto-fixed (all Rule 1 bugs)
**Impact on plan:** All three bugs were pre-existing in the files created before this execution session. Fixes were necessary for the tests to pass and the service to behave correctly. No scope creep.

## Issues Encountered

None beyond the three auto-fixed bugs above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- parsePdf() is ready to be imported by the analyze route (Plan 02-05): `import { parsePdf } from '../services/pdf.service.js'`
- The service validates output with ResumeStructureSchema.parse() before returning, so callers can trust the shape
- Error classes (PdfEncryptedError, PdfScannedError, PdfCorruptError) are thrown with the correct HTTP status codes and error codes for the frontend wizard

## Self-Check: PASSED

- apps/api/src/services/pdf.service.ts: FOUND
- apps/api/src/__tests__/pdf.service.test.ts: FOUND
- .planning/phases/02-pdf-parsing/02-04-SUMMARY.md: FOUND
- Commit 2552cc0: FOUND
- Commit 0d9482d: FOUND

---
*Phase: 02-pdf-parsing*
*Completed: 2026-03-10*
