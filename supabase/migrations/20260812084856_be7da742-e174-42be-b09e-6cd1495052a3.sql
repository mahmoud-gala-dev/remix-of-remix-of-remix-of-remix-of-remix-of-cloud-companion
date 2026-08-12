GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.comments_id_seq TO authenticated;

GRANT SELECT ON public.bug_history TO authenticated;
GRANT ALL ON public.bug_history TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.bug_history_id_seq TO service_role;