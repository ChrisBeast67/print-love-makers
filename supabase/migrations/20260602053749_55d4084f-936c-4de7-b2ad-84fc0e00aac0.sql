-- Add title and premium flags to profiles so they are visible to everyone (RLS-friendly)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;

-- Backfill premium status from user_exp
UPDATE public.profiles p
SET is_premium = COALESCE(e.is_premium, false)
FROM public.user_exp e
WHERE e.user_id = p.id;

-- Backfill title from the highest-level milestone each user has claimed
UPDATE public.profiles p
SET title = sub.name
FROM (
  SELECT c.user_id, m.name
  FROM public.user_milestone_claims c
  JOIN public.exp_milestones m ON m.id = c.milestone_id
  JOIN (
    SELECT c2.user_id, MAX(m2.level) AS max_level
    FROM public.user_milestone_claims c2
    JOIN public.exp_milestones m2 ON m2.id = c2.milestone_id
    GROUP BY c2.user_id
  ) top ON top.user_id = c.user_id AND top.max_level = m.level
) sub
WHERE sub.user_id = p.id;

-- Update claim_milestone to also set the user's title to their highest claimed milestone
CREATE OR REPLACE FUNCTION public.claim_milestone(_milestone_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _me uuid := auth.uid();
  _ms RECORD;
  _exp bigint;
  _is_prem boolean;
  _top_name text;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _ms FROM public.exp_milestones WHERE id = _milestone_id;
  IF _ms IS NULL THEN RAISE EXCEPTION 'Milestone not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.user_milestone_claims WHERE user_id = _me AND milestone_id = _milestone_id) THEN
    RAISE EXCEPTION 'Already claimed';
  END IF;

  SELECT total_exp, is_premium INTO _exp, _is_prem FROM public.user_exp WHERE user_id = _me;
  _exp := COALESCE(_exp, 0);
  _is_prem := COALESCE(_is_prem, false);

  IF _exp < _ms.exp_required THEN RAISE EXCEPTION 'Not enough EXP'; END IF;
  IF _ms.is_premium AND NOT _is_prem THEN RAISE EXCEPTION 'Premium required'; END IF;

  INSERT INTO public.user_milestone_claims (user_id, milestone_id) VALUES (_me, _milestone_id);

  IF _ms.reward_credits > 0 THEN
    INSERT INTO public.user_credits (user_id, balance) VALUES (_me, _ms.reward_credits)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.user_credits.balance + _ms.reward_credits, updated_at = now();
  END IF;

  IF _ms.reward_avatar_id IS NOT NULL THEN
    INSERT INTO public.user_avatars (user_id, avatar_item_id, quantity) VALUES (_me, _ms.reward_avatar_id, 1)
    ON CONFLICT (user_id, avatar_item_id) DO UPDATE SET quantity = public.user_avatars.quantity + 1;
  END IF;

  -- Set the user's title to their highest claimed milestone name
  SELECT m.name INTO _top_name
  FROM public.user_milestone_claims c
  JOIN public.exp_milestones m ON m.id = c.milestone_id
  WHERE c.user_id = _me
  ORDER BY m.level DESC
  LIMIT 1;

  UPDATE public.profiles SET title = _top_name, updated_at = now() WHERE id = _me;

  RETURN _ms.name;
END;
$function$;

-- Update buy_premium to flag the profile as premium
CREATE OR REPLACE FUNCTION public.buy_premium()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END;
$function$;

-- Update admin_grant_premium to flag the target profile as premium
CREATE OR REPLACE FUNCTION public.admin_grant_premium(_target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO public.user_exp (user_id, is_premium, updated_at) VALUES (_target, true, now())
  ON CONFLICT (user_id) DO UPDATE SET is_premium = true, updated_at = now();

  UPDATE public.profiles SET is_premium = true, updated_at = now() WHERE id = _target;
END;
$function$;