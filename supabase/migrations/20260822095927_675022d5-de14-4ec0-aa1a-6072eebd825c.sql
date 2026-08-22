CREATE TABLE public.global_music (
  id smallint PRIMARY KEY DEFAULT 1,
  url text,
  title text,
  playing boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT global_music_singleton CHECK (id = 1)
);

GRANT SELECT ON public.global_music TO anon;
GRANT SELECT ON public.global_music TO authenticated;
GRANT ALL ON public.global_music TO service_role;

ALTER TABLE public.global_music ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view global music" ON public.global_music FOR SELECT USING (true);

INSERT INTO public.global_music (id, playing) VALUES (1, false);

ALTER TABLE public.global_music REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.global_music;

CREATE OR REPLACE FUNCTION public.admin_set_global_music(_url text, _title text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF coalesce(trim(_url), '') = '' THEN RAISE EXCEPTION 'Music URL required'; END IF;
  IF _url !~* '^https://' THEN RAISE EXCEPTION 'URL must start with https://'; END IF;

  UPDATE public.global_music
  SET url = trim(_url), title = NULLIF(trim(_title), ''), playing = true,
      started_at = now(), updated_at = now()
  WHERE id = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_stop_global_music()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.global_music SET playing = false, updated_at = now() WHERE id = 1;
END;
$$;