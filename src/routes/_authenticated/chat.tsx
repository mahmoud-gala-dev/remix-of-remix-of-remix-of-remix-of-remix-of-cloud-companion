import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessagesSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { isStaffRole } from "@/lib/permissions";
import { fetchBugs, fetchProfiles, fetchProjects } from "@/lib/api";
import {
  CHAT_PAGE_SIZE,
  activeTypists,
  deleteProjectMessage,
  editProjectMessage,
  fetchChatActivity,
  fetchProjectMessagePage,
  markChannelSeen,
  mentionsUser,
  mergeMessagePages,
  pinnedMessages,
  searchMessages,
  sendProjectMessage,
  setMessagePinned,
  typingLabel,
  unreadByProject,
  uploadChatAttachment,
  type ChatTokenKind,
  type ProjectMessage,
} from "@/lib/chat";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { fetchReactions, groupReactions, toggleReaction } from "@/lib/chat-reactions";
import { ChatSearchBar } from "@/components/chat/ChatSearchBar";
import { ChatPinnedBar } from "@/components/chat/ChatPinnedBar";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatComposer, type MentionSuggestion } from "@/components/chat/ChatComposer";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Team Chat | ElectroPI Bug Tracker" },
      {
        name: "description",
        content:
          "Real-time project chat for ElectroPI teams: discuss bugs, share files, mention teammates, bugs and projects.",
      },
      { property: "og:title", content: "Team Chat | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "Real-time project chat channels with replies, attachments and rich mentions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFound label="page" />,
});

type TypingEvents = Record<string, { username: string; at: number }>;

function ChatPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ProjectMessage | null>(null);
  const [editing, setEditing] = useState<ProjectMessage | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [typingEvents, setTypingEvents] = useState<TypingEvents>({});
  const [typingTick, setTypingTick] = useState(0);
  const [messageSearch, setMessageSearch] = useState("");
  /* Older pages fetched on demand, oldest-first, kept outside the live query cache. */
  const [older, setOlder] = useState<ProjectMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [olderExhausted, setOlderExhausted] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);

  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const profilesQuery = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const bugsQuery = useQuery({ queryKey: ["bugs"], queryFn: fetchBugs, staleTime: 60_000 });
  const activityQuery = useQuery({
    queryKey: ["chat-activity"],
    queryFn: () => fetchChatActivity(),
    refetchInterval: 30_000,
  });

  const projects = useMemo(
    () => (projectsQuery.data ?? []).filter((project) => Number.isFinite(project.id)),
    [projectsQuery.data],
  );

  const unread = useMemo(
    () => unreadByProject(activityQuery.data ?? [], user?.id),
    [activityQuery.data, user?.id],
  );

  useEffect(() => {
    const first = projects[0];
    if (projectId === null && first) setProjectId(Number(first.id));
  }, [projectId, projects]);

  /* Newest page only — older history is paged in explicitly. */
  const messagesQuery = useQuery({
    queryKey: ["project-messages", projectId, CHAT_PAGE_SIZE],
    enabled: projectId !== null,
    queryFn: () => fetchProjectMessagePage(projectId!),
  });

  /* Reset paging state whenever the channel changes. */
  useEffect(() => {
    setOlder([]);
    setOlderCursor(null);
    setOlderExhausted(false);
  }, [projectId]);

  const loadOlder = useMutation({
    mutationFn: async () => {
      if (projectId === null) return null;
      const before = olderCursor ?? messagesQuery.data?.oldestCursor ?? null;
      if (!before) return null;
      return fetchProjectMessagePage(projectId, { before });
    },
    onSuccess: (page) => {
      if (!page) {
        setOlderExhausted(true);
        return;
      }
      setOlder((current) => mergeMessagePages(page.messages, current));
      setOlderCursor(page.oldestCursor);
      if (!page.hasMore || page.messages.length === 0) setOlderExhausted(true);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const profileNames = useMemo(() => {
    const map = new Map<string, string>();
    (profilesQuery.data ?? []).forEach((profile) => map.set(profile.id, profile.username));
    return map;
  }, [profilesQuery.data]);

  useEffect(() => {
    if (projectId === null) return;
    const channel = supabase
      .channel(`project-chat-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_messages",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["project-messages", projectId] });
          queryClient.invalidateQueries({ queryKey: ["chat-activity"] });
          /* Toast for incoming messages from teammates, highlighting @mentions. */
          if (payload.eventType !== "INSERT") return;
          const row = payload.new as Partial<ProjectMessage>;
          if (!row.user_id || row.user_id === user?.id) return;
          const author = profileNames.get(row.user_id) ?? "Member";
          const body = (row.content ?? "").slice(0, 120);
          if (mentionsUser(row.content ?? "", user?.username)) {
            toast.info(t("chat.newMention", { name: author }), { description: body });
          } else {
            toast(t("chat.newMessage", { name: author }), { description: body });
          }
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["chat-reactions"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient, profileNames, user?.id, user?.username, t]);

  /* Typing indicator: a lightweight broadcast channel per project. */
  useEffect(() => {
    if (projectId === null) return;
    setTypingEvents({});
    const channel = supabase
      .channel(`project-typing-${projectId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const data = payload as { userId?: string; username?: string };
        if (!data.userId) return;
        setTypingEvents((current) => ({
          ...current,
          [data.userId!]: { username: data.username ?? "Member", at: Date.now() },
        }));
      })
      .subscribe();
    typingChannelRef.current = channel;

    return () => {
      typingChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  /* Re-evaluate the typing window so stale names disappear. */
  useEffect(() => {
    if (Object.keys(typingEvents).length === 0) return;
    const timer = window.setInterval(() => setTypingTick((tick) => tick + 1), 1500);
    return () => window.clearInterval(timer);
  }, [typingEvents]);

  const typists = useMemo(
    () => activeTypists(typingEvents, user?.id, Date.now() + typingTick * 0),
    [typingEvents, user?.id, typingTick],
  );
  const typing = typingLabel(typists);

  const broadcastTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    void typingChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user?.id, username: user?.username ?? "Member" },
    });
  }, [user?.id, user?.username]);

  const allMessages = useMemo(
    () => mergeMessagePages(older, messagesQuery.data?.messages ?? []),
    [older, messagesQuery.data],
  );
  const messages = useMemo(
    () => searchMessages(allMessages, messageSearch),
    [allMessages, messageSearch],
  );
  const pinned = useMemo(() => pinnedMessages(allMessages), [allMessages]);
  const byId = useMemo(() => {
    const map = new Map<number, ProjectMessage>();
    allMessages.forEach((message) => map.set(Number(message.id), message));
    return map;
  }, [allMessages]);

  const hasMore = Boolean(messagesQuery.data?.hasMore) && !olderExhausted;

  const messageIds = useMemo(
    () => allMessages.map((message) => Number(message.id)),
    [allMessages],
  );
  const reactionsQuery = useQuery({
    queryKey: ["chat-reactions", projectId, messageIds.length],
    queryFn: () => fetchReactions(messageIds),
    enabled: messageIds.length > 0,
  });
  const reactions = reactionsQuery.data ?? [];

  const react = useMutation({
    mutationFn: ({
      messageId,
      emoji,
      existingId,
    }: {
      messageId: number;
      emoji: string;
      existingId?: number | null;
    }) => toggleReaction({ messageId, emoji, existingId: existingId ?? null, userId: user!.id }),
    onSuccess: () => reactionsQuery.refetch(),
    onError: (error: Error) => toast.error(error.message),
  });

  /* Viewing a channel clears its unread badge. */
  useEffect(() => {
    if (projectId === null || messagesQuery.isLoading) return;
    markChannelSeen(projectId);
    queryClient.invalidateQueries({ queryKey: ["chat-activity"] });
  }, [projectId, messages.length, messagesQuery.isLoading, queryClient]);

  const nameFor = useCallback(
    (id: string) => profileNames.get(id) ?? "Member",
    [profileNames],
  );

  /** Autocomplete source for @people, #bugs and ~projects. */
  const suggestionsFor = useCallback(
    (kind: ChatTokenKind, query: string): MentionSuggestion[] => {
      const term = query.toLowerCase();
      if (kind === "user") {
        return (profilesQuery.data ?? [])
          .filter(
            (profile) =>
              profile.id !== user?.id && profile.username.toLowerCase().includes(term),
          )
          .slice(0, 6)
          .map((profile) => ({ kind, value: profile.username, label: profile.username }));
      }
      if (kind === "project") {
        return projects
          .filter(
            (project) =>
              project.key.toLowerCase().includes(term) ||
              project.name.toLowerCase().includes(term),
          )
          .slice(0, 6)
          .map((project) => ({ kind, value: project.key, label: `${project.key} — ${project.name}` }));
      }
      return (bugsQuery.data ?? [])
        .filter(
          (bug) =>
            bug.bug_id.toLowerCase().includes(term) || bug.title.toLowerCase().includes(term),
        )
        .slice(0, 6)
        .map((bug) => ({ kind, value: bug.bug_id, label: `${bug.bug_id} — ${bug.title}` }));
    },
    [bugsQuery.data, profilesQuery.data, projects, user?.id],
  );

  const resetComposer = useCallback(() => {
    setDraft("");
    setReplyTo(null);
    setEditing(null);
    setPendingFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const send = useMutation({
    mutationFn: async () => {
      if (!user?.id || projectId === null) throw new Error("Select a project first.");
      if (editing) {
        await editProjectMessage(Number(editing.id), draft);
        return;
      }
      const attachment = pendingFile
        ? await uploadChatAttachment(pendingFile, { projectId, userId: user.id })
        : null;
      await sendProjectMessage({
        projectId,
        userId: user.id,
        content: draft,
        replyToId: replyTo ? Number(replyTo.id) : null,
        attachment,
      });
    },
    onSuccess: () => {
      resetComposer();
      queryClient.invalidateQueries({ queryKey: ["project-messages", projectId] });
      queryClient.invalidateQueries({ queryKey: ["chat-activity"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteProjectMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-messages", projectId] });
      setOlder((current) => current);
      toast.success(t("chat.deleted"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pin = useMutation({
    mutationFn: ({ id, pinned: next }: { id: number; pinned: boolean }) =>
      setMessagePinned(id, next, user!.id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-messages", projectId] });
      setOlder((current) =>
        current.map((message) =>
          Number(message.id) === variables.id
            ? { ...message, pinned_at: variables.pinned ? new Date().toISOString() : null }
            : message,
        ),
      );
      toast.success(variables.pinned ? t("chat.pinnedToast") : t("chat.unpinnedToast"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activeProject = projects.find((project) => Number(project.id) === projectId);

  const startEdit = useCallback((message: ProjectMessage) => {
    setEditing(message);
    setReplyTo(null);
    setPendingFile(null);
    setDraft(message.content);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const startReply = useCallback((message: ProjectMessage) => {
    setEditing(null);
    setReplyTo(message);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  /** `~KEY` chips jump straight to that project's channel. */
  const openProjectChannel = useCallback(
    (key: string) => {
      const match = projects.find(
        (project) => project.key.toLowerCase() === key.toLowerCase(),
      );
      if (!match) return;
      setProjectId(Number(match.id));
      resetComposer();
    },
    [projects, resetComposer],
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <MessagesSquare className="h-6 w-6" />
          {t("chat.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("chat.subtitle")}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("chat.channels")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {projectsQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("chat.noProjects")}</p>
            ) : (
              projects.map((project) => {
                const count = unread[Number(project.id)] ?? 0;
                const active = Number(project.id) === projectId;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      setProjectId(Number(project.id));
                      resetComposer();
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-3 py-2 text-start text-sm transition-colors",
                      active ? "bg-primary/10 text-primary" : "hover:bg-muted/60",
                    )}
                  >
                    <span className={cn("truncate", count > 0 && !active && "font-semibold")}>
                      {project.name}
                    </span>
                    <span className="ms-2 flex shrink-0 items-center gap-1.5">
                      {count > 0 && !active && (
                        <Badge className="h-5 min-w-5 justify-center px-1 text-[10px]">
                          {count > 99 ? "99+" : count}
                        </Badge>
                      )}
                      <Badge variant="outline">{project.key}</Badge>
                    </span>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[60vh] flex-col border-border/60">
          <CardHeader className="space-y-3 border-b border-border/60 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                {activeProject
                  ? `# ${activeProject.key} — ${activeProject.name}`
                  : t("chat.selectChannel")}
              </CardTitle>
              <ChatSearchBar
                value={messageSearch}
                onChange={setMessageSearch}
                disabled={projectId === null}
              />
            </div>

            {!messageSearch && (
              <ChatPinnedBar
                pinned={pinned}
                currentUserId={user?.id}
                nameFor={nameFor}
                onUnpin={(id) => pin.mutate({ id, pinned: false })}
              />
            )}
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4 pt-4">
            {messageSearch && (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {t("chat.searchResults", { count: messages.length })}
              </p>
            )}

            <ChatMessageList
              messages={messages}
              byId={byId}
              currentUserId={user?.id}
              currentUsername={user?.username}
              nameFor={nameFor}
              mentionsMe={(content) => mentionsUser(content, user?.username)}
              groupsFor={(messageId) => groupReactions(reactions, messageId, user?.id)}
              canDelete={(message) => message.user_id === user?.id || isStaffRole(user?.role)}
              canReact={Boolean(user)}
              isLoading={messagesQuery.isLoading}
              isError={messagesQuery.isError}
              emptyLabel={messageSearch ? t("chat.searchEmpty") : t("chat.empty")}
              hasMore={hasMore && !messageSearch}
              loadingMore={loadOlder.isPending}
              onLoadOlder={() => {
                if (!loadOlder.isPending) loadOlder.mutate();
              }}
              onReply={startReply}
              onEdit={startEdit}
              onDelete={(id) => remove.mutate(id)}
              onPin={(id, next) => pin.mutate({ id, pinned: next })}
              onReact={(messageId, emoji, existingId) =>
                react.mutate({ messageId, emoji, existingId })
              }
              onProjectClick={openProjectChannel}
            />

            <p className="h-4 text-xs text-muted-foreground" aria-live="polite">
              {typing ?? ""}
            </p>

            <ChatComposer
              draft={draft}
              onDraftChange={setDraft}
              disabled={projectId === null}
              sending={send.isPending}
              editing={editing}
              replyTo={replyTo}
              pendingFile={pendingFile}
              replyAuthor={replyTo ? nameFor(replyTo.user_id) : null}
              onCancelContext={() => {
                if (editing) setDraft("");
                setEditing(null);
                setReplyTo(null);
                setPendingFile(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              onPickFile={(file) => {
                setPendingFile(file);
                setEditing(null);
              }}
              onSubmit={() => send.mutate()}
              onTyping={broadcastTyping}
              suggestionsFor={suggestionsFor}
              inputRef={inputRef}
              fileRef={fileRef}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
