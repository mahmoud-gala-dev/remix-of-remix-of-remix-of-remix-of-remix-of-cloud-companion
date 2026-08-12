import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BugIcon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Download,
  FileUp,
  KanbanSquare,
  List,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  Save,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchBugsPage,
  fetchBugModules,
  fetchProjects,
  fetchProfiles,
  fetchDashboardStats,
  statusTone,
  priorityTone,
  BUG_STATUSES,
  BUG_PRIORITIES,
  BUG_SEVERITIES,
  friendlyDbError,
} from "@/lib/api";
import {
  normalizePriority,
  normalizeSeverity,
  normalizeStatus,
  parseBugImportRows,
} from "@/lib/bug-import";
import { datedCsvFilename, downloadCsv, toCsv } from "@/lib/csv-export";
import { downloadBugImportTemplate, downloadBugsExcel } from "@/lib/bug-excel";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { canChangeBugStatus, canReportBugs, canViewBug } from "@/lib/permissions";
import { BugQuickStatus } from "@/components/bugs/BugQuickStatus";
import { BugKanbanBoard } from "@/components/bugs/BugKanbanBoard";
import { SlaBadge } from "@/components/bugs/SlaBadge";
import { slaSummary } from "@/lib/sla";
import {
  deleteSavedFilter,
  readSavedFilters,
  saveFilter,
  type SavedFilter,
} from "@/lib/saved-filters";
import { writeBugNavFilters } from "@/lib/bug-nav";

export const Route = createFileRoute("/_authenticated/bugs/")({
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

type BugFilterState = {
  search: string;
  module: string;
  status: string;
  priority: string;
  severity: string;
  project: string;
  assignee: string;
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* Chart color maps                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  Open: "var(--chart-4)",
  "In Progress": "var(--chart-2)",
  Fixed: "var(--chart-2)",
  Reopened: "var(--chart-3)",
  Closed: "var(--chart-5)",
};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "var(--chart-4)",
  High: "var(--chart-3)",
  Medium: "var(--chart-1)",
  Low: "var(--chart-5)",
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* Stats Dashboard Panel                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

function StatsDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", "all"],
    queryFn: () => fetchDashboardStats("all"),
    staleTime: 60_000,
  });

  /* Derived chart data — only recomputed when stats change */
  const statusChartData = useMemo(
    () => Object.entries(stats?.by_status ?? {}).map(([name, value]) => ({ name, value })),
    [stats],
  );

  const priorityChartData = useMemo(
    () => Object.entries(stats?.by_priority ?? {}).map(([name, value]) => ({ name, value })),
    [stats],
  );

  const openCount = useMemo(
    () => (stats?.by_status?.["Open"] ?? 0) + (stats?.by_status?.["Reopened"] ?? 0),
    [stats],
  );

  const fixedCount = useMemo(
    () => (stats?.by_status?.["Fixed"] ?? 0) + (stats?.by_status?.["Closed"] ?? 0),
    [stats],
  );

  const criticalCount = useMemo(
    () => (stats?.by_priority?.["Critical"] ?? 0) + (stats?.by_severity?.["Blocker"] ?? 0),
    [stats],
  );

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!stats || stats.total === 0) return null;

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MiniKpi
          label="Total Bugs"
          value={stats.total}
          icon={<BugIcon className="h-4 w-4" />}
          toneClass="text-primary"
        />
        <MiniKpi
          label="Open / Reopened"
          value={openCount}
          icon={<CircleDashed className="h-4 w-4" />}
          toneClass="text-destructive"
        />
        <MiniKpi
          label="Fixed / Closed"
          value={fixedCount}
          icon={<CheckCircle2 className="h-4 w-4" />}
          toneClass="text-success"
        />
        <MiniKpi
          label="Critical / Blocker"
          value={criticalCount}
          icon={<ShieldAlert className="h-4 w-4" />}
          toneClass={criticalCount > 0 ? "text-destructive" : "text-muted-foreground"}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Status pie */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              By Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusChartData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "var(--chart-5)"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
              {statusChartData.map((entry) => (
                <span
                  key={entry.name}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: STATUS_COLORS[entry.name] ?? "var(--chart-5)" }}
                  />
                  {entry.name}
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {entry.value}
                  </Badge>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Priority bar */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              By Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={priorityChartData}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  cursor={{ fill: "oklch(1 0 0 / 4%)" }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {priorityChartData.map((entry) => (
                    <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] ?? "var(--chart-5)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniKpi({
  label,
  value,
  icon,
  toneClass,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  toneClass?: string;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="flex items-start justify-between gap-2 pt-4 pb-3 px-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className={`mt-1 text-2xl font-bold ${toneClass ?? "text-foreground"}`}>{value}</p>
        </div>
        <div className={`rounded-lg bg-muted/50 p-2 ${toneClass ?? ""}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Main page                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

function BugsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("All");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [severity, setSeverity] = useState("All");
  const [project, setProject] = useState("All");
  const [assignee, setAssignee] = useState("All");
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [view, setView] = useState<"table" | "board">("table");
  const [savedFilterName, setSavedFilterName] = useState("");
  const [savedFilters, setSavedFilters] = useState<SavedFilter<BugFilterState>[]>(() =>
    readSavedFilters<BugFilterState>(BUG_FILTERS_KEY),
  );
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState("Open");
  const [bulkAssignee, setBulkAssignee] = useState("unassigned");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounced(search);

  const filters = useMemo(
    () => ({ status, priority, severity, module, project, assignee, search: debouncedSearch }),
    [status, priority, severity, module, project, assignee, debouncedSearch],
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
  const hasActiveFilters =
    !!search.trim() ||
    module !== "All" ||
    status !== "All" ||
    priority !== "All" ||
    severity !== "All" ||
    project !== "All" ||
    assignee !== "All";

  const resetPage = useCallback(() => setPage(1), []);
  const resetFilters = useCallback(() => {
    setSearch("");
    setModule("All");
    setStatus("All");
    setPriority("All");
    setSeverity("All");
    setProject("All");
    setAssignee("All");
    setPage(1);
  }, []);

  const canReport = canReportBugs(user?.role);
  const selectableRows = useMemo(
    () => rows.filter((bug) => canChangeBugStatus(bug, user)),
    [rows, user],
  );
  const allSelected =
    selectableRows.length > 0 && selectableRows.every((bug) => selectedIds.includes(bug.id));

  const currentFilterState = useCallback(
    (): BugFilterState => ({ search, module, status, priority, severity, project, assignee }),
    [search, module, status, priority, severity, project, assignee],
  );

  const applySavedFilter = useCallback((filter: SavedFilter<BugFilterState>) => {
    setSearch(filter.value.search);
    setModule(filter.value.module);
    setStatus(filter.value.status);
    setPriority(filter.value.priority);
    setSeverity(filter.value.severity);
    setProject(filter.value.project);
    setAssignee(filter.value.assignee);
    setPage(1);
  }, []);

  const handleSaveFilter = useCallback(() => {
    const name = savedFilterName.trim();
    if (!name) {
      toast.error("Name the filter before saving it.");
      return;
    }
    const next = saveFilter(BUG_FILTERS_KEY, name, currentFilterState());
    setSavedFilters([next, ...savedFilters.filter((item) => item.name !== next.name)].slice(0, 12));
    setSavedFilterName("");
    toast.success("Filter saved");
  }, [currentFilterState, savedFilterName, savedFilters]);

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
        const parsedRows = parseBugImportRows(rawData);

        const { data: existing } = await supabase.from("bugs").select("bug_id").limit(5000);
        const existingIds = new Set((existing ?? []).map((b) => b.bug_id));
        const {
          data: { user },
        } = await supabase.auth.getUser();

        let imported = 0;
        let skipped = 0;
        for (const row of parsedRows) {
          if (existingIds.has(row.bug_id)) {
            skipped++;
            continue;
          }
          const { error } = await supabase.from("bugs").insert({
            bug_id: row.bug_id,
            module: row.module || "General",
            title: row.title || row.bug_id,
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
            project_id: project !== "All" ? Number(project) : null,
            reported_by: user?.id ?? null,
          });
          if (error) {
            skipped++;
          } else {
            existingIds.add(row.bug_id);
            imported++;
          }
        }

        toast.success("Import complete", {
          description: `Imported ${imported} bugs. Skipped ${skipped}.`,
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

      {/* ── Stats dashboard ────────────────────────────────────────────────── */}
      {showStats && (
        <div className="rounded-xl border border-border/50 bg-card/40 p-4 backdrop-blur-sm">
          <StatsDashboard />
        </div>
      )}

      <Tabs
        value={module}
        onValueChange={(v) => {
          setModule(v);
          resetPage();
        }}
      >
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="All">All</TabsTrigger>
          {modules.map((m) => (
            <TabsTrigger key={m} value={m}>
              {m}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="ps-8"
              placeholder="Search by title or bug ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetPage();
              }}
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              resetPage();
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All statuses</SelectItem>
              {BUG_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={priority}
            onValueChange={(v) => {
              setPriority(v);
              resetPage();
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All priorities</SelectItem>
              {BUG_PRIORITIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={severity}
            onValueChange={(v) => {
              setSeverity(v);
              resetPage();
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All severities</SelectItem>
              {BUG_SEVERITIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={project}
            onValueChange={(v) => {
              setProject(v);
              resetPage();
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All projects</SelectItem>
              {(projects ?? []).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={assignee}
            onValueChange={(v) => {
              setAssignee(v);
              resetPage();
            }}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {(profiles ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RefreshCw className="me-2 h-4 w-4" />
              Reset filters
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/20 p-3">
          <Input
            value={savedFilterName}
            onChange={(event) => setSavedFilterName(event.target.value)}
            placeholder="Saved filter name"
            className="h-9 w-48"
          />
          <Button type="button" variant="outline" size="sm" onClick={handleSaveFilter}>
            <Save className="me-2 h-4 w-4" />
            Save filter
          </Button>
          {savedFilters.length > 0 && (
            <Select
              value=""
              onValueChange={(id) => {
                const filter = savedFilters.find((item) => item.id === id);
                if (filter) applySavedFilter(filter);
              }}
            >
              <SelectTrigger className="h-9 w-52">
                <SelectValue placeholder="Load saved filter" />
              </SelectTrigger>
              <SelectContent>
                {savedFilters.map((filter) => (
                  <SelectItem key={filter.id} value={filter.id}>
                    {filter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {savedFilters.map((filter) => (
            <Button
              key={filter.id}
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground"
              onClick={() => handleDeleteSavedFilter(filter.id)}
              aria-label={`Delete saved filter ${filter.name}`}
            >
              <Trash2 className="me-1 h-3.5 w-3.5" />
              {filter.name}
            </Button>
          ))}
        </div>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <span className="text-sm font-medium">{selectedIds.length} selected</span>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="Status" />
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
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
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
              Apply bulk update
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              Clear
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
          <BugKanbanBoard
            rows={rows}
            isLoading={isLoading}
            user={user}
            profileMap={profileMap}
          />
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) =>
                          setSelectedIds(checked ? selectableRows.map((bug) => bug.id) : [])
                        }
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
                          onCheckedChange={(checked) => toggleSelected(bug.id, checked === true)}
                          aria-label={t("bugs.selectOne", { id: bug.bug_id })}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          to="/bugs/$id"
                          params={{ id: String(bug.id) }}
                          className="hover:underline"
                        >
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
                      <TableCell>
                        {bug.project_id ? (projectMap.get(bug.project_id) ?? "—") : "—"}
                      </TableCell>
                      <TableCell>
                        {bug.assigned_to
                          ? (profileMap.get(bug.assigned_to) ?? "—")
                          : t("bugs.unassigned")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                        {hasActiveFilters ? t("bugs.empty.filtered") : t("bugs.empty.none")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile card list — app-like rows instead of a horizontal table */}
            <ul className="space-y-3 md:hidden">
              {rows.map((bug) => (
                <li
                  key={bug.id}
                  className="rounded-xl border border-border/60 bg-card p-3 shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <Checkbox
                      checked={selectedIds.includes(bug.id)}
                      disabled={!canChangeBugStatus(bug, user)}
                      onCheckedChange={(checked) => toggleSelected(bug.id, checked === true)}
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
                      {bug.assigned_to
                        ? (profileMap.get(bug.assigned_to) ?? "—")
                        : t("bugs.unassigned")}
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
                <li className="py-10 text-center text-sm text-muted-foreground">
                  {hasActiveFilters ? t("bugs.empty.filtered") : t("bugs.empty.none")}
                </li>
              )}
            </ul>
          </>
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
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("common.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label={t("common.next")}
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
