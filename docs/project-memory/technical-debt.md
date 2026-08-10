# Technical Debt

Last updated: 2026-08-10

## High Priority

| Issue                                                                                                                                                  | Risk   | Files                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------- |
| Demo auth SQL repairs touch `auth.users` and `auth.identities` manually. A preferred Admin API seed script now exists; SQL files remain fallback only. | Medium | `scripts/seed-demo-accounts.mjs`, `supabase/*demo*auth*.sql`, `supabase/seed_test_accounts.sql` |
| No service-role or DB connection is configured locally, so migrations cannot be applied from the workspace.                                            | High   | `.env`, Supabase CLI workflow                                                                   |
| Full lint has historically been noisy due Prettier/line-ending churn and formatting drift.                                                             | Medium | Multiple existing TSX files                                                                     |
| Large route files contain mixed fetching, mutation, rendering, and import/export logic.                                                                | Medium | `src/routes/_authenticated/bugs/index.tsx`, `src/routes/_authenticated/tasks.tsx`               |

## Medium Priority

| Issue                                                                               | Risk   | Files                                                                            |
| ----------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| Some cache updates use loose `any` typing.                                          | Medium | `src/components/common/InteractiveStatusEditor.tsx`                              |
| Some dynamic Supabase updates rely on casts like `as never`.                        | Medium | `src/components/bugs/BugInfoPanel.tsx`, `src/routes/_authenticated/settings.tsx` |
| LocalStorage fallback paths are useful for demos but can hide database failures.    | Medium | `src/lib/api.ts`, `src/lib/bug-time.ts`, `src/lib/mock-data-service.ts`          |
| Dashboard/reporting analytics still rely on client-side aggregation for some views. | Medium | `src/components/dashboard/RoleDashboardPanels.tsx`, `src/lib/bug-time.ts`        |

## Low Priority

| Issue                                                                                      | Risk | Files                                |
| ------------------------------------------------------------------------------------------ | ---- | ------------------------------------ |
| Generated Supabase types can create noisy diffs if formatted by general Prettier settings. | Low  | `src/integrations/supabase/types.ts` |
| Some UI strings have encoding artifacts from earlier edits.                                | Low  | Several route/component files        |

## Recommended Control

- Keep SQL repair scripts explicit and documented.
- Prefer `npm run seed:demo` with `SUPABASE_SERVICE_ROLE_KEY` over direct SQL auth table writes.
- Add tests around permission helpers and time-tracking services.
- Extract large route logic only when behavior is well-covered.
- Do not add broad migration execution from the browser.
