import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ListOrdered } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { priorityTone, statusTone } from "@/lib/api";

type UpcomingBug = {
  id: number;
  bug_id: string;
  title: string;
  status: string;
  priority: string;
};

/**
 * Shows the next 10 bugs after the current one, following the exact order/filters
 * the user was browsing in the list, so they can jump ahead without going back.
 */
export function BugNextTen({
  currentId,
  order,
  label,
  emptyLabel,
}: {
  currentId: number;
  order: number[];
  label: string;
  emptyLabel: string;
}) {
  const index = order.indexOf(currentId);
  const nextIds = index >= 0 ? order.slice(index + 1, index + 11) : order.slice(0, 10);

  const { data: bugs = [], isLoading } = useQuery({
    queryKey: ["bugs", "next-ten", nextIds],
    queryFn: async () => {
      if (nextIds.length === 0) return [] as UpcomingBug[];
      const { data, error } = await supabase
        .from("bugs")
        .select("id,bug_id,title,status,priority")
        .in("id", nextIds);
      if (error) throw error;
      const map = new Map((data ?? []).map((row) => [row.id, row as UpcomingBug]));
      return nextIds.map((id) => map.get(id)).filter((row): row is UpcomingBug => Boolean(row));
    },
    enabled: nextIds.length > 0,
  });

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ListOrdered className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && nextIds.length > 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : bugs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ol className="divide-y divide-border/60">
            {bugs.map((bug, i) => (
              <li key={bug.id}>
                <Link
                  to="/bugs/$id"
                  params={{ id: String(bug.id) }}
                  className="flex items-center gap-3 py-2 text-sm hover:bg-muted/40 rounded-md px-1"
                >
                  <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {bug.bug_id}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{bug.title}</span>
                  <Badge variant="outline" className={statusTone(bug.status)}>
                    {bug.status}
                  </Badge>
                  <Badge variant="outline" className={priorityTone(bug.priority)}>
                    {bug.priority}
                  </Badge>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
