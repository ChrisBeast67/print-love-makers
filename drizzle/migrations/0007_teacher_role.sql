ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'teacher';
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('owner','admin','moderator','deputy','teacher'))
$$;
CREATE OR REPLACE FUNCTION public.get_user_ranks(_ids uuid[]) RETURNS TABLE(user_id uuid, rank text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT r.user_id,
    CASE WHEN bool_or(r.role::text='owner') THEN 'owner'
         WHEN bool_or(r.role::text IN ('deputy','admin')) THEN 'deputy'
         WHEN bool_or(r.role::text='moderator') THEN 'mod'
         WHEN bool_or(r.role::text='teacher') THEN 'teacher' END
  FROM public.user_roles r WHERE r.user_id = ANY(_ids) GROUP BY r.user_id
$$;
GRANT EXECUTE ON FUNCTION public.get_user_ranks(uuid[]) TO authenticated;