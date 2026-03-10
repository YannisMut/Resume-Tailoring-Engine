---
phase: 2
slug: pdf-parsing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `apps/api/vitest.config.ts` (exists) |
| **Quick run command** | `npm run test --workspace=apps/api` |
| **Full suite command** | `npm run test --workspace=apps/api` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=apps/api`
- **After every plan wave:** Run `npm run test --workspace=apps/api`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 02-01 | 1 | — | unit | `npm run test --workspace=apps/api` | ❌ Wave 0 | ⬜ pending |
| 02-02-01 | 02-02 | 1 | INPUT-04, INPUT-05 | unit | `npm run test --workspace=apps/api` | ❌ Wave 0 | ⬜ pending |
| 02-03-01 | 02-03 | 2 | INPUT-02, INPUT-03 | unit | `npm run test --workspace=apps/api` | ❌ Wave 0 | ⬜ pending |
| 02-04-01 | 02-04 | 2 | INPUT-01, INPUT-04 | unit | `npm run test --workspace=apps/api` | ❌ Wave 0 | ⬜ pending |
| 02-05-01 | 02-05 | 3 | INPUT-01, INPUT-02, INPUT-03, INPUT-04, INPUT-05 | integration | `npm run test --workspace=apps/api` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/__tests__/pdf.service.test.ts` — unit test stubs for INPUT-04, INPUT-05 (PasswordException, 0 text items, clustering, font normalization)
- [ ] `apps/api/src/__tests__/analyze.route.test.ts` — integration test stubs for INPUT-01 through INPUT-05
- [ ] `apps/api/src/__tests__/fixtures/` — directory containing: `valid-resume.pdf`, `scanned-resume.pdf`, `encrypted-resume.pdf`, `corrupt.pdf`, `not-a-pdf.png`
- [ ] Framework config: Already exists at `apps/api/vitest.config.ts` ✓

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Valid resume PDF → correct ResumeStructure field layout | INPUT-01 | Requires human review of clustering output quality | Parse a real-world resume PDF; inspect section headings, bullet groupings, header block |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
