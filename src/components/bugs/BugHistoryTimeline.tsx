import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { BugHistoryEntry } from "@/lib/api";
import { nameFor, type ProfileMap } from "@/components/bugs/types";

export function BugHistoryTimeline({
  bugId,
  profileMap,
}: {
  bugId: number;
  profileMap: ProfileMap;
}) {
  const { data: history = [] } = useQuery({
    queryKey: ["bug-history", bugId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bug_history")
        .select("*")
        .eq("bug_id", bugId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BugHistoryEntry[];
    },
  });

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> Change History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {history.length === 0 && (
          <p className="text-sm text-muted-foreground">No changes recorded yet</p>
        )}
        {history.map((h) => (
          <div key={h.id} className="flex flex-col gap-0.5 border-l-2 border-border pl-3 text-sm">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium">{nameFor(profileMap, h.user_id)}</span>
              <span className="text-muted-foreground">changed {h.field}</span>
              {h.old_value && (
                <>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{h.old_value}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </>
              )}
              {h.new_value && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{h.new_value}</span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
