import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { BUG_STATUSES, friendlyDbError, priorityTone, type BugListRow } from "@/lib/api";
import { canChangeBugStatus } from "@/lib/permissions";
import { SlaBadge } from "@/components/bugs/SlaBadge";
import { cn } from "@/lib/utils";

type BoardUser = { id?: string | null; role?: string | null } | null | undefined;

/**
 * Drag-and-drop board grouping the currently visible bugs by status.
 * A card can only be moved when the signed-in user may change that bug's status.
 */
export function BugKanbanBoard({
  rows,
  isLoading,
  user,
  profileMap,
}: {
  rows: BugListRow[];
  isLoading: boolean;
  user: BoardUser;
  profileMap: Map<string, string>;
}) {
  const queryClient = useQueryClient();
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overStatus, setOverStatus] = useState<string | null>(null);

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const { error } = await supabase
        .from("bugs")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(friendlyDbError(error));
    },
    onSuccess: (_data, variables) => {
      toast.success(`Moved to ${variables.status}`);
      queryClient.invalidateQueries({ queryKey: ["bugs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const drop = (status: string, transferred: string | null) => {
    setOverStatus(null);
    const parsed = transferred ? Number(transferred) : Number.NaN;
    const id = Number.isFinite(parsed) ? parsed : draggingId;
    setDraggingId(null);
    if (id === null || id === undefined || Number.isNaN(id)) return;
    const bug = rows.find((row) => row.id === id);
    if (!bug || bug.status === status) return;
    if (!canChangeBugStatus(bug, user)) {
      toast.error("You cannot change the status of this bug.");
      return;
    }
    move.mutate({ id, status });
  };


  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {BUG_STATUSES.map((status) => (
          <Skeleton key={status} className="h-64 rounded-xl" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No bugs to show on the board. Adjust your filters or report a new bug.
      </p>
    );
  }

  return (
    <div className="grid select-none gap-3 md:grid-cols-3 xl:grid-cols-5">
      {BUG_STATUSES.map((status) => {
        const columnRows = rows.filter((row) => row.status === status);
        return (
          <section
            key={status}
            aria-label={`${status} column`}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setOverStatus(status);
            }}
            onDragEnter={(event) => event.preventDefault()}
            onDragLeave={() => setOverStatus((current) => (current === status ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              drop(status, event.dataTransfer.getData("text/plain") || null);
            }}

            className={cn(
              "flex min-h-[220px] flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-2.5 transition-colors",
              overStatus === status && "border-primary/60 bg-primary/5",
            )}
          >
            <header className="flex items-center justify-between px-1 pb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {status}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {columnRows.length}
              </Badge>
            </header>

            {columnRows.length === 0 ? (
              <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                Drop a bug here
              </p>
            ) : (
              columnRows.map((bug) => {
                const editable = canChangeBugStatus(bug, user);
                return (
                  <article
                    key={bug.id}
                    draggable={editable}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", String(bug.id));
                      event.dataTransfer.effectAllowed = "move";
                      setDraggingId(bug.id);
                    }}

                    onDragEnd={() => setDraggingId(null)}
                    className={cn(
                      "rounded-lg border border-border/60 bg-card p-2.5 shadow-sm transition-opacity",
                      editable ? "cursor-grab active:cursor-grabbing" : "opacity-80",
                      draggingId === bug.id && "opacity-50",
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {bug.bug_id}
                      </span>
                      {editable && (
                        <GripVertical
                          className="h-3.5 w-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <Link
                      to="/bugs/$id"
                      params={{ id: String(bug.id) }}
                      className="line-clamp-2 text-sm font-medium hover:underline"
                    >
                      {bug.title}
                    </Link>
                    <div className="mt-1.5">
                      <SlaBadge bug={bug} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Badge variant="outline" className={priorityTone(bug.priority)}>
                        {bug.priority}
                      </Badge>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {bug.assigned_to ? (profileMap.get(bug.assigned_to) ?? "—") : "Unassigned"}
                      </span>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        );
      })}
    </div>
  );
}
