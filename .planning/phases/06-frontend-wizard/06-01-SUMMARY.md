---
phase: 06-frontend-wizard
plan: "01"
subsystem: web-frontend
tags: [tailwind, vitest, testing, tdd, api-proxy]
dependency_graph:
  requires: []
  provides: [tailwind-v4-css, vitest-test-infra, api-proxy, error-messages, red-test-stubs]
  affects: [06-02, 06-03, 06-04]
tech_stack:
  added: [tailwindcss@4, "@tailwindcss/postcss", postcss, vitest@4, "@vitejs/plugin-react", jsdom, "@testing-library/react", "@testing-library/user-event", vite-tsconfig-paths]
  patterns: [tailwind-v4-zero-config, jsdom-environment, tdd-red-stubs]
key_files:
  created:
    - apps/web/postcss.config.mjs
    - apps/web/app/globals.css
    - apps/web/vitest.config.mts
    - apps/web/app/lib/errors.ts
    - apps/web/__tests__/BulletCard.test.tsx
    - apps/web/__tests__/DownloadStep.test.tsx
  modified:
    - apps/web/package.json
    - apps/web/app/layout.tsx
    - apps/web/next.config.ts
decisions:
  - "Tailwind v4 zero-config: @import tailwindcss in globals.css, no tailwind.config.js needed"
  - "Next.js rewrites proxy eliminates hardcoded port 3001 from all component fetch calls"
  - "RED stubs fail on import (not assertion) — strongest possible test contract before implementation"
  - "PDF_ERROR_MESSAGES is the single source of truth for error code to user message mapping"
metrics:
  duration: "2 min"
  completed_date: "2026-03-12"
  tasks_completed: 2
  files_created: 6
  files_modified: 3
---

# Phase 6 Plan 1: Frontend Foundation — Tailwind v4, Vitest, API Proxy, RED Stubs Summary

**One-liner:** Tailwind v4 via PostCSS plugin + Vitest jsdom suite + Next.js API proxy rewrites + RED test contracts for BulletCard and DownloadStep components.

## What Was Built

Wave 0 foundation for the frontend wizard. All subsequent plans depend on this infrastructure being in place before any component is built.

### Task 1: Tailwind v4, Vitest, API proxy

Installed Tailwind CSS v4 using the new PostCSS plugin approach (`@tailwindcss/postcss`). Created `postcss.config.mjs`, `app/globals.css` with `@import "tailwindcss"` (v4 syntax — not the v3 `@tailwind base/components/utilities` directives), and wired it into `app/layout.tsx`. No `tailwind.config.js` needed — v4 uses zero-config content detection.

Installed Vitest with React, jsdom, and vite-tsconfig-paths support. Created `vitest.config.mts` with `environment: 'jsdom'` and `globals: true`. Added `"test": "vitest run"` to the web app's package scripts.

Updated `next.config.ts` with an async `rewrites()` function that proxies `/api/:path*` to `http://localhost:3001/api/:path*`. All component fetch calls can now use `/api/...` without hardcoding port 3001.

### Task 2: RED test stubs + lib/errors.ts

Created `app/lib/errors.ts` with the `PDF_ERROR_MESSAGES` constant — a Record mapping 7 error codes (`pdf_not_pdf`, `pdf_too_large`, `pdf_scanned`, `pdf_encrypted`, `pdf_corrupt`, `jd_too_long`, `unknown`) to user-readable messages. This is the single source of truth; frontend components import from here rather than hardcoding strings.

Wrote RED test stubs for two components (which do not exist yet):

- `__tests__/BulletCard.test.tsx`: 7 test cases covering renders original/rewritten text, Accept/Reject/Revert button calls, Edit mode with textarea, and Save with new text.
- `__tests__/DownloadStep.test.tsx`: 6 test cases covering generating loading state, Download button when ready, error message + Retry button, onRetry call, score visibility on error, gaps visibility on error.

Both test files fail immediately with `Failed to resolve import` — the correct RED state confirming these are real contracts, not implementation-coupled tests.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Tailwind v4 zero-config (no tailwind.config.js) | v4 detects content automatically; `@import "tailwindcss"` is the only setup needed |
| Next.js rewrites proxy at /api/* | Eliminates hardcoded port 3001 from all future component code; single config point |
| RED stubs fail on import, not assertion | Strongest guarantee — the contract is written before any implementation touches these files |
| PDF_ERROR_MESSAGES as single source of truth | Prevents message drift between backend error codes and frontend display strings |

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | f0eea87 | Set up Tailwind v4, Vitest, and API proxy for the web app |
| Task 2 | 25a0ba4 | Add RED test stubs for BulletCard and DownloadStep, plus error message map |

## Verification Results

- `postcss.config.mjs` has `@tailwindcss/postcss` plugin (not `tailwindcss`)
- `app/globals.css` has `@import "tailwindcss"` (v4 syntax)
- `app/layout.tsx` imports `./globals.css`
- `next.config.ts` has `rewrites()` proxy to `http://localhost:3001`
- `app/lib/errors.ts` has `PDF_ERROR_MESSAGES` with 7 entries
- `npm run test --workspace=apps/web -- --run` exits FAIL with import errors for BulletCard and DownloadStep (RED state confirmed)
- Vitest runner finds and attempts test files correctly (infrastructure working)
