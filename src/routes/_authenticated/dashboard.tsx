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
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { fetchDashboardStats, fetchRecentBugs, type DashboardScope } from "@/lib/api";
import {
  BugLink,
  DashboardSkeleton,
  EmptyPanel,
  KpiCard,
  SectionCard,
} from "@/components/dashboard/dashboard-parts";
import { RoleDashboardPanels } from "@/components/dashboard/RoleDashboardPanels";
import { TeamFlowMap } from "@/components/dashboard/TeamFlowMap";

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

const roleCopyKeys: Record<
  string,
  { kicker: TranslationKey; title: TranslationKey; detail: TranslationKey }
> = {
  tester: {
    kicker: "dash.role.tester.kicker",
    title: "dash.role.tester.title",
    detail: "dash.role.tester.detail",
  },
  developer: {
    kicker: "dash.role.developer.kicker",
    title: "dash.role.developer.title",
    detail: "dash.role.developer.detail",
  },
  admin: {
    kicker: "dash.role.admin.kicker",
    title: "dash.role.admin.title",
    detail: "dash.role.admin.detail",
  },
  supervisor: {
    kicker: "dash.role.supervisor.kicker",
    title: "dash.role.supervisor.title",
    detail: "dash.role.supervisor.detail",
  },
  auditor: {
    kicker: "dash.role.auditor.kicker",
    title: "dash.role.auditor.title",
    detail: "dash.role.auditor.detail",
  },
  monitor: {
    kicker: "dash.role.monitor.kicker",
    title: "dash.role.monitor.title",
    detail: "dash.role.monitor.detail",
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
  const { t } = useI18n();
  return (
    <div className="mx-auto flex max-w-7xl min-h-64 flex-col items-center justify-center rounded-xl border border-destructive/30 bg-card text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{t("dash.error.title")}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {t("dash.error.detail")}
      </p>
    </div>
  );
}

function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const role = (user?.role ?? "tester").toLowerCase();
  const copyKeys = roleCopyKeys[role] ?? roleCopyKeys["tester"]!;
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
          {t(copyKeys.kicker)}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t(copyKeys.title)}
          {user?.username ? <span className="text-muted-foreground">, {user.username}</span> : null}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {t(copyKeys.detail)}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label={t("dash.metrics")}>
        <KpiCard
          label={t("dash.kpi.total")}
          value={baseStats.total}
          sub={t("dash.kpi.totalSub")}
          icon={BugIcon}
        />
        <KpiCard
          label={t("dash.kpi.open")}
          value={baseStats.by_status["Open"] ?? 0}
          sub={t("dash.kpi.openSub")}
          icon={CircleDashed}
          toneClass="text-destructive"
        />
        <KpiCard
          label={t("dash.kpi.inProgress")}
          value={baseStats.by_status["In Progress"] ?? 0}
          sub={t("dash.kpi.inProgressSub")}
          icon={Activity}
          toneClass="text-info"
        />
        <KpiCard
          label={t("dash.kpi.resolved")}
          value={resolved}
          sub={t("dash.kpi.resolvedSub", { rate: resolutionRate })}
          icon={CheckCircle2}
          toneClass="text-success"
        />
        <KpiCard
          label={t("dash.kpi.critical")}
          value={critical}
          sub={t("dash.kpi.criticalSub")}
          icon={AlertTriangle}
          toneClass="text-destructive"
        />
      </section>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="lg:col-span-3">
          <SectionCard title={t("dash.card.resolvedVsRemaining")} icon={Target}>
            {baseStats.total ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: t("dash.legend.resolved"), value: resolved },
                        { name: t("dash.legend.remaining"), value: remaining },
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
                title={t("dash.empty.noData")}
                detail={t("dash.empty.chart")}
              />
            )}
          </SectionCard>
        </div>

        <div className="lg:col-span-4">
          <SectionCard title={t("dash.card.byStatus")} icon={Layers}>
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
                title={t("dash.empty.noData")}
                detail={t("dash.empty.chart")}
              />
            )}
          </SectionCard>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title={t("dash.card.byPriority")} icon={AlertTriangle}>
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
            <EmptyPanel title={t("dash.empty.noData")} detail={t("dash.empty.priority")} />
          )}
        </SectionCard>

        <SectionCard title={t("dash.card.bySeverity")} icon={AlertTriangle}>
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
            <EmptyPanel title={t("dash.empty.noData")} detail={t("dash.empty.severity")} />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t("dash.card.modules")} icon={Layers}>
          {moduleList.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="px-3 py-2 text-start text-xs font-semibold text-muted-foreground">
                      {t("dash.col.module")}
                    </th>
                    <th className="px-3 py-2 text-end text-xs font-semibold text-muted-foreground">
                      {t("dash.col.total")}
                    </th>
                    <th className="px-3 py-2 text-end text-xs font-semibold text-muted-foreground">
                      {t("dash.col.open")}
                    </th>
                    <th className="px-3 py-2 text-end text-xs font-semibold text-muted-foreground">
                      {t("dash.col.resolved")}
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
              title={t("dash.empty.modulesTitle")}
              detail={t("dash.empty.modules")}
            />
          )}
        </SectionCard>

        <SectionCard title={t("dash.card.recent")} icon={Activity}>
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
              title={t("dash.empty.recentTitle")}
              detail={t("dash.empty.recent")}
            />
          )}
        </SectionCard>
      </div>



      <RoleDashboardPanels role={role} recentBugs={recentBugs} />
    </main>
  );
}
