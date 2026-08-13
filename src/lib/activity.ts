import { supabase } from "@/integrations/supabase/client";
import { friendlyDbError } from "@/lib/api";

export type ActivityKind = "history" | "comment" | "chat";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  createdAt: string;
  userId: string | null;
  /** Bug numeric id when the item points at a bug. */
  bugId: number | null;
  projectId: number | null;
  title: string;
  detail: string;
};

function historyTitle(field: string, oldValue: string | null, newValue: string | null) {
  const from = oldValue?.trim() || "—";
  const to = newValue?.trim() || "—";
  if (field === "status") return `Status: ${from} → ${to}`;
  if (field === "priority") return `Priority: ${from} → ${to}`;
  if (field === "severity") return `Severity: ${from} → ${to}`;
  if (field === "assignee") return "Assignee changed";
  return `${field} updated`;
}

/**
 * Recent team activity merged from bug history, bug comments and project chat.
 * Row-level security already limits every source to what the user may read.
 */
export async function fetchActivity(limit = 60): Promise<ActivityItem[]> {
  const [history, comments, messages] = await Promise.all([
    supabase
      .from("bug_history")
      .select("id, bug_id, user_id, field, old_value, new_value, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("comments")
      .select("id, bug_id, user_id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("project_messages")
      .select("id, project_id, user_id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const failure = history.error ?? comments.error ?? messages.error;
  if (failure) throw new Error(friendlyDbError(failure));

  const items: ActivityItem[] = [
    ...(history.data ?? []).map((row) => ({
      id: `history-${row.id}`,
      kind: "history" as const,
      createdAt: row.created_at,
      userId: row.user_id,
      bugId: row.bug_id,
      projectId: null,
      title: historyTitle(row.field, row.old_value, row.new_value),
      detail: "",
    })),
    ...(comments.data ?? []).map((row) => ({
      id: `comment-${row.id}`,
      kind: "comment" as const,
      createdAt: row.created_at,
      userId: row.user_id,
      bugId: row.bug_id,
      projectId: null,
      title: "New comment",
      detail: row.content,
    })),
    ...(messages.data ?? []).map((row) => ({
      id: `chat-${row.id}`,
      kind: "chat" as const,
      createdAt: row.created_at,
      userId: row.user_id,
      bugId: null,
      projectId: row.project_id,
      title: "Chat message",
      detail: row.content,
    })),
  ];

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export type ActivityPage = {
  items: ActivityItem[];
  page: number;
  hasMore: boolean;
};

/**
 * Paged view over the merged feed. Each source is read up to the end of the
 * requested page, then the merged timeline is sliced to that page window.
 */
export async function fetchActivityPage(page = 1, pageSize = 20): Promise<ActivityPage> {
  const safePage = Math.max(1, Math.floor(page));
  const upTo = safePage * pageSize;
  // One extra row tells us whether a next page exists.
  const merged = await fetchActivity(upTo + 1);
  const start = (safePage - 1) * pageSize;
  return {
    items: merged.slice(start, start + pageSize),
    page: safePage,
    hasMore: merged.length > upTo,
  };
}


/** Relative time such as "5m ago" for a feed row. */
export function timeAgo(iso: string, now: Date = new Date()) {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
