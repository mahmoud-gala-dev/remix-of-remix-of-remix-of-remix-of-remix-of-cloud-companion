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

export async function sendProjectMessage({
  projectId,
  userId,
  content,
}: {
  projectId: number;
  userId: string;
  content: string;
}) {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Message cannot be empty.");
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  }
  const { data, error } = await supabase
    .from("project_messages")
    .insert({ project_id: projectId, user_id: userId, content: trimmed })
    .select("*")
    .single();
  if (error) throw new Error(friendlyDbError(error));
  return data;
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
