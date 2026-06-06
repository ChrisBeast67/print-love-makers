-- 1. Add expiry support to bans (null = permanent)
ALTER TABLE public.banned_users ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 2. Make is_banned respect expiry (expired bans no longer count)
CREATE OR REPLACE FUNCTION public.is_banned(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.banned_users
    WHERE user_id = _user_id
      AND (expires_at IS NULL OR expires_at > now())
  )
$function$;

-- 3. Warnings table
CREATE TABLE IF NOT EXISTS public.user_warnings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  reason text NOT NULL DEFAULT 'Inappropriate language',
  content text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_warnings TO authenticated;
GRANT ALL ON public.user_warnings TO service_role;

ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own warnings"
  ON public.user_warnings FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- 4. Bad word detector
CREATE OR REPLACE FUNCTION public.contains_bad_word(_text text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  _bad text[] := ARRAY[
    'fuck','fuk','shit','bitch','asshole','bastard','dick','cunt','slut','whore',
    'fag','faggot','nigger','nigga','retard','pussy','cock','douche','prick',
    'wanker','twat','motherfucker','jerk','kys','kill yourself','i hate you','loser','moron'
  ];
  _c text := lower(coalesce(_text, ''));
  _w text;
BEGIN
  IF left(_c, 8) = '__img__:' THEN
    RETURN false;
  END IF;
  FOREACH _w IN ARRAY _bad LOOP
    IF _c ~ ('(^|[^a-z])' || _w || '([^a-z]|$)') THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$function$;

-- 5. Moderation trigger (AFTER INSERT so RLS on the message already passed)
CREATE OR REPLACE FUNCTION public.moderate_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _count int;
BEGIN
  IF NOT public.contains_bad_word(NEW.content) THEN
    RETURN NEW;
  END IF;

  -- Record the warning
  INSERT INTO public.user_warnings (user_id, reason, content)
  VALUES (NEW.user_id, 'Inappropriate language', NEW.content);

  -- Censor the offending message
  UPDATE public.messages
  SET content = '⚠️ This message was removed for inappropriate language.'
  WHERE id = NEW.id;

  SELECT count(*) INTO _count FROM public.user_warnings WHERE user_id = NEW.user_id;

  -- 3rd warning => 1 week ban, then reset warnings
  IF _count >= 3 THEN
    INSERT INTO public.banned_users (user_id, banned_by, reason, expires_at)
    VALUES (NEW.user_id, NEW.user_id, 'Auto-ban: 3 warnings for inappropriate language', now() + interval '7 days')
    ON CONFLICT (user_id) DO UPDATE
      SET banned_by = EXCLUDED.banned_by,
          reason = EXCLUDED.reason,
          expires_at = EXCLUDED.expires_at,
          banned_at = now();

    DELETE FROM public.user_warnings WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS moderate_message_trigger ON public.messages;
CREATE TRIGGER moderate_message_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.moderate_message();