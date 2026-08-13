CREATE TABLE public.bug_dev_notes (
  id bigserial PRIMARY KEY,
  bug_id bigint NOT NULL REFERENCES public.bugs(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'code',
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'ts',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bug_dev_notes_kind_check CHECK (kind IN ('code','checklist','mindmap'))
);

CREATE INDEX bug_dev_notes_bug_id_idx ON public.bug_dev_notes(bug_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bug_dev_notes TO authenticated;
GRANT ALL ON public.bug_dev_notes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.bug_dev_notes_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.bug_dev_notes_id_seq TO service_role;

ALTER TABLE public.bug_dev_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notes are readable by staff, owners and bug handlers"
ON public.bug_dev_notes FOR SELECT TO authenticated
USING (
  author_id = auth.uid()
  OR public.is_staff(auth.uid())
  OR public.has_role(auth.uid(), 'monitor')
  OR public.has_role(auth.uid(), 'auditor')
  OR public.can_manage_bug(bug_id, auth.uid())
);

CREATE POLICY "Bug handlers can add their own notes"
ON public.bug_dev_notes FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (public.can_manage_bug(bug_id, auth.uid()) OR public.is_staff(auth.uid()))
);

CREATE POLICY "Authors and staff can update notes"
ON public.bug_dev_notes FOR UPDATE TO authenticated
USING (author_id = auth.uid() OR public.is_staff(auth.uid()))
WITH CHECK (author_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "Authors and staff can delete notes"
ON public.bug_dev_notes FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TRIGGER bug_dev_notes_set_updated_at
BEFORE UPDATE ON public.bug_dev_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.request_module_help(_module text, _message text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sent integer := 0;
  _who text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT COALESCE(p.username, 'A team member') INTO _who
  FROM public.profiles p WHERE p.id = auth.uid();

  INSERT INTO public.notifications (user_id, message, type, read)
  SELECT ur.user_id,
         COALESCE(_who, 'A team member') || ' needs help with: ' || COALESCE(NULLIF(trim(_module), ''), 'a module')
           || CASE WHEN COALESCE(trim(_message), '') = '' THEN '' ELSE ' — ' || trim(_message) END,
         'help',
         false
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'supervisor');

  GET DIAGNOSTICS _sent = ROW_COUNT;
  RETURN _sent;
END;
$$;

REVOKE ALL ON FUNCTION public.request_module_help(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.request_module_help(text, text) TO authenticated;