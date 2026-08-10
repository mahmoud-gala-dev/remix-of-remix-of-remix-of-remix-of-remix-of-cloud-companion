import { supabase } from "@/integrations/supabase/client";
import {
  ATTACHMENTS_BUCKET,
  isSafeHttpUrl,
  isStoragePath,
  validateAttachmentFile,
  type Attachment,
} from "@/lib/api";

export type AttachmentKind = "image" | "video" | "file";

export type UploadBugMediaInput = {
  bugId: number;
  files: File[];
  onProgress?: (progress: number) => void;
};

export function getAttachmentKind(file: Pick<File, "type">): AttachmentKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

export function canonicalAttachmentContentType(file: Pick<File, "type">) {
  const type = file.type.toLowerCase();
  if (type.startsWith("video/webm")) return "video/webm";
  if (type.startsWith("video/mp4")) return "video/mp4";
  if (type.startsWith("video/quicktime")) return "video/quicktime";
  if (type.startsWith("video/x-matroska")) return "video/x-matroska";
  return file.type || "application/octet-stream";
}

function extensionFor(file: Pick<File, "name" | "type">) {
  const fromName = file.name
    .split(".")
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (fromName) return fromName;
  const contentType = canonicalAttachmentContentType(file);
  if (contentType === "video/webm") return "webm";
  if (contentType === "video/mp4") return "mp4";
  if (file.type === "application/pdf") return "pdf";
  return "bin";
}

export async function uploadBugMediaFiles({ bugId, files, onProgress }: UploadBugMediaInput) {
  if (files.length === 0) return [];

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const uid = auth.user?.id;
  if (!uid) throw new Error("You must be signed in to upload files.");

  const inserted: Attachment[] = [];
  let done = 0;
  onProgress?.(1);

  for (const file of files) {
    const problem = validateAttachmentFile(file);
    if (problem) throw new Error(problem);

    const path = `${uid}/${bugId}/${crypto.randomUUID()}.${extensionFor(file)}`;
    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(path, file, { contentType: canonicalAttachmentContentType(file), upsert: false });
    if (uploadError) throw uploadError;

    const { data, error: insertError } = await supabase
      .from("attachments")
      .insert({
        bug_id: bugId,
        type: getAttachmentKind(file),
        content: path,
        filename: file.name,
      })
      .select()
      .single();

    if (insertError || !data) {
      await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path]);
      throw insertError ?? new Error("Uploaded file could not be saved to the bug.");
    }

    inserted.push(data as Attachment);
    done += 1;
    onProgress?.(Math.round((done / files.length) * 100));
  }

  return inserted;
}

export async function addBugAttachmentLink(bugId: number, rawUrl: string) {
  const url = rawUrl.trim();
  if (!isSafeHttpUrl(url)) throw new Error("Only http:// and https:// links are allowed.");

  const { data, error } = await supabase
    .from("attachments")
    .insert({ bug_id: bugId, type: "link", content: url, filename: null })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Link could not be saved.");
  return data as Attachment;
}

export async function deleteBugAttachment(att: Attachment) {
  if (isStoragePath(att.content)) {
    const { error: removeError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .remove([att.content]);
    if (removeError) throw removeError;
  }

  const { error } = await supabase.from("attachments").delete().eq("id", att.id);
  if (error) throw error;
}

export async function resolveBugAttachmentUrls(items: Attachment[]) {
  const paths = items.filter((a) => isStoragePath(a.content));
  const out: Record<number, string> = {};
  for (const item of items) {
    if (!isStoragePath(item.content)) out[item.id] = item.content;
  }
  if (paths.length === 0) return out;

  const { data, error } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrls(
    paths.map((a) => a.content),
    3600,
  );
  if (error) throw error;

  (data ?? []).forEach((row, index) => {
    const item = paths[index];
    if (item && row.signedUrl) out[item.id] = row.signedUrl;
  });
  return out;
}
