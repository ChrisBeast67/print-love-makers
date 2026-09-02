
DROP FUNCTION IF EXISTS public.log_admin_action(uuid, text, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.log_admin_action(_action text, _target uuid DEFAULT NULL, _details jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.admin_audit_log (actor_id, actor_username, action, target_id, target_username, details)
  VALUES (
    auth.uid(),
    (SELECT username FROM public.profiles WHERE id = auth.uid()),
    left(_action, 100),
    _target,
    (SELECT username FROM public.profiles WHERE id = _target),
    COALESCE(_details, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_admin_action(text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, uuid, jsonb) TO authenticated;
