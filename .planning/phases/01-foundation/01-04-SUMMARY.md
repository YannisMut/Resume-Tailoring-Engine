---
phase: 01-foundation
plan: "04"
subsystem: ui
tags: [nextjs, react, typescript, monorepo, transpilePackages, bundler]

# Dependency graph
requires:
  - phase: 01-foundation-01-01
    provides: monorepo scaffold with workspace config and tsconfig.base.json
  - phase: 01-foundation-01-02
    provides: "@resume/types Zod schemas and TypeScript types"

provides:
  - Next.js 16 app shell in apps/web with App Router layout and placeholder page
  - next.config.ts with transpilePackages: ['@resume/types'] for monorepo TS source packages
  - Confirmed @resume/types importable from apps/web with zero TypeScript errors

affects:
  - 06-wizard-ui (will replace placeholder page.tsx with real wizard components)
  - All future frontend work in apps/web

# Tech tracking
tech-stack:
  added: [next@16.1.6, react@latest, react-dom@latest, @types/react, @types/react-dom]
  patterns:
    - Next.js App Router with minimal root layout (html/body shell only)
    - transpilePackages in next.config.ts for monorepo TS source packages (no build step)
    - moduleResolution bundler in apps/web tsconfig overriding NodeNext base (Next.js requirement)
    - Compile-time type import validation pattern for workspace link verification

key-files:
  created:
    - apps/web/next.config.ts
    - apps/web/app/layout.tsx
    - apps/web/app/page.tsx
    - apps/web/next-env.d.ts
  modified:
    - apps/web/tsconfig.json

key-decisions:
  - "apps/web tsconfig overrides module/moduleResolution to ESNext/bundler — Next.js internal type declarations are incompatible with NodeNext resolution used in tsconfig.base.json"
  - "transpilePackages: ['@resume/types'] in next.config.ts required because packages/types exports TS source directly with no build step"

patterns-established:
  - "Next.js app overrides moduleResolution to bundler even when monorepo base uses NodeNext — keep per-app tsconfig to avoid conflicts"
  - "Compile-time type check via type alias (type _Check = SomeType['field']) confirms workspace link without runtime overhead"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-03-08
---

# Phase 1 Plan 04: Next.js Web App Shell Summary

**Next.js 16 App Router shell with transpilePackages config and compile-time @resume/types import verification — zero TypeScript errors**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-08T23:57:37Z
- **Completed:** 2026-03-08T23:57:52Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created Next.js 16 App Router shell (layout.tsx, page.tsx, next.config.ts, next-env.d.ts)
- Configured transpilePackages: ['@resume/types'] so Next.js handles TS source from the monorepo package without a build step
- Fixed apps/web tsconfig to use moduleResolution: bundler (required by Next.js — NodeNext from base was incompatible)
- Verified @resume/types is importable in apps/web with compile-time ResumeStructure type check passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Next.js config and app shell files** - `544c0f4` (feat)
2. **Task 2: Verify @resume/types is importable in web app** - `5e7d46f` (chore)

**Plan metadata:** (created below)

## Files Created/Modified
- `apps/web/next.config.ts` - NextConfig with transpilePackages: ['@resume/types']
- `apps/web/app/layout.tsx` - Root layout with html/body shell and app metadata
- `apps/web/app/page.tsx` - Step 1 placeholder page with @resume/types compile-time import check
- `apps/web/next-env.d.ts` - Next.js TypeScript type reference file
- `apps/web/tsconfig.json` - Added module: ESNext, moduleResolution: bundler overrides

## Decisions Made
- Overrode `module` and `moduleResolution` in apps/web/tsconfig.json to `ESNext`/`bundler` — Next.js 16's own type declarations (in @vercel/og) use relative imports without extensions and cannot satisfy NodeNext's strict extension requirement
- Used `transpilePackages` rather than a build step for @resume/types — consistent with Plan 02's decision to export TS source directly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed apps/web tsconfig module resolution incompatibility with Next.js**
- **Found during:** Task 1 (Next.js config and app shell files)
- **Issue:** tsconfig.base.json sets `module: NodeNext` and `moduleResolution: NodeNext`. Next.js 16's internal type declarations (`@vercel/og/types.d.ts`) use relative imports without `.js` extensions, which NodeNext rejects with TS2834. Build fails immediately.
- **Fix:** Added `"module": "ESNext"` and `"moduleResolution": "bundler"` overrides in apps/web/tsconfig.json compilerOptions — these override the base and are the settings Next.js itself requires
- **Files modified:** apps/web/tsconfig.json
- **Verification:** `turbo typecheck --filter=@resume/web` passes with zero errors after fix
- **Committed in:** `544c0f4` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix — Next.js 16 requires bundler moduleResolution; NodeNext breaks its own internal types. No scope creep. packages/types keeps NodeNext (correct for Node.js runtime); apps/web uses bundler (correct for Next.js/webpack).

## Issues Encountered
The `create-next-app` scaffold approach failed because apps/web already had `package.json` and `tsconfig.json`. Created all files manually using the canonical content from the plan. All files match the plan's specified content exactly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- apps/web builds and typechecks cleanly — ready for wizard UI implementation in Phase 6
- @resume/types workspace link confirmed working for both backend (apps/api, Plan 02) and frontend (apps/web, this plan)
- The bundler/ESNext tsconfig override pattern is established for all future Next.js work in apps/web
- Plan 03 (API shell) can proceed independently using the same monorepo patterns

---
*Phase: 01-foundation*
*Completed: 2026-03-08*

## Self-Check: PASSED

- apps/web/next.config.ts: FOUND
- apps/web/app/layout.tsx: FOUND
- apps/web/app/page.tsx: FOUND
- apps/web/next-env.d.ts: FOUND
- .planning/phases/01-foundation/01-04-SUMMARY.md: FOUND
- Commit 544c0f4 (Task 1): FOUND
- Commit 5e7d46f (Task 2): FOUND
