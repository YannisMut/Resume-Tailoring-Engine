# Domain Pitfalls

**Domain:** AI Resume Tailoring Engine (PDF → GPT-4o rewrite → DOCX)
**Researched:** 2026-03-08
**Confidence:** HIGH (PDF/DOCX parsing and generation are well-documented failure modes; OpenAI prompt design pitfalls are from production experience patterns; ATS scoring is MEDIUM from community sources)

---

## Critical Pitfalls

Mistakes that cause rewrites or major loss of correctness.

---

### Pitfall 1: PDF Text Extraction Destroys Layout Without Coordinates

**What goes wrong:** Most PDF parsers (pdf-parse, pdfjs-dist in text mode) return a flat string of characters in reading order — but "reading order" is reconstructed by the library, not stored in the PDF. Multi-column layouts, side-by-side sections (e.g., a contact bar next to a name), and inline icons cause text to be interleaved or merged. Whitespace that represented visual separation is collapsed. When you later try to rebuild the DOCX, you have no structural signal about what was a section header, a bullet, a date range, or a company name.

**Why it happens:** PDFs store glyphs with absolute X/Y coordinates and font references — they have no semantic structure. The library must infer reading order from spatial position. This inference fails for anything non-linear.

**Consequences:** ResumeStructure is populated with merged or out-of-order text. Bullets get classified as headers. Dates get attached to wrong jobs. The DOCX output is structurally wrong even if the text content is correct.

**Prevention:**
- Use a coordinate-aware parser that exposes bounding box data per text span: `pdfjs-dist` (render mode with `getTextContent()` returning items with `transform` arrays), `pdf2json`, or `pdfplumber` (Python side). The critical requirement is that each text chunk carries its X, Y, width, and font size.
- Build a spatial clustering step in `pdf.service.ts` that groups text spans by Y-proximity into lines, then by X-indentation level into logical roles (header vs. bullet vs. aside).
- Define ResumeStructure with explicit typed sections (not a flat array of strings) from day one. Retrofitting structure later requires rewriting the parser and all downstream consumers.
- Add a "parse confidence score" field to ResumeStructure. If confidence is below threshold, surface a warning to the user rather than silently producing a bad output.

**Detection (warning signs):**
- Test with 5 real-world resumes with different layouts before building any downstream service.
- If a bullet's text contains a date range, the parse is wrong.
- If section headers appear inside bullet arrays, the parse is wrong.

**Phase:** PDF parsing phase (service scaffolding). Must be solved before building `ai.service.ts` or `docx.service.ts`.

---

### Pitfall 2: GPT-4o Invents Metrics and Rewrites Facts (Hallucination Drift)

**What goes wrong:** GPT-4o is a completion model — it wants to produce impressive-sounding text. When asked to rewrite a bullet like "Worked on backend API" to be more impactful, it will add invented metrics ("increased API throughput by 40%"), invent technologies ("using Kafka for event streaming"), or change the scope of the claim entirely. The user has no easy way to detect this unless they carefully diff every bullet.

**Why it happens:** The prompt asks for "improvement" without hard constraints on factual preservation. The model's training optimizes for impressive resume language, and it has learned that numbers and specifics make bullets better — so it supplies them when none exist.

**Consequences:** User submits a resume with fabricated accomplishments. This is both ethically problematic and a user trust failure. If caught in an interview, it reflects badly on the tool. Some users may not even notice.

**Prevention:**
- The prompt must explicitly instruct: "Do not invent metrics, percentages, timeframes, technologies, or scope claims that are not present in the original bullet. Preserve all factual content exactly. Only improve action verb strength, keyword alignment, and sentence structure."
- Include the original bullet in the prompt and require the model to treat it as the ground truth.
- In the review UI (Step 2), show a character-level or token-level diff between original and rewritten bullet. Visual diff makes drift immediately obvious.
- Consider a secondary validation pass: after rewriting, run a second prompt asking "Does this rewritten bullet introduce any claims not present in the original? Answer YES or NO." Reject and retry if YES.
- Cap the length ratio: if the rewrite is more than 2x the length of the original, flag it for review.

**Detection (warning signs):**
- During testing, count how many rewrites contain percentage signs or specific numbers that weren't in the original.
- Test with intentionally vague bullets ("Helped with project"). If the output contains metrics, the prompt is not constrained enough.

**Phase:** `ai.service.ts` prompt design. Must be validated with 20+ real bullets before the review UI is built.

---

### Pitfall 3: DOCX Generation Loses Font, Spacing, and Margin Fidelity

**What goes wrong:** Libraries like `docx` (npm) or `python-docx` allow programmatic DOCX creation, but they work from a blank document. Every font, paragraph spacing value, margin, line spacing rule, and style must be set explicitly in code. If ResumeStructure captures only the text and section hierarchy but not font names, font sizes, bold/italic states, paragraph spacing before/after, and margin values, the generated DOCX looks nothing like the original PDF. Recruiters notice immediately.

**Why it happens:** Developers assume "it'll look close enough" and defer styling to a later phase. ResumeStructure is designed without layout fields. By the time DOCX generation runs, there's no data to reconstruct the visual style.

**Consequences:** The core value proposition fails. Users wanted a "layout-identical DOCX" — if fonts are wrong, spacing is off, or sections look different, the tool hasn't delivered its promise.

**Prevention:**
- ResumeStructure must capture layout fields from the PDF parse step: font family name, font size (pt), bold flag, italic flag, paragraph spacing before (pt), paragraph spacing after (pt), line spacing multiplier, left margin (pt), indentation level. These are first-class fields, not optional metadata.
- Map PDF font names to safe DOCX-compatible equivalents. PDF fonts are often embedded subsets with mangled names (e.g., "ABCDEF+Calibri"). Build a font name normalization step.
- `docx` (npm) paragraph styles must be set per-paragraph, not per-document. Each bullet in ResumeStructure must carry its own style properties.
- Test DOCX output against original PDF visually using a checklist: fonts match, bullet indentation matches, section header size/weight matches, margins match, page count matches.
- Do not use Word's built-in "Normal" style as a base — it varies by Word version and locale. Set all values explicitly.

**Detection (warning signs):**
- Open the generated DOCX in Word and compare to the PDF side by side. Any difference is a bug.
- Font fallback to Times New Roman or Calibri means font extraction from the PDF failed.
- If the generated DOCX is a different page count than the original PDF, layout fidelity has failed.

**Phase:** ResumeStructure type design (very early). DOCX generation phase must include visual regression testing.

---

### Pitfall 4: ATS Keyword Scoring Produces Unreliable or Gaming-Prone Scores

**What goes wrong:** ATS keyword gap analysis is typically implemented as simple keyword matching: tokenize the job description, tokenize the resume, compute overlap. This produces scores that are trivially gamed (add the word once = full credit) and miss semantic matches (the resume says "led" but JD says "managed" — these are equivalent but scored as a gap). Worse, the "score" is presented as authoritative (0–100) when it's actually a rough heuristic that no actual ATS uses.

**Why it happens:** Simple bag-of-words matching is easy to implement and produces a number. The number feels precise even when it isn't.

**Consequences:** Users optimize for the score rather than actual quality. Adding keywords mechanically produces spam-like bullets. Users trust the score as an absolute signal when it's relative and approximate. If the score is 94% but the user fails to get interviews, they lose trust in the whole tool.

**Prevention:**
- Use phrase-level matching, not just single-keyword matching. "project management" should match as a unit, not as two separate words.
- Use semantic similarity (embeddings) to catch synonym matches. OpenAI's `text-embedding-3-small` is cheap and fast.
- Display the score with a clear label: "Keyword alignment estimate" not "ATS score." Explain what it measures and what it doesn't.
- Show matched keywords and unmatched keywords separately — the list is more useful than the number.
- Do not claim the score predicts ATS pass/fail. No public API into real ATS systems exists.

**Detection (warning signs):**
- If adding a single keyword to the resume moves the score by more than 5 points, granularity is too coarse.
- If two semantically identical phrases score differently (e.g., "managed" vs. "led"), semantic matching is missing.

**Phase:** `analysis.service.ts` design. Score presentation in the UI is a separate concern from score computation.

---

### Pitfall 5: File Upload Accepts Malicious or Oversized PDFs

**What goes wrong:** An Express endpoint accepting file uploads with no validation becomes an attack surface. A 500MB PDF causes memory exhaustion. A crafted PDF with a deeply nested object structure causes parser CPU exhaustion (a "PDF bomb"). A file that is not a PDF but has a `.pdf` extension is accepted, and the parser throws an unhandled error that leaks stack traces.

**Why it happens:** File validation is treated as optional polish rather than a gate.

**Consequences:** Server crash from memory/CPU exhaustion. Unhandled exceptions leak internal paths and library versions. In a public tool, this is a significant availability and security risk.

**Prevention:**
- Enforce a file size limit at the multer (or equivalent) layer before the file reaches the parser: 10MB maximum is reasonable for a resume PDF.
- Validate MIME type using magic bytes (file header), not the Content-Type header or file extension. A PDF starts with `%PDF-`. Reject anything that doesn't.
- Set a parse timeout: if `pdf.service.ts` takes more than 10 seconds to parse a file, abort and return a 400 error.
- Never expose the raw parser exception message to the client. Catch, log internally, return a generic "Could not parse this PDF" message.
- Run file parsing in a way that doesn't block the Node.js event loop. If using a CPU-intensive parser, consider `worker_threads` or a child process.

**Detection (warning signs):**
- Test with a 200MB PDF — does the server respond gracefully or crash?
- Test with a renamed `.txt` file with `.pdf` extension — does the server give a clean error?
- Test with a 1-page valid PDF — does it parse in under 2 seconds?

**Phase:** `POST /api/analyze` route setup. Must be in place before any public exposure of the endpoint.

---

## Moderate Pitfalls

---

### Pitfall 6: OpenAI API Timeout Leaves User With No Recovery Path

**What goes wrong:** GPT-4o calls for a full resume (15–30 bullets) can take 15–30 seconds. If the call times out or the OpenAI API returns a 500/503, and the frontend has already discarded the uploaded PDF data, the user must start over — re-upload, re-paste the job description, wait again. This feels broken even if the error is transient.

**Prevention:**
- Preserve the entire analysis result (ResumeStructure + parsed bullets + match score + keyword gaps) in frontend state after Step 1 completes, independently of whether the AI rewrite succeeds.
- The project spec already states: "analysis is preserved so the user doesn't re-upload" — this must be implemented as explicit frontend state, not just hoped for.
- Implement retry logic in `ai.service.ts`: exponential backoff, 3 attempts, before surfacing the error to the route handler.
- Return partial results if possible: if 20 of 25 bullets were rewritten before a timeout, return the 20 completed and flag the 5 as needing retry.

**Detection:** Test by killing the OpenAI connection mid-request. Does the user lose their uploaded data?

**Phase:** `ai.service.ts` error handling. Frontend state management in Step 2.

---

### Pitfall 7: Prompt Token Overflow for Long Resumes

**What goes wrong:** Sending all 25 bullets plus their context plus the full job description in a single GPT-4o prompt can exceed the practical token budget for reliable output. GPT-4o has a 128k context window, but long prompts produce lower-quality outputs as the model's attention spreads thin. More practically, the cost per request becomes unpredictable and expensive.

**Prevention:**
- Batch bullet rewrites: process 5–8 bullets per API call, not all at once.
- Send only the relevant sections of the job description (required skills, responsibilities) — strip company boilerplate and benefits sections.
- Implement a token estimator before the call: if the prompt exceeds 8,000 tokens, split automatically.
- Log token usage per request during development to understand cost/request before public release.

**Detection:** Count tokens before sending. Test with a 3-page resume (35+ bullets) and a 1,500-word JD.

**Phase:** `ai.service.ts` prompt construction.

---

### Pitfall 8: ResumeStructure Type Designed Too Narrowly, Requires Breaking Changes

**What goes wrong:** ResumeStructure is the central data contract flowing through all four services. If it is designed as a flat list of strings in Phase 1, then `ai.service.ts` extends it with AI fields, then `docx.service.ts` needs layout fields that were never captured, each change requires updating every service that touches the type. Since it is stateless (no DB migration needed), the risk is in development velocity: breaking type changes mid-build halt work on other services.

**Prevention:**
- Define the full ResumeStructure interface before building any service, based on what all four services will need. Include optional fields (`?`) for data that may not always be present, but reserve the field names.
- Use TypeScript strict mode. Never use `any` in ResumeStructure or any service that consumes it.
- Treat ResumeStructure as the single most important design decision. Write it out completely in the architecture doc before writing any service code.

**Detection:** If adding a new field to ResumeStructure requires touching more than 2 files, the type is too tightly coupled to concrete implementations rather than being an interface.

**Phase:** Initial architecture / type definition. Must precede all service implementation.

---

### Pitfall 9: DOCX Line Wrapping Differs From PDF Due to Font Metric Differences

**What goes wrong:** Even if fonts, sizes, and margins match exactly, the text still may wrap differently in Word vs. the PDF because Word uses its own font metrics (hinting, kerning tables) while the PDF used the embedded font's metrics at generation time. A bullet that fit on one line in the PDF becomes two lines in the DOCX, pushing content onto a second page.

**Prevention:**
- Accept that pixel-perfect line-break fidelity is not achievable without embedding the exact same font at the exact same rendering engine. The goal is visual similarity, not identity.
- Set user expectations in the UI: "Layout-matched DOCX — minor line wrapping differences may occur."
- Prioritize font name match and font size match. Line spacing (set to "exactly N pt" rather than "multiple") reduces variance.
- Test with bullets at the edge of the text column width — these are the most likely to wrap differently.

**Detection:** Compare page count between PDF and DOCX. One-page resume that becomes two pages is a failure.

**Phase:** DOCX generation testing.

---

### Pitfall 10: Bullet Rewrite Changes First-Person vs. Third-Person Voice Inconsistently

**What goes wrong:** Resumes are written in an implicit first-person voice (no subject pronoun: "Led a team of 5" not "I led a team of 5"). GPT-4o sometimes switches bullets to third-person ("Candidate led a team of 5") or adds pronouns ("I led a team of 5"). Inconsistent voice across bullets reads as AI-generated and looks unprofessional.

**Prevention:**
- The system prompt must explicitly state: "All bullets must use action verbs with no subject pronoun. Do not use 'I', 'me', 'my', 'the candidate', 'applicant', or any third-person reference. Begin every bullet with a past-tense action verb."
- Post-process rewrites with a simple regex check for pronouns as a validation step before returning to the frontend. Flag and re-request any bullet that fails.

**Detection:** Scan all rewritten bullets for "I ", "I've", "my ", "the candidate", "applicant".

**Phase:** `ai.service.ts` prompt design and output validation.

---

## Minor Pitfalls

---

### Pitfall 11: PDF Password Protection Causes Silent Failures

**What goes wrong:** Some users upload password-protected PDFs. Most PDF parsers return an empty string or a cryptic error rather than a user-facing message.

**Prevention:** Detect encryption flag in the PDF header before parsing. Return a clear error: "This PDF is password-protected. Please remove the password before uploading."

**Phase:** `pdf.service.ts` input validation.

---

### Pitfall 12: Scanned PDF Resumes Have No Selectable Text

**What goes wrong:** A PDF created by scanning a paper resume contains only images. Text extraction returns empty string. The user gets no feedback about why.

**Prevention:** After parsing, check if extracted text length is below a threshold (e.g., fewer than 100 characters for a full resume). Return a specific error: "This PDF appears to be a scanned image. Please upload a PDF with selectable text."

**Phase:** `pdf.service.ts` post-parse validation.

---

### Pitfall 13: Job Description Input Has No Validation or Length Cap

**What goes wrong:** A user pastes a 10,000-word company careers page instead of a job description. Token count explodes; the analysis is noisy; cost is unpredictable.

**Prevention:** Cap JD input at 5,000 characters (roughly 1,000 tokens). Instruct users to paste only the requirements and responsibilities sections. Enforce the cap server-side, not just in the UI.

**Phase:** `POST /api/analyze` input validation.

---

### Pitfall 14: DOCX Template Approach vs. Programmatic Generation Trade-off Ignored

**What goes wrong:** Some teams try to use a blank DOCX template file and inject content via XML manipulation. This breaks silently when Word updates its internal XML schema, and the template must be manually maintained.

**Prevention:** Use programmatic generation with the `docx` npm package, which manages XML serialization. Do not use raw XML manipulation or DOCX templates. Accept the constraint that truly exotic PDF layouts (multi-column, table-based) may not reproduce perfectly and document this as a known limitation.

**Phase:** `docx.service.ts` architecture decision.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| ResumeStructure type design | Too narrow → breaking changes across all services | Design the full interface before writing any service; use TypeScript strict mode |
| `pdf.service.ts` build | Coordinate-unaware parser destroys layout | Use coordinate-aware extraction (`pdfjs-dist` `getTextContent` with transforms) |
| `pdf.service.ts` build | Scanned PDF / password-protected PDF silent failure | Validate text length and encryption flag post-parse |
| File upload route | Oversized or malicious PDF causes server crash | Enforce 10MB limit, magic byte validation, parse timeout |
| `ai.service.ts` prompt design | Hallucinated metrics in bullet rewrites | Explicit no-invention instruction + diff in UI + optional validation pass |
| `ai.service.ts` prompt design | Pronoun voice inconsistency | System prompt constraint + regex post-validation |
| `ai.service.ts` error handling | Timeout loses user state | Preserve ResumeStructure in frontend state; retry with backoff |
| `ai.service.ts` prompt construction | Token overflow on long resumes | Batch 5–8 bullets per call; truncate JD boilerplate |
| `analysis.service.ts` scoring | Score presented as authoritative ATS signal | Label as "keyword alignment estimate"; show matched/unmatched keyword lists |
| `docx.service.ts` generation | Missing font/spacing fields in ResumeStructure | ResumeStructure must carry layout fields from parse step |
| `docx.service.ts` generation | Line wrapping differences cause page count change | Set expectation in UI; test with edge-width bullets |
| `POST /api/analyze` input | JD too long, token cost unpredictable | 5,000 character cap enforced server-side |

---

## Sources

- PDF parsing coordinate extraction: `pdfjs-dist` getTextContent API documentation (mozilla/pdf.js GitHub, verified against library source)
- DOCX generation fidelity: `docx` npm package documentation and known limitations (docx.js.org)
- OpenAI hallucination in constrained rewriting: OpenAI prompt engineering guide (platform.openai.com/docs/guides/prompt-engineering), patterns from production use
- ATS scoring reliability: Community knowledge — no public ATS API exists; scoring is heuristic (LOW confidence for specific scoring algorithms)
- File upload security: OWASP File Upload Cheat Sheet (owasp.org)
- PDF bomb / parser DoS: Known class of parser vulnerabilities documented across PDF processing libraries
- Confidence level: HIGH for PDF/DOCX/prompt pitfalls (well-documented failure modes); MEDIUM for ATS scoring (community patterns, no authoritative source)
