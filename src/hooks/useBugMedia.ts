import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Attachment } from "@/lib/api";
import {
  addBugAttachmentLink,
  deleteBugAttachment,
  resolveBugAttachmentUrls,
  uploadBugMediaFiles,
} from "@/lib/bug-media-service";

const EMPTY_ATTACHMENTS: Attachment[] = [];

export function useBugMedia(bugId: number) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);

  const attachmentsQuery = useQuery({
    queryKey: ["attachments", bugId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("bug_id", bugId)
        .order("id");
      if (error) throw error;
      return data as Attachment[];
    },
  });

  const attachments = attachmentsQuery.data ?? EMPTY_ATTACHMENTS;

  const urlsQuery = useQuery({
    queryKey: ["attachment-urls", bugId, attachments.map((a) => a.id).join(",")],
    enabled: attachments.length > 0,
    staleTime: 30 * 60_000,
    queryFn: () => resolveBugAttachmentUrls(attachments),
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["attachments", bugId] });
    queryClient.invalidateQueries({ queryKey: ["attachment-urls", bugId] });
  }, [queryClient, bugId]);

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) =>
      uploadBugMediaFiles({
        bugId,
        files,
        onProgress: setProgress,
      }),
    onSuccess: invalidate,
    onSettled: () => setProgress(null),
  });

  const addLinkMutation = useMutation({
    mutationFn: (url: string) => addBugAttachmentLink(bugId, url),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBugAttachment,
    onSuccess: invalidate,
  });

  const grouped = useMemo(() => {
    const images = attachments.filter((a) => a.type === "image");
    const videos = attachments.filter(
      (a) =>
        a.type === "video" ||
        (a.type === "file" && /\.(webm|mp4|mov|mkv)$/i.test(a.filename ?? "")),
    );
    const files = attachments.filter(
      (a) => a.type === "file" && !/\.(webm|mp4|mov|mkv)$/i.test(a.filename ?? ""),
    );
    const links = attachments.filter((a) => a.type === "link");
    return { images, videos, files, links };
  }, [attachments]);

  return {
    attachments,
    urls: urlsQuery.data ?? {},
    progress,
    grouped,
    isLoading: attachmentsQuery.isLoading,
    isUploading: uploadMutation.isPending,
    uploadFiles: uploadMutation.mutate,
    uploadFilesAsync: uploadMutation.mutateAsync,
    uploadError: uploadMutation.error,
    addLink: addLinkMutation.mutateAsync,
    isAddingLink: addLinkMutation.isPending,
    deleteAttachment: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
