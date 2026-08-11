ALTER TABLE public.project_messages
  ADD COLUMN IF NOT EXISTS reply_to_id bigint REFERENCES public.project_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text;

CREATE INDEX IF NOT EXISTS project_messages_reply_idx ON public.project_messages(reply_to_id);

DROP POLICY IF EXISTS project_messages_update ON public.project_messages;
CREATE POLICY project_messages_update ON public.project_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.stamp_message_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.edited_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_messages_stamp_edit ON public.project_messages;
CREATE TRIGGER project_messages_stamp_edit
  BEFORE UPDATE ON public.project_messages
  FOR EACH ROW EXECUTE FUNCTION public.stamp_message_edit();

DROP POLICY IF EXISTS "chat_attachments_read" ON storage.objects;
CREATE POLICY "chat_attachments_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "chat_attachments_insert" ON storage.objects;
CREATE POLICY "chat_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND owner = auth.uid());

DROP POLICY IF EXISTS "chat_attachments_delete" ON storage.objects;
CREATE POLICY "chat_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-attachments' AND (owner = auth.uid() OR public.is_staff(auth.uid())));