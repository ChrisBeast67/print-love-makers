
CREATE OR REPLACE FUNCTION public.admin_ban_user(_target uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _target = auth.uid() THEN RAISE EXCEPTION 'Cannot ban yourself'; END IF;
  IF public.has_role(_target, 'owner') THEN
    RAISE EXCEPTION 'Owners cannot be banned';
  END IF;
  IF public.has_role(_target, 'moderator') AND NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Only owners can ban moderators';
  END IF;
  INSERT INTO public.banned_users (user_id, banned_by, reason)
  VALUES (_target, auth.uid(), _reason)
  ON CONFLICT (user_id) DO UPDATE SET banned_by = auth.uid(), reason = EXCLUDED.reason, banned_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_unban_user(_target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF public.has_role(_target, 'moderator') AND NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Only owners can unban moderators';
  END IF;
  DELETE FROM public.banned_users WHERE user_id = _target;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_user_data(_target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _target = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;
  IF public.has_role(_target, 'owner') THEN
    RAISE EXCEPTION 'Owners cannot be deleted';
  END IF;
  IF public.has_role(_target, 'moderator') AND NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Only owners can delete moderators';
  END IF;

  DELETE FROM public.trade_offers WHERE from_user = _target OR to_user = _target;
  DELETE FROM public.user_avatars WHERE user_id = _target;
  DELETE FROM public.user_packs WHERE user_id = _target;
  DELETE FROM public.user_credits WHERE user_id = _target;
  DELETE FROM public.daily_claims WHERE user_id = _target;
  DELETE FROM public.typing_indicators WHERE user_id = _target;
  DELETE FROM public.messages WHERE user_id = _target;
  DELETE FROM public.chat_members WHERE user_id = _target;
  DELETE FROM public.friendships WHERE requester_id = _target OR addressee_id = _target;
  DELETE FROM public.banned_users WHERE user_id = _target;
  DELETE FROM public.user_roles WHERE user_id = _target;
  UPDATE public.profiles SET equipped_avatar_id = NULL WHERE equipped_avatar_id IS NOT NULL AND id = _target;
  DELETE FROM public.profiles WHERE id = _target;
END;
$function$;
