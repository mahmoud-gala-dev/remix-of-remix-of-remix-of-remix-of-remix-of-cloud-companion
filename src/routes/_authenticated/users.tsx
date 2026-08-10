import { createFileRoute } from "@tanstack/react-router";
import { LazyAdminDashboard } from "@/components/admin/LazyAdminDashboard";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "User Management & Admin Dashboard | ElectroPI" },
      {
        name: "description",
        content:
          "Complete User Management and Admin Dashboard. Create admin users, import/export data, and manage accounts.",
      },
      { property: "og:title", content: "User Management & Admin Dashboard | ElectroPI" },
      {
        property: "og:description",
        content:
          "Admin Dashboard for managing users, roles, account creation, and database import/export.",
      },
    ],
  }),
  component: UsersPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFound label="users page" />,
});

function UsersPage() {
  return (
    <div className="w-full">
      <LazyAdminDashboard />
    </div>
  );
}

export default UsersPage;
