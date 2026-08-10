# Migration And Demo Data Runbook

Last updated: 2026-08-10

## Preferred Local Workflow

Use the Supabase CLI when a personal access token is available:

```powershell
$env:SUPABASE_ACCESS_TOKEN="YOUR_TOKEN"
npx supabase link --project-ref ryrataygmwpoyrljlntx
npx supabase db push
```

## Preferred Demo Account Workflow

Use the Supabase Admin API seed script instead of writing directly to `auth.users` and `auth.identities`.

Required environment variables:

```powershell
$env:SUPABASE_URL="https://ryrataygmwpoyrljlntx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
npm run seed:demo
```

This creates or updates:

- `admin@test.com`
- `creator@test.com`
- `creator2@test.com`
- `tester@test.com`
- `supervisor@test.com`
- `developer@test.com`
- `developer2@test.com`
- `auditor@test.com`
- `monitor@test.com`

Default password:

```text
TestPass!2345
```

## Supabase Dashboard Workflow

When CLI access is unavailable:

1. Open Supabase SQL Editor.
2. Apply enum roles in a separate execution:

```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'monitor';
NOTIFY pgrst, 'reload schema';
```

3. Apply `supabase/migrations/20260810193000_bug_resolution_time_entries.sql`.
4. Prefer `npm run seed:demo` with service-role credentials for demo users.
5. Use SQL fallback files only when Admin API access is unavailable.

## SQL Fallback Files

These files are operational fallbacks and should not be the default production path:

- `supabase/seed_test_accounts.sql`
- `supabase/repair_demo_auth_accounts.sql`
- `supabase/normalize_demo_auth_users.sql`
- `supabase/diagnose_demo_auth.sql`
- `supabase/diagnose_auth_runtime.sql`

## Safety Rules

- Never place `SUPABASE_SERVICE_ROLE_KEY` in browser-facing `VITE_*` variables.
- Never add a browser button that runs arbitrary SQL.
- Keep migrations explicit, reviewed, and idempotent.
- After applying migrations, verify status from `/settings` as an admin.
