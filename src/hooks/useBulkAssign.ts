import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyDbError } from "@/lib/api";

/** Sentinel value meaning "remove any current assignee". */
export const BULK_UNASSIGNED = "unassigned" as const;

export interface UseBulkAssignOptions {
  /** All bug ids visible on the current page (used to reconcile selection). */
  visibleIds: number[];
}

/**
 * Manages the "bulk assign" feature on the bugs list page.
 *
 * Responsibilities:
 *  - Tracks which bug ids are selected.
 *  - Exposes the target assignee value chosen in the dropdown.
 *  - Sends the batch update to Supabase and invalidates relevant query keys.
 *  - Clears selection automatically after a successful update.
 *
 * The hook does NOT own any UI — it just returns state + handlers for the
 * parent component to wire up.
 */
export function useBulkAssign({ visibleIds }: UseBulkAssignOptions) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [targetAssignee, setTargetAssignee] = useState<string>(BULK_UNASSIGNED);

  /** Keep selectedIds in sync when the visible row set changes (e.g. page turn). */
  const pruneToVisible = useCallback(() => {
    const visible = new Set(visibleIds);
    setSelectedIds((current) => current.filter((id) => visible.has(id)));
  }, [visibleIds]);

  const toggleOne = useCallback((id: number, checked: boolean) => {
    setSelectedIds((current) =>
      checked
        ? Array.from(new Set([...current, id]))
        : current.filter((item) => item !== id),
    );
  }, []);

  const selectAll = useCallback(
    (ids: number[]) => setSelectedIds(ids),
    [],
  );

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const isSelected = useCallback(
    (id: number) => selectedIds.includes(id),
    [selectedIds],
  );

  const selectionCount = selectedIds.length;
  const hasSelection = selectionCount > 0;

  /** The resolved assignee id to write, or null for "unassigned". */
  const resolvedAssigneeId = useMemo(
    () => (targetAssignee === BULK_UNASSIGNED ? null : targetAssignee),
    [targetAssignee],
  );

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedIds.length) return;
      const payload = {
        assigned_to: resolvedAssigneeId,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("bugs")
        .update(payload)
        .in("id", selectedIds);
      if (error) throw new Error(friendlyDbError(error));
    },
    onSuccess: () => {
      toast.success("Bulk assignment applied", {
        description: `Assigned ${selectionCount} bug${selectionCount === 1 ? "" : "s"}.`,
      });
      clearSelection();
      void queryClient.invalidateQueries({ queryKey: ["bugs"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["report-bugs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    /** Currently selected bug ids. */
    selectedIds,
    /** Number of selected bugs. */
    selectionCount,
    /** Whether any bugs are selected. */
    hasSelection,
    /** True if this bug id is in the selection. */
    isSelected,
    /** Toggle a single bug in/out of the selection. */
    toggleOne,
    /** Replace the whole selection (e.g. "select all on page"). */
    selectAll,
    /** Clear the whole selection. */
    clearSelection,
    /** Re-run after visible rows change to drop stale ids. */
    pruneToVisible,
    /** The assignee id chosen in the dropdown (BULK_UNASSIGNED sentinel or uuid). */
    targetAssignee,
    setTargetAssignee,
    /** Fire the Supabase batch update. */
    apply: () => applyMutation.mutate(),
    isPending: applyMutation.isPending,
  };
}
