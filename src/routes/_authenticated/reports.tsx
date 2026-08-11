import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { slaLabel, slaState, slaSummary, slaTone } from "@/lib/sla";
import { runSlaBreachScan } from "@/lib/sla-alerts";
import { useAuth } from "@/lib/auth";
import { isStaffRole } from "@/lib/permissions";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Clock,
  Download,
  FileText,
  ShieldAlert,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { fetchBugs, fetchProfiles, fetchProjects } from "@/lib/api";
import {
  assigneeLeaderboard,
  averageHours,
  bugsByProject,
  fetchBugHistory,
  formatDuration,
  medianHours,
  resolutionTimes,
  trendSeries,
} from "@/lib/reports";
import {
  DashboardSkeleton,
  EmptyPanel,
  KpiCard,
  SectionCard,
} from "@/components/dashboard/dashboard-parts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { datedCsvFilename, downloadCsv, toCsv } from "@/lib/csv-export";
import { readSavedFilters, saveFilter, type SavedFilter } from "@/lib/saved-filters";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Team Reports | ElectroPI Bug Tracker" },
      {
        name: "description",
        content:
          "Team-wide reporting: bugs by project and status, average resolution time, top assignees and defect trends over time.",
      },
      { property: "og:title", content: "Team Reports | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "Cross-project quality metrics, resolution speed and team throughput in one view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFound label="page" />,
});

const RANGES = [
  { days: 14, label: "14d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];
const REPORT_FILTERS_KEY = "electropi.saved.report_filters";

type ReportFilterState = {
  range: number;
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; fill?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? p.fill }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function ReportsPage() {
  const [range, setRange] = useState(30);
  const [reportFilterName, setReportFilterName] = useState("");
  const [savedReportFilters, setSavedReportFilters] = useState<SavedFilter<ReportFilterState>[]>(
    () => readSavedFilters<ReportFilterState>(REPORT_FILTERS_KEY),
  );
  const [auditSearch, setAuditSearch] = useState("");
  const [auditField, setAuditField] = useState("All");

  const bugsQuery = useQuery({ queryKey: ["report-bugs"], queryFn: fetchBugs });
  const projectsQuery = useQuery({ queryKey: ["report-projects"], queryFn: fetchProjects });
  const profilesQuery = useQuery({ queryKey: ["report-profiles"], queryFn: fetchProfiles });
  const historyQuery = useQuery({ queryKey: ["report-history"], queryFn: fetchBugHistory });

  const bugs = useMemo(() => bugsQuery.data ?? [], [bugsQuery.data]);
  const history = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);

  const projectRows = useMemo(
    () => bugsByProject(bugs, projectsQuery.data ?? []),
    [bugs, projectsQuery.data],
  );
  const resolved = useMemo(() => resolutionTimes(bugs, history), [bugs, history]);
  const leaderboard = useMemo(
    () => assigneeLeaderboard(bugs, profilesQuery.data ?? [], resolved),
    [bugs, profilesQuery.data, resolved],
  );
  const trend = useMemo(() => trendSeries(bugs, resolved, range), [bugs, resolved, range]);
  const bugNameById = useMemo(
    () => new Map(bugs.map((bug) => [bug.id, `${bug.bug_id} - ${bug.title}`])),
    [bugs],
  );
  const auditRows = useMemo(() => {
    const term = auditSearch.trim().toLowerCase();
    return history
      .filter((entry) => auditField === "All" || entry.field === auditField)
      .filter((entry) => {
        if (!term) return true;
        const bugLabel = bugNameById.get(entry.bug_id)?.toLowerCase() ?? "";
        return (
          bugLabel.includes(term) ||
          entry.field.toLowerCase().includes(term) ||
          (entry.old_value ?? "").toLowerCase().includes(term) ||
          (entry.new_value ?? "").toLowerCase().includes(term)
        );
      })
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 100);
  }, [auditField, auditSearch, bugNameById, history]);
  const auditFields = useMemo(
    () => Array.from(new Set(history.map((entry) => entry.field))).sort(),
    [history],
  );

  const avg = averageHours(resolved);
  const median = medianHours(resolved);
  const openTotal = bugs.length - resolved.length;

  const exportProjectReport = () => {
    const csv = toCsv(projectRows, [
      { header: "Project", value: (row) => row.project },
      { header: "Open", value: (row) => row.open },
      { header: "In Progress", value: (row) => row.inProgress },
      { header: "Resolved", value: (row) => row.resolved },
      { header: "Total", value: (row) => row.total },
    ]);
    downloadCsv(datedCsvFilename("project-bug-report"), csv);
  };

  const exportAssigneeReport = () => {
    const csv = toCsv(leaderboard, [
      { header: "Assignee", value: (row) => row.name },
      { header: "Open", value: (row) => row.open },
      { header: "Resolved", value: (row) => row.resolved },
      { header: "Total", value: (row) => row.total },
      { header: "Average Resolution Hours", value: (row) => row.avgHours.toFixed(2) },
    ]);
    downloadCsv(datedCsvFilename("assignee-performance-report"), csv);
  };

  const exportAuditReport = () => {
    const csv = toCsv(auditRows, [
      { header: "Bug", value: (row) => bugNameById.get(row.bug_id) ?? String(row.bug_id) },
      { header: "Field", value: (row) => row.field },
      { header: "Old Value", value: (row) => row.old_value ?? "" },
      { header: "New Value", value: (row) => row.new_value ?? "" },
      { header: "Changed At", value: (row) => row.created_at },
    ]);
    downloadCsv(datedCsvFilename("audit-log-report"), csv);
  };

  const saveReportFilter = () => {
    const name = reportFilterName.trim();
    if (!name) return;
    const next = saveFilter(REPORT_FILTERS_KEY, name, { range });
    setSavedReportFilters(
      [next, ...savedReportFilters.filter((filter) => filter.name !== next.name)].slice(0, 12),
    );
    setReportFilterName("");
  };

  const exportPdf = () => {
    window.print();
  };

  const slaRows = useMemo(
    () =>
      bugs
        .map((bug) => ({ bug, state: slaState(bug) }))
        .filter((row) => row.state === "breached" || row.state === "at-risk")
        .sort(
          (a, b) => new Date(a.bug.created_at).getTime() - new Date(b.bug.created_at).getTime(),
        )
        .slice(0, 10),
    [bugs],
  );
  const aging = useMemo(() => slaSummary(bugs), [bugs]);

  const slaScan = useMutation({
    mutationFn: runSlaBreachScan,
    onSuccess: (result) =>
      toast.success(
        `SLA check done: ${result.breached_bugs} breached bug(s), ${result.notifications_created} new alert(s).`,
      ),
    onError: (error: Error) => toast.error(error.message),
  });

  const exportSlaReport = () => {
    const csv = toCsv(slaRows, [
      { header: "Bug", value: (row) => row.bug.bug_id },
      { header: "Title", value: (row) => row.bug.title },
      { header: "Priority", value: (row) => row.bug.priority },
      { header: "Status", value: (row) => row.bug.status },
      { header: "SLA State", value: (row) => row.state },
      { header: "SLA", value: (row) => slaLabel(row.bug) },
      { header: "Created At", value: (row) => row.bug.created_at },
    ]);
    downloadCsv(datedCsvFilename("sla-aging-report"), csv);
  };


  const isLoading =
    bugsQuery.isLoading ||
    projectsQuery.isLoading ||
    profilesQuery.isLoading ||
    historyQuery.isLoading;
  const isError =
    bugsQuery.isError || projectsQuery.isError || profilesQuery.isError || historyQuery.isError;

  if (isLoading) return <DashboardSkeleton />;
  if (isError) {
    return (
      <div className="mx-auto flex min-h-64 max-w-7xl flex-col items-center justify-center rounded-xl border border-destructive/30 bg-card text-center">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Reporting data unavailable</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          We could not load team metrics. Try again in a moment.
        </p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 pb-8">
      <header className="border-b border-border/70 pb-6">
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Team signal / reporting
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Team-wide reporting</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Cross-project defect distribution, resolution speed, assignee throughput and trends over
          time.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
          <Input
            value={reportFilterName}
            onChange={(event) => setReportFilterName(event.target.value)}
            placeholder="Report filter name"
            className="h-9 w-48"
          />
          <Button type="button" variant="outline" size="sm" onClick={saveReportFilter}>
            Save report filter
          </Button>
          {savedReportFilters.length > 0 && (
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue=""
              onChange={(event) => {
                const filter = savedReportFilters.find((item) => item.id === event.target.value);
                if (filter) setRange(filter.value.range);
                event.currentTarget.value = "";
              }}
            >
              <option value="" disabled>
                Load saved filter
              </option>
              {savedReportFilters.map((filter) => (
                <option key={filter.id} value={filter.id}>
                  {filter.name}
                </option>
              ))}
            </select>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={exportPdf}>
            <FileText className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Reporting metrics">
        <KpiCard
          label="Tracked Bugs"
          value={bugs.length}
          sub="across all projects"
          icon={BarChart3}
        />
        <KpiCard
          label="Still Open"
          value={openTotal}
          sub="unresolved defects"
          icon={TrendingUp}
          toneClass="text-destructive"
        />
        <KpiCard
          label="Avg Resolution"
          value={formatDuration(avg)}
          sub={`${resolved.length} resolved bugs`}
          icon={Clock}
          toneClass="text-success"
        />
        <KpiCard
          label="Median Resolution"
          value={formatDuration(median)}
          sub="typical turnaround"
          icon={Clock}
        />
      </section>

      <SectionCard
        title="Bugs by project and status"
        icon={BarChart3}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={exportProjectReport}
            disabled={projectRows.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        }
      >
        {projectRows.length ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectRows} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="project"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-15}
                  height={50}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="open"
                  name="Open"
                  stackId="s"
                  fill="var(--chart-1)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar dataKey="inProgress" name="In Progress" stackId="s" fill="var(--chart-2)" />
                <Bar
                  dataKey="resolved"
                  name="Resolved"
                  stackId="s"
                  fill="var(--chart-3)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyPanel
            title="No projects yet"
            detail="Bugs assigned to projects will appear here."
          />
        )}
      </SectionCard>

      <SectionCard
        title="Trends over time"
        icon={TrendingUp}
        action={
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <Button
                key={r.days}
                size="sm"
                variant={range === r.days ? "secondary" : "ghost"}
                onClick={() => setRange(r.days)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        }
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="reported" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={20}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="reported"
                name="Reported"
                stroke="var(--chart-1)"
                fill="url(#reported)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="resolved"
                name="Resolved"
                stroke="var(--chart-3)"
                fill="url(#resolvedGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard
        title="Audit log"
        icon={ShieldAlert}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={exportAuditReport}
            disabled={!auditRows.length}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2 print:hidden">
          <Input
            value={auditSearch}
            onChange={(event) => setAuditSearch(event.target.value)}
            placeholder="Search audit log..."
            className="h-9 max-w-xs"
          />
          <select
            value={auditField}
            onChange={(event) => setAuditField(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="All">All fields</option>
            {auditFields.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </select>
        </div>
        {auditRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 font-medium">Bug</th>
                  <th className="py-2 font-medium">Field</th>
                  <th className="py-2 font-medium">Old</th>
                  <th className="py-2 font-medium">New</th>
                  <th className="py-2 font-medium">Changed</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="max-w-[260px] truncate py-2.5">
                      {bugNameById.get(row.bug_id) ?? row.bug_id}
                    </td>
                    <td className="py-2.5">
                      <Badge variant="outline">{row.field}</Badge>
                    </td>
                    <td className="max-w-[220px] truncate py-2.5 text-muted-foreground">
                      {row.old_value ?? ""}
                    </td>
                    <td className="max-w-[220px] truncate py-2.5">{row.new_value ?? ""}</td>
                    <td className="whitespace-nowrap py-2.5 text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyPanel
            title="No audit events"
            detail="Audit events will appear after bug changes are recorded."
          />
        )}
      </SectionCard>

      <SectionCard
        title="Top assignees"
        icon={Trophy}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={exportAssigneeReport}
            disabled={leaderboard.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        }
      >
        {leaderboard.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 font-medium">Assignee</th>
                  <th className="py-2 font-medium">Open</th>
                  <th className="py-2 font-medium">Resolved</th>
                  <th className="py-2 font-medium">Total</th>
                  <th className="py-2 font-medium">Avg resolution</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row) => (
                  <tr key={row.userId} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="bg-primary/15 text-[10px] text-primary">
                            {row.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{row.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <Badge
                        variant="outline"
                        className="border-destructive/30 bg-destructive/10 text-destructive"
                      >
                        {row.open}
                      </Badge>
                    </td>
                    <td className="py-2.5">
                      <Badge
                        variant="outline"
                        className="border-success/30 bg-success/10 text-success"
                      >
                        {row.resolved}
                      </Badge>
                    </td>
                    <td className="py-2.5 tabular-nums">{row.total}</td>
                    <td className="py-2.5 tabular-nums text-muted-foreground">
                      {formatDuration(row.avgHours)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyPanel
            title="No assignments yet"
            detail="Assign bugs to teammates to see throughput here."
          />
        )}
      </SectionCard>
    </main>
  );
}
