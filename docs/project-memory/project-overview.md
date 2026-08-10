# Project Overview

Last updated: 2026-08-10

## Description

ElectroPI Bug Tracker is a TanStack Start React application for QA, developers, supervisors, admins, and audit/monitor roles to report, triage, resolve, track, and analyze bugs across projects.

## Target Users

- Testers: report bugs, manage attachments, comments, and follow resolution.
- Developers: view assigned bugs, update status, request help, and track resolution time.
- Admins and supervisors: manage projects, users, reports, mock/demo data, and operational dashboards.
- Auditors and monitors: review quality signals and resolution-time evidence.

## Core Modules

- Authentication and password reset.
- Role-aware dashboard and analytics.
- Bug list, detail, creation, import, attachments, comments, related bugs, history.
- Project list and detail.
- Priority task management with task timers.
- Reports and CSV/export-oriented utilities.
- Notifications and assistance requests.
- Admin user management and mock data controls.
- Settings, profile/avatar, preferences, and database migration guidance.

## Architecture

- Frontend: React 19, TypeScript, TanStack Router/Start, React Query.
- UI: Tailwind CSS v4, Radix primitives, local shadcn-style components, lucide-react icons.
- Backend/data: Supabase Postgres, Auth, Storage, RPCs, RLS policies, migrations.
- Runtime: Vite/TanStack Start with Cloudflare-oriented Nitro build.
- State: React Query for server data, focused hooks for feature state, limited localStorage fallback for mock/offline demo data.

## Database

Primary public tables include `profiles`, `user_roles`, `projects`, `project_developers`, `bugs`, `comments`, `attachments`, `bug_history`, `bug_relations`, `notifications`, `assistance_requests`, `tasks`, `task_time_entries`, and `bug_time_entries`.

RLS and integrity migrations are present for bug visibility, project management, attachments, assistance requests, audit history, notifications, and timers.

## APIs

The app mostly uses Supabase client APIs directly from feature services/hooks. Aggregated dashboard data uses `bug_dashboard_stats`. Server-side service-role support exists in `src/integrations/supabase/client.server.ts`, but there is no safe general SQL execution endpoint, by design.

## Important Architecture Decisions

- Preserve existing route names and data contracts.
- Use Supabase RLS as the primary authorization boundary.
- Use feature-specific hooks/services instead of a parallel global state system.
- Do not expose service-role secrets or arbitrary SQL execution to the browser.
- Keep demo/migration repair SQL as explicit admin-run scripts, not hidden browser-side execution.
