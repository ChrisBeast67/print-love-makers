CREATE OR REPLACE FUNCTION public.start_call(_chat_id uuid, _kind text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _me uuid := auth.uid();
  _id uuid;
  _admin_only boolean;
  _member_count int;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _kind NOT IN ('audio','video') THEN RAISE EXCEPTION 'Invalid call type'; END IF;
  IF NOT public.is_chat_member(_chat_id, _me) THEN RAISE EXCEPTION 'Not a member of this chat'; END IF;
  IF public.is_banned(_me) THEN RAISE EXCEPTION 'You are banned'; END IF;

  SELECT admin_only INTO _admin_only FROM public.chats WHERE id = _chat_id;
  IF COALESCE(_admin_only, false) AND NOT public.is_chat_admin(_chat_id, _me) THEN
    RAISE EXCEPTION 'Only admins can start calls in this chat';
  END IF;

  UPDATE public.calls SET status = 'ended', ended_at = now()
    WHERE chat_id = _chat_id AND status = 'ringing' AND created_at < now() - interval '60 seconds';

  IF EXISTS (SELECT 1 FROM public.calls WHERE chat_id = _chat_id AND status IN ('ringing','active')) THEN
    RAISE EXCEPTION 'A call is already in progress in this chat';
  END IF;

  SELECT count(*) INTO _member_count FROM public.chat_members WHERE chat_id = _chat_id;
  IF _member_count > 4 THEN RAISE EXCEPTION 'Calls support up to 4 participants'; END IF;

  INSERT INTO public.calls (chat_id, started_by, kind) VALUES (_chat_id, _me, _kind)
  RETURNING id INTO _id;

  INSERT INTO public.call_participants (call_id, user_id, state, joined_at)
  VALUES (_id, _me, 'joined', now());

  INSERT INTO public.call_participants (call_id, user_id, state)
  SELECT _id, m.user_id, 'invited' FROM public.chat_members m
  WHERE m.chat_id = _chat_id AND m.user_id <> _me;

  RETURN _id;
END;
$function$;