# Technology Stack

**Project:** AI Resume Tailoring Engine
**Researched:** 2026-03-08
**Confidence note:** External web tools (WebSearch, WebFetch, Bash) were unavailable during this research session. All library knowledge is drawn from training data (cutoff ~Aug 2025). Versions must be verified against npm before installation. Confidence levels reflect this constraint.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 14.x (App Router) | Frontend — 3-step wizard UI, file upload, diff view | App Router gives server components for static shell + client components for interactive wizard steps; built-in API routes reduce infra; React ecosystem for review/edit UI |
| TypeScript | 5.x | Type safety across the entire codebase | `ResumeStructure` is the load-bearing type that flows through every service; TS enforces its shape at every boundary |
| Node.js | 20 LTS | Runtime for Express backend | LTS guarantees; native fetch; stable worker_threads for CPU-bound PDF work |
| Express | 4.x | Backend HTTP server | Minimal, well-understood, typed via `@types/express`; right-sized for a 2-route API (`/api/analyze`, `/api/generate`) — no framework overhead needed |

### PDF Parsing (Critical — read carefully)

The core challenge is not text extraction — it is **layout metadata extraction**: fonts, font sizes, bounding boxes, line spacing, column structure, and section boundaries. Most Node.js PDF libraries expose only raw text. Only two are viable for this project's requirements.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `pdfjs-dist` | 4.x | Primary PDF parser — extracts text with position, font, size metadata per glyph | Mozilla's PDF.js exposes `getTextContent()` which returns `TextItem[]` each with `str`, `transform` (6-element matrix encoding x/y position and font size), `fontName`, `width`, and `height`. This is the **only mainstream Node.js library that exposes per-character layout metadata** without a native binary dependency. Required to build `ResumeStructure` with font/spacing/margin data. |
| `pdf-parse` | 1.1.x | Fallback text-only extraction | Built on top of pdfjs-dist but **strips all layout metadata** — returns only raw text strings. Useful only for quick text extraction in analysis/keyword work, not for layout reconstruction. Do not use as primary parser. |

**Why NOT other PDF libraries:**
- `pdf2json`: Exposes JSON with some position data but has inconsistent coordinate systems, abandoned maintenance cycles, and less predictable behavior on complex resume PDFs.
- `pdf-lib`: A PDF creation/modification library, not a parser. Not relevant here.
- `poppler` / `pdftotext` (CLI): Native binaries — deployment complexity, not portable to serverless or Docker without extra layers.
- `hummus` / `muhammara`: C++ binding, complex build, maintenance concerns.
- `LlamaParse` / cloud PDF APIs: External API dependency, cost, latency, and data privacy concerns for resume content.

**Parsing strategy for `pdf.service.ts`:**

Use `pdfjs-dist` directly (not through `pdf-parse`) to call `getPage()` → `getTextContent()` on each page. Each `TextItem` in the result carries:
- `str`: the text string
- `transform`: `[scaleX, skewX, skewY, scaleY, translateX, translateY]` — encode x/y position and effective font size
- `fontName`: reference into the page's font dictionary
- `width`, `height`: bounding box dimensions

Cross-reference `fontName` with `page.getOperatorList()` and the document's font resources to resolve font family and weight. This is the path to a faithful `ResumeStructure`.

**Confidence: MEDIUM** — pdfjs-dist 4.x was current as of mid-2025; verify exact version on npm before installing.

### DOCX Generation (Critical — read carefully)

The challenge is **faithful layout reconstruction**: the output DOCX must mirror the original resume's visual layout (fonts, sizes, spacing, margins, bold/italic, column structure if any) but with AI-rewritten bullet text.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `docx` (js-docx) | 8.x | Primary DOCX generator | The most capable pure-JavaScript DOCX library. Exposes a rich programmatic API for: paragraph properties (spacing before/after, line spacing), run properties (font family, size in half-points, bold, italic, underline, color), section properties (page margins, columns), table structures, and numbering definitions for bullet lists. **All of these map directly to the fields in `ResumeStructure`.** TypeScript-first with full type definitions. |

**Why NOT other DOCX libraries:**
- `officegen`: Older API, far less formatting control, not actively maintained at the same level as `docx`.
- `libreoffice` (CLI headless): Converts between formats but cannot programmatically reconstruct layout from a data structure — outputs from templates only.
- `docxtemplater`: Template-driven — requires a pre-existing `.docx` template file. Since the output layout must be derived from the parsed `ResumeStructure` (not a static template), this adds a template management problem and limits flexibility. Only viable if you store the original DOCX — but this project takes PDF input, so no source template exists.
- `pizzip` + raw XML manipulation: Fragile, low-level, high maintenance cost.

**Key `docx` library capabilities needed:**

```typescript
// Font and size on a Run
new TextRun({ text: "Software Engineer", font: "Calibri", size: 24 }) // size in half-points = 12pt

// Paragraph spacing
new Paragraph({
  spacing: { before: 120, after: 60, line: 276 }, // twips
  indent: { left: 720 },
})

// Page margins on a Section
new Document({
  sections: [{
    properties: {
      page: {
        margin: { top: 720, right: 720, bottom: 720, left: 720 }, // twips
      },
    },
    children: [...]
  }]
})
```

The `ResumeStructure` type must store measurements in twips or points to map cleanly to `docx` library units (twips = 1/1440 inch; `docx` uses twips for spacing/indent and half-points for font size).

**Confidence: MEDIUM** — `docx` 8.x was current as of mid-2025; verify exact version on npm.

### AI Integration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `openai` (official SDK) | 4.x | GPT-4o API client | Official SDK, TypeScript-first, streaming support, built-in retry logic with exponential backoff. Isolated entirely in `ai.service.ts` per architecture decision. |

**Key considerations for `ai.service.ts`:**
- Use `gpt-4o` model (not `gpt-4-turbo`) — better instruction following for structured output tasks like JSON bullet rewrites.
- Use `response_format: { type: "json_object" }` or structured outputs (JSON Schema mode available in gpt-4o) to get typed rewrite responses without parsing fragility.
- Set `timeout` on the client constructor (default is no timeout — this will cause hanging requests). Recommended: 60s for analysis calls.
- The service must throw on failure so the global error middleware catches it, per the project's error handling architecture.

**Confidence: HIGH** — OpenAI SDK 4.x with GPT-4o structured outputs is well-established and the canonical approach.

### Infrastructure & Tooling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Turborepo | 2.x | Monorepo build orchestration | Task caching (avoids rebuilding unchanged packages), parallel execution, pipeline definition. Standard choice for Next.js + Node.js monorepos in 2025. |
| `tsx` | 4.x | TypeScript execution for Express dev server | Replaces `ts-node` — faster, uses native Node.js ESM loader, no separate compilation step in development. |
| `tsup` | 8.x | Build tool for Express backend | Bundles TypeScript to CJS/ESM for production. Zero-config for simple Express apps. |
| `zod` | 3.x | Runtime schema validation | Validates `ResumeStructure` at service boundaries and validates API request bodies. TypeScript inference from schemas eliminates duplicate type definitions. |
| `multer` | 1.x | File upload middleware for Express | Handles `multipart/form-data` for PDF uploads; stores to memory buffer (no disk I/O needed since files are processed in-request and discarded — stateless). |
| `vitest` | 1.x | Unit + integration testing | Faster than Jest, native TypeScript support, compatible with the Turborepo pipeline. |

### Monorepo Structure

```
resume-tailoring-engine/
├── apps/
│   ├── web/                 # Next.js frontend (App Router)
│   │   ├── app/
│   │   ├── components/
│   │   └── package.json
│   └── api/                 # Express backend
│       ├── src/
│       │   ├── services/
│       │   │   ├── pdf.service.ts
│       │   │   ├── ai.service.ts
│       │   │   ├── analysis.service.ts
│       │   │   └── docx.service.ts
│       │   ├── routes/
│       │   │   ├── analyze.route.ts
│       │   │   └── generate.route.ts
│       │   ├── middleware/
│       │   │   └── error.middleware.ts
│       │   └── index.ts
│       └── package.json
├── packages/
│   └── types/               # Shared TypeScript types (ResumeStructure, etc.)
│       ├── src/
│       │   └── index.ts
│       └── package.json
├── turbo.json
└── package.json
```

**Critical architectural note:** `ResumeStructure` belongs in `packages/types` — shared between `apps/web` (for the review UI) and `apps/api` (for all services). This is the primary reason to use a monorepo: the central type must not be duplicated or serialized differently across apps.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cors` | 2.x | CORS middleware for Express | When web app and API are on different origins (always in development; configure for prod domain) |
| `helmet` | 7.x | Security headers for Express | Apply to all API routes — sets sensible HTTP security headers |
| `dotenv` / `dotenv-cli` | 16.x | Environment variable management | Dev-time env loading; use `dotenv-cli` in Turborepo tasks to inject vars before each app starts |
| `@types/express`, `@types/multer`, `@types/cors` | latest | TypeScript definitions | Required — Express ecosystem is JavaScript-first |
| `sharp` | 0.33.x | Image processing | Only if resume PDF contains images that need to be embedded in DOCX output — defer until needed |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| PDF parsing | `pdfjs-dist` direct | `pdf-parse` | `pdf-parse` strips layout metadata; only exposes raw text |
| PDF parsing | `pdfjs-dist` direct | `pdf2json` | Inconsistent coordinate system, maintenance concerns |
| PDF parsing | `pdfjs-dist` direct | Cloud PDF APIs (LlamaParse, Adobe) | External dependency, cost, resume data privacy |
| DOCX generation | `docx` (js-docx) | `docxtemplater` | Template-driven — no source DOCX template exists (input is PDF) |
| DOCX generation | `docx` (js-docx) | `officegen` | Less formatting control, older API |
| Monorepo | Turborepo | Nx | Nx has steeper learning curve and heavier config for a 2-app monorepo |
| Monorepo | Turborepo | Single Next.js app with API routes | Would force pdfjs-dist + docx heavy processing into Next.js API routes, making them slow and hitting serverless size limits |
| Dev TypeScript runner | `tsx` | `ts-node` | `ts-node` is slower and requires more config for ESM; `tsx` is the current community standard |
| Backend bundler | `tsup` | `esbuild` directly | `tsup` wraps esbuild with sensible defaults; same speed, less config |
| Validation | `zod` | `joi` / `yup` | Zod is TypeScript-first with schema inference; avoids duplicating type definitions |
| AI SDK | `openai` official | LangChain | LangChain adds abstraction overhead for a single-provider, single-use-case app; raw SDK is simpler and more predictable |

---

## Installation

```bash
# Root (Turborepo)
npm install -D turbo typescript

# packages/types
npm install -D typescript

# apps/api
npm install express multer cors helmet dotenv zod openai pdfjs-dist docx
npm install -D typescript tsx tsup @types/express @types/multer @types/cors @types/node vitest

# apps/web
npm install next react react-dom zod
npm install -D typescript @types/react @types/react-dom vitest
```

**Note:** Verify all versions on npm before installing. The `pdfjs-dist` Node.js build is a separate entrypoint — import from `pdfjs-dist/legacy/build/pdf.js` for Node.js (not the browser build). The library uses a worker thread for rendering; in Node.js, use `GlobalWorkerOptions.workerSrc` set to a no-op or use the non-worker legacy API.

---

## Critical Version Verification Required

Before starting implementation, verify these specific versions on npm (training data cannot guarantee currency):

| Package | Last known stable | Check at |
|---------|------------------|---------|
| `pdfjs-dist` | 4.x | https://www.npmjs.com/package/pdfjs-dist |
| `docx` | 8.x | https://www.npmjs.com/package/docx |
| `openai` | 4.x | https://www.npmjs.com/package/openai |
| `turbo` | 2.x | https://www.npmjs.com/package/turbo |
| `tsx` | 4.x | https://www.npmjs.com/package/tsx |
| `tsup` | 8.x | https://www.npmjs.com/package/tsup |

---

## Sources

- Training knowledge (cutoff ~Aug 2025) — WebSearch/WebFetch/Bash unavailable during this session
- Mozilla PDF.js documentation: https://mozilla.github.io/pdf.js/
- docx (js-docx) documentation: https://docx.js.org/
- OpenAI Node.js SDK: https://github.com/openai/openai-node
- Turborepo documentation: https://turbo.build/repo/docs
- Confidence: MEDIUM overall — library choices are stable and well-established; version numbers require npm verification before installation
