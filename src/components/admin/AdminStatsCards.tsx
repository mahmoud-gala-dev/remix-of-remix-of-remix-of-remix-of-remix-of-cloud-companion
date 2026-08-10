import React from "react";
import { Users, UserCheck, ShieldCheck, UserX } from "lucide-react";
import type { UserStats } from "@/types/user-management";
import { Card, CardContent } from "@/components/ui/card";

interface AdminStatsCardsProps {
  stats: UserStats;
}

export const AdminStatsCards: React.FC<AdminStatsCardsProps> = ({ stats }) => {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total Users</p>
            <h3 className="text-2xl font-bold tracking-tight mt-1">{stats.totalUsers}</h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Active Users</p>
            <h3 className="text-2xl font-bold tracking-tight mt-1 text-emerald-600 dark:text-emerald-400">
              {stats.activeUsers}
            </h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <UserCheck className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Admin Users</p>
            <h3 className="text-2xl font-bold tracking-tight mt-1 text-destructive">
              {stats.adminUsers}
            </h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Inactive Accounts</p>
            <h3 className="text-2xl font-bold tracking-tight mt-1 text-amber-600">
              {stats.inactiveUsers}
            </h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
            <UserX className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
