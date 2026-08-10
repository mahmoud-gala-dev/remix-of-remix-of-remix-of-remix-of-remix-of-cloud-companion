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
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TimerReset className="h-4 w-4" />
          Resolution Timer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tracker.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-2xl font-semibold tabular-nums">
                  {formatDuration(tracker.totalSeconds)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tracker.running
                    ? "Timer running for this error"
                    : "Total logged resolution time"}
                </p>
              </div>
              <Button
                size="sm"
                variant={tracker.running ? "destructive" : "secondary"}
                disabled={tracker.isPending}
                onClick={tracker.running ? tracker.stop : tracker.start}
              >
                {tracker.running ? (
                  <>
                    <Pause className="mr-1.5 h-3.5 w-3.5" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    Start
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
