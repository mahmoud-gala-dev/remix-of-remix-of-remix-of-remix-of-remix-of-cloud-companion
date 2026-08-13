CREATE OR REPLACE FUNCTION public.can_write_bug_dev_note(_bug_id bigint, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.is_staff(_user_id)
    OR (
      public.has_role(_user_id, 'developer')
      AND EXISTS (
        SELECT 1
        FROM public.bugs b
        WHERE b.id = _bug_id
          AND (b.assigned_to IS NULL OR b.assigned_to = _user_id)
      )
    )
  )
$$;

REVOKE ALL ON FUNCTION public.can_write_bug_dev_note(bigint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_bug_dev_note(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_bug_dev_note(bigint, uuid) TO service_role;

DROP POLICY IF EXISTS "Bug handlers can add their own notes" ON public.bug_dev_notes;
CREATE POLICY "Developers and staff can add their own notes"
ON public.bug_dev_notes FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND public.can_write_bug_dev_note(bug_id, auth.uid())
);

DROP POLICY IF EXISTS "Authors and staff can update notes" ON public.bug_dev_notes;
CREATE POLICY "Developers and staff can update notes"
ON public.bug_dev_notes FOR UPDATE TO authenticated
USING (
  public.is_staff(auth.uid())
  OR (
    author_id = auth.uid()
    AND public.can_write_bug_dev_note(bug_id, auth.uid())
  )
)
WITH CHECK (
  public.is_staff(auth.uid())
  OR (
    author_id = auth.uid()
    AND public.can_write_bug_dev_note(bug_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Authors and staff can delete notes" ON public.bug_dev_notes;
CREATE POLICY "Developers and staff can delete notes"
ON public.bug_dev_notes FOR DELETE TO authenticated
USING (
  public.is_staff(auth.uid())
  OR (
    author_id = auth.uid()
    AND public.can_write_bug_dev_note(bug_id, auth.uid())
  )
);
