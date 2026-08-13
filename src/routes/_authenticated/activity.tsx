import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Bug, MessageSquare, MessagesSquare, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";
import { fetchActivity, timeAgo, type ActivityItem } from "@/lib/activity";
import { fetchProfiles } from "@/lib/api";
import { useI18n, type TranslationKey } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Team Activity Feed | ElectroPI Bug Tracker" },
      {
        name: "description",
        content:
          "Live feed of bug status changes, comments and project chat messages across the team.",
      },
      { property: "og:title", content: "Team Activity Feed | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "Follow bug updates, comments and chat activity as they happen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivityPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFound label="activity feed" />,
});

const kindMeta: Record<ActivityItem["kind"], { labelKey: TranslationKey; icon: typeof Bug }> = {
  history: { labelKey: "activity.kind.history", icon: Bug },
  comment: { labelKey: "activity.kind.comment", icon: MessageSquare },
  chat: { labelKey: "activity.kind.chat", icon: MessagesSquare },
};

const PAGE_SIZE = 20;

function ActivityPage() {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["activity-feed", page],
    queryFn: () => fetchActivityPage(page, PAGE_SIZE),
    refetchInterval: 60_000,
    placeholderData: (previous) => previous,
  });

  const items = data?.items ?? [];
  const hasMore = data?.hasMore ?? false;

  const { data: profiles } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const nameFor = (userId: string | null) =>
    (userId ? profiles?.find((p) => p.id === userId)?.username : null) ?? t("common.someone");


  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
              {t("activity.title")}
            </CardTitle>
            <CardDescription>
              {t("activity.description")}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw
              className={`me-1.5 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {t("common.refresh")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          )}

          {error && (
            <p className="py-8 text-center text-sm text-destructive">{(error as Error).message}</p>
          )}

          {!isLoading && !error && (items ?? []).length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("activity.empty")}
            </p>
          )}

          {(items ?? []).map((item) => {
            const meta = kindMeta[item.kind];
            const Icon = meta.icon;
            return (
              <article
                key={item.id}
                className="flex gap-3 rounded-lg border border-border/60 bg-card p-3"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{nameFor(item.userId)}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {t(meta.labelKey)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-foreground">{item.title}</p>
                  {item.detail && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {item.detail}
                    </p>
                  )}
                  {item.bugId !== null && (
                    <Link
                      to="/bugs/$id"
                      params={{ id: String(item.bugId) }}
                      className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
                    >
                      {t("activity.openBug")}
                    </Link>
                  )}
                  {item.projectId !== null && (
                    <Link to="/chat" className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                      {t("activity.openChat")}
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
