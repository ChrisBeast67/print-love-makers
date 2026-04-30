
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

    _picked_id := _picked.id;

    _was_new := NOT EXISTS (
      SELECT 1 FROM public.user_avatars ua
      WHERE ua.user_id = _me AND ua.avatar_item_id = _picked_id
    );

    -- Update existing row first; insert if missing. Avoids ON CONFLICT name clash.
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

-- Staff-only: wipe a user's app data. Auth row deletion is handled by the edge function.
CREATE OR REPLACE FUNCTION public.admin_delete_user_data(_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _target = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;
  IF public.has_role(_target, 'owner') AND NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Only owners can delete other owners';
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

REVOKE ALL ON FUNCTION public.admin_delete_user_data(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_data(uuid) TO authenticated;
