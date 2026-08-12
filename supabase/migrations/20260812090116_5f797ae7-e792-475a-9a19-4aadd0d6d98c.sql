ALTER TABLE public.project_messages
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by uuid;

CREATE INDEX IF NOT EXISTS project_messages_pinned_idx
  ON public.project_messages(project_id, pinned_at DESC)
  WHERE pinned_at IS NOT NULL;

DROP POLICY IF EXISTS project_messages_pin_update ON public.project_messages;
CREATE POLICY project_messages_pin_update ON public.project_messages
  FOR UPDATE TO authenticated
  USING (
    public.can_access_project_chat(project_id, auth.uid())
    AND (
      user_id = auth.uid()
      OR public.is_staff(auth.uid())
      OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.created_by = auth.uid())
    )
  )
  WITH CHECK (
    public.can_access_project_chat(project_id, auth.uid())
    AND (
      user_id = auth.uid()
      OR public.is_staff(auth.uid())
      OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.created_by = auth.uid())
    )
  );