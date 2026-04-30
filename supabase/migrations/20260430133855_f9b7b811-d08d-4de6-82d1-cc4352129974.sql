
CREATE TABLE IF NOT EXISTS public.user_luck_boosts (
  user_id uuid PRIMARY KEY,
  multiplier numeric NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_luck_boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own luck viewable"
ON public.user_luck_boosts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.buy_luck_boost(_tier int)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _price int;
  _mult numeric;
  _bal int;
  _now timestamptz := now();
  _base timestamptz;
  _new_expiry timestamptz;
  _current_mult numeric;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  CASE _tier
    WHEN 2 THEN _price := 50;   _mult := 2;
    WHEN 3 THEN _price := 100;  _mult := 3;
    WHEN 5 THEN _price := 150;  _mult := 5;
    WHEN 10 THEN _price := 1000; _mult := 10;
    ELSE RAISE EXCEPTION 'Invalid luck tier';
  END CASE;

  SELECT balance INTO _bal FROM public.user_credits WHERE user_id = _me FOR UPDATE;
  IF COALESCE(_bal,0) < _price THEN RAISE EXCEPTION 'Insufficient credits'; END IF;

  UPDATE public.user_credits SET balance = balance - _price, updated_at = _now WHERE user_id = _me;

  -- If an active boost of equal/greater multiplier exists, extend from its expiry; otherwise replace.
  SELECT multiplier, expires_at INTO _current_mult, _base
    FROM public.user_luck_boosts WHERE user_id = _me;

  IF _current_mult IS NOT NULL AND _base > _now AND _current_mult = _mult THEN
    _new_expiry := _base + interval '30 minutes';
    UPDATE public.user_luck_boosts
      SET expires_at = _new_expiry, updated_at = _now
      WHERE user_id = _me;
  ELSE
    _new_expiry := _now + interval '30 minutes';
    INSERT INTO public.user_luck_boosts (user_id, multiplier, expires_at, updated_at)
    VALUES (_me, _mult, _new_expiry, _now)
    ON CONFLICT (user_id) DO UPDATE
    SET multiplier = EXCLUDED.multiplier,
        expires_at = EXCLUDED.expires_at,
        updated_at = _now;
  END IF;

  RETURN _new_expiry;
END;
$$;

CREATE OR REPLACE FUNCTION public.open_pack(_pack_id uuid)
 RETURNS TABLE(avatar_item_id uuid, name text, emoji text, rarity text, accent_hsl text, is_new boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Active luck multiplier (if any)
  SELECT multiplier INTO _mult
    FROM public.user_luck_boosts
    WHERE user_id = _me AND expires_at > now();
  _mult := COALESCE(_mult, 1);

  -- Compute rarity probabilities, capped, with common as remainder.
  _p_leg  := LEAST(0.03 * _mult, 0.5);
  _p_epic := LEAST(0.12 * _mult, 0.7 - _p_leg);
  _p_rare := LEAST(0.25 * _mult, 0.9 - _p_leg - _p_epic);

  -- Cumulative thresholds: common | rare | epic | legendary
  _t_rare := 1 - _p_rare - _p_epic - _p_leg; -- common upper bound
  _t_epic := _t_rare + _p_rare;              -- rare upper bound
  _t_leg  := _t_epic + _p_epic;              -- epic upper bound (legendary fills the rest)

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
$function$;
