import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AtSign, Bug as BugIcon, ClipboardList, Inbox, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { friendlyDbError, statusTone, priorityTone, type Bug, type Task } from "@/lib/api";
import { slaLabel, slaState, slaSummary } from "@/lib/sla";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SlaBadge } from "@/components/bugs/SlaBadge";

export const Route = createFileRoute("/_authenticated/my-work")({
  head: () => ({
    meta: [
      { title: "My Work | ElectroPI Bug Tracker" },
      {
        name: "description",
        content:
          "One screen with the bugs assigned to you, your priority tasks, chat mentions and SLA alerts.",
      },
      { property: "og:title", content: "My Work | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "Your assigned bugs, tasks, mentions and SLA alerts in a single view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyWorkPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFound label="page" />,
});

async function fetchMyBugs(userId: string): Promise<Bug[]> {
  const { data, error } = await supabase
    .from("bugs")
    .select("*")
    .or(`assigned_to.eq.${userId},reported_by.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(friendlyDbError(error));
  return data ?? [];
}

async function fetchMyTasks(userId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("assigned_to", userId)
    .neq("status", "Done")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(friendlyDbError(error));
  return data ?? [];
}

async function fetchMyMentions(userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .in("type", ["chat_mention", "sla_breach", "assignment", "task_assignment"])
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(friendlyDbError(error));
  return data ?? [];
}

function SectionCard({
  title,
  description,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  description: string;
  icon: typeof BugIcon;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" aria-hidden="true" />
          {title}
          <Badge variant="secondary" className="ms-auto">
            {count}
          </Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function MyWorkPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const userId = user?.id ?? "";

  const bugsQuery = useQuery({
    queryKey: ["my-work-bugs", userId],
    enabled: Boolean(userId),
    queryFn: () => fetchMyBugs(userId),
  });
  const tasksQuery = useQuery({
    queryKey: ["my-work-tasks", userId],
    enabled: Boolean(userId),
    queryFn: () => fetchMyTasks(userId),
  });
  const inboxQuery = useQuery({
    queryKey: ["my-work-inbox", userId],
    enabled: Boolean(userId),
    queryFn: () => fetchMyMentions(userId),
  });

  const bugs = bugsQuery.data ?? [];
  const openBugs = useMemo(
    () => bugs.filter((bug) => slaState(bug) !== "resolved"),
    [bugs],
  );
  const aging = useMemo(() => slaSummary(openBugs), [openBugs]);
  const atRisk = useMemo(
    () =>
      openBugs
        .filter((bug) => ["breached", "at-risk"].includes(slaState(bug)))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(0, 8),
    [openBugs],
  );

  const loading = bugsQuery.isLoading || tasksQuery.isLoading || inboxQuery.isLoading;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("myWork.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("myWork.description")}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: t("myWork.stat.openBugs"), value: openBugs.length },
          { label: t("myWork.stat.breached"), value: aging.breached },
          { label: t("myWork.stat.atRisk"), value: aging.atRisk },
          { label: t("myWork.stat.openTasks"), value: (tasksQuery.data ?? []).length },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/60">
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard
            title={t("myWork.bugs.title")}
            description={t("myWork.bugs.description")}
            icon={BugIcon}
            count={openBugs.length}
          >
            {openBugs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("myWork.bugs.empty")}</p>
            ) : (
              openBugs.slice(0, 10).map((bug) => (
                <Link
                  key={bug.id}
                  to="/bugs/$bugId"
                  params={{ bugId: String(bug.id) }}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm transition-colors hover:bg-muted/60"
                >
                  <span className="font-mono text-xs text-muted-foreground">{bug.bug_id}</span>
                  <span className="min-w-0 flex-1 truncate">{bug.title}</span>
                  <Badge variant="outline" className={priorityTone(bug.priority)}>
                    {bug.priority}
                  </Badge>
                  <Badge variant="outline" className={statusTone(bug.status)}>
                    {bug.status}
                  </Badge>
                  <SlaBadge bug={bug} />
                </Link>
              ))
            )}
          </SectionCard>

          <SectionCard
            title={t("myWork.tasks.title")}
            description={t("myWork.tasks.description")}
            icon={ClipboardList}
            count={(tasksQuery.data ?? []).length}
          >
            {(tasksQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("myWork.tasks.empty")}</p>
            ) : (
              (tasksQuery.data ?? []).slice(0, 10).map((task) => (
                <Link
                  key={task.id}
                  to="/tasks"
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm transition-colors hover:bg-muted/60"
                >
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                  {task.is_important && <Badge variant="destructive">{t("myWork.tasks.important")}</Badge>}
                  <Badge variant="outline">{task.priority}</Badge>
                  <Badge variant="outline">{task.status}</Badge>
                </Link>
              ))
            )}
          </SectionCard>

          <SectionCard
            title={t("myWork.inbox.title")}
            description={t("myWork.inbox.description")}
            icon={Inbox}
            count={(inboxQuery.data ?? []).length}
          >
            {(inboxQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("myWork.inbox.empty")}</p>
            ) : (
              (inboxQuery.data ?? []).slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
                >
                  {item.type === "chat_mention" ? (
                    <AtSign className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  ) : (
                    <ShieldAlert
                      className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{item.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                  {item.bug_id && (
                    <Link
                      to="/bugs/$bugId"
                      params={{ bugId: String(item.bug_id) }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {t("myWork.inbox.open")}
                    </Link>
                  )}
                </div>
              ))
            )}
          </SectionCard>

          <SectionCard
            title={t("myWork.sla.title")}
            description={t("myWork.sla.description")}
            icon={ShieldAlert}
            count={atRisk.length}
          >
            {atRisk.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("myWork.sla.empty")}</p>
            ) : (
              atRisk.map((bug) => (
                <Link
                  key={bug.id}
                  to="/bugs/$bugId"
                  params={{ bugId: String(bug.id) }}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm transition-colors hover:bg-muted/60"
                >
                  <span className="font-mono text-xs text-muted-foreground">{bug.bug_id}</span>
                  <span className="min-w-0 flex-1 truncate">{bug.title}</span>
                  <span className="text-xs text-muted-foreground">{slaLabel(bug)}</span>
                  <SlaBadge bug={bug} />
                </Link>
              ))
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
