import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { friendlyDbError, priorityTone, type BugListRow, type Profile } from "@/lib/api";
import type { TranslationKey } from "@/lib/i18n";
import { canAssignBug, canChangeBugStatus } from "@/lib/permissions";
import { BugQuickStatus } from "@/components/bugs/BugQuickStatus";
import { AssigneeSelect } from "@/components/bugs/AssigneeSelect";
import { SlaBadge } from "@/components/bugs/SlaBadge";

type TableUser = { id?: string | null; role?: string | null } | null | undefined;

/** Desktop table + mobile card list for the bug list view. */
export function BugTable({
  rows,
  isLoading,
  user,
  profiles = [],
  profileMap,
  projectMap,
  selectedIds,
  onToggleSelected,
  onToggleAll,
  emptyMessage,
  t,
}: {
  rows: BugListRow[];
  isLoading: boolean;
  user: TableUser;
  profiles?: Profile[] | undefined;
  profileMap: Map<string, string>;
  projectMap: Map<number, string>;
  selectedIds: number[];
  onToggleSelected: (id: number, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  emptyMessage: string;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  const queryClient = useQueryClient();

  const assignMutation = useMutation({
    mutationFn: async ({ bugId, assigneeId }: { bugId: number; assigneeId: string | null }) => {
      const { error } = await supabase
        .from("bugs")
        .update({ assigned_to: assigneeId, updated_at: new Date().toISOString() })
        .eq("id", bugId);
      if (error) throw new Error(friendlyDbError(error));
    },
    onSuccess: () => {
      toast.success("Assignee updated");
      queryClient.invalidateQueries({ queryKey: ["bugs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["report-bugs"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const selectableRows = rows.filter(
    (bug) => canChangeBugStatus(bug, user) || canAssignBug(bug, user),
  );
  const allSelected =
    selectableRows.length > 0 && selectableRows.every((bug) => selectedIds.includes(bug.id));


  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => onToggleAll(checked === true)}
                  aria-label={t("bugs.selectAll")}
                />
              </TableHead>
              <TableHead>{t("bugs.col.id")}</TableHead>
              <TableHead>{t("bugs.col.title")}</TableHead>
              <TableHead>{t("bugs.col.module")}</TableHead>
              <TableHead>{t("bugs.col.status")}</TableHead>
              <TableHead>{t("bugs.col.priority")}</TableHead>
              <TableHead>{t("bugs.col.severity")}</TableHead>
              <TableHead>{t("bugs.col.project")}</TableHead>
              <TableHead>{t("bugs.col.reportedBy")}</TableHead>
              <TableHead>{t("bugs.col.assignee")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((bug) => {
              const canAssign = canAssignBug(bug, user);
              const canChangeStatus = canChangeBugStatus(bug, user);
              return (
                <TableRow key={bug.id} className="cursor-pointer">
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(bug.id)}
                      disabled={!canChangeStatus && !canAssign}
                      onCheckedChange={(checked) => onToggleSelected(bug.id, checked === true)}
                      aria-label={t("bugs.selectOne", { id: bug.bug_id })}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link to="/bugs/$id" params={{ id: String(bug.id) }} className="hover:underline">
                      {bug.bug_id}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <div className="flex items-center gap-2">
                      <Link
                        to="/bugs/$id"
                        params={{ id: String(bug.id) }}
                        className="truncate hover:underline font-medium"
                      >
                        {bug.title}
                      </Link>
                      <SlaBadge bug={bug} />
                    </div>
                  </TableCell>
                  <TableCell>{bug.module}</TableCell>
                  <TableCell>
                    <BugQuickStatus
                      bugId={bug.id}
                      status={bug.status}
                      canEdit={canChangeStatus}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={priorityTone(bug.priority)}>
                      {bug.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={priorityTone(bug.severity)}>
                      {bug.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>{bug.project_id ? (projectMap.get(bug.project_id) ?? "—") : "—"}</TableCell>
                  <TableCell className="text-sm">
                    <span className="font-medium text-foreground">
                      {bug.reported_by ? (profileMap.get(bug.reported_by) ?? t("common.someone")) : t("common.someone")}
                    </span>
                  </TableCell>
                  <TableCell className="min-w-[160px]">
                    {canAssign && profiles.length > 0 ? (
                      <AssigneeSelect
                        profiles={profiles}
                        value={bug.assigned_to}
                        size="sm"
                        disabled={assignMutation.isPending}
                        onChange={(next) =>
                          assignMutation.mutate({ bugId: bug.id, assigneeId: next })
                        }
                      />
                    ) : (
                      <span className="text-sm">
                        {bug.assigned_to
                          ? (profileMap.get(bug.assigned_to) ?? t("bugs.unassigned"))
                          : t("bugs.unassigned")}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list — app-like rows instead of a horizontal table */}
      <ul className="space-y-3 md:hidden">
        {rows.map((bug) => {
          const canAssign = canAssignBug(bug, user);
          const canChangeStatus = canChangeBugStatus(bug, user);
          return (
            <li key={bug.id} className="rounded-xl border border-border/60 bg-card p-3.5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <Checkbox
                  checked={selectedIds.includes(bug.id)}
                  disabled={!canChangeStatus && !canAssign}
                  onCheckedChange={(checked) => onToggleSelected(bug.id, checked === true)}
                  aria-label={t("bugs.selectOne", { id: bug.bug_id })}
                />
                <span className="font-mono text-xs text-muted-foreground">{bug.bug_id}</span>
              </div>
              <Link
                to="/bugs/$id"
                params={{ id: String(bug.id) }}
                className="block space-y-1.5 active:opacity-70"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-medium">{bug.title}</p>
                  <SlaBadge bug={bug} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {bug.module}
                  {bug.project_id ? ` · ${projectMap.get(bug.project_id) ?? "—"}` : ""}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("bugs.col.reportedBy")}: <strong className="text-foreground">{bug.reported_by ? (profileMap.get(bug.reported_by) ?? t("common.someone")) : t("common.someone")}</strong>
                </p>
              </Link>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
                <BugQuickStatus
                  bugId={bug.id}
                  status={bug.status}
                  canEdit={canChangeStatus}
                />
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className={priorityTone(bug.priority)}>
                    {bug.priority}
                  </Badge>
                  <Badge variant="outline" className={priorityTone(bug.severity)}>
                    {bug.severity}
                  </Badge>
                </div>
              </div>
              {canAssign && profiles.length > 0 ? (
                <div className="pt-1">
                  <AssigneeSelect
                    profiles={profiles}
                    value={bug.assigned_to}
                    size="sm"
                    disabled={assignMutation.isPending}
                    onChange={(next) =>
                      assignMutation.mutate({ bugId: bug.id, assigneeId: next })
                    }
                  />
                </div>
              ) : null}
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="py-10 text-center text-sm text-muted-foreground">{emptyMessage}</li>
        )}
      </ul>
    </>
  );
}
