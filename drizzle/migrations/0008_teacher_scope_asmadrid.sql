CREATE OR REPLACE FUNCTION public.can_view_user_safety(_viewer uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _viewer AND role IN ('owner','deputy','admin','moderator'))
  OR (
    public.has_role(_viewer, 'teacher')
    AND _target IS NOT NULL
    AND NOT public.has_role(_target, 'owner')
    AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _target AND lower(u.email) LIKE '%@asmadrid.es')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_user_safety(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_user_safety(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Staff view reports" ON public.message_reports;
CREATE POLICY "Staff view reports" ON public.message_reports FOR SELECT TO authenticated
  USING (public.can_view_user_safety(auth.uid(), author_id));

DROP POLICY IF EXISTS "Staff can view warnings" ON public.user_warnings;
DROP POLICY IF EXISTS "Users can view own warnings" ON public.user_warnings;
CREATE POLICY "Users can view own warnings" ON public.user_warnings FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.can_view_user_safety(auth.uid(), user_id));