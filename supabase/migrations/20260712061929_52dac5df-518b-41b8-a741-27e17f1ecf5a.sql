CREATE OR REPLACE FUNCTION public.admin_remove_premium(_target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  INSERT INTO public.user_exp (user_id, is_premium, updated_at) VALUES (_target, false, now())
  ON CONFLICT (user_id) DO UPDATE SET is_premium = false, updated_at = now();

  UPDATE public.profiles SET is_premium = false, updated_at = now() WHERE id = _target;
END;
$function$;