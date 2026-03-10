---
phase: 3
slug: analysis
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `cd apps/api && npx vitest run src/__tests__/analysis.service.test.ts` |
| **Full suite command** | `cd apps/api && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npx vitest run src/__tests__/analysis.service.test.ts`
- **After every plan wave:** Run `cd apps/api && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | ANAL-01, ANAL-02 | unit | `cd apps/api && npx vitest run src/__tests__/analysis.service.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 0 | ANAL-03 | unit | `cd apps/api && npx vitest run src/__tests__/analyze.route.test.ts` | ❌ W0 (new cases) | ⬜ pending |
| 3-01-03 | 01 | 0 | ANAL-01 | unit | `cd apps/api && npx vitest run src/__tests__/analysis.service.test.ts` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | ANAL-01, ANAL-02, ANAL-03 | integration | `cd apps/api && npx vitest run src/__tests__/analyze.route.test.ts` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 2 | ANAL-01, ANAL-02, ANAL-03 | unit + integration | `cd apps/api && npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/__tests__/analysis.service.test.ts` — unit test stubs for ANAL-01 (score 0–100, edge cases) and ANAL-02 (gap list, no duplicates)
- [ ] New test cases in `apps/api/src/__tests__/analyze.route.test.ts` — ANAL-01 route response shape, ANAL-02 gaps array, ANAL-03 JD length boundary cases (missing, >5000, exactly 5000)
- [ ] `apps/api/src/middleware/error.middleware.ts` — `JdTooLongError` class added (needed before route can throw it)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Score labeled "keyword alignment" in UI | ANAL-01 | UI label is Phase 6 — no frontend in Phase 3 | Verify API JSON key is `score`; UI copy verified in Phase 6 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
