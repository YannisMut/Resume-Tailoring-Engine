---
phase: 4
slug: ai-rewrites
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `cd apps/api && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd apps/api && npx vitest run` |
| **Estimated runtime** | ~5 seconds (all mocked, no real API calls) |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd apps/api && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | AI-01 | unit | `cd apps/api && npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | AI-02 | unit | `cd apps/api && npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 4-01-03 | 01 | 1 | AI-03 | unit | `cd apps/api && npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 4-01-04 | 01 | 1 | AI-04 | unit | `cd apps/api && npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 2 | AI-01 | integration | `cd apps/api && npx vitest run --reporter=verbose` | ✅ | ⬜ pending |
| 4-02-02 | 02 | 2 | AI-04 | integration | `cd apps/api && npx vitest run --reporter=verbose` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/__tests__/ai.service.test.ts` — stub file with test shells for AI-01, AI-02, AI-03, AI-04
- [ ] `npm install openai --workspace=apps/api` — install openai package (not yet in package.json)

*Existing infrastructure (vitest.config.ts, supertest) covers integration testing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rewritten bullets actually sound natural | AI-02 | GPT-4o output quality is subjective | Submit a real resume + JD, inspect each rewritten bullet for invented claims |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
