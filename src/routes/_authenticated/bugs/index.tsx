import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  FileUp,
  KanbanSquare,
  LayoutGrid,

  List,
  Plus,
  FileSpreadsheet,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchBugsPage,
  fetchBugModules,
  fetchProjects,
  fetchProfiles,
  BUG_STATUSES,
  friendlyDbError,
} from "@/lib/api";
import {
  generateBugId,
  normalizePriority,
  normalizeSeverity,
  normalizeStatus,
  validateAndParseBugImportRows,
} from "@/lib/bug-import";

import { datedCsvFilename, downloadCsv, toCsv } from "@/lib/csv-export";
import { downloadBugImportTemplate, downloadBugsExcel } from "@/lib/bug-excel";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { canAssignBug, canChangeBugStatus, canReportBugs, canViewBug } from "@/lib/permissions";
import { BugKanbanBoard } from "@/components/bugs/BugKanbanBoard";
import { BugCardGrid } from "@/components/bugs/BugCardGrid";
import { useActiveProfiles } from "@/hooks/useActiveProfiles";
import { useBulkAssign, BULK_UNASSIGNED } from "@/hooks/useBulkAssign";

import { BugStatsDashboard } from "@/components/bugs/BugStatsDashboard";
import {
  BugFilters,
  EMPTY_BUG_FILTERS,
  hasActiveBugFilters,
  type BugFilterState,
} from "@/components/bugs/BugFilters";
import { BugTable } from "@/components/bugs/BugTable";
import {
  BugImportDialog,
  BugImportProgress,
  type ImportFailure,
  type ImportReport,
} from "@/components/bugs/BugImportDialog";
import { slaSummary } from "@/lib/sla";
import {
  deleteSavedFilter,
  readSavedFilters,
  saveFilter,
  type SavedFilter,
} from "@/lib/saved-filters";
import { writeBugNavFilters } from "@/lib/bug-nav";
import {
  filterStateToSearch,
  parseBugsSearch,
  searchToFilterState,
  type BugsSearch,
  type BugsView,

} from "@/lib/bug-filter-url";

export const Route = createFileRoute("/_authenticated/bugs/")({
  validateSearch: (search: Record<string, unknown>): BugsSearch => parseBugsSearch(search),
  // Default values stay out of the URL so shared links only carry real filters.
  search: {
    middlewares: [
      stripSearchParams({
        q: "",
        module: "All",
        status: "All",
        priority: "All",
        severity: "All",
        project: "All",
        assignee: "All",
        page: 1,
        view: "table" as const,
      }),
    ],
  },
  head: () => ({
    meta: [
      { title: "Bugs | ElectroPI Bug Tracker" },
      {
        name: "description",
        content: "Browse, search and filter every reported bug in ElectroPI.",
      },
      { property: "og:title", content: "Bugs | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "Browse, search and filter every reported bug in ElectroPI.",
      },
    ],
  }),
  component: BugsPage,
  errorComponent: ({ error }: { error: Error }) => (
    <p className="p-6 text-sm text-destructive">Could not load bugs: {error.message}</p>
  ),
  notFoundComponent: () => <p className="p-6 text-sm text-muted-foreground">Page not found.</p>,
});

/** Delays a fast-changing value so typing does not fire a query per keystroke. */
function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const PAGE_SIZE = 25;
const BUG_FILTERS_KEY = "electropi.saved.bug_filters";

function BugsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/bugs/" });
  const { user } = useAuth();
  const search = parseBugsSearch(Route.useSearch() as Record<string, unknown>);

  /* Filters live in the URL, so any list view can be copied and shared as a link. */
  const filterState = useMemo(() => searchToFilterState(search), [search]);
  const page = search.page;
  const view = search.view;

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [showStats, setShowStats] = useState(true);
  const [showMineOnly, setShowMineOnly] = useState(false);
  const [savedFilterName, setSavedFilterName] = useState("");
  const [savedFilters, setSavedFilters] = useState<SavedFilter<BugFilterState>[]>(() =>
    readSavedFilters<BugFilterState>(BUG_FILTERS_KEY),
  );
  // Bulk-status remains in local state (separate from bulk-assign hook)
  const [bulkStatus, setBulkStatus] = useState("Open");
  /** Target project for spreadsheet imports started from this page. */
  const [importProject, setImportProject] = useState("All");
  const [purgeMode, setPurgeMode] = useState<"all" | "completed" | "project" | null>(null);
  const [purgeProject, setPurgeProject] = useState("All");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pushSearch = useCallback(
    (next: BugFilterState, extra: { page: number; view: BugsView }) => {
      navigate({
        search: filterStateToSearch(next, extra) as never,
        replace: true,
      });
    },
    [navigate],
  );

  const handleFilterChange = useCallback(
    (patch: Partial<BugFilterState>) => {
      pushSearch({ ...filterState, ...patch }, { page: 1, view });
    },
    [filterState, pushSearch, view],
  );

  const resetFilters = useCallback(() => {
    pushSearch(EMPTY_BUG_FILTERS, { page: 1, view });
  }, [pushSearch, view]);

  const setPage = useCallback(
    (nextPage: number) => pushSearch(filterState, { page: nextPage, view }),
    [filterState, pushSearch, view],
  );

  const setView = useCallback(
    (nextView: BugsView) => pushSearch(filterState, { page, view: nextView }),
    [filterState, page, pushSearch],
  );

  const debouncedSearch = useDebounced(filterState.search);

  const filters = useMemo(
    () => ({
      status: filterState.status,
      priority: filterState.priority,
      severity: filterState.severity,
      module: filterState.module,
      project: filterState.project,
      // When "My bugs" toggle is on, override the assignee with the current user.
      assignee: showMineOnly && user?.id ? user.id : filterState.assignee,
      search: debouncedSearch,
    }),
    [filterState, debouncedSearch, showMineOnly, user?.id],
  );

  /* Keep detail-page next/previous in sync with the filters shown here. */
  useEffect(() => {
    writeBugNavFilters(filters);
  }, [filters]);

  const {
    data: bugPage,
    isLoading,
    isFetching,
    error: bugsError,
  } = useQuery({
    queryKey: ["bugs", "page", page, filters],
    queryFn: () => fetchBugsPage({ page, pageSize: PAGE_SIZE, filters }),
    placeholderData: (prev) => prev,
  });

  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const { data: profiles } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const { data: modules = [] } = useQuery({
    queryKey: ["bug-modules"],
    queryFn: fetchBugModules,
  });

  const rawRows = bugPage?.rows;
  const rows = useMemo(
    () => (rawRows ?? []).filter((bug) => canViewBug(bug, user)),
    [rawRows, user],
  );
  /** Server-side match count so paging reflects all pages, not just this one. */
  const totalCount = bugPage?.count ?? rows.length;
  const aging = useMemo(() => slaSummary(rows), [rows]);

  // ── Bulk assign ──────────────────────────────────────────────────────────
  const visibleBugIds = useMemo(() => rows.map((bug) => bug.id), [rows]);
  const bulkAssign = useBulkAssign({ visibleIds: visibleBugIds });

  // Keep selection in sync when the visible row set changes (page turns, filters).
  useEffect(() => {
    bulkAssign.pruneToVisible();
    // pruneToVisible is stable — only visibleBugIds changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleBugIds]);

  // Active profiles for all assignment dropdowns (excludes deactivated accounts).
  const activeProfiles = useActiveProfiles(profiles);

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    (profiles ?? []).forEach((p) => map.set(p.id, p.username));
    return map;
  }, [profiles]);

  const projectMap = useMemo(() => {
    const map = new Map<number, string>();
    (projects ?? []).forEach((p) => map.set(p.id, p.name));
    return map;
  }, [projects]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const hasActiveFilters = hasActiveBugFilters(filterState);

  const canReport = canReportBugs(user?.role);
  const isAdmin = user?.role === "admin";

  /** Admin-only bulk cleanup: every bug, only the finished ones, or one project. */
  const purgeMutation = useMutation({
    mutationFn: async () => {
      let query = supabase.from("bugs").delete();
      if (purgeMode === "completed") {
        query = query.in("status", ["Fixed", "Closed"]);
      } else if (purgeMode === "project") {
        if (purgeProject === "All") throw new Error("Pick a project first.");
        query = query.eq("project_id", Number(purgeProject));
      } else {
        query = query.gt("id", 0);
      }
      const { error } = await query;
      if (error) throw new Error(friendlyDbError(error));
    },
    onSuccess: () => {
      setPurgeMode(null);
      bulkAssign.clearSelection();
      queryClient.invalidateQueries({ queryKey: ["bugs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Bugs deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const selectableRows = useMemo(
    () => rows.filter((bug) => canChangeBugStatus(bug, user) || canAssignBug(bug, user)),
    [rows, user],
  );

  const applySavedFilter = useCallback(
    (filter: SavedFilter<BugFilterState>) => {
      pushSearch({ ...EMPTY_BUG_FILTERS, ...filter.value }, { page: 1, view });
    },
    [pushSearch, view],
  );

  const handleSaveFilter = useCallback(() => {
    const name = savedFilterName.trim();
    if (!name) {
      toast.error("Name the filter before saving it.");
      return;
    }
    const next = saveFilter(BUG_FILTERS_KEY, name, filterState);
    setSavedFilters([next, ...savedFilters.filter((item) => item.name !== next.name)].slice(0, 12));
    setSavedFilterName("");
    toast.success("Filter saved");
  }, [filterState, savedFilterName, savedFilters]);

  const handleDeleteSavedFilter = useCallback((id: string) => {
    setSavedFilters(deleteSavedFilter<BugFilterState>(BUG_FILTERS_KEY, id));
  }, []);

  /**
   * Bulk-status update (separate from bulk-assign): updates the status field of
   * all selected bugs in one go. Keeps parity with the old bulkUpdateMutation
   * behaviour while assignment is now delegated to useBulkAssign.
   */
  const bulkStatusMutation = useMutation({
    mutationFn: async () => {
      if (!bulkAssign.selectedIds.length) return;
      const payload = {
        status: bulkStatus,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("bugs")
        .update(payload)
        .in("id", bulkAssign.selectedIds);
      if (error) throw new Error(friendlyDbError(error));
    },
    onSuccess: () => {
      toast.success("Bulk status applied", {
        description: `Updated ${bulkAssign.selectionCount} bug${
          bulkAssign.selectionCount === 1 ? "" : "s"
        }.`,
      });
      bulkAssign.clearSelection();
      void queryClient.invalidateQueries({ queryKey: ["bugs"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["report-bugs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const exportVisibleRows = useCallback(() => {
    const csv = toCsv(rows, [
      { header: "Bug ID", value: (bug) => bug.bug_id },
      { header: "Title", value: (bug) => bug.title },
      { header: "Module", value: (bug) => bug.module },
      { header: "Status", value: (bug) => bug.status },
      { header: "Priority", value: (bug) => bug.priority },
      { header: "Severity", value: (bug) => bug.severity },
      { header: "Project", value: (bug) => (bug.project_id ? projectMap.get(bug.project_id) : "") },
      {
        header: "Assignee",
        value: (bug) => (bug.assigned_to ? profileMap.get(bug.assigned_to) : "Unassigned"),
      },
      { header: "Created At", value: (bug) => bug.created_at },
    ]);
    downloadCsv(datedCsvFilename("bugs-current-view"), csv);
    toast.success("CSV exported", { description: `Exported ${rows.length} visible bugs.` });
  }, [rows, projectMap, profileMap]);

  /** Exports the visible rows as .xlsx (same columns as the list view). */
  const exportVisibleExcel = useCallback(async () => {
    const headers = [
      "Bug ID",
      "Title",
      "Module",
      "Status",
      "Priority",
      "Severity",
      "Project",
      "Assignee",
      "Created At",
    ];
    const data = rows.map((bug) => [
      bug.bug_id,
      bug.title,
      bug.module,
      bug.status,
      bug.priority,
      bug.severity,
      bug.project_id ? (projectMap.get(bug.project_id) ?? "") : "",
      bug.assigned_to ? (profileMap.get(bug.assigned_to) ?? "") : "",
      bug.created_at,
    ]);
    try {
      await downloadBugsExcel(data, headers, `${datedCsvFilename("bugs")}.xlsx`);
      toast.success(t("bugs.toast.excel"), {
        description: t("bugs.toast.excelDesc", { count: rows.length }),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    }
  }, [rows, projectMap, profileMap, t]);

  const downloadTemplate = useCallback(async () => {
    try {
      await downloadBugImportTemplate();
      toast.success(t("bugs.toast.template"), { description: t("bugs.toast.templateDesc") });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    }
  }, [t]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setImporting(true);
        const bstr = evt.target?.result;
        // Loaded on demand so the ~700 kB spreadsheet parser stays out of the initial bundle.
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(bstr, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("Empty workbook");
        const worksheet = workbook.Sheets[sheetName]!;
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
        const validation = validateAndParseBugImportRows(rawData);
        if (validation.missingHeaders.length > 0) {
          throw new Error(
            `${t("bugs.import.headerError")} ${t("bugs.import.missingHeaders", { headers: validation.missingHeaders.join(", ") })}`,
          );
        }
        const parsedRows = validation.rows;

        const { data: existing, error: existingError } = await supabase
          .from("bugs")
          .select("id,bug_id")
          .limit(5000);
        if (existingError) throw existingError;
        const existingIds = new Map((existing ?? []).map((bug) => [bug.bug_id, bug.id]));
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        let imported = 0;
        let duplicates = 0;
        const failures: ImportFailure[] = [];
        setImportProgress({ current: 0, total: parsedRows.length });
        for (const [index, row] of parsedRows.entries()) {
          setImportProgress({ current: index + 1, total: parsedRows.length });
          if (!row.title.trim()) {
            failures.push({
              excelRowNumber: row.excelRowNumber,
              bugId: row.bug_id,
              reason: t("bugs.import.emptyTitle"),
            });
            continue;
          }
          // Sheets without a Bug ID column get one generated automatically.
          if (!row.bug_id.trim()) {
            row.bug_id = generateBugId(index + 1, new Set(existingIds.keys()));
          }

          const existingBugId = existingIds.get(row.bug_id);
          if (existingBugId) {
            duplicates++;
            failures.push({
              excelRowNumber: row.excelRowNumber,
              bugId: row.bug_id,
              reason: t("bugs.import.duplicate"),
              existingBugId,
            });
            continue;
          }
          const { data: created, error } = await supabase
            .from("bugs")
            .insert({
              bug_id: row.bug_id,
              module: row.module || "General",
              title: row.title,
              steps: row.steps || null,
              environment: row.environment || null,
              expected_result: row.expected_result || null,
              actual_result: row.actual_result || null,
              priority: normalizePriority(row.priority),
              severity: normalizeSeverity(row.severity),
              status: normalizeStatus(row.status),
              retest: row.retest || null,
              role: row.role || null,
              notes: row.notes || null,
              project_id:
                importProject !== "All"
                  ? Number(importProject)
                  : filterState.project !== "All"
                    ? Number(filterState.project)
                    : null,
              reported_by: authUser?.id ?? null,
            })
            .select("id")
            .single();
          if (error) {
            failures.push({
              excelRowNumber: row.excelRowNumber,
              bugId: row.bug_id,
              reason: friendlyDbError(error),
            });
          } else {
            if (created) existingIds.set(row.bug_id, created.id);
            imported++;
          }
        }

        setImportReport({
          filename: file.name,
          imported,
          failures,
          skippedEmpty: validation.skippedEmpty,
          duplicates,
        });
        if (validation.skippedEmpty > 0) {
          toast.warning(t("bugs.import.skippedEmpty", { count: validation.skippedEmpty }));
        }
        if (duplicates > 0) {
          toast.error(
            imported === 0
              ? t("bugs.import.allDuplicates")
              : t("bugs.import.duplicateToast", { count: duplicates }),
          );
        }
        toast.success(t("bugs.import.reportTitle"), {
          description: t("bugs.import.reportDescription", { imported, failed: failures.length }),
        });
        queryClient.invalidateQueries({ queryKey: ["bugs"] });
        queryClient.invalidateQueries({ queryKey: ["bug-modules"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      } catch (err) {
        toast.error("Import failed", {
          description: err instanceof Error ? err.message : "Failed to parse Excel file.",
        });
      } finally {
        setImporting(false);
        setImportProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex flex-col gap-6">

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-card via-card/80 to-primary/5 px-6 py-5 shadow-sm">
        {/* Decorative blur blob */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Title + count */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("bugs.title")}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isLoading ? t("common.loading") : t("bugs.summary", { count: totalCount })}
            </p>
          </div>

          {/* Primary action */}
          {canReport && (
            <Button size="sm" asChild className="shrink-0 shadow-sm">
              <Link to="/bugs/new">
                <Plus className="me-2 h-4 w-4" />
                {t("bugs.new")}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">

        {/* Left group: view switcher + quick filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View switcher */}
          <div
            className="inline-flex rounded-lg border border-border bg-card p-0.5 shadow-sm"
            role="group"
            aria-label={t("bugs.view")}
          >
            <Button
              variant={view === "table" ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
              className="h-7 px-3 text-xs"
            >
              <List className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t("bugs.view.list")}
            </Button>
            <Button
              variant={view === "board" ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={view === "board"}
              onClick={() => setView("board")}
              className="h-7 px-3 text-xs"
            >
              <KanbanSquare className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t("bugs.view.board")}
            </Button>
            <Button
              variant={view === "cards" ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={view === "cards"}
              onClick={() => setView("cards")}
              className="h-7 px-3 text-xs"
            >
              <LayoutGrid className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Cards
            </Button>
          </div>

          {/* Separator */}
          <div className="h-6 w-px bg-border" aria-hidden="true" />

          {/* My Bugs toggle */}
          <Button
            variant={showMineOnly ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowMineOnly((v) => !v)}
            className={`h-8 text-xs ${
              showMineOnly ? "border border-primary/30 bg-primary/10 text-primary" : "text-muted-foreground"
            }`}
            aria-pressed={showMineOnly}
          >
            <User className="me-1.5 h-3.5 w-3.5" />
            {showMineOnly ? t("bugs.filter.all") : t("bugs.filter.mine")}
          </Button>

          {/* Stats toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowStats((v) => !v)}
            className="h-8 text-xs text-muted-foreground"
          >
            {showStats ? (
              <><ChevronUp className="me-1.5 h-3.5 w-3.5" />{t("bugs.hideStats")}</>
            ) : (
              <><ChevronDown className="me-1.5 h-3.5 w-3.5" />{t("bugs.showStats")}</>
            )}
          </Button>
        </div>

        {/* Right group: import / export / destructive */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportVisibleRows}
            disabled={isLoading || rows.length === 0}
          >
            <Download className="me-1.5 h-3.5 w-3.5" />
            {t("bugs.exportCsv")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void exportVisibleExcel()}
            disabled={isLoading || rows.length === 0}
          >
            <FileSpreadsheet className="me-1.5 h-3.5 w-3.5" />
            {t("bugs.exportExcel")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void downloadTemplate()}>
            <Download className="me-1.5 h-3.5 w-3.5" />
            {t("bugs.template")}
          </Button>

          {/* Separator */}
          <div className="h-6 w-px bg-border" aria-hidden="true" />

          {/* Project picker + upload */}
          <div className="flex items-center gap-1.5">
            <Select value={importProject} onValueChange={setImportProject}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">No project</SelectItem>
                {(projects ?? []).map((project) => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="cursor-pointer">
              <Button variant="outline" asChild disabled={importing} size="sm">
                <span>
                  <FileUp className="me-1.5 h-3.5 w-3.5" />
                  {importing ? t("bugs.importing") : t("bugs.import")}
                </span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {/* Admin-only destructive actions */}
          {isAdmin && (
            <>
              <div className="h-6 w-px bg-border" aria-hidden="true" />
              <Button variant="outline" size="sm" onClick={() => setPurgeMode("completed")}>
                <Trash2 className="me-1.5 h-3.5 w-3.5" />
                Delete completed
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPurgeMode("project")}>
                <Trash2 className="me-1.5 h-3.5 w-3.5" />
                Delete by project
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setPurgeMode("all")}>
                <Trash2 className="me-1.5 h-3.5 w-3.5" />
                Delete all
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Live upload progress */}
      {importing && <BugImportProgress progress={importProgress} t={t} />}

      {/* ── Stats Dashboard ──────────────────────────────────────────────────── */}
      {showStats && (
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50 shadow-sm backdrop-blur-sm">
          <div className="border-b border-border/40 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Overview
            </p>
          </div>
          <div className="p-4">
            <BugStatsDashboard />
          </div>
        </div>
      )}

      <BugImportDialog report={importReport} onClose={() => setImportReport(null)} t={t} />

      {/* ── Filters + Table ──────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="p-4 border-b border-border/40">
          <BugFilters
            value={filterState}
            onChange={handleFilterChange}
            onReset={resetFilters}
            modules={modules}
            projects={projects}
            profiles={profiles}
            savedFilters={savedFilters}
            savedFilterName={savedFilterName}
            onSavedFilterNameChange={setSavedFilterName}
            onSaveFilter={handleSaveFilter}
            onApplySavedFilter={applySavedFilter}
            onDeleteSavedFilter={handleDeleteSavedFilter}
          />
        </div>

        {/* Bulk action bar */}
        {bulkAssign.hasSelection && (
          <div className="flex flex-wrap items-center gap-2 border-b border-primary/20 bg-primary/5 px-4 py-2.5">
            <span className="text-sm font-medium">
              {t("bugs.bulk.selected", { count: bulkAssign.selectionCount })}
            </span>

            {/* ── Bulk Status ── */}
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder={t("bugs.bulk.status")} />
              </SelectTrigger>
              <SelectContent>
                {BUG_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => bulkStatusMutation.mutate()}
              disabled={bulkStatusMutation.isPending || bulkAssign.isPending}
            >
              {t("bugs.bulk.apply")} status
            </Button>

            {/* ── Bulk Assign ── Only active profiles are offered */}
            <Select
              value={bulkAssign.targetAssignee}
              onValueChange={bulkAssign.setTargetAssignee}
            >
              <SelectTrigger className="h-9 w-48">
                <SelectValue placeholder={t("bugs.bulk.assignee")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={BULK_UNASSIGNED}>{t("bugs.bulk.unassigned")}</SelectItem>
                {activeProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              onClick={() => bulkAssign.apply()}
              disabled={bulkAssign.isPending || bulkStatusMutation.isPending}
            >
              {t("bugs.bulk.apply")} assignee
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={bulkAssign.clearSelection}
            >
              {t("bugs.bulk.clear")}
            </Button>
          </div>
        )}

        {/* SLA aging banner */}
        {!isLoading && (aging.breached > 0 || aging.atRisk > 0) && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border/40 bg-amber-500/5 px-4 py-2.5 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
            <span className="text-muted-foreground">SLA aging on this page:</span>
            {aging.breached > 0 && (
              <Badge variant="outline" className="border-destructive/40 text-destructive">
                {aging.breached} overdue
              </Badge>
            )}
            {aging.atRisk > 0 && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-600">
                {aging.atRisk} at risk
              </Badge>
            )}
          </div>
        )}

        <div className="p-0">
          {view === "board" ? (
            <BugKanbanBoard rows={rows} isLoading={isLoading} user={user} profileMap={profileMap} />
          ) : view === "cards" ? (
            <div className="p-4">
              <BugCardGrid
                rows={rows}
                isLoading={isLoading}
                profileMap={profileMap}
                projectMap={projectMap}
                emptyMessage={hasActiveFilters ? t("bugs.empty.filtered") : t("bugs.empty.none")}
              />
            </div>
          ) : (
            <BugTable
              rows={rows}
              isLoading={isLoading}
              user={user}
              profiles={profiles ?? []}
              profileMap={profileMap}
              projectMap={projectMap}
              selectedIds={bulkAssign.selectedIds}
              onToggleSelected={bulkAssign.toggleOne}
              onToggleAll={(checked) =>
                bulkAssign.selectAll(checked ? selectableRows.map((bug) => bug.id) : [])
              }
              emptyMessage={hasActiveFilters ? t("bugs.empty.filtered") : t("bugs.empty.none")}
              t={t}
            />
          )}
        </div>

        {bugsError && (
          <div className="px-4 py-3">
            <p className="text-sm text-destructive">{friendlyDbError(bugsError as never)}</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border/40 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {t("bugs.page", { page: safePage, pages: totalPages })}
              {isFetching ? t("bugs.updating") : ""}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                aria-label={t("common.previous")}
                disabled={safePage <= 1}
                onClick={() => setPage(Math.max(1, safePage - 1))}
              >
                {t("common.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label={t("common.next")}
                disabled={safePage >= totalPages}
                onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              >
                {t("common.next")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Admin-only destructive cleanup */}
      <AlertDialog open={purgeMode !== null} onOpenChange={(open) => !open && setPurgeMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {purgeMode === "completed"
                ? "Delete all completed bugs?"
                : purgeMode === "project"
                  ? "Delete every bug in one project?"
                  : "Delete every bug?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected bugs and their comments, attachments and
              history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {purgeMode === "project" && (
            <Select value={purgeProject} onValueChange={setPurgeProject}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choose a project" />
              </SelectTrigger>
              <SelectContent>
                {(projects ?? []).map((project) => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                purgeMutation.isPending || (purgeMode === "project" && purgeProject === "All")
              }
              onClick={(event) => {
                event.preventDefault();
                purgeMutation.mutate();
              }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
