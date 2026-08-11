import { supabase } from "@/integrations/supabase/client";
import { friendlyDbError } from "@/lib/api";
import type { Database } from "@/integrations/supabase/types";

export type ProjectMessage = Database["public"]["Tables"]["project_messages"]["Row"];

export const MAX_MESSAGE_LENGTH = 4000;

/** Chat history for one project, oldest first. */
export async function fetchProjectMessages(projectId: number): Promise<ProjectMessage[]> {
  const { data, error } = await supabase
    .from("project_messages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(friendlyDbError(error));
  return data ?? [];
}

export type ChatAttachmentInput = {
  path: string;
  name: string;
  type: string | null;
};

export async function sendProjectMessage({
  projectId,
  userId,
  content,
  replyToId = null,
  attachment = null,
}: {
  projectId: number;
  userId: string;
  content: string;
  replyToId?: number | null;
  attachment?: ChatAttachmentInput | null;
}) {
  const trimmed = content.trim();
  if (!trimmed && !attachment) throw new Error("Message cannot be empty.");
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  }
  const { data, error } = await supabase
    .from("project_messages")
    .insert({
      project_id: projectId,
      user_id: userId,
      content: trimmed || (attachment ? `📎 ${attachment.name}` : ""),
      reply_to_id: replyToId,
      attachment_path: attachment?.path ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_type: attachment?.type ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(friendlyDbError(error));
  return data;
}

/** Edits the caller's own message; the database stamps `edited_at`. */
export async function editProjectMessage(id: number, content: string) {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Message cannot be empty.");
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  }
  const { error } = await supabase
    .from("project_messages")
    .update({ content: trimmed })
    .eq("id", id);
  if (error) throw new Error(friendlyDbError(error));
}

export const CHAT_BUCKET = "chat-attachments";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Uploads one chat file and returns the stored object path. */
export async function uploadChatAttachment(
  file: File,
  { projectId, userId }: { projectId: number; userId: string },
): Promise<ChatAttachmentInput> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attachments must be 10 MB or smaller.");
  }
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
  const path = `${projectId}/${userId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from(CHAT_BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(error.message);
  return { path, name: file.name, type: file.type || null };
}

/** Short-lived signed URL so members can open a private chat file. */
export async function chatAttachmentUrl(path: string) {
  const { data, error } = await supabase.storage.from(CHAT_BUCKET).createSignedUrl(path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteProjectMessage(id: number) {
  const { error } = await supabase.from("project_messages").delete().eq("id", id);
  if (error) throw new Error(friendlyDbError(error));
}

/** HH:MM label for a message bubble. */
export function messageTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Day separator label, e.g. "Today" or a locale date. */
export function messageDay(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString();
}

/* ------------------------------------------------------------------ *
 * Mentions
 * ------------------------------------------------------------------ */

/** Matches `@username` tokens inside a message body. */
export const MENTION_PATTERN = /@([A-Za-z0-9_.\-]{2,32})/g;

/** Usernames mentioned in a message, lowercased and de-duplicated. */
export function extractMentions(content: string): string[] {
  return Array.from(new Set(Array.from(content.matchAll(MENTION_PATTERN), (m) => m[1]!.toLowerCase())));
}

/** True when the given username is mentioned in the message. */
export function mentionsUser(content: string, username: string | null | undefined) {
  if (!username) return false;
  return extractMentions(content).includes(username.toLowerCase());
}

/** Splits a message into plain text and mention segments for highlighted rendering. */
export function splitMentions(content: string): { text: string; mention: boolean }[] {
  const parts: { text: string; mention: boolean }[] = [];
  let lastIndex = 0;
  for (const match of content.matchAll(MENTION_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push({ text: content.slice(lastIndex, index), mention: false });
    parts.push({ text: match[0], mention: true });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < content.length) parts.push({ text: content.slice(lastIndex), mention: false });
  return parts;
}

/** Replaces the `@partial` token at the caret with a full username. */
export function applyMention(draft: string, caret: number, username: string) {
  const before = draft.slice(0, caret);
  const match = /@([A-Za-z0-9_.\-]*)$/.exec(before);
  if (!match) return { value: draft, caret };
  const start = caret - match[0].length;
  const value = `${draft.slice(0, start)}@${username} ${draft.slice(caret)}`;
  return { value, caret: start + username.length + 2 };
}

/** The `@partial` token currently being typed, or null. */
export function activeMentionQuery(draft: string, caret: number): string | null {
  const match = /@([A-Za-z0-9_.\-]*)$/.exec(draft.slice(0, caret));
  return match ? (match[1] ?? "") : null;
}

/* ------------------------------------------------------------------ *
 * Unread tracking (per browser, per project)
 * ------------------------------------------------------------------ */

const LAST_SEEN_KEY = "electropi.chat.lastSeen";

type LastSeenMap = Record<string, string>;

export function readLastSeen(): LastSeenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LAST_SEEN_KEY);
    return raw ? (JSON.parse(raw) as LastSeenMap) : {};
  } catch {
    return {};
  }
}

export function markChannelSeen(projectId: number, iso = new Date().toISOString()) {
  if (typeof window === "undefined") return;
  const next = { ...readLastSeen(), [String(projectId)]: iso };
  try {
    window.localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("electropi:chat-seen"));
  } catch {
    // Storage can be unavailable in private mode; unread badges simply stay as-is.
  }
}

export type ChatActivityRow = { project_id: number; user_id: string; created_at: string };

/** Recent chat activity across every project the user may read. */
export async function fetchChatActivity(limit = 300): Promise<ChatActivityRow[]> {
  const { data, error } = await supabase
    .from("project_messages")
    .select("project_id, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(friendlyDbError(error));
  return (data ?? []) as ChatActivityRow[];
}

/** Unread message count per project id, ignoring the user's own messages. */
export function unreadByProject(
  rows: ChatActivityRow[],
  currentUserId: string | null | undefined,
  lastSeen: LastSeenMap = readLastSeen(),
): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const row of rows) {
    if (currentUserId && row.user_id === currentUserId) continue;
    const seen = lastSeen[String(row.project_id)];
    if (seen && new Date(row.created_at) <= new Date(seen)) continue;
    counts[row.project_id] = (counts[row.project_id] ?? 0) + 1;
  }
  return counts;
}


/* ------------------------------------------------------------------ *
 * Typing indicator
 * ------------------------------------------------------------------ */

/** Keeps only typing events newer than `windowMs`, excluding the current user. */
export function activeTypists(
  events: Record<string, { username: string; at: number }>,
  currentUserId: string | null | undefined,
  now = Date.now(),
  windowMs = 4000,
): string[] {
  return Object.entries(events)
    .filter(([id, event]) => id !== currentUserId && now - event.at < windowMs)
    .map(([, event]) => event.username);
}

/** "Sara is typing…" / "Sara and Omar are typing…" / "3 people are typing…" */
export function typingLabel(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names.length} people are typing…`;
}
