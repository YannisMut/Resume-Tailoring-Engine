---
phase: 6
slug: frontend-wizard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + React Testing Library |
| **Config file** | `apps/web/vitest.config.mts` — does NOT exist yet (Wave 0 installs) |
| **Quick run command** | `npm run test --workspace=apps/web -- --run` |
| **Full suite command** | `npm run test --workspace=apps/web -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=apps/web -- --run`
- **After every plan wave:** Run `npm run test --workspace=apps/web -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 0 | — | infra | `npm run test --workspace=apps/web -- --run` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 0 | INPUT-06, REVIEW-01, REVIEW-02, REVIEW-04 | unit stub | `npm run test --workspace=apps/web -- --run` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 0 | OUT-02, OUT-03 | unit stub | `npm run test --workspace=apps/web -- --run` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | INPUT-06 | unit | `npm run test --workspace=apps/web -- --run` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | REVIEW-01, REVIEW-02, REVIEW-04 | unit | `npm run test --workspace=apps/web -- --run` | ❌ W0 | ⬜ pending |
| 06-02-03 | 02 | 1 | OUT-02, OUT-03 | unit | `npm run test --workspace=apps/web -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/vitest.config.mts` — Vitest + @vitejs/plugin-react + jsdom + vite-tsconfig-paths
- [ ] `apps/web/package.json` — add `"test": "vitest run"` script + dev dependencies (vitest, @vitejs/plugin-react, jsdom, @testing-library/react, @testing-library/dom, @testing-library/user-event, vite-tsconfig-paths)
- [ ] `apps/web/__tests__/BulletCard.test.tsx` — RED stubs covering REVIEW-01, REVIEW-02, REVIEW-04
- [ ] `apps/web/__tests__/DownloadStep.test.tsx` — RED stubs covering OUT-02, OUT-03 (mocked fetch)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full upload → review → download flow | All | Browser file API + live server; no E2E framework in scope | Upload real PDF, paste JD, review rewrites, click Download, open DOCX in Word/Docs |
| Drag-and-drop PDF into drop zone | INPUT-06 (partial) | Requires real browser drag interaction | Drag a PDF file onto the drop zone, verify filename appears |
| PDF error targeted messages | Phase 2 codes | Requires live API + specific PDF fixtures | Upload scanned PDF → verify "appears to be scanned" message |
| Processing indicator duration | OUT-02 | Requires live 15–30s AI call | Trigger analysis, confirm spinner stays visible entire duration |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
