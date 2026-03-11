# Phase 5: DOCX Generation - Research

**Researched:** 2026-03-10
**Domain:** Node.js DOCX generation (`docx` npm), Express binary response, Next.js file download
**Confidence:** HIGH (core library API), MEDIUM (unit conversions, font substitution table)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Font substitution:** Substitute closest system font when the PDF's font isn't available in DOCX (e.g. Garamond → Times New Roman, Gotham → Calibri). Do NOT hard-fail on missing font.
- **Spacing fidelity:** Apply spacing exactly from ResumeStructure: `lineSpacingPt`, `spaceBefore`, `spaceAfter`, and all margin values from `meta`.
- **Non-reproducible elements:** Decorative rules, graphics, multi-column layouts are silently omitted — no error.
- **Minimum bar:** All approved bullet text present, sections in correct order, fonts and spacing close enough that a hiring manager sees the same resume. Pixel-perfect not required.
- **Header block:** Render each header line using its captured `TextStyle` (fontName, fontSize, bold, italic, color) — name large/bold, contact info smaller.
- **Section items:** Job title rows, company/date lines — pass through original text with their captured `TextStyle`.
- **Item-only sections (Skills, Education):** Same treatment as regular items, no special logic.
- **Unapproved bullets:** `approved: false` → use `original` text; `approved: true` (or user-edited) → use `rewritten` text.
- **Step 3 UX:** Auto-generates on arrival; loading state → Download button when ready.
- **Generation failure:** Inline error on Step 3 + Retry button; bullet edits are NOT lost.
- **Output filename:** `resume_tailored.docx`

### Claude's Discretion
- Font substitution mapping table (which fonts map to which)
- DOCX library selection (`docx` npm package or equivalent)
- Exact loading state copy and visual treatment
- Error message copy for generation failures

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OUT-01 | User can download a DOCX that uses the approved bullets and preserves the original resume's visual layout (fonts, spacing, margins, section structure) | `docx` npm v9 covers all layout properties; TextStyle fields map directly to TextRun/Paragraph API; ResumeStructure.meta maps to Document section properties |
</phase_requirements>

---

## Summary

Phase 5 builds `docx.service.ts` and `POST /api/generate` on the API side, plus Step 3 of the wizard on the web side. The core challenge is converting a `ResumeStructure` (with `TextStyle` per element and page-level `meta`) into an OOXML document using the `docx` npm package, then streaming a binary Buffer to the browser for download.

The `docx` npm package (v9.6.1, TypeScript-native, 2.7M weekly downloads) is the clear standard choice. It provides a declarative API that maps almost 1:1 with the existing `TextStyle` and `ResumeStructure` field names. `Packer.toBuffer(doc)` returns a `Promise<Buffer>` that can be sent directly via Express `res.send()`. The web side uses a `fetch()` → `response.arrayBuffer()` → `Blob` → `URL.createObjectURL` → synthetic `<a>` click pattern, which is the established browser download mechanism.

Two non-trivial technical areas need careful attention. First, **unit conversions**: the `docx` package uses three different unit systems — font size in half-points (matching OOXML half-points in `TextStyle.fontSize`), spacing `before`/`after` in TWIPs (twentieths of a point, so `pt * 20`), and line spacing in 240ths of a line (so `lineSpacingPt * 240 / 12` ≈ `lineSpacingPt * 20` when line height = 12pt). Second, **font name normalization**: PDF embedded fonts have mangled subset prefixes (`ABCDEF+Calibri`). The service must strip the prefix before font substitution lookup.

**Primary recommendation:** Use `docx` v9. Map `TextStyle` to `TextRun` properties directly; map `ResumeStructure.meta` margins to Document section `page.margin`; handle bullets via a pre-declared `AbstractNumbering`/`Numbering` instance with a bullet character.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `docx` | 9.6.1 | Generate `.docx` binary from TypeScript objects | 2.7M weekly downloads, TypeScript-native, declarative API, active maintenance (published daily), covers all required OOXML features |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | All other infra (Express, Zod, vitest, supertest) is already installed | — |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `docx` | `officegen` | officegen is unmaintained (last publish 2019), no TypeScript types |
| `docx` | `docxtemplater` | Template-based; requires a pre-made `.docx` template — incompatible with dynamic layout reconstruction |
| `docx` | `docxml` | Newer, unit-flexible API, but far fewer users (niche), less community examples |

**Installation (API only — DOCX generation is server-side):**
```bash
npm install docx --workspace=apps/api
```

---

## Architecture Patterns

### Recommended File Structure

```
apps/api/src/
├── services/
│   └── docx.service.ts          # generateDocx(structure, bullets): Promise<Buffer>
├── routes/
│   └── generate.route.ts        # POST /api/generate → calls docx.service, sends binary
└── __tests__/
    ├── docx.service.test.ts     # unit: verifies buffer output, bullet text selection
    └── generate.route.test.ts   # integration: supertest, verifies Content-Type header

apps/web/app/
└── page.tsx                     # Step 3 component added to wizard state machine
```

### Pattern 1: Unit Conversion Helper

The `docx` package uses three unit systems. Centralize conversion in the service so callers pass natural units.

**Conversion table:**

| TextStyle/meta field | Unit in schema | docx property | docx unit | Conversion |
|----------------------|----------------|---------------|-----------|------------|
| `fontSize` | half-points (OOXML native) | `TextRun.size` | half-points | **1:1, no conversion needed** |
| `spaceBefore` | points | `Paragraph.spacing.before` | TWIPs (pt × 20) | `× 20` |
| `spaceAfter` | points | `Paragraph.spacing.after` | TWIPs (pt × 20) | `× 20` |
| `lineSpacingPt` | points | `Paragraph.spacing.line` | 240ths of a line | `Math.round(lineSpacingPt * 20)` (since 1pt = 20 twips, and line unit is also in twips when lineRule is EXACT) |
| margins (`marginTop` etc.) | points | `section.page.margin.*` | TWIPs | `× 20` |
| `pageWidth`, `pageHeight` | points | `section.page.size.*` | TWIPs | `× 20` |

**Line spacing note (MEDIUM confidence):** When `lineRule` is `LineRuleType.EXACT`, the `line` value is in TWIPs (pt × 20). When `lineRule` is `LineRuleType.AUTO`, the value is in 240ths of a line (relative). Since `lineSpacingPt` is an absolute point value from PDF parsing, use `LineRuleType.EXACT` with `lineSpacingPt * 20`.

### Pattern 2: Font Name Normalization

PDF embedded fonts carry a 7-char subset prefix before the real name:

```
"ABCDEF+Calibri"  →  strip prefix  →  "Calibri"
"XYZABC+TimesNewRomanPS-BoldMT"  →  strip  →  "TimesNewRomanPS-BoldMT"  →  normalize  →  "Times New Roman"
```

```typescript
// Source: PDF spec + STATE.md blocker note
function normalizeFontName(raw: string): string {
  // Strip subset prefix: "ABCDEF+" at start
  const stripped = raw.replace(/^[A-Z]{6}\+/, '');
  return FONT_SUBSTITUTION_MAP[stripped] ?? stripped;
}
```

### Pattern 3: Font Substitution Map (Claude's Discretion — recommended table)

```typescript
// Source: MEDIUM confidence — cross-referenced PDF standard fonts + common resume fonts
const FONT_SUBSTITUTION_MAP: Record<string, string> = {
  // PDF standard fonts → Word-safe equivalents
  'Helvetica': 'Arial',
  'Helvetica-Bold': 'Arial',
  'Helvetica-Oblique': 'Arial',
  'Times-Roman': 'Times New Roman',
  'Times-Bold': 'Times New Roman',
  'TimesNewRomanPS-BoldMT': 'Times New Roman',
  'TimesNewRomanPSMT': 'Times New Roman',
  'CourierNewPSMT': 'Courier New',
  // Common resume fonts that may be unavailable
  'Garamond': 'Times New Roman',
  'Georgia': 'Times New Roman',
  'Gotham': 'Calibri',
  'Gotham-Book': 'Calibri',
  'Lato': 'Calibri',
  'Roboto': 'Calibri',
  'OpenSans': 'Calibri',
  'Gill Sans': 'Calibri',
  'Futura': 'Calibri',
  // ArialMT variants
  'ArialMT': 'Arial',
  'Arial-BoldMT': 'Arial',
  'Arial-ItalicMT': 'Arial',
};
```

If a font name is NOT in the map after normalization, pass it through as-is (Word will substitute if unavailable).

### Pattern 4: TextRun construction from TextStyle

```typescript
// Source: docx npm API docs (docx.js.org) — HIGH confidence
import { TextRun } from 'docx';
import type { TextStyle } from '@resume/types';

function textRunFromStyle(text: string, style: TextStyle): TextRun {
  return new TextRun({
    text,
    font: normalizeFontName(style.fontName),
    size: style.fontSize,                    // half-points: direct mapping, no conversion
    bold: style.bold,
    italics: style.italic,
    color: style.color.replace('#', ''),     // docx expects hex WITHOUT leading #
  });
}
```

### Pattern 5: Paragraph spacing from TextStyle

```typescript
// Source: docx npm API docs — HIGH confidence, lineRule MEDIUM
import { Paragraph, LineRuleType } from 'docx';

function spacingFromStyle(style: TextStyle) {
  return {
    before: style.spaceBefore != null ? Math.round(style.spaceBefore * 20) : undefined,
    after:  style.spaceAfter  != null ? Math.round(style.spaceAfter  * 20) : undefined,
    line:   style.lineSpacingPt != null ? Math.round(style.lineSpacingPt * 20) : undefined,
    lineRule: style.lineSpacingPt != null ? LineRuleType.EXACT : undefined,
  };
}
```

### Pattern 6: Document with section page setup

```typescript
// Source: docx npm API docs — HIGH confidence
import { Document } from 'docx';

new Document({
  sections: [{
    properties: {
      page: {
        size: {
          width:  Math.round(meta.pageWidth  * 20),  // TWIPs
          height: Math.round(meta.pageHeight * 20),
        },
        margin: {
          top:    Math.round(meta.marginTop    * 20),
          bottom: Math.round(meta.marginBottom * 20),
          left:   Math.round(meta.marginLeft   * 20),
          right:  Math.round(meta.marginRight  * 20),
        },
      },
    },
    children: [ /* all paragraphs */ ],
  }],
});
```

### Pattern 7: Bullet paragraphs via pre-declared Numbering

```typescript
// Source: docx npm docs (numbering) — HIGH confidence
import { Document, AbstractNumbering, Numbering, LevelFormat } from 'docx';

// Declare once in Document.numbering, reference by abstractNumId in each Paragraph
const bulletNumbering = {
  reference: 'bullet-list',
  levels: [{
    level: 0,
    format: LevelFormat.BULLET,
    text: '\u2022',
    alignment: AlignmentType.LEFT,
    style: {
      paragraph: { indent: { left: 720, hanging: 360 } },
    },
  }],
};

// Paragraph usage:
new Paragraph({
  numbering: { reference: 'bullet-list', level: 0 },
  children: [textRunFromStyle(bulletText, bullet.style)],
  spacing: spacingFromStyle(bullet.style),
})
```

### Pattern 8: Express route — binary response

```typescript
// Source: Express docs + docx Packer API — HIGH confidence
import { Packer } from 'docx';

generateRouter.post('/generate', async (req, res) => {
  const { resumeStructure, bullets } = req.body; // Zod-validated
  const buffer = await generateDocx(resumeStructure, bullets);
  res
    .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    .setHeader('Content-Disposition', 'attachment; filename="resume_tailored.docx"')
    .send(buffer);
});
```

Note: `Packer.toBuffer()` returns `Promise<Buffer>` in Node.js — safe to pass directly to `res.send()`.

### Pattern 9: Next.js Step 3 download — fetch binary

```typescript
// Source: Standard browser Blob/URL API — HIGH confidence
async function downloadDocx(resumeStructure: ResumeStructure, bullets: RewrittenBullet[]) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeStructure, bullets }),
  });
  if (!response.ok) {
    const json = await response.json();
    throw new Error(json.message ?? 'Generation failed');
  }
  const blob = new Blob([await response.arrayBuffer()], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'resume_tailored.docx';
  a.click();
  URL.revokeObjectURL(url);  // clean up
}
```

### Anti-Patterns to Avoid

- **Importing `docx` statically from a non-ESM module:** `docx` v9 is a standard CJS-compatible package — static import is fine (unlike `pdfjs-dist`). No dynamic import needed.
- **Forgetting to strip `#` from hex color:** `TextRun.color` expects `"1a1a1a"` not `"#1a1a1a"`. Forgetting this causes Word to ignore the color or throw internally.
- **Using `lineRule: AUTO` with absolute `lineSpacingPt` values:** AUTO interprets the value as a proportion of line height, not points. Use `LineRuleType.EXACT` with TWIPs when you have a point value.
- **Sending Uint8Array instead of Buffer:** On older versions of docx/jszip, `Packer.toBuffer()` may return `Uint8Array`. Wrap with `Buffer.from(uint8array)` if needed — `res.send()` handles Node Buffer correctly.
- **Omitting numbering declaration in Document:** Bullet paragraphs that reference a `numbering.reference` will silently render as plain paragraphs if the numbering definition isn't declared in `Document.numbering`. Declare once, reference everywhere.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OOXML ZIP construction | Custom ZIP + XML writer | `docx` npm | OOXML is a zip of ~15 interrelated XML files with complex relationships; getting content types, relationship files, and numbering XML right by hand is weeks of work |
| DOCX numbering/bullets | Raw `<w:numId>` XML | `docx` AbstractNumbering API | Numbering in OOXML requires coordinated IDs across `numbering.xml`, `document.xml`, and `styles.xml` — the library manages this |
| Font availability detection | System font scanner | Pass font name through; let Word substitute | DOCX format specifies font names; Word/Google Docs handle unavailable fonts per their own substitution — no server-side detection possible |
| Binary streaming | Custom chunked response | `res.send(buffer)` | Express handles Content-Length and transfer encoding automatically |

**Key insight:** The OOXML format is deceptively complex — what looks like "write some XML" is actually a coordinated set of 15+ XML files that must be consistent with each other. The `docx` library is specifically built to hide this complexity.

---

## Common Pitfalls

### Pitfall 1: Font subset prefix not stripped
**What goes wrong:** DOCX renders with a garbage font name like "ABCDEF+Calibri" — Word falls back to Times New Roman or shows missing font warnings.
**Why it happens:** PDF parsers (pdfjs-dist) return the raw embedded font name including the 6-char subset prefix.
**How to avoid:** Always run `fontName` through `normalizeFontName()` before constructing `TextRun`.
**Warning signs:** Word shows yellow "Font not found" banner when opening the DOCX.

### Pitfall 2: Wrong unit for spacing
**What goes wrong:** Paragraph spacing is 20x too large (or 20x too small), making the document look nothing like the original.
**Why it happens:** `spaceBefore`/`spaceAfter` in `TextStyle` are in points; `Paragraph.spacing.before/after` takes TWIPs (pt × 20). Easy to forget the conversion.
**How to avoid:** Centralize all unit conversions in one helper function; add a test that checks the numeric values passed to the docx constructor.
**Warning signs:** 12pt spacing appears as 240pt (gaps between paragraphs are huge).

### Pitfall 3: Color hex includes `#`
**What goes wrong:** Text color is ignored or rendered as black in the DOCX.
**Why it happens:** `docx` TextRun expects `color: "1a1a1a"` but `TextStyle.color` stores `"#1a1a1a"`.
**How to avoid:** `style.color.replace('#', '')` in the TextRun factory function.
**Warning signs:** All text appears black regardless of the source PDF color.

### Pitfall 4: JSON body too large
**What goes wrong:** Express rejects the POST /api/generate request with 413.
**Why it happens:** `express.json({ limit: '1mb' })` is already set in `index.ts` — a typical ResumeStructure with many sections and styles could approach this limit.
**How to avoid:** The 1mb limit is already set and should be sufficient for typical resumes; document this as an assumption. If needed, raise to 2mb in `index.ts`.
**Warning signs:** 413 errors in the browser console on generation.

### Pitfall 5: Bullet text selection logic inverted
**What goes wrong:** DOCX always uses original text, or always uses rewritten text regardless of `approved` flag.
**Why it happens:** The `approved` field defaults to `false` in `RewrittenBulletSchema` — easy to misread the condition.
**How to avoid:** `approved ? bullet.rewritten : bullet.original`. Write an explicit unit test for both branches.
**Warning signs:** User-approved edits don't appear in the downloaded DOCX.

### Pitfall 6: Missing route registration in index.ts
**What goes wrong:** POST /api/generate returns 404.
**Why it happens:** Forgetting to add `app.use('/api', generateRouter)` after `analyzeRouter`.
**How to avoid:** Registration is in `apps/api/src/index.ts` — add it as part of the route creation task.
**Warning signs:** All requests to /api/generate return 404.

---

## Code Examples

### Minimal end-to-end docx service skeleton

```typescript
// Source: docx npm API (docx.js.org) — HIGH confidence
import { Document, Packer, Paragraph, TextRun, LineRuleType, LevelFormat, AlignmentType } from 'docx';
import type { ResumeStructure, TextStyle } from '@resume/types';
import type { RewrittenBullet } from '@resume/types';

const BULLET_REF = 'resume-bullet';

function normalizeFontName(raw: string): string {
  const stripped = raw.replace(/^[A-Z]{6}\+/, '');
  return FONT_SUBSTITUTION_MAP[stripped] ?? stripped;
}

function textRunFromStyle(text: string, style: TextStyle): TextRun {
  return new TextRun({
    text,
    font: normalizeFontName(style.fontName),
    size: style.fontSize,                        // half-points: 1:1 with OOXML
    bold: style.bold,
    italics: style.italic,
    color: style.color.replace('#', ''),         // strip leading #
  });
}

function spacingFromStyle(style: TextStyle) {
  return {
    before:   style.spaceBefore   != null ? Math.round(style.spaceBefore   * 20) : undefined,
    after:    style.spaceAfter    != null ? Math.round(style.spaceAfter    * 20) : undefined,
    line:     style.lineSpacingPt != null ? Math.round(style.lineSpacingPt * 20) : undefined,
    lineRule: style.lineSpacingPt != null ? LineRuleType.EXACT : undefined,
  };
}

export async function generateDocx(
  structure: ResumeStructure,
  bullets: RewrittenBullet[],
): Promise<Buffer> {
  const bulletMap = new Map(bullets.map(b => [b.id, b]));

  const children: Paragraph[] = [];

  // Header lines
  for (const line of structure.header) {
    children.push(new Paragraph({
      children: [textRunFromStyle(line.text, line.style)],
      spacing: spacingFromStyle(line.style),
    }));
  }

  // Sections
  for (const section of structure.sections) {
    children.push(new Paragraph({
      children: [textRunFromStyle(section.heading, section.headingStyle)],
      spacing: spacingFromStyle(section.headingStyle),
    }));

    for (const item of section.items) {
      if (item.title && item.titleStyle) {
        children.push(new Paragraph({
          children: [textRunFromStyle(item.title, item.titleStyle)],
          spacing: spacingFromStyle(item.titleStyle),
        }));
      }
      if (item.subtitle && item.subtitleStyle) {
        children.push(new Paragraph({
          children: [textRunFromStyle(item.subtitle, item.subtitleStyle)],
          spacing: spacingFromStyle(item.subtitleStyle),
        }));
      }
      for (const bullet of item.bullets) {
        const rewritten = bulletMap.get(bullet.id);
        const text = rewritten?.approved ? rewritten.rewritten : bullet.text;
        children.push(new Paragraph({
          numbering: { reference: BULLET_REF, level: 0 },
          children: [textRunFromStyle(text, bullet.style)],
          spacing: spacingFromStyle(bullet.style),
        }));
      }
    }
  }

  const { meta } = structure;
  const doc = new Document({
    numbering: {
      config: [{
        reference: BULLET_REF,
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '\u2022',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: {
            width:  Math.round(meta.pageWidth  * 20),
            height: Math.round(meta.pageHeight * 20),
          },
          margin: {
            top:    Math.round(meta.marginTop    * 20),
            bottom: Math.round(meta.marginBottom * 20),
            left:   Math.round(meta.marginLeft   * 20),
            right:  Math.round(meta.marginRight  * 20),
          },
        },
      },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}
```

### Express route

```typescript
// Source: Express 5 patterns in this project + docx Packer API
import { Router } from 'express';
import { z } from 'zod';
import { ResumeStructureSchema, RewrittenBulletSchema } from '@resume/types';
import { generateDocx } from '../services/docx.service.js';

export const generateRouter = Router();

const GenerateRequestSchema = z.object({
  resumeStructure: ResumeStructureSchema,
  bullets: z.array(RewrittenBulletSchema),
});

generateRouter.post('/generate', async (req, res) => {
  const parsed = GenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request', message: 'Invalid request body.' });
    return;
  }
  const buffer = await generateDocx(parsed.data.resumeStructure, parsed.data.bullets);
  res
    .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    .setHeader('Content-Disposition', 'attachment; filename="resume_tailored.docx"')
    .send(buffer);
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `officegen` (unmaintained) | `docx` npm v9 | ~2020 | officegen has no TS types, no maintenance |
| `docx` v7 fluent builder | `docx` v8/v9 declarative config objects | 2022 | v9 uses plain object configs — less chaining, more TypeScript-friendly |
| `Packer.toBase64String()` → decode | `Packer.toBuffer()` directly | v7+ | Direct Buffer is simpler in Node.js |

**Deprecated/outdated:**
- `docx` `pipeline` API (Turbo context, not docx): Use `tasks` key in turbo.json — already done in this project.
- `docx` fluent method chains (`.font('Calibri').size(24).bold()`): Replaced by config object constructor in v8+.

---

## Open Questions

1. **Exact `lineSpacingPt` to TWIPs conversion**
   - What we know: PDF parsing captures line spacing in points. `LineRuleType.EXACT` with TWIPs should reproduce it.
   - What's unclear: Whether PDF `lineSpacingPt` represents leading (line + gap) or just the gap. A test render is the only way to verify.
   - Recommendation: Implement with `EXACT` + `pt * 20`, then validate against a real PDF in `/gsd:verify-work`.

2. **Google Docs bullet rendering**
   - What we know: Google Docs imports DOCX and renders bullets. Custom `AbstractNumbering` with `\u2022` is standard.
   - What's unclear: Whether Google Docs respects `EXACT` line spacing or overrides it with its own defaults.
   - Recommendation: Accept this as a known risk; user requirement says "opens correctly" not "pixel-identical in Google Docs".

3. **`Packer.toBuffer()` return type in this project's tsx/CJS environment**
   - What we know: In Node.js it returns `Buffer`; there is a known historical issue where it returned `Uint8Array` on some jszip versions.
   - What's unclear: Whether docx v9.6.x always returns a proper Node.js `Buffer`.
   - Recommendation: Wrap with `Buffer.isBuffer(buf) ? buf : Buffer.from(buf)` defensively.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `apps/api/vitest.config.ts` (globals: true) |
| Quick run command | `cd apps/api && npx vitest run src/__tests__/docx.service.test.ts` |
| Full suite command | `cd apps/api && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OUT-01 | `generateDocx()` returns a non-empty Buffer | unit | `npx vitest run src/__tests__/docx.service.test.ts` | ❌ Wave 0 |
| OUT-01 | Approved bullet uses `rewritten` text | unit | `npx vitest run src/__tests__/docx.service.test.ts` | ❌ Wave 0 |
| OUT-01 | Unapproved bullet uses `original` text | unit | `npx vitest run src/__tests__/docx.service.test.ts` | ❌ Wave 0 |
| OUT-01 | Font name strips subset prefix `ABCDEF+` | unit | `npx vitest run src/__tests__/docx.service.test.ts` | ❌ Wave 0 |
| OUT-01 | Garamond maps to Times New Roman | unit | `npx vitest run src/__tests__/docx.service.test.ts` | ❌ Wave 0 |
| OUT-01 | POST /api/generate returns 200 with correct Content-Type | integration | `npx vitest run src/__tests__/generate.route.test.ts` | ❌ Wave 0 |
| OUT-01 | POST /api/generate with invalid body returns 400 | integration | `npx vitest run src/__tests__/generate.route.test.ts` | ❌ Wave 0 |
| OUT-01 | Downloaded DOCX opens in Word (visual check) | manual | — | manual-only |

**Manual-only justification:** Verifying that the DOCX opens correctly in Word and Google Docs without formatting errors requires a human to open the file in those applications. No automated cross-application DOCX rendering test is practical in this environment.

### Sampling Rate

- **Per task commit:** `cd apps/api && npx vitest run src/__tests__/docx.service.test.ts src/__tests__/generate.route.test.ts`
- **Per wave merge:** `cd apps/api && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/__tests__/docx.service.test.ts` — covers OUT-01 unit behaviors (Buffer returned, bullet text selection, font normalization)
- [ ] `apps/api/src/__tests__/generate.route.test.ts` — covers OUT-01 integration (Content-Type, 400 on bad body)
- [ ] Install: `npm install docx --workspace=apps/api`

---

## Sources

### Primary (HIGH confidence)
- `docx` npm package page (npmjs.com/package/docx) — version 9.6.1, weekly downloads, TypeScript support
- `docx.js.org` API reference — `Packer`, `Document`, `Paragraph`, `TextRun`, section properties
- `github.com/dolanmiu/docx` — Numbering demo, styling docs
- OOXML/ECMA-376 standard (via `docx.js.org` Spacing API) — TWIPs unit definition, half-points for font size, 240ths for AUTO line spacing

### Secondary (MEDIUM confidence)
- WebSearch findings on `Packer.toBuffer()` return type — corroborated by GitHub issue #379 noting Uint8Array edge case
- `LineRuleType.EXACT` with TWIPs for absolute line spacing — verified against OOXML spec description in docx spacing docs
- Font substitution table — cross-referenced standard PDF font names (Acrobat docs) with common resume fonts

### Tertiary (LOW confidence)
- Google Docs DOCX import behavior for EXACT line spacing — not verified against official Google documentation; based on community reports

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `docx` v9 is the unambiguous standard; 2.7M weekly downloads, TypeScript-native, active maintenance
- Architecture patterns: HIGH — patterns derived from official docx API; unit conversions verified against OOXML spec
- Font substitution table: MEDIUM — entries based on PDF standard fonts and common resume font knowledge; exact mappings are Claude's discretion per CONTEXT.md
- Pitfalls: HIGH — color hex strip, unit conversion errors, and font prefix strip are all verified against actual docx API behavior
- Line spacing EXACT/TWIPs: MEDIUM — correct per OOXML spec but needs visual validation against real PDF output

**Research date:** 2026-03-10
**Valid until:** 2026-06-10 (stable library — `docx` API is mature, unlikely to change significantly in 90 days)
