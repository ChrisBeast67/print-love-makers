
-- Update is_staff to include deputy (cast to text to avoid enum literal issue)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('owner','admin','moderator','deputy')
  )
$$;

-- Update admin_set_role to allow deputy
CREATE OR REPLACE FUNCTION public.admin_set_role(_target uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Only owners can change roles';
  END IF;
  IF _role::text NOT IN ('moderator','owner','deputy') THEN
    RAISE EXCEPTION 'Invalid role assignment';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, _role)
  ON CONFLICT DO NOTHING;
END;
$$;

-- has_role: cast to text
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = _role::text
  )
$$;

-- Update admin_ban_user
CREATE OR REPLACE FUNCTION public.admin_ban_user(_target uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _target = auth.uid() THEN RAISE EXCEPTION 'Cannot ban yourself'; END IF;
  IF public.has_role(_target, 'owner'::app_role) THEN RAISE EXCEPTION 'Owners cannot be banned'; END IF;
  IF public.has_role(_target, 'deputy'::app_role) AND NOT public.has_role(auth.uid(), 'owner'::app_role) THEN
    RAISE EXCEPTION 'Only owners can ban deputies';
  END IF;
  IF public.has_role(_target, 'moderator'::app_role) AND NOT (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'deputy'::app_role)) THEN
    RAISE EXCEPTION 'Only owners or deputies can ban moderators';
  END IF;
  INSERT INTO public.banned_users (user_id, banned_by, reason)
  VALUES (_target, auth.uid(), _reason)
  ON CONFLICT (user_id) DO UPDATE SET banned_by = auth.uid(), reason = EXCLUDED.reason, banned_at = now();
END;
$$;

-- Update admin_unban_user
CREATE OR REPLACE FUNCTION public.admin_unban_user(_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF public.has_role(_target, 'deputy'::app_role) AND NOT public.has_role(auth.uid(), 'owner'::app_role) THEN
    RAISE EXCEPTION 'Only owners can unban deputies';
  END IF;
  IF public.has_role(_target, 'moderator'::app_role) AND NOT (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'deputy'::app_role)) THEN
    RAISE EXCEPTION 'Only owners or deputies can unban moderators';
  END IF;
  DELETE FROM public.banned_users WHERE user_id = _target;
END;
$$;

-- Update admin_delete_user_data (1-arg)
CREATE OR REPLACE FUNCTION public.admin_delete_user_data(_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _target = auth.uid() THEN RAISE EXCEPTION 'Cannot delete your own account'; END IF;
  IF public.has_role(_target, 'owner'::app_role) THEN RAISE EXCEPTION 'Owners cannot be deleted'; END IF;
  IF public.has_role(_target, 'deputy'::app_role) AND NOT public.has_role(auth.uid(), 'owner'::app_role) THEN
    RAISE EXCEPTION 'Only owners can delete deputies';
  END IF;
  IF public.has_role(_target, 'moderator'::app_role) AND NOT (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'deputy'::app_role)) THEN
    RAISE EXCEPTION 'Only owners or deputies can delete moderators';
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

-- Update admin_delete_user_data (2-arg)
CREATE OR REPLACE FUNCTION public.admin_delete_user_data(_target uuid, _caller uuid DEFAULT auth.uid())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_staff(_caller) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _target = _caller THEN RAISE EXCEPTION 'Cannot delete your own account'; END IF;
  IF public.has_role(_target, 'owner'::app_role) THEN RAISE EXCEPTION 'Owners cannot be deleted'; END IF;
  IF public.has_role(_target, 'deputy'::app_role) AND NOT public.has_role(_caller, 'owner'::app_role) THEN
    RAISE EXCEPTION 'Only owners can delete deputies';
  END IF;
  IF public.has_role(_target, 'moderator'::app_role) AND NOT (public.has_role(_caller, 'owner'::app_role) OR public.has_role(_caller, 'deputy'::app_role)) THEN
    RAISE EXCEPTION 'Only owners or deputies can delete moderators';
  END IF;

  DELETE FROM public.trade_offers WHERE from_user = _target OR to_user = _target;
  DELETE FROM public.user_avatars WHERE user_id = _target;
  DELETE FROM public.user_packs WHERE user_id = _target;
  DELETE FROM public.user_credits WHERE user_id = _target;
  DELETE FROM public.user_luck_boosts WHERE user_id = _target;
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
