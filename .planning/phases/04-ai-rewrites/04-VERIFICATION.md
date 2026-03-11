---
phase: 04-ai-rewrites
verified: 2026-03-10T23:15:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 4: AI Rewrites Verification Report

**Phase Goal:** All resume bullets are rewritten by GPT-4o to improve keyword alignment without inventing false claims, and failures are recoverable without re-uploading
**Verified:** 2026-03-10T23:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | ai.service.ts is the only file that imports from the openai package | VERIFIED | Grep across all `.ts` files returns exactly one match: `apps/api/src/services/ai.service.ts` |
| 2  | rewriteBullet returns a RewrittenBullet with correct id, original, rewritten (trimmed), and approved:false | VERIFIED | Lines 104-109 of ai.service.ts; confirmed by ai.service.test.ts tests at lines 80-112 |
| 3  | The system prompt explicitly prohibits inventing metrics, percentages, timeframes, or technologies not in the original bullet | VERIFIED | SYSTEM_PROMPT at lines 59-68 contains "Do NOT invent" (rule 1) and "Do NOT mention any technology" (rule 2) |
| 4  | withRetry calls the underlying fn exactly 3 times on repeated transient failure before throwing | VERIFIED | withRetry loop runs for MAX_ATTEMPTS=3; test at line 158 asserts `mockCreate.toHaveBeenCalledTimes(3)` — PASS |
| 5  | withRetry waits 1000ms after attempt 1 and 2000ms after attempt 2 before retrying | VERIFIED | RETRY_DELAYS_MS=[1000,2000] at line 10; fake-timer test at lines 183-218 verifies call counts at each ms boundary — PASS |
| 6  | withRetry does not retry on permanent errors (400, 401) | VERIFIED | isTransient() excludes status 400/401; tests at lines 221-238 assert `mockCreate.toHaveBeenCalledTimes(1)` — PASS |
| 7  | A transient timeout from OpenAI surfaces as OpenAiTimeoutError (504, retryable:true) | VERIFIED | withRetry line 45-47 throws `new OpenAiTimeoutError()` on APIConnectionTimeoutError; error.middleware.ts line 53 passes `true` for retryable; route test at line 216-228 asserts status 504 and retryable:true — PASS |
| 8  | POST /api/analyze returns a rewrites array populated with one RewrittenBullet per bullet in the resume | VERIFIED | analyzeResume calls rewriteAllBullets (analysis.service.ts line 55); route awaits result (analyze.route.ts line 26); route test at line 197-214 asserts populated array — PASS |
| 9  | The rewrites array is empty only when the resume has no bullets (not hardcoded []) | VERIFIED | analyzeResume returns `rewrites` from rewriteAllBullets output (not literal `[]`); rewriteAllBullets iterates actual bullets via nested for-of loops — PASS |
| 10 | When ai.service throws OpenAiTimeoutError, POST /api/analyze responds 504 with retryable:true | VERIFIED | Route test at line 216-228 mocks rewriteAllBullets to reject with OpenAiTimeoutError and asserts 504/ai_timeout/retryable:true — PASS |
| 11 | Existing score, gaps, and resumeStructure fields are still present alongside rewrites in the response | VERIFIED | analyzeResume returns `{ score, gaps, rewrites, resumeStructure }` (line 56); route test at line 230-245 asserts all four fields — PASS |
| 12 | No try/catch added to the route handler — Express 5 propagates async throws automatically | VERIFIED | analyze.route.ts has no try/catch block; comment on line 17 explicitly documents this decision |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/services/ai.service.ts` | rewriteBullet, rewriteAllBullets, withRetry exports | VERIFIED | 127 lines; all three functions exported; SYSTEM_PROMPT constant exported; singleton OpenAI client with maxRetries:0; isTransient() with constructor.name check |
| `apps/api/src/__tests__/ai.service.test.ts` | Unit tests covering AI-01, AI-02, AI-03, AI-04 | VERIFIED | 241 lines; 10 tests across 4 describe blocks; all GREEN |
| `apps/api/src/services/analysis.service.ts` | analyzeResume calls rewriteAllBullets and returns populated rewrites | VERIFIED | 57 lines; async function; imports rewriteAllBullets from ai.service.js; assigns result to rewrites and returns it |
| `apps/api/src/__tests__/analyze.route.test.ts` | Integration tests for rewrites shape and AI timeout 504 response | VERIFIED | Two new tests added at lines 197-228; ai.service mocked so tests run without OPENAI_API_KEY |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `ai.service.ts` | `OpenAiTimeoutError` | `import from ../middleware/error.middleware.js` | WIRED | Line 4: import confirmed; line 47: `throw new OpenAiTimeoutError()` used in withRetry |
| `ai.service.ts` | openai npm package | `import OpenAI from 'openai'` | WIRED | Line 1: import present; line 90: `client.chat.completions.create(...)` called inside rewriteBullet |
| `analysis.service.ts` | `ai.service.ts` | `import { rewriteAllBullets } from './ai.service.js'` | WIRED | Line 2: import present; line 55: `await rewriteAllBullets(resume, jobDescription, gaps)` called and result assigned |
| `analyze.route.ts` | `analysis.service.ts` | `await analyzeResume` | WIRED | Line 6: import present; line 26: `await analyzeResume(resume, parsed.data.jobDescription)` — async call confirmed |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AI-01 | 04-01, 04-02 | System rewrites all resume bullets using GPT-4o to improve keyword alignment with the job description | SATISFIED | rewriteAllBullets iterates all sections/items/bullets via sequential for-of; integration test at line 197 verifies populated array with RewrittenBullet shape |
| AI-02 | 04-01 | AI rewrite prompt explicitly prohibits inventing metrics, percentages, timeframes, or technologies not present in the original bullet | SATISFIED | SYSTEM_PROMPT rules 1 and 2 contain the exact prohibitions; unit tests at lines 130-155 inspect the system message in mock call args |
| AI-03 | 04-01 | System retries failed OpenAI calls with exponential backoff (3 attempts) before surfacing an error | SATISFIED | withRetry loops MAX_ATTEMPTS=3 with RETRY_DELAYS_MS=[1000,2000]; fake-timer tests verify exact delay boundaries |
| AI-04 | 04-01, 04-02 | System surfaces an OpenAI timeout as a retriable error with a user-facing retry hint; analysis state is preserved so the user does not need to re-upload | SATISFIED | OpenAiTimeoutError has retryable:true and message "Your analysis is preserved — try again."; route returns 504 with retryable:true; integration test confirms |

No orphaned requirements: all four Phase 4 requirements (AI-01, AI-02, AI-03, AI-04) are claimed by plans and verified in code.

---

### Anti-Patterns Found

No anti-patterns detected in ai.service.ts, analysis.service.ts, or analyze.route.ts. No TODOs, FIXMEs, placeholder returns, stub handlers, or hardcoded empty arrays in production code paths.

---

### Human Verification Required

#### 1. Live GPT-4o Call Quality

**Test:** Start the API with a valid OPENAI_API_KEY, POST a real resume PDF with a targeted job description, inspect each element in the returned `rewrites` array.
**Expected:** Each rewritten bullet incorporates job-description keywords naturally without adding metrics, tools, or technologies not in the original text.
**Why human:** Prompt constraint compliance (AI-02) is a semantic judgment that cannot be verified by inspecting code or mock call args alone. The tests confirm the prohibitions are in the prompt string, but only a real GPT-4o call can verify the model respects them.

#### 2. User-Facing Retry Flow on Timeout

**Test:** Simulate or trigger a real OpenAI timeout (e.g., block network, or set OPENAI_TIMEOUT_MS to 1ms) and submit a request. Observe the response body.
**Expected:** Client receives `{ error: "ai_timeout", retryable: true, message: "AI service timed out. Your analysis is preserved — try again." }` and can retry without re-uploading the PDF.
**Why human:** The "analysis is preserved" guarantee depends on the frontend (Phase 6) holding state in memory across retry attempts. The backend correctly signals retryability, but the full round-trip user experience cannot be verified without the frontend.

---

### Gaps Summary

None. All automated checks pass. The phase goal is fully achieved at the API layer:

- GPT-4o rewrites every bullet via the constrained SYSTEM_PROMPT (AI-01, AI-02)
- Custom 3-attempt retry with 1s/2s backoff is implemented and tested (AI-03)
- Timeouts surface as `OpenAiTimeoutError` (504, retryable:true) with the preserve-state message (AI-04)
- The entire chain is wired: route -> analyzeResume -> rewriteAllBullets -> rewriteBullet -> OpenAI SDK
- 53/53 tests pass; 0 TypeScript errors

---

_Verified: 2026-03-10T23:15:00Z_
_Verifier: Claude (gsd-verifier)_
