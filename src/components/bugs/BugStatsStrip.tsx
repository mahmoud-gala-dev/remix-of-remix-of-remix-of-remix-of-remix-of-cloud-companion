import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  MessageSquare,
  Paperclip,
  PieChart as PieIcon,
} from "lucide-react";
import { fetchDashboardStats, statusTone, type Bug } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import type { Attachment, Comment } from "@/lib/api";

/**
 * Bug statistics strip displaying:
 * 1. Bug details tiles (Age, Status, Comments, Attachments)
 * 2. Open vs Resolved mini-data panel (numerical breakdown of Open vs Resolved bugs)
 */
export function BugStatsStrip({ bug }: { bug: Bug }) {
  // Re-use cached queries that BugComments and BugAttachments already populate
  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: ["comments", bug.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("comments").select("id").eq("bug_id", bug.id);
      if (error) throw error;
      return data as Comment[];
    },
    staleTime: 60_000,
  });

  const { data: attachments = [] } = useQuery<Attachment[]>({
    queryKey: ["attachments", bug.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("attachments").select("id").eq("bug_id", bug.id);
      if (error) throw error;
      return data as Attachment[];
    },
    staleTime: 60_000,
  });

  // Query global/project dashboard stats for Open vs Resolved comparison
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", "all"],
    queryFn: () => fetchDashboardStats("all"),
    staleTime: 60_000,
  });

  const ageDays = useMemo(
    () => differenceInDays(new Date(), new Date(bug.created_at)),
    [bug.created_at],
  );

  const ageLabel = ageDays === 0 ? "Today" : ageDays === 1 ? "1 day" : `${ageDays} days`;

  // Compute Open vs Resolved numerical counts using useMemo
  const openVsResolved = useMemo(() => {
    if (!stats) return { open: 0, resolved: 0, total: 0, percentResolved: 0 };
    const byStatus = stats.by_status ?? {};
    const open =
      (byStatus["Open"] ?? 0) + (byStatus["In Progress"] ?? 0) + (byStatus["Reopened"] ?? 0);
    const resolved = (byStatus["Fixed"] ?? 0) + (byStatus["Closed"] ?? 0);
    const total = open + resolved;
    const percentResolved = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { open, resolved, total, percentResolved };
  }, [stats]);

  return (
    <div className="space-y-3">
      {/* 4 Mini KPI Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Age */}
        <StatTile
          icon={<CalendarDays className="h-4 w-4 text-muted-foreground" />}
          label="Age"
          value={ageLabel}
          sub={ageDays === 0 ? "opened today" : "since opened"}
        />

        {/* Status */}
        <StatTile
          icon={
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusDot(bug.status)}`} />
          }
          label="Status"
          value={
            <Badge variant="outline" className={`${statusTone(bug.status)} text-xs font-semibold`}>
              {bug.status}
            </Badge>
          }
        />

        {/* Comments */}
        <StatTile
          icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
          label="Comments"
          value={comments.length}
          sub={comments.length === 1 ? "comment" : "comments"}
        />

        {/* Attachments */}
        <StatTile
          icon={<Paperclip className="h-4 w-4 text-muted-foreground" />}
          label="Attachments"
          value={attachments.length}
          sub={attachments.length === 1 ? "file" : "files"}
        />
      </div>

      {/* Mini Data Panel: Open vs Resolved Bugs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3.5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <PieIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Workspace Defect Overview</p>
            <p className="text-[11px] text-muted-foreground">Open vs Resolved defect ratio</p>
          </div>
        </div>

        <div className="flex-1 max-w-xs space-y-1">
          <div className="flex justify-between text-xs font-medium">
            <span className="flex items-center gap-1 text-destructive">
              <CircleDashed className="h-3 w-3" /> Open: <strong>{openVsResolved.open}</strong>
            </span>
            <span className="flex items-center gap-1 text-success">
              <CheckCircle2 className="h-3 w-3" /> Resolved:{" "}
              <strong>{openVsResolved.resolved}</strong>
            </span>
          </div>
          <Progress value={openVsResolved.percentResolved} className="h-2" />
        </div>

        <div className="text-end shrink-0">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-success bg-success/15 px-2.5 py-1 rounded-full border border-success/30">
            {openVsResolved.percentResolved}% Resolved
          </span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Internal helper components                                                   */
/* -------------------------------------------------------------------------- */

function StatTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5 text-sm font-bold text-foreground leading-tight">{value}</div>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function statusDot(status: string) {
  switch (status) {
    case "Open":
      return "bg-destructive animate-pulse";
    case "In Progress":
      return "bg-info animate-pulse";
    case "Fixed":
    case "Done":
      return "bg-success";
    case "Reopened":
      return "bg-warning animate-pulse";
    default:
      return "bg-muted-foreground";
  }
}
