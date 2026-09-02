
DROP FUNCTION IF EXISTS public.log_admin_action(text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.log_admin_action(uuid, text, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.log_admin_action(_actor uuid, _action text, _target uuid DEFAULT NULL, _details jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(_actor) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.admin_audit_log (actor_id, actor_username, action, target_id, target_username, details)
  VALUES (
    _actor,
    (SELECT username FROM public.profiles WHERE id = _actor),
    left(_action, 100),
    _target,
    (SELECT username FROM public.profiles WHERE id = _target),
    COALESCE(_details, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_admin_action(uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action(uuid, text, uuid, jsonb) TO service_role;
