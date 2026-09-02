
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_username text,
  action text NOT NULL,
  target_id uuid,
  target_username text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view audit log"
ON public.admin_audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE INDEX idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);

CREATE OR REPLACE FUNCTION public.log_admin_action(_actor uuid, _action text, _target uuid DEFAULT NULL, _details jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (actor_id, actor_username, action, target_id, target_username, details)
  VALUES (
    _actor,
    (SELECT username FROM public.profiles WHERE id = _actor),
    _action,
    _target,
    (SELECT username FROM public.profiles WHERE id = _target),
    COALESCE(_details, '{}'::jsonb)
  );
END;
$$;
