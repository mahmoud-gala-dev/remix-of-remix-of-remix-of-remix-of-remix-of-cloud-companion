import { Link } from "@tanstack/react-router";

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
import { priorityTone, type BugListRow } from "@/lib/api";
import type { TranslationKey } from "@/lib/i18n";
import { canChangeBugStatus } from "@/lib/permissions";
import { BugQuickStatus } from "@/components/bugs/BugQuickStatus";
import { SlaBadge } from "@/components/bugs/SlaBadge";

type TableUser = { id?: string | null; role?: string | null } | null | undefined;

/** Desktop table + mobile card list for the bug list view. */
export function BugTable({
  rows,
  isLoading,
  user,
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
  profileMap: Map<string, string>;
  projectMap: Map<number, string>;
  selectedIds: number[];
  onToggleSelected: (id: number, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  emptyMessage: string;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const selectableRows = rows.filter((bug) => canChangeBugStatus(bug, user));
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
              <TableHead>{t("bugs.col.assignee")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((bug) => (
              <TableRow key={bug.id} className="cursor-pointer">
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(bug.id)}
                    disabled={!canChangeBugStatus(bug, user)}
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
                      className="truncate hover:underline"
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
                    canEdit={canChangeBugStatus(bug, user)}
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
                <TableCell>
                  {bug.assigned_to ? (profileMap.get(bug.assigned_to) ?? "—") : t("bugs.unassigned")}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list — app-like rows instead of a horizontal table */}
      <ul className="space-y-3 md:hidden">
        {rows.map((bug) => (
          <li key={bug.id} className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <Checkbox
                checked={selectedIds.includes(bug.id)}
                disabled={!canChangeBugStatus(bug, user)}
                onCheckedChange={(checked) => onToggleSelected(bug.id, checked === true)}
                aria-label={t("bugs.selectOne", { id: bug.bug_id })}
              />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t("bugs.bulkSelect")}
              </span>
            </div>
            <Link
              to="/bugs/$id"
              params={{ id: String(bug.id) }}
              className="block space-y-1.5 active:opacity-70"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">{bug.bug_id}</span>
                <Badge variant="outline" className={priorityTone(bug.priority)}>
                  {bug.priority}
                </Badge>
              </div>
              <div className="flex items-start gap-2">
                <p className="line-clamp-2 text-sm font-medium">{bug.title}</p>
                <SlaBadge bug={bug} />
              </div>
              <p className="text-xs text-muted-foreground">
                {bug.module} ·{" "}
                {bug.assigned_to ? (profileMap.get(bug.assigned_to) ?? "—") : t("bugs.unassigned")}
              </p>
            </Link>
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <BugQuickStatus
                bugId={bug.id}
                status={bug.status}
                canEdit={canChangeBugStatus(bug, user)}
              />
              <Badge variant="outline" className={priorityTone(bug.severity)}>
                {bug.severity}
              </Badge>
            </div>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="py-10 text-center text-sm text-muted-foreground">{emptyMessage}</li>
        )}
      </ul>
    </>
  );
}
