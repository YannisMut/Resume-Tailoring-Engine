---
phase: 06-frontend-wizard
verified: 2026-03-12T15:12:40Z
status: human_needed
score: 14/14 automated must-haves verified
re_verification: false
human_verification:
  - test: "Full wizard flow in the browser"
    expected: "Upload PDF + paste JD → loading screen → review bullets side-by-side → accept/reject/edit/revert → generate DOCX → download resume_tailored.docx"
    why_human: "End-to-end browser flow requires running both dev servers (port 3000 + 3001), network calls to the real OpenAI API, and confirming the downloaded DOCX opens correctly in Word/Google Docs. SUMMARY.md records human approval from the Plan 04 checkpoint, but this verification confirms the automated evidence — the browser session itself cannot be verified programmatically."
  - test: "LoadingStep persists during the full AI call duration (OUT-02)"
    expected: "Loading spinner remains visible for the entire 15–30 second AI call; it does not flash or disappear mid-request"
    why_human: "Timing behaviour during a live async operation cannot be asserted with grep. Code inspection confirms the loading step is set before fetch and cleared only on response, but the subjective 'no flash' quality needs a human eye."
  - test: "Tailwind v4 utility classes render correctly in the browser (no unstyled output)"
    expected: "Buttons, cards, and layout appear styled as designed — gray borders, green highlights on accepted bullets, red on rejected, sticky footer visible"
    why_human: "PostCSS config and globals.css import are verified, but CSS output rendering requires a browser."
---

# Phase 6: Frontend Wizard Verification Report

**Phase Goal:** Users can complete the full workflow — upload, paste a job description, review/edit rewrites, and download a DOCX — in a single browser session without losing state
**Verified:** 2026-03-12T15:12:40Z
**Status:** human_needed (all automated checks passed; 3 items need browser confirmation)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can upload a PDF and paste a job description in a two-column layout | ✓ VERIFIED | `UploadStep.tsx` grid layout, `DropZone.tsx` drag-and-drop, JD textarea with 5,000-char guard |
| 2 | Non-PDF files and oversized files show inline error in the drop zone | ✓ VERIFIED | `DropZone.tsx` client-side pre-validation uses `PDF_ERROR_MESSAGES`; red border class applied on error |
| 3 | Clicking Analyze Resume transitions to a loading state that persists until API responds | ✓ VERIFIED | `page.tsx` `submitAnalysis` sets `step.name='loading'` before fetch, clears only on response/error |
| 4 | User sees original and rewritten bullets side-by-side (REVIEW-01) | ✓ VERIFIED | `BulletCard.tsx` two-column grid; both `bullet.original` and `displayRewrite` rendered as `<p>` elements; 8 tests GREEN |
| 5 | Accept, Reject, Edit, and Revert interactions work on each bullet (REVIEW-02, REVIEW-04) | ✓ VERIFIED | `BulletCard.tsx` has all four handlers with correct `aria-label`s; all 8 unit tests pass |
| 6 | Bullet state (decisions + edited text) is preserved on DOCX generation failure (OUT-03) | ✓ VERIFIED | `generationError` is a separate `useState`; `result` and `bullets` live in `step` state and are not cleared on failure; `handleRetry` reuses same data |
| 7 | DOCX generates from approved bullets and downloads as `resume_tailored.docx` | ✓ VERIFIED | `generateDocx` posts to `/api/generate`, blob download pattern with `a.download = 'resume_tailored.docx'` |
| 8 | Step bar shows active step throughout the flow | ✓ VERIFIED | `StepBar.tsx` reads `currentStep` via `stepToIndex()`; mounted on every step render in `page.tsx` |
| 9 | JD textarea enforces 5,000-character max with character count display | ✓ VERIFIED | `UploadStep.tsx` `handleJdChange` guards `value.length <= 5000`; character count `<p>` below textarea |
| 10 | Error code → user message mapping is single source of truth in `lib/errors.ts` | ✓ VERIFIED | `PDF_ERROR_MESSAGES` with 7 entries; imported by `DropZone.tsx` and `page.tsx` |

**Score: 10/10 truths verified (automated)**

---

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `apps/web/postcss.config.mjs` | Tailwind v4 PostCSS plugin | ✓ VERIFIED | Contains `'@tailwindcss/postcss': {}` |
| `apps/web/app/globals.css` | `@import tailwindcss` | ✓ VERIFIED | Line 1: `@import "tailwindcss";` (v4 syntax, no v3 directives) |
| `apps/web/app/layout.tsx` | Imports globals.css | ✓ VERIFIED | Line 1: `import './globals.css';` |
| `apps/web/vitest.config.mts` | Vitest + React + jsdom | ✓ VERIFIED | `environment: 'jsdom'`, `globals: true`, both plugins present |
| `apps/web/app/lib/errors.ts` | `PDF_ERROR_MESSAGES` map (7 entries) | ✓ VERIFIED | All 7 error codes present |
| `apps/web/app/lib/types.ts` | `BulletDecision`, `WizardStep`, `stepToIndex` | ✓ VERIFIED | All exports present; discriminated union has 6 states |
| `apps/web/app/components/DropZone.tsx` | Drag-and-drop + client-side validation + inline error | ✓ VERIFIED | `onDragOver` calls `e.preventDefault()` + `e.stopPropagation()`; validates PDF type and size; error border class applied |
| `apps/web/app/components/UploadStep.tsx` | Two-column layout + JD textarea + submit | ✓ VERIFIED | Grid layout, JD textarea with 5,000-char guard, disabled submit when file or JD missing |
| `apps/web/app/components/LoadingStep.tsx` | Full-screen spinner + message (no timer) | ✓ VERIFIED | Spinner with `animate-spin`, message text; no internal timer logic |
| `apps/web/app/components/StepBar.tsx` | Step progress indicator | ✓ VERIFIED | Maps `STEP_LABELS`, active/past/future styling |
| `apps/web/app/components/BulletCard.tsx` | Accept/Reject/Edit/Revert interactions | ✓ VERIFIED | All 4 handlers wired; `aria-label`s match test expectations; 8/8 tests pass |
| `apps/web/app/components/ReviewStep.tsx` | Grouped bullet cards + Accept All + sticky Generate button | ✓ VERIFIED | `groupBulletsBySection` helper, `BulletCard` rendered per bullet, sticky footer with `sticky bottom-0` |
| `apps/web/app/components/DownloadStep.tsx` | Score/gap display + generating spinner + error/retry + download button | ✓ VERIFIED | All four display states implemented; 6/6 tests pass |
| `apps/web/app/page.tsx` | Complete wizard state machine | ✓ VERIFIED | All 5 step cases rendered; all bullet handlers wired; `generateDocx` with blob download; `'use client'` directive |
| `apps/web/next.config.ts` | API rewrites proxy | ✓ VERIFIED | `/api/:path*` → `http://localhost:3001/api/:path*` |
| `apps/web/__tests__/BulletCard.test.tsx` | 8 unit tests (GREEN) | ✓ VERIFIED | 8/8 passing |
| `apps/web/__tests__/DownloadStep.test.tsx` | 6 unit tests (GREEN) | ✓ VERIFIED | 6/6 passing |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/app/layout.tsx` | `apps/web/app/globals.css` | `import './globals.css'` | ✓ WIRED | Line 1 of layout.tsx |
| `apps/web/postcss.config.mjs` | `@tailwindcss/postcss` | plugins entry | ✓ WIRED | `'@tailwindcss/postcss': {}` present |
| `apps/web/next.config.ts` | `http://localhost:3001` | rewrites proxy | ✓ WIRED | `source: '/api/:path*'` → `destination: 'http://localhost:3001/api/:path*'` |
| `apps/web/app/page.tsx` | `/api/analyze` | `fetch` in `submitAnalysis` | ✓ WIRED | `fetch('/api/analyze', { method: 'POST', body: form })` with response handling |
| `apps/web/app/page.tsx` | `/api/generate` | `fetch` in `generateDocx` | ✓ WIRED | `fetch('/api/generate', { method: 'POST', ... })` with blob handling |
| `apps/web/app/components/DropZone.tsx` | `apps/web/app/lib/errors.ts` | `PDF_ERROR_MESSAGES` import | ✓ WIRED | `import { PDF_ERROR_MESSAGES } from '../lib/errors'` |
| `apps/web/app/page.tsx` | `apps/web/app/lib/types.ts` | `WizardStep` + `BulletDecision` imports | ✓ WIRED | `import type { BulletDecision, WizardStep } from './lib/types'` |
| `apps/web/app/components/ReviewStep.tsx` | `apps/web/app/components/BulletCard.tsx` | `BulletCard` render per bullet | ✓ WIRED | `import BulletCard from './BulletCard'`; rendered in `groups.map` |
| `apps/web/app/components/ReviewStep.tsx` | `apps/web/app/lib/types.ts` | `BulletDecision` import | ✓ WIRED | `import type { BulletDecision } from '../lib/types'` |
| `apps/web/app/page.tsx` | `apps/web/app/components/ReviewStep.tsx` | render when `step.name === 'review'` | ✓ WIRED | `{step.name === 'review' && <ReviewStep ... />}` with all 6 handlers |
| `apps/web/app/page.tsx` | `apps/web/app/components/DownloadStep.tsx` | render when `step.name === 'download'` | ✓ WIRED | `{step.name === 'download' && <DownloadStep ... />}` |
| `apps/web/app/components/DownloadStep.tsx` | `resume_tailored.docx` | programmatic anchor click on Blob URL | ✓ WIRED | `a.download = 'resume_tailored.docx'` in `generateDocx` in `page.tsx` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INPUT-06 | 06-01, 06-02 | User can paste or type a job description into a plain textarea | ✓ SATISFIED | `UploadStep.tsx` JD textarea with placeholder, 5,000-char max, character count display |
| REVIEW-01 | 06-01, 06-03, 06-04 | User sees original and rewritten bullets side-by-side | ✓ SATISFIED | `BulletCard.tsx` two-column grid; 8 tests confirm `bullet.original` and `displayRewrite` both rendered |
| REVIEW-02 | 06-01, 06-03, 06-04 | User can approve, reject, or inline-edit each rewritten bullet | ✓ SATISFIED | Accept/Reject/Edit buttons with correct handlers; Edit opens textarea; Save calls `onEdit`; all 8 tests pass |
| REVIEW-04 | 06-01, 06-03, 06-04 | User can revert any rewritten bullet to original with one click | ✓ SATISFIED | Revert button visible when `status !== 'pending'`; `handleRevert` uses omit pattern for `exactOptionalPropertyTypes`; test confirms behaviour |
| OUT-02 | 06-01, 06-02, 06-04 | System shows processing indicator during AI call (15–30s) | ✓ SATISFIED | `LoadingStep.tsx` mounted for `step.name === 'loading'`; set before fetch, cleared only on resolution; text "This takes about 15–30 seconds" present |
| OUT-03 | 06-01, 06-04 | If DOCX generation fails, analysis state preserved for retry | ✓ SATISFIED | `generationError` is separate state; `step.result` and `step.bullets` persist; `handleRetry` reuses same data without re-fetching analyze |

All 6 requirement IDs declared across the 4 plans are accounted for. No orphaned requirements — REQUIREMENTS.md maps INPUT-06, REVIEW-01, REVIEW-02, REVIEW-04, OUT-02, OUT-03 to Phase 6, and all are covered.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `apps/web/app/page.tsx` line 162 | `[step.name === 'download']` as `useEffect` dependency — this is a boolean expression, not a stable reference. React will re-run the effect whenever `step` changes if the boolean flips, but the eslint-disable comment acknowledges the intent. Functionally correct for the single-transition case. | ℹ️ Info | No user-visible bug; effect fires once on step transition as intended |

No blocker or warning-level anti-patterns found. No TODO/FIXME/placeholder comments in production code. No empty return values in any component.

---

### Human Verification Required

#### 1. Full End-to-End Wizard Flow

**Test:** Start both dev servers (`npm run dev --workspace=apps/api` and `npm run dev --workspace=apps/web`). Open `http://localhost:3000`. Upload a real PDF resume, paste a job description, click Analyze, wait through the loading state, then review bullets (accept one, reject one, edit one, revert one), click Generate DOCX, and download.

**Expected:** Each step transitions correctly. The loading state is visible for the full AI call duration. Bullet status changes are reflected visually. The downloaded file is named `resume_tailored.docx` and opens in Word or Google Docs with the approved bullet text.

**Why human:** Live network calls, timing of async states, and DOCX file content validation require running both servers and a real browser session. The SUMMARY.md for Plan 04 records human approval from the checkpoint — this is documentation of that signal.

#### 2. Processing Indicator Persistence (OUT-02)

**Test:** During the full AI call (approximately 15–30 seconds), confirm the loading spinner stays on screen without flickering or disappearing mid-request.

**Expected:** LoadingStep remains mounted for the entire fetch duration.

**Why human:** Timing behaviour cannot be asserted with static analysis. Code confirms the correct pattern (set loading before fetch, clear only on response), but subjective persistence needs human observation.

#### 3. Tailwind v4 Rendered Styles

**Test:** Confirm buttons, bullet cards, and the step bar appear styled — green backgrounds on accepted bullets, red on rejected, sticky Generate footer visible without scrolling on a typical screen.

**Expected:** All Tailwind utility classes resolve correctly; no unstyled HTML.

**Why human:** PostCSS config and CSS import are verified, but actual CSS output requires a browser render pass.

---

### Automated Test Results

```
2 test files | 14 tests | 14 passed | 0 failed
  BulletCard.test.tsx — 8/8 PASS
  DownloadStep.test.tsx — 6/6 PASS
TypeScript: npx tsc --noEmit exits 0 (no errors)
```

---

### Notable Deviation from Plan (Documented, Non-Blocking)

The plan's `BulletCard.tsx` template used a `<button>` element to display the rewrite text (clicking the text would open edit mode). The actual implementation uses a `<p>` element for display and a separate "Edit" `<button>`. This satisfies all 8 tests (which only verify that the Edit button triggers the textarea, not that clicking the rewrite text itself triggers it). The behaviour is functionally equivalent and arguably cleaner UX.

---

## Summary

Phase 6 goal is achieved: all 10 observable truths are verified in the codebase, all 17 artifacts exist and are substantive, all 12 key links are wired, all 6 requirement IDs are satisfied, and 14/14 automated tests pass. TypeScript is clean. Three items are flagged for human verification — all relate to browser-rendered behaviour (visual styles, live API timing, DOCX content) that cannot be confirmed programmatically. The SUMMARY.md for Plan 04 documents that a human end-to-end checkpoint was completed and approved.

---

_Verified: 2026-03-12T15:12:40Z_
_Verifier: Claude (gsd-verifier)_
