# Features

Last updated: 2026-08-10

| Feature                                | Status | Related Files                                                                                         | Complete   | Future Work                              |
| -------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------- |
| Email/password auth and password reset | Active | `src/routes/index.tsx`, `src/routes/reset-password.tsx`, `src/lib/auth.tsx`                           | Mostly     | Stabilize demo auth seeding              |
| Role-aware shell/navigation            | Active | `src/components/layout/Shell.tsx`, `src/lib/permissions.ts`                                           | Mostly     | Add monitor/auditor nav tuning if needed |
| Dashboard metrics/charts               | Active | `src/routes/_authenticated/dashboard.tsx`                                                             | Mostly     | More server-side aggregates              |
| Role dashboard panels                  | Active | `src/components/dashboard/RoleDashboardPanels.tsx`                                                    | Mostly     | Add tests and RPC aggregation            |
| Bug list/search/filter/import          | Active | `src/routes/_authenticated/bugs/index.tsx`                                                            | Mostly     | Split large route, saved filters         |
| Bug detail workflow                    | Active | `src/routes/_authenticated/bugs/$id.tsx`, `src/components/bugs/*`                                     | Mostly     | Broaden tests                            |
| Developer resolution timer             | Active | `src/components/bugs/BugResolutionTimer.tsx`, `src/hooks/useBugTimeTracker.ts`, `src/lib/bug-time.ts` | Partial    | Requires migration applied               |
| Tasks and task timer                   | Active | `src/routes/_authenticated/tasks.tsx`, `src/components/tasks/TaskTimer.tsx`                           | Mostly     | Improve reporting                        |
| Notifications                          | Active | `src/routes/_authenticated/notifications.tsx`, `src/components/layout/Shell.tsx`                      | Mostly     | Realtime coverage in more views          |
| Assistance requests                    | Active | `src/components/bugs/BugAssistance.tsx`, `src/lib/assistance-requests.ts`                             | Mostly     | Better queue/admin reporting             |
| Projects                               | Active | `src/routes/_authenticated/projects/*`, `src/components/projects/ProjectMembers.tsx`                  | Mostly     | Member role refinements                  |
| Reports                                | Active | `src/routes/_authenticated/reports.tsx`, `src/lib/reports.ts`                                         | Mostly     | PDF export only if needed                |
| Admin user management                  | Active | `src/routes/_authenticated/users.tsx`, `src/components/admin/*`, `src/hooks/useUsersManager.ts`       | Demo/local | Move to real backend if required         |
| Migration guidance panel               | Active | `src/components/admin/DatabaseMigrationPanel.tsx`                                                     | Partial    | Secure runner only with server secrets   |
| Mock/demo data controls                | Active | `src/components/admin/MockDataControls.tsx`, `src/lib/mock-data-service.ts`                           | Mostly     | Better separation from production        |
| Admin API demo seeding                 | Active | `scripts/seed-demo-accounts.mjs`, `package.json`                                                      | Mostly     | Requires service-role env locally        |
