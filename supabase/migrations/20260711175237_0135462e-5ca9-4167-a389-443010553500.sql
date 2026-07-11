-- Direct purchase of a specific avatar with in-app credits
CREATE OR REPLACE FUNCTION public.buy_avatar(_avatar_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _me UUID := auth.uid();
  _rarity TEXT;
  _price INT;
  _balance INT;
  _is_new BOOLEAN;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT rarity INTO _rarity FROM public.avatar_items WHERE id = _avatar_item_id;
  IF _rarity IS NULL THEN RAISE EXCEPTION 'Avatar not found'; END IF;
  IF _rarity IN ('secret') THEN RAISE EXCEPTION 'This exclusive avatar cannot be purchased'; END IF;

  _price := CASE _rarity
    WHEN 'common' THEN 60
    WHEN 'rare' THEN 250
    WHEN 'epic' THEN 1000
    WHEN 'legendary' THEN 4000
    WHEN 'mythic' THEN 15000
    ELSE 100
  END;

  SELECT balance INTO _balance FROM public.user_credits WHERE user_id = _me FOR UPDATE;
  IF _balance IS NULL THEN _balance := 0; END IF;
  IF _balance < _price THEN RAISE EXCEPTION 'Not enough credits'; END IF;

  UPDATE public.user_credits SET balance = balance - _price, updated_at = now() WHERE user_id = _me;

  _is_new := NOT EXISTS (SELECT 1 FROM public.user_avatars WHERE user_id = _me AND avatar_item_id = _avatar_item_id);

  INSERT INTO public.user_avatars (user_id, avatar_item_id, quantity)
    VALUES (_me, _avatar_item_id, 1)
    ON CONFLICT (user_id, avatar_item_id)
    DO UPDATE SET quantity = public.user_avatars.quantity + 1;

  RETURN jsonb_build_object('price', _price, 'is_new', _is_new, 'rarity', _rarity);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.buy_avatar(uuid) TO authenticated;