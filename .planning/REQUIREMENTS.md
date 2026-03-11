# Requirements: AI Resume Tailoring Engine

**Defined:** 2026-03-08
**Core Value:** User uploads resume PDF + job description and gets back a layout-identical DOCX with AI-rewritten bullets — ready to submit, not just suggestions.

## v1 Requirements

### File Input

- [x] **INPUT-01**: User can upload a resume PDF via file picker
- [x] **INPUT-02**: System rejects non-PDF files with a clear error message before processing
- [x] **INPUT-03**: System rejects files over 10MB with a clear error message before processing
- [x] **INPUT-04**: System detects scanned/image-only PDFs and shows a helpful error (no text content to extract)
- [x] **INPUT-05**: System detects and rejects password-protected PDFs with a clear error message
- [ ] **INPUT-06**: User can paste or type a job description into a plain textarea

### Analysis

- [x] **ANAL-01**: System computes a keyword alignment score (0–100) between resume and job description, labeled as "match score" — not "ATS score"
- [x] **ANAL-02**: System produces a keyword gap list showing terms present in the JD but absent in the resume
- [x] **ANAL-03**: System limits job description input to 5,000 characters to prevent token overflow

### AI Rewrites

- [x] **AI-01**: System rewrites all resume bullets using GPT-4o to improve keyword alignment with the job description
- [x] **AI-02**: AI rewrite prompt explicitly prohibits inventing metrics, percentages, timeframes, or technologies not present in the original bullet
- [x] **AI-03**: System retries failed OpenAI calls with exponential backoff (3 attempts) before surfacing an error
- [x] **AI-04**: System surfaces an OpenAI timeout as a retriable error with a user-facing retry hint; analysis state is preserved so the user does not need to re-upload

### Review UI

- [ ] **REVIEW-01**: User sees original and rewritten bullets side-by-side for every bullet in the resume
- [ ] **REVIEW-02**: User can approve, reject, or inline-edit each rewritten bullet individually before generating the DOCX
- [ ] **REVIEW-03**: User sees a character-level diff view highlighting exactly what the AI changed in each bullet (via diff-match-patch)
- [ ] **REVIEW-04**: User can revert any rewritten bullet to the original with one click
- [ ] **REVIEW-05**: Gap keywords are visually highlighted in rewritten bullets to show where they were inserted
- [ ] **REVIEW-06**: User can select which resume sections to include in the AI rewrite (section-level scope control)

### Output

- [x] **OUT-01**: User can download a DOCX that uses the approved bullets and preserves the original resume's visual layout (fonts, spacing, margins, section structure)
- [ ] **OUT-02**: System shows a processing indicator during the AI call (expected 15–30s) to prevent abandonment
- [ ] **OUT-03**: If DOCX generation fails, analysis state (score, gaps, rewrites) is preserved in the UI so the user can retry without re-uploading

## v2 Requirements

### Polish & Differentiators

- **POL-01**: Rewrite tone/style selector (3–4 tone options as system prompt modifiers: professional, concise, achievement-focused, etc.)
- **POL-02**: Match score delta preview showing projected score improvement after accepting rewrites (requires second analysis pass)

### Persistence

- **PERS-01**: User accounts with resume upload history
- **PERS-02**: Saved tailoring sessions — resume + JD + approved bullets stored for future reference

### Input Formats

- **FMT-01**: DOCX resume input support
- **FMT-02**: LinkedIn profile import

### Content Generation

- **GEN-01**: Cover letter generation tailored to the job description

## Out of Scope

| Feature | Reason |
|---------|--------|
| User authentication | Stateless v1 — adds complexity without validating core value |
| Database / persistence | Compute and discard in v1; sessions are ephemeral |
| Mobile-optimized UX | Web-first; mobile adds layout/UX complexity with limited v1 gain |
| Batch / multi-resume processing | One resume at a time in v1; batch is a v2+ use case |
| Real-time streaming output | Stateless wizard pattern conflicts with streaming; adds client complexity |
| "Passes ATS" guarantee claims | ATS internals are opaque; keyword overlap scoring is honest and defensible |
| DOCX or HTML resume input | PDF-only simplifies parsing story for v1 |
| Cover letter generation | Out of core value scope for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INPUT-01 | Phase 2 | Complete |
| INPUT-02 | Phase 2 | Complete |
| INPUT-03 | Phase 2 | Complete |
| INPUT-04 | Phase 2 | Complete |
| INPUT-05 | Phase 2 | Complete |
| INPUT-06 | Phase 6 | Pending |
| ANAL-01 | Phase 3 | Complete |
| ANAL-02 | Phase 3 | Complete |
| ANAL-03 | Phase 3 | Complete |
| AI-01 | Phase 4 | Complete |
| AI-02 | Phase 4 | Complete |
| AI-03 | Phase 4 | Complete |
| AI-04 | Phase 4 | Complete |
| REVIEW-01 | Phase 6 | Pending |
| REVIEW-02 | Phase 6 | Pending |
| REVIEW-03 | Phase 7 | Pending |
| REVIEW-04 | Phase 6 | Pending |
| REVIEW-05 | Phase 7 | Pending |
| REVIEW-06 | Phase 7 | Pending |
| OUT-01 | Phase 5 | Complete |
| OUT-02 | Phase 6 | Pending |
| OUT-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-08 — traceability updated after roadmap creation*
