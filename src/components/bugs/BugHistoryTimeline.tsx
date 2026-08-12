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
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> {t("bug.history.title")}
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
          <p className="text-sm text-muted-foreground">{t("bug.history.empty")}</p>
        )}
        {history.map((h) => (
          <div key={h.id} className="flex flex-col gap-0.5 border-s-2 border-border ps-3 text-sm">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium">{nameFor(profileMap, h.user_id)}</span>
              <span className="text-muted-foreground">
                {t("bug.history.changed")} {t(fieldKeys[h.field] ?? "bug.history.field.other", { field: h.field })}
              </span>
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
              {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(h.created_at))}
              {" · "}
              {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
