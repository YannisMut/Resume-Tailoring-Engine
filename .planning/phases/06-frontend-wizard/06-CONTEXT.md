# Phase 6: Frontend Wizard - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the 3-step Next.js wizard UI — Upload (PDF + JD), Review (approve/edit bullets), Download (generate + save DOCX) — wiring the completed backend services into a usable browser flow. No new backend logic. State lives in-memory for the duration of the session.

</domain>

<decisions>
## Implementation Decisions

### Styling
- Tailwind CSS — install tailwindcss + PostCSS plugin
- No component library — build all components from scratch
- Visual tone: clean minimal — white background, dark text, subtle gray borders, no decorative elements
- Polish level: highly polished — animations, hover states, careful spacing, good typography. This tool handles something users trust (their resume), so it needs to feel professional.

### Wizard Navigation
- Single-page wizard: all 3 steps render from one `page.tsx`, current step controlled by React state. AnalysisResult stays in memory — no sessionStorage, no URL serialization of the large API payload.
- No back navigation: going back means starting over (upload a new resume). Prevents stale states where JD changed but bullets are old.
- Visible step progress indicator at the top: simple "1. Upload → 2. Review → 3. Download" header bar showing the current step.

### Upload Step Layout
- Two-column layout on Step 1: PDF drop zone on the left, JD textarea on the right. Both visible simultaneously.
- PDF upload: drag-and-drop zone + file picker. Large dashed-border drop target with file icon, "Drop your resume here or click to browse", and "PDF only · max 10MB" hint.
- PDF error display: inline in the drop zone — error replaces zone content with icon + specific message (using error codes from Phase 2: pdf_not_pdf → "This isn't a PDF", pdf_too_large → "File exceeds 10MB", pdf_scanned → "This PDF appears to be scanned — try one exported from Word or Google Docs", pdf_encrypted → "This PDF is password-protected — remove the password and try again"). Drop zone border turns red. "Try another file" resets it.
- Submit button ("Analyze Resume →") below the two-column inputs.

### Processing State (Step 1 → Step 2 transition)
- Full-screen or page-level loading state during the AI call (expected 15–30s).
- Processing indicator must be visible for the entire duration — not just a brief flash.
- Claude's Discretion: exact copy and visual treatment of the loading state (spinner, progress message, etc.)

### Review Step Interaction
- Layout: card per bullet, side-by-side columns. Left column = original, right column = AI rewrite. Grouped by section with the section name as a header above each group.
- Bullets are grouped visually by resume section (e.g. "EXPERIENCE › Software Engineer at Acme").
- Default state: all rewrites are pending (neither accepted nor rejected yet).
- Accept/Reject model: Accept (✓) and Reject (✗) buttons on each rewrite card. Accept = use the AI rewrite in the DOCX. Reject = use the original text. Revert button appears after a decision is made and restores the pending state.
- Inline editing: clicking Edit (or the rewrite text itself) turns the right column into an editable textarea. Save/Cancel buttons below. Saved edited text counts as approved. Revert restores the AI rewrite.
- Bulk action: "Accept All" button at the top of the review step — accepts all rewrites at once. No "Reject All" (edge case, adds noise).
- Sticky "Generate DOCX →" button — accessible without scrolling to the bottom.

### Download Step
- Auto-generates DOCX on arrival at Step 3 (carried forward from Phase 5 context).
- Loading state while generating, then Download button appears.
- Output filename: `resume_tailored.docx` (carried forward from Phase 5 context).
- Generation failure: inline error + Retry button. User stays on Step 3, bullet edits preserved (no re-upload).
- Score and gaps from analysis remain visible on Step 3 so context isn't lost.

### Claude's Discretion
- Loading state copy and visual design during the AI call
- Exact spacing, typography scale, and color palette within the "clean minimal" constraint
- Sticky header/footer implementation details
- Transition/animation specifics (step changes, card state changes)

</decisions>

<specifics>
## Specific Ideas

- Step 1 is two-column (upload left, JD right) rather than stacked — user wants both inputs visible simultaneously, which feels more like a workspace than a form wizard.
- Highly polished means real hover states, smooth transitions, and visual feedback on every interaction — not just functional.
- The drop zone inline error pattern with "Try another file" reset gives targeted, contextual help per error code rather than generic failure messages.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/app/page.tsx`: bare placeholder — will be replaced entirely with the wizard
- `apps/web/app/layout.tsx`: minimal shell, can add Tailwind globals import here
- `@resume/types`: `AnalysisResult`, `ResumeStructure`, `RewrittenBullet` — all JSON-serializable, available in the browser via `transpilePackages`

### Established Patterns
- `apps/web/next.config.ts`: `transpilePackages: ['@resume/types']` already set — no change needed
- `tsconfig.json` uses `module: ESNext` + `moduleResolution: bundler` — standard for Next.js 16
- No CSS framework installed yet — Tailwind install is the first task

### Integration Points
- `POST /api/analyze` (Express, port 3001): receives `multipart/form-data` with PDF + jobDescription string → returns `{ score, gaps, rewrites: RewrittenBullet[], resumeStructure: ResumeStructure }`
- `POST /api/generate` (Express, port 3001): receives `{ resumeStructure, bullets: RewrittenBullet[] }` as JSON → returns DOCX binary (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
- CORS or proxy config may be needed for browser → Express calls (Next.js dev runs on 3000, API on 3001)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-frontend-wizard*
*Context gathered: 2026-03-12*
