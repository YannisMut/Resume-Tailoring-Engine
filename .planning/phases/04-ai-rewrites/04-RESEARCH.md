# Phase 4: AI Rewrites - Research

**Researched:** 2026-03-10
**Domain:** OpenAI Node.js SDK, retry/timeout patterns, prompt engineering for constrained rewrites
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AI-01 | System rewrites all resume bullets using GPT-4o to improve keyword alignment with the job description | OpenAI SDK chat.completions.create; batch-per-section vs per-bullet strategy documented below |
| AI-02 | AI rewrite prompt explicitly prohibits inventing metrics, percentages, timeframes, or technologies not present in the original bullet | System prompt constraint pattern documented; GPT-4o follows negative instruction lists reliably when stated explicitly |
| AI-03 | System retries failed OpenAI calls with exponential backoff (3 attempts) before surfacing an error | SDK built-in maxRetries applies to transient codes; custom wrapper gives exact 1s/2s/4s backoff with correct error classification |
| AI-04 | System surfaces an OpenAI timeout as a retriable error with a user-facing retry hint; analysis state is preserved so the user does not need to re-upload | OpenAiTimeoutError already defined (504/retryable:true); stateless round-trip design in AnalysisResult means resumeStructure+score+gaps survive partial failure |
</phase_requirements>

---

## Summary

Phase 4 adds `ai.service.ts` as the single file that calls OpenAI, wires it into the existing `/api/analyze` route (or a new `/api/rewrite` route — see Architecture Patterns), and returns `RewrittenBullet[]` that fills the currently-empty `rewrites` field of `AnalysisResult`. The project already has all supporting infrastructure in place: `OpenAiTimeoutError` (504/retryable), `RewrittenBullet` Zod schema, `AnalysisResult.rewrites: []` placeholder, and the stateless round-trip design that preserves analysis state across failures.

The OpenAI npm package is at v6.27.0 (current as of March 2026). The SDK's built-in retry/backoff applies to 408/409/429/5xx by default with `maxRetries`. Because the project requires exactly 3 attempts with a specific 1s→2s→4s backoff schedule, the clearest approach is to disable the SDK's built-in retries (`maxRetries: 0`) and implement a thin custom retry wrapper inside `ai.service.ts`. This gives full control over delay timing and error classification, is straightforward to test with `vi.useFakeTimers()`, and keeps the retry logic visible alongside the code it guards.

Prompt engineering strategy: one GPT-4o call per bullet (not batched). The response per bullet is tiny (one rewritten sentence), latency per bullet is under 2s at normal load, and per-bullet isolation makes retry logic and error attribution simple. A batch call with all bullets in one prompt risks a single-bullet failure invalidating the entire response and makes constraint enforcement harder.

**Primary recommendation:** Implement `ai.service.ts` with a `rewriteBullet(bullet, jobDescription, gaps)` function, a `rewriteAllBullets(resume, jobDescription, gaps)` orchestrator that calls it sequentially, and a custom `withRetry` wrapper for 3-attempt exponential backoff. Wire the result into the existing `analyzeResume` flow (or a separate `/api/rewrite` endpoint — see Architecture Patterns section for tradeoff).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai | 6.27.0 (latest) | OpenAI API client | Official SDK; typed responses, built-in timeout/retry primitives |

### No Additional Libraries Required

The retry loop, delay, and error classification are 10–15 lines of vanilla TypeScript. No `p-retry`, `axios-retry`, or similar utility is needed or recommended — keeping `ai.service.ts` dependency-free matches the project's pattern (analysis.service.ts has zero dependencies).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom retry wrapper | SDK built-in maxRetries | SDK retries don't support configurable delay schedule; custom gives testable 1s/2s/4s backoff |
| Per-bullet calls | Single batch prompt | Batch risks cascading failure and makes per-bullet error attribution impossible |
| openai v6 | openai v4/v5 | v6 is current; error types and API shape are identical to v4 for chat completions |

**Installation:**
```bash
npm install openai --workspace=apps/api
```

---

## Architecture Patterns

### Option A: Rewrites wired into existing POST /api/analyze (single round-trip)

`POST /api/analyze` already returns `AnalysisResult` with `rewrites: []`. Extending it to call `rewriteAllBullets()` after `analyzeResume()` makes the endpoint return fully-populated rewrites in one call. The frontend only needs one request. Downside: the endpoint takes 15–30s (user must wait); a streaming indicator is required (Phase 6). This is consistent with AI-04 (state preserved in response body on timeout).

### Option B: Separate POST /api/rewrite endpoint

Keeps analyze fast, lets the user see score/gaps immediately, then triggers rewrites separately. More frontend complexity (Phase 6). Better UX for slow connections.

**Recommendation for Phase 4:** Wire into the existing `POST /api/analyze` endpoint (Option A). This matches the existing `AnalysisResult` shape (rewrites field already exists), avoids a new route, and defers UX concerns (loading indicator) to Phase 6. The route handler stays identical — it just receives populated `rewrites` instead of `[]`.

### Recommended File Structure

```
apps/api/src/
├── services/
│   ├── ai.service.ts         # NEW — only file that calls OpenAI
│   ├── analysis.service.ts   # existing — calls ai.service rewriteAllBullets
│   └── pdf.service.ts        # existing
├── __tests__/
│   ├── ai.service.test.ts    # NEW — unit tests, mocked openai
│   └── analyze.route.test.ts # existing — extend for rewrites shape
```

### Pattern 1: `ai.service.ts` — Core Structure

```typescript
// Source: OpenAI Node SDK v6 docs + project pattern
import OpenAI from 'openai';
import type { Bullet, ResumeStructure } from '@resume/types';
import type { RewrittenBullet } from '@resume/types';
import { OpenAiTimeoutError } from '../middleware/error.middleware.js';

const OPENAI_TIMEOUT_MS = 30_000; // 30s per bullet call
const MAX_ATTEMPTS = 3;

// Singleton client — one instance per process
let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0, // We handle retries ourselves
    });
  }
  return _client;
}

// Transient error codes — safe to retry
const TRANSIENT_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

function isTransient(err: unknown): boolean {
  if (err instanceof OpenAI.APIConnectionTimeoutError) return true;
  if (err instanceof OpenAI.APIConnectionError) return true;
  if (err instanceof OpenAI.APIError) return TRANSIENT_STATUSES.has(err.status ?? 0);
  return false;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === MAX_ATTEMPTS - 1;
      if (isLast || !isTransient(err)) {
        // Surface timeout as retriable; other transient errors also retriable
        if (err instanceof OpenAI.APIConnectionTimeoutError) {
          throw new OpenAiTimeoutError();
        }
        throw err;
      }
      const delayMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  // TypeScript: unreachable but needed for type narrowing
  throw new Error('unreachable');
}

export async function rewriteBullet(
  bullet: Bullet,
  jobDescription: string,
  gaps: string[],
): Promise<RewrittenBullet> {
  const client = getClient();
  const content = await withRetry(async () => {
    const response = await client.chat.completions.create(
      {
        model: 'gpt-4o',
        temperature: 0.3,
        max_tokens: 200,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: buildUserPrompt(bullet.text, jobDescription, gaps),
          },
        ],
      },
      { timeout: OPENAI_TIMEOUT_MS },
    );
    return response.choices[0]?.message?.content ?? bullet.text;
  });
  return {
    id: bullet.id,
    original: bullet.text,
    rewritten: content.trim(),
    approved: false,
  };
}

export async function rewriteAllBullets(
  resume: ResumeStructure,
  jobDescription: string,
  gaps: string[],
): Promise<RewrittenBullet[]> {
  const results: RewrittenBullet[] = [];
  for (const section of resume.sections) {
    for (const item of section.items) {
      for (const bullet of item.bullets) {
        results.push(await rewriteBullet(bullet, jobDescription, gaps));
      }
    }
  }
  return results;
}
```

### Pattern 2: System Prompt for Constrained Rewrites (AI-02)

The negative constraint list must be explicit and exhaustive. GPT-4o follows explicit prohibition lists reliably when stated in the system prompt.

```typescript
const SYSTEM_PROMPT = `You are a professional resume editor. Your task is to rewrite a single resume bullet point to better match a target job description by incorporating relevant keywords.

STRICT RULES — violating any rule makes the rewrite invalid:
1. Do NOT invent, add, or imply any metric, percentage, timeframe, number, or quantity that is not present in the original bullet.
2. Do NOT mention any technology, tool, framework, language, or methodology not named in the original bullet.
3. Keep the same verb tense and first-person perspective as the original.
4. Keep the rewritten bullet to one sentence.
5. If the original bullet cannot be meaningfully improved for keyword alignment, return it unchanged.

Return ONLY the rewritten bullet text — no explanation, no bullet character, no quotes.`;

function buildUserPrompt(original: string, jobDescription: string, gaps: string[]): string {
  const topGaps = gaps.slice(0, 10).join(', ');
  return [
    `Original bullet: ${original}`,
    ``,
    `Job description (excerpt): ${jobDescription.slice(0, 1000)}`,
    ``,
    `Keywords missing from resume: ${topGaps}`,
    ``,
    `Rewrite the bullet to incorporate relevant keywords where they fit naturally.`,
  ].join('\n');
}
```

### Pattern 3: Vitest Mocking Pattern for OpenAI

The OpenAI SDK uses a default class export. The mock must return a `default` constructor that provides `chat.completions.create`.

```typescript
// Source: openai/openai-node issue #638 + Vitest module mocking docs
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } };
    // Also expose static error classes so instanceof checks work
    static APIConnectionTimeoutError = class extends Error {
      constructor() { super('Timeout'); }
    };
    static APIError = class extends Error {
      status: number;
      constructor(status: number, msg: string) { super(msg); this.status = status; }
    };
  },
  // Named exports for error class imports
  APIConnectionTimeoutError: class extends Error {},
  APIError: class extends Error { status = 500; },
}));

// In tests:
beforeEach(() => { vi.clearAllMocks(); });

it('returns RewrittenBullet on success', async () => {
  mockCreate.mockResolvedValue({
    choices: [{ message: { content: 'Improved bullet text' } }],
  });
  const result = await rewriteBullet(BULLET_FIXTURE, 'typescript developer', ['typescript']);
  expect(result.rewritten).toBe('Improved bullet text');
  expect(result.original).toBe(BULLET_FIXTURE.text);
  expect(result.approved).toBe(false);
});
```

**Important mocking consideration:** The `isTransient()` function uses `instanceof OpenAI.APIConnectionTimeoutError`. When mocking, the mock class must be the same reference used at import time. The cleanest approach is to test `isTransient` separately with a simple object that has the right shape, or to restructure the check to use `err?.constructor?.name === 'APIConnectionTimeoutError'`.

### Pattern 4: Testing Retry Backoff with Fake Timers

```typescript
it('retries 3 times then throws OpenAiTimeoutError', async () => {
  vi.useFakeTimers();
  const timeoutError = Object.assign(new Error('Timeout'), {
    constructor: { name: 'APIConnectionTimeoutError' }
  });
  mockCreate.mockRejectedValue(timeoutError);

  const promise = rewriteBullet(BULLET, 'jd', []);

  // Advance through backoff delays: 1s, 2s (not reached — only 2 gaps before final throw)
  await vi.advanceTimersByTimeAsync(1000);
  await vi.advanceTimersByTimeAsync(2000);

  await expect(promise).rejects.toBeInstanceOf(OpenAiTimeoutError);
  expect(mockCreate).toHaveBeenCalledTimes(3);

  vi.useRealTimers();
});
```

### Anti-Patterns to Avoid

- **Stateful client re-creation per request:** Create the OpenAI client once (singleton). Re-creating per request wastes memory and loses SDK-level connection pooling.
- **Catching all errors as transient:** Only retry the specific status codes. 400 Bad Request (bad prompt), 401 Unauthorized (bad key), 403 Forbidden are permanent — retrying them wastes quota.
- **Batching all bullets in one prompt:** If any bullet causes a format violation in the response, the entire response is unusable. Per-bullet isolation keeps retries targeted.
- **Using try/catch in the route handler:** Express 5 propagates async throws automatically. The route handler should remain try/catch-free per the project decision.
- **Ignoring the `gaps` slice in the user prompt:** Sending all gaps (potentially hundreds of tokens) inflates cost. Slice to the top 10 most relevant gaps.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client for OpenAI | Custom fetch wrapper | `openai` npm package | SDK handles auth headers, JSON parsing, timeout, typed responses |
| Streaming response parsing | Manual SSE parser | Non-streaming chat.completions (this project) | Streaming adds client complexity; not needed per REQUIREMENTS.md Out of Scope |
| Retry jitter | Complex jitter algorithm | Simple exponential: 1s/2s/4s | Jitter matters at scale (many concurrent clients hitting rate limits together); irrelevant for a single-user v1 |

**Key insight:** The OpenAI SDK handles connection pooling, TLS, JSON serialization, header management, and basic error typing. The only custom logic needed is the retry loop and the transient-vs-permanent classification.

---

## Common Pitfalls

### Pitfall 1: instanceof Checks Fail After vi.mock()

**What goes wrong:** `err instanceof OpenAI.APIConnectionTimeoutError` returns `false` even for the mocked error, because the mocked class is a different reference than the one in `ai.service.ts`.

**Why it happens:** `vi.mock('openai')` replaces the module in the registry. If `ai.service.ts` imports `OpenAI.APIConnectionTimeoutError` at module evaluation time and the test mock defines a different class object, they are different constructors.

**How to avoid:** In the service, check `err?.constructor?.name === 'APIConnectionTimeoutError'` as the fallback, or export the error check as a small testable utility. Alternatively, test the retry behavior by checking call counts rather than by checking the thrown error type.

**Warning signs:** Tests pass but retry count is always 1 (retries silently skip due to failed instanceof).

### Pitfall 2: OpenAI API Key Missing at Runtime

**What goes wrong:** `openai` throws `AuthenticationError` (401) on the first call.

**Why it happens:** `process.env.OPENAI_API_KEY` is undefined because `.env` was not loaded or the key name is wrong.

**How to avoid:** The project already uses `dotenv` — ensure `dotenv/config` is loaded before the OpenAI client is constructed. The client constructor should fail fast (throw at startup) if the key is absent, not silently create a client that will fail on every request.

**Warning signs:** Tests pass (mocked) but manual testing always returns 401.

### Pitfall 3: choices[0].message.content Can Be null

**What goes wrong:** `response.choices[0].message.content` is typed as `string | null`. Calling `.trim()` on null throws.

**Why it happens:** GPT-4o can return null content in edge cases (content filter triggered, finish_reason: 'content_filter').

**How to avoid:** Always use the nullish coalescing fallback: `response.choices[0]?.message?.content ?? bullet.text`. Falling back to the original bullet text is correct behavior — the bullet is preserved, not dropped.

### Pitfall 4: Sequential Calls Take 30-90s for a Full Resume

**What goes wrong:** A resume with 15 bullets × ~3s per call = 45s total. Users abandon.

**Why it happens:** Per-bullet sequential calls with no concurrency.

**How to avoid:** The Phase 4 requirement doesn't mandate streaming or concurrency. The processing indicator (OUT-02) is Phase 6. For Phase 4, sequential is acceptable. If performance becomes a concern, `Promise.all()` with a concurrency limiter (e.g., process 3 bullets at a time) is the Phase 5/6 optimization — do not pre-optimize in Phase 4.

**Warning signs:** Integration test with 10+ bullet fixture takes >30s.

### Pitfall 5: Prompt Injection via Resume Bullet Text

**What goes wrong:** A malicious resume contains `"IGNORE ALL PREVIOUS INSTRUCTIONS..."` in a bullet.

**Why it happens:** User-controlled input is interpolated into the user prompt.

**How to avoid:** The system prompt establishes strict behavior. For v1, this is acceptable — the application is single-user and not adversarial. Note in code comments that bullet text is untrusted input. No sanitization needed for v1.

---

## Code Examples

### OpenAI SDK: Chat Completions Call with Timeout

```typescript
// Source: JSR @openai/openai v6 documentation (jsr.io/@openai/openai)
const response = await client.chat.completions.create(
  {
    model: 'gpt-4o',
    temperature: 0.3,
    max_tokens: 200,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  },
  { timeout: 30_000 }, // per-request timeout override in ms
);
const text = response.choices[0]?.message?.content ?? fallback;
```

### Error Type Hierarchy (OpenAI SDK v6)

```typescript
// Source: JSR @openai/openai — error exports
import OpenAI from 'openai';

// Permanent (do not retry):
// OpenAI.BadRequestError          — 400
// OpenAI.AuthenticationError      — 401
// OpenAI.PermissionDeniedError    — 403
// OpenAI.NotFoundError            — 404

// Transient (safe to retry):
// OpenAI.APIConnectionTimeoutError — timeout (no status)
// OpenAI.APIConnectionError        — network error (no status)
// OpenAI.RateLimitError            — 429
// OpenAI.InternalServerError       — >=500

// Base class (check for any API error):
// OpenAI.APIError — has .status: number, .message: string, .code?: string
```

### dotenv Loading (already in project pattern)

```typescript
// src/index.ts already loads dotenv — no change needed
// ai.service.ts reads process.env.OPENAI_API_KEY at client construction time
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| openai v3 (axios-based) | openai v4+ (native fetch) | mid-2023 | Different import style; v4+ uses `new OpenAI()`, not `Configuration` + `OpenAIApi` |
| openai v4 | openai v6 (current: 6.27.0) | early 2026 | Same chat completions API; error class names unchanged; safe to install v6 |
| Per-request API key header | SDK constructor apiKey option | v4+ | apiKey passed once at construction |

**Deprecated/outdated:**
- `openai` v3 pattern (`new Configuration({ apiKey })` + `new OpenAIApi(config)`): replaced entirely in v4+. Do not use.
- `openai.createChatCompletion()`: replaced by `client.chat.completions.create()`. Do not use.

---

## Open Questions

1. **Route extension vs new endpoint**
   - What we know: `POST /api/analyze` currently returns `rewrites: []`; extending it is the simplest path; a separate `POST /api/rewrite` is cleaner for progressive UI
   - What's unclear: Phase 6 frontend design preference
   - Recommendation: Extend the existing route for Phase 4 (simpler, matches existing AnalysisResult contract). Phase 6 can split it if needed.

2. **Concurrency for bullet rewrites**
   - What we know: Sequential calls are simple and safe; 15-bullet resume = ~45s total
   - What's unclear: Whether 45s is acceptable for v1 or causes test timeouts
   - Recommendation: Sequential for Phase 4. Add `Promise.all` with 3-slot concurrency in Phase 6 if needed. Set Vitest test timeout to 10s per test and use mocked OpenAI (no real calls in tests).

3. **OPENAI_API_KEY in CI**
   - What we know: Tests mock OpenAI — no real key needed for unit/integration tests
   - What's unclear: Whether the project has CI configured
   - Recommendation: Guard against undefined key only in production path; tests run fully mocked.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `apps/api/vitest.config.ts` (globals: true) |
| Quick run command | `cd apps/api && npx vitest run --reporter=verbose` |
| Full suite command | `cd apps/api && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-01 | `rewriteAllBullets()` returns one RewrittenBullet per bullet | unit | `npx vitest run apps/api/src/__tests__/ai.service.test.ts` | Wave 0 |
| AI-01 | `rewriteBullet()` returns correct shape (id, original, rewritten, approved:false) | unit | same | Wave 0 |
| AI-02 | System prompt contains explicit prohibition list for metrics/percentages/technologies | unit (inspect prompt) | same | Wave 0 |
| AI-03 | `withRetry` calls fn exactly 3 times before throwing on repeated transient failure | unit + fake timers | same | Wave 0 |
| AI-03 | `withRetry` does not retry on permanent errors (400, 401) | unit | same | Wave 0 |
| AI-03 | Backoff delays are 1000ms, 2000ms (checked via vi.useFakeTimers) | unit | same | Wave 0 |
| AI-04 | Transient timeout from OpenAI surfaces as OpenAiTimeoutError (504/retryable:true) | unit | same | Wave 0 |
| AI-04 | POST /api/analyze returns 504 with retryable:true when ai.service throws OpenAiTimeoutError | integration | `npx vitest run apps/api/src/__tests__/analyze.route.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd apps/api && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd apps/api && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/__tests__/ai.service.test.ts` — covers AI-01, AI-02, AI-03, AI-04 unit contracts
- [ ] Framework install: `npm install openai --workspace=apps/api` — openai package not yet in package.json

---

## Sources

### Primary (HIGH confidence)

- JSR `@openai/openai` v6 documentation (jsr.io/@openai/openai) — error types, timeout API, retry behavior, chat completions shape
- `packages/types/src/bullet.ts` — RewrittenBullet schema (id, original, rewritten, approved)
- `packages/types/src/analysis.ts` — AnalysisResult.rewrites field (already typed as RewrittenBullet[])
- `apps/api/src/middleware/error.middleware.ts` — OpenAiTimeoutError already defined (504, retryable:true)
- `apps/api/src/services/analysis.service.ts` — existing service pattern (no-dependency, pure functions)
- `apps/api/src/__tests__/analyze.route.test.ts` — integration test pattern with vi.mock for service isolation

### Secondary (MEDIUM confidence)

- openai/openai-node GitHub issue #638 — vi.mock structure for OpenAI default class export
- WebSearch results (multiple sources) — SDK built-in retry behavior for 408/409/429/5xx; timeout throws APIConnectionTimeoutError

### Tertiary (LOW confidence)

- Prompt engineering patterns for "do not invent metrics" — cross-referenced across multiple articles; GPT-4o behavior with explicit prohibitions is well-documented community knowledge but not formally benchmarked

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — openai npm package is official; v6.27.0 verified via `npm show openai version`
- Architecture: HIGH — follows established project patterns (analysis.service, error.middleware); stateless AnalysisResult design is locked
- Pitfalls: HIGH (instanceof mocking, null content) / MEDIUM (prompt injection) — verified from SDK source behavior and community reports
- Prompt engineering: MEDIUM — GPT-4o constraint adherence is empirically documented but varies; test coverage should verify the prompt is correct, not GPT-4o behavior

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (OpenAI SDK patch releases frequently; verify version on install; core API shape is stable)
