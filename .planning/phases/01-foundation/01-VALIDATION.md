---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `vitest.config.ts` (root — Wave 0 installs) |
| **Quick run command** | `turbo run test --filter=packages/types` |
| **Full suite command** | `turbo run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `turbo run test --filter=packages/types`
- **After every plan wave:** Run `turbo run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | infra-1 | manual | `turbo dev` (both apps start) | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | infra-2 | unit | `turbo run test --filter=packages/types` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | infra-3 | unit | `turbo run test --filter=packages/types` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | infra-4 | unit | `turbo run test --filter=apps/api` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 1 | infra-5 | automated | `turbo run typecheck` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/types/src/__tests__/resume-structure.test.ts` — Zod schema parse/reject tests for ResumeStructure, RewrittenBullet, AnalysisResult
- [ ] `apps/api/src/__tests__/error-middleware.test.ts` — error handler stub tests
- [ ] `vitest.config.ts` in root + per-package configs
- [ ] `turbo.json` tasks: `test`, `typecheck`, `build`, `dev`

*Wave 0 installs test infrastructure before any implementation tasks run.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Both apps start via `turbo dev` | infra-1 | Process startup cannot be reliably asserted in unit tests | Run `turbo dev`, verify Next.js on :3000 and Express on :3001 respond |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
