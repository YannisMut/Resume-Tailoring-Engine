# Roadmap: AI Resume Tailoring Engine

## Overview

Seven phases deliver the complete pipeline: a shared type foundation gates everything; PDF parsing provides the entry-point data; algorithmic analysis scores keyword alignment; AI rewrites transform the bullets; DOCX generation reconstructs the layout; the frontend wizard wires all services into a usable product; and a final polish phase adds the differentiator features that build user trust. Phases 1–2 are strictly sequential. Phases 4 and 5 can run in parallel once Phase 2 produces real fixtures. Phase 6 integration unblocks after Phases 4 and 5 are complete. Phase 7 is additive.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Monorepo scaffold, shared types (ResumeStructure), and Express/Next.js app shells (completed 2026-03-09)
- [x] **Phase 2: PDF Parsing** - Parse resume PDFs into ResumeStructure with spatial layout metadata; validate all bad-input cases (completed 2026-03-10)
- [ ] **Phase 3: Analysis** - Compute keyword match score and gap list algorithmically; enforce JD input constraints
- [ ] **Phase 4: AI Rewrites** - Rewrite bullets with GPT-4o using constrained prompts; handle retries and timeout recovery
- [ ] **Phase 5: DOCX Generation** - Reconstruct layout-faithful DOCX from approved bullets and ResumeStructure
- [ ] **Phase 6: Frontend Wizard** - Wire all services into a 3-step Next.js wizard (Upload → Review → Download)
- [ ] **Phase 7: Polish** - Add differentiator features: diff view, keyword highlighting, section-level scope control

## Phase Details

### Phase 1: Foundation
**Goal**: Monorepo, shared types, and app shells are in place so all services can be built and tested independently
**Depends on**: Nothing (first phase)
**Requirements**: (infrastructure — no direct user-facing requirements; gates all downstream phases)
**Success Criteria** (what must be TRUE):
  1. Both apps (Next.js and Express) start without errors in the monorepo
  2. `packages/types` exports `ResumeStructure`, `RewrittenBullet`, and `AnalysisResult` with all required fields (text content + layout metadata)
  3. Zod schemas validate all shared types at runtime
  4. Global Express error middleware catches and formats service errors without scattered try/catch
  5. TypeScript strict mode passes with zero errors across all packages
**Plans**: 5 plans

Plans:
- [ ] 01-01-PLAN.md — Monorepo scaffold, workspace config, and Wave 0 test infrastructure
- [ ] 01-02-PLAN.md — packages/types: ResumeStructure, RewrittenBullet, AnalysisResult Zod schemas
- [ ] 01-03-PLAN.md — apps/api: Express 5 shell with typed error middleware
- [ ] 01-04-PLAN.md — apps/web: Next.js 16 shell with @resume/types import validation
- [ ] 01-05-PLAN.md — Phase 1 verification: full test suite + turbo dev startup checkpoint

### Phase 2: PDF Parsing
**Goal**: Users can upload a PDF resume and the system produces a faithful ResumeStructure — or rejects the file with a clear, specific error message
**Depends on**: Phase 1
**Requirements**: INPUT-01, INPUT-02, INPUT-03, INPUT-04, INPUT-05
**Success Criteria** (what must be TRUE):
  1. User can select a PDF file via the file picker and it is accepted for processing
  2. Non-PDF files are rejected before processing with a message identifying the problem
  3. Files over 10MB are rejected before processing with a message identifying the problem
  4. Scanned/image-only PDFs (no extractable text) are rejected with a message explaining why they cannot be processed
  5. Password-protected PDFs are rejected with a clear error message
**Plans**: 5 plans

Plans:
- [ ] 02-01-PLAN.md — ResumeStructureSchema: add header field (HeaderLine[] with TextStyle)
- [ ] 02-02-PLAN.md — Error classes: 5 differentiated PDF error codes (pdf_not_pdf, pdf_too_large, pdf_scanned, pdf_encrypted, pdf_corrupt)
- [ ] 02-03-PLAN.md — Upload middleware: multer memoryStorage + magic bytes validator (INPUT-02, INPUT-03)
- [ ] 02-04-PLAN.md — pdf.service.ts: pdfjs-dist Y-proximity clustering + ResumeStructure extraction (INPUT-01, INPUT-04, INPUT-05)
- [ ] 02-05-PLAN.md — POST /api/analyze route: wire all components + integration tests + human verify

### Phase 3: Analysis
**Goal**: The system computes a meaningful keyword match score and gap list from resume content and job description
**Depends on**: Phase 2
**Requirements**: ANAL-01, ANAL-02, ANAL-03
**Success Criteria** (what must be TRUE):
  1. User sees a match score between 0 and 100 labeled as "keyword alignment" (not "ATS score")
  2. User sees a list of keywords present in the job description but absent from the resume
  3. Job descriptions longer than 5,000 characters are rejected or truncated with a visible message before analysis runs
**Plans**: TBD

### Phase 4: AI Rewrites
**Goal**: All resume bullets are rewritten by GPT-4o to improve keyword alignment without inventing false claims, and failures are recoverable without re-uploading
**Depends on**: Phase 3
**Requirements**: AI-01, AI-02, AI-03, AI-04
**Success Criteria** (what must be TRUE):
  1. Every bullet in the resume has a rewritten version targeting the job description's keywords
  2. Rewritten bullets do not introduce metrics, percentages, timeframes, or technologies not present in the original bullet
  3. Transient OpenAI failures retry automatically up to 3 times before surfacing an error
  4. When an OpenAI timeout occurs, the user sees a retry hint and the analysis state (score, gaps, existing rewrites) is preserved — no re-upload required
**Plans**: TBD

### Phase 5: DOCX Generation
**Goal**: Users can download a DOCX that is visually indistinguishable from their original resume, using their approved bullets
**Depends on**: Phase 2 (for ResumeStructure layout fields)
**Requirements**: OUT-01
**Success Criteria** (what must be TRUE):
  1. The downloaded DOCX uses the approved (or edited) bullet text for every section
  2. Fonts, paragraph spacing, margins, and section structure in the DOCX match the original resume's visual layout
  3. The DOCX opens correctly in Microsoft Word and Google Docs without formatting errors
**Plans**: TBD

### Phase 6: Frontend Wizard
**Goal**: Users can complete the full workflow — upload, paste a job description, review/edit rewrites, and download a DOCX — in a single browser session without losing state
**Depends on**: Phase 4, Phase 5
**Requirements**: INPUT-06, REVIEW-01, REVIEW-02, REVIEW-04, OUT-02, OUT-03
**Success Criteria** (what must be TRUE):
  1. User can paste or type a job description into a plain textarea on the upload step
  2. A processing indicator is visible for the entire duration of the AI call (typically 15–30 seconds)
  3. User sees original and rewritten bullets side-by-side for every bullet in the resume
  4. User can approve, reject, or inline-edit each rewritten bullet individually before downloading
  5. User can revert any edited or rejected bullet back to the AI rewrite with one click
  6. If DOCX generation fails, the score, gaps, and rewrites remain visible so the user can retry without re-uploading
**Plans**: TBD

### Phase 7: Polish
**Goal**: Differentiator features are in place that make AI changes transparent, ATS keyword insertion visible, and rewrite scope controllable
**Depends on**: Phase 6
**Requirements**: REVIEW-03, REVIEW-05, REVIEW-06
**Success Criteria** (what must be TRUE):
  1. User sees a character-level diff for each rewritten bullet showing exactly what the AI changed
  2. Gap keywords that were inserted by the AI are visually highlighted in the rewritten bullets
  3. User can choose which resume sections are included in the AI rewrite before submitting
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7
Note: Phase 5 can be developed in parallel with Phase 4 (both depend on Phase 2 fixtures).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 5/5 | Complete   | 2026-03-09 |
| 2. PDF Parsing | 5/5 | Complete   | 2026-03-10 |
| 3. Analysis | 0/TBD | Not started | - |
| 4. AI Rewrites | 0/TBD | Not started | - |
| 5. DOCX Generation | 0/TBD | Not started | - |
| 6. Frontend Wizard | 0/TBD | Not started | - |
| 7. Polish | 0/TBD | Not started | - |
