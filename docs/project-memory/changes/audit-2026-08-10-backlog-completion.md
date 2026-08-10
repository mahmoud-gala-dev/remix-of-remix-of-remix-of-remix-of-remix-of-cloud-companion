# Audit Change Log: Backlog Completion

Date: 2026-08-10

## Scope

Executed remaining backlog items from P2 and P3 and converted external P4 operational work into a concrete production runbook.

## Changes

- Added `supabase/migrations/20260810213000_resolution_time_analytics_view.sql`.
- Updated `src/lib/bug-time.ts` to prefer `get_resolution_time_analytics()` with fallback to legacy client aggregation.
- Added `src/lib/saved-filters.ts` and wired saved filters into Bugs and Reports.
- Added bulk selection and bulk status/assignment updates to the Bugs page.
- Added `src/lib/bug-import.ts` and `src/lib/bug-import.test.ts` to split import parsing from the route.
- Added audit log filtering and CSV export to Reports.
- Added PDF/print export action to Reports.
- Added inline import/export result states.
- Expanded migration checks to cover the resolution analytics view.
- Added `docs/project-memory/production-hardening-runbook.md` for P4 deployment-owned controls.

## Validation

- `npm run test`: passed.
- `npm run lint`: passed with existing Fast Refresh warnings only.
- `npm run build`: passed.

## Notes

The P4 items require Supabase/Auth/WAF or server-only secret configuration. They are documented as operational runbooks because implementing them in browser code would be unsafe.
