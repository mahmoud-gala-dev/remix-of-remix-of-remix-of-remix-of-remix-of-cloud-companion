/**
 * "Script improvements" module: every signed-in member (tester, developer, …)
 * can submit an improvement idea or a defect report with a pasted screenshot or
 * a short video, and the whole team — especially admins — can discuss it in
 * comments.
 */
import { supabase } from "@/integrations/supabase/client";
import { friendlyDbError } from "@/lib/api";
import type { Database } from "@/integrations/supabase/types";

export type Improvement = Database["public"]["Tables"]["improvements"]["Row"];
export type ImprovementComment = Database["public"]["Tables"]["improvement_comments"]["Row"];

export const IMPROVEMENT_KINDS = ["improvement", "bug"] as const;
export const IMPROVEMENT_STATUSES = ["Open", "In Review", "Planned", "Done", "Rejected"] as const;
export const IMPROVEMENT_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

const BUCKET = "bug-attachments";
export const MAX_IMPROVEMENT_BYTES = 25 * 1024 * 1024;

export type ImprovementAttachment = { path: string; name: string; type: string | null };

export async function uploadImprovementMedia(
  file: File,
  userId: string,
): Promise<ImprovementAttachment> {
  if (file.size > MAX_IMPROVEMENT_BYTES) {
    throw new Error("Attachments must be 25 MB or smaller.");
  }
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
  const path = `${userId}/improvements/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(error.message);
  return { path, name: file.name, type: file.type || null };
}

export async function improvementMediaUrl(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function fetchImprovements(): Promise<Improvement[]> {
  const { data, error } = await supabase
    .from("improvements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(friendlyDbError(error));
  return data ?? [];
}

export async function createImprovement(input: {
  title: string;
  description: string;
  kind: string;
  priority: string;
  projectId: number | null;
  userId: string;
  attachment?: ImprovementAttachment | null;
}) {
  const title = input.title.trim();
  if (!title) throw new Error("Add a short title first.");
  const { error } = await supabase.from("improvements").insert({
    title: title.slice(0, 160),
    description: input.description.trim().slice(0, 4000) || null,
    kind: input.kind,
    priority: input.priority,
    project_id: input.projectId,
    created_by: input.userId,
    attachment_path: input.attachment?.path ?? null,
    attachment_name: input.attachment?.name ?? null,
    attachment_type: input.attachment?.type ?? null,
  });
  if (error) throw new Error(friendlyDbError(error));
}

export async function updateImprovement(
  id: number,
  patch: Partial<Pick<Improvement, "status" | "priority" | "admin_response" | "title" | "description">>,
) {
  const { error } = await supabase.from("improvements").update(patch).eq("id", id);
  if (error) throw new Error(friendlyDbError(error));
}

export async function deleteImprovement(id: number) {
  const { error } = await supabase.from("improvements").delete().eq("id", id);
  if (error) throw new Error(friendlyDbError(error));
}

export async function fetchImprovementComments(
  improvementId: number,
): Promise<ImprovementComment[]> {
  const { data, error } = await supabase
    .from("improvement_comments")
    .select("*")
    .eq("improvement_id", improvementId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(friendlyDbError(error));
  return data ?? [];
}

export async function addImprovementComment(input: {
  improvementId: number;
  userId: string;
  content: string;
}) {
  const content = input.content.trim();
  if (!content) throw new Error("Write something first.");
  const { error } = await supabase.from("improvement_comments").insert({
    improvement_id: input.improvementId,
    user_id: input.userId,
    content: content.slice(0, 2000),
  });
  if (error) throw new Error(friendlyDbError(error));
}

export async function deleteImprovementComment(id: number) {
  const { error } = await supabase.from("improvement_comments").delete().eq("id", id);
  if (error) throw new Error(friendlyDbError(error));
}

export function statusTone(status: string) {
  switch (status) {
    case "Done":
      return "border-success/40 text-success";
    case "Rejected":
      return "border-destructive/40 text-destructive";
    case "Planned":
      return "border-info/40 text-info";
    case "In Review":
      return "border-warning/40 text-warning";
    default:
      return "border-border text-muted-foreground";
  }
}
