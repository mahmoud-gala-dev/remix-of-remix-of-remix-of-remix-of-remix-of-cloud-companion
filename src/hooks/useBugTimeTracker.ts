import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchBugTimeEntries,
  startBugTimer,
  stopBugTimer,
  type BugResolutionEntry,
} from "@/lib/bug-time";

export function useBugTimeTracker({ bugId, userId }: { bugId: number; userId?: string | null }) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());

  const query = useQuery({
    queryKey: ["bug-time", bugId, userId],
    enabled: Number.isFinite(bugId) && !!userId,
    queryFn: () => fetchBugTimeEntries(bugId, userId ?? undefined),
  });

  const entries = useMemo(() => query.data ?? [], [query.data]);
  const running = entries.find((entry) => entry.ended_at === null) ?? null;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const totals = useMemo(() => {
    const loggedSeconds = entries.reduce((sum, entry) => sum + (entry.duration_seconds ?? 0), 0);
    const runningSeconds = running
      ? Math.max(0, Math.round((now - new Date(running.started_at).getTime()) / 1000))
      : 0;
    return { loggedSeconds, runningSeconds, totalSeconds: loggedSeconds + runningSeconds };
  }, [entries, now, running]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["bug-time", bugId] });
    queryClient.invalidateQueries({ queryKey: ["resolution-analytics"] });
  };

  const start = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("You must be signed in.");
      await startBugTimer({ bugId, userId });
    },
    onSuccess: () => {
      setNow(Date.now());
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const stop = useMutation({
    mutationFn: async (entry: BugResolutionEntry) => stopBugTimer(entry),
    onSuccess: () => {
      invalidate();
      toast.success("Resolution time logged");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    entries,
    running,
    totalSeconds: totals.totalSeconds,
    loggedSeconds: totals.loggedSeconds,
    isLoading: query.isLoading,
    isPending: start.isPending || stop.isPending,
    start: () => start.mutate(),
    stop: () => running && stop.mutate(running),
  };
}
