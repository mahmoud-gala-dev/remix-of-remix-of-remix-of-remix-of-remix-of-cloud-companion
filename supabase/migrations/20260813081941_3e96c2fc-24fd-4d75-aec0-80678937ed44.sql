CREATE OR REPLACE FUNCTION public.bug_visible(_project_id bigint, _reported_by uuid, _assigned_to uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.is_staff(_user_id)
    OR public.has_role(_user_id, 'auditor'::app_role)
    OR public.has_role(_user_id, 'monitor'::app_role)
    OR _reported_by = _user_id
    OR _assigned_to = _user_id
    OR EXISTS (
      SELECT 1 FROM public.project_developers pd
      WHERE pd.project_id = _project_id AND pd.user_id = _user_id
    )
  )
$$;

DROP POLICY IF EXISTS bugs_select ON public.bugs;
CREATE POLICY bugs_select ON public.bugs FOR SELECT TO authenticated
USING (public.bug_visible(project_id, reported_by, assigned_to, auth.uid()));

DROP FUNCTION IF EXISTS public.bug_dashboard_stats(text);
CREATE OR REPLACE FUNCTION public.bug_dashboard_stats(_scope text DEFAULT 'all')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  result jsonb;
BEGIN
  WITH scoped AS (
    SELECT *
    FROM public.bugs b
    WHERE public.bug_visible(b.project_id, b.reported_by, b.assigned_to, uid)
      AND ((_scope = 'all')
        OR (_scope = 'assigned' AND b.assigned_to = uid)
        OR (_scope = 'reported' AND b.reported_by = uid))
  ),
  module_rows AS (
    SELECT COALESCE(module, 'Unassigned') AS module,
           count(*)::int AS total,
           count(*) FILTER (WHERE status NOT IN ('Fixed', 'Closed'))::int AS open,
           count(*) FILTER (WHERE status IN ('Fixed', 'Closed'))::int AS fixed
    FROM scoped
    GROUP BY COALESCE(module, 'Unassigned')
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*)::int FROM scoped),
    'by_status', COALESCE((SELECT jsonb_object_agg(status, total) FROM (SELECT status, count(*)::int total FROM scoped GROUP BY status) s), '{}'::jsonb),
    'by_priority', COALESCE((SELECT jsonb_object_agg(priority, total) FROM (SELECT priority, count(*)::int total FROM scoped GROUP BY priority) s), '{}'::jsonb),
    'by_severity', COALESCE((SELECT jsonb_object_agg(severity, total) FROM (SELECT severity, count(*)::int total FROM scoped GROUP BY severity) s), '{}'::jsonb),
    'by_module', COALESCE((SELECT jsonb_agg(to_jsonb(module_rows) ORDER BY total DESC) FROM module_rows), '[]'::jsonb),
    'modules', COALESCE((SELECT jsonb_agg(module ORDER BY module) FROM (SELECT DISTINCT module FROM scoped WHERE module IS NOT NULL) m), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;