CREATE OR REPLACE FUNCTION public.notify_project_message_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uname text;
  target uuid;
  pname text;
BEGIN
  SELECT name INTO pname FROM public.projects WHERE id = NEW.project_id;

  FOR uname IN
    SELECT DISTINCT lower(m.arr[1])
    FROM (SELECT regexp_matches(NEW.content, '@([A-Za-z0-9_.\-]{2,32})', 'g') AS arr) m
  LOOP
    SELECT p.id INTO target FROM public.profiles p WHERE lower(p.username) = uname LIMIT 1;
    IF target IS NOT NULL AND target <> NEW.user_id THEN
      INSERT INTO public.notifications (user_id, bug_id, bug_title, message, type)
      VALUES (
        target,
        NULL,
        COALESCE(pname, 'Project chat'),
        'You were mentioned in ' || COALESCE(pname, 'project chat') || ': ' || left(NEW.content, 160),
        'chat_mention'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_messages_notify_mentions ON public.project_messages;
CREATE TRIGGER project_messages_notify_mentions
AFTER INSERT ON public.project_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_project_message_mentions();