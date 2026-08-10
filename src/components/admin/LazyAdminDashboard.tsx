import React, { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

// Dynamic import for AdminDashboardView
const AdminDashboardViewLazy = lazy(() => import("@/components/admin/AdminDashboardView"));

const DashboardLoadingFallback: React.FC = () => (
  <div className="flex h-[60vh] w-full flex-col items-center justify-center space-y-3">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <p className="text-sm font-medium text-muted-foreground">Loading Admin Dashboard...</p>
  </div>
);

export const LazyAdminDashboard: React.FC = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<DashboardLoadingFallback />}>
        <AdminDashboardViewLazy />
      </Suspense>
    </ErrorBoundary>
  );
};
