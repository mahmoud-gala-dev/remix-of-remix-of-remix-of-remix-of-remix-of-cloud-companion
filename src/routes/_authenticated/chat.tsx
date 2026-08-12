import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AtSign,
  Loader2,
  MessagesSquare,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Reply,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { isStaffRole } from "@/lib/permissions";
import { fetchProfiles, fetchProjects } from "@/lib/api";
import {
  activeMentionQuery,
  activeTypists,
  applyMention,
  chatAttachmentUrl,
  deleteProjectMessage,
  editProjectMessage,
  fetchChatActivity,
  fetchProjectMessages,
  markChannelSeen,
  mentionsUser,
  messageDay,
  messageTime,
  sendProjectMessage,
  splitMentions,
  typingLabel,
  unreadByProject,
  uploadChatAttachment,
  type ProjectMessage,
} from "@/lib/chat";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { EmojiPicker } from "@/components/chat/EmojiPicker";
import {
  QUICK_REACTIONS,
  fetchReactions,
  groupReactions,
  toggleReaction,
} from "@/lib/chat-reactions";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Team Chat | ElectroPI Bug Tracker" },
      {
        name: "description",
        content:
          "Real-time project chat for ElectroPI teams: discuss bugs, share files, reply to teammates and see who is typing.",
      },
      { property: "og:title", content: "Team Chat | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "Real-time project chat channels with replies, attachments and typing indicators.",
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

function AttachmentLink({ path, name }: { path: string; name: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      const url = await chatAttachmentUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("chat.openFileError"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={open}
      className="mt-1 flex max-w-full items-center gap-1.5 rounded-md border border-current/25 px-2 py-1 text-xs underline-offset-2 hover:underline"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span className="truncate">{name}</span>
    </button>
  );
}

function ChatPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ProjectMessage | null>(null);
  const [editing, setEditing] = useState<ProjectMessage | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [typingEvents, setTypingEvents] = useState<TypingEvents>({});
  const [typingTick, setTypingTick] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);

  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const profilesQuery = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
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

  const messagesQuery = useQuery({
    queryKey: ["project-messages", projectId],
    enabled: projectId !== null,
    queryFn: () => fetchProjectMessages(projectId!),
  });

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
        () => {
          queryClient.invalidateQueries({ queryKey: ["project-messages", projectId] });
          queryClient.invalidateQueries({ queryKey: ["chat-activity"] });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["chat-reactions"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);

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

  const messages = messagesQuery.data ?? [];
  const byId = useMemo(() => {
    const map = new Map<number, ProjectMessage>();
    messages.forEach((message) => map.set(Number(message.id), message));
    return map;
  }, [messages]);

  const messageIds = useMemo(() => messages.map((message) => Number(message.id)), [messages]);
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, projectId]);

  /* Viewing a channel clears its unread badge. */
  useEffect(() => {
    if (projectId === null || messagesQuery.isLoading) return;
    markChannelSeen(projectId);
    queryClient.invalidateQueries({ queryKey: ["chat-activity"] });
  }, [projectId, messages.length, messagesQuery.isLoading, queryClient]);

  const nameFor = (id: string) =>
    profilesQuery.data?.find((profile) => profile.id === id)?.username ?? "Member";

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const term = mentionQuery.toLowerCase();
    return (profilesQuery.data ?? [])
      .filter((profile) => profile.id !== user?.id && profile.username.toLowerCase().includes(term))
      .slice(0, 6);
  }, [mentionQuery, profilesQuery.data, user?.id]);

  const syncMentionQuery = useCallback((value: string, caret: number) => {
    setMentionQuery(activeMentionQuery(value, caret));
  }, []);

  const pickMention = useCallback(
    (username: string) => {
      const caret = inputRef.current?.selectionStart ?? draft.length;
      const next = applyMention(draft, caret, username);
      setDraft(next.value);
      setMentionQuery(null);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(next.caret, next.caret);
      });
    },
    [draft],
  );

  const resetComposer = () => {
    setDraft("");
    setMentionQuery(null);
    setReplyTo(null);
    setEditing(null);
    setPendingFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

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
      toast.success(t("chat.deleted"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activeProject = projects.find((project) => Number(project.id) === projectId);
  const canSubmit =
    projectId !== null && (draft.trim().length > 0 || (!editing && pendingFile !== null));

  const startEdit = (message: ProjectMessage) => {
    setEditing(message);
    setReplyTo(null);
    setPendingFile(null);
    setDraft(message.content);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

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
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-base">
              {activeProject ? `# ${activeProject.key} — ${activeProject.name}` : t("chat.selectChannel")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4 pt-4">
            <div className="flex-1 space-y-3 overflow-y-auto pe-1" style={{ maxHeight: "52vh" }}>
              {messagesQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : messagesQuery.isError ? (
                <p className="py-10 text-center text-sm text-destructive">
                  {t("chat.loadError")}
                </p>
              ) : messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {t("chat.empty")}
                </p>
              ) : (
                messages.map((message, index) => {
                  const mine = message.user_id === user?.id;
                  const showDay =
                    index === 0 ||
                    messageDay(messages[index - 1]?.created_at ?? message.created_at) !==
                      messageDay(message.created_at);
                  const author = nameFor(message.user_id);
                  const forMe = !mine && mentionsUser(message.content, user?.username);
                  const parent = message.reply_to_id ? byId.get(Number(message.reply_to_id)) : null;
                  return (
                    <div key={message.id} className="space-y-3">
                      {showDay && (
                        <div className="flex items-center justify-center">
                          <span className="rounded-full bg-muted px-3 py-0.5 text-xs text-muted-foreground">
                            {messageDay(message.created_at)}
                          </span>
                        </div>
                      )}
                      <div className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs">
                            {author.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={cn(
                            "group max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                            mine
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground",
                            forMe && "ring-2 ring-primary/50",
                          )}
                        >
                          <div className="mb-0.5 flex items-center gap-2 text-xs opacity-75">
                            <span className="font-medium">{mine ? t("chat.you") : author}</span>
                            <span>{messageTime(message.created_at)}</span>
                            {message.edited_at && <span>{t("chat.edited")}</span>}
                            {forMe && (
                              <span className="flex items-center gap-0.5 font-medium">
                                <AtSign className="h-3 w-3" aria-hidden="true" />
                                {t("chat.mentionedYou")}
                              </span>
                            )}
                            <button
                              type="button"
                              aria-label={t("chat.reply")}
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={() => {
                                setEditing(null);
                                setReplyTo(message);
                                requestAnimationFrame(() => inputRef.current?.focus());
                              }}
                            >
                              <Reply className="h-3 w-3" />
                            </button>
                            {mine && (
                              <button
                                type="button"
                                aria-label={t("chat.edit")}
                                className="opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={() => startEdit(message)}
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                            {(mine || isStaffRole(user?.role)) && (
                              <button
                                type="button"
                                aria-label={t("chat.deleteMessage")}
                                className="opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={() => remove.mutate(Number(message.id))}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>

                          {parent && (
                            <div
                              className={cn(
                                "mb-1 rounded-md border-s-2 px-2 py-1 text-xs",
                                mine
                                  ? "border-primary-foreground/50 bg-primary-foreground/10"
                                  : "border-primary/50 bg-background/60",
                              )}
                            >
                              <span className="font-medium">
                                {parent.user_id === user?.id ? t("chat.you") : nameFor(parent.user_id)}
                              </span>
                              <span className="ms-1 line-clamp-2 opacity-80">{parent.content}</span>
                            </div>
                          )}

                          <p className="whitespace-pre-wrap break-words">
                            {splitMentions(message.content).map((part, partIndex) =>
                              part.mention ? (
                                <span
                                  key={partIndex}
                                  className={cn(
                                    "rounded px-0.5 font-medium",
                                    mine ? "bg-primary-foreground/20" : "bg-primary/15 text-primary",
                                  )}
                                >
                                  {part.text}
                                </span>
                              ) : (
                                <span key={partIndex}>{part.text}</span>
                              ),
                            )}
                          </p>

                          {message.attachment_path && (
                            <AttachmentLink
                              path={message.attachment_path}
                              name={message.attachment_name ?? t("chat.attachment")}
                            />
                          )}

                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            {groupReactions(reactions, Number(message.id), user?.id).map((group) => (
                              <button
                                key={group.emoji}
                                type="button"
                                disabled={!user}
                                onClick={() =>
                                  react.mutate({
                                    messageId: Number(message.id),
                                    emoji: group.emoji,
                                    existingId: group.mine,
                                  })
                                }
                                className={cn(
                                  "rounded-full border px-1.5 py-0.5 text-xs transition-colors",
                                  group.mine
                                    ? "border-primary bg-primary/15 text-foreground"
                                    : "border-border/60 bg-background/60 text-foreground hover:bg-muted",
                                )}
                              >
                                {group.emoji} {group.count}
                              </button>
                            ))}
                            <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              {QUICK_REACTIONS.slice(0, 4).map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  aria-label={`${t("chat.reactions")} ${emoji}`}
                                  disabled={!user}
                                  className="rounded-full px-1 text-xs hover:scale-125"
                                  onClick={() =>
                                    react.mutate({
                                      messageId: Number(message.id),
                                      emoji,
                                      existingId: groupReactions(
                                        reactions,
                                        Number(message.id),
                                        user?.id,
                                      ).find((group) => group.emoji === emoji)?.mine ?? null,
                                    })
                                  }
                                >
                                  {emoji}
                                </button>
                              ))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <p className="h-4 text-xs text-muted-foreground" aria-live="polite">
              {typing ?? ""}
            </p>

            <form
              className="relative border-t border-border/60 pt-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (canSubmit) send.mutate();
              }}
            >
              {(replyTo || editing || pendingFile) && (
                <div className="mb-2 flex items-center gap-2 rounded-md border border-border/60 bg-muted/50 px-3 py-2 text-xs">
                  <span className="font-medium">
                    {editing ? t("chat.editing") : replyTo ? t("chat.replyingTo") : t("chat.attachment")}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {editing
                      ? editing.content
                      : replyTo
                        ? `${nameFor(replyTo.user_id)}: ${replyTo.content}`
                        : pendingFile?.name}
                  </span>
                  <button
                    type="button"
                    aria-label={t("common.cancel")}
                    onClick={() => {
                      if (editing) setDraft("");
                      setEditing(null);
                      setReplyTo(null);
                      setPendingFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {mentionMatches.length > 0 && (
                <ul className="absolute bottom-full left-0 z-20 mb-1 w-56 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
                  {mentionMatches.map((profile) => (
                    <li key={profile.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-muted"
                        onClick={() => pickMention(profile.username)}
                      >
                        <AtSign className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        {profile.username}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setPendingFile(file);
                    setEditing(null);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  aria-label={t("chat.attach")}
                  disabled={projectId === null || editing !== null}
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <EmojiPicker
                  label={t("chat.reactions")}
                  disabled={projectId === null}
                  onPick={(emoji) => {
                    setDraft((current) => `${current}${emoji}`);
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                />
                <Textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    syncMentionQuery(event.target.value, event.target.selectionStart ?? 0);
                    broadcastTyping();
                  }}
                  onClick={(event) =>
                    syncMentionQuery(draft, event.currentTarget.selectionStart ?? 0)
                  }
                  onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
                  placeholder={
                    projectId === null
                      ? t("chat.selectProjectFirst")
                      : t("chat.placeholder")
                  }
                  disabled={projectId === null}
                  rows={2}
                  className="resize-none"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setMentionQuery(null);
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (mentionMatches[0] && mentionQuery !== null) {
                        pickMention(mentionMatches[0].username);
                        return;
                      }
                      if (canSubmit) send.mutate();
                    }
                  }}
                />
                <Button
                  type="submit"
                  disabled={!canSubmit || send.isPending}
                  aria-label={editing ? t("chat.saveMessage") : t("chat.send")}
                >
                  {send.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
