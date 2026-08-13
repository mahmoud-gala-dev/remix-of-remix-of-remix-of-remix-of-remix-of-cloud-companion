import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SlaBadge } from "@/components/bugs/SlaBadge";
import { priorityTone, statusTone, type BugListRow } from "@/lib/api";

/**
 * Card view of the bug list: same rows and pagination as the table, but a
 * denser, scannable grid for wide screens and touch devices.
 */
export function BugCardGrid({
  rows,
  isLoading,
  profileMap,
  projectMap,
  emptyMessage,
}: {
  rows: BugListRow[];
  isLoading: boolean;
  profileMap: Map<string, string>;
  projectMap: Map<number, string>;
  emptyMessage: string;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-xl" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((bug) => (
        <article
          key={bug.id}
          className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 transition-shadow hover:shadow-md"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">{bug.bug_id}</span>
            <Badge variant="outline" className={statusTone(bug.status)}>
              {bug.status}
            </Badge>
          </div>
          <Link
            to="/bugs/$id"
            params={{ id: String(bug.id) }}
            className="line-clamp-2 text-sm font-medium hover:underline"
          >
            {bug.title}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {bug.module}
            {bug.project_id ? ` · ${projectMap.get(bug.project_id) ?? "—"}` : ""}
          </p>
          <SlaBadge bug={bug} />
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <Badge variant="outline" className={priorityTone(bug.priority)}>
              {bug.priority}
            </Badge>
            <span className="truncate text-[11px] text-muted-foreground">
              {bug.assigned_to ? (profileMap.get(bug.assigned_to) ?? "—") : "Unassigned"}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

export default BugCardGrid;
