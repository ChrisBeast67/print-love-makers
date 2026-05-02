CREATE OR REPLACE FUNCTION public.admin_delete_user_data(_target uuid, _caller uuid DEFAULT auth.uid())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(_caller) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _target = _caller THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;
  IF public.has_role(_target, 'owner') THEN
    RAISE EXCEPTION 'Owners cannot be deleted';
  END IF;
  IF public.has_role(_target, 'moderator') AND NOT public.has_role(_caller, 'owner') THEN
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
$$;