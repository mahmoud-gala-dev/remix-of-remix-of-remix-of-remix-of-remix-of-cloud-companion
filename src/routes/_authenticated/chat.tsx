import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessagesSquare, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { isStaffRole } from "@/lib/permissions";
import { fetchProfiles, fetchProjects } from "@/lib/api";
import {
  deleteProjectMessage,
  fetchProjectMessages,
  messageDay,
  messageTime,
  sendProjectMessage,
} from "@/lib/chat";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Team Chat | ElectroPI Bug Tracker" },
      {
        name: "description",
        content:
          "Real-time project chat for ElectroPI teams: discuss bugs, fixes and releases with the members of each project.",
      },
      { property: "og:title", content: "Team Chat | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "Real-time project chat channels for testers, developers and supervisors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFound label="page" />,
});

function ChatPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const profilesQuery = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });

  const projects = useMemo(
    () => (projectsQuery.data ?? []).filter((project) => Number.isFinite(project.id)),
    [projectsQuery.data],
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
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);

  const messages = messagesQuery.data ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, projectId]);

  const nameFor = (id: string) =>
    profilesQuery.data?.find((profile) => profile.id === id)?.username ?? "Member";

  const send = useMutation({
    mutationFn: async () => {
      if (!user?.id || projectId === null) throw new Error("Select a project first.");
      await sendProjectMessage({ projectId, userId: user.id, content: draft });
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["project-messages", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteProjectMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-messages", projectId] });
      toast.success("Message deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activeProject = projects.find((project) => Number(project.id) === projectId);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <MessagesSquare className="h-6 w-6" />
          Team Chat
        </h1>
        <p className="text-sm text-muted-foreground">
          Interactive chat between the members of each project — testers, developers, supervisors and
          monitors.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Project channels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {projectsQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No projects yet. Create a project to start a channel.
              </p>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setProjectId(Number(project.id))}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                    Number(project.id) === projectId
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/60",
                  )}
                >
                  <span className="truncate">{project.name}</span>
                  <Badge variant="outline" className="ml-2 shrink-0">
                    {project.key}
                  </Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[60vh] flex-col border-border/60">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-base">
              {activeProject ? `# ${activeProject.key} — ${activeProject.name}` : "Select a channel"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4 pt-4">
            <div className="flex-1 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: "52vh" }}>
              {messagesQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No messages yet. Say hello to your project team.
                </p>
              ) : (
                messages.map((message, index) => {
                  const mine = message.user_id === user?.id;
                  const showDay =
                    index === 0 ||
                    messageDay(messages[index - 1]?.created_at ?? message.created_at) !==
                      messageDay(message.created_at);
                  const author = nameFor(message.user_id);
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
                          )}
                        >
                          <div className="mb-0.5 flex items-center gap-2 text-xs opacity-75">
                            <span className="font-medium">{mine ? "You" : author}</span>
                            <span>{messageTime(message.created_at)}</span>
                            {(mine || isStaffRole(user?.role)) && (
                              <button
                                type="button"
                                aria-label="Delete message"
                                className="opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={() => remove.mutate(Number(message.id))}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <form
              className="flex items-end gap-2 border-t border-border/60 pt-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (draft.trim()) send.mutate();
              }}
            >
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={
                  projectId === null ? "Select a project channel first" : "Write a message…"
                }
                disabled={projectId === null}
                rows={2}
                className="resize-none"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (draft.trim()) send.mutate();
                  }
                }}
              />
              <Button
                type="submit"
                disabled={projectId === null || !draft.trim() || send.isPending}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
