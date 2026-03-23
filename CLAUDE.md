# Project Instructions

## Bug Fix Learnings

### Gemini API — two sequential calls exceed 60s timeout on free tier
`analyzeResume` makes two sequential Gemini calls: `extractKeywords` (~15-30s) then
`rewriteAllBullets` (~15-30s). With `GEMINI_TIMEOUT_MS = 60_000`, the combined time can exceed
the timeout, causing the first or second call to fail. The Next.js rewrite proxy also drops the
connection if the total response time is too long ("socket hang up" / ECONNRESET).

The two calls must stay sequential — `rewriteAllBullets` needs the keyword gaps from
`extractKeywords` to incorporate missing terms into the rewrites.

**Fix:** Increase `GEMINI_TIMEOUT_MS` to `120_000` (2 minutes) in `ai.service.ts`. Also increase
the Next.js proxy timeout if needed (it defaults to ~2 minutes, so should be fine). This gives
each call its full budget without the combined time blowing past the limit.

**Do NOT parallelize** — keywords must be extracted first so the rewrite call knows which terms to
incorporate.

### Gemini model names — use exact names from ListModels, no date suffixes
`gemini-3-flash-preview` is the currently working model for this project (confirmed March 2026).
`gemini-2.5-flash` is available (no date suffix). `gemini-2.5-flash-preview-05-20` returns 404.

**To find valid model names for the current API key:**
```bash
export $(grep GEMINI_API_KEY apps/api/.env)
node -e "fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + process.env.GEMINI_API_KEY).then(r=>r.json()).then(d=>d.models.forEach(m=>console.log(m.name)))"
```

### Gemini API — `responseMimeType: 'application/json'` causes 30–38s response times on gemini-3-flash-preview
Constrained decoding (JSON mode) is extremely slow on `gemini-3-flash-preview` — a simple prompt
takes 30–38s vs ~1s without it. This causes 60s timeouts. However, WITHOUT `responseMimeType`,
the model returns markdown-fenced JSON or adds extra text, which fails `JSON.parse`.

**Resolution:** Switch to `gemini-2.5-flash` which does not have this slowness. Keep
`responseMimeType: 'application/json'` — it is needed for reliable JSON output and works fine
on non-preview models. Add `stripCodeFences()` as a safety net regardless:
```typescript
function stripCodeFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  return fenced ? fenced[1]! : text.trim();
}
```
Use `JSON.parse(stripCodeFences(responseText))` instead of `JSON.parse(responseText)`.

### Gemini API — `rewriteAllBullets` outer try/finally has no catch block
Without a `catch`, any Gemini error (rate limit, 404, timeout) propagates to Express as an
unhandled error → 500 response → "Something went wrong" on the frontend.

**Fix:** Add a catch that returns originals gracefully, matching how `extractKeywords` handles failures:
```typescript
} catch (err) {
  console.warn('[rewriteAllBullets] Gemini call failed, returning originals:', err);
  return allBullets.map((bullet) => ({
    id: bullet.id, original: bullet.text, rewritten: bullet.text, approved: false,
  }));
} finally {
  clearTimeout(timer);
}
```

### Gemini API — bullet rewrite response truncated by low maxOutputTokens causes silent fallback
`rewriteAllBullets()` uses `responseMimeType: 'application/json'` (pretty-printed output). With
`maxOutputTokens: 2000` and a full resume (20–30 bullets), the JSON array was cut off mid-response,
causing `JSON.parse()` to throw and silently return original bullet texts — no warning logged.

**Fix:** Increase `maxOutputTokens` to `16384` for the bullet rewrite call. Also add a `console.warn`
in the JSON parse catch block so the fallback is visible in logs immediately. Additionally, add
a `catch` block on the outer try/finally — without it, any Gemini error (rate limit, model error)
propagates as an unhandled error to Express and crashes the request instead of gracefully degrading.

**Diagnosis pattern:** If rewritten bullets in ReviewStep look identical to originals, check server
logs for `[rewriteAllBullets] Failed to parse JSON`. If nothing appears, the server may be running
stale code — restart with `npm run dev --workspace=apps/api`.

### Frontend error parsing — API error codes never displayed
The API returns `{ error: "ai_timeout", message: "..." }` (flat string at `body.error`), but the
frontend was reading `body.error.code` (nested object path). Since `"ai_timeout".code` is
`undefined`, every error fell through to `'unknown'` → "Something went wrong — please try again".

**Fix:** Change the frontend extraction to `typeof body.error === 'string' ? body.error : 'unknown'`.
Also add missing error codes (like `ai_timeout`) to the error message map in `errors.ts`.

### pdfjs-dist v5 in Node.js with tsx — CJS/ESM worker setup
This project runs via `tsx` which transpiles TypeScript to CJS. Static imports of ESM
packages like pdfjs-dist create CJS proxy objects. Setting `GlobalWorkerOptions.workerSrc`
on a CJS proxy has NO effect on pdfjs internals — the real ESM module never sees the change.

**Correct approach:** Use dynamic `import()` inside an async function to get the real ESM module:
```typescript
let pdfjsPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null;

function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((mod) => {
      const req = createRequire(import.meta.url);
      mod.GlobalWorkerOptions.workerSrc = req.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
      return mod;
    });
  }
  return pdfjsPromise;
}
```
Then use `const { getDocument } = await getPdfjs()` inside async functions.

**Also watch out for:** stale `tsx watch` processes holding the port — when testing fixes,
always verify the old server is stopped first (`lsof -i :PORT`). Kill with `kill $(lsof -ti :PORT)`.

### PDF section heading detection — same-size headings
When resumes use the same font size for headings and body (only bold/uppercase to differentiate),
the 1.2x height threshold only catches the name line (which is typically larger). The all-caps
fallback must activate: if ALL size-based heading candidates are non-all-caps (i.e. just the name),
add all-caps pattern matching (`/^[A-Z][A-Z\s&/\-]+$/`) as a secondary detector.

**Key condition:** `sizeBasedHeadings.every(l => !isAllCapsHeading(l.text))` → use combined detection.

### PDF parsing — resume owner's name treated as section heading
The name (e.g. "Yannis Mutsinzi") is typically the largest text on the page, so it passes the
`maxHeight >= headingThreshold` check and becomes the first "section heading" instead of a header line.

**Fix:** Before `foundFirstHeading` is set, only treat a line as a section heading if it is also
all-caps. Mixed-case large text (the name, tagline, etc.) goes into `headerLines` instead:
```typescript
const isSectionHeading = isAllCapsHeading(line.text) && isHeading;
if (isSectionHeading) { /* start section */ } else { headerLines.push(...) }
```

### PDF parsing — extra spaces inside words
pdfjs returns individual character groups as separate text items. Joining them all with `' '`
produces `( 202 )`, `M ay 20 28`, `3. 5/4. 0`, etc.

**Fix:** In `buildLogicalLine`, measure the pixel gap between consecutive items. Only insert a
space if the gap exceeds ~30% of the average character width of the preceding item:
```typescript
const gap = curr.x - (prev.x + prev.width);
const avgCharWidth = prev.str.length > 0 ? prev.width / prev.str.length : 5;
if (gap > avgCharWidth * 0.3) text += ' ';
```

### PDF parsing — multi-line bullets split into separate items
Wrapped bullet lines (e.g. "...website" on one line, "functionality." on the next) get classified
as title + child bullet instead of one continuous bullet. The continuation line is indented but
has no leading bullet character.

**Fix:** After clustering lines, run a `joinContinuationLines()` pass before building items.
A continuation is any indented line that does NOT start with a bullet character (`•`, `-`, etc.):
```typescript
const isContinuation = !isFlushLeft && !BULLET_CHAR_RE.test(line.text);
if (isContinuation && result.length > 0) {
  result[result.length - 1]!.text += ' ' + line.text; // join to previous
} else { result.push({ ...line }); }
```

### PDF parsing — flush-left bullet lines become titles
Some PDFs place bullet characters (`•`) at the left margin. These lines pass the `isFlushLeft`
check and become item titles instead of bullets, breaking the item structure.

**Fix:** In `buildSection`, check `startsWithBullet` before classifying flush-left lines:
```typescript
if (isFlushLeft && startsWithBullet) { /* treat as bullet, strip leading • */ }
else if (isFlushLeft && !startsWithBullet) { /* title/subtitle */ }
```

### PDF parsing — right-aligned dates/locations not detected
Dates and locations sit on the same Y-coordinate as job titles but on the right side of the page.
They get concatenated into the title text: "Technical team member... October 2024 – January 2025".

**Fix:** In `buildLogicalLine`, find the largest X-gap between consecutive items. If it exceeds
`RIGHT_ALIGN_GAP` (40 pts), split the line into `text` (left) and `rightText` (right). Store
`rightText`/`rightItems` on the `LogicalLine`, then populate `titleRight`/`subtitleRight` on
`SectionItem` (new optional fields added to the Zod schema).

### PDF parsing — encoded font names break bold/italic detection
PDFs can embed fonts with auto-generated names like `g_d0_f1`. The regex `/bold|heavy|black/i`
never matches, so all text gets `bold: false, italic: false`.

**Fix (PDF side):** Call `page.getOperatorList()` after `getTextContent()` — this populates
`page.commonObjs` with font objects. Each font object has a `.name` property containing the
real embedded font name (e.g. `BCDEEE+TimesNewRomanPS-BoldMT`) even when the style key is
encoded (`g_d0_f1`). Run the existing `detectBold`/`detectItalic` regex on this real name.

**Key insight:** `getTextContent()` alone does NOT populate `commonObjs`. The `.bold`/`.italic`
boolean properties on font objects are `undefined` in Node.js (no DOM font rendering), but
the `.name` string always contains the real font name with Bold/Italic keywords.

```typescript
const fontObj = page.commonObjs.get(fontName);
const realName = fontObj?.name ?? '';
const stripped = stripSubsetPrefix(realName);
fontInfoMap.set(fontName, { bold: detectBold(stripped), italic: detectItalic(stripped) });
```

**Also (DOCX side):** In `normalizeFontName`, encoded names map to Calibri:
```typescript
if (/^g_d\d+_f\d+$/.test(stripped)) return 'Calibri';
```
Section headings are also forced bold in the DOCX generator regardless of parsed style.

### DOCX generation — header not centered
The resume owner's name and contact info must be centered. Without explicit alignment, `docx`
defaults to left-aligned.

**Fix:** Pass `alignment: AlignmentType.CENTER` on all header `Paragraph` objects.

### DOCX generation — no horizontal rules under section headings
The original resume has a thin line under each section heading. `docx` supports paragraph borders.

**Fix:** Add a bottom border to section heading paragraphs:
```typescript
border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' } }
```

### DOCX generation — dates not right-aligned
Dates appear inline with job titles. The fix uses OOXML tab stops to push the date to the right
margin, matching the original layout.

**Fix:** In `buildTitleParagraph`, if `rightText` is present, append a `\t` run and the right
text, then set a `RIGHT` tab stop at `contentWidthTwips`:
```typescript
tabStops: [{ type: TabStopType.RIGHT, position: contentWidthTwips }]
```

### Gemini API — response truncated by low maxOutputTokens causes silent fallback
`extractKeywords()` uses `responseMimeType: 'application/json'` which produces nicely-formatted
JSON with newlines and indentation. This inflates token count. With `maxOutputTokens: 1500`, the
response was cut off mid-JSON object, causing `JSON.parse()` to throw and silently trigger
`fallbackTokenize()` — returning garbage single-word tokens with no warning.

**Fix:** Increase `maxOutputTokens` to `4096` for the keyword extraction call. Formatted JSON
for ~20 keywords typically uses 800–1200 tokens; 4096 gives ample headroom.

**Diagnosis pattern:** If `extractKeywords` returns single lowercase words (e.g. `role`, `looking`,
`intern`), it has fallen back to the tokenizer. Check for `[extractKeywords]` console warnings.
If none appear, the server may be running stale code (built dist vs. tsx watch source).

### Gemini API — stale server running built dist instead of source
When running `node dist/index.js` (the `start` script), code changes have no effect until
`tsup` rebuilds the dist. During development always use `npm run dev --workspace=apps/api`
(`tsx watch`) which hot-reloads on file save. If `tsx watch` appears stale, kill all node
processes and restart: `killall -9 node tsx && npm run dev --workspace=apps/api`.

### DOCX generation — no hyperlinks for email/LinkedIn
Contact info in the header contains emails and URLs that should be clickable blue links.

**Fix:** `buildHeaderRunsWithLinks()` uses `EMAIL_RE` and `URL_RE` regexes to find link ranges,
splits the text around them, and wraps matches in `ExternalHyperlink` with blue underlined runs.
Non-link segments become normal `TextRun` objects.
