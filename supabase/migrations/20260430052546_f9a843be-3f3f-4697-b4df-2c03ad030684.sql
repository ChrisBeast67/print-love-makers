
-- 1) Restrict user_credits SELECT to the owner; add staff override
DROP POLICY IF EXISTS "Credits viewable by authenticated" ON public.user_credits;
CREATE POLICY "Own credits viewable"
  ON public.user_credits FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- 2) Restrict user_packs SELECT to the owner; add staff override
DROP POLICY IF EXISTS "User packs viewable by authenticated" ON public.user_packs;
CREATE POLICY "Own packs viewable"
  ON public.user_packs FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- 3) Explicitly deny direct INSERT/UPDATE/DELETE on trade_offers
--    (all writes go through SECURITY DEFINER RPCs).
CREATE POLICY "No direct writes on trade_offers (insert)"
  ON public.trade_offers FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No direct writes on trade_offers (update)"
  ON public.trade_offers FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No direct writes on trade_offers (delete)"
  ON public.trade_offers FOR DELETE TO authenticated USING (false);

-- 4) Remove hardcoded 'chris' admin escalation from new-user trigger
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

  INSERT INTO public.user_credits (user_id, balance) VALUES (NEW.id, 100)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 5) Staff-only function used by the Admin panel to list all users with credits/roles/ban status
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  username text,
  balance integer,
  banned boolean,
  roles text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.username,
    COALESCE(c.balance, 0)::int AS balance,
    (b.user_id IS NOT NULL) AS banned,
    COALESCE(
      (SELECT array_agg(r.role::text) FROM public.user_roles r WHERE r.user_id = p.id),
      ARRAY[]::text[]
    ) AS roles
  FROM public.profiles p
  LEFT JOIN public.user_credits c ON c.user_id = p.id
  LEFT JOIN public.banned_users b ON b.user_id = p.id
  ORDER BY p.username;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
