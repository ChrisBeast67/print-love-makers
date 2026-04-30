
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
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _pack FROM public.profile_packs WHERE id = _pack_id;
  IF _pack IS NULL THEN RAISE EXCEPTION 'Pack not found'; END IF;

  SELECT balance INTO _bal FROM public.user_credits WHERE user_id = _me FOR UPDATE;
  IF COALESCE(_bal, 0) < _pack.price THEN RAISE EXCEPTION 'Insufficient credits'; END IF;

  UPDATE public.user_credits
    SET balance = balance - _pack.price, updated_at = now()
    WHERE user_id = _me;

  FOR _i IN 1..5 LOOP
    _roll := random();
    _rarity := CASE
      WHEN _roll < 0.60 THEN 'common'
      WHEN _roll < 0.85 THEN 'rare'
      WHEN _roll < 0.97 THEN 'epic'
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

    _was_new := NOT EXISTS (
      SELECT 1 FROM public.user_avatars ua
      WHERE ua.user_id = _me AND ua.avatar_item_id = _picked.id
    );

    INSERT INTO public.user_avatars (user_id, avatar_item_id, quantity)
    VALUES (_me, _picked.id, 1)
    ON CONFLICT (user_id, avatar_item_id)
      DO UPDATE SET quantity = public.user_avatars.quantity + 1;

    avatar_item_id := _picked.id;
    name := _picked.name;
    emoji := _picked.emoji;
    rarity := _picked.rarity;
    accent_hsl := _picked.accent_hsl;
    is_new := _was_new;
    RETURN NEXT;
  END LOOP;
END;
$function$;
