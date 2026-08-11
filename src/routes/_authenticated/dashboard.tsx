import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BugIcon,
  CheckCircle2,
  CircleDashed,
  Layers,
  ShieldAlert,
  Target,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { fetchDashboardStats, fetchRecentBugs, type DashboardScope } from "@/lib/api";
import {
  BugLink,
  DashboardSkeleton,
  EmptyPanel,
  KpiCard,
  SectionCard,
} from "@/components/dashboard/dashboard-parts";
import { RoleDashboardPanels } from "@/components/dashboard/RoleDashboardPanels";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | ElectroPI Bug Tracker" },
      {
        name: "description",
        content:
          "A role-aware overview of bug status, priority, severity and module health across your projects.",
      },
      { property: "og:title", content: "Dashboard | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "Track defect flow, throughput and module health at a glance.",
      },
    ],
  }),
  component: DashboardPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFound label="page" />,
});

const RESOLVED_STATUSES = ["Fixed", "Closed"];
const REMAINING_STATUSES = ["Open", "In Progress", "Reopened"];

const STATUS_CHART_COLORS: Record<string, string> = {
  Open: "var(--chart-1)",
  "In Progress": "var(--chart-2)",
  Fixed: "var(--chart-3)",
  Reopened: "var(--chart-4)",
  Closed: "var(--chart-5)",
};
const PRIORITY_CHART_COLORS: Record<string, string> = {
  Critical: "var(--chart-1)",
  High: "var(--chart-2)",
  Medium: "var(--chart-3)",
  Low: "var(--chart-4)",
};
const SEVERITY_CHART_COLORS: Record<string, string> = {
  Blocker: "var(--chart-1)",
  Critical: "var(--chart-2)",
  Major: "var(--chart-3)",
  Minor: "var(--chart-4)",
};

const roleCopy: Record<string, { kicker: string; title: string; detail: string }> = {
  tester: {
    kicker: "Test signal / intake",
    title: "Your defect pulse",
    detail: "A read on the bugs you've reported and how they're moving through the queue.",
  },
  developer: {
    kicker: "Build signal / ownership",
    title: "Your delivery queue",
    detail: "A focused view of bugs assigned to you across status, priority and module.",
  },
  admin: {
    kicker: "Platform signal / oversight",
    title: "Quality operations",
    detail: "A platform-wide view of defect flow, priority mix and module health.",
  },
  supervisor: {
    kicker: "Team signal / oversight",
    title: "Quality operations",
    detail: "Monitor defect flow and team throughput across the delivery surface.",
  },
  auditor: {
    kicker: "Audit signal / monitor",
    title: "Resolution oversight",
    detail: "Review defect flow, time-to-resolution evidence and role-scoped activity.",
  },
  monitor: {
    kicker: "Audit signal / monitor",
    title: "Resolution oversight",
    detail: "Review defect flow, time-to-resolution evidence and role-scoped activity.",
  },
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

function DashboardError() {
  return (
    <div className="mx-auto flex max-w-7xl min-h-64 flex-col items-center justify-center rounded-xl border border-destructive/30 bg-card text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Dashboard signal unavailable</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        We could not load the latest bug data. Try again in a moment.
      </p>
    </div>
  );
}

function DashboardPage() {
  const { user } = useAuth();
  const role = (user?.role ?? "tester").toLowerCase();
  const copy = roleCopy[role] ?? roleCopy["tester"]!;
  const scope: DashboardScope =
    role === "developer" ? "assigned" : role === "tester" ? "reported" : "all";

  const statsQuery = useQuery({
    queryKey: ["dashboard-stats", scope],
    queryFn: () => fetchDashboardStats(scope),
    enabled: !!user,
  });

  const recentQuery = useQuery({
    queryKey: ["dashboard-recent-bugs", scope, user?.id],
    queryFn: () => fetchRecentBugs(scope, user?.id),
    enabled: !!user,
  });

  const baseStats = statsQuery.data ?? {
    total: 0,
    by_status: {},
    by_priority: {},
    by_severity: {},
    by_module: [],
    modules: [],
  };
  const resolved = RESOLVED_STATUSES.reduce((sum, s) => sum + (baseStats.by_status[s] ?? 0), 0);
  const remaining = REMAINING_STATUSES.reduce((sum, s) => sum + (baseStats.by_status[s] ?? 0), 0);
  const critical =
    (baseStats.by_priority["Critical"] ?? 0) + (baseStats.by_severity["Blocker"] ?? 0);
  const resolutionRate = baseStats.total > 0 ? Math.round((resolved / baseStats.total) * 100) : 0;

  const statusData = Object.entries(baseStats.by_status).map(([name, value]) => ({ name, value }));
  const priorityData = Object.entries(baseStats.by_priority).map(([name, value]) => ({
    name,
    value,
  }));
  const severityData = Object.entries(baseStats.by_severity).map(([name, value]) => ({
    name,
    value,
  }));
  const moduleList = baseStats.by_module;
  const recentBugs = recentQuery.data ?? [];

  if (statsQuery.isLoading || recentQuery.isLoading) return <DashboardSkeleton />;
  if (statsQuery.isError || recentQuery.isError) return <DashboardError />;

  return (
    <main className="mx-auto max-w-7xl space-y-6 pb-8">
      <header className="border-b border-border/70 pb-6">
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {copy.kicker}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {copy.title}
          {user?.username ? <span className="text-muted-foreground">, {user.username}</span> : null}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {copy.detail}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Dashboard metrics">
        <KpiCard label="Total Bugs" value={baseStats.total} sub="tracked defects" icon={BugIcon} />
        <KpiCard
          label="Open"
          value={baseStats.by_status["Open"] ?? 0}
          sub="awaiting triage"
          icon={CircleDashed}
          toneClass="text-destructive"
        />
        <KpiCard
          label="In Progress"
          value={baseStats.by_status["In Progress"] ?? 0}
          sub="being worked on"
          icon={Activity}
          toneClass="text-info"
        />
        <KpiCard
          label="Fixed / Closed"
          value={resolved}
          sub={`${resolutionRate}% resolution rate`}
          icon={CheckCircle2}
          toneClass="text-success"
        />
        <KpiCard
          label="Critical"
          value={critical}
          sub="critical priority or blocker severity"
          icon={AlertTriangle}
          toneClass="text-destructive"
        />
      </section>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="lg:col-span-3">
          <SectionCard title="Resolved vs Remaining" icon={Target}>
            {baseStats.total ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Resolved", value: resolved },
                        { name: "Remaining", value: remaining },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={72}
                      outerRadius={96}
                      paddingAngle={3}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                    >
                      <Cell fill="var(--chart-3)" strokeWidth={0} />
                      <Cell fill="var(--chart-1)" strokeWidth={0} />
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyPanel
                title="No data yet"
                detail="Bugs will populate this chart as they are reported."
              />
            )}
          </SectionCard>
        </div>

        <div className="lg:col-span-4">
          <SectionCard title="Bugs by Status" icon={Layers}>
            {statusData.length ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Bugs">
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={STATUS_CHART_COLORS[entry.name] ?? "var(--primary)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyPanel
                title="No data yet"
                detail="Bugs will populate this chart as they are reported."
              />
            )}
          </SectionCard>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="By Priority" icon={AlertTriangle}>
          {priorityData.length ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={priorityData}
                  layout="vertical"
                  margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={62}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Bugs">
                    {priorityData.map((e, i) => (
                      <Cell
                        key={i}
                        fill={PRIORITY_CHART_COLORS[e.name] ?? "var(--muted-foreground)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyPanel title="No data yet" detail="Priority breakdown will show up here." />
          )}
        </SectionCard>

        <SectionCard title="By Severity" icon={AlertTriangle}>
          {severityData.length ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={severityData}
                  layout="vertical"
                  margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={62}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Bugs">
                    {severityData.map((e, i) => (
                      <Cell
                        key={i}
                        fill={SEVERITY_CHART_COLORS[e.name] ?? "var(--muted-foreground)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyPanel title="No data yet" detail="Severity breakdown will show up here." />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Module Breakdown" icon={Layers}>
          {moduleList.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="px-3 py-2 text-start text-xs font-semibold text-muted-foreground">
                      Module
                    </th>
                    <th className="px-3 py-2 text-end text-xs font-semibold text-muted-foreground">
                      Total
                    </th>
                    <th className="px-3 py-2 text-end text-xs font-semibold text-muted-foreground">
                      Open
                    </th>
                    <th className="px-3 py-2 text-end text-xs font-semibold text-muted-foreground">
                      Resolved
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {moduleList.map((m) => (
                    <tr
                      key={m.module}
                      className="border-b border-border/30 transition-colors hover:bg-muted/30"
                    >
                      <td className="px-3 py-2.5 font-medium">{m.module}</td>
                      <td className="px-3 py-2.5 text-end tabular-nums">{m.total}</td>
                      <td className="px-3 py-2.5 text-end">
                        <Badge
                          variant="outline"
                          className="border-destructive/30 bg-destructive/10 text-xs font-semibold text-destructive"
                        >
                          {m.open}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-end">
                        <Badge
                          variant="outline"
                          className="border-success/30 bg-success/10 text-xs font-semibold text-success"
                        >
                          {m.fixed}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyPanel
              title="No modules yet"
              detail="Module data will appear once bugs are reported."
            />
          )}
        </SectionCard>

        <SectionCard title="Recent Bugs" icon={Activity}>
          {recentBugs.length ? (
            <div className="space-y-1">
              {recentBugs.map((bug) => (
                <BugLink
                  key={bug.id}
                  id={bug.id}
                  code={bug.bug_id}
                  title={bug.title}
                  status={bug.status}
                  priority={bug.priority}
                />
              ))}
            </div>
          ) : (
            <EmptyPanel
              title="No bugs to show"
              detail="Recently reported bugs will show up here."
            />
          )}
        </SectionCard>
      </div>

      <RoleDashboardPanels role={role} recentBugs={recentBugs} />
    </main>
  );
}
