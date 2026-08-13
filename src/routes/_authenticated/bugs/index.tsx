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
  List,
  Plus,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  normalizePriority,
  normalizeSeverity,
  normalizeStatus,
  validateAndParseBugImportRows,
} from "@/lib/bug-import";
import { datedCsvFilename, downloadCsv, toCsv } from "@/lib/csv-export";
import { downloadBugImportTemplate, downloadBugsExcel } from "@/lib/bug-excel";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { canChangeBugStatus, canReportBugs, canViewBug } from "@/lib/permissions";
import { BugKanbanBoard } from "@/components/bugs/BugKanbanBoard";
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
  const [savedFilterName, setSavedFilterName] = useState("");
  const [savedFilters, setSavedFilters] = useState<SavedFilter<BugFilterState>[]>(() =>
    readSavedFilters<BugFilterState>(BUG_FILTERS_KEY),
  );
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState("Open");
  const [bulkAssignee, setBulkAssignee] = useState("unassigned");
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
    (nextView: "table" | "board") => pushSearch(filterState, { page, view: nextView }),
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
      assignee: filterState.assignee,
      search: debouncedSearch,
    }),
    [filterState, debouncedSearch],
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

  useEffect(() => {
    const visibleIds = new Set(rows.map((bug) => bug.id));
    setSelectedIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [rows]);

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
  const selectableRows = useMemo(
    () => rows.filter((bug) => canChangeBugStatus(bug, user)),
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

  const toggleSelected = useCallback((id: number, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id),
    );
  }, []);

  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedIds.length) return;
      const payload = {
        status: bulkStatus,
        assigned_to: bulkAssignee === "unassigned" ? null : bulkAssignee,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("bugs").update(payload).in("id", selectedIds);
      if (error) throw new Error(friendlyDbError(error));
    },
    onSuccess: () => {
      toast.success("Bulk update applied", {
        description: `Updated ${selectedIds.length} bug${selectedIds.length === 1 ? "" : "s"}.`,
      });
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["bugs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["report-bugs"] });
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
          if (!row.bug_id.trim()) {
            failures.push({
              excelRowNumber: row.excelRowNumber,
              bugId: row.bug_id,
              reason: t("bugs.import.emptyId"),
            });
            continue;
          }
          if (!row.title.trim()) {
            failures.push({
              excelRowNumber: row.excelRowNumber,
              bugId: row.bug_id,
              reason: t("bugs.import.emptyTitle"),
            });
            continue;
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
              project_id: filterState.project !== "All" ? Number(filterState.project) : null,
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
    <div className="space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("bugs.title")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isLoading ? t("common.loading") : t("bugs.summary", { count: totalCount })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View switcher: table vs kanban board */}
          <div
            className="inline-flex rounded-md border border-border p-0.5"
            role="group"
            aria-label={t("bugs.view")}
          >
            <Button
              variant={view === "table" ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
              className="h-8"
            >
              <List className="me-1.5 h-4 w-4" aria-hidden="true" />
              {t("bugs.view.list")}
            </Button>
            <Button
              variant={view === "board" ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={view === "board"}
              onClick={() => setView("board")}
              className="h-8"
            >
              <KanbanSquare className="me-1.5 h-4 w-4" aria-hidden="true" />
              {t("bugs.view.board")}
            </Button>
          </div>
          {/* Stats toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowStats((v) => !v)}
            className="text-muted-foreground"
          >
            {showStats ? (
              <>
                <ChevronUp className="me-1.5 h-4 w-4" />
                {t("bugs.hideStats")}
              </>
            ) : (
              <>
                <ChevronDown className="me-1.5 h-4 w-4" />
                {t("bugs.showStats")}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={exportVisibleRows}
            disabled={isLoading || rows.length === 0}
            size="sm"
          >
            <Download className="me-2 h-4 w-4" />
            {t("bugs.exportCsv")}
          </Button>
          <Button
            variant="outline"
            onClick={() => void exportVisibleExcel()}
            disabled={isLoading || rows.length === 0}
            size="sm"
          >
            <FileSpreadsheet className="me-2 h-4 w-4" />
            {t("bugs.exportExcel")}
          </Button>
          <Button variant="outline" onClick={() => void downloadTemplate()} size="sm">
            <Download className="me-2 h-4 w-4" />
            {t("bugs.template")}
          </Button>
          <label className="cursor-pointer">
            <Button variant="outline" asChild disabled={importing} size="sm">
              <span>
                <FileUp className="me-2 h-4 w-4" />
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
          {canReport && (
            <Button size="sm" asChild>
              <Link to="/bugs/new">
                <Plus className="me-2 h-4 w-4" />
                {t("bugs.new")}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Live upload indicator for Excel imports. */}
      {importing && <BugImportProgress progress={importProgress} t={t} />}

      {/* ── Stats dashboard ────────────────────────────────────────────────── */}
      {showStats && (
        <div className="rounded-xl border border-border/50 bg-card/40 p-4 backdrop-blur-sm">
          <BugStatsDashboard />
        </div>
      )}

      <BugImportDialog report={importReport} onClose={() => setImportReport(null)} t={t} />

      <Card className="p-4 space-y-4">
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

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <span className="text-sm font-medium">
              {t("bugs.bulk.selected", { count: selectedIds.length })}
            </span>
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
            <Select value={bulkAssignee} onValueChange={setBulkAssignee}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue placeholder={t("bugs.bulk.assignee")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">{t("bugs.bulk.unassigned")}</SelectItem>
                {(profiles ?? []).map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              onClick={() => bulkUpdateMutation.mutate()}
              disabled={bulkUpdateMutation.isPending}
            >
              {t("bugs.bulk.apply")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              {t("bugs.bulk.clear")}
            </Button>
          </div>
        )}

        {/* SLA aging summary for the bugs currently in view */}
        {!isLoading && (aging.breached > 0 || aging.atRisk > 0) && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
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

        {view === "board" ? (
          <BugKanbanBoard rows={rows} isLoading={isLoading} user={user} profileMap={profileMap} />
        ) : (
          <BugTable
            rows={rows}
            isLoading={isLoading}
            user={user}
            profileMap={profileMap}
            projectMap={projectMap}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
            onToggleAll={(checked) =>
              setSelectedIds(checked ? selectableRows.map((bug) => bug.id) : [])
            }
            emptyMessage={hasActiveFilters ? t("bugs.empty.filtered") : t("bugs.empty.none")}
            t={t}
          />
        )}

        {bugsError && (
          <p className="text-sm text-destructive">{friendlyDbError(bugsError as never)}</p>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
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
      </Card>
    </div>
  );
}
