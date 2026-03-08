# Project Research Summary

**Project:** AI Resume Tailoring Engine
**Domain:** AI-assisted document transformation (PDF → GPT-4o rewrite → DOCX)
**Researched:** 2026-03-08
**Confidence:** MEDIUM (library versions require npm verification; core patterns are well-established)

## Executive Summary

The Resume Tailoring Engine is a stateless, session-scoped pipeline that takes a PDF resume and a job description, computes keyword alignment, rewrites bullets via GPT-4o, and produces a layout-faithful DOCX. The dominant pattern for this class of tool is a clean separation between a Next.js frontend (3-step wizard) and an Express backend that exposes exactly two routes: `POST /api/analyze` and `POST /api/generate`. The entire product value proposition depends on one central data type — `ResumeStructure` — which must carry both text content and layout metadata (fonts, spacing, margins) from the PDF parse step through to DOCX reconstruction. This type must be designed completely before any service implementation begins.

The recommended approach is a Turborepo monorepo with a shared `packages/types` package. The primary differentiator — layout-identical DOCX output — is achievable using `pdfjs-dist` for coordinate-aware PDF parsing and `docx` (js-docx) for programmatic DOCX generation, with `ResumeStructure` as the bridge. GPT-4o with JSON mode structured outputs handles bullet rewrites. The architecture is intentionally stateless: `ResumeStructure` round-trips through the client between the two API calls, keeping the server free of session state. This is both the simplest and most scalable v1 design for this use case.

The two highest risks are PDF layout destruction (most parsers return flat text, not spatial metadata) and GPT-4o hallucination drift (the model invents metrics and technologies not in the original bullet). Both are mitigated by clear upfront decisions: use `pdfjs-dist`'s `getTextContent()` with transform arrays for spatial extraction, and constrain the rewrite prompt explicitly to prohibit invention of any factual claims. The third major risk is DOCX fidelity — if `ResumeStructure` is designed without layout fields, the DOCX generation phase cannot reconstruct the visual style and the core value proposition fails.

---

## Key Findings

### Recommended Stack

The stack is a TypeScript-first monorepo (Turborepo) with Next.js 14 (App Router) for the frontend and Express 4 on Node.js 20 LTS for the backend. The critical library choices are `pdfjs-dist` 4.x (the only mainstream Node.js PDF library that exposes per-character layout metadata via `getTextContent()`) and `docx` 8.x (the only pure-JavaScript DOCX library with sufficient formatting API coverage to reconstruct layout from a data structure). The OpenAI SDK 4.x with GPT-4o and `response_format: { type: 'json_object' }` is the canonical approach for structured bullet rewrites. Zod 3.x validates `ResumeStructure` at every service boundary. All version numbers require npm verification before installation.

**Core technologies:**
- **Next.js 14 (App Router):** Frontend wizard UI — server components for static shell, client components for interactive steps
- **Express 4 + Node.js 20 LTS:** Backend API — right-sized for a 2-route API; no framework overhead
- **pdfjs-dist 4.x:** PDF parsing — the ONLY Node.js library exposing per-character layout metadata (x/y coordinates, font name, font size) via `getTextContent()` with transform arrays
- **docx 8.x (js-docx):** DOCX generation — programmatic API for fonts, paragraph spacing, margins, section properties; TypeScript-first
- **openai SDK 4.x + GPT-4o:** Bullet rewrites — structured output via JSON mode; batch (not streaming) for stateless compatibility
- **Turborepo 2.x:** Monorepo orchestration — task caching, parallel builds; required for sharing `ResumeStructure` type between apps
- **Zod 3.x:** Runtime validation — TypeScript-inferred schemas at service boundaries; avoids duplicate type definitions
- **tsx 4.x / tsup 8.x:** Dev runner / backend bundler — faster than ts-node, native ESM
- **vitest 1.x:** Testing — TypeScript-native, Turborepo pipeline compatible

See [STACK.md](.planning/research/STACK.md) for full rationale, alternatives considered, and version verification checklist.

### Expected Features

The product's must-have features form a linear dependency chain: PDF upload gates everything; keyword analysis gives context for rewrites; side-by-side review with per-bullet approve/reject/edit is the trust mechanism; and the layout-identical DOCX download is the entire value proposition. Missing any of these makes the product feel incomplete or broken. The explicit anti-features are equally important: no auth, no database, no resume builder, no streaming, no mobile-first UX — all of these would add significant complexity without delivering core value in v1.

**Must have (table stakes):**
- PDF upload with format validation and explicit rejection messages for scanned/password-protected PDFs
- Job description text input (plain textarea)
- Match score (0–100) presented as "keyword alignment estimate" — not "ATS score"
- Keyword gap list showing absent keywords (more actionable than present ones)
- Side-by-side original vs. rewritten bullets
- Per-bullet approve / reject / inline edit controls
- Layout-identical DOCX download (the primary differentiator)
- Processing time indicator (AI calls take 15–30s; spinner with no feedback causes abandonment)
- Stateless error recovery (preserve `ResumeStructure` + score + gaps in client state across OpenAI timeout)

**Should have (competitive differentiators):**
- Bullet-level character diff view (`diff-match-patch`) — makes AI changes immediately visible, builds trust
- ATS keyword highlighting in rewritten bullets — shows where gap keywords were inserted
- Section-level rewrite control — scope rewrites to specific sections; reduces hallucination risk
- Rewrite tone/style selector (3–4 options as system-prompt modifiers)
- One-click "revert to original" per bullet

**Defer (v2+):**
- Match score delta preview (requires a second analysis pass post-rewrite)
- User accounts, persistence, history
- DOCX or HTML input formats
- Cover letter generation
- Mobile-optimized experience
- Real-time streaming output

See [FEATURES.md](.planning/research/FEATURES.md) for full feature dependency graph and ATS scoring methodology discussion.

### Architecture Approach

The architecture is an Express monolith with 4 isolated services (`pdf`, `analysis`, `ai`, `docx`) wired by 2 route handlers. No service imports another — all orchestration lives in routes. `ResumeStructure` is the single shared type in `packages/types` that flows through every service; it must carry both text content (for analysis/AI) and layout metadata (for DOCX reconstruction). The client owns state between the two API calls — `ResumeStructure` is echoed in the `/api/analyze` response and sent back in the `/api/generate` request body. The server is fully stateless.

**Major components:**
1. `pdf.service.ts` — Parses PDF Buffer into `ResumeStructure` with spatial metadata; uses `pdfjs-dist` `getTextContent()` with transform arrays
2. `analysis.service.ts` — Computes keyword match score and gap list from `ResumeStructure` + job description; purely algorithmic, no AI
3. `ai.service.ts` — The ONLY file that calls OpenAI; rewrites bullets via GPT-4o JSON mode; throws typed errors for global middleware
4. `docx.service.ts` — Reconstructs DOCX from approved bullets + `ResumeStructure` layout fields; no AI dependency
5. `packages/types` — Shared `ResumeStructure`, `RewrittenBullet`, `AnalysisResult` type definitions; consumed by both apps
6. Next.js wizard (3 steps) — Upload → Review → Download; stores `AnalysisResult` in React state between API calls

**Critical path:** `ResumeStructure type → pdf.service → ai.service → /api/analyze → frontend`

`docx.service` and `analysis.service` are off the critical path and can be built in parallel.

See [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) for data flow diagrams, `ResumeStructure` type definition, patterns, and anti-patterns.

### Critical Pitfalls

1. **PDF coordinate-unaware parsing destroys layout** — Using `pdf-parse` or basic text mode returns flat strings with no spatial metadata. Multi-column layouts and side-by-side sections interleave incorrectly. Prevention: use `pdfjs-dist` `getTextContent()` directly (not through `pdf-parse`) and build a spatial clustering step grouping text spans by Y-proximity and X-indentation.

2. **GPT-4o invents metrics and technologies (hallucination drift)** — Without hard constraints, GPT-4o adds invented percentages and technologies to sound impressive. Prevention: explicitly instruct "do not invent any metrics, percentages, timeframes, or technologies not present in the original bullet"; show a bullet-level diff in the review UI to make drift visible.

3. **DOCX fidelity fails if ResumeStructure lacks layout fields** — If `ResumeStructure` is designed without font name, font size, bold/italic, paragraph spacing, and margin fields, `docx.service` cannot reconstruct the visual layout. Prevention: design `ResumeStructure` with all layout fields as first-class properties before writing any service code.

4. **ResumeStructure designed too narrowly requires breaking changes across all services** — The type flows through 4 services; mid-build type changes halt all downstream work. Prevention: define the complete interface (including optional fields for future use) before any service implementation; use TypeScript strict mode; never use `any`.

5. **File upload endpoint is an attack surface** — No size limit causes memory exhaustion on large PDFs; no magic byte validation accepts malicious files. Prevention: enforce 10MB limit at multer layer; validate `%PDF-` magic bytes; set parse timeout of 10s; never expose raw parser exceptions to clients.

See [PITFALLS.md](.planning/research/PITFALLS.md) for 14 documented pitfalls with detection signals and phase-specific warnings.

---

## Implications for Roadmap

Based on the architecture's build-order dependencies and pitfall phase mappings, the following phase structure is recommended. The ordering is dictated by data dependencies: everything downstream of `ResumeStructure` is blocked until the type is finalized; everything downstream of `pdf.service` is blocked until real parsed data is available for development and testing.

### Phase 1: Foundation — Monorepo, Types, and Shared Infrastructure
**Rationale:** `ResumeStructure` is the load-bearing type that all 4 services depend on. Building it correctly upfront prevents cascading breaking changes. Monorepo scaffold must exist before any app code. This phase has no external dependencies and no AI involvement — it is pure TypeScript design.
**Delivers:** Turborepo monorepo with `packages/types` containing the full `ResumeStructure`, `RewrittenBullet`, and `AnalysisResult` interfaces; Express app scaffold with error middleware; Next.js app scaffold; Zod schemas for all shared types.
**Addresses:** PDF upload infrastructure (multer, file size limit, magic byte validation)
**Avoids:** Pitfall 8 (narrow ResumeStructure requiring breaking changes); sets up the error middleware contract for Pitfall 5 (file upload security)

### Phase 2: PDF Parsing Service
**Rationale:** `pdf.service.ts` is the entry point for all resume data. No other service can be built with real data until this exists. This is the highest-risk service — spatial clustering and layout extraction are the hardest problems in the stack.
**Delivers:** `pdf.service.ts` that produces a faithful `ResumeStructure` from a PDF buffer, including text content, font metadata, spacing, and margins; validation for scanned PDFs (empty text) and password-protected PDFs; a test suite with 5+ real-world resume layouts.
**Uses:** `pdfjs-dist` 4.x `getTextContent()` with transform arrays; spatial clustering by Y-proximity and X-indentation
**Avoids:** Pitfall 1 (coordinate-unaware parsing); Pitfall 11 (silent password-protected PDF failure); Pitfall 12 (silent scanned PDF failure)

### Phase 3: Analysis Service and Keyword Scoring
**Rationale:** `analysis.service.ts` has no OpenAI dependency and is purely algorithmic — it can be built and validated independently using fixtures from Phase 2. Completing this before `ai.service` means the keyword gap data is ready to feed into prompt construction.
**Delivers:** `analysis.service.ts` with keyword match score (phrase-level, not single-word) and gap list; score labeled as "keyword alignment estimate" in all interfaces; `POST /api/analyze` partial (parse + analyze, no AI yet).
**Uses:** `ResumeStructure` text fields only; optional: OpenAI `text-embedding-3-small` for semantic synonym matching
**Avoids:** Pitfall 4 (score presented as authoritative ATS signal); Pitfall 13 (JD length cap — enforce 5,000 character limit here)

### Phase 4: AI Rewrite Service
**Rationale:** `ai.service.ts` requires real `ResumeStructure` fixtures (from Phase 2) and keyword gaps (from Phase 3) to develop and validate prompts. The prompt design is the second-highest-risk item in the project and requires iteration with real data.
**Delivers:** `ai.service.ts` with GPT-4o batch rewrites via JSON mode; system prompt with explicit no-hallucination constraints; pronoun voice validation (regex post-processing); retry with exponential backoff (3 attempts); 30s timeout surfaced as retriable `OpenAiTimeoutError`; bullet batching (5–8 per call) for token budget control; complete `POST /api/analyze` route.
**Uses:** `openai` SDK 4.x; `response_format: { type: 'json_object' }`; structured bullet IDs from `ResumeStructure`
**Avoids:** Pitfall 2 (hallucination drift); Pitfall 6 (OpenAI timeout loses user state); Pitfall 7 (prompt token overflow); Pitfall 10 (pronoun voice inconsistency)

### Phase 5: DOCX Generation Service
**Rationale:** `docx.service.ts` depends only on `ResumeStructure` layout fields and approved bullet text — both available after Phase 2 and Phase 4 respectively. It is off the critical path and can be developed in parallel with Phase 4, but integration requires Phase 4 to be complete.
**Delivers:** `docx.service.ts` that produces a layout-faithful DOCX from approved bullets + `ResumeStructure`; font name normalization (PDF embedded font names → safe DOCX equivalents); per-paragraph style properties (no reliance on Word's "Normal" style); `POST /api/generate` route with binary download response; visual regression test checklist (fonts, spacing, margins, page count).
**Uses:** `docx` 8.x npm package; `ResumeStructure` layout fields (font, size, bold, italic, spacing, margins)
**Avoids:** Pitfall 3 (DOCX layout fidelity failure); Pitfall 9 (line wrapping page count change); Pitfall 14 (raw XML template approach)

### Phase 6: Frontend Wizard (Next.js)
**Rationale:** The frontend integration requires both API routes to be functional. Scaffold can be built earlier, but integration testing blocks on Phases 4 and 5.
**Delivers:** 3-step Next.js wizard (Upload → Review → Download); `AnalysisResult` stored in React state between API calls; processing time indicator during AI call; side-by-side bullet review with per-bullet approve/reject/edit; inline revert to original; keyword gap list display; match score visualization (red/yellow/green); DOCX download trigger.
**Avoids:** Pitfall 6 (state preserved across OpenAI timeout — `ResumeStructure` in React state, not discarded); all table-stakes UX expectations from FEATURES.md

### Phase 7: Polish and Differentiators
**Rationale:** These features add competitive value but are not required for the first working end-to-end flow. Build only after the core pipeline is stable and tested.
**Delivers:** Bullet-level character diff view (`diff-match-patch`); ATS keyword highlighting in rewritten bullets; section-level rewrite scope control; one-click revert per bullet; rewrite tone/style selector (system prompt modifier).
**Addresses:** Differentiator features from FEATURES.md

### Phase Ordering Rationale

- Phases 1–2 are strictly sequential: type design gates all services; PDF parsing is the entry point for real data
- Phase 3 can overlap with the tail of Phase 2 (using PDF fixtures)
- Phases 4 and 5 can run in parallel once Phase 2 produces real fixtures
- Phase 6 integration unblocks after Phases 4 and 5 are complete
- Phase 7 is additive and non-blocking

The architecture's explicit build order (ARCHITECTURE.md) confirms this sequencing: `ResumeStructure types → pdf.service → analysis.service + ai.service (parallel) → /api/analyze → docx.service → /api/generate → frontend`.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (PDF Parsing):** The spatial clustering algorithm — grouping text spans by Y-proximity into lines, then inferring section structure — has no off-the-shelf solution and requires significant implementation research. The `pdfjs-dist` `getTextContent()` API is the correct tool; the clustering logic on top of it is bespoke and high-risk. Recommend a `/gsd:research-phase` pass before implementation.
- **Phase 5 (DOCX Generation):** Font name normalization (PDF embedded font names are mangled subsets like "ABCDEF+Calibri") is a documented pain point with limited tooling. The mapping strategy needs research before implementation. May benefit from a `/gsd:research-phase` pass.
- **Phase 4 (AI Rewrites):** Prompt engineering for constrained rewriting is iterative. The constraint prompt design should be validated with 20+ real bullets before the review UI is built — but this is an empirical process, not a research gap.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Turborepo + Next.js + Express monorepo setup is extremely well-documented. Standard scaffold.
- **Phase 3 (Analysis Service):** Keyword overlap scoring is algorithmic and well-understood. No novel patterns needed.
- **Phase 6 (Frontend Wizard):** Standard React state management pattern with a wizard UI. No domain-specific research needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Library choices are stable and well-reasoned; version numbers (pdfjs-dist 4.x, docx 8.x, openai 4.x, turbo 2.x) require npm verification before installation — training data cutoff Aug 2025 |
| Features | MEDIUM | Competitive landscape analysis based on training data (Jobscan, Teal, Rezi, Resume.io as of Aug 2025); WebSearch was unavailable for current-year verification. Core feature expectations are stable. |
| Architecture | HIGH | Structural patterns (service isolation, stateless round-trip, sequential pipeline with early throw, global error middleware) are established Express conventions; `ResumeStructure` design derived from OOXML spec requirements |
| Pitfalls | HIGH (PDF/DOCX/AI), MEDIUM (ATS scoring) | PDF and DOCX failure modes are well-documented; OpenAI hallucination patterns are from production experience; ATS scoring reliability is community knowledge only |

**Overall confidence:** MEDIUM — the architecture and pitfall guidance is high-confidence; the primary uncertainty is in library versions and whether a competitor launched layout-preserving DOCX output in H2 2025 (which would affect differentiation claims).

### Gaps to Address

- **Library version verification:** All version numbers in STACK.md must be confirmed against npm before installation. Specifically: `pdfjs-dist`, `docx`, `openai`, `turbo`, `tsx`, `tsup`. Do this before Phase 1 begins.
- **pdfjs-dist Node.js entrypoint:** The library has separate browser and Node.js builds. The Node.js entrypoint (`pdfjs-dist/legacy/build/pdf.js`) and worker configuration must be verified against the installed version's documentation before Phase 2 begins.
- **Competitive differentiation check:** FEATURES.md flags that it could not verify whether any competitor launched layout-preserving DOCX output in H2 2025. Spot-check this claim before marketing the feature as unique.
- **ATS keyword scoring methodology:** The "keyword alignment estimate" framing is the right hedge, but the specific scoring algorithm (phrase-level vs. single-word, whether to use embeddings for semantic similarity) should be decided explicitly in Phase 3 planning rather than left open.

---

## Sources

### Primary (HIGH confidence)
- PROJECT.md specification — first-party architecture decisions; component boundaries and data flow
- Mozilla PDF.js documentation (mozilla.github.io/pdf.js) — `getTextContent()` API, `TextItem` structure, transform arrays
- docx (js-docx) documentation (docx.js.org) — paragraph and run properties API
- OpenAI Node.js SDK (github.com/openai/openai-node) — JSON mode, timeout parameters, error types
- Express.js documentation — error middleware patterns
- OWASP File Upload Cheat Sheet — file validation security requirements

### Secondary (MEDIUM confidence)
- Training data: Turborepo documentation (turbo.build/repo/docs) — monorepo task pipeline patterns
- Training data: Jobscan, Teal, Rezi, Resume.io feature analysis (as of Aug 2025) — competitive feature expectations
- Training data: ATS system behavior (Workday, Greenhouse, Lever, iCIMS) — keyword scoring expectations
- OpenAI prompt engineering guide (platform.openai.com/docs) — hallucination mitigation patterns

### Tertiary (LOW confidence)
- Community knowledge: ATS scoring algorithm behavior — no public ATS API exists; heuristics only
- Competitive differentiation: layout-preserving DOCX output as a differentiator — unverified for H2 2025

---
*Research completed: 2026-03-08*
*Ready for roadmap: yes*
