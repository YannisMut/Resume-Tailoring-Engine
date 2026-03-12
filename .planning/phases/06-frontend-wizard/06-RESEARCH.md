# Phase 6: Frontend Wizard - Research

**Researched:** 2026-03-12
**Domain:** Next.js App Router, Tailwind CSS v4, React state management, file upload UI, DOCX download
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Tailwind CSS — install tailwindcss + PostCSS plugin
- No component library — build all components from scratch
- Visual tone: clean minimal — white background, dark text, subtle gray borders, no decorative elements
- Polish level: highly polished — animations, hover states, careful spacing, good typography
- Single-page wizard: all 3 steps render from one `page.tsx`, current step controlled by React state. AnalysisResult stays in memory — no sessionStorage, no URL serialization
- No back navigation: going back means starting over
- Visible step progress indicator: simple "1. Upload → 2. Review → 3. Download" header bar
- Step 1 two-column layout: PDF drop zone left, JD textarea right. Both visible simultaneously
- PDF upload: drag-and-drop zone + file picker. Large dashed-border drop target with file icon, "Drop your resume here or click to browse", and "PDF only · max 10MB" hint
- PDF error display: inline in drop zone — error replaces zone content with icon + specific message per error code (pdf_not_pdf → "This isn't a PDF", pdf_too_large → "File exceeds 10MB", pdf_scanned → "This PDF appears to be scanned — try one exported from Word or Google Docs", pdf_encrypted → "This PDF is password-protected — remove the password and try again"). Drop zone border turns red. "Try another file" resets it.
- Submit button ("Analyze Resume →") below the two-column inputs
- Full-screen or page-level loading state during the AI call (expected 15–30s). Must be visible for entire duration.
- Review layout: card per bullet, side-by-side columns. Left = original, right = AI rewrite. Grouped by section
- All rewrites pending by default (neither accepted nor rejected)
- Accept/Reject/Revert/inline-edit per bullet card
- Inline editing: clicking Edit or the rewrite text → editable textarea. Save/Cancel. Saved text counts as approved. Revert restores AI rewrite.
- "Accept All" bulk action at the top, no "Reject All"
- Sticky "Generate DOCX →" button
- Auto-generate DOCX on arrival at Step 3
- Loading state → Download button
- Output filename: `resume_tailored.docx`
- Generation failure: inline error + Retry button. User stays on Step 3, bullet edits preserved
- Score and gaps remain visible on Step 3

### Claude's Discretion
- Loading state copy and visual design during the AI call
- Exact spacing, typography scale, and color palette within the "clean minimal" constraint
- Sticky header/footer implementation details
- Transition/animation specifics (step changes, card state changes)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INPUT-06 | User can paste or type a job description into a plain textarea | Textarea with `maxLength` or `onChange` validation against 5000-char ANAL-03 constraint; handled entirely in React state |
| REVIEW-01 | User sees original and rewritten bullets side-by-side for every bullet in the resume | `RewrittenBullet[]` from AnalysisResult; grouping by sectionId derived from `ResumeStructure`; two-column card layout |
| REVIEW-02 | User can approve, reject, or inline-edit each rewritten bullet individually | Local bullet state array tracks `status: 'pending' | 'approved' | 'rejected' | 'edited'` and `editedText`; controlled textarea for inline edit |
| REVIEW-04 | User can revert any rewritten bullet to the original with one click | Revert clears `editedText` and resets `status` to `'pending'` |
| OUT-02 | System shows a processing indicator during the AI call (expected 15–30s) | Wizard step `'loading'` state; no timeout needed, just a spinner/message until fetch resolves |
| OUT-03 | If DOCX generation fails, analysis state is preserved so the user can retry without re-uploading | `analysisResult` lives in React state at page level; Step 3 errors do not clear it; Retry re-calls `POST /api/generate` with same payload |
</phase_requirements>

---

## Summary

Phase 6 builds a 3-step single-page wizard entirely inside `apps/web`. The backend APIs (`POST /api/analyze` and `POST /api/generate`) are complete and running on port 3001. The Express server already configures CORS with `origin: WEB_ORIGIN` defaulting to `http://localhost:3000`, so the browser can call the API directly. A Next.js `rewrites` proxy is the cleanest alternative and avoids needing CORS headers at all in production, but is optional given CORS is already handled.

The three main implementation layers are: (1) Tailwind CSS v4 installation and global styles, (2) the wizard page with React state machine controlling step transitions, and (3) the three step components. The only non-trivial browser API work is the drag-and-drop file zone (HTML5 drag events) and the DOCX download (fetch → Blob → programmatic anchor click).

Validation testing (Nyquist) for this phase uses Vitest + React Testing Library. Next.js App Router does not support async Server Component unit tests in Vitest; since the wizard is a `'use client'` component throughout, this is not a concern. Vitest + jsdom covers all UI logic.

**Primary recommendation:** Build `page.tsx` as a client component with a `step` state machine (`'upload' | 'loading' | 'review' | 'generating' | 'download' | 'error'`), keep `analysisResult` and the bullet decision array at page level, and pass them down to step components as props. No external state library needed.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | 4.x | Utility-first CSS | Locked decision; v4 is the current major with zero-config content detection |
| @tailwindcss/postcss | 4.x | PostCSS plugin for v4 | Required companion for v4; replaces v3 `tailwindcss` PostCSS entry |
| postcss | latest | CSS transformation pipeline | Required peer for @tailwindcss/postcss |
| next | 16.1.6 | Already installed | App Router; `'use client'` directive for interactive pages |
| react / react-dom | latest | Already installed | — |

### Testing (Nyquist validation)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.x (match API) | Test runner | Already used in `apps/api`; add to `apps/web` |
| @vitejs/plugin-react | latest | JSX transform for vitest | Required for React component tests |
| jsdom | latest | DOM environment | Required for RTL in vitest |
| @testing-library/react | latest | Component rendering + queries | Standard for React UI tests |
| @testing-library/dom | latest | DOM query helpers | RTL peer |
| @testing-library/user-event | latest | Simulates user interactions | For click, type, drag interactions |
| vite-tsconfig-paths | latest | Resolve tsconfig paths in vite | Needed since tsconfig has `paths: { "@/*" }` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | — | No additional runtime libraries required | Drag-and-drop, file download, textarea, and fetch are all native browser APIs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native HTML5 drag-and-drop | react-dropzone | react-dropzone is mature but adds a dependency; the custom zone here is simple (single file, PDF only) — hand-rolled is fine |
| Direct fetch to port 3001 | Next.js rewrites proxy | Rewrites hide the port from the browser and avoid CORS entirely; direct fetch is simpler and CORS is already configured — either works |
| Tailwind v4 | Tailwind v3 | v4 is the current release and what the official Next.js guide documents; v3 would require `tailwind.config.js` |

**Installation (run inside `apps/web`):**
```bash
npm install tailwindcss @tailwindcss/postcss postcss
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/user-event vite-tsconfig-paths
```

---

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
├── app/
│   ├── globals.css          # @import "tailwindcss" (only line needed for v4)
│   ├── layout.tsx           # Add globals.css import here
│   ├── page.tsx             # WizardPage — 'use client', full step state machine
│   └── components/
│       ├── StepBar.tsx      # Progress indicator (steps 1/2/3)
│       ├── UploadStep.tsx   # Step 1: DropZone + JD textarea + submit
│       ├── DropZone.tsx     # Drag-and-drop file zone (self-contained)
│       ├── LoadingStep.tsx  # Full-screen loader for AI call
│       ├── ReviewStep.tsx   # Step 2: bullet card grid + Accept All + Generate button
│       ├── BulletCard.tsx   # Single original/rewrite card with A/R/E/Revert
│       └── DownloadStep.tsx # Step 3: auto-generate, score/gaps, download button
├── postcss.config.mjs       # @tailwindcss/postcss plugin
├── vitest.config.mts        # vitest + react + jsdom + tsconfigPaths
└── __tests__/
    ├── DropZone.test.tsx
    ├── BulletCard.test.tsx
    └── DownloadStep.test.tsx
```

### Pattern 1: Wizard Step State Machine
**What:** `page.tsx` holds a `step` discriminated union and all cross-step data. Each step renders a single component and receives only what it needs as props.
**When to use:** All transitions; prevents child components from reaching up to parent state.

```typescript
// Source: project pattern (no external library)
type WizardStep =
  | { name: 'upload' }
  | { name: 'loading' }
  | { name: 'review'; result: AnalysisResult; bullets: BulletDecision[] }
  | { name: 'generating'; result: AnalysisResult; bullets: BulletDecision[] }
  | { name: 'download'; result: AnalysisResult; bullets: BulletDecision[] }
  | { name: 'error'; message: string };

// BulletDecision extends RewrittenBullet with local decision state
interface BulletDecision extends RewrittenBullet {
  status: 'pending' | 'approved' | 'rejected' | 'edited';
  editedText?: string;   // set when status === 'edited'
}
```

### Pattern 2: Drag-and-Drop Drop Zone (HTML5, no library)
**What:** `onDragOver` + `onDrop` + `onDragLeave` event handlers on a `<div>`. Hidden `<input type="file">` for the click-to-browse path. Both paths converge at the same file-validation handler.
**When to use:** DropZone component.

```typescript
// Source: HTML5 File API (MDN verified pattern)
function handleDrop(e: React.DragEvent<HTMLDivElement>) {
  e.preventDefault();
  setIsDragging(false);
  const file = e.dataTransfer.files[0];
  if (file) validateAndSetFile(file);
}

function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (file) validateAndSetFile(file);
}

// Client-side pre-validation (mirrors server-side error codes)
function validateAndSetFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    setError({ code: 'pdf_not_pdf', message: "This isn't a PDF" });
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    setError({ code: 'pdf_too_large', message: 'File exceeds 10MB' });
    return;
  }
  setError(null);
  setFile(file);
}
```

### Pattern 3: API Call — POST /api/analyze
**What:** `FormData` with PDF blob + `jobDescription` string, sent via `fetch`. Parse error code from JSON response to show targeted inline messages.
**When to use:** UploadStep submit handler.

```typescript
// Source: Browser Fetch API + FormData (MDN)
async function submitAnalysis(file: File, jobDescription: string) {
  setStep({ name: 'loading' });
  const form = new FormData();
  form.append('resume', file);
  form.append('jobDescription', jobDescription);

  const res = await fetch('http://localhost:3001/api/analyze', {
    method: 'POST',
    body: form,
    // Do NOT set Content-Type — browser sets multipart boundary automatically
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = body?.error?.code ?? 'unknown';
    // Map code to user-facing message, show in drop zone
    handleApiError(code);
    setStep({ name: 'upload' });
    return;
  }

  const result: AnalysisResult = await res.json();
  const bullets: BulletDecision[] = result.rewrites.map((r) => ({
    ...r,
    status: 'pending',
  }));
  setStep({ name: 'review', result, bullets });
}
```

### Pattern 4: DOCX Download — fetch → Blob → anchor click
**What:** Fetch the binary endpoint, convert to Blob, create object URL, trigger programmatic `<a>` click, revoke URL.
**When to use:** DownloadStep auto-generate + Download button.

```typescript
// Source: Browser Blob + URL APIs (MDN)
async function generateDocx(result: AnalysisResult, bullets: BulletDecision[]) {
  setGenerating(true);
  setError(null);

  const approvedBullets = bullets.map((b) => ({
    ...b,
    rewritten: b.status === 'edited' ? (b.editedText ?? b.rewritten) : b.rewritten,
    approved: b.status === 'approved' || b.status === 'edited',
  }));

  const res = await fetch('http://localhost:3001/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resumeStructure: result.resumeStructure,
      bullets: approvedBullets,
    }),
  });

  if (!res.ok) {
    setError('DOCX generation failed. Your edits are preserved — try again.');
    setGenerating(false);
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'resume_tailored.docx';
  a.click();
  URL.revokeObjectURL(url);
  setGenerating(false);
  setDownloadReady(true);
}
```

### Pattern 5: Next.js Rewrites as API Proxy (optional)
**What:** Configure `rewrites` in `next.config.ts` to forward `/api/:path*` from port 3000 to 3001. Eliminates CORS and hardcoded port in fetch calls.
**When to use:** If the hardcoded port in fetch calls is a concern; otherwise skip (CORS is already handled by Express).

```typescript
// Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites
// next.config.ts
const nextConfig: NextConfig = {
  transpilePackages: ['@resume/types'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};
```

With rewrites active, fetch calls use `/api/analyze` and `/api/generate` (no port), and no `Content-Type` CORS preflight issues.

### Pattern 6: Tailwind CSS v4 Setup
**What:** Single `@import "tailwindcss"` in `globals.css`; PostCSS plugin config; no `tailwind.config.js` needed.
**When to use:** Wave 0 / plan 1 setup task.

```typescript
// postcss.config.mjs
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
export default config;
```

```css
/* app/globals.css */
@import "tailwindcss";
```

```typescript
// app/layout.tsx — add the import
import './globals.css';
```

### Anti-Patterns to Avoid
- **Don't set `Content-Type: multipart/form-data` manually on FormData fetch.** The browser must set it with the boundary string. Setting it manually breaks multipart parsing in multer.
- **Don't store AnalysisResult in sessionStorage or URL params.** The payload is large and contains ResumeStructure with all layout metadata — URL serialization breaks, sessionStorage is unnecessary given in-memory state survives the wizard session.
- **Don't nest `'use client'` page.tsx inside a Server Component layout that does async work.** The root layout is a simple shell — keep it that way.
- **Don't call `URL.revokeObjectURL` synchronously before the anchor click completes.** Use `setTimeout` or revoke on a subsequent user action if needed, but the standard pattern (revoke immediately after `.click()`) works because the browser has already queued the download.
- **Don't use `position: fixed` for the sticky "Generate DOCX →" button.** Use `sticky bottom-0` on a container inside the review column instead, so it scrolls with its container but pins at the bottom of the viewport once reached.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Grouping bullets by section | Custom grouping algorithm | Derive from `AnalysisResult.resumeStructure.sections[].items[].id` matching `RewrittenBullet.id` | The ID is the join key; a `Map<sectionName, BulletDecision[]>` built once is sufficient |
| File type detection | Magic-byte reader in the browser | Client-side: check `.name` extension + `file.type`; server-side already validates with magic bytes | Browser content sniffing is unreliable; server is the authoritative validator |
| Animated loading messages | Custom timer/message cycler | Simple spinner + single message or short cycling via `useEffect` + interval | The duration is 15–30s — a spinner with one good message is more trustworthy than fake progress |
| Error code → message mapping | Switch statement repeated across components | Constant map `ERROR_MESSAGES: Record<string, string>` in a `lib/errors.ts` file | Single source of truth; easy to update wording |

**Key insight:** The hardest UI problem in this phase is the bullet state management in the Review step. The `BulletDecision[]` array (a flat list with `status` + `editedText` per bullet) is the entire state model needed — no reducer, no context, no external store.

---

## Common Pitfalls

### Pitfall 1: Forgetting `e.preventDefault()` on `dragover`
**What goes wrong:** Drop event never fires — the browser's default drag behavior cancels it.
**Why it happens:** The browser ignores drop events unless `dragover` explicitly calls `preventDefault()`.
**How to avoid:** Always include `e.preventDefault(); e.stopPropagation();` in both `onDragOver` and `onDrop`.
**Warning signs:** Drop zone accepts drag styling but file never registers.

### Pitfall 2: Setting `Content-Type` manually on FormData POST
**What goes wrong:** multer fails to parse the multipart body ("Unexpected end of form" or similar), server returns 400/422.
**Why it happens:** Browser generates `multipart/form-data; boundary=----XYZ` automatically only if `Content-Type` is absent. Manual setting omits the boundary.
**How to avoid:** Pass `FormData` as `body` to `fetch` with no explicit `Content-Type` header.
**Warning signs:** `POST /api/analyze` returns 400 or multer `req.file` is undefined.

### Pitfall 3: Tailwind v4 classes not applying
**What goes wrong:** Components render with no styles even though `className` is correct.
**Why it happens:** Missing `postcss.config.mjs`, wrong plugin name (`tailwindcss` instead of `@tailwindcss/postcss`), or `globals.css` not imported in `layout.tsx`.
**How to avoid:** Verify all three: postcss config, plugin name, and CSS import in layout.
**Warning signs:** No error in console, but all elements appear unstyled.

### Pitfall 4: Tailwind v4 vs v3 config format confusion
**What goes wrong:** Creating `tailwind.config.js` with `content` array — works in v3, ignored in v4. Custom theme values defined incorrectly.
**Why it happens:** v4 uses `@theme` in CSS instead of a JS config file.
**How to avoid:** Define custom tokens in `globals.css` with `@theme { --color-brand: #...; }`. No JS config file needed.
**Warning signs:** Custom colors/spacing don't apply; no build error.

### Pitfall 5: Bullet sections not grouped correctly
**What goes wrong:** All bullets appear in one flat list with no section headers.
**Why it happens:** `RewrittenBullet.id` is the join key to `ResumeStructure.sections[].items[]`, but the grouping logic needs to be built explicitly.
**How to avoid:** On arrival at Review step, build a `Map<string, { sectionName: string; item: SectionItem; bullet: BulletDecision }[]>` using the ID join. This map drives the grouped render.
**Warning signs:** Review step renders but section headers are missing.

### Pitfall 6: DOCX download triggers before blob is ready
**What goes wrong:** `resume_tailored.docx` downloads as a 0-byte or corrupted file.
**Why it happens:** `URL.createObjectURL` called on an unconverted Response instead of an awaited Blob.
**How to avoid:** Always `await res.blob()` before `URL.createObjectURL(blob)`.
**Warning signs:** File downloads instantly but is 0 bytes; Word refuses to open it.

### Pitfall 7: Sticky button not sticking
**What goes wrong:** "Generate DOCX →" scrolls off screen on long review lists.
**Why it happens:** `sticky` requires the element's containing block to be scrollable, and `overflow: hidden` on any ancestor breaks sticky.
**How to avoid:** Use `sticky bottom-0` on a footer within the review column. Ensure no ancestor has `overflow: hidden`. The `<body>` is the scroll container.
**Warning signs:** Button sticks at first but disappears after adding more cards; or never sticks.

### Pitfall 8: `AnalysisResult` import fails in browser
**What goes wrong:** TypeScript error or runtime crash when importing `@resume/types` in a client component.
**Why it happens:** `transpilePackages: ['@resume/types']` is already set in `next.config.ts` — this should work. The pitfall is importing a Node.js-only module from within `@resume/types`. Check that `packages/types/src/*.ts` has no Node.js imports.
**How to avoid:** The types package exports only Zod schemas and TypeScript types — no Node.js APIs. No action needed.

---

## Code Examples

### Vitest Configuration for apps/web
```typescript
// Source: https://nextjs.org/docs/app/guides/testing/vitest
// apps/web/vitest.config.mts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

### BulletCard unit test pattern
```typescript
// Source: @testing-library/react patterns
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BulletCard from '../app/components/BulletCard';

const bullet = {
  id: 'b1',
  original: 'Led the team',
  rewritten: 'Directed cross-functional team',
  approved: false,
  status: 'pending' as const,
};

describe('BulletCard', () => {
  it('shows both original and rewritten text', () => {
    render(<BulletCard bullet={bullet} onAccept={vi.fn()} onReject={vi.fn()} onEdit={vi.fn()} onRevert={vi.fn()} />);
    expect(screen.getByText('Led the team')).toBeDefined();
    expect(screen.getByText('Directed cross-functional team')).toBeDefined();
  });

  it('calls onAccept when Accept button is clicked', async () => {
    const onAccept = vi.fn();
    render(<BulletCard bullet={bullet} onAccept={onAccept} onReject={vi.fn()} onEdit={vi.fn()} onRevert={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(onAccept).toHaveBeenCalledWith('b1');
  });
});
```

### Error code message mapping
```typescript
// Source: project pattern
// apps/web/app/lib/errors.ts
export const PDF_ERROR_MESSAGES: Record<string, string> = {
  pdf_not_pdf: "This isn't a PDF",
  pdf_too_large: 'File exceeds 10MB',
  pdf_scanned:
    'This PDF appears to be scanned — try one exported from Word or Google Docs',
  pdf_encrypted:
    'This PDF is password-protected — remove the password and try again',
  pdf_corrupt: 'This PDF could not be read — try a different file',
  jd_too_long: 'Job description is too long — please trim it to 5,000 characters',
  unknown: 'Something went wrong — please try again',
};
```

### Bullet grouping by section
```typescript
// Source: project pattern — derived from @resume/types schema
// Given: result.resumeStructure.sections[] and result.rewrites[]
function groupBulletsBySection(
  sections: ResumeStructure['sections'],
  bullets: BulletDecision[],
): Array<{ sectionName: string; bullets: BulletDecision[] }> {
  const bulletMap = new Map(bullets.map((b) => [b.id, b]));
  const groups: Array<{ sectionName: string; bullets: BulletDecision[] }> = [];

  for (const section of sections) {
    const sectionBullets: BulletDecision[] = [];
    for (const item of section.items) {
      for (const bullet of item.bullets) {
        const decision = bulletMap.get(bullet.id);
        if (decision) sectionBullets.push(decision);
      }
    }
    if (sectionBullets.length > 0) {
      groups.push({ sectionName: section.heading, bullets: sectionBullets });
    }
  }
  return groups;
}
```

Note: The `ResumeStructure.sections[].items[].bullets` shape is verified: `SectionItemSchema` has `bullets: z.array(BulletSchema)` where `BulletSchema` has `id: z.string()` and `text: z.string()`. The ID join logic in this code example is confirmed correct.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3: `tailwind.config.js` + `@tailwind base/components/utilities` | Tailwind v4: `@tailwindcss/postcss` + `@import "tailwindcss"` | v4.0 released 2025-01 | No config JS file; `@theme` in CSS for tokens |
| Next.js Pages Router file upload | App Router `'use client'` + native `FormData` fetch | Next.js 13+ | Server Actions optional; direct fetch is simpler for this use case |
| `useState` + `useReducer` for complex form state | Still `useState` for flat arrays at this scale | Stable | No Zustand/Jotai needed for this wizard |

**Deprecated/outdated:**
- `tailwindcss` as a PostCSS plugin (v3): use `@tailwindcss/postcss` in v4
- `@tailwind base; @tailwind components; @tailwind utilities` directives: replaced by `@import "tailwindcss"` in v4
- `content` array in `tailwind.config.js`: not needed in v4 (auto-detection)

---

## Open Questions

1. **Bullet ID structure in ResumeStructure — RESOLVED**
   - Confirmed: `SectionItemSchema.bullets` is `z.array(BulletSchema)` where `BulletSchema` has `id: z.string()` (deterministic format: `"experience-0-item-0-bullet-2"`) and `text: z.string()`.
   - The grouping code example in this document is correct as written.

2. **API base URL — RECOMMENDATION**
   - Express runs on 3001 in dev with CORS already configured for `localhost:3000`.
   - Both options work: (a) add `rewrites()` to `next.config.ts` so all fetch calls use `/api/...` (cleaner, no port in component code), or (b) keep direct `http://localhost:3001/api/...` fetch calls (simpler).
   - Recommendation: Use Next.js rewrites (Pattern 5 in this document) — eliminates the port from every component and works transparently with the existing CORS config.

3. **`approved` field usage — RESOLVED**
   - Confirmed via `apps/api/src/services/docx.service.ts` `selectBulletText()`: `return rewritten?.approved ? rewritten.rewritten : bulletText;`
   - The service selects the AI rewrite text only when `approved === true`. The frontend MUST set `approved: true` for accepted/edited bullets before sending to `POST /api/generate`.
   - Pattern 4 (DOCX download) in this document already sets this correctly: `approved: b.status === 'approved' || b.status === 'edited'`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (match API package.json) |
| Config file | `apps/web/vitest.config.mts` — does NOT exist yet (Wave 0 gap) |
| Quick run command | `npm run test --workspace=apps/web -- --run` |
| Full suite command | `npm run test --workspace=apps/web -- --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INPUT-06 | Textarea accepts and trims input up to 5000 chars | unit | `npm run test --workspace=apps/web -- --run` | ❌ Wave 0 |
| REVIEW-01 | BulletCard renders original and rewritten text | unit | `npm run test --workspace=apps/web -- --run` | ❌ Wave 0 |
| REVIEW-02 | Accept/Reject/Edit buttons call correct handlers | unit | `npm run test --workspace=apps/web -- --run` | ❌ Wave 0 |
| REVIEW-04 | Revert button resets status to pending | unit | `npm run test --workspace=apps/web -- --run` | ❌ Wave 0 |
| OUT-02 | Loading step renders during fetch (mocked) | unit | `npm run test --workspace=apps/web -- --run` | ❌ Wave 0 |
| OUT-03 | Generation error preserves analysisResult in state | unit | `npm run test --workspace=apps/web -- --run` | ❌ Wave 0 |

Note: Full end-to-end (upload PDF, see review, download DOCX) is a manual smoke test — the browser file API and fetch calls to a live server cannot be meaningfully unit tested without E2E infrastructure (Playwright), which is out of scope for Phase 6.

### Sampling Rate
- **Per task commit:** `npm run test --workspace=apps/web -- --run`
- **Per wave merge:** `npm run test --workspace=apps/web -- --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/vitest.config.mts` — Vitest + react + jsdom + tsconfigPaths
- [ ] `apps/web/package.json` — add `"test": "vitest run"` script and dev dependencies
- [ ] `apps/web/__tests__/BulletCard.test.tsx` — covers REVIEW-01, REVIEW-02, REVIEW-04
- [ ] `apps/web/__tests__/DownloadStep.test.tsx` — covers OUT-02, OUT-03 (mocked fetch)
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/user-event vite-tsconfig-paths --workspace=apps/web`

---

## Sources

### Primary (HIGH confidence)
- https://tailwindcss.com/docs/guides/nextjs — v4 installation steps for Next.js, verified 2026-03-12
- https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites — rewrites proxy syntax, version 16.1.6, lastUpdated 2026-02-27
- https://nextjs.org/docs/app/guides/testing/vitest — Vitest setup for Next.js App Router, version 16.1.6, lastUpdated 2026-02-27
- `apps/api/src/index.ts` (this repo) — CORS already configured, routes confirmed
- `packages/types/src/` (this repo) — AnalysisResult, RewrittenBullet, ResumeStructure schemas

### Secondary (MEDIUM confidence)
- MDN HTML5 Drag and Drop API — `onDragOver` + `e.preventDefault()` pattern is standard and stable
- MDN Fetch API + Blob + URL.createObjectURL — programmatic download pattern is standard

### Tertiary (LOW confidence)
- WebSearch: React drag-and-drop without libraries — multiple sources agree on the `onDragOver`/`onDrop` pattern; not verified against a single authoritative doc but consistent across results

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against official Tailwind v4 docs and Next.js 16.1.6 docs
- Architecture: HIGH — patterns derived directly from existing codebase schemas and official Next.js testing docs
- Pitfalls: HIGH — pitfalls 1 (dragover preventDefault), 2 (FormData Content-Type), 3-4 (Tailwind v4) verified against official sources; pitfall 5 derived from @resume/types schema; pitfalls 6-8 standard browser API behavior
- Testing: HIGH — Next.js official docs confirm Vitest + jsdom setup; async Server Components caveat documented

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (Tailwind v4 and Next.js 16 are stable releases; unlikely to change significantly in 30 days)
