CREATE OR REPLACE FUNCTION public.delete_user_warning(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  DELETE FROM public.user_warnings WHERE id = _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_warning(uuid) TO authenticated;