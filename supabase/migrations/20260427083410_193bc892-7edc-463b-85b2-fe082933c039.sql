
-- Profiles: equipped pack
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipped_pack_id uuid;

-- Profile packs catalog
CREATE TABLE IF NOT EXISTS public.profile_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  theme text NOT NULL, -- robot | animal | circus | underwater
  rarity text NOT NULL CHECK (rarity IN ('common','rare','epic','legendary')),
  price int NOT NULL DEFAULT 0,
  accent_hsl text NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Packs viewable by all authenticated" ON public.profile_packs FOR SELECT TO authenticated USING (true);

-- User-owned packs
CREATE TABLE IF NOT EXISTS public.user_packs (
  user_id uuid NOT NULL,
  pack_id uuid NOT NULL REFERENCES public.profile_packs(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pack_id)
);
ALTER TABLE public.user_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User packs viewable by authenticated" ON public.user_packs FOR SELECT TO authenticated USING (true);

-- Credits
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id uuid PRIMARY KEY,
  balance int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Credits viewable by authenticated" ON public.user_credits FOR SELECT TO authenticated USING (true);

-- Daily claims
CREATE TABLE IF NOT EXISTS public.daily_claims (
  user_id uuid PRIMARY KEY,
  last_claim_date date NOT NULL
);
ALTER TABLE public.daily_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own daily claim viewable" ON public.daily_claims FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Friendships
CREATE TYPE friend_status AS ENUM ('pending','accepted');
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  addressee_id uuid NOT NULL,
  status friend_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own friendships" ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Update handle_new_user to also seed credits
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _username TEXT;
BEGIN
  _username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (NEW.id, _username, NEW.raw_user_meta_data->>'avatar_url');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  IF lower(_username) = 'chris' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.user_credits (user_id, balance) VALUES (NEW.id, 100)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Ensure the auth trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed credits for existing users
INSERT INTO public.user_credits (user_id, balance)
SELECT id, 100 FROM auth.users
ON CONFLICT DO NOTHING;

-- Daily claim
CREATE OR REPLACE FUNCTION public.claim_daily_credits()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _last date;
  _reward int := 50;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT last_claim_date INTO _last FROM public.daily_claims WHERE user_id = _me;
  IF _last = _today THEN RAISE EXCEPTION 'Already claimed today'; END IF;

  INSERT INTO public.daily_claims (user_id, last_claim_date) VALUES (_me, _today)
  ON CONFLICT (user_id) DO UPDATE SET last_claim_date = _today;

  INSERT INTO public.user_credits (user_id, balance) VALUES (_me, _reward)
  ON CONFLICT (user_id) DO UPDATE SET balance = public.user_credits.balance + _reward, updated_at = now();

  RETURN _reward;
END;
$$;

-- Purchase pack
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
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT price INTO _price FROM public.profile_packs WHERE id = _pack_id;
  IF _price IS NULL THEN RAISE EXCEPTION 'Pack not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.user_packs WHERE user_id = _me AND pack_id = _pack_id) THEN
    RAISE EXCEPTION 'Already owned';
  END IF;

  SELECT balance INTO _bal FROM public.user_credits WHERE user_id = _me FOR UPDATE;
  IF COALESCE(_bal,0) < _price THEN RAISE EXCEPTION 'Insufficient credits'; END IF;

  UPDATE public.user_credits SET balance = balance - _price, updated_at = now() WHERE user_id = _me;
  INSERT INTO public.user_packs (user_id, pack_id) VALUES (_me, _pack_id);
END;
$$;

-- Friends
CREATE OR REPLACE FUNCTION public.send_friend_request(_username text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _target uuid;
  _id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO _target FROM public.profiles WHERE lower(username) = lower(_username);
  IF _target IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  IF _target = _me THEN RAISE EXCEPTION 'Cannot friend yourself'; END IF;

  -- If reverse pending exists, accept it
  UPDATE public.friendships SET status = 'accepted', updated_at = now()
  WHERE requester_id = _target AND addressee_id = _me AND status = 'pending'
  RETURNING id INTO _id;
  IF _id IS NOT NULL THEN RETURN _id; END IF;

  INSERT INTO public.friendships (requester_id, addressee_id)
  VALUES (_me, _target)
  ON CONFLICT (requester_id, addressee_id) DO UPDATE SET updated_at = now()
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(_id uuid, _accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _accept THEN
    UPDATE public.friendships SET status = 'accepted', updated_at = now()
    WHERE id = _id AND addressee_id = _me AND status = 'pending';
  ELSE
    DELETE FROM public.friendships WHERE id = _id AND (addressee_id = _me OR requester_id = _me);
  END IF;
END;
$$;

-- Seed packs
INSERT INTO public.profile_packs (slug, name, theme, rarity, price, accent_hsl, emoji) VALUES
  ('robot-scout','Scout Bot','robot','common',150,'210 90% 60%','🤖'),
  ('robot-titan','Titan Mech','robot','epic',800,'215 95% 55%','🦾'),
  ('animal-fox','Sly Fox','animal','common',150,'25 90% 55%','🦊'),
  ('animal-tiger','Cyber Tiger','animal','rare',400,'35 95% 55%','🐯'),
  ('circus-clown','Funny Clown','circus','common',150,'330 85% 60%','🤡'),
  ('circus-magician','Grand Magician','circus','epic',800,'280 75% 55%','🎩'),
  ('underwater-fish','Reef Fish','underwater','common',150,'190 85% 55%','🐠'),
  ('underwater-kraken','Deep Kraken','underwater','legendary',1500,'200 95% 50%','🐙')
ON CONFLICT (slug) DO NOTHING;
