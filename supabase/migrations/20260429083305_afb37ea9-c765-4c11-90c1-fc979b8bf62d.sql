
-- 1. Avatar catalog
CREATE TABLE public.avatar_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  theme TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common','rare','epic','legendary')),
  emoji TEXT NOT NULL,
  accent_hsl TEXT NOT NULL DEFAULT '180 80% 50%',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.avatar_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Avatar items viewable by authenticated"
  ON public.avatar_items FOR SELECT TO authenticated USING (true);

-- 2. User-owned avatars (with quantity for duplicates)
CREATE TABLE public.user_avatars (
  user_id UUID NOT NULL,
  avatar_item_id UUID NOT NULL REFERENCES public.avatar_items(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, avatar_item_id)
);
ALTER TABLE public.user_avatars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view own inventory"
  ON public.user_avatars FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
-- Inventory mutations only happen via RPCs (security definer); no direct insert/update/delete policies.

-- 3. Profiles: switch equipped reference to avatar item
ALTER TABLE public.profiles DROP COLUMN IF EXISTS equipped_pack_id;
ALTER TABLE public.profiles ADD COLUMN equipped_avatar_id UUID REFERENCES public.avatar_items(id) ON DELETE SET NULL;

-- 4. Trade offers
CREATE TABLE public.trade_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL,
  from_user UUID NOT NULL,
  to_user UUID NOT NULL,
  offered_avatar_id UUID REFERENCES public.avatar_items(id) ON DELETE SET NULL,
  offered_credits INT NOT NULL DEFAULT 0 CHECK (offered_credits >= 0),
  requested_avatar_id UUID REFERENCES public.avatar_items(id) ON DELETE SET NULL,
  requested_credits INT NOT NULL DEFAULT 0 CHECK (requested_credits >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trade_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat members view chat trades"
  ON public.trade_offers FOR SELECT TO authenticated
  USING (public.is_chat_member(chat_id, auth.uid()));

CREATE TRIGGER trade_offers_updated_at
  BEFORE UPDATE ON public.trade_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Repurpose profile_packs into booster packs (one per theme, 150 credits)
DELETE FROM public.user_packs;
DELETE FROM public.profile_packs;

INSERT INTO public.profile_packs (slug, name, theme, rarity, price, accent_hsl, emoji) VALUES
  ('booster-robot',      'Robot Booster Pack',      'robot',      'common', 150, '200 90% 55%', '🤖'),
  ('booster-animal',     'Animal Booster Pack',     'animal',     'common', 150, '120 70% 50%', '🦊'),
  ('booster-circus',     'Circus Booster Pack',     'circus',     'common', 150, '320 80% 60%', '🎪'),
  ('booster-underwater', 'Underwater Booster Pack', 'underwater', 'common', 150, '195 90% 55%', '🌊');

-- 6. Seed avatar_items catalog (theme + rarity + emoji)
INSERT INTO public.avatar_items (slug, name, theme, rarity, emoji, accent_hsl) VALUES
  -- Robot
  ('robot-bolt',     'Bolt',     'robot', 'common',    '🤖', '200 80% 55%'),
  ('robot-cog',      'Cog',      'robot', 'common',    '⚙️', '210 70% 55%'),
  ('robot-spark',    'Spark',    'robot', 'common',    '🔋', '210 75% 55%'),
  ('robot-circuit',  'Circuit',  'robot', 'rare',      '🔌', '195 85% 60%'),
  ('robot-drone',    'Drone',    'robot', 'rare',      '🛸', '220 85% 60%'),
  ('robot-mech',     'Mech',     'robot', 'epic',      '🦾', '215 90% 65%'),
  ('robot-ai-core',  'AI Core',  'robot', 'epic',      '🧠', '270 80% 65%'),
  ('robot-titan',    'Titan',    'robot', 'legendary', '👾', '280 90% 70%'),
  -- Animal
  ('animal-fox',     'Fox',      'animal', 'common',    '🦊', '25 90% 55%'),
  ('animal-cat',     'Cat',      'animal', 'common',    '🐱', '40 80% 55%'),
  ('animal-dog',     'Dog',      'animal', 'common',    '🐶', '30 75% 55%'),
  ('animal-panda',   'Panda',    'animal', 'rare',      '🐼', '0 0% 80%'),
  ('animal-tiger',   'Tiger',    'animal', 'rare',      '🐯', '20 95% 55%'),
  ('animal-eagle',   'Eagle',    'animal', 'epic',      '🦅', '35 80% 50%'),
  ('animal-wolf',    'Wolf',     'animal', 'epic',      '🐺', '220 20% 55%'),
  ('animal-dragon',  'Dragon',   'animal', 'legendary', '🐲', '140 80% 50%'),
  -- Circus
  ('circus-clown',   'Clown',    'circus', 'common',    '🤡', '320 80% 60%'),
  ('circus-balloon', 'Balloon',  'circus', 'common',    '🎈', '0 80% 60%'),
  ('circus-popcorn', 'Popcorn',  'circus', 'common',    '🍿', '50 90% 60%'),
  ('circus-juggler', 'Juggler',  'circus', 'rare',      '🤹', '290 75% 60%'),
  ('circus-tent',    'Big Top',  'circus', 'rare',      '🎪', '340 80% 60%'),
  ('circus-magic',   'Magician', 'circus', 'epic',      '🎩', '270 70% 50%'),
  ('circus-fire',    'Fire-Eater','circus','epic',      '🔥', '15 95% 55%'),
  ('circus-acrobat', 'Star Acrobat','circus','legendary','⭐', '50 100% 60%'),
  -- Underwater
  ('water-fish',     'Fish',     'underwater', 'common',    '🐟', '195 80% 55%'),
  ('water-shell',    'Shell',    'underwater', 'common',    '🐚', '20 60% 70%'),
  ('water-jelly',    'Jellyfish','underwater', 'common',    '🪼', '290 70% 65%'),
  ('water-octopus',  'Octopus',  'underwater', 'rare',      '🐙', '320 70% 60%'),
  ('water-turtle',   'Turtle',   'underwater', 'rare',      '🐢', '140 60% 45%'),
  ('water-shark',    'Shark',    'underwater', 'epic',      '🦈', '210 30% 50%'),
  ('water-whale',    'Whale',    'underwater', 'epic',      '🐳', '220 70% 55%'),
  ('water-kraken',   'Kraken',   'underwater', 'legendary', '🐉', '260 80% 50%');

-- 7. Open a pack: spend credits, roll 5 random avatars
CREATE OR REPLACE FUNCTION public.open_pack(_pack_id UUID)
RETURNS TABLE(avatar_item_id UUID, name TEXT, emoji TEXT, rarity TEXT, accent_hsl TEXT, is_new BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
    -- 60% common, 25% rare, 12% epic, 3% legendary
    _rarity := CASE
      WHEN _roll < 0.60 THEN 'common'
      WHEN _roll < 0.85 THEN 'rare'
      WHEN _roll < 0.97 THEN 'epic'
      ELSE 'legendary'
    END;

    SELECT * INTO _picked
      FROM public.avatar_items
      WHERE theme = _pack.theme AND rarity = _rarity
      ORDER BY random() LIMIT 1;

    IF _picked IS NULL THEN
      -- Fallback: pick any from theme
      SELECT * INTO _picked
        FROM public.avatar_items
        WHERE theme = _pack.theme
        ORDER BY random() LIMIT 1;
    END IF;

    _was_new := NOT EXISTS (SELECT 1 FROM public.user_avatars WHERE user_id = _me AND avatar_item_id = _picked.id);

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
$$;

-- 8. Sell one duplicate of an avatar
CREATE OR REPLACE FUNCTION public.sell_avatar(_avatar_item_id UUID)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
  _payout := CASE _rarity
    WHEN 'common' THEN 15
    WHEN 'rare' THEN 50
    WHEN 'epic' THEN 200
    WHEN 'legendary' THEN 750
    ELSE 10
  END;

  IF _row.quantity = 1 THEN
    -- If equipped and selling last copy, unequip
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
$$;

-- 9. Equip / unequip
CREATE OR REPLACE FUNCTION public.equip_avatar(_avatar_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me UUID := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _avatar_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_avatars WHERE user_id = _me AND avatar_item_id = _avatar_item_id
  ) THEN
    RAISE EXCEPTION 'You do not own this avatar';
  END IF;
  UPDATE public.profiles SET equipped_avatar_id = _avatar_item_id, updated_at = now() WHERE id = _me;
END;
$$;

CREATE OR REPLACE FUNCTION public.unequip_avatar()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.profiles SET equipped_avatar_id = NULL, updated_at = now() WHERE id = auth.uid();
END;
$$;

-- 10. Trade offers
CREATE OR REPLACE FUNCTION public.create_trade_offer(
  _chat_id UUID,
  _to_user UUID,
  _offered_avatar UUID,
  _offered_credits INT,
  _requested_avatar UUID,
  _requested_credits INT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.accept_trade_offer(_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me UUID := auth.uid();
  _t RECORD;
  _from_bal INT;
  _to_bal INT;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _t FROM public.trade_offers WHERE id = _id FOR UPDATE;
  IF _t IS NULL THEN RAISE EXCEPTION 'Trade not found'; END IF;
  IF _t.to_user <> _me THEN RAISE EXCEPTION 'Only the recipient can accept'; END IF;
  IF _t.status <> 'pending' THEN RAISE EXCEPTION 'Trade is not pending'; END IF;

  -- Validate both sides still have what they staked
  IF _t.offered_avatar_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_avatars WHERE user_id = _t.from_user AND avatar_item_id = _t.offered_avatar_id
  ) THEN
    UPDATE public.trade_offers SET status = 'cancelled' WHERE id = _id;
    RAISE EXCEPTION 'Sender no longer owns offered avatar';
  END IF;
  IF _t.requested_avatar_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_avatars WHERE user_id = _me AND avatar_item_id = _t.requested_avatar_id
  ) THEN
    RAISE EXCEPTION 'You do not own the requested avatar';
  END IF;
  IF _t.offered_credits > 0 THEN
    SELECT balance INTO _from_bal FROM public.user_credits WHERE user_id = _t.from_user FOR UPDATE;
    IF COALESCE(_from_bal,0) < _t.offered_credits THEN
      UPDATE public.trade_offers SET status = 'cancelled' WHERE id = _id;
      RAISE EXCEPTION 'Sender no longer has enough credits';
    END IF;
  END IF;
  IF _t.requested_credits > 0 THEN
    SELECT balance INTO _to_bal FROM public.user_credits WHERE user_id = _me FOR UPDATE;
    IF COALESCE(_to_bal,0) < _t.requested_credits THEN RAISE EXCEPTION 'You do not have enough credits'; END IF;
  END IF;

  -- Move offered avatar from sender -> recipient
  IF _t.offered_avatar_id IS NOT NULL THEN
    UPDATE public.user_avatars SET quantity = quantity - 1
      WHERE user_id = _t.from_user AND avatar_item_id = _t.offered_avatar_id;
    DELETE FROM public.user_avatars WHERE user_id = _t.from_user AND avatar_item_id = _t.offered_avatar_id AND quantity <= 0;
    INSERT INTO public.user_avatars (user_id, avatar_item_id, quantity)
      VALUES (_me, _t.offered_avatar_id, 1)
      ON CONFLICT (user_id, avatar_item_id) DO UPDATE SET quantity = public.user_avatars.quantity + 1;
    -- If sender had it equipped and no longer owns, unequip
    UPDATE public.profiles SET equipped_avatar_id = NULL
      WHERE id = _t.from_user AND equipped_avatar_id = _t.offered_avatar_id
        AND NOT EXISTS (SELECT 1 FROM public.user_avatars WHERE user_id = _t.from_user AND avatar_item_id = _t.offered_avatar_id);
  END IF;

  -- Move requested avatar from recipient -> sender
  IF _t.requested_avatar_id IS NOT NULL THEN
    UPDATE public.user_avatars SET quantity = quantity - 1
      WHERE user_id = _me AND avatar_item_id = _t.requested_avatar_id;
    DELETE FROM public.user_avatars WHERE user_id = _me AND avatar_item_id = _t.requested_avatar_id AND quantity <= 0;
    INSERT INTO public.user_avatars (user_id, avatar_item_id, quantity)
      VALUES (_t.from_user, _t.requested_avatar_id, 1)
      ON CONFLICT (user_id, avatar_item_id) DO UPDATE SET quantity = public.user_avatars.quantity + 1;
    UPDATE public.profiles SET equipped_avatar_id = NULL
      WHERE id = _me AND equipped_avatar_id = _t.requested_avatar_id
        AND NOT EXISTS (SELECT 1 FROM public.user_avatars WHERE user_id = _me AND avatar_item_id = _t.requested_avatar_id);
  END IF;

  -- Move credits
  IF _t.offered_credits > 0 THEN
    UPDATE public.user_credits SET balance = balance - _t.offered_credits, updated_at = now() WHERE user_id = _t.from_user;
    INSERT INTO public.user_credits (user_id, balance) VALUES (_me, _t.offered_credits)
      ON CONFLICT (user_id) DO UPDATE SET balance = public.user_credits.balance + _t.offered_credits, updated_at = now();
  END IF;
  IF _t.requested_credits > 0 THEN
    UPDATE public.user_credits SET balance = balance - _t.requested_credits, updated_at = now() WHERE user_id = _me;
    INSERT INTO public.user_credits (user_id, balance) VALUES (_t.from_user, _t.requested_credits)
      ON CONFLICT (user_id) DO UPDATE SET balance = public.user_credits.balance + _t.requested_credits, updated_at = now();
  END IF;

  UPDATE public.trade_offers SET status = 'accepted' WHERE id = _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_trade_offer(_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.trade_offers SET status = 'declined'
    WHERE id = _id AND to_user = auth.uid() AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_trade_offer(_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.trade_offers SET status = 'cancelled'
    WHERE id = _id AND from_user = auth.uid() AND status = 'pending';
END;
$$;
