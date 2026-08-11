-- SLA breach notifications + supporting indexes

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Speed up the SLA scan and the activity feed / bug list ordering
CREATE INDEX IF NOT EXISTS bugs_status_priority_created_idx
  ON public.bugs (status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS bug_history_created_at_idx
  ON public.bug_history (created_at DESC);
CREATE INDEX IF NOT EXISTS comments_created_at_idx
  ON public.comments (created_at DESC);
CREATE INDEX IF NOT EXISTS project_messages_created_at_idx
  ON public.project_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

-- Hours a bug may stay open before it breaches its SLA, by priority.
CREATE OR REPLACE FUNCTION public.sla_target_hours(_priority text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(_priority, ''))
    WHEN 'critical' THEN 8
    WHEN 'high' THEN 24
    WHEN 'medium' THEN 72
    WHEN 'low' THEN 168
    ELSE 72
  END;
$$;

-- Notifies assignees and oversight roles about open bugs past their SLA target.
-- Re-runs are safe: a bug notifies a given user at most once per 24 hours.
CREATE OR REPLACE FUNCTION public.sla_breach_scan()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  bug record;
  target uuid;
  overdue_hours integer;
  created_count integer := 0;
  scanned_count integer := 0;
BEGIN
  FOR bug IN
    SELECT b.id, b.bug_id, b.title, b.priority, b.created_at, b.assigned_to
    FROM public.bugs b
    WHERE b.status NOT IN ('Fixed', 'Closed')
      AND b.created_at < now() - make_interval(hours => public.sla_target_hours(b.priority))
    ORDER BY b.created_at
  LOOP
    scanned_count := scanned_count + 1;
    overdue_hours := floor(
      extract(epoch FROM (now() - bug.created_at)) / 3600
    )::int - public.sla_target_hours(bug.priority);

    FOR target IN
      SELECT DISTINCT uid FROM (
        SELECT bug.assigned_to AS uid
        UNION
        SELECT ur.user_id FROM public.user_roles ur
        WHERE ur.role IN ('admin', 'supervisor', 'monitor')
      ) candidates
      WHERE uid IS NOT NULL
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = target
          AND n.bug_id = bug.id
          AND n.type = 'sla_breach'
          AND n.created_at > now() - interval '24 hours'
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.notifications (user_id, bug_id, bug_title, message, type)
      VALUES (
        target,
        bug.id,
        bug.title,
        'SLA breached: ' || bug.bug_id || ' (' || bug.priority || ') is '
          || greatest(overdue_hours, 0) || 'h past its '
          || public.sla_target_hours(bug.priority) || 'h target.',
        'sla_breach'
      );
      created_count := created_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'breached_bugs', scanned_count,
    'notifications_created', created_count,
    'ran_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sla_breach_scan() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sla_breach_scan() TO service_role;

-- Staff-triggered wrapper so oversight roles can run the check on demand.
CREATE OR REPLACE FUNCTION public.run_sla_breach_scan()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'monitor')
  ) THEN
    RAISE EXCEPTION 'Only admins, supervisors and monitors may run the SLA scan.';
  END IF;
  RETURN public.sla_breach_scan();
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_sla_breach_scan() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_sla_breach_scan() TO service_role;

-- Hourly automatic scan
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sla-breach-scan-hourly';
SELECT cron.schedule('sla-breach-scan-hourly', '0 * * * *', $$SELECT public.sla_breach_scan();$$);