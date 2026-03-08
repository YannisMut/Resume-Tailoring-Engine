---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [turborepo, typescript, vitest, npm-workspaces, zod, express, nextjs]

# Dependency graph
requires: []
provides:
  - npm workspace root with apps/* and packages/* workspaces
  - Turborepo v2 pipeline (build, dev, typecheck, test, lint) using tasks key
  - tsconfig.base.json with strict mode, noUncheckedIndexedAccess, exactOptionalPropertyTypes
  - packages/types: package.json exporting ./src/index.ts, tsconfig, vitest config
  - apps/api: package.json with @resume/types workspace dep, tsconfig, vitest config
  - apps/web: package.json with @resume/types workspace dep, tsconfig
  - Wave 0 test scaffolds for ResumeStructureSchema, RewrittenBulletSchema, AnalysisResultSchema (RED state)
  - Wave 0 test scaffolds for errorMiddleware, AppError, PdfParseError, OpenAiTimeoutError (RED state)
affects: [01-02-PLAN.md, 01-03-PLAN.md, 01-04-PLAN.md, 01-05-PLAN.md, all downstream phases]

# Tech tracking
tech-stack:
  added:
    - turbo 2.8.14
    - typescript 5.9.3
    - vitest 4.0.18 (packages/types, apps/api)
    - tsup 8.5.1 (packages/types, apps/api)
    - zod 4.3.6 (packages/types, apps/api, apps/web)
    - express 5.2.1 (apps/api)
    - next 16.1.6 (apps/web)
    - tsx 4.21.0 (apps/api)
  patterns:
    - Turborepo v2 tasks key (not pipeline — pipeline is v1 and errors in v2)
    - packages/types exports ./src/index.ts directly (no build step needed in monorepo dev)
    - All tsconfigs extend ../../tsconfig.base.json for strict mode inheritance
    - Wave 0 test scaffolds written in RED state before any implementation exists (Nyquist Rule)

key-files:
  created:
    - package.json
    - turbo.json
    - tsconfig.base.json
    - packages/types/package.json
    - packages/types/tsconfig.json
    - packages/types/vitest.config.ts
    - packages/types/src/__tests__/resume-structure.test.ts
    - apps/api/package.json
    - apps/api/tsconfig.json
    - apps/api/vitest.config.ts
    - apps/api/src/__tests__/error-middleware.test.ts
    - apps/web/package.json
    - apps/web/tsconfig.json
  modified: []

key-decisions:
  - "turbo.json uses tasks key (v2 API) not pipeline (v1 API) — pipeline causes errors in Turbo 2.x"
  - "packages/types exports ./src/index.ts directly so apps can import without a build step during development"
  - "tsconfig.base.json enforces strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes — applied before any implementation to avoid painful migration"
  - "Wave 0 test scaffolds written in RED state — tests will fail until Plans 02 and 03 create source files"

patterns-established:
  - "Turbo v2 pattern: use tasks key for all pipeline definitions"
  - "TypeScript pattern: all packages extend ../../tsconfig.base.json for uniform strict mode"
  - "Test scaffold pattern: Wave 0 stubs define the contract before implementation (Nyquist Rule)"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-03-08
---

# Phase 1 Plan 01: Monorepo Scaffold and Wave 0 Test Infrastructure Summary

**Turborepo v2 npm workspace with strict TypeScript base config, three package manifests (@resume/types, @resume/api, @resume/web), and Wave 0 failing test stubs establishing the ResumeStructure and error middleware contracts**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-08T23:55:58Z
- **Completed:** 2026-03-08T23:58:00Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Root npm workspace with Turborepo v2 pipeline (build, dev, typecheck, test, lint tasks)
- tsconfig.base.json with strict mode, noUncheckedIndexedAccess, and exactOptionalPropertyTypes enforced before any implementation
- Package manifests for packages/types, apps/api, and apps/web with correct workspace protocol deps
- Wave 0 test scaffolds for ResumeStructureSchema/RewrittenBulletSchema/AnalysisResultSchema in RED state
- Wave 0 test scaffolds for errorMiddleware/AppError/PdfParseError/OpenAiTimeoutError in RED state
- All 205 packages installed and workspaces linked (turbo, typescript, vitest, zod, express, next, etc.)

## Task Commits

Each task was committed atomically:

1. **Task 1: Root workspace manifest, Turborepo config, and base tsconfig** - `b15b5e9` (chore)
2. **Task 2: Package manifests, tsconfigs, and Wave 0 test scaffolds** - `77a6b27` (feat)

## Files Created/Modified
- `package.json` - Root workspace manifest with workspaces: [apps/*, packages/*]
- `turbo.json` - v2 pipeline with tasks key: build, dev, typecheck, test, lint
- `tsconfig.base.json` - Strict mode base config extended by all packages
- `packages/types/package.json` - @resume/types package exporting ./src/index.ts directly
- `packages/types/tsconfig.json` - Extends base, includes src/
- `packages/types/vitest.config.ts` - Vitest config with globals
- `packages/types/src/__tests__/resume-structure.test.ts` - Wave 0 failing tests for ResumeStructureSchema, RewrittenBulletSchema, AnalysisResultSchema
- `apps/api/package.json` - @resume/api with @resume/types workspace dep and Express 5.2.1
- `apps/api/tsconfig.json` - Extends base, rootDir src/
- `apps/api/vitest.config.ts` - Vitest config with globals
- `apps/api/src/__tests__/error-middleware.test.ts` - Wave 0 failing tests for errorMiddleware, AppError, PdfParseError, OpenAiTimeoutError
- `apps/web/package.json` - @resume/web with @resume/types workspace dep and Next.js 16.1.6
- `apps/web/tsconfig.json` - Extends base with DOM lib, JSX preserve, Next.js plugin

## Decisions Made
- Used `tasks` key in turbo.json (not `pipeline`) — `pipeline` is Turbo v1 API and errors in Turbo v2
- packages/types exports `./src/index.ts` directly so consuming apps import TypeScript source without requiring a build step during development
- tsconfig.base.json strict flags applied before any implementation exists — adding strict mode after-the-fact requires fixing every existing error simultaneously
- Wave 0 test stubs written now in RED state per Nyquist Rule — tests define the contract before Plans 02 and 03 create the implementation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - npm install completed cleanly with 0 vulnerabilities. All workspace links resolved correctly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Workspace is fully configured and ready for Plan 02 (packages/types Zod schemas)
- Plan 02 will implement ResumeStructureSchema, RewrittenBulletSchema, AnalysisResultSchema to turn the RED Wave 0 tests GREEN
- Plan 03 will implement errorMiddleware, AppError, PdfParseError, OpenAiTimeoutError in apps/api
- All downstream plans depend on this workspace scaffold being in place

## Self-Check: PASSED

All 13 files exist at claimed paths. Both commits (b15b5e9, 77a6b27) confirmed present in git log.

---
*Phase: 01-foundation*
*Completed: 2026-03-08*
