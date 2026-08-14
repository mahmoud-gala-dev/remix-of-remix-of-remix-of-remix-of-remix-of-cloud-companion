import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown, Timer, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { isMonitorRole, isStaffRole } from "@/lib/permissions";
import { fetchProfiles, fetchUserRoleMap } from "@/lib/api";
import { fetchResolutionAnalytics, formatDuration } from "@/lib/bug-time";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/resolution-times")({
  head: () => ({
    meta: [
      { title: "Resolution Times | ElectroPI Bug Tracker" },
      {
        name: "description",
        content:
          "Total bug resolution time logged by each developer, ranked from the highest, with a per-bug breakdown for admins, monitors and supervisors.",
      },
      { property: "og:title", content: "Resolution Times | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "Developer resolution-time leaderboard and per-bug time log breakdown.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResolutionTimesPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFound label="page" />,
});

/** Admins, supervisors, auditors, monitors and testers see every developer's total. */
function canSeeEveryone(role: string | null | undefined) {
  return isStaffRole(role) || isMonitorRole(role) || role === "tester";
}

function ResolutionTimesPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const seeAll = canSeeEveryone(user?.role);

  const analytics = useQuery({
    queryKey: ["resolution-analytics"],
    queryFn: fetchResolutionAnalytics,
  });
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const roles = useQuery({ queryKey: ["user-role-map"], queryFn: fetchUserRoleMap });

  const rows = useMemo(() => {
    const all = analytics.data?.rows ?? [];
    return seeAll ? all : all.filter((row) => row.developerId === user?.id);
  }, [analytics.data, seeAll, user?.id]);

  const leaderboard = useMemo(() => {
    const map = new Map<
      string,
      { developerId: string; name: string; role: string; totalSeconds: number; bugs: number }
    >();
    for (const row of rows) {
      const current = map.get(row.developerId) ?? {
        developerId: row.developerId,
        name:
          profiles.data?.find((profile) => profile.id === row.developerId)?.username ??
          row.developerName,
        role: roles.data?.[row.developerId] ?? "developer",
        totalSeconds: 0,
        bugs: 0,
      };
      current.totalSeconds += row.totalSeconds;
      current.bugs += 1;
      map.set(row.developerId, current);
    }
    return Array.from(map.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [rows, profiles.data, roles.data]);

  const grandTotal = leaderboard.reduce((sum, entry) => sum + entry.totalSeconds, 0);
  const topEntry = leaderboard[0];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Timer className="h-6 w-6" />
          {t("resolution.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {seeAll
            ? t("resolution.subtitleAll")
            : t("resolution.subtitleOwn")}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("resolution.totalLogged")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {formatDuration(grandTotal)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("resolution.developersTracked")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{leaderboard.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Crown className="h-4 w-4" />
              {t("resolution.highestTime")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="truncate text-lg font-semibold">{topEntry?.name ?? "—"}</p>
            <p className="font-mono text-sm text-muted-foreground tabular-nums">
              {topEntry ? formatDuration(topEntry.totalSeconds) : "00:00:00"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            {t("resolution.leaderboard")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : leaderboard.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("resolution.empty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-start text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="py-2 font-medium">#</th>
                    <th className="py-2 font-medium">{t("resolution.col.developer")}</th>
                    <th className="py-2 font-medium">{t("resolution.col.role")}</th>
                    <th className="py-2 font-medium">{t("resolution.col.bugs")}</th>
                    <th className="py-2 text-end font-medium">{t("resolution.col.totalTime")}</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, index) => (
                    <tr key={entry.developerId} className="border-b border-border/40 last:border-0">
                      <td className="py-2 tabular-nums">{index + 1}</td>
                      <td className="py-2 font-medium">
                        {entry.name}
                        {index === 0 && (
                          <Crown className="ms-1.5 inline h-3.5 w-3.5 text-amber-500" />
                        )}
                      </td>
                      <td className="py-2">
                        <Badge variant="outline">{entry.role}</Badge>
                      </td>
                      <td className="py-2 tabular-nums">{entry.bugs}</td>
                      <td className="py-2 text-end font-mono tabular-nums">
                        {formatDuration(entry.totalSeconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">{t("resolution.perBug")}</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("resolution.perBugEmpty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-start text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="py-2 font-medium">{t("resolution.col.bug")}</th>
                    <th className="py-2 font-medium">{t("resolution.col.title")}</th>
                    <th className="py-2 font-medium">{t("resolution.col.module")}</th>
                    <th className="py-2 font-medium">{t("resolution.col.developer")}</th>
                    <th className="py-2 text-end font-medium">{t("resolution.col.time")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows]
                    .sort((a, b) => b.totalSeconds - a.totalSeconds)
                    .map((row) => (
                      <tr
                        key={`${row.bugId}-${row.developerId}`}
                        className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-2 font-mono text-xs">
                          <Link
                            to="/bugs/$id"
                            params={{ id: String(row.bugId) }}
                            className="font-semibold text-primary hover:underline inline-flex items-center"
                          >
                            {row.bugCode}
                          </Link>
                        </td>
                        <td className="max-w-[280px] truncate py-2">
                          <Link
                            to="/bugs/$id"
                            params={{ id: String(row.bugId) }}
                            className="hover:underline hover:text-primary transition-colors block truncate"
                            title={row.title}
                          >
                            {row.title}
                          </Link>
                        </td>
                        <td className="py-2">{row.module}</td>
                        <td className="py-2">{row.developerName}</td>
                        <td className="py-2 text-end font-mono tabular-nums">
                          {formatDuration(row.totalSeconds)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
