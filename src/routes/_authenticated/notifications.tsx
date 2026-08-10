import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Bell,
  Check,
  CheckCheck,
  MessageSquare,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Notification } from "@/lib/api";
import { markAssistanceReceivedForBug } from "@/lib/assistance-requests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications | ElectroPI Bug Tracker" },
      {
        name: "description",
        content: "Review updates, assignments and comments related to your bugs.",
      },
      { property: "og:title", content: "Notifications | ElectroPI Bug Tracker" },
      { property: "og:description", content: "Stay on top of bug activity relevant to you." },
    ],
  }),
  component: NotificationsPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFound label="page" />,
});

export function getLocalMockNotifications(): Notification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("electropi.mock.notifications");
    if (raw) return JSON.parse(raw);
  } catch {
    return [];
  }
  return [];
}

async function fetchNotifications(userId: string): Promise<Notification[]> {
  const localMocks = getLocalMockNotifications();
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return localMocks;
    const dbNotifs = data ?? [];
    const existingIds = new Set(dbNotifs.map((n) => n.id));
    const uniqueMocks = localMocks.filter((n) => !existingIds.has(n.id));
    return [...dbNotifs, ...uniqueMocks];
  } catch {
    return localMocks;
  }
}

function getIcon(type: string) {
  switch (type) {
    case "status_change":
      return <RefreshCw className="h-5 w-5 text-primary" />;
    case "new_comment":
      return <MessageSquare className="h-5 w-5 text-success" />;
    case "new_bug":
      return <AlertCircle className="h-5 w-5 text-destructive" />;
    case "assignment":
      return <UserPlus className="h-5 w-5 text-warning" />;
    default:
      return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
}

function NotificationsSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: async (notification: Notification) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notification.id);
      if (error) throw error;
      if (user?.id && notification.bug_id) {
        try {
          await markAssistanceReceivedForBug({
            bugId: notification.bug_id,
            targetUserId: user.id,
          });
        } catch {
          toast.error("Notification was read, but assistance status could not be updated");
        }
      }
    },
    onSuccess: (_data, notification) => {
      queryClient.setQueryData<Notification[]>(["notifications", user?.id], (old) =>
        old?.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
      );
      if (notification.bug_id) {
        queryClient.invalidateQueries({ queryKey: ["assistance-requests", notification.bug_id] });
      }
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) throw error;
      const bugIds = [
        ...new Set(
          (notifications ?? [])
            .filter((notification) => !notification.read && notification.bug_id)
            .map((notification) => notification.bug_id as number),
        ),
      ];
      try {
        await Promise.all(
          bugIds.map((bugId) => markAssistanceReceivedForBug({ bugId, targetUserId: user.id })),
        );
      } catch {
        toast.error("Notifications were read, but some assistance statuses could not be updated");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;
  const visible = (notifications ?? []).filter((n) => !unreadOnly || !n.read);

  const handleClick = (notification: Notification) => {
    if (!notification.read) markReadMutation.mutate(notification);
    if (notification.bug_id)
      navigate({ to: "/bugs/$id", params: { id: String(notification.bug_id) } });
  };

  if (isLoading) return <NotificationsSkeleton />;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={unreadOnly} onCheckedChange={setUnreadOnly} />
            Unread only
          </label>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {visible.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <Bell className="mb-4 h-12 w-12 opacity-20" />
            <p>You're all caught up.</p>
            <p className="text-sm">No notifications to show.</p>
          </Card>
        ) : (
          visible.map((notification) => (
            <Card
              key={notification.id}
              className={`cursor-pointer p-4 transition-colors hover:bg-muted/50 ${
                !notification.read ? "border-primary/30 bg-primary/5" : "opacity-80"
              }`}
              onClick={() => handleClick(notification)}
            >
              <div className="flex items-start gap-4">
                <div className="mt-1 rounded-full border bg-background p-2">
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p
                      className={`text-sm ${!notification.read ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                    >
                      {notification.message}
                    </p>
                    <span className="ml-4 whitespace-nowrap text-xs text-muted-foreground">
                      {notification.created_at
                        ? new Date(notification.created_at).toLocaleString()
                        : ""}
                    </span>
                  </div>
                  {notification.bug_title && (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        #{notification.bug_id}
                      </Badge>
                      <span className="truncate text-xs font-medium text-muted-foreground">
                        {notification.bug_title}
                      </span>
                    </div>
                  )}
                </div>
                {!notification.read && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary"
                    aria-label={`Mark notification ${notification.id} as read`}
                    onClick={(e) => {
                      e.stopPropagation();
                      markReadMutation.mutate(notification);
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
