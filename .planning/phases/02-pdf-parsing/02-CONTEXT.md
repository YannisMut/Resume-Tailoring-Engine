# Phase 2: PDF Parsing - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

`pdf.service.ts` — extract a `ResumeStructure` (text + layout metadata) from a user-supplied PDF buffer. Reject bad inputs with specific, differentiated error codes. No UI work. Feeds `POST /api/analyze`.

</domain>

<decisions>
## Implementation Decisions

### Section Detection

- **Primary heading signal:** font size — a line is a section heading if its fontSize >= 1.2x the median body font size across the page. Bold alone is not sufficient.
- **Item vs bullet within a section:** indent level — flush-left or slightly indented lines are item titles/subtitles; further-indented lines are bullets.
- **Header block:** capture and preserve the document header (name, contact info lines) as a `header` field on `ResumeStructure`. Each line in the header carries its `TextStyle` so Phase 5 (DOCX generation) can reconstruct it faithfully. **This requires adding `header` to the `ResumeStructureSchema` in `packages/types/src/resume.ts`.**

### File Upload & Validation Pipeline

- **Storage:** Multer `memoryStorage` — file is buffered in RAM for the duration of the request; no temp files written to disk.
- **Size limit:** enforced by Multer config (`limits.fileSize: 10 * 1024 * 1024`) before the buffer reaches `pdf.service.ts`. Multer throws on excess; middleware maps it to a `pdf_too_large` (413) error.
- **File type validation:** middleware layer — check both `Content-Type` header AND first 4 bytes (`%PDF` magic bytes). Multer `fileFilter` alone is insufficient (client-set MIME type is spoofable). Rejection happens before the service.

### Error Granularity

Different error codes per failure mode so the frontend can branch to targeted help text:

| Failure Mode | Code | HTTP Status |
|---|---|---|
| Non-PDF file | `pdf_not_pdf` | 415 |
| File > 10MB | `pdf_too_large` | 413 |
| Scanned / image-only PDF | `pdf_scanned` | 422 |
| Password-protected PDF | `pdf_encrypted` | 422 |
| Corrupt / unparseable PDF | `pdf_corrupt` | 422 |

- **Scanned detection:** after pdfjs-dist parses the file, if 0 text items are returned across all pages → throw `pdf_scanned`.
- **Password detection:** catch pdfjs-dist's `PasswordException` and translate to `pdf_encrypted`. No pre-check needed.

### Partial Parse Fallback

- **On structural ambiguity:** reject the whole PDF — throw `pdf_corrupt`. A partial `ResumeStructure` passed downstream risks garbage AI rewrites and DOCX output. Fail loud.
- **Minimum viable structure:** at least 1 named section containing at least 1 bullet. Below this threshold → reject.
- **Missing font metadata:** fall back to sensible defaults (`Calibri`, `22` half-points = 11pt, `bold: false`, `italic: false`, `color: "#000000"`, no spacing overrides) when pdfjs-dist cannot extract font info for a text span. Log the fallback at warn level. Parsing succeeds — DOCX generation uses the fallback style.

### Claude's Discretion

- Exact Y-proximity threshold for grouping text spans into logical lines (before heading detection runs)
- Specific multer config shape and middleware ordering in Express
- Internal clustering algorithm for mapping pdfjs-dist text items to `SectionItem` boundaries

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `AppError` / `PdfParseError` (`apps/api/src/middleware/error.middleware.ts`): `PdfParseError` exists but uses a single `pdf_unparseable` code — needs to be extended or replaced with the differentiated error classes decided above.
- `errorMiddleware` (`apps/api/src/middleware/error.middleware.ts`): already the global catch boundary — no changes needed, new error classes just need to extend `AppError`.
- `ResumeStructureSchema` (`packages/types/src/resume.ts`): needs a `header` field added — array of `{ text: string; style: TextStyle }` lines.

### Established Patterns

- Services throw `AppError` subclasses; `errorMiddleware` catches and formats. No try/catch in route handlers — Express 5 propagates async throws automatically.
- Zod schemas are single source of truth — TypeScript types inferred via `z.infer`. Any extension to `ResumeStructureSchema` follows this pattern.
- All `@resume/types` fields are JSON-serializable primitives only (stateless round-trip requirement).

### Integration Points

- **New route:** `POST /api/analyze` — currently commented out in `apps/api/src/index.ts`. Phase 2 wires up this route with multer middleware and calls `pdf.service.ts`.
- **New file:** `apps/api/src/services/pdf.service.ts`
- **New dependency:** `multer` (file upload), `pdfjs-dist` (PDF parsing) — both need to be added to `apps/api/package.json`.
- **Type change:** `packages/types/src/resume.ts` — add `header` field to `ResumeStructureSchema`.

</code_context>

<specifics>
## Specific Ideas

- Header block should appear at the top of the DOCX output with the same formatting as the input — name line prominent, contact info line smaller. The `header` field in `ResumeStructure` is the vehicle for this.
- Error codes are designed so the frontend wizard (Phase 6) can show targeted help: "This PDF appears to be scanned — try a PDF exported from Word or Google Docs" vs "This file is password-protected — remove the password and try again."

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-pdf-parsing*
*Context gathered: 2026-03-08*
