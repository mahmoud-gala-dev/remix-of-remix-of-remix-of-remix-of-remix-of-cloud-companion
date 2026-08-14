import { Pause, Play, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBugTimeTracker } from "@/hooks/useBugTimeTracker";
import { formatDuration } from "@/lib/bug-time";

export function BugResolutionTimer({
  bugId,
  userId,
  canTrack,
}: {
  bugId: number;
  userId: string | null;
  canTrack: boolean;
}) {
  const tracker = useBugTimeTracker({ bugId, userId });

  if (!canTrack || !userId) return null;

  return (
    <Card className={`border-border/60 shadow-sm transition-all ${tracker.running ? "ring-1 ring-primary/40 bg-primary/5" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <TimerReset className={`h-4 w-4 ${tracker.running ? "text-primary animate-spin" : "text-muted-foreground"}`} />
            Resolution Timer
          </CardTitle>
          {tracker.running && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Active Session
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {tracker.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-2xl font-bold tabular-nums text-foreground tracking-tight">
                  {formatDuration(tracker.totalSeconds)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tracker.running
                    ? "Timer currently recording..."
                    : "Total logged resolution time"}
                </p>
              </div>
              <Button
                size="sm"
                variant={tracker.running ? "destructive" : "default"}
                disabled={tracker.isPending}
                className="shadow-xs font-medium"
                onClick={tracker.running ? tracker.stop : tracker.start}
              >
                {tracker.running ? (
                  <>
                    <Pause className="me-1.5 h-3.5 w-3.5" />
                    Stop Timer
                  </>
                ) : (
                  <>
                    <Play className="me-1.5 h-3.5 w-3.5" />
                    Start Timer
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
