# Phase 3: Analysis - Research

**Researched:** 2026-03-10
**Domain:** Algorithmic keyword extraction, text normalization, Express route extension
**Confidence:** HIGH

---

## Summary

Phase 3 adds two things to the already-wired `POST /api/analyze` route: a `jobDescription` field in the request body (with a 5,000-character hard cap), and an analysis service that produces a numeric keyword alignment score (0–100) and a gap keyword list. The route currently returns a bare `ResumeStructure`; after Phase 3 it returns the full `AnalysisResult` shape that already exists in `@resume/types`.

The keyword scoring problem is entirely algorithmic — no NLP library is involved. The technique that fits this scope is **token-frequency overlap with stop-word filtering and basic stemming normalization**. Resume text is extracted from the already-populated `ResumeStructure` (sections, items, bullets, titles, subtitles). Job description text is extracted by splitting on whitespace and punctuation. Score = (matched keywords / total JD keywords) * 100, rounded to an integer. Gaps = JD keywords not found in resume token set.

The route change is contained: add a `jobDescription` string field to the multipart form, validate length with Zod, call a new `analysis.service.ts`, return `AnalysisResult` with `rewrites: []`. The existing PDF upload middleware and `parsePdf` call stay untouched.

**Primary recommendation:** Build `analysis.service.ts` as a pure function `analyzeResume(resume: ResumeStructure, jobDescription: string): AnalysisResult` with no external dependencies, and extend the route to accept `jobDescription` in `req.body` (multer populates non-file fields in `req.body` for multipart requests).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ANAL-01 | System computes a keyword alignment score (0–100) between resume and job description, labeled "match score" — not "ATS score" | Token-overlap scoring produces a 0–100 integer; label lives in the API response JSON key `score` and any UI copy |
| ANAL-02 | System produces a keyword gap list showing terms present in the JD but absent in the resume | Set difference (JD tokens minus resume tokens) after normalization gives the gap array |
| ANAL-03 | System limits job description input to 5,000 characters to prevent token overflow | Zod `.max(5000)` on the `jobDescription` field; throw `AppError(400, 'jd_too_long', ...)` if validation fails |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 4.3.6 (already installed) | Validate `jobDescription` field (`.string().max(5000)`) | Project-wide single source of truth for runtime validation |
| Express 5 | 5.2.1 (already installed) | Route handler; async throws propagate to errorMiddleware automatically | Already in use; no change needed |
| multer | 2.1.1 (already installed) | Non-file multipart fields (like `jobDescription`) land in `req.body` automatically | Already in use for file upload |
| @resume/types | workspace:* | `AnalysisResult`, `ResumeStructure` types | Project type source of truth |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.0.18 (already installed) | Unit tests for analysis service | Pure function — easy to unit test without HTTP layer |
| supertest | ^7.2.2 (already installed) | Integration tests for route | End-to-end route tests with mocked service |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled token normalization | `natural`, `compromise`, or `wink-nlp` | NLP libs add 10–50MB to bundle; algorithmic approach is sufficient for keyword overlap scoring at this scope |
| Simple character count for JD limit | Zod `.max(5000)` | Zod is consistent with how all other validation is done in this project |

**Installation:**
No new packages required. All dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
├── services/
│   ├── pdf.service.ts         # existing — unchanged
│   └── analysis.service.ts    # NEW — pure analyzeResume() function
├── routes/
│   └── analyze.route.ts       # MODIFIED — accepts jobDescription, returns AnalysisResult
├── middleware/
│   └── error.middleware.ts    # MODIFIED — add JdTooLongError class
└── __tests__/
    ├── analyze.route.test.ts  # MODIFIED — add jobDescription scenarios
    └── analysis.service.test.ts  # NEW — unit tests for scoring logic
```

### Pattern 1: Pure Analysis Service

**What:** `analysis.service.ts` exports a single synchronous function. All logic is deterministic and has no I/O.

**When to use:** Any computation that takes typed inputs and produces typed outputs with no side effects. Easy to unit test, easy to reason about.

**Example:**
```typescript
// apps/api/src/services/analysis.service.ts
import type { ResumeStructure, AnalysisResult } from '@resume/types';

export function analyzeResume(
  resume: ResumeStructure,
  jobDescription: string,
): AnalysisResult {
  const resumeTokens = extractResumeTokens(resume);
  const jdTokens = extractJdTokens(jobDescription);

  const matched = jdTokens.filter((t) => resumeTokens.has(t));
  const score = jdTokens.length === 0 ? 0 : Math.round((matched.length / jdTokens.length) * 100);
  const gaps = jdTokens.filter((t) => !resumeTokens.has(t));

  return {
    score,
    gaps,
    rewrites: [],       // Phase 4 fills this
    resumeStructure: resume,
  };
}
```

### Pattern 2: Text Extraction from ResumeStructure

**What:** Walk all text-bearing nodes of the already-parsed `ResumeStructure` — `header[].text`, `sections[].heading`, `sections[].items[].title`, `sections[].items[].subtitle`, `sections[].items[].bullets[].text`.

**When to use:** Any operation that needs to treat resume content as a flat token set. Centralise this in a helper so it can be reused in Phase 4.

**Example:**
```typescript
function extractResumeTokens(resume: ResumeStructure): Set<string> {
  const texts: string[] = [];

  for (const line of resume.header) {
    texts.push(line.text);
  }

  for (const section of resume.sections) {
    texts.push(section.heading);
    for (const item of section.items) {
      if (item.title) texts.push(item.title);
      if (item.subtitle) texts.push(item.subtitle);
      for (const bullet of item.bullets) {
        texts.push(bullet.text);
      }
    }
  }

  return new Set(texts.flatMap(tokenize));
}
```

### Pattern 3: Token Normalization

**What:** Lowercase, strip punctuation, remove stop words, apply simple suffix-stripping (not a full stemmer). Produces a stable comparable token set from both sides.

**When to use:** Anywhere tokens from two different text sources need to be compared for overlap.

**Example:**
```typescript
// Stop words — a short, hand-curated list covering the most common English function words
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'not', 'no', 'nor',
  'so', 'yet', 'both', 'either', 'neither', 'each', 'that', 'this',
  'these', 'those', 'which', 'who', 'whom', 'whose', 'what', 'when',
  'where', 'how', 'why', 'if', 'as', 'than', 'then', 'while', 'after',
  'before', 'during', 'between', 'through', 'per', 'it', 'its', 'we',
  'our', 'you', 'your', 'their', 'they', 'he', 'she', 'him', 'her',
  'his', 'i', 'me', 'my', 'us', 'up', 'out', 'about', 'into', 'also',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')   // strip punctuation
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}
```

### Pattern 4: Route Extension with Zod Validation

**What:** Read `jobDescription` from `req.body` (multer places non-file multipart fields there). Validate with Zod inline in the route. Throw `AppError` subclass if invalid.

**When to use:** Extending an existing multipart route to accept additional fields.

**Example:**
```typescript
// apps/api/src/routes/analyze.route.ts (updated)
import { z } from 'zod';
import { JdTooLongError } from '../middleware/error.middleware.js';
import { analyzeResume } from '../services/analysis.service.js';

const AnalyzeRequestSchema = z.object({
  jobDescription: z.string().min(1).max(5000),
});

analyzeRouter.post('/analyze', ...uploadMiddleware, async (req, res) => {
  const parsed = AnalyzeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    // jobDescription missing or over 5000 chars
    throw new JdTooLongError(
      'Job description must be between 1 and 5,000 characters.',
    );
  }

  const resume = await parsePdf(req.file!.buffer);
  const result = analyzeResume(resume, parsed.data.jobDescription);
  res.json(result);
});
```

### Pattern 5: New AppError Subclass for JD Validation

**What:** Follow the established error class pattern from `error.middleware.ts`. Add a `JdTooLongError` (or `JdValidationError`) with a descriptive `code` string and HTTP 400.

**Example:**
```typescript
// In error.middleware.ts — add alongside existing classes
export class JdTooLongError extends AppError {
  constructor(message: string) {
    super(400, 'jd_too_long', message);
  }
}
```

### Anti-Patterns to Avoid

- **Importing an NLP library:** No natural language processing library is needed. Simple tokenization + stop word removal is sufficient for keyword overlap scoring. Do not install `natural`, `compromise`, `wink-nlp`, or any equivalent.
- **Stemming with a full Porter stemmer:** Overkill. Simple suffix stripping (remove trailing `s`, `ing`, `ed`, `er`) or none at all is sufficient here. Adds complexity without meaningful score accuracy gain.
- **Putting scoring logic inside the route handler:** Keep the route handler thin. All scoring logic lives in `analysis.service.ts` as a pure function.
- **Using `req.query` for `jobDescription`:** Job descriptions can be up to 5,000 characters. They must come in via the request body (multipart field), not a query parameter.
- **Returning a non-integer score:** `Math.round()` the result. The type says `z.number()` but scores should be whole numbers for consistent UI display.
- **Deduplicating gaps on the JD side before scoring:** The gap list should contain unique keywords. Use `Array.from(new Set(...))` when building the gaps array.
- **Scoring based on raw character frequency:** Token presence/absence (set overlap) is more meaningful and stable than term frequency for this use case.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request body validation | Custom length check in route | Zod `z.string().max(5000)` | Already the project standard; safeParse gives typed output |
| Error formatting | Custom JSON serialization | Existing `AppError` subclass pattern | errorMiddleware handles all AppError subclasses uniformly |
| Type inference for AnalysisResult | Duplicate interface | `z.infer<typeof AnalysisResultSchema>` from `@resume/types` | Already defined and exported |

**Key insight:** The heaviest problem here — extracting and comparing keyword sets — is a few dozen lines of plain TypeScript. Reaching for a library would add install size, version drift risk, and opaque behavior, for zero gain over a transparent hand-written implementation.

---

## Common Pitfalls

### Pitfall 1: multer body fields are strings — always

**What goes wrong:** `req.body.jobDescription` is always a string even if the client sends nothing (it may be `undefined` or empty string). `typeof req.body.jobDescription === 'string'` is the right check, not truthy.

**Why it happens:** multer populates `req.body` from multipart text fields. If the client omits the field entirely, `req.body.jobDescription` is `undefined`. If the client sends an empty string, it is `""`.

**How to avoid:** Use `AnalyzeRequestSchema.safeParse(req.body)` with `.min(1)` so both undefined and empty string are rejected cleanly.

**Warning signs:** Tests that send a valid PDF but omit `jobDescription` should get a 400 — if they get a 500, the validation is not in place.

### Pitfall 2: Score is 0 when jobDescription has only stop words

**What goes wrong:** A JD that is entirely stop words produces `jdTokens.length === 0` after filtering, triggering a divide-by-zero. Without a guard, score becomes `NaN`.

**Why it happens:** Stop word filtering removes all tokens. Division by zero gives `Infinity` or `NaN`. Both fail Zod's `z.number().min(0).max(100)`.

**How to avoid:** Guard: `jdTokens.length === 0 ? 0 : Math.round(...)`.

**Warning signs:** `NaN` in the score field, or Zod parse error on `AnalysisResultSchema` at the end of the service function.

### Pitfall 3: Gap list contains duplicates

**What goes wrong:** The same keyword appears multiple times in the gaps array (because it appeared multiple times in the JD token stream).

**Why it happens:** Tokenizing the JD produces a raw array with repetition. If you iterate the array for the set difference, duplicates carry through.

**How to avoid:** Build `jdTokens` as `Array.from(new Set(tokenize(jobDescription)))` — deduplicate before computing overlap and gaps.

### Pitfall 4: Character limit check on trimmed vs. raw string

**What goes wrong:** A JD of 4,999 characters plus leading/trailing whitespace is 5,001 raw characters. Inconsistent trim behavior between client and server produces a confusing user experience.

**Why it happens:** Clients often trim before submitting; Zod validates raw value.

**How to avoid:** Apply `.trim()` before the Zod `.max(5000)` check, or use `.transform(s => s.trim()).max(5000)` in the schema. Document the choice explicitly.

### Pitfall 5: `rewrites: []` must still pass Zod validation

**What goes wrong:** `AnalysisResultSchema` includes `rewrites: z.array(RewrittenBulletSchema)`. Returning an empty array is valid, but if the response is passed through `AnalysisResultSchema.parse()` anywhere, it will succeed. Forgetting `rewrites: []` entirely throws a Zod error.

**Why it happens:** Phase 3 intentionally returns an empty rewrites array. It is easy to forget to include the field at all.

**How to avoid:** Always explicitly set `rewrites: []` in the `analyzeResume` return value.

---

## Code Examples

### Full token pipeline
```typescript
// Source: hand-rolled — no external library
const STOP_WORDS = new Set(['a', 'an', 'the', /* ... full list ... */]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function extractResumeTokens(resume: ResumeStructure): Set<string> {
  const texts: string[] = [];
  for (const line of resume.header) texts.push(line.text);
  for (const section of resume.sections) {
    texts.push(section.heading);
    for (const item of section.items) {
      if (item.title) texts.push(item.title);
      if (item.subtitle) texts.push(item.subtitle);
      for (const bullet of item.bullets) texts.push(bullet.text);
    }
  }
  return new Set(texts.flatMap(tokenize));
}

export function analyzeResume(
  resume: ResumeStructure,
  jobDescription: string,
): AnalysisResult {
  const resumeTokens = extractResumeTokens(resume);
  const jdTokens = Array.from(new Set(tokenize(jobDescription)));

  const matched = jdTokens.filter((t) => resumeTokens.has(t));
  const score = jdTokens.length === 0
    ? 0
    : Math.round((matched.length / jdTokens.length) * 100);
  const gaps = jdTokens.filter((t) => !resumeTokens.has(t));

  return { score, gaps, rewrites: [], resumeStructure: resume };
}
```

### Zod schema for request body
```typescript
// Source: Zod 4.x docs — z.string().max() + safeParse pattern
const AnalyzeRequestSchema = z.object({
  jobDescription: z.string().trim().min(1).max(5000),
});

// In route handler:
const parsed = AnalyzeRequestSchema.safeParse(req.body);
if (!parsed.success) {
  throw new JdTooLongError('Job description must be between 1 and 5,000 characters.');
}
```

### Integration test shape (extending existing test file)
```typescript
// Source: mirrors analyze.route.test.ts patterns already in the project
it('returns 200 with score, gaps, and empty rewrites for a valid request', async () => {
  (pdfServiceMock.parsePdf as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_RESUME_STRUCTURE);

  const res = await request(app)
    .post('/api/analyze')
    .attach('resume', validPdfBuffer, { filename: 'resume.pdf', contentType: 'application/pdf' })
    .field('jobDescription', 'TypeScript React developer with experience in Node.js');

  expect(res.status).toBe(200);
  expect(res.body.score).toBeGreaterThanOrEqual(0);
  expect(res.body.score).toBeLessThanOrEqual(100);
  expect(Array.isArray(res.body.gaps)).toBe(true);
  expect(res.body.rewrites).toEqual([]);
  expect(res.body.resumeStructure).toBeDefined();
});

it('returns 400 with jd_too_long when jobDescription exceeds 5000 chars', async () => {
  const res = await request(app)
    .post('/api/analyze')
    .attach('resume', validPdfBuffer, { filename: 'resume.pdf', contentType: 'application/pdf' })
    .field('jobDescription', 'x'.repeat(5001));

  expect(res.status).toBe(400);
  expect(res.body.error).toBe('jd_too_long');
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Calling POST /api/analyze returns `ResumeStructure` only | Returns full `AnalysisResult` after Phase 3 | Phase 3 | Frontend can display score + gaps |
| No JD input on the route | `jobDescription` multipart field with 5k char limit | Phase 3 | Enables analysis without a second endpoint |
| `rewrites` field empty placeholder | Populated by Phase 4 AI service | Phase 4 | No change to Phase 3 logic |

**Note on labeling:** ANAL-01 specifies the score must be labeled "keyword alignment" or "match score" — not "ATS score". The JSON key is `score`. The label "keyword alignment" is a UI concern (Phase 6) but the API response must not include any ATS-related language in error messages or field names.

---

## Validation Architecture

`nyquist_validation` is enabled in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `apps/api/vitest.config.ts` (exists, `globals: true`) |
| Quick run command | `cd apps/api && npx vitest run --reporter=verbose` |
| Full suite command | `cd apps/api && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANAL-01 | `analyzeResume()` returns `score` 0–100 (integer) | unit | `cd apps/api && npx vitest run src/__tests__/analysis.service.test.ts` | ❌ Wave 0 |
| ANAL-01 | Score is 0 when no JD tokens match resume tokens | unit | same | ❌ Wave 0 |
| ANAL-01 | Score is 100 when all JD tokens are in resume | unit | same | ❌ Wave 0 |
| ANAL-01 | Route returns `score` field in response JSON | integration | `cd apps/api && npx vitest run src/__tests__/analyze.route.test.ts` | ❌ needs new test cases in existing file |
| ANAL-02 | `analyzeResume()` returns `gaps` as array of strings | unit | `cd apps/api && npx vitest run src/__tests__/analysis.service.test.ts` | ❌ Wave 0 |
| ANAL-02 | Gaps contain no duplicates | unit | same | ❌ Wave 0 |
| ANAL-02 | Gaps exclude tokens already present in resume | unit | same | ❌ Wave 0 |
| ANAL-02 | Route returns `gaps` array in response JSON | integration | `cd apps/api && npx vitest run src/__tests__/analyze.route.test.ts` | ❌ needs new test cases |
| ANAL-03 | Route returns 400 + `jd_too_long` for JD > 5000 chars | integration | `cd apps/api && npx vitest run src/__tests__/analyze.route.test.ts` | ❌ needs new test case |
| ANAL-03 | Route returns 400 + `jd_too_long` when `jobDescription` field absent | integration | same | ❌ needs new test case |
| ANAL-03 | Route accepts JD of exactly 5000 chars | integration | same | ❌ needs new test case (boundary) |

### Sampling Rate
- **Per task commit:** `cd apps/api && npx vitest run src/__tests__/analysis.service.test.ts`
- **Per wave merge:** `cd apps/api && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/__tests__/analysis.service.test.ts` — unit tests covering ANAL-01 (score computation) and ANAL-02 (gap list correctness); must be written in RED state before service implementation
- [ ] New test cases in `apps/api/src/__tests__/analyze.route.test.ts` — ANAL-01 route response shape, ANAL-02 gaps array, ANAL-03 JD length boundary cases
- [ ] `apps/api/src/middleware/error.middleware.ts` — add `JdTooLongError` class (needed before route can throw it)

No new framework install needed — Vitest and supertest are already in `devDependencies`.

---

## Open Questions

1. **Should `analyzeResume` also be mocked at the route level in integration tests, or test the real function through the route?**
   - What we know: `parsePdf` is mocked because it requires real PDF data. `analyzeResume` takes a plain `ResumeStructure` object — no I/O.
   - What's unclear: Whether to isolate the route test from scoring logic (mock `analyzeResume`) or test the real scoring end-to-end via the route.
   - Recommendation: Do not mock `analyzeResume` in route tests. It is a pure function with no I/O — testing it through the route gives higher confidence for minimal cost. The unit test file tests edge cases in isolation.

2. **Should `jobDescription` be validated before or after `parsePdf`?**
   - What we know: Both can fail. Failing fast on a cheap validation before an expensive parse is user-friendly.
   - What's unclear: Whether order matters for the existing Express 5 middleware chain.
   - Recommendation: Validate `jobDescription` **before** calling `parsePdf`. If the JD is invalid, the user gets a fast 400 without waiting for PDF parsing.

3. **Exact stop word list scope**
   - What we know: A stop word list of ~60–80 common English function words covers the vast majority of noise.
   - What's unclear: Whether domain-specific resume noise words (like "responsible", "experienced") should be in the stop list.
   - Recommendation: Start with pure grammatical stop words only. Domain noise can be addressed in Phase 7 polish. Keep the list explicit and inline (not a separate data file) so it is easy to audit and extend.

---

## Sources

### Primary (HIGH confidence)

- `packages/types/src/analysis.ts` — `AnalysisResult` schema: `{ score, gaps, rewrites, resumeStructure }`
- `packages/types/src/resume.ts` — `ResumeStructure` schema with all text-bearing fields
- `apps/api/src/routes/analyze.route.ts` — current route implementation to extend
- `apps/api/src/middleware/error.middleware.ts` — established `AppError` subclass pattern
- `apps/api/src/__tests__/analyze.route.test.ts` — established test patterns (vitest + supertest + vi.mock)
- `apps/api/package.json` — confirmed installed versions: Zod 4.3.6, Vitest 4.0.18, multer 2.1.1, Express 5.2.1

### Secondary (MEDIUM confidence)

- Zod 4.x official docs — `.string().max()`, `.trim()`, `.safeParse()` API verified against installed version
- multer 2.x README — non-file multipart fields populate `req.body` as strings (standard behavior, unchanged between multer versions)

### Tertiary (LOW confidence)

- Standard NLP stop word lists (NLTK, spaCy reference lists) — used as input for the recommended hand-curated list, not imported directly

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use; no new dependencies
- Architecture: HIGH — pattern follows established pdf.service.ts and error.middleware.ts conventions directly
- Pitfalls: HIGH — derived from direct inspection of existing code and the Zod + multer interaction patterns
- Scoring algorithm: HIGH — token-overlap with stop word filtering is a well-understood, zero-dependency pattern appropriate to the problem scope

**Research date:** 2026-03-10
**Valid until:** 2026-06-10 (stable stack — all libraries are already pinned)
