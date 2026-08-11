import React from "react";
import { Search, ShieldAlert, SlidersHorizontal, RefreshCw } from "lucide-react";
import { useUsersManager } from "@/hooks/useUsersManager";
import { AdminStatsCards } from "./AdminStatsCards";
import { AddUserModal } from "./AddUserModal";
import { ImportExportModal } from "./ImportExportModal";
import { UserTable } from "./UserTable";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserRole } from "@/types/user-management";

export const AdminDashboardView: React.FC = () => {
  const {
    users,
    allUsers,
    stats,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    addUser,
    deleteUser,
    importUsers,
    setUserActive,
    setUserRole,
  } = useUsersManager();


  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Header Title & Quick Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-primary uppercase tracking-wider mb-1">
              <ShieldAlert className="h-4 w-4" />
              User Management & Admin Control
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Admin Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage user permissions, create admin accounts, import, export, generate and clean
              mock data records.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ImportExportModal users={allUsers} onImportUsers={importUsers} />
            <AddUserModal onAddUser={addUser} />
          </div>
        </div>

        {/* Aggregate Stats Cards */}
        <AdminStatsCards stats={stats} />

        {/* Filters & Search Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-xl border border-border/80 shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by username or email address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filter by:
            </div>

            <Select
              value={roleFilter}
              onValueChange={(val) => setRoleFilter(val as UserRole | "all")}
            >
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="developer">Developer</SelectItem>
                <SelectItem value="tester">Tester (QA)</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="auditor">Auditor</SelectItem>
                <SelectItem value="monitor">Monitor</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val)}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            {(searchQuery || roleFilter !== "all" || statusFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setRoleFilter("all");
                  setStatusFilter("all");
                }}
                className="flex items-center gap-1 text-xs text-primary hover:underline px-2 py-1"
              >
                <RefreshCw className="h-3 w-3" /> Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Main Users Table */}
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
            {error.message}
          </div>
        ) : isLoading ? (
          <div className="rounded-xl border border-border/80 bg-card p-6 text-sm text-muted-foreground">
            Loading accounts…
          </div>
        ) : (
          <UserTable
            users={users}
            onDeleteUser={deleteUser}
            onToggleActive={setUserActive}
            onChangeRole={setUserRole}
          />
        )}

        {/* Integrations moved to Settings → Integrations */}
      </div>

    </ErrorBoundary>
  );
};

export default AdminDashboardView;
