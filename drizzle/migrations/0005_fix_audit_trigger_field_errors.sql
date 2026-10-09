CREATE OR REPLACE FUNCTION public.audit_admin_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  actor uuid := auth.uid();
  target uuid;
  target_name text;
  action_name text;
  change_details jsonb := '{}'::jsonb;
  n jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  o jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  r jsonb;
BEGIN
  IF actor IS NULL OR NOT public.is_staff(actor) THEN RETURN COALESCE(NEW, OLD); END IF;
  r := COALESCE(n, o);

  IF TG_TABLE_NAME = 'banned_users' THEN
    target := (r->>'user_id')::uuid;
    action_name := CASE WHEN TG_OP = 'INSERT' THEN 'Banned user' ELSE 'Unbanned user' END;
    change_details := jsonb_build_object('reason', r->>'reason');
  ELSIF TG_TABLE_NAME = 'user_roles' THEN
    target := (r->>'user_id')::uuid;
    action_name := CASE WHEN TG_OP = 'INSERT' THEN 'Granted role' ELSE 'Removed role' END;
    change_details := jsonb_build_object('role', r->>'role');
  ELSIF TG_TABLE_NAME = 'user_credits' THEN
    target := (r->>'user_id')::uuid;
    action_name := 'Changed credits';
    change_details := jsonb_build_object('before', o->'balance', 'after', n->'balance');
  ELSIF TG_TABLE_NAME = 'user_exp' THEN
    target := (r->>'user_id')::uuid;
    action_name := 'Changed EXP';
    change_details := jsonb_build_object('before', o->'total_exp', 'after', n->'total_exp');
  ELSIF TG_TABLE_NAME = 'user_avatars' THEN
    target := (r->>'user_id')::uuid;
    action_name := CASE WHEN TG_OP = 'INSERT' THEN 'Granted avatar' ELSE 'Removed avatar' END;
    change_details := jsonb_build_object('avatar_item_id', r->'avatar_item_id', 'quantity', r->'quantity');
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    IF TG_OP = 'DELETE' THEN
      target := (o->>'id')::uuid; action_name := 'Deleted account data';
    ELSIF TG_OP = 'UPDATE' AND (n->'is_premium') IS DISTINCT FROM (o->'is_premium') THEN
      target := (n->>'id')::uuid;
      action_name := CASE WHEN (n->>'is_premium')::boolean THEN 'Granted Premium' ELSE 'Removed Premium' END;
    ELSE RETURN COALESCE(NEW, OLD); END IF;
  ELSIF TG_TABLE_NAME = 'events' THEN
    target := (r->>'id')::uuid;
    action_name := CASE WHEN TG_OP = 'INSERT' THEN 'Started event' ELSE 'Ended event' END;
    change_details := jsonb_build_object('name', r->>'name', 'type', r->>'type', 'luck_multiplier', r->'luck_multiplier');
  ELSIF TG_TABLE_NAME = 'global_music' THEN
    action_name := CASE WHEN COALESCE((n->>'playing')::boolean, false) THEN 'Started global music' ELSE 'Stopped global music' END;
    change_details := jsonb_build_object('title', n->>'title', 'url', n->>'url');
  ELSIF TG_TABLE_NAME = 'premium_orders' THEN
    IF TG_OP = 'UPDATE' AND (n->'status') IS DISTINCT FROM (o->'status') THEN
      target := (n->>'user_id')::uuid; action_name := 'Marked Premium order paid';
      change_details := jsonb_build_object('order_id', n->>'id', 'status', n->>'status');
    ELSE RETURN COALESCE(NEW, OLD); END IF;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT username INTO target_name FROM public.profiles WHERE id = target;
  INSERT INTO public.admin_audit_log (actor_id, actor_username, action, target_id, target_username, details)
  VALUES (actor, (SELECT username FROM public.profiles WHERE id = actor), action_name, target, target_name, change_details);
  RETURN COALESCE(NEW, OLD);
END;
$function$;