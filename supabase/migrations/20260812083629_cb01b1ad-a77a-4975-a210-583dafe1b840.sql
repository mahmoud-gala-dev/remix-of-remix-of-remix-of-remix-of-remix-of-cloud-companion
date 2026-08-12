-- Chat message reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id bigserial PRIMARY KEY,
  message_id bigint NOT NULL REFERENCES public.project_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.message_reactions_id_seq TO authenticated;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_reactions_select ON public.message_reactions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_messages m
    WHERE m.id = message_reactions.message_id
      AND public.can_access_project_chat(m.project_id, auth.uid())
  ));

CREATE POLICY message_reactions_insert ON public.message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.project_messages m
    WHERE m.id = message_reactions.message_id
      AND public.can_access_project_chat(m.project_id, auth.uid())
  ));

CREATE POLICY message_reactions_delete ON public.message_reactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS message_reactions_message_idx ON public.message_reactions(message_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

-- Script improvement suggestions module
CREATE TABLE IF NOT EXISTS public.improvements (
  id bigserial PRIMARY KEY,
  title text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'improvement',
  status text NOT NULL DEFAULT 'Open',
  priority text NOT NULL DEFAULT 'Medium',
  project_id bigint REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.improvements TO authenticated;
GRANT ALL ON public.improvements TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.improvements_id_seq TO authenticated;
ALTER TABLE public.improvements ENABLE ROW LEVEL SECURITY;

CREATE POLICY improvements_select ON public.improvements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY improvements_insert ON public.improvements
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY improvements_update ON public.improvements
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_staff(auth.uid()))
  WITH CHECK (auth.uid() = created_by OR public.is_staff(auth.uid()));
CREATE POLICY improvements_delete ON public.improvements
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_staff(auth.uid()));

CREATE TRIGGER improvements_updated_at BEFORE UPDATE ON public.improvements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.improvement_comments (
  id bigserial PRIMARY KEY,
  improvement_id bigint NOT NULL REFERENCES public.improvements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.improvement_comments TO authenticated;
GRANT ALL ON public.improvement_comments TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.improvement_comments_id_seq TO authenticated;
ALTER TABLE public.improvement_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY improvement_comments_select ON public.improvement_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY improvement_comments_insert ON public.improvement_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY improvement_comments_update ON public.improvement_comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY improvement_comments_delete ON public.improvement_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS improvement_comments_improvement_idx ON public.improvement_comments(improvement_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.improvements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.improvement_comments;