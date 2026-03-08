# Architecture Patterns

**Domain:** AI Resume Tailoring Engine (PDF → Analysis → DOCX)
**Researched:** 2026-03-08
**Confidence:** HIGH for structural patterns, MEDIUM for OpenAI streaming specifics

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Express Monolith                      │
│                                                             │
│  POST /api/analyze                POST /api/generate        │
│         │                                  │                │
│         ▼                                  ▼                │
│  ┌─────────────┐               ┌──────────────────┐        │
│  │ pdf.service │               │  docx.service    │        │
│  │  (parse)    │               │  (reconstruct)   │        │
│  └──────┬──────┘               └────────┬─────────┘        │
│         │ ResumeStructure               │ approved bullets  │
│         ▼                               │ + ResumeStructure │
│  ┌─────────────┐                        │                   │
│  │  analysis   │                        ▼                   │
│  │  .service   │               ┌──────────────────┐        │
│  │ (score+gaps)│               │   DOCX binary    │        │
│  └──────┬──────┘               │   (download)     │        │
│         │ score, gaps,         └──────────────────┘        │
│         ▼ ResumeStructure                                   │
│  ┌─────────────┐                                           │
│  │ ai.service  │  ← ONLY file that calls OpenAI            │
│  │ (rewrites)  │                                           │
│  └──────┬──────┘                                           │
│         │ rewritten bullets                                │
│         ▼                                                  │
│    JSON response                                           │
│  { score, gaps, rewrites, resumeStructure }               │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Input | Output | Communicates With |
|-----------|---------------|-------|--------|-------------------|
| `pdf.service.ts` | Parse PDF binary into structured data | PDF `Buffer` | `ResumeStructure` | Called by `/api/analyze` route |
| `analysis.service.ts` | Compute match score, identify ATS keyword gaps | `ResumeStructure` + job description string | `{ score: number, gaps: string[] }` | Called by `/api/analyze` after pdf.service |
| `ai.service.ts` | Rewrite bullets via GPT-4o; only OpenAI contact | `ResumeStructure` + job description + gaps | `RewrittenBullet[]` | Called by `/api/analyze` after analysis.service |
| `docx.service.ts` | Reconstruct DOCX preserving layout from ResumeStructure | Approved `RewrittenBullet[]` + `ResumeStructure` | `Buffer` (DOCX binary) | Called by `/api/generate` route |
| `/api/analyze` route | Orchestrate parse → score → rewrite pipeline | `multipart/form-data` (PDF + JD text) | JSON `AnalysisResult` | Calls pdf → analysis → ai services in sequence |
| `/api/generate` route | Orchestrate bullet approval + DOCX generation | JSON `{ approvedBullets, resumeStructure }` | Binary DOCX download | Calls docx.service only |
| Error middleware | Global catch — services throw, middleware formats | `Error` objects | HTTP error responses | Last middleware in Express chain |

**Isolation rule:** No service imports another service. All orchestration lives in route handlers.

---

## Data Flow

### /api/analyze pipeline (linear, sequential)

```
Client
  │
  │ POST multipart: { pdf: Buffer, jobDescription: string }
  ▼
Route handler (/api/analyze)
  │
  ├─► pdf.service.parse(pdfBuffer)
  │       └─ returns: ResumeStructure
  │
  ├─► analysis.service.analyze(resumeStructure, jobDescription)
  │       └─ returns: { score: number, gaps: string[] }
  │
  ├─► ai.service.rewriteBullets(resumeStructure, jobDescription, gaps)
  │       └─ returns: RewrittenBullet[]
  │           (each: { sectionId, bulletIndex, original, rewritten })
  │
  └─► JSON response:
        {
          score: number,
          gaps: string[],
          rewrites: RewrittenBullet[],
          resumeStructure: ResumeStructure  // echoed back for /api/generate
        }

Client stores AnalysisResult in React state (no server persistence)
```

### /api/generate pipeline (direct, no AI)

```
Client
  │
  │ POST JSON: { approvedBullets: RewrittenBullet[], resumeStructure: ResumeStructure }
  ▼
Route handler (/api/generate)
  │
  └─► docx.service.generate(approvedBullets, resumeStructure)
          └─ returns: Buffer (DOCX binary)

Response: Content-Disposition: attachment; filename="resume.docx"
```

### Client state machine (3-step wizard)

```
Step 1: Upload
  State: { pdf: File | null, jobDescription: string }
  Transition: POST /api/analyze → Step 2

Step 2: Review
  State: { analysisResult: AnalysisResult, editedBullets: Record<bulletKey, string> }
  User edits rewritten bullets in place; approves all or selectively overrides
  Transition: POST /api/generate → Step 3

Step 3: Download
  State: DOCX blob URL in memory
  User clicks download link
```

**Key insight:** `resumeStructure` round-trips through the client. The server is truly stateless — the client owns state between the two API calls. This is intentional and correct for a stateless v1.

---

## ResumeStructure Type Design

This is the most architecturally critical decision. It must serve two very different consumers:

1. `analysis.service` + `ai.service` — need **text content** (bullet strings, section names)
2. `docx.service` — needs **layout metadata** (fonts, spacing, margins, paragraph styles)

### Recommended structure

```typescript
interface ResumeStructure {
  // ── Identity ──────────────────────────────────────────────
  meta: {
    pageWidth: number;        // points (PDF units)
    pageHeight: number;
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
  };

  // ── Content tree ──────────────────────────────────────────
  sections: Section[];
}

interface Section {
  id: string;                 // stable key: "experience-0", "education-1"
  heading: string;            // raw text: "WORK EXPERIENCE"
  headingStyle: TextStyle;
  items: SectionItem[];       // jobs, schools, etc.
}

interface SectionItem {
  id: string;                 // "experience-0-item-0"
  title?: string;             // "Senior Engineer at Acme"
  titleStyle?: TextStyle;
  subtitle?: string;          // "Jan 2022 – Present"
  subtitleStyle?: TextStyle;
  bullets: Bullet[];
}

interface Bullet {
  id: string;                 // "experience-0-item-0-bullet-2"  ← used as edit key
  text: string;               // raw bullet text (no leading "•")
  style: TextStyle;
}

interface TextStyle {
  fontName: string;           // "Calibri", "Times New Roman"
  fontSize: number;           // half-points (OOXML convention) or points
  bold: boolean;
  italic: boolean;
  color: string;              // hex "#1a1a1a"
  lineSpacingPt?: number;     // line height in points
  spaceBefore?: number;       // paragraph spacing before (points)
  spaceAfter?: number;        // paragraph spacing after (points)
}
```

### Design principles

**Stable IDs are essential.** `ai.service` returns `RewrittenBullet[]` keyed by bullet ID. `docx.service` uses the same IDs to place approved text. Without stable IDs the mapping breaks. Generate IDs deterministically in `pdf.service` (section-index + item-index + bullet-index), not randomly.

**Separate text from style.** `analysis.service` and `ai.service` only touch `text` fields. `docx.service` only touches `style` fields. This separation keeps services independently testable.

**Capture style at parse time, not generation time.** `pdf.service` must extract `TextStyle` for every text node. Do not defer style extraction. DOCX reconstruction is impossible without it.

**Round-trip safety.** `ResumeStructure` is serialized to JSON and sent to the client, then sent back. Avoid non-serializable types (no `Date`, no class instances, no `Buffer`). Keep it a plain object tree.

---

## Patterns to Follow

### Pattern 1: Sequential pipeline with early throw

**What:** Each step in `/api/analyze` is awaited in sequence. If any step throws, the global error middleware catches it and the subsequent steps do not run.

**When:** Always — do not use Promise.all for the analyze pipeline. Steps are data-dependent (ai.service needs analysis.service output).

```typescript
// route handler — orchestration only, no business logic
router.post('/analyze', upload.single('pdf'), async (req, res, next) => {
  try {
    const resumeStructure = await pdfService.parse(req.file.buffer);
    const { score, gaps } = await analysisService.analyze(resumeStructure, req.body.jobDescription);
    const rewrites = await aiService.rewriteBullets(resumeStructure, req.body.jobDescription, gaps);
    res.json({ score, gaps, rewrites, resumeStructure });
  } catch (err) {
    next(err);  // global error middleware handles formatting
  }
});
```

**Why:** Services throw typed errors (`PdfParseError`, `OpenAiTimeoutError`). The route handler's only responsibility is sequencing and delegating to `next(err)`.

### Pattern 2: Batch OpenAI call (not streaming) for bullet rewrites

**What:** Send all bullets in a single GPT-4o call with a structured prompt, receive all rewrites in one JSON response. Do not stream.

**When:** For this architecture — batch is strongly preferred over streaming.

**Rationale:**

| Factor | Streaming | Batch |
|--------|-----------|-------|
| Client complexity | High — SSE or WebSocket needed | Low — standard JSON response |
| Partial failure handling | Complex — where did the stream break? | Simple — the call either returns or throws |
| Stateless compatibility | Awkward — stream state is implicit | Natural — request/response cycle |
| Latency perception | Better (first token appears fast) | Worse (user waits for all bullets) |
| Implementation effort | High | Low |

For a stateless v1 with no persistent sessions, streaming adds complexity with limited benefit. Show a loading indicator. Use batch.

**Implementation pattern:**

```typescript
// ai.service.ts
async rewriteBullets(
  resumeStructure: ResumeStructure,
  jobDescription: string,
  gaps: string[]
): Promise<RewrittenBullet[]> {
  const bullets = extractAllBullets(resumeStructure);  // flatten to { id, text }[]

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(bullets, jobDescription, gaps) }
    ],
    timeout: 30_000,  // 30s — surface timeout as retriable error, not crash
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  return validateAndMapRewrites(parsed, bullets);  // throw if schema invalid
}
```

**Token budget consideration:** A typical resume has 20–40 bullets averaging ~20 words each. With job description, this fits comfortably in GPT-4o's 128k context. No chunking needed for v1.

**Timeout handling:** Set `timeout: 30_000` at the SDK level. Catch `OpenAI.APITimeoutError` in the error middleware and return a 504 with `{ retryable: true, preservedAnalysis: null }` so the client can prompt the user to retry without re-uploading the PDF.

### Pattern 3: Structured output via JSON mode

**What:** Use `response_format: { type: 'json_object' }` with GPT-4o and validate the schema before returning from `ai.service`.

**Why:** Without structured output, bullet rewrites may arrive in inconsistent formats (numbered lists, prose, mixed). JSON mode guarantees parseable output. Schema validation inside `ai.service` ensures the route handler receives a typed array, not a string to parse.

**Schema to request from GPT-4o:**

```json
{
  "rewrites": [
    { "id": "experience-0-item-0-bullet-0", "rewritten": "Led migration of monolith to microservices..." },
    { "id": "experience-0-item-0-bullet-1", "rewritten": "Reduced deploy time by 60% via CI/CD pipeline..." }
  ]
}
```

### Pattern 4: Global error middleware as the only catch boundary

**What:** Services throw; route handlers pass to `next(err)`; one middleware at the end of the Express chain formats all errors.

**Why:** Scattered try/catch in every route handler leads to inconsistent error shapes. Centralized middleware enforces a single error contract.

```typescript
// error.middleware.ts
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof PdfParseError) {
    return res.status(422).json({ error: 'pdf_unparseable', message: err.message });
  }
  if (err instanceof OpenAiTimeoutError) {
    return res.status(504).json({ error: 'ai_timeout', retryable: true, message: err.message });
  }
  // default
  console.error(err);
  return res.status(500).json({ error: 'internal_error' });
});
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Services calling other services

**What:** `ai.service.ts` imports and calls `analysis.service.ts` directly.

**Why bad:** Creates hidden coupling. Testing `ai.service` now requires a real or mocked `analysis.service`. Build order becomes unclear.

**Instead:** The route handler orchestrates the sequence. Services are pure functions of their inputs.

### Anti-Pattern 2: Storing layout metadata separately from content

**What:** Keeping two parallel data structures — one for text (for AI) and one for layout (for DOCX generation).

**Why bad:** They diverge. A bullet at index 3 in the content structure may not map to index 3 in the layout structure after edits.

**Instead:** `ResumeStructure` is one unified tree. Each `Bullet` node carries both its `text` and its `style`. The text is replaced during generation; the style is preserved.

### Anti-Pattern 3: Regenerating style from PDF on the /api/generate call

**What:** Calling `pdf.service` again during DOCX generation to re-extract layout.

**Why bad:** The original PDF is not available on the /api/generate call (stateless). The route accepts JSON only.

**Instead:** `ResumeStructure` (including all style information) is echoed back in the /api/analyze response, stored client-side, and sent back in the /api/generate request body. This is the explicit design.

### Anti-Pattern 4: Streaming when the client has no stream consumer

**What:** Using `stream: true` in the OpenAI SDK and piping SSE to the client before the frontend is wired for it.

**Why bad:** SSE requires a different client fetch pattern (`EventSource` or custom streaming fetch), different error handling, and the wizard's Step 2 state cannot be populated until all bullets are received anyway.

**Instead:** Batch call. Add streaming only if user research shows the loading wait is a top complaint — and only after the wizard UI is complete.

### Anti-Pattern 5: Random bullet IDs

**What:** Using `crypto.randomUUID()` to generate bullet IDs in `pdf.service`.

**Why bad:** IDs must be stable across calls. If the user re-analyzes the same PDF, the bullet at position `experience-0-item-0-bullet-2` should always get the same ID. This enables future features (diffing, caching) and makes debugging tractable.

**Instead:** Derive IDs from structural position: `${sectionIndex}-${itemIndex}-${bulletIndex}`.

---

## Build Order Dependencies

The components have clear data-dependency ordering. The build order directly follows.

```
Phase 1: ResumeStructure type definition
  └─ No code dependencies. Define first. All services depend on it.
     Unblocks: everything.

Phase 2: pdf.service.ts
  └─ Depends on: ResumeStructure type
     Produces: ResumeStructure from PDF Buffer
     Unblocks: analysis.service, ai.service (need real data to develop against)

Phase 3: analysis.service.ts
  └─ Depends on: ResumeStructure type (text fields only)
     Produces: { score, gaps }
     No OpenAI dependency — purely algorithmic (TF-IDF or keyword matching)
     Can be developed in parallel with pdf.service once types are defined

Phase 4: ai.service.ts
  └─ Depends on: ResumeStructure type, gaps from analysis.service
     Produces: RewrittenBullet[]
     OpenAI integration lives here only
     Best developed with realistic ResumeStructure fixtures from pdf.service

Phase 5: /api/analyze route
  └─ Depends on: all three upstream services
     Wires: pdf → analysis → ai → JSON response
     Integration point — all upstream services must be individually testable first

Phase 6: docx.service.ts
  └─ Depends on: ResumeStructure type (style fields), approved bullets
     Produces: DOCX Buffer
     Can be developed in parallel with Phase 4 once types are defined
     No AI dependency

Phase 7: /api/generate route
  └─ Depends on: docx.service
     Wires: approved bullets + resumeStructure → DOCX download

Phase 8: Express app assembly + error middleware
  └─ Depends on: both routes
     Final integration and error shape contract

Phase 9: Frontend (3-step wizard)
  └─ Depends on: both API routes being functional
     Can be scaffolded in parallel but integration requires working API
```

**Critical path:** `ResumeStructure types → pdf.service → ai.service → /api/analyze → frontend`

`docx.service` and `analysis.service` are off the critical path and can be built in parallel with ai.service development.

---

## Scalability Considerations

This is a v1 stateless tool. Scalability is noted for architectural awareness, not v1 requirements.

| Concern | At 10 users | At 1K users | At 10K users |
|---------|-------------|-------------|--------------|
| OpenAI latency | Acceptable (30s timeout) | Acceptable | Add job queue (BullMQ) to prevent request pile-up |
| Memory (PDF + DOCX in RAM) | Fine | Fine | Stream buffers; don't hold all in memory simultaneously |
| Stateless round-trip (resumeStructure in client) | Fine | Fine | ResumeStructure could be large (50–200KB JSON); consider server-side temporary storage with TTL |
| Single Express process | Fine | Fine | Horizontal scaling requires no changes (no shared state) |
| OpenAI rate limits | Low risk | Monitor | Implement retry with exponential backoff |

---

## Sources

- Architecture derived from PROJECT.md specification (HIGH confidence — first-party)
- Express monolith service isolation patterns: established Node.js convention (HIGH confidence)
- OpenAI SDK batch vs streaming tradeoffs: based on SDK v4 patterns and stateless architecture constraints (MEDIUM confidence — verify against current openai npm package docs)
- ResumeStructure design: derived from OOXML spec requirements for DOCX reconstruction and PDF text extraction conventions (MEDIUM confidence)
- GPT-4o JSON mode (`response_format: { type: 'json_object' }`): available since GPT-4 Turbo, present in GPT-4o (HIGH confidence — verify exact parameter name against current SDK)
