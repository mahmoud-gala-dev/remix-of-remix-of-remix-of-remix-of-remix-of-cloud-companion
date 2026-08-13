import { useCallback, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import {
  BUG_DETAIL_SHORTCUTS,
  KeyboardShortcutsDialog,
} from "@/components/common/KeyboardShortcutsDialog";


import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { canEditBug, canChangeBugStatus, canViewBug } from "@/lib/permissions";
import { fetchProfiles, statusTone, priorityTone, type Bug } from "@/lib/api";
import { profilesToMap } from "@/components/bugs/types";
import { BugQuickStatus } from "@/components/bugs/BugQuickStatus";
import { BugInfoPanel } from "@/components/bugs/BugInfoPanel";
import { BugAttachments } from "@/components/bugs/BugAttachments";
import { BugComments } from "@/components/bugs/BugComments";
import { BugDevNotes } from "@/components/bugs/BugDevNotes";
import { BugAiPrompt } from "@/components/bugs/BugAiPrompt";

import { BugRelated } from "@/components/bugs/BugRelated";
import { BugHistoryTimeline } from "@/components/bugs/BugHistoryTimeline";
import { fetchBugIdOrder, readBugNavFilters } from "@/lib/bug-nav";
import { BugAssistance } from "@/components/bugs/BugAssistance";
import { BugStatsStrip } from "@/components/bugs/BugStatsStrip";
import { BugResolutionTimer } from "@/components/bugs/BugResolutionTimer";
import { BugNextTen } from "@/components/bugs/BugNextTen";

export const Route = createFileRoute("/_authenticated/bugs/$id")({
  head: () => ({
    meta: [
      { title: "Bug Details | ElectroPI Bug Tracker" },
      {
        name: "description",
        content: "View and manage bug details, comments, attachments and history.",
      },
      { property: "og:title", content: "Bug Details | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "View and manage bug details, comments, attachments and history.",
      },
    ],
  }),
  component: BugDetailPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFound label="bug" />,
});

function BugDetailPage() {
  const { t } = useI18n();
  const { id } = Route.useParams();
  const bugId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);


  const { data: bug, isLoading } = useQuery({
    queryKey: ["bug", bugId],
    queryFn: async () => {
      const { data, error } = await supabase.from("bugs").select("*").eq("id", bugId).maybeSingle();
      if (error) throw error;
      return data as Bug | null;
    },
    enabled: Number.isFinite(bugId),
  });

  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const profileMap = profilesToMap(profiles);

  // Ordered list of bug ids honouring the filters/search saved by the bugs list,
  // so previous / next walks the same records the user was browsing.
  const navFilters = useMemo(() => readBugNavFilters(), []);
  const { data: bugOrder = [] } = useQuery({
    queryKey: ["bug-order", navFilters],
    queryFn: () => fetchBugIdOrder(navFilters),
  });

  const currentIndex = bugOrder.indexOf(bugId);
  const prevBugId = currentIndex > 0 ? bugOrder[currentIndex - 1] : null;
  const nextBugId =
    currentIndex >= 0 && currentIndex < bugOrder.length - 1 ? bugOrder[currentIndex + 1] : null;

  const deleteBug = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("bugs").delete().eq("id", bugId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bugs"] });
      toast.success("Bug deleted");
      navigate({ to: "/bugs" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const goToBug = useCallback(
    (target: number | null | undefined) => {
      if (!target) return;
      navigate({ to: "/bugs/$id", params: { id: String(target) } });
    },
    [navigate],
  );

  const scrollToSelector = useCallback((selector: string) => {
    const el = document.querySelector(selector);
    if (!(el instanceof HTMLElement)) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) el.focus();
  }, []);

  const shortcuts = useMemo(
    () => ({
      ArrowLeft: () => goToBug(prevBugId),
      ArrowRight: () => goToBug(nextBugId),
      k: () => goToBug(prevBugId),
      j: () => goToBug(nextBugId),
      b: () => navigate({ to: "/bugs" }),
      n: () => navigate({ to: "/bugs/new" }),
      g: () => navigate({ to: "/dashboard" }),
      c: () => scrollToSelector("textarea"),
      e: () => scrollToSelector("h1"),
      d: () => setDeleteOpen(true),
      r: () => {
        queryClient.invalidateQueries({ queryKey: ["bug", bugId] });
        toast.success("Bug refreshed");
      },
      "?": () => setShortcutsOpen(true),
      Escape: () => {
        setShortcutsOpen(false);
        setDeleteOpen(false);
      },
    }),
    [goToBug, prevBugId, nextBugId, navigate, scrollToSelector, queryClient, bugId],
  );

  useKeyboardShortcuts(shortcuts);


  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!bug) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <p className="text-lg font-medium text-foreground">Bug not found</p>
        <p className="text-sm text-muted-foreground">
          This bug may have been deleted or the link is incorrect.
        </p>
        <Button asChild variant="outline">
          <Link to="/bugs">
            <ArrowLeft className="me-1.5 h-4 w-4" /> Back to bugs
          </Link>
        </Button>
      </div>
    );
  }

  const canView = canViewBug(bug, user);
  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <p className="text-lg font-medium text-foreground">Access Restricted</p>
        <p className="text-sm text-muted-foreground">
          This bug is assigned to another developer and cannot be viewed.
        </p>
        <Button asChild variant="outline">
          <Link to="/bugs">
            <ArrowLeft className="me-1.5 h-4 w-4" /> Back to bugs
          </Link>
        </Button>
      </div>
    );
  }

  const isReporter = user?.id === bug.reported_by;
  const isStaff = user?.role === "admin" || user?.role === "supervisor";
  const canEdit = canEditBug(bug, user);
  const canChangeStatus = canChangeBugStatus(bug, user);
  const canDelete = isReporter || isStaff;
  const canManageRelated =
    user?.role === "tester" ||
    user?.role === "developer" ||
    user?.role === "admin" ||
    user?.role === "supervisor";
  const canTrackResolutionTime =
    user?.role === "developer" && (!bug.assigned_to || bug.assigned_to === user.id);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/bugs">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-muted-foreground">{bug.bug_id}</span>
              <BugQuickStatus
                bugId={bug.id}
                status={bug.status}
                canEdit={canChangeStatus}
                size="sm"
              />
              <Badge variant="outline" className={priorityTone(bug.priority)}>
                {bug.priority}
              </Badge>
            </div>
            <h1 className="text-xl font-semibold text-foreground">{bug.title}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <KeyboardShortcutsDialog
            shortcuts={BUG_DETAIL_SHORTCUTS}
            open={shortcutsOpen}
            onOpenChange={setShortcutsOpen}
          />
          <div className="flex items-center gap-1">

            <Button
              variant="outline"
              size="sm"
              disabled={!prevBugId}
              onClick={() =>
                prevBugId && navigate({ to: "/bugs/$id", params: { id: String(prevBugId) } })
              }
            >
              <ChevronLeft className="me-1 h-4 w-4" /> {t("common.previous")}
            </Button>
            {currentIndex >= 0 && bugOrder.length > 0 && (
              <span className="px-1 text-xs text-muted-foreground">
                {currentIndex + 1} / {bugOrder.length}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={!nextBugId}
              onClick={() =>
                nextBugId && navigate({ to: "/bugs/$id", params: { id: String(nextBugId) } })
              }
            >
              {t("common.next")} <ChevronRight className="ms-1 h-4 w-4" />
            </Button>
          </div>

          {canDelete && (
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="me-1.5 h-3.5 w-3.5" /> {t("bug.delete")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("bug.delete.title")}</AlertDialogTitle>
                <AlertDialogDescription>{t("bug.delete.body")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteBug.mutate()}>{t("common.delete")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          )}
        </div>
      </div>

      {/* Dynamic stats strip — re-renders automatically when bug query is invalidated */}
      <BugStatsStrip bug={bug} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <BugInfoPanel
            bug={bug}
            profiles={profiles}
            profileMap={profileMap}
            canEdit={canEdit}
            canEditStatus={canChangeStatus}
          />
          <BugDevNotes
            bugId={bug.id}
            currentUserId={user?.id ?? null}
            canWrite={canEdit || canTrackResolutionTime}
            profileMap={profileMap}
          />
          {user?.role === "developer" && <BugAiPrompt bug={bug} />}
          <BugComments bugId={bug.id} currentUserId={user?.id ?? null} profileMap={profileMap} />
          <BugAttachments bugId={bug.id} />


        </div>
        <div className="space-y-6">
          <BugResolutionTimer
            bugId={bug.id}
            userId={user?.id ?? null}
            canTrack={canTrackResolutionTime}
          />
          <BugRelated bugId={bug.id} canManage={canManageRelated} />
          <BugAssistance
            bugId={bug.id}
            currentUserId={user?.id ?? null}
            profiles={profiles}
            profileMap={profileMap}
          />
          <BugHistoryTimeline bugId={bug.id} profileMap={profileMap} />
        </div>
      </div>

      {/* Next 10 bugs in the same filtered order the user was browsing */}
      <BugNextTen
        currentId={bug.id}
        order={bugOrder}
        label={t("bug.nextTen")}
        emptyLabel={t("bug.nextTen.empty")}
      />
    </div>
  );
}
