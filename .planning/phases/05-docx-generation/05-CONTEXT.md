# Phase 5: DOCX Generation - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Build `docx.service.ts` and `POST /api/generate` — consumes a `ResumeStructure` (from Phase 2) and a list of `RewrittenBullet[]` (from Phase 4) to produce a downloadable DOCX binary that visually matches the original resume. Also includes Step 3 of the web wizard (the download screen).

Creating posts, auth, persistence, or any other capability is out of scope.

</domain>

<decisions>
## Implementation Decisions

### Layout fidelity
- Substitute closest system font when the PDF's font isn't available in DOCX (e.g. Garamond → Times New Roman, Gotham → Calibri)
- Apply spacing exactly from ResumeStructure: `lineSpacingPt`, `spaceBefore`, `spaceAfter`, and all margin values from `meta`
- Non-reproducible PDF elements (decorative rules, graphics, multi-column layouts) are silently omitted — no error
- Minimum bar: all approved bullet text present, sections in correct order, fonts and spacing close enough that a hiring manager sees the same resume. Pixel-perfect not required.

### Non-bullet content
- Header block: render each header line using its captured `TextStyle` (fontName, fontSize, bold, italic, color) — name renders large/bold, contact info smaller, matching the original
- Section items (job title rows, company/date lines): pass through original text with their captured `TextStyle`
- Item-only sections (Skills, Education with no bullets): same treatment as regular items, no special detection or formatting logic

### Unapproved bullets
- `approved: false` → use the original bullet text in the DOCX (only explicitly accepted changes appear)
- Users can freely edit bullet text in Step 2 (editable field per bullet); edited text counts as approved and goes into the DOCX

### Download UX
- Step 3 auto-generates the DOCX on arrival; user sees a loading state, then a Download button appears when ready
- Generation failure: inline error on Step 3 with a Retry button — user stays on Step 3, bullet edits are not lost
- Output filename: `resume_tailored.docx`

### Claude's Discretion
- Font substitution mapping table (which fonts map to which)
- DOCX library selection (`docx` npm package or equivalent)
- Exact loading state copy and visual treatment
- Error message copy for generation failures

</decisions>

<specifics>
## Specific Ideas

No specific references — open to standard approaches for the DOCX library and Step 3 UI.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TextStyleSchema` (`packages/types/src/resume.ts`): fontName, fontSize (half-points), bold, italic, color, lineSpacingPt?, spaceBefore?, spaceAfter? — exactly what DOCX needs for per-paragraph styling
- `ResumeStructureSchema.meta`: pageWidth, pageHeight, marginTop/Bottom/Left/Right — maps directly to DOCX page setup
- `ResumeStructureSchema.header`: HeaderLine[] with text + TextStyle — ready to render as styled header paragraphs
- `RewrittenBulletSchema`: id, original, rewritten, approved — `approved` flag drives which text goes into DOCX
- `AppError` + global `errorMiddleware` (`apps/api/src/middleware/error.middleware.ts`): throw a typed error in the service, middleware handles the response

### Established Patterns
- Services throw, one global error middleware catches — `docx.service.ts` should follow the same pattern
- Stateless: `ResumeStructure` round-trips through the client; `POST /api/generate` receives both `ResumeStructure` and approved bullets in the request body
- All `@resume/types` fields are JSON-serializable primitives — safe to send as JSON in the generate request body
- `ai.service.ts` is the only file touching OpenAI — `docx.service.ts` should be the only file touching the DOCX library

### Integration Points
- New route: `POST /api/generate` — registers alongside `POST /api/analyze` in `apps/api/src/index.ts`
- New service: `apps/api/src/services/docx.service.ts`
- New web page: Step 3 of the wizard in `apps/web/`
- No new types needed — `ResumeStructure` and `RewrittenBullet[]` cover all inputs

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-docx-generation*
*Context gathered: 2026-03-10*
