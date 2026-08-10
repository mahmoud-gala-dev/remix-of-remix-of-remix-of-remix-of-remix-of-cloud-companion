CREATE OR REPLACE FUNCTION public.can_access_project_chat(_project_id bigint, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.created_by = _user_id)
    OR EXISTS (SELECT 1 FROM public.project_developers pd WHERE pd.project_id = _project_id AND pd.user_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role::text IN ('admin','supervisor','auditor','monitor','tester')
    )
  );
$$;

CREATE TABLE public.project_messages (
  id bigserial PRIMARY KEY,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_messages_content_length CHECK (char_length(content) BETWEEN 1 AND 4000)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_messages TO authenticated;
GRANT ALL ON public.project_messages TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.project_messages_id_seq TO authenticated;

ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_messages_select ON public.project_messages
  FOR SELECT TO authenticated
  USING (public.can_access_project_chat(project_id, auth.uid()));

CREATE POLICY project_messages_insert ON public.project_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_access_project_chat(project_id, auth.uid()));

CREATE POLICY project_messages_update ON public.project_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY project_messages_delete ON public.project_messages
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE INDEX project_messages_project_created_idx ON public.project_messages(project_id, created_at);

CREATE TRIGGER project_messages_updated_at
  BEFORE UPDATE ON public.project_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.project_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_messages;