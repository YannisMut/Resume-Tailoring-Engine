---
phase: 06-frontend-wizard
plan: "02"
subsystem: web-frontend
tags: [react, tailwind, drag-and-drop, wizard, state-machine, upload]
dependency_graph:
  requires: [06-01]
  provides: [wizard-state-machine, upload-step, loading-step, drop-zone, step-bar, shared-types]
  affects: [06-03, 06-04]
tech_stack:
  added: []
  patterns: [discriminated-union-state-machine, html5-drag-drop, client-side-pre-validation, formdata-multipart]
key_files:
  created:
    - apps/web/app/lib/types.ts
    - apps/web/app/components/StepBar.tsx
    - apps/web/app/components/LoadingStep.tsx
    - apps/web/app/components/DropZone.tsx
    - apps/web/app/components/UploadStep.tsx
  modified:
    - apps/web/app/page.tsx
decisions:
  - "WizardStep is a discriminated union on name — review/generating/download carry result and bullets so child components get full context without prop drilling from page.tsx"
  - "DropZone manages localError separately from apiError — client-side validation errors are local state, server errors flow in via the error prop"
  - "stepToIndex helper centralises step-to-progress-bar mapping — loading maps to 0 (Upload), generating maps to 1 (Review)"
metrics:
  duration: "3 min"
  completed_date: "2026-03-12"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
---

# Phase 6 Plan 2: Upload Step + Wizard State Machine Summary

**One-liner:** WizardStep discriminated union state machine in page.tsx driving DropZone + JD textarea upload step with HTML5 drag-and-drop, client-side pre-validation, and API error code mapping.

## What Was Built

### Task 1: Shared types + StepBar + LoadingStep + DropZone

Created the type contracts that all downstream plans (03, 04) depend on. `BulletDecision` extends `RewrittenBullet` with a `status` field (`pending | approved | rejected | edited`) and optional `editedText` for inline editing. `WizardStep` is a discriminated union on `name` — the `review`, `generating`, and `download` variants carry `result` and `bullets` so child components have full context without extra state.

`StepBar` renders a horizontal 3-step progress bar (Upload → Review → Download) using Tailwind classes. Active step has dark text + underline; past steps are gray; future steps are lighter gray. No clickable navigation per CONTEXT.md.

`LoadingStep` renders a centered animate-spin spinner with "Analyzing your resume..." and a 15–30 second wait message. No timeout logic — page.tsx drives when the loading state ends.

`DropZone` handles HTML5 drag-and-drop events (`onDragOver` calls `e.preventDefault()` + `e.stopPropagation()` so the drop event fires), file picker via a hidden `<input type="file">`, and three visual states: default dashed border, file-selected with green checkmark, and error with red border. Client-side pre-validation checks `.pdf` extension + file type and size (10MB limit) before calling `onFile` — uses `PDF_ERROR_MESSAGES` from `lib/errors.ts` for error text. The `error` prop from the parent (API errors) and local state (client validation errors) are merged into a single `displayError`.

### Task 2: UploadStep + page.tsx wizard state machine

`UploadStep` is a two-column layout (responsive: single column on mobile, two-column on md+). Left column holds `DropZone` with a "Your Resume" label. Right column holds a JD textarea with `maxLength` guard (onChange rejects updates beyond 5,000 chars) and a live character counter below. The submit button is disabled when either input is missing and uses a dark/hover style when active.

`page.tsx` replaces the placeholder Home component with a `'use client'` wizard. State is two variables: `step: WizardStep` (starts at `{ name: 'upload' }`) and `apiError: string | null`. `submitAnalysis` sets `loading` step before the fetch, uses FormData (no manual Content-Type), parses the API error code and maps it through `PDF_ERROR_MESSAGES`, and on success builds the `BulletDecision[]` array from `result.rewrites` (all starting as `pending`). Review and Download steps render placeholder divs until Plans 03 and 04 fill them in.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Discriminated union on name for WizardStep | TypeScript narrows the type in each branch — review/generating/download automatically have result and bullets without casting |
| DropZone localError + error prop merged | Client-side errors (wrong type, too large) clear when user selects a new file; API errors clear when parent calls onResetApiError — separating them avoids double-clearing logic |
| stepToIndex: loading → 0, generating → 1 | The StepBar stays on "Upload" during the initial AI call and on "Review" during DOCX generation — logically correct from the user's perspective |

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | a62ea10 | Add shared types, StepBar, LoadingStep, and DropZone for wizard step 1 |
| Task 2 | a8c483c | Build UploadStep two-column layout and page-level wizard state machine |

## Verification Results

- `npx tsc --noEmit --project apps/web/tsconfig.json` has only the pre-existing DownloadStep RED stub error — all new files are type-clean
- `npm run test --workspace=apps/web -- --run` shows 1 failed (DownloadStep RED — expected), 8 passed
- `apps/web/app/page.tsx` starts with `'use client'` at line 1
- `apps/web/app/components/DropZone.tsx` calls `e.preventDefault()` in `handleDragOver` (line 40) and `handleDrop` (line 52)
- `apps/web/next.config.ts` rewrites proxy from Plan 01 means `/api/analyze` fetch routes to `http://localhost:3001/api/analyze`
