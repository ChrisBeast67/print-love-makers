-- 1) Purchase log ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text,
  item_type text NOT NULL,
  item_name text NOT NULL,
  amount integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'credits',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.purchase_log TO authenticated;
GRANT ALL ON public.purchase_log TO service_role;

ALTER TABLE public.purchase_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view purchase log" ON public.purchase_log;
CREATE POLICY "Staff can view purchase log"
  ON public.purchase_log FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS purchase_log_created_idx ON public.purchase_log (created_at DESC);

CREATE OR REPLACE FUNCTION public.record_purchase(_user uuid, _type text, _name text, _amount integer, _currency text DEFAULT 'credits')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.purchase_log (user_id, username, item_type, item_name, amount, currency)
  VALUES (_user, (SELECT username FROM public.profiles WHERE id = _user), _type, _name, _amount, _currency);
END;
$$;
REVOKE ALL ON FUNCTION public.record_purchase(uuid, text, text, integer, text) FROM PUBLIC, anon, authenticated;

-- 2) Moderation requests ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL,
  requester_username text,
  target_id uuid NOT NULL,
  target_username text,
  action text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.moderation_requests TO authenticated;
GRANT ALL ON public.moderation_requests TO service_role;

ALTER TABLE public.moderation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view moderation requests" ON public.moderation_requests;
CREATE POLICY "Staff can view moderation requests"
  ON public.moderation_requests FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.request_moderation_action(_target uuid, _action text, _reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _id uuid;
BEGIN
  IF NOT public.is_staff(_me) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _action NOT IN ('ban', 'delete') THEN RAISE EXCEPTION 'Invalid action'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN RAISE EXCEPTION 'A reason of at least 5 characters is required'; END IF;
  IF _target = _me THEN RAISE EXCEPTION 'Cannot target yourself'; END IF;
  IF public.has_role(_target, 'owner'::app_role) THEN RAISE EXCEPTION 'Owners cannot be banned or deleted'; END IF;
  IF EXISTS (SELECT 1 FROM public.moderation_requests
             WHERE target_id = _target AND action = _action AND status = 'pending') THEN
    RAISE EXCEPTION 'A request for this user is already pending';
  END IF;

  INSERT INTO public.moderation_requests (requested_by, requester_username, target_id, target_username, action, reason)
  VALUES (
    _me,
    (SELECT username FROM public.profiles WHERE id = _me),
    _target,
    (SELECT username FROM public.profiles WHERE id = _target),
    _action,
    btrim(_reason)
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.request_moderation_action(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_moderation_action(uuid, text, text) TO authenticated;

-- Owner decides. Approving a ban executes it immediately; approving a delete
-- marks the request approved so the owner's panel can finish the wipe.
CREATE OR REPLACE FUNCTION public.decide_moderation_request(_id uuid, _approve boolean)
RETURNS TABLE(action text, target_id uuid, target_username text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _req public.moderation_requests%ROWTYPE;
BEGIN
  IF NOT public.has_role(_me, 'owner'::app_role) THEN RAISE EXCEPTION 'Only the owner can decide moderation requests'; END IF;

  SELECT * INTO _req FROM public.moderation_requests WHERE id = _id FOR UPDATE;
  IF _req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'Request already decided'; END IF;

  UPDATE public.moderation_requests
  SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
      decided_by = _me,
      decided_at = now()
  WHERE id = _id;

  IF _approve AND _req.action = 'ban' THEN
    INSERT INTO public.banned_users (user_id, banned_by, reason)
    VALUES (_req.target_id, _me, _req.reason)
    ON CONFLICT (user_id) DO UPDATE
      SET banned_by = _me, reason = EXCLUDED.reason, banned_at = now();
  END IF;

  PERFORM public.log_admin_action(
    _me,
    CASE WHEN _approve THEN 'Approved ' || _req.action || ' request' ELSE 'Rejected ' || _req.action || ' request' END,
    _req.target_id,
    jsonb_build_object('reason', _req.reason, 'requested_by', _req.requester_username)
  );

  RETURN QUERY SELECT _req.action, _req.target_id, _req.target_username;
END;
$$;
REVOKE ALL ON FUNCTION public.decide_moderation_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_moderation_request(uuid, boolean) TO authenticated;

-- 3) Ban / delete now require a reason and owner approval for non-owners ------
CREATE OR REPLACE FUNCTION public.admin_ban_user(_target uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN RAISE EXCEPTION 'A reason of at least 5 characters is required'; END IF;
  IF NOT public.has_role(auth.uid(), 'owner'::app_role) THEN
    RAISE EXCEPTION 'Only the owner can ban directly. Submit a request for owner approval.';
  END IF;
  IF _target = auth.uid() THEN RAISE EXCEPTION 'Cannot ban yourself'; END IF;
  IF public.has_role(_target, 'owner'::app_role) THEN RAISE EXCEPTION 'Owners cannot be banned'; END IF;

  INSERT INTO public.banned_users (user_id, banned_by, reason)
  VALUES (_target, auth.uid(), btrim(_reason))
  ON CONFLICT (user_id) DO UPDATE SET banned_by = auth.uid(), reason = EXCLUDED.reason, banned_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user_data(_target uuid, _caller uuid DEFAULT auth.uid())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(_caller) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _target = _caller THEN RAISE EXCEPTION 'Cannot delete your own account'; END IF;
  IF public.has_role(_target, 'owner'::app_role) THEN RAISE EXCEPTION 'Owners cannot be deleted'; END IF;

  IF NOT public.has_role(_caller, 'owner'::app_role) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.moderation_requests
      WHERE target_id = _target AND action = 'delete' AND status = 'approved'
    ) THEN
      RAISE EXCEPTION 'Owner approval is required to delete an account';
    END IF;
  END IF;

  UPDATE public.moderation_requests
  SET status = 'completed'
  WHERE target_id = _target AND action = 'delete' AND status = 'approved';

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
  DELETE FROM public.user_warnings WHERE user_id = _target;
  DELETE FROM public.user_exp WHERE user_id = _target;
  DELETE FROM public.user_milestone_claims WHERE user_id = _target;
  DELETE FROM public.premium_orders WHERE user_id = _target;
  UPDATE public.profiles SET equipped_avatar_id = NULL WHERE equipped_avatar_id IS NOT NULL AND id = _target;
  DELETE FROM public.profiles WHERE id = _target;
END;
$$;

-- 4) Owner alerts for inappropriate language ----------------------------------
DROP POLICY IF EXISTS "Staff can view warnings" ON public.user_warnings;
CREATE POLICY "Staff can view warnings"
  ON public.user_warnings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR user_id = auth.uid());

ALTER TABLE public.user_warnings ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.user_warnings ADD COLUMN IF NOT EXISTS chat_id uuid;

CREATE OR REPLACE FUNCTION public.moderate_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count int;
BEGIN
  IF NOT public.contains_bad_word(NEW.content) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_warnings (user_id, reason, content, username, chat_id)
  VALUES (
    NEW.user_id,
    'Inappropriate language',
    NEW.content,
    (SELECT username FROM public.profiles WHERE id = NEW.user_id),
    NEW.chat_id
  );

  UPDATE public.messages
  SET content = '⚠️ This message was removed for inappropriate language.'
  WHERE id = NEW.id;

  SELECT count(*) INTO _count FROM public.user_warnings WHERE user_id = NEW.user_id;

  IF _count >= 3 THEN
    INSERT INTO public.banned_users (user_id, banned_by, reason, expires_at)
    VALUES (NEW.user_id, NEW.user_id, 'Auto-ban: 3 warnings for inappropriate language', now() + interval '7 days')
    ON CONFLICT (user_id) DO UPDATE
      SET banned_by = EXCLUDED.banned_by,
          reason = EXCLUDED.reason,
          expires_at = EXCLUDED.expires_at,
          banned_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- 5) Log purchases -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purchase_pack(_pack_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _price int;
  _bal int;
  _name text;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT price, name INTO _price, _name FROM public.profile_packs WHERE id = _pack_id;
  IF _price IS NULL THEN RAISE EXCEPTION 'Pack not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.user_packs WHERE user_id = _me AND pack_id = _pack_id) THEN
    RAISE EXCEPTION 'Already owned';
  END IF;

  SELECT balance INTO _bal FROM public.user_credits WHERE user_id = _me FOR UPDATE;
  IF COALESCE(_bal,0) < _price THEN RAISE EXCEPTION 'Insufficient credits'; END IF;

  UPDATE public.user_credits SET balance = balance - _price, updated_at = now() WHERE user_id = _me;
  INSERT INTO public.user_packs (user_id, pack_id) VALUES (_me, _pack_id);

  PERFORM public.record_purchase(_me, 'pack', _name, _price, 'credits');
END;
$$;

CREATE OR REPLACE FUNCTION public.buy_avatar(_avatar_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me UUID := auth.uid();
  _rarity TEXT;
  _name TEXT;
  _price INT;
  _balance INT;
  _is_new BOOLEAN;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT rarity, name INTO _rarity, _name FROM public.avatar_items WHERE id = _avatar_item_id;
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

  PERFORM public.record_purchase(_me, 'avatar', _name || ' (' || _rarity || ')', _price, 'credits');

  RETURN jsonb_build_object('price', _price, 'is_new', _is_new, 'rarity', _rarity);
END;
$$;

CREATE OR REPLACE FUNCTION public.buy_luck_boost(_tier integer)
RETURNS timestamp with time zone
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

  PERFORM public.record_purchase(_me, 'luck_boost', _mult || 'x luck (30 min)', _price, 'credits');

  RETURN _new_expiry;
END;
$$;

CREATE OR REPLACE FUNCTION public.buy_premium()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _bal int;
  _already boolean;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT is_premium INTO _already FROM public.user_exp WHERE user_id = _me;
  IF COALESCE(_already, false) THEN RAISE EXCEPTION 'Already premium'; END IF;

  SELECT balance INTO _bal FROM public.user_credits WHERE user_id = _me FOR UPDATE;
  IF COALESCE(_bal, 0) < 100000 THEN RAISE EXCEPTION 'Need 100,000 credits'; END IF;

  UPDATE public.user_credits SET balance = balance - 100000, updated_at = now() WHERE user_id = _me;

  INSERT INTO public.user_exp (user_id, is_premium, updated_at) VALUES (_me, true, now())
  ON CONFLICT (user_id) DO UPDATE SET is_premium = true, updated_at = now();

  UPDATE public.profiles SET is_premium = true, updated_at = now() WHERE id = _me;

  PERFORM public.record_purchase(_me, 'premium', 'Premium membership', 100000, 'credits');
END;
$$;
