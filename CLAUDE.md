# Project Instructions

## Bug Fix Learnings

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
