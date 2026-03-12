---
phase: 06-frontend-wizard
plan: 04
subsystem: ui
tags: [react, nextjs, typescript, vitest, testing-library, docx]

# Dependency graph
requires:
  - phase: 06-02
    provides: UploadStep, LoadingStep, StepBar, WizardStep types, BulletDecision types, PDF_ERROR_MESSAGES
  - phase: 06-03
    provides: ReviewStep, BulletCard, DownloadStep test stubs (RED)
provides:
  - DownloadStep component (score/gaps display, generating spinner, error/retry, download button)
  - Complete page.tsx wizard orchestration (upload → loading → review → download)
  - All bullet decision handlers (accept, reject, edit, revert, acceptAll) wired in page.tsx
  - generateDocx function (POST /api/generate, Blob download as resume_tailored.docx)
  - OUT-03 compliance: generation failure preserves score, gaps, and bullet decisions for retry
affects: [06-frontend-wizard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Download step state (generating/downloadReady/generationError) kept separate from WizardStep discriminated union to avoid re-mounting DownloadStep on retry
    - useEffect with step.name === 'download' as dependency auto-fires generateDocx on step transition
    - handleRevert uses destructured omit pattern instead of editedText: undefined to satisfy exactOptionalPropertyTypes

key-files:
  created:
    - apps/web/app/components/DownloadStep.tsx
  modified:
    - apps/web/app/page.tsx

key-decisions:
  - "DownloadStep error message text must not be duplicated — component renders generationError prop directly without appending extra 'preserved' span, since the error string from page.tsx already contains the full message"
  - "handleRevert omits editedText from spread rather than setting it to undefined — required by exactOptionalPropertyTypes in tsconfig"
  - "Download state (generating/downloadReady/generationError) lives outside WizardStep so Retry can call generateDocx without changing step and re-mounting the component"

patterns-established:
  - "Blob download pattern: fetch → blob() → URL.createObjectURL → anchor.click() → revokeObjectURL"
  - "Auto-trigger side effects on step arrival via useEffect with step.name === 'stepname' dependency"

requirements-completed: [REVIEW-01, REVIEW-02, REVIEW-04, OUT-02, OUT-03]

# Metrics
duration: 5min
completed: 2026-03-12
---

# Phase 6 Plan 04: DownloadStep + Full Wizard Wiring Summary

**DownloadStep component built (6/6 tests green) and full wizard wired in page.tsx — ReviewStep + DownloadStep rendering with all bullet handlers and DOCX Blob download; stopped at human end-to-end verification checkpoint**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-12T05:10:00Z
- **Completed:** 2026-03-12T05:13:22Z (paused at checkpoint Task 3)
- **Tasks:** 2 of 3 complete (Task 3 is human-verify checkpoint)
- **Files modified:** 2

## Accomplishments
- Created DownloadStep.tsx — score/gap display always visible, spinner on generating, error+retry UI, download button
- All 6 DownloadStep tests green; all 8 BulletCard tests remain green (14 total)
- Replaced placeholder divs in page.tsx with real ReviewStep and DownloadStep components
- Implemented all five bullet decision handlers: accept, reject, edit, revert, acceptAll
- generateDocx: POSTs /api/generate, downloads response blob as resume_tailored.docx
- OUT-03: generation errors do NOT clear bullet/result state — Retry reuses same data
- TypeScript clean (exactOptionalPropertyTypes handled in handleRevert)

## Task Commits

1. **Task 1: DownloadStep — implement to GREEN** - `0084678` (feat)
2. **Task 2: Wire all step components into page.tsx** - `34b0c30` (feat)
3. **Task 3: Human verify** — awaiting human checkpoint

## Files Created/Modified
- `apps/web/app/components/DownloadStep.tsx` — Step 3 UI: score/gaps panel, spinner, error/retry, download button
- `apps/web/app/page.tsx` — Complete wizard orchestration with ReviewStep, DownloadStep, all handlers, generateDocx

## Decisions Made
- DownloadStep renders `generationError` prop directly without appending extra text — the error string from page.tsx already contains "Your edits are preserved". Appending a span caused duplicate `/preserved/i` match in tests.
- `handleRevert` uses destructuring omit (`const { editedText: _omit, ...rest } = b`) instead of `editedText: undefined` — TypeScript `exactOptionalPropertyTypes` rejects explicit undefined on optional fields.
- Download state (generating/downloadReady/generationError) lives in separate useState rather than WizardStep — allows DownloadStep to stay mounted during retry without re-triggering the auto-generate useEffect.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Duplicate "preserved" text caused test failure**
- **Found during:** Task 1 (DownloadStep implementation)
- **Issue:** The plan's example code appended a `<span>Your edits are preserved</span>` after `{generationError}`, but the test passes the full message "DOCX generation failed. Your edits are preserved — try again." as the prop — rendering it twice made `getByText(/preserved/i)` throw "Found multiple elements"
- **Fix:** Removed the extra span; DownloadStep renders `{generationError}` directly
- **Files modified:** apps/web/app/components/DownloadStep.tsx
- **Verification:** All 6 DownloadStep tests passed
- **Committed in:** `0084678` (Task 1 commit)

**2. [Rule 1 - Bug] exactOptionalPropertyTypes TS error in handleRevert**
- **Found during:** Task 2 (page.tsx implementation)
- **Issue:** `{ ...b, status: 'pending', editedText: undefined }` is rejected when `exactOptionalPropertyTypes: true` — cannot assign `undefined` to an optional property declared as `string?` (not `string | undefined`)
- **Fix:** Used destructuring omit: `const { editedText: _omit, ...rest } = b; return { ...rest, status: 'pending' }`
- **Files modified:** apps/web/app/page.tsx
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `34b0c30` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs)
**Impact on plan:** Both fixes were necessary for correctness. No scope creep.

## Issues Encountered
None beyond the two auto-fixed bugs above.

## Next Phase Readiness
- Automated test suite: 14/14 green
- TypeScript: clean
- Pending: human end-to-end browser verification (Task 3 checkpoint)
- Once human approves, Phase 6 frontend wizard is complete and ready for Phase 7

---
*Phase: 06-frontend-wizard*
*Completed: 2026-03-12 (partial — awaiting human verify)*
