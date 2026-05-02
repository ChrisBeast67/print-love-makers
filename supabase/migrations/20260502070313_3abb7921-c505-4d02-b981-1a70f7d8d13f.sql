
-- Events table
CREATE TYPE public.event_type AS ENUM ('easter', 'christmas', 'halloween', 'luck_boost', 'custom');

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type event_type NOT NULL DEFAULT 'custom',
  luck_multiplier numeric NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view events" ON public.events FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert events" ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND auth.uid() = created_by);

CREATE POLICY "Staff can update events" ON public.events FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()));

-- Also allow all authenticated users to read active events (for UI display)
CREATE POLICY "Everyone can see active events" ON public.events FOR SELECT TO authenticated
  USING (active = true);

-- Function: start event
CREATE OR REPLACE FUNCTION public.admin_start_event(_name text, _type event_type, _luck_multiplier numeric DEFAULT 1)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_staff(_me) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  INSERT INTO public.events (name, type, luck_multiplier, created_by)
  VALUES (_name, _type, GREATEST(_luck_multiplier, 1), _me)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

-- Function: end event
CREATE OR REPLACE FUNCTION public.admin_end_event(_event_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_staff(_me) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE public.events SET active = false, ended_at = now() WHERE id = _event_id AND active = true;
END;
$$;

-- Function: admin grant avatar to user
CREATE OR REPLACE FUNCTION public.admin_grant_avatar(_target uuid, _avatar_item_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_staff(_me) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.avatar_items WHERE id = _avatar_item_id) THEN
    RAISE EXCEPTION 'Avatar item not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO public.user_avatars (user_id, avatar_item_id, quantity)
  VALUES (_target, _avatar_item_id, 1)
  ON CONFLICT (user_id, avatar_item_id) DO UPDATE SET quantity = public.user_avatars.quantity + 1;
END;
$$;

-- Update open_pack to also consider active global events
CREATE OR REPLACE FUNCTION public.open_pack(_pack_id uuid)
RETURNS TABLE(avatar_item_id uuid, name text, emoji text, rarity text, accent_hsl text, is_new boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me UUID := auth.uid();
  _pack RECORD;
  _bal INT;
  _i INT;
  _roll FLOAT;
  _rarity TEXT;
  _picked RECORD;
  _was_new BOOLEAN;
  _picked_id UUID;
  _updated INT;
  _mult NUMERIC := 1;
  _event_mult NUMERIC;
  _p_leg NUMERIC;
  _p_epic NUMERIC;
  _p_rare NUMERIC;
  _t_rare NUMERIC;
  _t_epic NUMERIC;
  _t_leg NUMERIC;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _pack FROM public.profile_packs WHERE id = _pack_id;
  IF _pack IS NULL THEN RAISE EXCEPTION 'Pack not found'; END IF;

  SELECT balance INTO _bal FROM public.user_credits WHERE user_id = _me FOR UPDATE;
  IF COALESCE(_bal, 0) < _pack.price THEN RAISE EXCEPTION 'Insufficient credits'; END IF;

  UPDATE public.user_credits
    SET balance = balance - _pack.price, updated_at = now()
    WHERE user_id = _me;

  -- Personal luck boost
  SELECT multiplier INTO _mult
    FROM public.user_luck_boosts
    WHERE user_id = _me AND expires_at > now();
  _mult := COALESCE(_mult, 1);

  -- Global event luck (take the highest active event multiplier)
  SELECT COALESCE(MAX(luck_multiplier), 1) INTO _event_mult
    FROM public.events
    WHERE active = true AND luck_multiplier > 1;

  -- Use the higher of personal or event multiplier
  _mult := GREATEST(_mult, _event_mult);

  _p_leg  := LEAST(0.03 * _mult, 0.5);
  _p_epic := LEAST(0.12 * _mult, 0.7 - _p_leg);
  _p_rare := LEAST(0.25 * _mult, 0.9 - _p_leg - _p_epic);

  _t_rare := 1 - _p_rare - _p_epic - _p_leg;
  _t_epic := _t_rare + _p_rare;
  _t_leg  := _t_epic + _p_epic;

  FOR _i IN 1..5 LOOP
    _roll := random();
    _rarity := CASE
      WHEN _roll < _t_rare THEN 'common'
      WHEN _roll < _t_epic THEN 'rare'
      WHEN _roll < _t_leg  THEN 'epic'
      ELSE 'legendary'
    END;

    SELECT ai.* INTO _picked
      FROM public.avatar_items ai
      WHERE ai.theme = _pack.theme AND ai.rarity = _rarity
      ORDER BY random() LIMIT 1;

    IF _picked IS NULL THEN
      SELECT ai.* INTO _picked
        FROM public.avatar_items ai
        WHERE ai.theme = _pack.theme
        ORDER BY random() LIMIT 1;
    END IF;

    _picked_id := _picked.id;

    _was_new := NOT EXISTS (
      SELECT 1 FROM public.user_avatars ua
      WHERE ua.user_id = _me AND ua.avatar_item_id = _picked_id
    );

    UPDATE public.user_avatars ua
      SET quantity = ua.quantity + 1
      WHERE ua.user_id = _me AND ua.avatar_item_id = _picked_id;
    GET DIAGNOSTICS _updated = ROW_COUNT;
    IF _updated = 0 THEN
      INSERT INTO public.user_avatars (user_id, avatar_item_id, quantity)
      VALUES (_me, _picked_id, 1);
    END IF;

    avatar_item_id := _picked_id;
    name := _picked.name;
    emoji := _picked.emoji;
    rarity := _picked.rarity;
    accent_hsl := _picked.accent_hsl;
    is_new := _was_new;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Also clean up the delete user data to handle events + luck_boosts
CREATE OR REPLACE FUNCTION public.admin_delete_user_data(_target uuid, _caller uuid DEFAULT auth.uid())
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(_caller) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _target = _caller THEN RAISE EXCEPTION 'Cannot delete your own account'; END IF;
  IF public.has_role(_target, 'owner') THEN RAISE EXCEPTION 'Owners cannot be deleted'; END IF;
  IF public.has_role(_target, 'moderator') AND NOT public.has_role(_caller, 'owner') THEN
    RAISE EXCEPTION 'Only owners can delete moderators';
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
