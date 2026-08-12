import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Bug as BugIcon,
  Lightbulb,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { isStaffRole } from "@/lib/permissions";
import { fetchProfiles, fetchProjects } from "@/lib/api";
import { usePasteScreenshot } from "@/hooks/usePasteScreenshot";
import {
  IMPROVEMENT_PRIORITIES,
  IMPROVEMENT_STATUSES,
  addImprovementComment,
  createImprovement,
  deleteImprovement,
  deleteImprovementComment,
  fetchImprovementComments,
  fetchImprovements,
  improvementMediaUrl,
  statusTone,
  updateImprovement,
  uploadImprovementMedia,
  type Improvement,
} from "@/lib/improvements";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/improvements")({
  head: () => ({
    meta: [
      { title: "Script Improvements | ElectroPI Bug Tracker" },
      {
        name: "description",
        content:
          "Suggest script improvements or report defects with screenshots and short videos, then discuss them with the admin team.",
      },
      { property: "og:title", content: "Script Improvements | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "Team-wide improvement and defect suggestions with media attachments and comments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImprovementsPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFound label="page" />,
});

function MediaLink({ path, name }: { path: string; name: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
      onClick={async () => {
        setBusy(true);
        try {
          const url = await improvementMediaUrl(path);
          window.open(url, "_blank", "noopener,noreferrer");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not open the file.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Paperclip className="h-3.5 w-3.5" />
      )}
      <span className="max-w-[220px] truncate">{name}</span>
    </button>
  );
}

function Discussion({
  improvementId,
  nameFor,
}: {
  improvementId: number;
  nameFor: (id: string) => string;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["improvement-comments", improvementId],
    queryFn: () => fetchImprovementComments(improvementId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["improvement-comments", improvementId] });

  const add = useMutation({
    mutationFn: () =>
      addImprovementComment({ improvementId, userId: user!.id, content: draft }),
    onSuccess: () => {
      setDraft("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteImprovementComment(id),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" />
        {t("improvements.discussion")} {comments.length > 0 ? `(${comments.length})` : ""}
      </p>
      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("improvements.noComments")}</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{nameFor(comment.user_id)}</span>
                <span>
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
                {(comment.user_id === user?.id || isStaffRole(user?.role)) && (
                  <button
                    type="button"
                    aria-label={t("common.delete")}
                    className="ms-auto text-destructive"
                    onClick={() => remove.mutate(Number(comment.id))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap">{comment.content}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Textarea
          value={draft}
          rows={1}
          placeholder={t("improvements.commentPlaceholder")}
          onChange={(event) => setDraft(event.target.value)}
          className="min-h-9 resize-none"
        />
        <Button
          size="icon"
          aria-label={t("improvements.addComment")}
          disabled={!draft.trim() || add.isPending || !user}
          onClick={() => add.mutate()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ImprovementsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const staff = isStaffRole(user?.role);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState("improvement");
  const [priority, setPriority] = useState("Medium");
  const [projectId, setProjectId] = useState("none");
  const [file, setFile] = useState<File | null>(null);
  const [filter, setFilter] = useState("All");

  const { pastedFile, clear } = usePasteScreenshot();
  useEffect(() => {
    if (pastedFile) {
      setFile(pastedFile);
      clear();
      toast.success(t("improvements.screenshotAttached"));
    }
  }, [pastedFile, clear, t]);

  const { data: improvements = [], isLoading } = useQuery({
    queryKey: ["improvements"],
    queryFn: fetchImprovements,
  });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });

  useEffect(() => {
    const channel = supabase
      .channel("improvements-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "improvements" }, () => {
        queryClient.invalidateQueries({ queryKey: ["improvements"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const nameFor = (id: string) =>
    profiles.find((profile) => profile.id === id)?.username ?? t("common.someone");

  const visible = useMemo(
    () => (filter === "All" ? improvements : improvements.filter((item) => item.status === filter)),
    [improvements, filter],
  );

  const create = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sign in first.");
      const attachment = file ? await uploadImprovementMedia(file, user.id) : null;
      await createImprovement({
        title,
        description,
        kind,
        priority,
        projectId: projectId === "none" ? null : Number(projectId),
        userId: user.id,
        attachment,
      });
    },
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setFile(null);
      setPriority("Medium");
      setKind("improvement");
      toast.success(t("improvements.created"));
      queryClient.invalidateQueries({ queryKey: ["improvements"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const patch = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      updateImprovement(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["improvements"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteImprovement(id),
    onSuccess: () => {
      toast.success(t("improvements.deleted"));
      queryClient.invalidateQueries({ queryKey: ["improvements"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const canManage = (item: Improvement) => staff || item.created_by === user?.id;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Lightbulb className="h-6 w-6" />
          {t("improvements.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("improvements.subtitle")}</p>
      </header>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("improvements.newTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_180px]">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("improvements.field.title")}
              maxLength={160}
            />
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger aria-label={t("improvements.field.kind")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="improvement">{t("improvements.kind.improvement")}</SelectItem>
                <SelectItem value="bug">{t("improvements.kind.bug")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger aria-label={t("improvements.field.priority")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMPROVEMENT_PRIORITIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger aria-label={t("improvements.field.project")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("improvements.noProject")}</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder={t("improvements.field.description")}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
              <Upload className="h-4 w-4" />
              {t("improvements.attach")}
              <input
                type="file"
                accept="image/*,video/*,application/pdf"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <span className="text-xs text-muted-foreground">
              {file ? file.name : t("improvements.pasteHint")}
            </span>
            <Button
              className="ms-auto"
              disabled={!title.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? (
                <Loader2 className="me-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Send className="me-1.5 h-4 w-4" />
              )}
              {t("improvements.submit")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t("improvements.filter")}</span>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44" aria-label={t("improvements.filter")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">{t("improvements.allStatuses")}</SelectItem>
            {IMPROVEMENT_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("improvements.empty")}
        </p>
      ) : (
        <div className="space-y-4">
          {visible.map((item) => (
            <Card key={item.id} className="border-border/60">
              <CardContent className="pt-5">
                <div className="flex flex-wrap items-start gap-2">
                  <Badge variant="outline" className="gap-1">
                    {item.kind === "bug" ? (
                      <BugIcon className="h-3 w-3" />
                    ) : (
                      <Lightbulb className="h-3 w-3" />
                    )}
                    {item.kind === "bug"
                      ? t("improvements.kind.bug")
                      : t("improvements.kind.improvement")}
                  </Badge>
                  <Badge variant="outline" className={statusTone(item.status)}>
                    {item.status}
                  </Badge>
                  <Badge variant="outline">{item.priority}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {nameFor(item.created_by)} ·{" "}
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                  <div className="ms-auto flex items-center gap-2">
                    {staff && (
                      <Select
                        value={item.status}
                        onValueChange={(status) => patch.mutate({ id: Number(item.id), status })}
                      >
                        <SelectTrigger className="h-8 w-36" aria-label={t("improvements.status")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {IMPROVEMENT_STATUSES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {canManage(item) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        aria-label={t("common.delete")}
                        onClick={() => remove.mutate(Number(item.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <h2 className="mt-2 text-base font-semibold text-foreground">{item.title}</h2>
                {item.description && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {item.description}
                  </p>
                )}
                {item.attachment_path && (
                  <MediaLink
                    path={item.attachment_path}
                    name={item.attachment_name ?? t("chat.attachment")}
                  />
                )}
                <Discussion improvementId={Number(item.id)} nameFor={nameFor} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
