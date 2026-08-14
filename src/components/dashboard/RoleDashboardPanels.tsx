import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, HandHelping, LineChart, TimerReset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchResolutionAnalytics, formatDuration } from "@/lib/bug-time";
import type { BugListRow, Notification } from "@/lib/api";
import {
  SectionCard,
  EmptyPanel,
  formatRelativeTime,
} from "@/components/dashboard/dashboard-parts";
import { assistanceStatusLabel } from "@/lib/assistance-requests";
import { DashboardPagination } from "@/components/dashboard/DashboardPagination";

type AssistanceRequestRow = {
  id: number;
  bug_id: number;
  requester_id: string;
  target_user_id: string;
  type: string;
  message: string | null;
  status: string;
  created_at: string;
};

async function fetchDashboardNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

async function fetchAssistanceQueue(userId: string): Promise<AssistanceRequestRow[]> {
  const { data, error } = await supabase
    .from("assistance_requests")
    .select("*")
    .or(`requester_id.eq.${userId},target_user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as AssistanceRequestRow[];
}

function LiveNotificationFeed() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 4;

  const query = useQuery({
    queryKey: ["dashboard-notifications", user?.id],
    queryFn: () => fetchDashboardNotifications(user!.id),
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`dashboard-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard-notifications", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  const items = query.data ?? [];
  const paginated = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <SectionCard
      title="Live Notifications"
      icon={Bell}
      action={
        <Button asChild size="sm" variant="ghost" className="h-8">
          <Link to="/notifications">Open</Link>
        </Button>
      }
    >
      {query.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : items.length ? (
        <div className="space-y-3">
          <div className="space-y-2">
            {paginated.map((notification) => (
              <Link
                key={notification.id}
                to={notification.bug_id ? "/bugs/$id" : "/notifications"}
                params={notification.bug_id ? { id: String(notification.bug_id) } : {}}
                className="block rounded-lg border border-border/60 px-3 py-2.5 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 text-sm font-medium">{notification.message}</p>
                  {!notification.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatRelativeTime(notification.created_at)}
                </p>
              </Link>
            ))}
          </div>
          <DashboardPagination
            page={page}
            totalItems={items.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            itemLabel="alerts"
          />
        </div>
      ) : (
        <EmptyPanel title="No notifications" detail="Role-specific alerts will appear here." />
      )}
    </SectionCard>
  );
}

function HelpDeskPanel() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 4;

  const query = useQuery({
    queryKey: ["dashboard-assistance", user?.id],
    queryFn: () => fetchAssistanceQueue(user!.id),
    enabled: !!user?.id,
  });

  const items = query.data ?? [];
  const paginated = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <SectionCard
      title="Help Desk"
      icon={HandHelping}
      action={
        <Button asChild size="sm" variant="ghost" className="h-8">
          <Link to="/bugs">Find errors</Link>
        </Button>
      }
    >
      {query.isLoading ? (
        <Skeleton className="h-28 w-full" />
      ) : items.length ? (
        <div className="space-y-3">
          <div className="space-y-2">
            {paginated.map((request) => (
              <Link
                key={request.id}
                to="/bugs/$id"
                params={{ id: String(request.bug_id) }}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {request.type === "meeting" ? "Meeting request" : "Help request"}
                  </p>
                  {request.message && (
                    <p className="truncate text-xs text-muted-foreground">{request.message}</p>
                  )}
                </div>
                <Badge variant="outline">{assistanceStatusLabel(request.status)}</Badge>
              </Link>
            ))}
          </div>
          <DashboardPagination
            page={page}
            totalItems={items.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            itemLabel="requests"
          />
        </div>
      ) : (
        <EmptyPanel
          title="No help requests"
          detail="Requests created from error details will be tracked here."
        />
      )}
    </SectionCard>
  );
}

function ResolutionAnalyticsPanel({ role }: { role: string }) {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  const query = useQuery({
    queryKey: ["resolution-analytics"],
    queryFn: fetchResolutionAnalytics,
    enabled: role === "admin" || role === "auditor" || role === "monitor" || role === "supervisor",
  });

  if (!(role === "admin" || role === "auditor" || role === "monitor" || role === "supervisor")) {
    return null;
  }

  const rows = query.data?.rows ?? [];
  const totals = query.data?.projectTotals ?? [];
  const totalSeconds = totals.reduce((sum, project) => sum + project.totalSeconds, 0);
  const paginatedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <SectionCard title="Resolution Time Analytics" icon={LineChart}>
      {query.isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : rows.length ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Time</p>
              <p className="mt-1 font-mono text-xl font-bold">{formatDuration(totalSeconds)}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tracked Errors</p>
              <p className="mt-1 text-xl font-bold">{rows.length}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Projects</p>
              <p className="mt-1 text-xl font-bold">{totals.length}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground">
                    <th className="px-2 py-2 text-start font-semibold">Error</th>
                    <th className="px-2 py-2 text-start font-semibold">Developer</th>
                    <th className="px-2 py-2 text-start font-semibold">Module</th>
                    <th className="px-2 py-2 text-end font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => (
                    <tr key={`${row.bugId}-${row.developerId}`} className="border-b border-border/30">
                      <td className="px-2 py-2">
                        <Link
                          to="/bugs/$id"
                          params={{ id: String(row.bugId) }}
                          className="font-medium hover:text-primary"
                        >
                          {row.bugCode}
                        </Link>
                        <p className="max-w-[220px] truncate text-xs text-muted-foreground">
                          {row.title}
                        </p>
                      </td>
                      <td className="px-2 py-2">{row.developerName}</td>
                      <td className="px-2 py-2">{row.module}</td>
                      <td className="px-2 py-2 text-end font-mono">
                        {formatDuration(row.totalSeconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DashboardPagination
              page={page}
              totalItems={rows.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="logs"
            />
          </div>
        </div>
      ) : (
        <EmptyPanel
          title="No resolution time yet"
          detail="Developer timers will populate individual and project totals."
        />
      )}
    </SectionCard>
  );
}

function DeveloperFocusPanel({ recentBugs }: { recentBugs: BugListRow[] }) {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 4;
  const paginated = recentBugs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <SectionCard title="Developer Focus" icon={TimerReset}>
      {recentBugs.length ? (
        <div className="space-y-3">
          <div className="space-y-2">
            {paginated.map((bug) => (
              <Link
                key={bug.id}
                to="/bugs/$id"
                params={{ id: String(bug.id) }}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{bug.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {bug.bug_id} · {bug.module}
                  </p>
                </div>
                <Badge variant="outline">{bug.status}</Badge>
              </Link>
            ))}
          </div>
          <DashboardPagination
            page={page}
            totalItems={recentBugs.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            itemLabel="tasks"
          />
        </div>
      ) : (
        <EmptyPanel
          title="No assigned errors"
          detail="Assigned errors appear here with timer access from their details page."
        />
      )}
    </SectionCard>
  );
}

export function RoleDashboardPanels({
  role,
  recentBugs,
}: {
  role: string;
  recentBugs: BugListRow[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ResolutionAnalyticsPanel role={role} />
      {role === "developer" ? <DeveloperFocusPanel recentBugs={recentBugs} /> : <HelpDeskPanel />}
      <LiveNotificationFeed />
      {role === "developer" && <HelpDeskPanel />}
    </div>
  );
}
