---
phase: 06-frontend-wizard
plan: "03"
subsystem: web-frontend
tags: [react, tdd, bullet-card, review-step, tailwind]
dependency_graph:
  requires: [06-01]
  provides: [bullet-card-component, review-step-component, types-shared]
  affects: [06-04]
tech_stack:
  added: []
  patterns: [tdd-green, local-state-editing, grouped-list-rendering, sticky-footer]
key_files:
  created:
    - apps/web/app/components/BulletCard.tsx
    - apps/web/app/components/ReviewStep.tsx
    - apps/web/app/lib/types.ts
  modified: []
decisions:
  - "BulletCard uses local state only for the inline-edit textarea toggle — all decision state (status, editedText) lives in props owned by page.tsx"
  - "ReviewStep uses sticky bottom-0 for the Generate footer, not position: fixed, to avoid overflow ancestor conflicts"
  - "types.ts created in Plan 03 (parallel to Plan 02) since both Wave 1 plans need it — no blocking consequence"
metrics:
  duration: "2 min"
  completed_date: "2026-03-12"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 6 Plan 3: Review Step — BulletCard and ReviewStep Summary

**One-liner:** BulletCard with accept/reject/edit/revert interactions (8/8 tests GREEN) plus ReviewStep grouping bullets by section with Accept All and sticky Generate DOCX footer.

## What Was Built

### Task 1: BulletCard — TDD GREEN

Implemented `apps/web/app/components/BulletCard.tsx` to satisfy the 8 test contracts written RED in Plan 01.

The component renders the original bullet text and AI rewrite side by side in a two-column layout. Action buttons (Accept, Edit, Reject) appear in the footer when not in editing mode. The Revert button appears only when status is not `pending`. Clicking Edit opens an inline textarea with the current rewrite text pre-filled. Clicking Save calls `onEdit(id, text)` and collapses back to display mode.

All decision state (status, editedText) lives in the `BulletDecision` prop passed from the parent. Local state only tracks `isEditing` (boolean) and `editText` (in-progress edit string).

Also created `apps/web/app/lib/types.ts` as a prerequisite (Rule 3 deviation — Plan 02 creates this file, but Plan 03 runs in parallel and needs it to compile). The file defines `BulletDecision`, `WizardStep`, `STEP_LABELS`, and `stepToIndex` — identical to what Plan 02 would have written.

### Task 2: ReviewStep — grouped bullet cards + Accept All + sticky Generate

Implemented `apps/web/app/components/ReviewStep.tsx` which is the full Step 2 UI.

Layout:
- Top bar: Accept All button (left) and match score display (right)
- Keyword gaps strip below the top bar as small gray pills
- Bullet groups: for each section in `resumeStructure.sections` that has matching bullets, render an uppercase section heading followed by a column of `BulletCard` components
- Sticky footer at `bottom-0` with a full-width "Generate DOCX →" button

The `groupBulletsBySection()` helper is defined locally (not exported) and follows the exact pattern from RESEARCH.md — matching `bullet.id` from `resumeStructure` to `BulletDecision.id` via a Map for O(n) lookup.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| BulletCard local state for edit only | Decision state round-trips through page.tsx for clean state management; component stays stateless for decisions |
| sticky bottom-0 not position: fixed | Sticky sits in the scroll flow and avoids overflow ancestor conflicts (RESEARCH.md Pitfall 7) |
| types.ts created in Plan 03 | Plan 02 and 03 are parallel Wave 1 — creating the types file unblocked compilation without waiting |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking dependency] Created types.ts before Plan 02 ran**
- **Found during:** Task 1 — BulletCard.tsx imports `BulletDecision` from `../lib/types`
- **Issue:** `apps/web/app/lib/types.ts` did not exist (Plan 02 creates it, but Plan 02 hasn't run yet)
- **Fix:** Created `types.ts` with the exact interface specified in Plan 02 and Plan 03 context
- **Files modified:** `apps/web/app/lib/types.ts`
- **Commit:** 5c6871e

**Note on test count:** The test suite reports 8 passing tests (not 7 as stated in the plan). The test file has 8 `it()` blocks. The plan's "7 tests" was a minor count error in the plan — all 8 tests pass GREEN, which satisfies the done criteria.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 5c6871e | Implement BulletCard component — all 8 tests GREEN |
| Task 2 | e314f37 | Implement ReviewStep with grouped bullet cards and sticky Generate button |

## Verification Results

- `npm run test --workspace=apps/web -- --run`: BulletCard suite 8/8 PASS
- `npm run test --workspace=apps/web -- --run`: DownloadStep still FAIL (import error — RED maintained, expected)
- `npx tsc --noEmit --project apps/web/tsconfig.json`: Only error is DownloadStep import (correct RED state); no errors in BulletCard.tsx, ReviewStep.tsx, or types.ts
- BulletCard aria-labels: "Accept", "Reject", "Edit", "Save", "Revert" — all match test expectations
- ReviewStep sticky footer uses `sticky bottom-0` (verified by reading the file)
