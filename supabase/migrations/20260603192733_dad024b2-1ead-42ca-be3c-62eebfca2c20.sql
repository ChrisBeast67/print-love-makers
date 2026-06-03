CREATE OR REPLACE FUNCTION public.open_pack(_pack_id uuid)
 RETURNS TABLE(avatar_item_id uuid, name text, emoji text, rarity text, accent_hsl text, is_new boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
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
  _event_mult NUMERIC;
  _p_mythic NUMERIC := 0.01;
  _p_leg NUMERIC;
  _p_epic NUMERIC;
  _p_rare NUMERIC;
  _remaining NUMERIC;
  _t_rare NUMERIC;
  _t_epic NUMERIC;
  _t_leg NUMERIC;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _pack FROM public.profile_packs WHERE id = _pack_id;
  IF _pack IS NULL THEN RAISE EXCEPTION 'Pack not found'; END IF;

  SELECT balance INTO _bal FROM public.user_credits WHERE user_id = _me FOR UPDATE;
  IF COALESCE(_bal, 0) < _pack.price THEN RAISE EXCEPTION 'Insufficient credits'; END IF;

  UPDATE public.user_credits SET balance = balance - _pack.price, updated_at = now() WHERE user_id = _me;

  -- Award EXP equal to credits spent
  PERFORM public.earn_exp(_me, _pack.price::bigint);

  -- Personal luck boost
  SELECT multiplier INTO _mult FROM public.user_luck_boosts WHERE user_id = _me AND expires_at > now();
  _mult := COALESCE(_mult, 1);

  -- Global event luck
  SELECT COALESCE(MAX(luck_multiplier), 1) INTO _event_mult FROM public.events WHERE active = true AND luck_multiplier > 1;
  _mult := GREATEST(_mult, _event_mult);

  -- Mythic is flat 1%, unaffected by luck
  _remaining := 1.0 - _p_mythic;
  _p_leg  := LEAST(0.01 * _mult, 0.5) * _remaining;
  _p_epic := LEAST(0.12 * _mult, 0.7 - _p_leg) * _remaining;
  _p_rare := LEAST(0.25 * _mult, 0.9 - _p_leg - _p_epic) * _remaining;

  FOR _i IN 1..5 LOOP
    _roll := random();

    -- Mythic check first (flat 1%)
    IF _roll < _p_mythic THEN
      _rarity := 'mythic';
    ELSE
      _roll := (_roll - _p_mythic) / _remaining;
      _t_rare := 1 - (_p_rare/_remaining) - (_p_epic/_remaining) - (_p_leg/_remaining);
      _t_epic := _t_rare + (_p_rare/_remaining);
      _t_leg  := _t_epic + (_p_epic/_remaining);
      _rarity := CASE
        WHEN _roll < _t_rare THEN 'common'
        WHEN _roll < _t_epic THEN 'rare'
        WHEN _roll < _t_leg  THEN 'epic'
        ELSE 'legendary'
      END;
    END IF;

    SELECT ai.* INTO _picked FROM public.avatar_items ai
      WHERE ai.theme = _pack.theme AND ai.rarity = _rarity ORDER BY random() LIMIT 1;

    IF _picked IS NULL THEN
      SELECT ai.* INTO _picked FROM public.avatar_items ai
        WHERE ai.theme = _pack.theme ORDER BY random() LIMIT 1;
    END IF;

    _picked_id := _picked.id;
    _was_new := NOT EXISTS (SELECT 1 FROM public.user_avatars ua WHERE ua.user_id = _me AND ua.avatar_item_id = _picked_id);

    UPDATE public.user_avatars ua SET quantity = ua.quantity + 1 WHERE ua.user_id = _me AND ua.avatar_item_id = _picked_id;
    GET DIAGNOSTICS _updated = ROW_COUNT;
    IF _updated = 0 THEN
      INSERT INTO public.user_avatars (user_id, avatar_item_id, quantity) VALUES (_me, _picked_id, 1);
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
$function$