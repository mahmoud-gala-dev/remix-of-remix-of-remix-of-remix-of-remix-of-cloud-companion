import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { BugHistoryEntry } from "@/lib/api";
import { nameFor, type ProfileMap } from "@/components/bugs/types";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const fieldKeys: Record<string, TranslationKey> = {
  status: "bug.history.field.status",
  priority: "bug.history.field.priority",
  severity: "bug.history.field.severity",
  assignee: "bug.history.field.assignee",
  module: "bug.history.field.module",
  notes: "bug.history.field.notes",
  tags: "bug.history.field.tags",
};

export function BugHistoryTimeline({
  bugId,
  profileMap,
}: {
  bugId: number;
  profileMap: ProfileMap;
}) {
  const { t } = useI18n();
  const { data: history = [], isLoading, error } = useQuery({
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
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-muted-foreground" /> {t("bug.history.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {t("bug.history.loadError")}
          </p>
        )}
        {!isLoading && !error && history.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">{t("bug.history.empty")}</p>
        )}
        <div className="relative space-y-4 ps-4 before:absolute before:bottom-1 before:start-1.5 before:top-2 before:w-0.5 before:bg-border/60">
          {history.map((h) => (
            <div key={h.id} className="relative flex flex-col gap-1 text-sm">
              <span className="absolute -start-4 top-1.5 h-2 w-2 rounded-full border border-background bg-primary ring-2 ring-primary/20" />
              <div className="flex flex-wrap items-center gap-1.5 leading-snug">
                <span className="font-medium text-foreground">{nameFor(profileMap, h.user_id)}</span>
                <span className="text-muted-foreground text-xs">
                  {t("bug.history.changed")} <span className="font-medium text-foreground">{t(fieldKeys[h.field] ?? "bug.history.field.other", { field: h.field })}</span>
                </span>
                {h.old_value && (
                  <>
                    <span className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground line-through">
                      {h.old_value}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </>
                )}
                {h.new_value && (
                  <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                    {h.new_value}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
