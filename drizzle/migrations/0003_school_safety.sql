CREATE OR REPLACE FUNCTION public.contains_bad_word(_text text)
 RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $function$
DECLARE
  _bad text[] := ARRAY[
    'fuck','fuk','fck','fuq','phuck','shit','sh1t','bitch','biatch','asshole','arsehole','bastard','dick','cunt','slut','whore','hoe',
    'fag','faggot','nigger','nigga','retard','pussy','cock','douche','prick','wanker','twat','motherfucker','mf','wtf','stfu','gtfo',
    'jerk','kys','kill yourself','i hate you','loser','moron','idiot','dumbass','damn','goddamn','crap','piss','boob','boobs','tits',
    'penis','vagina','porn','sex','sexy','nude','nudes','horny','gooner','gyatt','hawk tuah','dildo','cum','rape','nazi','hitler'
  ];
  _c text := lower(coalesce(_text, ''));
  _s text;
  _w text;
BEGIN
  IF left(_c, 8) = '__img__:' OR left(_c, 8) = '__vid__:' THEN RETURN false; END IF;
  _c := translate(_c, '013457@$!|+', 'oieastasiit');
  _s := regexp_replace(_c, '[^a-z ]', '', 'g');
  _s := regexp_replace(_s, '(.)\1{2,}', '\1', 'g');
  FOREACH _w IN ARRAY _bad LOOP
    IF _s ~ ('(^|[^a-z])' || _w || '([^a-z]|$)') THEN RETURN true; END IF;
    IF length(_w) >= 5 AND position(' ' in _w) = 0 AND position(_w in replace(_s, ' ', '')) > 0
       AND _w NOT IN ('idiot') THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_username_clean()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR NEW.username IS DISTINCT FROM OLD.username)
     AND public.contains_bad_word(replace(replace(NEW.username,'_',' '),'.',' ')) THEN
    RAISE EXCEPTION 'That username is not allowed. Please choose a school-friendly name.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_username_clean ON public.profiles;
CREATE TRIGGER profiles_username_clean BEFORE INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.check_username_clean();

CREATE TABLE public.message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid,
  chat_id uuid,
  content text NOT NULL,
  author_id uuid,
  author_username text,
  reported_by uuid NOT NULL,
  reporter_username text,
  reason text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, reported_by)
);
GRANT SELECT ON public.message_reports TO authenticated;
GRANT ALL ON public.message_reports TO service_role;
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view reports" ON public.message_reports FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.report_message(_message_id uuid, _reason text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE m record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO m FROM public.messages WHERE id = _message_id;
  IF m IS NULL OR NOT public.is_chat_member(m.chat_id, auth.uid()) THEN RAISE EXCEPTION 'Message not found'; END IF;
  INSERT INTO public.message_reports(message_id, chat_id, content, author_id, author_username, reported_by, reporter_username, reason)
  VALUES (m.id, m.chat_id, m.content, m.user_id,
    (SELECT username FROM public.profiles WHERE id = m.user_id), auth.uid(),
    (SELECT username FROM public.profiles WHERE id = auth.uid()), left(coalesce(_reason,''), 300))
  ON CONFLICT (message_id, reported_by) DO NOTHING;
END $$;
GRANT EXECUTE ON FUNCTION public.report_message(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_message_report(_id uuid, _remove boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r record;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT * INTO r FROM public.message_reports WHERE id = _id;
  IF r IS NULL THEN RAISE EXCEPTION 'Report not found'; END IF;
  IF _remove AND r.message_id IS NOT NULL THEN DELETE FROM public.messages WHERE id = r.message_id; END IF;
  UPDATE public.message_reports SET status = CASE WHEN _remove THEN 'removed' ELSE 'dismissed' END
   WHERE message_id = r.message_id;
END $$;
GRANT EXECUTE ON FUNCTION public.resolve_message_report(uuid, boolean) TO authenticated;