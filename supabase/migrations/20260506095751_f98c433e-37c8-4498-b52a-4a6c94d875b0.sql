
-- User EXP tracking
CREATE TABLE public.user_exp (
  user_id uuid PRIMARY KEY,
  total_exp bigint NOT NULL DEFAULT 0,
  is_premium boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_exp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own exp viewable" ON public.user_exp FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- Milestones definition
CREATE TABLE public.exp_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level int NOT NULL,
  name text NOT NULL,
  exp_required bigint NOT NULL,
  reward_credits int NOT NULL DEFAULT 0,
  reward_avatar_id uuid REFERENCES public.avatar_items(id),
  is_premium boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exp_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Milestones viewable by authenticated" ON public.exp_milestones FOR SELECT TO authenticated
  USING (true);

-- Track claimed milestones
CREATE TABLE public.user_milestone_claims (
  user_id uuid NOT NULL,
  milestone_id uuid NOT NULL REFERENCES public.exp_milestones(id),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, milestone_id)
);
ALTER TABLE public.user_milestone_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own claims viewable" ON public.user_milestone_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Function: earn EXP (called internally when credits are spent)
CREATE OR REPLACE FUNCTION public.earn_exp(_user_id uuid, _amount bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_exp (user_id, total_exp, updated_at)
  VALUES (_user_id, GREATEST(_amount, 0), now())
  ON CONFLICT (user_id) DO UPDATE
  SET total_exp = public.user_exp.total_exp + GREATEST(_amount, 0),
      updated_at = now();
END;
$$;

-- Function: claim a milestone reward
CREATE OR REPLACE FUNCTION public.claim_milestone(_milestone_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _ms RECORD;
  _exp bigint;
  _is_prem boolean;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _ms FROM public.exp_milestones WHERE id = _milestone_id;
  IF _ms IS NULL THEN RAISE EXCEPTION 'Milestone not found'; END IF;

  -- Check if already claimed
  IF EXISTS (SELECT 1 FROM public.user_milestone_claims WHERE user_id = _me AND milestone_id = _milestone_id) THEN
    RAISE EXCEPTION 'Already claimed';
  END IF;

  -- Check EXP
  SELECT total_exp, is_premium INTO _exp, _is_prem FROM public.user_exp WHERE user_id = _me;
  _exp := COALESCE(_exp, 0);
  _is_prem := COALESCE(_is_prem, false);

  IF _exp < _ms.exp_required THEN RAISE EXCEPTION 'Not enough EXP'; END IF;
  IF _ms.is_premium AND NOT _is_prem THEN RAISE EXCEPTION 'Premium required'; END IF;

  -- Record claim
  INSERT INTO public.user_milestone_claims (user_id, milestone_id) VALUES (_me, _milestone_id);

  -- Grant credit reward
  IF _ms.reward_credits > 0 THEN
    INSERT INTO public.user_credits (user_id, balance) VALUES (_me, _ms.reward_credits)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.user_credits.balance + _ms.reward_credits, updated_at = now();
  END IF;

  -- Grant avatar reward
  IF _ms.reward_avatar_id IS NOT NULL THEN
    INSERT INTO public.user_avatars (user_id, avatar_item_id, quantity) VALUES (_me, _ms.reward_avatar_id, 1)
    ON CONFLICT (user_id, avatar_item_id) DO UPDATE SET quantity = public.user_avatars.quantity + 1;
  END IF;

  RETURN _ms.name;
END;
$$;

-- Function: buy premium for 100k credits
CREATE OR REPLACE FUNCTION public.buy_premium()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END;
$$;

-- Function: admin grant premium
CREATE OR REPLACE FUNCTION public.admin_grant_premium(_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO public.user_exp (user_id, is_premium, updated_at) VALUES (_target, true, now())
  ON CONFLICT (user_id) DO UPDATE SET is_premium = true, updated_at = now();
END;
$$;

-- Update open_pack to award EXP equal to pack price
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
  _p_leg  := LEAST(0.03 * _mult, 0.5) * _remaining;
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
$$;

-- Seed milestones (free tier)
INSERT INTO public.exp_milestones (level, name, exp_required, reward_credits, is_premium) VALUES
(1, 'Beginner', 100, 50, false),
(2, 'Explorer', 500, 100, false),
(3, 'Adventurer', 1500, 200, false),
(4, 'Veteran', 5000, 500, false),
(5, 'Champion', 10000, 1000, false),
(6, 'Legend', 25000, 2000, false),
(7, 'Mythic Rank', 50000, 5000, false),
(8, 'Transcendent', 100000, 10000, false);

-- Seed milestones (premium tier - better rewards)
INSERT INTO public.exp_milestones (level, name, exp_required, reward_credits, is_premium) VALUES
(1, 'Premium Starter', 100, 150, true),
(2, 'Premium Explorer', 500, 300, true),
(3, 'Premium Adventurer', 1500, 600, true),
(4, 'Premium Veteran', 5000, 1500, true),
(5, 'Premium Champion', 10000, 3000, true),
(6, 'Premium Legend', 25000, 6000, true),
(7, 'Premium Mythic', 50000, 15000, true),
(8, 'Premium Transcendent', 100000, 30000, true);
