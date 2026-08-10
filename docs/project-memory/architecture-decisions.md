# Architecture Decisions

Last updated: 2026-08-10

## ADR-001: Supabase RLS Is The Authorization Boundary

Problem: The app has multiple roles and direct Supabase client calls.

Decision: Keep authorization enforced through RLS policies and helper functions, with frontend checks used for UX only.

Reason: Browser-side role checks can be bypassed. RLS is the database-level control.

Alternatives: Route all data through custom server APIs. This is heavier and not aligned with current architecture.

Impact: Migrations and policies must be reviewed with every role/data feature.

## ADR-002: No Browser-Side Arbitrary SQL Execution

Problem: Admins requested a button to execute migrations from settings.

Decision: Provide migration status/guidance and copyable SQL, but do not expose arbitrary SQL execution or service-role credentials to the browser.

Reason: SQL execution requires high privilege and would create a severe security risk if exposed client-side.

Alternatives: Secure server endpoint with service-role and allowlisted migrations. This requires deployment secrets, audit logging, and careful locking.

Impact: Admins apply migrations through Supabase CLI/SQL Editor until a secure backend migration runner is explicitly designed.

## ADR-003: Preserve Existing Routes And UI Patterns

Problem: The app already has established navigation, cards, forms, tables, dialogs, and route names.

Decision: New functionality should reuse existing components and avoid route renames.

Reason: Lovable sync, user habits, and route contracts depend on stability.

Impact: Improvements should be incremental and scoped.

## ADR-004: Local Demo Fallbacks Are Non-Production Convenience

Problem: LocalStorage fallbacks keep the app usable when Supabase data is unavailable.

Decision: Preserve fallback behavior for demo/dev workflows, but document it as non-authoritative.

Reason: It prevents blank screens during development but should not mask production data failures.

Impact: Production readiness depends on stronger observability and clearer error reporting.
