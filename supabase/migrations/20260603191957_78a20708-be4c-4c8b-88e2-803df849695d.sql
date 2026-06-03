
CREATE OR REPLACE FUNCTION public.sell_avatar(_avatar_item_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _me UUID := auth.uid();
  _row RECORD;
  _rarity TEXT;
  _payout INT;
  _equipped UUID;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _row FROM public.user_avatars WHERE user_id = _me AND avatar_item_id = _avatar_item_id FOR UPDATE;
  IF _row IS NULL OR _row.quantity < 1 THEN RAISE EXCEPTION 'You do not own this avatar'; END IF;

  SELECT rarity INTO _rarity FROM public.avatar_items WHERE id = _avatar_item_id;
  IF _rarity = 'secret' THEN RAISE EXCEPTION 'This exclusive avatar cannot be sold'; END IF;

  _payout := CASE _rarity
    WHEN 'common' THEN 15
    WHEN 'rare' THEN 50
    WHEN 'epic' THEN 200
    WHEN 'legendary' THEN 750
    WHEN 'mythic' THEN 3000
    ELSE 10
  END;

  IF _row.quantity = 1 THEN
    SELECT equipped_avatar_id INTO _equipped FROM public.profiles WHERE id = _me;
    IF _equipped = _avatar_item_id THEN
      UPDATE public.profiles SET equipped_avatar_id = NULL WHERE id = _me;
    END IF;
    DELETE FROM public.user_avatars WHERE user_id = _me AND avatar_item_id = _avatar_item_id;
  ELSE
    UPDATE public.user_avatars SET quantity = quantity - 1 WHERE user_id = _me AND avatar_item_id = _avatar_item_id;
  END IF;

  INSERT INTO public.user_credits (user_id, balance) VALUES (_me, _payout)
    ON CONFLICT (user_id) DO UPDATE
    SET balance = public.user_credits.balance + _payout, updated_at = now();

  RETURN _payout;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_trade_offer(_chat_id uuid, _to_user uuid, _offered_avatar uuid, _offered_credits integer, _requested_avatar uuid, _requested_credits integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _me UUID := auth.uid();
  _id UUID;
  _bal INT;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _me = _to_user THEN RAISE EXCEPTION 'Cannot trade with yourself'; END IF;
  IF NOT public.is_chat_member(_chat_id, _me) OR NOT public.is_chat_member(_chat_id, _to_user) THEN
    RAISE EXCEPTION 'Both parties must be in the chat';
  END IF;
  IF COALESCE(_offered_credits,0) < 0 OR COALESCE(_requested_credits,0) < 0 THEN
    RAISE EXCEPTION 'Credit amounts must be non-negative';
  END IF;
  IF _offered_avatar IS NULL AND COALESCE(_offered_credits,0) = 0 THEN
    RAISE EXCEPTION 'Offer must include an avatar or credits';
  END IF;
  IF _requested_avatar IS NULL AND COALESCE(_requested_credits,0) = 0 THEN
    RAISE EXCEPTION 'Request must include an avatar or credits';
  END IF;

  IF EXISTS (SELECT 1 FROM public.avatar_items WHERE id IN (_offered_avatar, _requested_avatar) AND rarity = 'secret') THEN
    RAISE EXCEPTION 'Exclusive avatars cannot be traded';
  END IF;

  IF _offered_avatar IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_avatars WHERE user_id = _me AND avatar_item_id = _offered_avatar
  ) THEN
    RAISE EXCEPTION 'You do not own the offered avatar';
  END IF;

  IF COALESCE(_offered_credits,0) > 0 THEN
    SELECT balance INTO _bal FROM public.user_credits WHERE user_id = _me;
    IF COALESCE(_bal,0) < _offered_credits THEN RAISE EXCEPTION 'Not enough credits to offer'; END IF;
  END IF;

  INSERT INTO public.trade_offers (chat_id, from_user, to_user, offered_avatar_id, offered_credits, requested_avatar_id, requested_credits)
  VALUES (_chat_id, _me, _to_user, _offered_avatar, COALESCE(_offered_credits,0), _requested_avatar, COALESCE(_requested_credits,0))
  RETURNING id INTO _id;
  RETURN _id;
END;
$function$;
