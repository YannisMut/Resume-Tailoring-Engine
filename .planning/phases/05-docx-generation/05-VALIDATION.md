---
phase: 5
slug: docx-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `apps/api/vitest.config.ts` (globals: true) |
| **Quick run command** | `cd apps/api && npx vitest run src/__tests__/docx.service.test.ts src/__tests__/generate.route.test.ts` |
| **Full suite command** | `cd apps/api && npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npx vitest run src/__tests__/docx.service.test.ts src/__tests__/generate.route.test.ts`
- **After every plan wave:** Run `cd apps/api && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 0 | OUT-01 | unit | `cd apps/api && npx vitest run src/__tests__/docx.service.test.ts` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 0 | OUT-01 | integration | `cd apps/api && npx vitest run src/__tests__/generate.route.test.ts` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 1 | OUT-01 | unit | `cd apps/api && npx vitest run src/__tests__/docx.service.test.ts` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 1 | OUT-01 | integration | `cd apps/api && npx vitest run src/__tests__/generate.route.test.ts` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 2 | OUT-01 | manual | — | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/__tests__/docx.service.test.ts` — stubs for OUT-01 unit behaviors (Buffer returned, bullet text selection, font normalization, unit conversions)
- [ ] `apps/api/src/__tests__/generate.route.test.ts` — stubs for OUT-01 integration (Content-Type header, 400 on invalid body)
- [ ] Install `docx` package: `npm install docx --workspace=apps/api`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DOCX opens in Microsoft Word without errors | OUT-01 | Requires Word application; no programmatic cross-app DOCX rendering test is practical | Download `resume_tailored.docx` and open in Word; verify no "Font not found" warnings, formatting matches the original PDF |
| DOCX opens in Google Docs without errors | OUT-01 | Requires Google Docs browser session | Upload the file to Google Docs; verify sections, fonts, and spacing render correctly |
| Layout visually matches original PDF | OUT-01 | Requires human eye; pixel-comparison tools can't assess semantic layout | Open both the original PDF and the generated DOCX side by side; verify section order, header, items, and bullets match |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
