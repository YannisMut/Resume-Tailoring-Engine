# Phase 1: Foundation - Research

**Researched:** 2026-03-08
**Domain:** Turborepo monorepo scaffold, shared TypeScript types, Express + Next.js app shells
**Confidence:** HIGH

---

## Summary

Phase 1 is a pure TypeScript infrastructure build with no AI involvement and no external data sources. Its sole purpose is to produce the load-bearing scaffolding that all downstream phases depend on: a working Turborepo monorepo, the `packages/types` package containing the complete `ResumeStructure` / `RewrittenBullet` / `AnalysisResult` interfaces with Zod schemas, and skeleton Express and Next.js apps that build and start cleanly.

The central risk in this phase is not technical complexity — it is type design. `ResumeStructure` is consumed by all four backend services and by the frontend review UI. If it is designed without layout metadata fields (font name, font size, bold, italic, spacing, margins), the DOCX generation service in Phase 5 cannot reconstruct the visual layout and the core product value proposition fails. The type must be complete before any service code is written. This is the one place where "you can always add fields later" is dangerous — because adding fields to a type consumed by four services causes breaking changes across all of them simultaneously.

The Turborepo + Next.js 15 + Express 5 + Zod + vitest stack is extremely well-documented. Current npm versions have been verified (March 2026). The scaffold itself follows a standard pattern: `turbo init`, `apps/web` (Next.js), `apps/api` (Express), `packages/types` (shared types). The only non-standard step is ensuring `packages/types` is properly referenced from both apps via workspace protocol and that `tsconfig.json` strict mode is enabled root-wide from day one.

**Primary recommendation:** Design `ResumeStructure` completely (including all layout fields, stable IDs, Zod schemas) before writing any app code. Everything else in this phase is mechanical scaffold.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| (infra-1) | Both apps (Next.js and Express) start without errors in the monorepo | Turborepo workspace setup with `turbo dev` pipeline; verified Turborepo 2.8.14 + Next.js 16.1.6 + Express 5.2.1 available on npm |
| (infra-2) | `packages/types` exports `ResumeStructure`, `RewrittenBullet`, and `AnalysisResult` with all required fields (text content + layout metadata) | Full type design in ARCHITECTURE.md; layout fields required by DOCX service; text fields required by analysis and AI services |
| (infra-3) | Zod schemas validate all shared types at runtime | Zod 4.3.6 confirmed on npm; TypeScript inference from schemas eliminates duplicate type definitions |
| (infra-4) | Global Express error middleware catches and formats service errors without scattered try/catch | Express 5 error middleware pattern: 4-argument handler registered last; typed error classes thrown by services |
| (infra-5) | TypeScript strict mode passes with zero errors across all packages | Root tsconfig with `"strict": true`; all package tsconfigs extend root; verified TypeScript 5.9.3 on npm |
</phase_requirements>

---

## Standard Stack

### Core — Verified Versions (npm, 2026-03-08)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| turbo | 2.8.14 | Monorepo task orchestration | Task caching, parallel pipelines, workspace management for 2-app + 1-package structure |
| typescript | 5.9.3 | Type safety | `ResumeStructure` is the load-bearing type; strict mode enforced root-wide |
| next | 16.1.6 | Frontend app shell | App Router; server + client components for wizard UI |
| express | 5.2.1 | Backend API shell | Minimal 2-route API; async error propagation improved in v5 |
| zod | 4.3.6 | Runtime schema validation | Schema inference eliminates duplicate type definitions; validates at every service boundary |
| vitest | 4.0.18 | Testing | TypeScript-native, Turborepo pipeline compatible |
| tsx | 4.21.0 | Express dev runner | Faster than ts-node; native ESM; no separate compile step in dev |
| tsup | 8.5.1 | Express build bundler | Wraps esbuild; zero-config for simple Express apps |

### Supporting — Verified Versions

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/express | 5.0.6 | TypeScript definitions for Express | Required — Express is JS-first |
| @types/multer | 2.1.0 | TypeScript definitions for multer | Required in Phase 2; install now for completeness |
| @types/cors | 2.8.19 | TypeScript definitions for cors | Required alongside cors |
| cors | 2.8.6 | CORS middleware | Apps are on different origins in dev; required from day one |
| helmet | 8.1.0 | Security headers | Apply to all Express routes at startup |
| multer | 2.1.1 | Multipart file upload | Install in apps/api now; used in Phase 2 for PDF upload |
| dotenv | latest | Environment variable loading | OPENAI_API_KEY and PORT config for api app |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Turborepo | Nx | Nx has heavier config and steeper learning curve for a 2-app monorepo; Turborepo is lower ceremony |
| Turborepo | Single Next.js app + API routes | Forces pdfjs-dist and docx heavy processing into Next.js API routes; hits serverless bundle size limits |
| tsx | ts-node | ts-node requires more ESM config; tsx is the current community standard for Express dev |
| tsup | esbuild directly | tsup wraps esbuild with sensible defaults; same speed, less config |
| Zod | joi / yup | Zod is TypeScript-first with schema inference; joi/yup require separate type definitions |
| Express 5 | Express 4 | Express 5 fixes async error propagation (no more unhandled rejections from async route handlers); same API surface |

**Installation (by workspace):**
```bash
# Root — workspace tooling
npm install -D turbo typescript

# packages/types
npm install zod
npm install -D typescript

# apps/api
npm install express cors helmet multer dotenv zod
npm install -D typescript tsx tsup @types/express @types/cors @types/multer @types/node vitest

# apps/web
npm install next react react-dom zod
npm install -D typescript @types/react @types/react-dom
```

---

## Architecture Patterns

### Recommended Project Structure

```
resume-tailoring-engine/
├── apps/
│   ├── web/                    # Next.js 16 (App Router)
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx        # Step 1 placeholder
│   │   ├── components/
│   │   ├── tsconfig.json       # extends ../../tsconfig.base.json
│   │   └── package.json        # name: "@resume/web"
│   └── api/                    # Express 5
│       ├── src/
│       │   ├── services/
│       │   │   ├── pdf.service.ts        # Phase 2 stub
│       │   │   ├── analysis.service.ts   # Phase 3 stub
│       │   │   ├── ai.service.ts         # Phase 4 stub
│       │   │   └── docx.service.ts       # Phase 5 stub
│       │   ├── routes/
│       │   │   ├── analyze.route.ts      # Phase 4 stub
│       │   │   └── generate.route.ts     # Phase 5 stub
│       │   ├── middleware/
│       │   │   └── error.middleware.ts   # Phase 1 IMPLEMENT
│       │   └── index.ts                  # Phase 1 IMPLEMENT
│       ├── tsconfig.json       # extends ../../tsconfig.base.json
│       └── package.json        # name: "@resume/api"
├── packages/
│   └── types/                  # Phase 1 IMPLEMENT — the central deliverable
│       ├── src/
│       │   ├── resume.ts       # ResumeStructure + Zod schema
│       │   ├── bullet.ts       # RewrittenBullet + Zod schema
│       │   ├── analysis.ts     # AnalysisResult + Zod schema
│       │   └── index.ts        # barrel re-export
│       ├── tsconfig.json       # extends ../../tsconfig.base.json
│       └── package.json        # name: "@resume/types"
├── tsconfig.base.json          # root — strict: true, shared settings
├── turbo.json                  # pipeline definition
└── package.json                # root workspace manifest
```

### Pattern 1: Workspace package references

**What:** Each app references `packages/types` via npm workspace protocol so TypeScript sees the source directly.

**When to use:** Always in this monorepo — `ResumeStructure` must not be duplicated.

```json
// apps/api/package.json
{
  "name": "@resume/api",
  "dependencies": {
    "@resume/types": "*"
  }
}
```

```json
// packages/types/package.json
{
  "name": "@resume/types",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

When `packages/types` exports its TypeScript source directly (no build step needed for monorepo use), both apps get type-checked and hot-reloaded correctly. This avoids a `turbo build` dependency in development.

### Pattern 2: Root tsconfig with strict mode

**What:** All packages extend a root `tsconfig.base.json` that enforces strict mode.

**When to use:** Always — set strict mode from day one or TypeScript's narrowing features will be silently disabled.

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "skipLibCheck": false,
    "forceConsistentCasingInFileNames": true
  }
}
```

```json
// packages/types/tsconfig.json (and each app tsconfig)
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

### Pattern 3: Turborepo pipeline definition

**What:** `turbo.json` defines the task graph so builds, dev, and test run in correct order.

**When to use:** The `types` package must build (or be available as source) before `api` or `web` can type-check.

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "persistent": true,
      "cache": false
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {}
  }
}
```

### Pattern 4: Express 5 error middleware with typed error classes

**What:** Services throw typed errors; the 4-argument Express error handler is the single catch boundary.

**When to use:** All error handling flows through this — no try/catch in individual route handlers except to call `next(err)`.

```typescript
// src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class PdfParseError extends AppError {
  constructor(message: string) {
    super(422, 'pdf_unparseable', message);
  }
}

export class OpenAiTimeoutError extends AppError {
  constructor() {
    super(504, 'ai_timeout', 'AI service timed out. Your analysis is preserved — try again.', true);
  }
}

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      retryable: err.retryable,
    });
    return;
  }
  console.error('[unhandled error]', err);
  res.status(500).json({ error: 'internal_error', message: 'An unexpected error occurred.' });
}
```

**Note on Express 5:** Express 5 correctly handles `async` route handlers that throw — errors propagate to the error middleware without needing explicit `try/catch` + `next(err)`. This simplifies route handlers significantly compared to Express 4.

### Pattern 5: ResumeStructure type design — the central deliverable

**What:** The unified type carrying both text content and layout metadata. Must be complete before any service implementation.

**Why complete upfront:** This type flows through all 4 services. Mid-implementation changes cause breaking changes across everything built to that point.

```typescript
// packages/types/src/resume.ts

import { z } from 'zod';

const TextStyleSchema = z.object({
  fontName: z.string(),                 // "Calibri", "Times New Roman", "Arial"
  fontSize: z.number(),                 // half-points (OOXML unit) — 24 = 12pt
  bold: z.boolean(),
  italic: z.boolean(),
  color: z.string(),                    // hex "#1a1a1a"
  lineSpacingPt: z.number().optional(), // line height in points
  spaceBefore: z.number().optional(),   // paragraph spacing before (points)
  spaceAfter: z.number().optional(),    // paragraph spacing after (points)
});

const BulletSchema = z.object({
  id: z.string(),     // "experience-0-item-0-bullet-2" — deterministic, not random
  text: z.string(),   // raw bullet text without leading "•" or "-"
  style: TextStyleSchema,
});

const SectionItemSchema = z.object({
  id: z.string(),                           // "experience-0-item-0"
  title: z.string().optional(),             // "Senior Engineer at Acme"
  titleStyle: TextStyleSchema.optional(),
  subtitle: z.string().optional(),          // "Jan 2022 – Present"
  subtitleStyle: TextStyleSchema.optional(),
  bullets: z.array(BulletSchema),
});

const SectionSchema = z.object({
  id: z.string(),                   // "experience-0"
  heading: z.string(),              // "WORK EXPERIENCE"
  headingStyle: TextStyleSchema,
  items: z.array(SectionItemSchema),
});

export const ResumeStructureSchema = z.object({
  meta: z.object({
    pageWidth: z.number(),    // points (PDF coordinate units)
    pageHeight: z.number(),
    marginTop: z.number(),
    marginBottom: z.number(),
    marginLeft: z.number(),
    marginRight: z.number(),
  }),
  sections: z.array(SectionSchema),
});

export type TextStyle = z.infer<typeof TextStyleSchema>;
export type Bullet = z.infer<typeof BulletSchema>;
export type SectionItem = z.infer<typeof SectionItemSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type ResumeStructure = z.infer<typeof ResumeStructureSchema>;
```

```typescript
// packages/types/src/bullet.ts

import { z } from 'zod';

export const RewrittenBulletSchema = z.object({
  id: z.string(),       // matches Bullet.id in ResumeStructure
  original: z.string(), // unchanged original bullet text
  rewritten: z.string(), // AI-rewritten bullet text
  approved: z.boolean().default(false), // user approval state (client-side)
});

export type RewrittenBullet = z.infer<typeof RewrittenBulletSchema>;
```

```typescript
// packages/types/src/analysis.ts

import { z } from 'zod';
import { ResumeStructureSchema } from './resume';
import { RewrittenBulletSchema } from './bullet';

export const AnalysisResultSchema = z.object({
  score: z.number().min(0).max(100),   // keyword alignment estimate (not "ATS score")
  gaps: z.array(z.string()),           // JD keywords absent from resume
  rewrites: z.array(RewrittenBulletSchema),
  resumeStructure: ResumeStructureSchema, // echoed for round-trip to /api/generate
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
```

### Anti-Patterns to Avoid

- **Using `any` anywhere:** TypeScript strict mode catches this, but explicitly: `ResumeStructure` fields typed as `any` defeat the entire purpose of the shared types package.
- **Random bullet IDs:** `crypto.randomUUID()` for bullet IDs breaks the bullet-to-rewrite mapping if the PDF is re-analyzed. Use deterministic IDs: `${sectionIndex}-${itemIndex}-${bulletIndex}`.
- **Separate layout and content structures:** Keeping a text tree and a style tree separately causes index drift. One unified `ResumeStructure` tree where each `Bullet` carries both `text` and `style`.
- **Building services before the types package:** Any service code written before `ResumeStructure` is finalized may need to be rewritten. Type first, implement second.
- **Skipping strict mode initially:** Adding strict mode to a partially-built codebase is painful. Enable it in the root tsconfig before any implementation files exist.
- **`packages/types` with a build step in dev:** If `packages/types` exports compiled JS instead of source TS in development, hot reload breaks and the feedback loop slows down. Export TS source in monorepo development; only build for production.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Monorepo task caching and workspace linking | Custom build scripts | Turborepo | Task graph, incremental caching, parallel execution — solved |
| Runtime type validation | Manual schema checks | Zod | Zod infers TypeScript types from schemas; custom validation duplicates effort and drifts |
| TypeScript Express types | Manual type augmentation | @types/express | Request/Response generic types are maintained and comprehensive |
| Error class hierarchy | Bare `throw new Error()` | Typed AppError subclasses | Typed errors allow the middleware to format responses without string matching |
| CORS configuration | Manual Access-Control headers | cors middleware | Edge cases (preflight, credentials, multiple origins) are tricky; use the library |

**Key insight:** Phase 1 is scaffolding, not implementation. Everything here is plumbing that enables Phase 2–7. The goal is correctness and completeness of the types, not cleverness of the scaffold code.

---

## Common Pitfalls

### Pitfall 1: ResumeStructure missing layout fields

**What goes wrong:** `ResumeStructure` is designed with only `sections`, `bullets`, and `text` fields (what analysis and AI need) but without `TextStyle`, `meta.margin*`, spacing fields. Phase 5 (DOCX) then cannot reconstruct the visual layout.

**Why it happens:** The first services to be built (analysis, AI) only need text. It is tempting to defer layout fields until they are needed. But by Phase 5, breaking the type means cascading updates across all already-implemented services.

**How to avoid:** Define the complete type — including all `TextStyle` fields — in Phase 1 before writing any service code. The ARCHITECTURE.md type definition is the authoritative reference.

**Warning signs:** Any draft of `ResumeStructure` that does not have `fontName`, `fontSize`, `bold`, `italic`, `spaceBefore`, `spaceAfter`, `meta.marginTop/Bottom/Left/Right` is incomplete.

### Pitfall 2: TypeScript strict mode added after the fact

**What goes wrong:** A project starts with `strict: false` (or no explicit setting) and strict mode is enabled later, revealing hundreds of errors that need fixing under time pressure.

**Why it happens:** Adding strict mode is deferred because "we'll add it when the code is working."

**How to avoid:** Add `"strict": true` to `tsconfig.base.json` before any implementation files are written. Zero cost to enable before code exists; high cost to enable after.

**Warning signs:** Any `tsconfig.json` that does not explicitly set `"strict": true` or does not extend a base that does.

### Pitfall 3: packages/types not properly linked in workspace

**What goes wrong:** `apps/api` and `apps/web` cannot import from `@resume/types`, or TypeScript does not pick up type changes from the package.

**Why it happens:** The workspace protocol reference in `package.json` is missing, or the `exports` field in `packages/types/package.json` points to compiled output that does not exist in development.

**How to avoid:** Use `"@resume/types": "*"` in each app's `package.json` dependencies. Set `packages/types/package.json` `main` and `exports` to point at the TypeScript source (`./src/index.ts`) for monorepo development. Run `npm install` from the root after adding the reference.

**Warning signs:** `Cannot find module '@resume/types'` error. `tsc` or `vitest` failing on import.

### Pitfall 4: Express 5 used with Express 4 error handling patterns

**What goes wrong:** Route handlers still use `try/catch` + `next(err)` patterns when Express 5 propagates async errors automatically.

**Why it happens:** Most tutorials and documentation online are for Express 4.

**How to avoid:** In Express 5, an async route handler that throws will automatically call the error middleware without any explicit `try/catch`. The 4-argument error handler must still be registered last in the middleware chain.

**Warning signs:** Route handlers with boilerplate `try { ... } catch (err) { next(err) }` around every `await`.

### Pitfall 5: Non-serializable fields in ResumeStructure

**What goes wrong:** `ResumeStructure` contains `Date` objects, class instances, `Buffer`, or `undefined` values. These do not survive `JSON.stringify` / `JSON.parse` correctly. Since `ResumeStructure` round-trips through the client (sent in `/api/analyze` response, returned in `/api/generate` body), any non-serializable field is silently dropped or mangled.

**Why it happens:** Service code may produce `new Date()` timestamps or class instances and add them to the structure.

**How to avoid:** Keep `ResumeStructure` a plain object tree of primitives (`string`, `number`, `boolean`) and nested plain objects/arrays. Zod schemas enforce this if written to only accept these primitive types.

**Warning signs:** A field is defined in `ResumeStructure` but has a different value (or is missing) after the client sends it back in the `/api/generate` body.

---

## Code Examples

### Express app entry point

```typescript
// apps/api/src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' }));
app.use(express.json({ limit: '1mb' }));  // JSON body for /api/generate

// Routes (stubs in Phase 1; implemented in Phase 4 and 5)
// app.use('/api', analyzeRouter);
// app.use('/api', generateRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Error middleware MUST be last
app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
```

### packages/types barrel export

```typescript
// packages/types/src/index.ts
export * from './resume';
export * from './bullet';
export * from './analysis';
```

### Zod schema validation at a service boundary

```typescript
// Usage pattern in any service (Phase 2+)
import { ResumeStructureSchema } from '@resume/types';
import { PdfParseError } from '../middleware/error.middleware';

function validateResumeStructure(raw: unknown) {
  const result = ResumeStructureSchema.safeParse(raw);
  if (!result.success) {
    throw new PdfParseError(`Invalid ResumeStructure: ${result.error.message}`);
  }
  return result.data; // typed as ResumeStructure
}
```

### Root package.json workspace manifest

```json
{
  "name": "resume-tailoring-engine",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "2.8.14",
    "typescript": "5.9.3"
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ts-node for Express dev | tsx 4.x | 2023–2024 | Faster startup, native ESM, no extra config |
| Express 4 manual async error wrapping | Express 5 automatic async error propagation | Express 5 stable ~2025 | Cleaner route handlers; no `try/catch` + `next(err)` boilerplate |
| Separate type definitions + manual Zod schemas | Zod-inferred types (`z.infer<typeof Schema>`) | Zod 3+ | Single source of truth for both runtime validation and TypeScript types |
| Turborepo 1.x `pipeline` key | Turborepo 2.x `tasks` key | Turbo 2.0 | `turbo.json` structure changed; using `pipeline` in v2 is a breaking error |

**Deprecated/outdated:**
- `ts-node`: Replaced by `tsx`; slower, more config required for ESM
- `pipeline` key in `turbo.json`: Renamed to `tasks` in Turborepo 2.0 — using `pipeline` will error
- Express 4 error patterns with `try/catch` + `next(err)` in every async handler: Express 5 handles this automatically

---

## Open Questions

1. **Next.js 16 App Router — any breaking changes from 14/15 for a fresh project?**
   - What we know: Next.js 16.1.6 is current on npm. The App Router pattern has been stable since Next.js 13.
   - What's unclear: Whether any new required config (e.g., `turbopack` by default) needs explicit opt-out.
   - Recommendation: Run `npx create-next-app@latest` to get the canonical scaffold for Next.js 16, then adapt for the monorepo structure. Do not hand-write the Next.js config from memory.

2. **Express 5 — fully stable for production use?**
   - What we know: Express 5.2.1 is on npm. Express 5 has been in beta for years but reached stable release.
   - What's unclear: Whether the ecosystem (e.g., `@types/express`, `multer`) has fully caught up to Express 5 typings.
   - Recommendation: `@types/express` 5.0.6 is available and aligned with Express 5. Proceed with Express 5; `multer` 2.1.1 also supports Express 5.

3. **Zod 4 — API changes from Zod 3?**
   - What we know: Zod 4.3.6 is current on npm. Training data references Zod 3.x.
   - What's unclear: Whether Zod 4 introduced breaking API changes that would affect the patterns documented in research.
   - Recommendation: Verify the `z.object()`, `z.infer`, `safeParse()` API against current Zod 4 docs before writing schemas. The core API is stable but minor changes (e.g., error message format) may differ.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | `vitest.config.ts` per package (Wave 0 — does not exist yet) |
| Quick run command | `turbo test --filter=@resume/types` |
| Full suite command | `turbo test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| infra-2 | `ResumeStructure` schema accepts valid full structure | unit | `turbo test --filter=@resume/types` | Wave 0 |
| infra-2 | `ResumeStructure` schema rejects missing layout fields | unit | `turbo test --filter=@resume/types` | Wave 0 |
| infra-2 | `RewrittenBullet` schema validates | unit | `turbo test --filter=@resume/types` | Wave 0 |
| infra-2 | `AnalysisResult` schema validates | unit | `turbo test --filter=@resume/types` | Wave 0 |
| infra-3 | Zod `safeParse` rejects invalid `fontName` (non-string) | unit | `turbo test --filter=@resume/types` | Wave 0 |
| infra-3 | Zod `safeParse` rejects score outside 0–100 | unit | `turbo test --filter=@resume/types` | Wave 0 |
| infra-4 | Error middleware returns 422 for `PdfParseError` | unit | `turbo test --filter=@resume/api` | Wave 0 |
| infra-4 | Error middleware returns 504 with `retryable: true` for `OpenAiTimeoutError` | unit | `turbo test --filter=@resume/api` | Wave 0 |
| infra-4 | Error middleware returns 500 for unknown errors | unit | `turbo test --filter=@resume/api` | Wave 0 |
| infra-1 | Express health endpoint returns 200 | smoke | `curl http://localhost:3001/health` (manual) | manual-only |
| infra-5 | TypeScript strict mode passes zero errors | typecheck | `turbo typecheck` | Wave 0 |

### Sampling Rate

- **Per task commit:** `turbo test --filter=@resume/types`
- **Per wave merge:** `turbo test && turbo typecheck`
- **Phase gate:** Full suite green + `turbo typecheck` zero errors before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/types/vitest.config.ts` — vitest config for types package
- [ ] `packages/types/src/__tests__/resume.test.ts` — covers infra-2, infra-3
- [ ] `packages/types/src/__tests__/bullet.test.ts` — covers infra-2
- [ ] `packages/types/src/__tests__/analysis.test.ts` — covers infra-2, infra-3
- [ ] `apps/api/vitest.config.ts` — vitest config for api app
- [ ] `apps/api/src/__tests__/error.middleware.test.ts` — covers infra-4
- [ ] Framework install: `npm install -D vitest` in `packages/types` and `apps/api`

---

## Sources

### Primary (HIGH confidence)

- ARCHITECTURE.md (this project) — `ResumeStructure` type design, service boundaries, data flow diagrams
- STACK.md (this project) — Library rationale, alternatives considered
- SUMMARY.md (this project) — Executive summary and phase rationale
- npm registry (2026-03-08) — Verified: turbo@2.8.14, tsx@4.21.0, tsup@8.5.1, zod@4.3.6, vitest@4.0.18, typescript@5.9.3, next@16.1.6, express@5.2.1, multer@2.1.1, cors@2.8.6, helmet@8.1.0, @types/express@5.0.6

### Secondary (MEDIUM confidence)

- Turborepo documentation (turbo.build/repo/docs) — `tasks` key (v2), workspace setup patterns
- Express.js 5.x documentation — async error propagation, 4-argument error middleware
- Zod documentation (zod.dev) — `z.infer`, `safeParse`, schema composition

### Tertiary (LOW confidence)

- Next.js 16 specific configuration — training data does not cover Next.js 16; canonical scaffold via `create-next-app@latest` is more reliable than any documented pattern here

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions npm-verified 2026-03-08
- Architecture: HIGH — derived from project's own ARCHITECTURE.md and established Express/Turborepo patterns
- Type design: HIGH — fully specified in ARCHITECTURE.md; Zod schema patterns are stable
- Pitfalls: HIGH — specific to this project's design constraints; confirmed by first-party research

**Research date:** 2026-03-08
**Valid until:** 2026-06-08 (90 days — stable infrastructure tooling; re-verify Next.js version before starting)
