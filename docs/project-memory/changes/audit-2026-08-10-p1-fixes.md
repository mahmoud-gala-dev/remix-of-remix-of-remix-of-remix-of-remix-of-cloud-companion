# Audit Date

2026-08-10

---

# Previous Score

7.4 / 10

---

# New Score

7.6 / 10

---

# Improvements Implemented

- Added a safer Supabase Admin API demo seeding path.
- Added a migration and demo-data runbook.
- Added role permission tests for the expanded role model.

---

# Files Modified

- `package.json`: added `seed:demo` script.
- `docs/project-memory/backlog.md`: marked completed P1 items.
- `docs/project-memory/current-score.md`: updated score after safe improvements.
- `docs/project-memory/technical-debt.md`: downgraded direct-auth SQL risk because a safer preferred path now exists.
- `docs/project-memory/features.md`: recorded Admin API demo seeding.
- `docs/project-memory/known-issues.md`: documented preferred fix for demo auth.
- `docs/project-memory/progress.md`: added Audit #2.

---

# Files Created

- `scripts/seed-demo-accounts.mjs`: creates/updates demo users through Supabase Admin API and upserts profiles/roles.
- `src/lib/permissions.test.ts`: verifies role visibility and edit/report permissions.
- `docs/project-memory/migration-runbook.md`: operational runbook for migrations and demo data.

---

# Files Deleted

None.

---

# Bugs Fixed

- Reduced risk from manually seeding `auth.users` and `auth.identities`; SQL fallbacks remain but are no longer the preferred path.

---

# Features Added

- `npm run seed:demo` for service-role backed demo user setup.

---

# Technical Debt Remaining

- Full-repo lint/format drift still needs a separate focused cleanup.
- Live Supabase migration execution still requires access token, SQL Editor, or DB connection.
- Resolution analytics still need DB-side aggregation once schema is verified.

---

# Risks

- `seed:demo` requires `SUPABASE_SERVICE_ROLE_KEY`; it must never be exposed as `VITE_*`.
- Auditor/monitor role enum values must exist before role upserts succeed.

---

# Next Priorities

P1:

- Verify live Supabase demo login after using Admin API seed.
- Resolve repo-wide lint/format drift as a separate mechanical change.

P2:

- Add timer service tests and database migration status tests.

P3:

- Move resolution analytics to RPC/view.
