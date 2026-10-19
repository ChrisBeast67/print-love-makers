-- Clear the admin audit log (for audit log refresh feature)
CREATE OR REPLACE FUNCTION public.clear_admin_audit_log()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.admin_audit_log;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_admin_audit_log() TO service_role;
