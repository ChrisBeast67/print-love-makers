
DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(id uuid, username text, email text, balance integer, banned boolean, roles text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
    COALESCE(a.email, '')::text AS email,
    COALESCE(c.balance, 0)::int AS balance,
    (b.user_id IS NOT NULL) AS banned,
    COALESCE(
      (SELECT array_agg(r.role::text) FROM public.user_roles r WHERE r.user_id = p.id),
      ARRAY[]::text[]
    ) AS roles
  FROM public.profiles p
  LEFT JOIN auth.users a ON a.id = p.id
  LEFT JOIN public.user_credits c ON c.user_id = p.id
  LEFT JOIN public.banned_users b ON b.user_id = p.id
  ORDER BY p.username;
END;
$$;
