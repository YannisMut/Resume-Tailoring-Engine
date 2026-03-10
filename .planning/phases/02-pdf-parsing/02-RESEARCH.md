# Phase 2: PDF Parsing - Research

**Researched:** 2026-03-08
**Domain:** PDF parsing with pdfjs-dist, file upload with multer v2, spatial text clustering
**Confidence:** MEDIUM-HIGH (core API verified; clustering algorithm synthesized from first principles)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Storage:** Multer `memoryStorage` — file is buffered in RAM; no temp files written to disk.
- **Size limit:** Enforced by Multer `limits.fileSize: 10 * 1024 * 1024`; Multer throws `MulterError` with code `LIMIT_FILE_SIZE`; middleware maps to `pdf_too_large` (413).
- **File type validation:** Middleware layer — check both `Content-Type` header AND first 4 bytes (`%PDF` magic bytes). `fileFilter` alone is insufficient.
- **PDF parser:** `pdfjs-dist` (not yet installed — research supplies the version and import pattern).
- **Section heading signal:** `fontSize >= 1.2x` median body font size across the page.
- **Item vs bullet:** indent level — x-coordinate of text items.
- **Header block:** new `header` field on `ResumeStructureSchema` — array of `{ text: string; style: TextStyle }` lines.
- **Error codes:** `pdf_not_pdf` (415), `pdf_too_large` (413), `pdf_scanned` (422), `pdf_encrypted` (422), `pdf_corrupt` (422).
- **Scanned detection:** 0 text items extracted across all pages → `pdf_scanned`.
- **Password detection:** catch pdfjs `PasswordException` → `pdf_encrypted`.
- **Partial parse:** reject whole PDF on structural ambiguity → `pdf_corrupt`.
- **Minimum viable:** ≥1 named section with ≥1 bullet.
- **Missing font metadata:** fallback to `Calibri`, `22` half-points (11pt), `bold: false`, `italic: false`, `color: "#000000"`.

### Claude's Discretion
- Exact Y-proximity threshold for grouping text spans into logical lines.
- Specific multer config shape and middleware ordering in Express.
- Internal clustering algorithm for mapping pdfjs-dist text items to `SectionItem` boundaries.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INPUT-01 | User can upload a resume PDF via file picker | Multer v2 `single('resume')` + `memoryStorage`; `req.file.buffer` available in handler |
| INPUT-02 | System rejects non-PDF files with a clear error message before processing | Post-multer middleware reads `req.file.buffer.slice(0, 4)` and checks for `%PDF`; also checks `req.file.mimetype` header |
| INPUT-03 | System rejects files over 10MB with a clear error message before processing | Multer `limits.fileSize`; caught as `MulterError` with code `LIMIT_FILE_SIZE`; mapped to `pdf_too_large` (413) |
| INPUT-04 | System detects scanned/image-only PDFs and shows a helpful error | After pdfjs parse: count all `TextItem` objects across all pages; if total === 0 → `pdf_scanned` (422) |
| INPUT-05 | System detects and rejects password-protected PDFs with a clear error message | pdfjs throws `PasswordException` from `getDocument().promise`; catch and map to `pdf_encrypted` (422) |
</phase_requirements>

---

## Summary

Phase 2 uses two established libraries — multer v2 for upload handling and pdfjs-dist v5 for PDF text extraction — plus a hand-crafted spatial clustering algorithm to turn raw text spans into a structured `ResumeStructure`. The main complexity lies in that clustering algorithm, which has no off-the-shelf equivalent for the resume domain.

**pdfjs-dist v5** (current: 5.5.207, March 2025) provides `getDocument()`, `getPage()`, `getTextContent()`, and exports `PasswordException`/`InvalidPDFException` as named exports from `pdfjs-dist/legacy/build/pdf.mjs`. In Node.js, run without a web worker — set `GlobalWorkerOptions.workerSrc = ''` (empty string, forces single-thread mode) or point to the worker file path. Pass PDF data as `Uint8Array` from `req.file.buffer`.

**multer v2.1.1** preserves the v1 API surface (`memoryStorage`, `fileFilter`, `single()`, `MulterError`) but with two important changes: (1) mime detection now uses the file-type library internally against actual bytes (not just the client header), exposing `req.file.mimetype` reliably; and (2) DoS vulnerabilities from v1 are patched. The `fileFilter` callback still runs on metadata only (before buffering completes), so magic-bytes validation MUST be done in a separate post-upload middleware against `req.file.buffer`.

**Spatial clustering (HIGH RISK):** No library solves the specific problem of grouping pdfjs-dist `TextItem` objects by Y-proximity into logical lines, then classifying those lines as header, section heading, item title, or bullet. The research section below specifies a concrete, implementable algorithm.

**Primary recommendation:** Install `pdfjs-dist@^5.5.207`. Import from `pdfjs-dist/legacy/build/pdf.mjs` using a top-level dynamic `import()` (Node ESM-compatible). Implement the Y-proximity clustering pipeline in `pdf.service.ts` as described below. Keep all error-to-HTTP mapping in the error middleware layer already established.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdfjs-dist | 5.5.207 (latest) | PDF parsing — text extraction, font metadata, page geometry | Mozilla-maintained; 2M weekly downloads; only production-grade pure-JS PDF parser for Node |
| multer | 2.1.1 (already in package.json) | Multipart file upload middleware | Express standard; memoryStorage avoids disk I/O |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/multer | 2.1.0 (already in devDependencies) | TypeScript types for multer | Already present |
| file-type | (multer v2 ships this internally) | Real MIME detection from bytes | Already used internally by multer v2; for the post-upload magic bytes check use Buffer.slice directly (see below — no extra library needed for `%PDF`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pdfjs-dist | pdf-parse | pdf-parse is a thin wrapper around an outdated pdfjs-dist — less control, stale version |
| pdfjs-dist | unpdf | Good for edge runtimes; wraps pdfjs-dist anyway; unnecessary abstraction for Node |
| Manual magic bytes | file-type library | `file-type` is heavier; for PDF the `%PDF` header check is 4 bytes and trivially self-contained |

**Installation:**
```bash
npm install pdfjs-dist@^5.5.207 --workspace=apps/api
```

Note: multer 2.1.1 is already listed in `apps/api/package.json`.

---

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
├── middleware/
│   ├── error.middleware.ts       # EXISTING — extend PdfParseError
│   └── upload.middleware.ts      # NEW — multer config + magic bytes check
├── routes/
│   └── analyze.route.ts          # NEW — POST /api/analyze wires middleware + service
├── services/
│   └── pdf.service.ts            # NEW — pdfjs-dist extraction + clustering
└── __tests__/
    ├── error-middleware.test.ts   # EXISTING
    ├── pdf.service.test.ts        # NEW
    └── analyze.route.test.ts      # NEW
```

### Pattern 1: Multer v2 Upload Middleware

**What:** Configure multer with `memoryStorage` and `limits.fileSize`. Catch `MulterError` in a custom Express error handler registered immediately after the multer middleware call (before `errorMiddleware`). Then run a second middleware that inspects magic bytes.

**When to use:** Any route that accepts a file upload.

```typescript
// apps/api/src/middleware/upload.middleware.ts
import multer from 'multer';
import { AppError } from './error.middleware.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// Step 1: multer middleware — throws MulterError on size exceeded
export const multerSingle = upload.single('resume');

// Step 2: multer error handler (must have 4 args to be an error middleware)
export function multerErrorHandler(
  err: unknown,
  _req: express.Request,
  _res: express.Response,
  next: express.NextFunction,
): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(413, 'pdf_too_large', 'File exceeds the 10 MB limit.'));
    }
    return next(new AppError(400, 'upload_error', err.message));
  }
  next(err);
}

// Step 3: magic bytes + Content-Type check (runs AFTER buffer is populated)
export function validatePdfMagicBytes(
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction,
): void {
  if (!req.file) {
    return next(new AppError(400, 'pdf_missing', 'No file uploaded.'));
  }
  const magic = req.file.buffer.slice(0, 4).toString('ascii');
  if (magic !== '%PDF') {
    return next(new AppError(415, 'pdf_not_pdf', 'Uploaded file is not a PDF.'));
  }
  next();
}
```

Route registration order matters:
```typescript
router.post('/analyze',
  multerSingle,
  multerErrorHandler,
  validatePdfMagicBytes,
  analyzeController,
);
```

**IMPORTANT multer v2 behavioral note:** The `fileFilter` callback runs *before* the file bytes are buffered. It only has access to `req.file.mimetype` (client-provided header, spoofable). Do NOT rely on fileFilter for security validation. The magic bytes check in step 3 is the authoritative type check.

### Pattern 2: pdfjs-dist Node.js Import

**What:** pdfjs-dist v4+ ships ESM-only `.mjs` files. In a Node.js CJS/ESM TypeScript project using `tsx` for dev and `tsup` for build, use a top-level dynamic import from the legacy build path. The legacy build supports older Node.js versions and is the recommended path for server use.

```typescript
// apps/api/src/services/pdf.service.ts
// Use dynamic import once at module load — store the reference
let pdfjsLib: typeof import('pdfjs-dist');

async function getPdfjs() {
  if (!pdfjsLib) {
    // pdfjs-dist v5 is ESM-only; legacy build adds Node.js polyfills
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as string);
    // Disable web worker — runs synchronously in the same thread (correct for Node.js)
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }
  return pdfjsLib;
}
```

**Alternative for Node 22+:** Use static top-level `import` if your tsconfig targets `"module": "NodeNext"`. The `tsconfig.base.json` in this project uses `NodeNext`, so static import should work with `pdfjs-dist/legacy/build/pdf.mjs`.

### Pattern 3: getDocument with Buffer

```typescript
// Source: pdfjs-dist official API + mozilla/pdf.js discussions/17989
const pdfjs = await getPdfjs();
const data = new Uint8Array(buffer); // buffer is req.file.buffer (Node Buffer)
const loadingTask = pdfjs.getDocument({
  data,
  // Suppress "fetchStandardFontData failed" warnings in Node
  standardFontDataUrl: new URL(
    '../../../node_modules/pdfjs-dist/standard_fonts/',
    import.meta.url
  ).toString(),
  verbosity: 0, // suppress all logging
});

let pdf: pdfjs.PDFDocumentProxy;
try {
  pdf = await loadingTask.promise;
} catch (err: unknown) {
  // PasswordException is a named export from pdfjs-dist
  if (err instanceof pdfjs.PasswordException) {
    throw new AppError(422, 'pdf_encrypted', 'PDF is password-protected. Remove the password and try again.');
  }
  if (err instanceof pdfjs.InvalidPDFException) {
    throw new AppError(422, 'pdf_corrupt', 'PDF file is corrupt or cannot be parsed.');
  }
  throw new AppError(422, 'pdf_corrupt', 'PDF file could not be read.');
}
```

**Important:** `PasswordException` and `InvalidPDFException` ARE named exports from `pdfjs-dist`. Use `instanceof` checks. Both classes live in the utility module, re-exported through the main module.

### Pattern 4: getTextContent and TextItem Fields

```typescript
// Source: pdfjs-dist official API documentation
const page = await pdf.getPage(pageNum); // pageNum is 1-indexed
const textContent = await page.getTextContent({
  includeMarkedContent: false,  // exclude non-text markers
  disableNormalization: false,   // keep whitespace normalization
});

// textContent.items is Array<TextItem | TextMarkedContent>
// Filter to only TextItem (which have a 'str' field):
const textItems = textContent.items.filter(
  (item): item is pdfjs.TextItem => 'str' in item
);

// textContent.styles is a Record<string, TextStyle>
// where TextStyle has: { ascent, descent, vertical, fontFamily }
// fontName on each TextItem is a KEY into textContent.styles
```

**TextItem fields:**
| Field | Type | Meaning |
|-------|------|---------|
| `str` | string | The text string for this span |
| `dir` | string | Text direction: `'ltr'`, `'rtl'`, `'ttb'` |
| `transform` | number[6] | CTM matrix `[a, b, c, d, e, f]` |
| `width` | number | Rendered width in user space units |
| `height` | number | Rendered height in user space units |
| `fontName` | string | Key into `textContent.styles` (e.g., `"g_d0_f1"`) |
| `hasEOL` | boolean | Whether a line-break follows this span |

**Font size extraction from transform matrix:**

The transform matrix `[a, b, c, d, e, f]` is a standard PDF CTM:
- `e` = x position of text baseline (left edge)
- `f` = y position of text baseline (PDF coordinates: origin bottom-left)
- Font size ≈ `Math.sqrt(a*a + b*b)` for unrotated text, or simply `Math.abs(a)` when `b === 0` (standard horizontal text)
- **Use `item.height` as the primary font size proxy** — it is in user space units (points) and already computed by pdfjs. For the `TextStyle` half-points field: `fontSize = Math.round(item.height * 2)`.

**CRITICAL CAVEAT:** `fontName` in `TextItem` is a pdfjs-internal identifier (like `"g_d0_f1"`), NOT the actual PDF font name. The actual font family is in `textContent.styles[item.fontName].fontFamily`, but this returns a generic CSS family (`"sans-serif"`, `"serif"`) — not the specific face name.

To get the actual embedded font name (e.g., `"Calibri"`), you must use `page.commonObjs` after calling `page.getOperatorList()`. However, this is complex and the font names extracted this way often carry the subset prefix (e.g., `"ABCDEF+Calibri"`).

### Pattern 5: Font Name Normalization

PDF fonts embedded as subsets have names like `"ABCDEF+Calibri-Bold"`. The prefix is exactly 6 uppercase letters followed by `+`.

```typescript
// Source: PDF specification ISO 32000 §9.6.4 + verified regex pattern
function normalizeFontName(subsetName: string): string {
  // Strip the "ABCDEF+" subset prefix
  const stripped = subsetName.replace(/^[A-Z]{6}\+/, '');
  // Strip -Bold, -Italic, -BoldItalic, -Regular suffixes to get base name
  // (preserve them for bold/italic detection first)
  return stripped;
}

function detectBoldItalic(rawFontName: string): { bold: boolean; italic: boolean } {
  // After stripping subset prefix, check remaining name for style keywords
  const name = rawFontName.replace(/^[A-Z]{6}\+/, '').toLowerCase();
  return {
    bold: /bold|heavy|black/.test(name),
    italic: /italic|oblique/.test(name),
  };
}

function extractBaseFontName(rawFontName: string): string {
  const stripped = normalizeFontName(rawFontName);
  // Remove trailing style descriptors (case-insensitive)
  return stripped
    .replace(/[-,](bold|italic|oblique|heavy|black|regular|light|medium|thin|condensed)/gi, '')
    .trim();
}
```

**IMPORTANT LIMITATION (MEDIUM confidence):** `textContent.styles[item.fontName].fontFamily` returns a generic CSS family name, not the actual face name. To get "Calibri" you need the raw PDF operator list. Given the CONTEXT.md fallback decision (use Calibri 11pt when metadata is missing), the practical approach is:

1. Try to get the actual font name from `page.commonObjs` (complex path).
2. If unavailable, use the fallback: fontName `"Calibri"`, fontSize `22` half-points, bold `false`, italic `false`.

For a resume-specific implementation, strategy 2 (always fallback) is acceptable in Phase 2 and noted as a known limitation for Phase 5 DOCX fidelity.

### Pattern 6: Page Dimensions

```typescript
// Source: pdfjs-dist official examples, github.com/mozilla/pdf.js/issues/12031
const page = await pdf.getPage(1);
const viewport = page.getViewport({ scale: 1.0 });

// viewport.width and viewport.height are in PDF user space units (points, 72 DPI)
// These map directly to the ResumeStructure.meta fields (also in points)
const pageWidth = viewport.width;   // points
const pageHeight = viewport.height; // points
```

For margins, pdfjs does not expose margin metadata directly — margin must be inferred from the minimum x-coordinate of text items across the page (left margin) and the minimum distance from the right edge (right margin). Common A4/Letter resume margins fall between 0.5" and 1" (36–72 points).

```typescript
function inferMargins(textItems: pdfjs.TextItem[], pageWidth: number, pageHeight: number) {
  const xCoords = textItems.map(item => item.transform[4]);
  const rightEdges = textItems.map(item => item.transform[4] + item.width);
  const yCoords = textItems.map(item => item.transform[5]);
  const topEdges = textItems.map(item => item.transform[5] + item.height);

  return {
    marginLeft:   Math.min(...xCoords),
    marginRight:  pageWidth - Math.max(...rightEdges),
    marginBottom: Math.min(...yCoords),
    marginTop:    pageHeight - Math.max(...topEdges),
  };
}
```

---

## Y-Proximity Clustering Algorithm (HIGH RISK ITEM — Concrete Specification)

This is the most complex and risky part of Phase 2. No library provides this. The algorithm below is derived from how spatial document parsers (pdfplumber, pdf.js community discussions) approach the problem, adapted for the resume domain.

### Why It's Hard

pdfjs-dist's `getTextContent()` returns individual text *spans*, not lines. A single visual line like "Software Engineer | Google | 2020–2024" may arrive as 3–15 separate `TextItem` objects depending on font changes, spacing, and how the PDF was authored. These must be merged into logical lines before any structural analysis can run.

### Coordinate System Note

PDF origin is bottom-left. `transform[4]` = x, `transform[5]` = y (baseline). Higher `y` values = higher on the page. Sort items top-to-bottom by DESCENDING `y`.

### Algorithm: 5-Stage Pipeline

**Stage 1: Collect all TextItems across all pages**
```
for each page p in pdf:
  items_p = getTextContent(p).items filtered to TextItem
  assign .pageNum = p to each item
  assign .y = item.transform[5]
  assign .x = item.transform[4]
  assign .fontSize = Math.abs(item.height) || Math.abs(item.transform[0])
collect all items into flat array
```

**Stage 2: Group TextItems into logical lines (Y-proximity clustering)**

Sort all items on the same page by DESCENDING y, then by ascending x (left to right within a line).

```
THRESHOLD = 2.0 points  (Claude's discretion — rationale below)

lines = []
currentLine = []
prevY = null

for each item (sorted desc y then asc x, per page):
  if prevY === null or abs(item.y - prevY) <= THRESHOLD:
    currentLine.push(item)
    prevY = item.y  // use running value, not line start
  else:
    lines.push(finalizeLine(currentLine))
    currentLine = [item]
    prevY = item.y

if currentLine.length > 0: lines.push(finalizeLine(currentLine))
```

**Threshold rationale (LOW confidence — Claude's discretion):**
- Standard body text at 11pt has a baseline-to-baseline gap of ~13–14 points.
- Sub-spans on the same visual line differ in Y by 0–1.5 points (due to superscripts, rounding).
- A threshold of 2.0 points captures same-line variation while staying well below the 12+ point inter-line gap.
- If a font has descenders that shift baseline (e.g., "g", "p"), this can create 1–2pt Y variation within a line — 2.0pt handles it.
- Edge case: subscript text (rare in resumes) has larger Y offsets and will incorrectly split into separate lines. Accept this limitation.

`finalizeLine(items)` → `LogicalLine`:
```typescript
interface LogicalLine {
  text: string;           // items[].str joined with space (trim each)
  x: number;             // min x across items (left edge of line)
  y: number;             // max y across items (baseline of tallest span)
  fontSize: number;      // median fontSize across items
  fontName: string;      // fontName of item with largest fontSize
  hasEOL: boolean;       // any item.hasEOL === true
  pageNum: number;
}
```

**Stage 3: Classify lines into document zones**

Compute `medianBodyFontSize` = median of all `line.fontSize` values across ALL pages (this is the baseline for heading detection per CONTEXT.md decision).

```
HEADING_RATIO = 1.2   // locked in CONTEXT.md
HEADER_THRESHOLD = 1.3 // lines at top of page 1 with fontSize >= medianBodyFontSize

for each line:
  if line.pageNum === 1 AND line.y > (pageHeight - topMargin - 3*medianBodyFontSize):
    zone = 'header'
  else if line.fontSize >= HEADING_RATIO * medianBodyFontSize:
    zone = 'heading'
  else:
    zone = 'body'
```

**Stage 4: Identify indent levels within body lines**

All body lines within a section are compared by x-coordinate to determine indent level:
- Flush left (x ≈ leftMargin ± 3pt): `indent = 0` → item title or subtitle candidate
- First indent (x > leftMargin + 3pt AND x < leftMargin + 30pt): `indent = 1` → bullet candidate
- Further indent: `indent = 2` → sub-bullet (treat as bullet in v1)

**Stage 5: Build ResumeStructure**

```
header = all lines with zone === 'header' → ResumeStructure.header
sections = []
currentSection = null

for each line (in document order, top to bottom):
  if zone === 'header': skip (already captured)
  if zone === 'heading':
    save currentSection if non-null
    currentSection = { heading: line.text, headingStyle: ..., items: [] }
  if zone === 'body' AND currentSection:
    if indent === 0: start new SectionItem (title)
    if indent >= 1: add Bullet to current SectionItem

push final section
```

**Minimum viable check:**
```
if sections.length === 0 OR every section has 0 bullets:
  throw pdf_corrupt
```

### Anti-Patterns to Avoid

- **Sorting all pages together by Y:** PDF Y is page-relative, not document-relative. Always cluster within a single page, then concatenate pages in order.
- **Using `hasEOL` as the line boundary:** `hasEOL` is unreliable — many PDFs set it on every span or never. Use Y-proximity instead.
- **Using `transform[0]` as font size when text is rotated:** For 90°-rotated text, `transform[0]` ≈ 0 and `transform[1]` holds the size. Use `item.height` instead — pdfjs pre-computes this regardless of rotation.
- **Using `textContent.styles[].fontFamily`:** Returns generic CSS family (`"sans-serif"`), not the actual typeface. Use font name heuristics or fallback.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF parsing from bytes | Custom PDF parser | pdfjs-dist | PDF spec is 800 pages; font encoding, compression, cross-reference streams are all complex |
| File upload buffering | Custom multipart parser | multer memoryStorage | Busboy integration, streaming edge cases, LIMIT_FILE_SIZE handling |
| Magic bytes check | External library | `buffer.slice(0, 4).toString('ascii') === '%PDF'` | PDF signature is 4 bytes; no library needed |
| Font subset prefix stripping | Complex parser | `str.replace(/^[A-Z]{6}\+/, '')` | The PDF spec defines this as exactly 6 uppercase letters + `+` |

**Key insight:** The only truly custom code is the spatial clustering algorithm. Everything else has a clear library solution.

---

## Common Pitfalls

### Pitfall 1: Worker Configuration in Node.js
**What goes wrong:** `"No GlobalWorkerOptions.workerSrc specified"` warning floods logs; or worker thread fails to spawn because `Worker` is not available in the Node.js context.
**Why it happens:** pdfjs-dist defaults to web worker mode, designed for browsers.
**How to avoid:** Set `GlobalWorkerOptions.workerSrc = ''` immediately after import. This forces the fake-worker (synchronous) mode which is correct for Node.js server use.
**Warning signs:** `"Setting up fake worker"` or `"Worker was terminated"` in logs.

### Pitfall 2: ESM Import Incompatibility
**What goes wrong:** `SyntaxError: Cannot use import statement in a module` or `getDocument is not a function` when importing pdfjs-dist.
**Why it happens:** pdfjs-dist v4+ ships `.mjs` files. If the project's module resolution doesn't handle ESM, the import fails.
**How to avoid:** Import from `pdfjs-dist/legacy/build/pdf.mjs`. This path has Node.js-compatible polyfills. Use `import()` dynamic import or ensure `tsconfig.json` targets `NodeNext` module resolution (this project does).
**Warning signs:** Import errors at startup; `getDocument` is undefined.

### Pitfall 3: Buffer → Uint8Array Conversion
**What goes wrong:** `TypeError: data must be a TypedArray` from pdfjs-dist.
**Why it happens:** `req.file.buffer` is a Node.js `Buffer` (subclass of `Uint8Array`) but some pdfjs-dist versions require an explicit `Uint8Array`.
**How to avoid:** Always wrap: `new Uint8Array(req.file.buffer)`. This is a zero-copy operation on Buffer.
**Warning signs:** TypeError on `getDocument()` call.

### Pitfall 4: Magic Bytes Check Timing
**What goes wrong:** Magic bytes check runs against an empty buffer.
**Why it happens:** Middleware ordering — magic bytes check was placed BEFORE multer has buffered the file.
**How to avoid:** Magic bytes middleware MUST run AFTER `multerSingle` AND AFTER `multerErrorHandler`. Order: `multerSingle → multerErrorHandler → validatePdfMagicBytes → controller`.
**Warning signs:** `req.file` is undefined inside the validation middleware.

### Pitfall 5: Y-Coordinate Not Page-Relative
**What goes wrong:** Lines from different pages get merged or mis-sorted.
**Why it happens:** PDF Y coordinates reset to 0 at the bottom of each page. Page 2's bottom (Y=0) is less than page 1's top (Y=720), but they're in different coordinate spaces.
**How to avoid:** Cluster text items per-page, then concatenate in page order.
**Warning signs:** Section headings appearing in wrong order; lines from page 2 appearing before page 1 content.

### Pitfall 6: Empty String TextItems
**What goes wrong:** Empty strings or whitespace-only items inflate item count and corrupt line grouping.
**Why it happens:** pdfjs extracts ALL text operators, including positioning-only operators that have empty `str` values.
**How to avoid:** Filter out items where `item.str.trim() === ''` before clustering.
**Warning signs:** Spurious empty lines in output; median font size calculation skewed.

### Pitfall 7: Scanned PDF False Negatives
**What goes wrong:** A mostly-scanned PDF has a single text layer (e.g., a PDF/A header or embedded title) and passes the `0 text items` check.
**Why it happens:** Some scan-to-PDF tools embed minimal text metadata. The locked decision (0 text items = scanned) will NOT catch these.
**How to avoid:** The locked decision is the MVP threshold. Log a warning when total text items < 50 for a multi-page PDF. Document this as a known limitation.
**Warning signs:** Service parses successfully but produces 0 sections (falls through to `pdf_corrupt`).

### Pitfall 8: PasswordException not Thrown Synchronously
**What goes wrong:** Code checks `err instanceof PasswordException` but it's a string or generic Error.
**Why it happens:** In some pdfjs versions, password errors may surface as rejection with a plain object, not a class instance.
**How to avoid:** Also check `err?.name === 'PasswordException'` as a fallback.
**Warning signs:** Encrypted PDFs return `pdf_corrupt` instead of `pdf_encrypted`.

### Pitfall 9: standardFontDataUrl Warning Spam
**What goes wrong:** Console floods with `"Warning: fetchStandardFontData: failed to fetch file"` for every page.
**Why it happens:** pdfjs tries to load standard font metrics from a URL, but in Node.js there's no fetch context.
**How to avoid:** Pass `standardFontDataUrl` pointing to the `pdfjs-dist/standard_fonts/` directory in node_modules, or set `verbosity: 0` to silence warnings.
**Warning signs:** Log noise obscuring real errors.

---

## Code Examples

### Complete pdf.service.ts Skeleton

```typescript
// Source: synthesized from pdfjs-dist official API, mozilla/pdf.js/discussions/17989,
//         github.com/mozilla/pdf.js/issues/12031 (coordinate system)

import type { ResumeStructure } from '@resume/types';
import { AppError } from '../middleware/error.middleware.js';

// Dynamic import stored at module level — avoids re-importing on each call
let pdfjsLib: Awaited<typeof import('pdfjs-dist')> | null = null;

async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as string);
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }
  return pdfjsLib;
}

export async function parsePdf(buffer: Buffer): Promise<ResumeStructure> {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(buffer);

  let pdf: Awaited<ReturnType<typeof pdfjs.getDocument>>['promise'] extends Promise<infer T> ? T : never;
  try {
    pdf = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
  } catch (err: unknown) {
    if (err instanceof pdfjs.PasswordException || (err as any)?.name === 'PasswordException') {
      throw new AppError(422, 'pdf_encrypted', 'PDF is password-protected. Remove the password and try again.');
    }
    if (err instanceof pdfjs.InvalidPDFException || (err as any)?.name === 'InvalidPDFException') {
      throw new AppError(422, 'pdf_corrupt', 'PDF file is corrupt or cannot be parsed.');
    }
    throw new AppError(422, 'pdf_corrupt', 'PDF file could not be read.');
  }

  // Collect all text items across pages
  const allItems: Array<{ item: pdfjs.TextItem; pageNum: number }> = [];
  let firstPageViewport: pdfjs.PageViewport | null = null;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    if (p === 1) {
      firstPageViewport = page.getViewport({ scale: 1.0 });
    }
    const content = await page.getTextContent({ includeMarkedContent: false });
    const items = content.items.filter((i): i is pdfjs.TextItem => 'str' in i && i.str.trim() !== '');
    for (const item of items) {
      allItems.push({ item, pageNum: p });
    }
  }

  // Scanned PDF detection
  if (allItems.length === 0) {
    throw new AppError(422, 'pdf_scanned', 'PDF appears to be scanned. No extractable text found. Try a PDF exported from Word or Google Docs.');
  }

  // ... clustering pipeline, structure building ...
  // ... minimum viable check ...
}
```

### Extending Error Classes

```typescript
// Extend existing PdfParseError in error.middleware.ts
// The existing PdfParseError(message) → 422 + 'pdf_unparseable' must be REPLACED
// with specific subclasses per CONTEXT.md. Pattern:

export class PdfNotPdfError extends AppError {
  constructor() {
    super(415, 'pdf_not_pdf', 'Uploaded file is not a PDF.');
  }
}
export class PdfTooLargeError extends AppError {
  constructor() {
    super(413, 'pdf_too_large', 'File exceeds the 10 MB limit.');
  }
}
export class PdfScannedError extends AppError {
  constructor() {
    super(422, 'pdf_scanned', 'PDF appears to be scanned — no text could be extracted. Try exporting from Word or Google Docs.');
  }
}
export class PdfEncryptedError extends AppError {
  constructor() {
    super(422, 'pdf_encrypted', 'PDF is password-protected. Remove the password and try again.');
  }
}
export class PdfCorruptError extends AppError {
  constructor(message = 'PDF file is corrupt or could not be parsed.') {
    super(422, 'pdf_corrupt', message);
  }
}
```

Note: The EXISTING `PdfParseError` is used in the existing test (`error-middleware.test.ts`) and must NOT be removed — extend or keep alongside new classes. The test asserts `error: 'pdf_unparseable'` which still needs to pass.

### ResumeStructureSchema Extension

```typescript
// packages/types/src/resume.ts — add header field
export const HeaderLineSchema = z.object({
  text: z.string(),
  style: TextStyleSchema,
});

export const ResumeStructureSchema = z.object({
  meta: z.object({
    pageWidth: z.number(),
    pageHeight: z.number(),
    marginTop: z.number(),
    marginBottom: z.number(),
    marginLeft: z.number(),
    marginRight: z.number(),
  }),
  header: z.array(HeaderLineSchema),   // ADD THIS FIELD
  sections: z.array(SectionSchema),
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pdfjs-dist CJS build | ESM-only `.mjs` files | v4.0 (2024) | Must use dynamic `import()` or `pdfjs-dist/legacy/build/pdf.mjs` |
| `GlobalWorkerOptions.workerSrc = pdfjsWorker` | `GlobalWorkerOptions.workerSrc = ''` for Node.js | v4.0 | Worker mode no longer needed server-side |
| `multer.diskStorage()` for security | Post-upload magic bytes check on memoryStorage buffer | multer v2 (2024) | `fileFilter` runs before buffer is available; magic check is now a separate middleware |
| `@types/pdfjs-dist` separate package | Types bundled in `pdfjs-dist` itself | v3.x | No separate `@types/pdfjs-dist` install needed |

**Deprecated/outdated:**
- `pdfjs-dist/build/pdf.js` (CJS): Removed in v4+. Use `pdfjs-dist/legacy/build/pdf.mjs`.
- `multer({ dest: './uploads' })` shorthand: Still works but not recommended — `storage` option is explicit.
- `normalizeWhitespace` option in `getTextContent`: Renamed to `disableNormalization` (inverted sense) in recent versions; the default behavior (whitespace normalized) is unchanged.

---

## Open Questions

1. **Actual font face name extraction**
   - What we know: `textContent.styles[fontName].fontFamily` returns a generic CSS family, not the face name. The real name requires `page.commonObjs` after `page.getOperatorList()`.
   - What's unclear: Whether `commonObjs` reliably exposes the stripped font name (post-subset-prefix removal) in pdfjs-dist v5.
   - Recommendation: Use the fallback strategy (Calibri 11pt) for Phase 2. Flag as a known limitation. Phase 5 (DOCX) may revisit if fidelity becomes a priority.

2. **Bold/italic detection without font name**
   - What we know: pdfjs-dist's `getTextContent()` does not expose a `bold` or `italic` flag. Font name inspection (looking for "Bold", "Italic" in the raw name) is the only heuristic available.
   - What's unclear: How reliably this heuristic works across different PDF generators (Acrobat, Word, Google Docs export, LaTeX).
   - Recommendation: Implement font-name heuristic for Phase 2. Apply the locked fallback (`bold: false, italic: false`) when the font name is absent or non-standard.

3. **Y-proximity threshold validation**
   - What we know: 2.0pt is the recommended threshold based on reasoning.
   - What's unclear: Whether specific resume PDF generators (LaTeX beamer, Google Docs PDF export) produce Y variations larger than 2pt within a visual line.
   - Recommendation: Make the threshold a named constant `LINE_Y_TOLERANCE = 2.0` so it can be tuned without touching algorithm logic. Test with real resume PDFs from multiple sources.

4. **pdfjs-dist standardFontDataUrl in production**
   - What we know: Passing this URL avoids console warning noise. The correct path is `node_modules/pdfjs-dist/standard_fonts/`.
   - What's unclear: Whether this path resolves correctly from the `dist/` build output when `tsup` bundles the service.
   - Recommendation: Use `new URL('../../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url)` with a fallback to `verbosity: 0` to suppress warnings if the path fails.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `apps/api/vitest.config.ts` (exists, `globals: true`) |
| Quick run command | `npm run test --workspace=apps/api` |
| Full suite command | `npm run test --workspace=apps/api` (runs all `__tests__/*.test.ts`) |

### Unit Test Strategy for pdf.service.ts

**What to mock:** pdfjs-dist — mock the entire module with `vi.mock('pdfjs-dist/legacy/build/pdf.mjs')`. Provide a factory that returns a configurable `PDFDocumentProxy` mock. This avoids loading the actual 2MB+ library in unit tests and allows simulating PasswordException, 0-item, and structural cases.

**What to test with real fixtures:** Integration tests only. Real PDF fixtures validate that the clustering algorithm and structural parsing produce correct `ResumeStructure` output.

```typescript
// apps/api/src/__tests__/pdf.service.test.ts (sketch)
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', async () => {
  class PasswordException extends Error { constructor(msg: string) { super(msg); this.name = 'PasswordException'; } }
  class InvalidPDFException extends Error { constructor(msg: string) { super(msg); this.name = 'InvalidPDFException'; } }
  return {
    getDocument: vi.fn(),
    GlobalWorkerOptions: { workerSrc: '' },
    PasswordException,
    InvalidPDFException,
  };
});
```

**Unit test cases:**
| Test Case | What to Verify |
|-----------|---------------|
| Empty buffer → AppError 422 pdf_corrupt | pdf_corrupt code thrown |
| `getDocument` throws PasswordException → AppError 422 pdf_encrypted | Correct error code |
| `getDocument` throws InvalidPDFException → AppError 422 pdf_corrupt | Correct error code |
| All pages return 0 TextItems → AppError 422 pdf_scanned | Correct error code |
| Valid mock returns 0 sections → AppError 422 pdf_corrupt | Minimum viable check |
| Valid mock returns 1 section + 1 bullet → returns ResumeStructure | Shape validated by Zod |
| Font fallback applied when height=0 → uses defaults | fontName=Calibri, fontSize=22 |
| Y-proximity groups 3 items within 1pt → 1 logical line | Clustering correct |
| Y-proximity splits items 15pt apart → 2 logical lines | Clustering correct |
| Font name "ABCDEF+Calibri-Bold" → baseName="Calibri", bold=true | Normalization correct |

### Integration Test Strategy for POST /api/analyze

**Test target:** Full Express app with real multer + pdfjs-dist (no mocks).

**Test cases:**
| Input | Expected HTTP Status | Expected Error Code |
|-------|---------------------|-------------------|
| No file field | 400 | `pdf_missing` |
| Non-PDF file (PNG with wrong ext) | 415 | `pdf_not_pdf` |
| PDF with wrong Content-Type but correct magic bytes | 200 | (succeeds — magic bytes wins) |
| File of exactly 10MB | 200 | (at limit — accepted) |
| File of 10MB + 1 byte | 413 | `pdf_too_large` |
| Password-protected PDF fixture | 422 | `pdf_encrypted` |
| Scanned PDF fixture (image-only) | 422 | `pdf_scanned` |
| Valid resume PDF fixture | 200 | returns ResumeStructure body |
| Corrupt PDF (truncated bytes) | 422 | `pdf_corrupt` |

### Test Fixtures Needed

| Fixture | Description | How to Create |
|---------|-------------|--------------|
| `fixtures/valid-resume.pdf` | Simple 1-page resume, exported from Word or Google Docs | Manual creation — 1 section, 2 bullets minimum |
| `fixtures/scanned-resume.pdf` | Image-only PDF with no text layer | Can be created by printing to PDF from an image, or use a known scanned document |
| `fixtures/encrypted-resume.pdf` | Password-protected PDF | Adobe Acrobat or LibreOffice export with password "test" |
| `fixtures/corrupt.pdf` | Truncated/invalid PDF | `echo -n "%PDF-1.4 corrupted" > corrupt.pdf` |
| `fixtures/not-a-pdf.png` | PNG file for non-PDF test | Any PNG image |
| `fixtures/oversized.pdf` | PDF > 10MB | Large PDF or padding — for integration test only |

### How to Verify ResumeStructure Output Fidelity

1. **Zod parse:** `ResumeStructureSchema.parse(result)` — throws if any required field is missing or wrong type. This is the primary contract check.
2. **Section count:** Assert known resume fixture produces N sections by heading name.
3. **Bullet count:** Assert known fixture produces correct bullet count per section.
4. **Header field:** Assert `result.header.length > 0` and first line contains candidate's name text.
5. **Meta dimensions:** Assert `pageWidth ≈ 612` (US Letter) or `≈ 595` (A4); `pageHeight ≈ 792` or `≈ 842`.
6. **Font fallback:** If fixture has no embedded font metadata, assert `fontName === 'Calibri'`, `fontSize === 22`.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INPUT-01 | PDF uploaded and parsed successfully | integration | `npm run test --workspace=apps/api` | ❌ Wave 0 |
| INPUT-02 | Non-PDF rejected with pdf_not_pdf (415) | integration | `npm run test --workspace=apps/api` | ❌ Wave 0 |
| INPUT-03 | Oversized file rejected with pdf_too_large (413) | integration | `npm run test --workspace=apps/api` | ❌ Wave 0 |
| INPUT-04 | Scanned PDF rejected with pdf_scanned (422) | integration | `npm run test --workspace=apps/api` | ❌ Wave 0 |
| INPUT-05 | Encrypted PDF rejected with pdf_encrypted (422) | integration | `npm run test --workspace=apps/api` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test --workspace=apps/api`
- **Per wave merge:** `npm run test --workspace=apps/api`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/__tests__/pdf.service.test.ts` — unit tests covering error codes, clustering, font normalization (REQ INPUT-04, INPUT-05)
- [ ] `apps/api/src/__tests__/analyze.route.test.ts` — integration tests covering all 5 INPUT requirements
- [ ] `apps/api/src/__tests__/fixtures/` — directory containing: `valid-resume.pdf`, `scanned-resume.pdf`, `encrypted-resume.pdf`, `corrupt.pdf`, `not-a-pdf.png`
- [ ] Framework config: Already exists at `apps/api/vitest.config.ts`

---

## Sources

### Primary (HIGH confidence)
- `mozilla.github.io/pdf.js/api/draft/api.js.html` — Official pdfjs-dist API; TextItem interface, getTextContent parameters, exception class names
- `github.com/mozilla/pdf.js/issues/12031` — Transform matrix coordinate semantics (transform[4]=x, transform[5]=y, PDF origin bottom-left)
- `github.com/mozilla/pdf.js/releases` — pdfjs-dist v5.5.207 latest version confirmation (March 2025)
- `jsdocs.io/package/@types/multer` — multer v2.1.0 File interface fields; confirmed no `detectedMimeType`; confirmed `buffer` on MemoryStorage
- `github.com/expressjs/multer/issues/1021` — Definitive source on fileFilter v1/v2 behavioral change

### Secondary (MEDIUM confidence)
- `github.com/mozilla/pdf.js/discussions/17989` — Node.js v4→v5 migration; `legacy/build/pdf.mjs` path; Node 22+ direct import
- `github.com/mozilla/pdf.js/issues/7372` — Confirmed: bold/italic NOT directly exposed via getTextContent; font name heuristic is the only option
- `github.com/mozilla/pdf.js/issues/7914` — fontName in getTextContent is pdfjs-internal key (e.g., "g_d0_f1"), NOT the actual PDF font name
- `dev.to/ayanabilothman/file-type-validation-in-multer-is-not-safe-3h8l` — Magic bytes post-upload pattern with memoryStorage
- `pdfa.org/font-subsetting-how-it-works-and-when-to-use/` — PDF font subset "ABCDEF+" prefix specification
- `github.com/mozilla/pdf.js/issues/18201` — Y-coordinate grouping approach (group by transform[5] proximity); confirmed `hasEOL` is unreliable

### Tertiary (LOW confidence)
- WebSearch synthesis — Y-proximity 2.0pt threshold; derived from domain reasoning, not official documentation
- WebSearch synthesis — `standardFontDataUrl` path in production builds; needs validation in practice

---

## Metadata

**Confidence breakdown:**
- Standard stack (pdfjs-dist version, multer API): HIGH — verified against official sources
- Architecture patterns (import path, Buffer conversion, worker setup): MEDIUM-HIGH — verified via community consensus + official API; some v5-specific behavior unverified
- Y-proximity clustering algorithm: LOW-MEDIUM — algorithm design is sound; specific thresholds are Claude's discretion per CONTEXT.md, derived by reasoning not empirical testing
- Font name extraction (bold/italic via name heuristic): MEDIUM — confirmed that no better mechanism exists; heuristic approach is industry standard fallback
- Font face name (actual "Calibri" extraction): LOW — commonObjs approach documented but complex; fallback strategy is simpler and explicitly endorsed by CONTEXT.md decision
- Error handling (PasswordException instanceof check): MEDIUM — confirmed these are named exports; `name` property fallback adds safety

**Research date:** 2026-03-08
**Valid until:** 2026-06-08 (pdfjs-dist releases frequently but API is stable; multer v2 API is stable post-2.0.0)
