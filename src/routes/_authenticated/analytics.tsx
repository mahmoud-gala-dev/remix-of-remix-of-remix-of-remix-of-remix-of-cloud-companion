import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Printer, TrendingUp } from "lucide-react";
import { fetchBugs } from "@/lib/api";
import { fetchResolutionAnalytics, formatDuration } from "@/lib/bug-time";
import {
  moduleBreakdown,
  resolutionByPriority,
  shortDay,
  statusDistribution,
  trendSeries,
} from "@/lib/analytics";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics | ElectroPI Bug Tracker" },
      {
        name: "description",
        content:
          "Visual bug analytics: created vs resolved trends, average resolution time per priority, module backlog and developer workload.",
      },
      { property: "og:title", content: "Analytics | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "Charts for bug trends, resolution speed and developer workload.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFound label="page" />,
});

const SLICE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="h-[280px]">{children}</CardContent>
    </Card>
  );
}

function AnalyticsPage() {
  const bugsQuery = useQuery({ queryKey: ["bugs"], queryFn: fetchBugs });
  const timeQuery = useQuery({ queryKey: ["resolution-analytics"], queryFn: fetchResolutionAnalytics });

  const bugs = bugsQuery.data ?? [];
  const trend = useMemo(() => trendSeries(bugs, 30), [bugs]);
  const priorities = useMemo(() => resolutionByPriority(bugs), [bugs]);
  const modules = useMemo(() => moduleBreakdown(bugs), [bugs]);
  const statuses = useMemo(() => statusDistribution(bugs), [bugs]);

  const developers = useMemo(() => {
    const rows = timeQuery.data?.rows ?? [];
    const totals = new Map<string, { name: string; hours: number; bugs: number }>();
    for (const row of rows) {
      const entry = totals.get(row.developerId) ?? {
        name: row.developerName,
        hours: 0,
        bugs: 0,
      };
      entry.hours += (row.totalSeconds ?? 0) / 3600;
      entry.bugs += 1;
      totals.set(row.developerId, entry);
    }
    return Array.from(totals.values())
      .map((entry) => ({ ...entry, hours: Math.round(entry.hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
  }, [timeQuery.data]);

  const loading = bugsQuery.isLoading;
  const totalLogged = (timeQuery.data?.rows ?? []).reduce(
    (sum, row) => sum + (row.totalSeconds ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BarChart3 className="h-6 w-6" />
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Visual trends across the last 30 days — intake vs throughput, resolution speed against
            SLA targets, module backlog and developer workload.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="no-print">
          <Printer className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Bugs tracked</p>
            <p className="text-2xl font-semibold">{bugs.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Resolved last 30 days
            </p>
            <p className="text-2xl font-semibold">
              {trend.reduce((sum, point) => sum + point.resolved, 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Total logged fix time
            </p>
            <p className="text-2xl font-semibold">{formatDuration(totalLogged)}</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Skeleton className="h-[560px] w-full" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard
            title="Created vs resolved"
            description="Daily intake against throughput for the last 30 days."
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tickFormatter={shortDay} fontSize={11} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip labelFormatter={(value) => shortDay(String(value))} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="created"
                  name="Created"
                  stroke="var(--color-chart-1)"
                  fill="var(--color-chart-1)"
                  fillOpacity={0.2}
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  name="Resolved"
                  stroke="var(--color-chart-2)"
                  fill="var(--color-chart-2)"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Average resolution time vs SLA target"
            description="Hours from report to resolution per priority, compared with the SLA target."
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorities} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="priority" fontSize={11} />
                <YAxis fontSize={11} unit="h" />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgHours" name="Actual (h)" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                <Line dataKey="targetHours" name="Target (h)" stroke="var(--color-chart-4)" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Module backlog"
            description="Open vs resolved bugs for the busiest modules."
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modules} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" allowDecimals={false} fontSize={11} />
                <YAxis type="category" dataKey="module" width={110} fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="open" name="Open" stackId="a" fill="var(--color-chart-3)" />
                <Bar dataKey="resolved" name="Resolved" stackId="a" fill="var(--color-chart-2)" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Status mix" description="How the whole backlog is distributed today.">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statuses} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
                  {statuses.map((slice, index) => (
                    <Cell key={slice.name} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Developer workload"
            description="Hours logged on bug fixes, highest first."
          >
            {developers.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No fix time logged yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={developers} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} unit="h" />
                  <Tooltip />
                  <Bar dataKey="hours" name="Hours" fill="var(--color-chart-5)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Throughput momentum"
            description="Resolved bugs per day — a rising line means the team is catching up."
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tickFormatter={shortDay} fontSize={11} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip labelFormatter={(value) => shortDay(String(value))} />
                <Line
                  type="monotone"
                  dataKey="resolved"
                  name="Resolved"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
        Resolution time uses the last update of a fixed or closed bug as its resolution moment.
      </p>
    </div>
  );
}
