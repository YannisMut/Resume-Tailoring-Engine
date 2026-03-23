# AI Resume Tailoring Engine

## What This Is

A full-stack web application that takes a base resume (PDF) and a job description, analyzes keyword alignment, identifies ATS gaps, rewrites all bullet points using GPT-4o, and outputs an editable DOCX that preserves the original resume's visual layout. Built for personal use and as a public tool for any job seeker.

## Core Value

A user uploads their resume and a job description and gets back a layout-identical DOCX with AI-rewritten bullets — ready to submit, not just a list of suggestions.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can upload a resume PDF and paste a job description
- [ ] System extracts ResumeStructure (sections, bullets, fonts, spacing, margins) from PDF
- [ ] System computes a match score (0–100) against the job description
- [ ] System identifies ATS keyword gaps between resume and job description
- [ ] System rewrites all bullet points using GPT-4o to improve alignment
- [ ] User can review original vs. rewritten bullets and edit any rewrite before approving
- [ ] User can download a DOCX that uses approved bullets and preserves original visual layout
- [ ] Invalid or unparseable PDFs are rejected with a clear error message
- [ ] Gemini timeout surfaces a retry hint; analysis is preserved so the user doesn't re-upload

### Out of Scope

- User accounts / authentication — stateless v1, compute and discard
- Database persistence — no storage in v1
- Mobile app — web-first
- Support for DOCX/HTML resume input — PDF only in v1
- Bulk / batch processing — one resume at a time

## Context

- **Architecture:** Monolith with 4 core services: `pdf.service.ts`, `ai.service.ts`, `analysis.service.ts`, `docx.service.ts`
- **ai.service.ts is the only file that touches Gemini** — fully isolated and swappable
- **ResumeStructure** is the core data type separating content from layout; it flows from parse → analyze → generate
- Two API routes: `POST /api/analyze` (PDF + JD → score, gaps, rewrites, ResumeStructure) and `POST /api/generate` (approved bullets + ResumeStructure → DOCX binary)
- **3-step wizard UI:** Step 1 = upload, Step 2 = review/edit bullets, Step 3 = download DOCX
- **Stateless:** no DB, no sessions — everything lives in the request/response cycle

## Constraints

- **AI provider**: Gemini 2.5 Flash only in v1 — isolated in `ai.service.ts` for future swapping
- **Input format**: PDF resumes only — no DOCX/HTML input
- **No persistence**: stateless v1 — user must re-upload if session is lost (mitigated by preserving analysis state on error)
- **Error handling**: services throw, one global middleware catches — no scattered try/catch

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| ResumeStructure as central type | Decouples content from layout; enables independent service development | — Pending |
| ai.service.ts isolation | Makes AI provider fully swappable without touching other services | — Pending |
| Stateless v1 (no DB) | Reduces complexity; validates core value before adding persistence | — Pending |
| PDF input only | Simpler parsing story for v1; DOCX input adds complexity with little v1 gain | — Pending |
| Express monolith (not microservices) | 4 services are tightly coupled via ResumeStructure; monolith is simpler and correct | — Pending |

---
*Last updated: 2026-03-08 after initialization*
