import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { markAssistanceCommentedForBug } from "@/lib/assistance-requests";
import type { Comment } from "@/lib/api";

function getLocalCommentsKey(bugId: number) {
  return `electropi.mock.comments.${bugId}`;
}

function ignoreLocalPersistenceError(_error: unknown) {
  return undefined;
}

export function getLocalMockComments(bugId: number): Comment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getLocalCommentsKey(bugId));
    if (raw) return JSON.parse(raw);
  } catch (error) {
    ignoreLocalPersistenceError(error);
  }
  return [];
}

export function saveLocalMockComments(bugId: number, comments: Comment[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getLocalCommentsKey(bugId), JSON.stringify(comments));
  } catch (error) {
    ignoreLocalPersistenceError(error);
  }
}

export function useBugComments(bugId: number, currentUserId: string | null) {
  const queryClient = useQueryClient();

  const commentsQuery = useQuery({
    queryKey: ["comments", bugId],
    queryFn: async () => {
      const localMocks = getLocalMockComments(bugId);
      let dbComments: Comment[] = [];

      try {
        const { data, error } = await supabase
          .from("comments")
          .select("*")
          .eq("bug_id", bugId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        if (data) dbComments = data as Comment[];
      } catch (error) {
        if (localMocks.length === 0) throw error;
      }

      // Merge DB comments with local mock comments to prevent losing newly created comments
      const existingIds = new Set(dbComments.map((c) => c.id));
      const uniqueMocks = localMocks.filter((c) => !existingIds.has(c.id));
      const combined = [...dbComments, ...uniqueMocks];

      const activeUser = currentUserId || "developer";

      // Normalize missing timestamps or user metadata
      const normalized = combined.map((c) => {
        let validDate = c.created_at;
        if (!validDate || Number.isNaN(new Date(validDate).getTime())) {
          validDate = new Date().toISOString();
        }
        return {
          ...c,
          created_at: validDate,
          user_id: c.user_id && c.user_id !== "unknown" ? c.user_id : activeUser,
        };
      });

      // Sort chronologically
      normalized.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      return normalized;
    },
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["comments", bugId] }),
    [bugId, queryClient],
  );

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      const activeUserId =
        currentUserId || (await supabase.auth.getUser()).data.user?.id || "developer";
      const now = new Date().toISOString();
      const tempId = Date.now();

      const newCommentRow: Comment = {
        id: tempId,
        bug_id: bugId,
        user_id: activeUserId,
        content,
        created_at: now,
      };

      const { data, error } = await supabase
        .from("comments")
        .insert({
          bug_id: bugId,
          user_id: activeUserId,
          content,
          created_at: now,
        })
        .select()
        .single();
      if (error) throw error;
      if (data) {
        newCommentRow.id = data.id;
        newCommentRow.created_at = data.created_at || now;
        if (data.user_id) newCommentRow.user_id = data.user_id;
      }

      // Persist in local storage
      const currentList = getLocalMockComments(bugId);
      saveLocalMockComments(bugId, [...currentList, newCommentRow]);

      try {
        await markAssistanceCommentedForBug({ bugId, targetUserId: activeUserId });
      } catch {
        // Assistance status sync is best-effort
      }

      return newCommentRow;
    },
    onMutate: async (content: string) => {
      await queryClient.cancelQueries({ queryKey: ["comments", bugId] });
      const previousComments = queryClient.getQueryData<Comment[]>(["comments", bugId]) ?? [];

      const activeUserId = currentUserId || "developer";
      const optimisticComment: Comment = {
        id: Date.now(),
        bug_id: bugId,
        user_id: activeUserId,
        content,
        created_at: new Date().toISOString(),
      };

      const updated = [...previousComments, optimisticComment];
      queryClient.setQueryData<Comment[]>(["comments", bugId], updated);
      saveLocalMockComments(bugId, updated);

      return { previousComments };
    },
    onError: (_err, _content, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(["comments", bugId], context.previousComments);
        saveLocalMockComments(bugId, context.previousComments);
      }
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["assistance-requests", bugId] });
    },
  });

  const updateComment = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const { error } = await supabase.from("comments").update({ content }).eq("id", id);
      if (error) throw error;

      const localList = getLocalMockComments(bugId).map((c) =>
        c.id === id ? { ...c, content } : c,
      );
      saveLocalMockComments(bugId, localList);
    },
    onMutate: async ({ id, content }) => {
      await queryClient.cancelQueries({ queryKey: ["comments", bugId] });
      const previous = queryClient.getQueryData<Comment[]>(["comments", bugId]) ?? [];
      const updated = previous.map((c) => (c.id === id ? { ...c, content } : c));
      queryClient.setQueryData(["comments", bugId], updated);
      saveLocalMockComments(bugId, updated);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["comments", bugId], context.previous);
        saveLocalMockComments(bugId, context.previous);
      }
    },
    onSuccess: invalidate,
  });

  const deleteComment = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw error;

      const localList = getLocalMockComments(bugId).filter((c) => c.id !== id);
      saveLocalMockComments(bugId, localList);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["comments", bugId] });
      const previous = queryClient.getQueryData<Comment[]>(["comments", bugId]) ?? [];
      const updated = previous.filter((c) => c.id !== id);
      queryClient.setQueryData(["comments", bugId], updated);
      saveLocalMockComments(bugId, updated);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["comments", bugId], context.previous);
        saveLocalMockComments(bugId, context.previous);
      }
    },
    onSuccess: invalidate,
  });

  return {
    comments: commentsQuery.data ?? getLocalMockComments(bugId),
    isLoading: commentsQuery.isLoading,
    error: commentsQuery.error instanceof Error ? commentsQuery.error : null,
    addComment,
    updateComment,
    deleteComment,
  };
}
