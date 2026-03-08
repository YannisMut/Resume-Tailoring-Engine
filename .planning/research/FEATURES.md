# Feature Landscape

**Domain:** AI Resume Tailoring — PDF-to-DOCX pipeline with ATS keyword analysis
**Researched:** 2026-03-08
**Confidence:** MEDIUM (WebSearch and Bash denied; findings from training data on Jobscan, Teal, Rezi, Resume.io, Kickresume, and community research as of Aug 2025. Flagged where uncertain.)

---

## Table Stakes

Features users expect. Missing = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| PDF upload with format validation | Every competitor accepts PDF; users arrive with PDF. Rejecting silently is fatal. | Low | Must give a clear error on unparseable PDFs, not a 500. |
| Job description text input | The JD is the anchor of all tailoring. Without it, no analysis is possible. | Low | Plain textarea is fine; URL-fetch is a differentiator, not table stakes. |
| Match score (0–100) | Jobscan popularized this; users now arrive expecting a number to anchor their review. | Medium | Score must visually communicate urgency (e.g., red/yellow/green). |
| Keyword gap list | Users need to know *what* is missing before they trust the rewrites. | Medium | Show both present and absent keywords. Absent is more actionable. |
| Side-by-side original vs. rewritten bullets | Users will not approve content they cannot compare. Blind replacement destroys trust. | Medium | Original on left, rewrite on right. Must be visually obvious which changed. |
| Inline edit of rewritten bullets | Users always need to fix AI output. A read-only result is a dead end. | Medium | Contenteditable or textarea; full WYSIWYG is overkill for bullets. |
| Per-bullet approve / reject control | Users want selective acceptance. All-or-nothing is too blunt. | Medium | Checkbox or toggle per bullet. "Accept all" as a convenience action. |
| DOCX download | This is the product's entire value. If the download fails or the file is corrupted, there is no product. | High | Must preserve layout; cannot be a plain-text DOCX. |
| Stateless error recovery | Users lose progress on timeout. Must preserve analysis state so they do not re-upload. | Medium | Keep parsed ResumeStructure + score + gaps in client memory (or sessionStorage) across retry. |
| Clear rejection messages for invalid PDFs | Scanned PDFs, image-only PDFs, and password-protected PDFs are common. Silently failing is a support nightmare. | Low | Specific messages: "No extractable text — is this a scanned PDF?", "Password-protected PDFs are not supported." |

---

## Differentiators

Features that set the product apart. Users do not expect them but value them when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Layout-identical DOCX output | Most competitors produce a generic template. Returning the user's *own* formatting is rare and immediately trusted. | High | The `ResumeStructure` approach — capturing fonts, spacing, margins at parse time — is the key to this. It's the hardest thing to replicate. |
| ATS keyword highlighting in the preview | Show *where* in the rewritten bullets the gap keywords were inserted. Builds trust by making the AI's reasoning visible. | Medium | Highlight inserted terms in a distinct color in the review step. |
| Bullet-level diff view | Show exactly which words changed within a bullet, not just the full before/after text. | Medium | Character-level diff (e.g., `diff-match-patch`). Reduces cognitive load in the review step. |
| Section-level rewrite control | Let users scope rewrites to specific sections (e.g., "only rewrite Work Experience, not Summary"). | Medium | Checkbox per section in Step 1. Reduces AI hallucination risk on sections the user wants unchanged. |
| Match score delta | Show how the score *would* change if the user accepts all suggested rewrites. Makes the value of accepting rewrites concrete. | High | Requires re-scoring the candidate document after rewrites, before download. |
| Rewrite tone/style selector | Let users pick a tone (e.g., "concise", "impact-focused", "technical"). Different job families need different voices. | Medium | 3–4 options max. Implemented as a system-prompt modifier in `ai.service.ts`. |
| Missing keyword injection callout | Explicitly tell the user "these 5 keywords from the JD appear nowhere in your resume — we added them where appropriate." | Low | Surface the gap list from `analysis.service.ts` as a user-facing callout in Step 2. |
| Processing time estimate | AI calls can take 10–20s. A spinner with no progress indicator causes users to abandon. | Low | "Analyzing your resume... this takes about 15 seconds." Fake or real progress bar both work here. |
| One-click "revert to original" | Let users reset a bullet to the original after editing. Reduces anxiety about committing to rewrites. | Low | Store original bullet text alongside the rewrite; show a "reset" link. |

---

## Anti-Features

Features to explicitly NOT build in v1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| User accounts / authentication | Adds auth infrastructure, session management, and security surface before core value is validated. Users won't expect auth for a free tool. | Stateless: discard everything after download. Note clearly: "Your resume is not stored." |
| Database persistence | Couples the product to a specific storage layer before the data model is stable. | Keep everything in the request/response cycle. Revisit in v2 if users ask for history. |
| Resume builder / editor (full formatting) | Turns the product into a resume editor, which is a completely different (and saturated) product category. | Stay focused: input is always a user's existing resume, not a from-scratch editor. |
| ATS simulator / score prediction | Tools like Jobscan have invested years in ATS parsing models. Building a credible ATS simulator is a multi-month project and attracts skepticism if the model is naive. | Show keyword gap analysis (what's missing) instead of predicting ATS pass/fail. |
| Multi-resume management / history | Requires auth + persistence + a resume vault UI. Well beyond v1. | Single session, stateless. "Download and done." |
| DOCX or HTML resume input | Each input format requires a separate parsing pipeline. DOCX parsing is non-trivial and adds edge cases (embedded images, comments, revision tracking). | PDF only in v1. Explicitly state this on the upload step. |
| Cover letter generation | A separate product. Adds a second AI task, second output format, and second review UX. | Out of scope. Can share the `ai.service.ts` pattern in v2. |
| LinkedIn profile import | Requires OAuth + LinkedIn API, and LinkedIn actively throttles scraping. High friction for low v1 value. | Job description paste is sufficient. |
| Bulk / batch processing | One resume at a time keeps the UX simple and the infrastructure minimal. Batch requires async jobs, status polling, and email notifications. | Sequential, single-session use only. |
| Mobile-native experience | The review step (side-by-side comparison, inline editing) requires screen real estate. Mobile is a degraded UX for this task. | Build for desktop-first. Responsive is fine; optimized-mobile is not required. |
| AI model selection exposed to users | Exposing GPT-4 vs. GPT-3.5 as a user choice adds cognitive load and support burden. | Pin to GPT-4o in v1; swap in `ai.service.ts` if needed. Never expose model choice in UI. |
| Real-time streaming output | Streaming bullet rewrites as they generate creates an animated but fragile UX. Requires SSE or WebSocket; adds complexity with minimal user benefit for a ~15s task. | Single response: show a loading state, then render all bullets at once. |

---

## Feature Dependencies

```
PDF Upload
  → PDF validation (required first; blocks everything)
  → PDF parse → ResumeStructure

ResumeStructure
  → Keyword gap analysis (analysis.service.ts)
  → Match score computation
  → GPT-4o bullet rewrites (ai.service.ts)
  → DOCX generation (docx.service.ts)

Match score + keyword gaps
  → Displayed in Step 2 (review) to give context for the rewrites

Bullet rewrites
  → Side-by-side review UI (Step 2)
  → Per-bullet approve/reject/edit

Approved bullets + ResumeStructure
  → DOCX generation → download (Step 3)

Error recovery state
  → Requires: ResumeStructure, match score, keyword gaps, rewrites stored client-side
  → Enables: retry without re-upload on OpenAI timeout
```

---

## ATS / Keyword Gap Analysis — Expectations

This deserves special attention because it's the feature users most frequently misunderstand.

**What users expect:**
- A concrete score that tells them if their resume will pass ATS screening.
- A list of "missing" keywords they should add.
- The score to go up after they accept rewrites.

**What is actually feasible in v1:**
- Keyword overlap score: `(JD keywords found in resume) / (total JD keywords)` expressed as 0–100. This is fast, deterministic, and honest.
- Keyword gap list: JD keywords absent from resume. Actionable. Easy to display.
- Score delta preview: run the same overlap calculation on the rewritten bullets before download. Shows improvement.

**What to explicitly NOT promise:**
- "This will pass ATS" — no tool can guarantee this without knowing the target company's ATS configuration.
- "ATS-optimized" in marketing copy without defining the methodology — invites skepticism and support requests.

**Recommended framing:** "Match score" and "keyword alignment" rather than "ATS score" or "ATS pass rate." This is more accurate and harder to argue with.

---

## MVP Recommendation

Prioritize these for the first shippable version:

1. PDF upload with format validation and clear error messages (gates everything)
2. Job description text input (free textarea)
3. Match score (0–100) + keyword gap list (context for rewrites)
4. GPT-4o bullet rewrites with side-by-side review, per-bullet approve/reject/edit
5. Layout-identical DOCX download (the primary differentiator — earns trust immediately)
6. Processing time indicator (reduces abandonment during the ~15s AI call)
7. Stateless error recovery (preserves state on OpenAI timeout)

Defer to v2:
- Match score delta preview (requires re-scoring after rewrites; adds a second analysis pass)
- Bullet-level diff view (valuable but polish, not core)
- Section-level rewrite control (valuable for power users; adds UI complexity)
- Tone/style selector (easy to add once core rewrite quality is validated)
- ATS keyword highlighting in rewritten text (nice-to-have; adds display logic without changing the output)

---

## Sources

- Training data: Jobscan, Teal, Rezi, Kickresume, Resume.io, ResumeWorded feature analysis (as of Aug 2025)
- Training data: UX research patterns for document upload/review workflows
- Training data: ATS system behavior (Workday, Greenhouse, Lever, iCIMS) as of Aug 2025
- Confidence: MEDIUM — WebSearch was unavailable for current-year verification. Core feature expectations in this domain are stable and unlikely to have changed materially. ATS scoring methodology claims flagged as LOW confidence and hedged accordingly in recommendations.
- **Gap:** Could not verify whether any major competitor launched layout-preserving DOCX output in H2 2025 — this differentiator claim should be spot-checked before the product is marketed.
