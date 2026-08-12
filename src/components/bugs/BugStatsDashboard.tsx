import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { AlertTriangle, BugIcon, CheckCircle2, CircleDashed, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchDashboardStats } from "@/lib/api";

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

/** KPI cards plus status/priority charts shown above the bug list. */
export function BugStatsDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", "all"],
    queryFn: () => fetchDashboardStats("all"),
    staleTime: 60_000,
  });

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

      <div className="grid gap-4 lg:grid-cols-2">
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

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              By Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={priorityChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
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
