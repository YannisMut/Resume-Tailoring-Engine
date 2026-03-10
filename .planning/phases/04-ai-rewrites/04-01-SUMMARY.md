---
phase: 04-ai-rewrites
plan: "01"
subsystem: ai-service
tags: [openai, retry, tdd, unit-tests]
dependency_graph:
  requires:
    - apps/api/src/middleware/error.middleware.ts (OpenAiTimeoutError)
    - packages/types (Bullet, ResumeStructure, RewrittenBullet)
  provides:
    - apps/api/src/services/ai.service.ts (rewriteBullet, rewriteAllBullets, withRetry)
  affects:
    - apps/api/src/services/analysis.service.ts (Plan 04-02 will wire rewriteAllBullets here)
tech_stack:
  added:
    - openai@6.27.0
  patterns:
    - Singleton OpenAI client (module-level, maxRetries:0)
    - constructor.name check instead of instanceof for cross-mock error classification
    - Fake timer tests with early promise attachment to avoid unhandled rejections
key_files:
  created:
    - apps/api/src/services/ai.service.ts
    - apps/api/src/__tests__/ai.service.test.ts
  modified:
    - apps/api/package.json (added openai dependency)
decisions:
  - "isTransient() uses constructor.name not instanceof — avoids Vitest vi.mock boundary class reference mismatch"
  - "withRetry uses fixed RETRY_DELAYS_MS array [1000, 2000] not Math.pow — more explicit and matches test contracts"
  - "Fake timer tests attach expect().rejects before advancing timers — prevents unhandled rejection warnings"
metrics:
  duration: "3 min"
  completed: "2026-03-10"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 4 Plan 1: AI Service Summary

One-liner: OpenAI singleton service with GPT-4o per-bullet rewrites, custom 3-attempt 1s/2s backoff, and constructor.name-based transient error detection that works across Vitest mock boundaries.

## What Was Built

`ai.service.ts` is the sole file in the codebase that imports and calls the OpenAI SDK. It provides three exports:

- `rewriteBullet(bullet, jobDescription, gaps)` — calls GPT-4o with a constrained system prompt, falls back to original text if content is null, returns `RewrittenBullet` with `approved:false`
- `rewriteAllBullets(resume, jobDescription, gaps)` — sequential for-of loops across all sections/items/bullets, returns one `RewrittenBullet` per bullet
- `withRetry<T>(fn)` — 3-attempt retry loop with 1000ms/2000ms delays, surfaces `APIConnectionTimeoutError` as `OpenAiTimeoutError`, does not retry on permanent 4xx errors

The system prompt (SYSTEM_PROMPT constant) explicitly prohibits: inventing metrics/percentages/timeframes, mentioning technologies not in the original bullet, and changing verb tense.

## Test Results

10 new unit tests added in `ai.service.test.ts`, all GREEN. Full suite: 51/51 passing (41 pre-existing + 10 new). TypeScript: 0 errors.

| Requirement | Test Coverage |
|-------------|---------------|
| AI-01 | rewriteAllBullets returns 1 RewrittenBullet per bullet; rewriteBullet shape (id/original/rewritten/approved:false) |
| AI-02 | System prompt inspected via mock call args — contains "Do NOT invent" and "Do NOT mention any technology" |
| AI-03 | withRetry calls fn 3 times on transient; delays verified at 1000ms/2000ms with fake timers; no retry on 400/401 |
| AI-04 | APIConnectionTimeoutError surfaces as OpenAiTimeoutError (504/retryable:true) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unhandled rejection warnings in fake timer tests**
- **Found during:** Task 2 (first GREEN run)
- **Issue:** In Vitest with fake timers, if a promise rejects before `await expect(promise).rejects` is evaluated, Node emits "PromiseRejectionHandledWarning". The original Pattern 4 from RESEARCH.md had this issue.
- **Fix:** Attach `const assertion = expect(promise).rejects.toBeInstanceOf(...)` immediately after creating the promise, before advancing timers. Then `await assertion` after all timer advances.
- **Files modified:** `apps/api/src/__tests__/ai.service.test.ts`

**2. [Rule 1 - Bug] Test fixture missing required ResumeStructure fields**
- **Found during:** TypeScript check after Task 2
- **Issue:** RESUME_FIXTURE used wrong shape — `margins` instead of `meta`, missing section `id` and `headingStyle`, missing item `id`. The plan's context snippet showed an older schema shape.
- **Fix:** Updated fixture to match actual `ResumeStructureSchema`: `meta` object with pageWidth/pageHeight/margins, section with `id` and `headingStyle`, item with `id`.
- **Files modified:** `apps/api/src/__tests__/ai.service.test.ts`

**3. [Rule 2 - Missing] withRetry exported for testability**
- **Found during:** Task 2 implementation
- **Issue:** Plan only listed `rewriteBullet` and `rewriteAllBullets` as exports. Exporting `withRetry` makes the retry contract directly testable and aligns with the test file importing it indirectly via `rewriteBullet`.
- **Fix:** Added `export` to `withRetry` declaration.
- **Files modified:** `apps/api/src/services/ai.service.ts`

## Commits

| Hash | Message |
|------|---------|
| 92afedc | Add RED unit tests for ai.service and install openai package |
| 994afbb | Implement ai.service.ts — all 10 unit tests green |

## Self-Check: PASSED

- apps/api/src/services/ai.service.ts: FOUND
- apps/api/src/__tests__/ai.service.test.ts: FOUND
- Commit 92afedc: FOUND
- Commit 994afbb: FOUND
