import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clipboard,
  DatabaseZap,
  ExternalLink,
  PlayCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetchMigrationChecks } from "@/lib/migration-checks";
import { supabase } from "@/integrations/supabase/client";


const MIGRATION_SQL = `-- 1) Add demo roles. Run this first if your DB does not know auditor/monitor yet.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'monitor';

-- 2) Bug resolution time tracking table.
CREATE TABLE IF NOT EXISTS public.bug_time_entries (
  id bigserial PRIMARY KEY,
  bug_id bigint NOT NULL REFERENCES public.bugs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bug_time_entries_duration_check CHECK (
    duration_seconds IS NULL OR duration_seconds > 0
  ),
  CONSTRAINT bug_time_entries_end_check CHECK (
    ended_at IS NULL OR ended_at >= started_at
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bug_time_entries TO authenticated;
GRANT ALL ON public.bug_time_entries TO service_role;

ALTER TABLE public.bug_time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bug_time_entries_select ON public.bug_time_entries;
DROP POLICY IF EXISTS bug_time_entries_insert ON public.bug_time_entries;
DROP POLICY IF EXISTS bug_time_entries_update ON public.bug_time_entries;
DROP POLICY IF EXISTS bug_time_entries_delete ON public.bug_time_entries;

CREATE POLICY bug_time_entries_select ON public.bug_time_entries
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text IN ('auditor', 'monitor')
    )
  );

CREATE POLICY bug_time_entries_insert ON public.bug_time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.bugs b
      WHERE b.id = bug_time_entries.bug_id
        AND (b.assigned_to IS NULL OR b.assigned_to = auth.uid())
    )
  );

CREATE POLICY bug_time_entries_update ON public.bug_time_entries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY bug_time_entries_delete ON public.bug_time_entries
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS bug_time_entries_bug_idx ON public.bug_time_entries(bug_id);
CREATE INDEX IF NOT EXISTS bug_time_entries_user_idx ON public.bug_time_entries(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS bug_time_entries_one_running_idx
  ON public.bug_time_entries(user_id, bug_id)
  WHERE ended_at IS NULL;

DROP TRIGGER IF EXISTS bug_time_entries_updated_at ON public.bug_time_entries;
CREATE TRIGGER bug_time_entries_updated_at
  BEFORE UPDATE ON public.bug_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Server-side resolution time analytics view/RPC.
CREATE OR REPLACE VIEW public.resolution_time_analytics AS
SELECT
  bte.bug_id,
  b.bug_id AS bug_code,
  COALESCE(b.title, 'Unknown bug') AS title,
  COALESCE(b.module, 'Unassigned') AS module,
  b.project_id,
  bte.user_id AS developer_id,
  COALESCE(p.username, left(bte.user_id::text, 8)) AS developer_name,
  SUM(COALESCE(bte.duration_seconds, 0))::integer AS total_seconds,
  COUNT(*)::integer AS entries
FROM public.bug_time_entries bte
LEFT JOIN public.bugs b ON b.id = bte.bug_id
LEFT JOIN public.profiles p ON p.id = bte.user_id
WHERE COALESCE(bte.duration_seconds, 0) > 0
GROUP BY bte.bug_id, b.bug_id, b.title, b.module, b.project_id, bte.user_id, p.username;

GRANT SELECT ON public.resolution_time_analytics TO authenticated;
GRANT SELECT ON public.resolution_time_analytics TO service_role;

CREATE OR REPLACE FUNCTION public.get_resolution_time_analytics()
RETURNS TABLE (
  bug_id bigint,
  bug_code text,
  title text,
  module text,
  project_id bigint,
  developer_id uuid,
  developer_name text,
  total_seconds integer,
  entries integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    rta.bug_id,
    rta.bug_code,
    rta.title,
    rta.module,
    rta.project_id,
    rta.developer_id,
    rta.developer_name,
    rta.total_seconds,
    rta.entries
  FROM public.resolution_time_analytics rta
  ORDER BY rta.total_seconds DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_resolution_time_analytics() TO authenticated;`;

const SEED_SQL = `-- Run after the enum role query above has succeeded in a separate execution.
-- This creates/refreshes demo login accounts.
-- Password for all: TestPass!2345

-- Use the full local file:
-- supabase/seed_test_accounts.sql`;

export function DatabaseMigrationPanel() {
  const query = useQuery({
    queryKey: ["database-migration-checks"],
    queryFn: fetchMigrationChecks,
  });

  const checks = query.data ?? [];
  const pending = checks.filter((check) => !check.applied);
  const sql = useMemo(() => `${MIGRATION_SQL}\n\n${SEED_SQL}`, []);

  const autoApply = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("apply_pending_migrations");
      if (error) throw new Error(error.message);
      return data as { applied?: string[]; already_up_to_date?: boolean } | null;
    },
    onSuccess: async (data) => {
      const applied = data?.applied ?? [];
      toast.success(
        applied.length > 0
          ? `Applied: ${applied.join(", ")}`
          : "Database is already up to date — setup verified.",
      );
      await query.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const copySql = async () => {
    await navigator.clipboard.writeText(sql);
    toast.success("Migration SQL copied");
  };


  return (
    <div className="space-y-4">
      <Alert>
        <DatabaseZap className="h-4 w-4" />
        <AlertTitle>Safe migration workflow</AlertTitle>
        <AlertDescription>
          Browser sessions cannot safely run arbitrary database migrations. Use Supabase SQL Editor
          or CLI for DDL, then refresh this panel to verify what is applied.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Checking database setup...</p>
        ) : (
          checks.map((check) => (
            <div
              key={check.key}
              className="flex flex-col gap-2 rounded-md border border-border/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {check.applied ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 text-warning" />
                  )}
                  {check.label}
                </p>
                <p className="text-xs text-muted-foreground">{check.detail}</p>
              </div>
              <Badge variant="outline" className={check.applied ? "text-success" : "text-warning"}>
                {check.applied ? "Applied" : "Pending"}
              </Badge>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => autoApply.mutate()}
          disabled={autoApply.isPending}
        >
          <PlayCircle className="me-1.5 h-3.5 w-3.5" />
          {autoApply.isPending ? "Applying…" : "Check & auto-apply migrations"}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw className="me-1.5 h-3.5 w-3.5" />
          Refresh status
        </Button>
        <Button type="button" size="sm" onClick={copySql}>
          <Clipboard className="me-1.5 h-3.5 w-3.5" />
          Copy pending SQL
        </Button>
        <Button asChild type="button" variant="secondary" size="sm">
          <a
            href="https://supabase.com/dashboard/project/ryrataygmwpoyrljlntx/sql/new"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="me-1.5 h-3.5 w-3.5" />
            Open SQL Editor
          </a>
        </Button>
      </div>

      {pending.length > 0 && (
        <Textarea
          readOnly
          value={sql}
          className="min-h-72 font-mono text-xs"
          aria-label="Pending migration SQL"
        />
      )}
    </div>
  );
}
