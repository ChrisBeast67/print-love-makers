CREATE OR REPLACE FUNCTION public.admin_grant_exp(_target uuid, _amount bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO public.user_exp (user_id, total_exp, updated_at)
  VALUES (_target, GREATEST(_amount, 0), now())
  ON CONFLICT (user_id) DO UPDATE
  SET total_exp = GREATEST(public.user_exp.total_exp + _amount, 0),
      updated_at = now();
END;
$function$;