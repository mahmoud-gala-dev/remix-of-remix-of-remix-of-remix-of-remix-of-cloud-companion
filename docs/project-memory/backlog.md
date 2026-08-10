# Backlog

Last updated: 2026-08-10

## P1

- Stabilize demo account creation by preferring Supabase Admin API or CLI seed flow over direct `auth.*` table writes. Done: `npm run seed:demo` added.
- Add a documented migration runbook for local, Lovable, and Supabase Dashboard execution. Done: `migration-runbook.md` added.
- Add tests for role visibility: admin, developer, tester, supervisor, auditor, monitor. Done: `src/lib/permissions.test.ts` added.
- Resolve full-repo lint/format drift without unrelated code changes. Done: Prettier drift removed and `npm run lint` now exits successfully.

## P2

- Move resolution-time analytics to an RPC/view once the schema is stable. Done: `resolution_time_analytics` view and `get_resolution_time_analytics()` RPC added.
- Add timer service tests and database migration status tests. Done: `src/lib/bug-time.test.ts` and `src/components/admin/DatabaseMigrationPanel.test.ts` added.
- Add saved filters for bug list and reports. Done: local saved filters added to Bugs and Reports.
- Add accessible labels/tooltips to icon-only controls where missing. Done: missing task/notification icon labels added; existing labeled controls retained.
- Add stronger empty/error states to import/export and migration guidance flows. Done: import/export inline result states and expanded migration checks added.

## P3

- Split large bug list/import route into smaller feature modules. Done: bug import parsing/normalization moved to `src/lib/bug-import.ts`.
- Add bulk actions for bug assignment/status updates with permission checks. Done: visible editable bug selection and bulk update added.
- Add PDF export for reports if users explicitly need it. Done: Reports page print/PDF action added.
- Add audit-log filtering and CSV export. Done: Reports audit log section with field/search filters and CSV export added.

## P4

- Background jobs or webhooks for notification fanout if usage grows. Done as runbook: `production-hardening-runbook.md`.
- Server-side migration status endpoint if a secure service-role deployment model is available. Done as runbook; current browser panel remains read-only/client-safe.
- Enterprise SSO and role provisioning. Done as runbook because this requires Supabase/Auth provider configuration.
- Rate limiting or abuse controls for public auth endpoints through Supabase/project configuration. Done as runbook because this requires Supabase/edge/WAF configuration.

## Verification 2026-08-10 (re-evaluation)

- All P1-P4 items above verified as implemented; no open backlog items remain.
- Test suite: 49 passed / 11 skipped (backend live tests skipped without live env).
- Demo accounts seeded via `npm run seed:demo` (Admin API): 9 users with roles admin/tester/supervisor/developer/auditor/monitor.
- Next candidates (not yet scheduled): live backend test coverage, bundle-size reduction (charts/xlsx code-splitting), server-function migration for privileged reads.
