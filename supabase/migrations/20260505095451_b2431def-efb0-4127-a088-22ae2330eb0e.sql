
-- Update admin_set_role: owners can set any role, deputies can only set moderator
CREATE OR REPLACE FUNCTION public.admin_set_role(_target uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Only owners and deputies can set roles
  IF NOT (public.has_role(_me, 'owner'::app_role) OR public.has_role(_me, 'deputy'::app_role)) THEN
    RAISE EXCEPTION 'Only owners and deputies can change roles';
  END IF;

  -- Deputies can only assign moderator
  IF public.has_role(_me, 'deputy'::app_role) AND NOT public.has_role(_me, 'owner'::app_role) THEN
    IF _role::text NOT IN ('moderator') THEN
      RAISE EXCEPTION 'Deputies can only assign moderator role';
    END IF;
  END IF;

  -- Owners can assign moderator, deputy, owner
  IF public.has_role(_me, 'owner'::app_role) THEN
    IF _role::text NOT IN ('moderator','owner','deputy') THEN
      RAISE EXCEPTION 'Invalid role assignment';
    END IF;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (_target, _role)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Update admin_remove_role: owners and deputies can remove roles (deputies can only remove moderator)
CREATE OR REPLACE FUNCTION public.admin_remove_role(_target uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT (public.has_role(_me, 'owner'::app_role) OR public.has_role(_me, 'deputy'::app_role)) THEN
    RAISE EXCEPTION 'Only owners and deputies can change roles';
  END IF;

  -- Deputies can only remove moderator
  IF public.has_role(_me, 'deputy'::app_role) AND NOT public.has_role(_me, 'owner'::app_role) THEN
    IF _role::text <> 'moderator' THEN
      RAISE EXCEPTION 'Deputies can only remove moderator role';
    END IF;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target AND role = _role;
END;
$$;

-- New function: staff (owner/deputy/admin) can take away a user's avatar
CREATE OR REPLACE FUNCTION public.admin_remove_avatar(_target uuid, _avatar_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_staff(_me) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  -- If equipped, unequip
  UPDATE public.profiles SET equipped_avatar_id = NULL
    WHERE id = _target AND equipped_avatar_id = _avatar_item_id;

  -- Remove one quantity
  UPDATE public.user_avatars SET quantity = quantity - 1
    WHERE user_id = _target AND avatar_item_id = _avatar_item_id;

  -- Delete if zero
  DELETE FROM public.user_avatars
    WHERE user_id = _target AND avatar_item_id = _avatar_item_id AND quantity <= 0;
END;
$$;
