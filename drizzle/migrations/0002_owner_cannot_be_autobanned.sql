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

  IF public.has_role(NEW.user_id, 'owner') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_warnings (user_id, reason, content, username, chat_id)
  VALUES (
    NEW.user_id,
    'Inappropriate language',
    NEW.content,
    (SELECT username FROM public.profiles WHERE id = NEW.user_id),
    NEW.chat_id
  );

  UPDATE public.messages
  SET content = '⚠️ This message was removed for inappropriate language.'
  WHERE id = NEW.id;

  SELECT count(*) INTO _count FROM public.user_warnings WHERE user_id = NEW.user_id;

  IF _count >= 3 THEN
    INSERT INTO public.banned_users (user_id, banned_by, reason, expires_at)
    VALUES (NEW.user_id, NEW.user_id, 'Auto-ban: 3 warnings for inappropriate language', now() + interval '7 days')
    ON CONFLICT (user_id) DO UPDATE
      SET banned_by = EXCLUDED.banned_by,
          reason = EXCLUDED.reason,
          expires_at = EXCLUDED.expires_at,
          banned_at = now();
  END IF;

  RETURN NEW;
END;
$function$;