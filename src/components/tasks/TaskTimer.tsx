import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { friendlyDbError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type TimeEntry = {
  id: number;
  task_id: number;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
};

function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Start/stop time tracker for a task. The running entry stays open until stopped. */
export function TaskTimer({ taskId }: { taskId: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());

  const { data: entries = [] } = useQuery({
    queryKey: ["task-time", taskId, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_time_entries")
        .select("*")
        .eq("task_id", taskId)
        .eq("user_id", user!.id)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TimeEntry[];
    },
  });

  const running = entries.find((e) => e.ended_at === null) ?? null;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const loggedSeconds = entries.reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0);
  const runningSeconds = running
    ? Math.max(0, (now - new Date(running.started_at).getTime()) / 1000)
    : 0;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["task-time", taskId] });

  const start = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("You must be signed in.");
      const { error } = await supabase
        .from("task_time_entries")
        .insert({ task_id: taskId, user_id: user.id, started_at: new Date().toISOString() });
      if (error) throw new Error(friendlyDbError(error));
    },
    onSuccess: () => {
      setNow(Date.now());
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const stop = useMutation({
    mutationFn: async () => {
      if (!running) return;
      const ended = new Date();
      const seconds = Math.max(
        1,
        Math.round((ended.getTime() - new Date(running.started_at).getTime()) / 1000),
      );
      const { error } = await supabase
        .from("task_time_entries")
        .update({ ended_at: ended.toISOString(), duration_seconds: seconds })
        .eq("id", running.id);
      if (error) throw new Error(friendlyDbError(error));
    },
    onSuccess: () => {
      invalidate();
      toast.success("Timer stopped");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!user) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5">
      <Timer className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <span className="font-mono text-sm tabular-nums">
        {formatDuration(loggedSeconds + runningSeconds)}
      </span>
      {running ? (
        <span className="text-xs font-medium text-primary">running</span>
      ) : (
        <span className="text-xs text-muted-foreground">logged</span>
      )}
      <Button
        size="sm"
        variant={running ? "destructive" : "secondary"}
        className="ms-auto h-7"
        disabled={start.isPending || stop.isPending}
        onClick={() => (running ? stop.mutate() : start.mutate())}
      >
        {running ? (
          <>
            <Pause className="me-1 h-3.5 w-3.5" /> Stop
          </>
        ) : (
          <>
            <Play className="me-1 h-3.5 w-3.5" /> Start
          </>
        )}
      </Button>
    </div>
  );
}
