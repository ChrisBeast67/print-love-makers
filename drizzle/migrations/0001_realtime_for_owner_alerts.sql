ALTER TABLE public.user_warnings REPLICA IDENTITY FULL;
ALTER TABLE public.moderation_requests REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_warnings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.moderation_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;