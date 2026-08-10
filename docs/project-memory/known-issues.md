# Known Issues

Last updated: 2026-08-10

## Demo Login Can Fail After Manual SQL Seeding

Impact: Demo users may see `{ code: "unexpected_failure", message: "Database error querying schema" }`.

Temporary solution: Run the diagnostic and normalization scripts in `supabase/diagnose_auth_runtime.sql` and `supabase/normalize_demo_auth_users.sql`, or recreate users using supported Supabase Auth/Admin APIs.

Preferred solution: Use `npm run seed:demo` with `SUPABASE_SERVICE_ROLE_KEY` after migrations are applied.

Status: Mitigated, still open until verified against the live Supabase project.

## Migrations Cannot Be Applied From Current Local Environment

Impact: `npx supabase db push` cannot run without `SUPABASE_ACCESS_TOKEN`; SQL scripts requiring elevated permissions must be run in Supabase SQL Editor or with a DB connection.

Temporary solution: Add a Supabase access token locally or run SQL manually in the dashboard.

Status: Open.

## Full Lint May Surface Existing Formatting Drift

Impact: Repo-wide lint can be blocked by unrelated formatting and line-ending issues.

Temporary solution: Use targeted lint for touched files and schedule a separate formatting cleanup.

Status: Open.

## Resolution Analytics Depends On New Migration

Impact: Admin/auditor resolution-time panels cannot show persisted data until `bug_time_entries` exists.

Temporary solution: Apply `supabase/migrations/20260810193000_bug_resolution_time_entries.sql`.

Status: Open.

## Large Bundles From Heavy Dependencies

Impact: `xlsx`, `recharts`, router/runtime, and Supabase libraries dominate bundle output.

Temporary solution: Preserve code splitting and consider lazy loading report/import/chart-heavy routes.

Status: Open.
