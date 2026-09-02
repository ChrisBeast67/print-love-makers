
REVOKE ALL ON FUNCTION public.log_admin_action(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_admin_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  target uuid;
  target_name text;
  action_name text;
  change_details jsonb := '{}'::jsonb;
BEGIN
  IF actor IS NULL OR NOT public.is_staff(actor) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'banned_users' THEN
    target := COALESCE(NEW.user_id, OLD.user_id);
    action_name := CASE WHEN TG_OP = 'INSERT' THEN 'Banned user' ELSE 'Unbanned user' END;
    change_details := jsonb_build_object('reason', COALESCE(NEW.reason, OLD.reason));
  ELSIF TG_TABLE_NAME = 'user_roles' THEN
    target := COALESCE(NEW.user_id, OLD.user_id);
    action_name := CASE WHEN TG_OP = 'INSERT' THEN 'Granted role' ELSE 'Removed role' END;
    change_details := jsonb_build_object('role', COALESCE(NEW.role, OLD.role)::text);
  ELSIF TG_TABLE_NAME = 'user_credits' THEN
    target := COALESCE(NEW.user_id, OLD.user_id);
    action_name := 'Changed credits';
    change_details := jsonb_build_object('before', OLD.balance, 'after', NEW.balance, 'difference', NEW.balance - OLD.balance);
  ELSIF TG_TABLE_NAME = 'user_exp' THEN
    target := COALESCE(NEW.user_id, OLD.user_id);
    action_name := 'Changed EXP';
    change_details := jsonb_build_object('before', OLD.total_exp, 'after', NEW.total_exp, 'difference', NEW.total_exp - OLD.total_exp);
  ELSIF TG_TABLE_NAME = 'user_avatars' THEN
    target := COALESCE(NEW.user_id, OLD.user_id);
    action_name := CASE WHEN TG_OP = 'INSERT' THEN 'Granted avatar' ELSE 'Removed avatar' END;
    change_details := jsonb_build_object('avatar_item_id', COALESCE(NEW.avatar_item_id, OLD.avatar_item_id), 'quantity', COALESCE(NEW.quantity, OLD.quantity));
  ELSIF TG_TABLE_NAME = 'profiles' AND TG_OP = 'UPDATE' AND NEW.is_premium IS DISTINCT FROM OLD.is_premium THEN
    target := NEW.id;
    action_name := CASE WHEN NEW.is_premium THEN 'Granted Premium' ELSE 'Removed Premium' END;
  ELSIF TG_TABLE_NAME = 'profiles' AND TG_OP = 'DELETE' THEN
    target := OLD.id;
    action_name := 'Deleted account data';
  ELSIF TG_TABLE_NAME = 'events' THEN
    target := COALESCE(NEW.id, OLD.id);
    action_name := CASE WHEN TG_OP = 'INSERT' THEN 'Started event' ELSE 'Ended event' END;
    change_details := jsonb_build_object('name', COALESCE(NEW.name, OLD.name), 'type', COALESCE(NEW.type, OLD.type)::text, 'luck_multiplier', COALESCE(NEW.luck_multiplier, OLD.luck_multiplier));
  ELSIF TG_TABLE_NAME = 'global_music' THEN
    action_name := CASE WHEN COALESCE(NEW.playing, false) THEN 'Started global music' ELSE 'Stopped global music' END;
    change_details := jsonb_build_object('title', NEW.title, 'url', NEW.url);
  ELSIF TG_TABLE_NAME = 'premium_orders' AND TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    target := NEW.user_id;
    action_name := 'Marked Premium order paid';
    change_details := jsonb_build_object('order_id', NEW.id, 'status', NEW.status);
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT username INTO target_name FROM public.profiles WHERE id = target;
  INSERT INTO public.admin_audit_log (actor_id, actor_username, action, target_id, target_username, details)
  VALUES (
    actor,
    (SELECT username FROM public.profiles WHERE id = actor),
    action_name,
    target,
    target_name,
    change_details
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_banned_users ON public.banned_users;
CREATE TRIGGER audit_banned_users AFTER INSERT OR DELETE ON public.banned_users FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles AFTER INSERT OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
DROP TRIGGER IF EXISTS audit_user_credits ON public.user_credits;
CREATE TRIGGER audit_user_credits AFTER UPDATE ON public.user_credits FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
DROP TRIGGER IF EXISTS audit_user_exp ON public.user_exp;
CREATE TRIGGER audit_user_exp AFTER UPDATE ON public.user_exp FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
DROP TRIGGER IF EXISTS audit_user_avatars ON public.user_avatars;
CREATE TRIGGER audit_user_avatars AFTER INSERT OR DELETE ON public.user_avatars FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles AFTER UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
DROP TRIGGER IF EXISTS audit_events ON public.events;
CREATE TRIGGER audit_events AFTER INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
DROP TRIGGER IF EXISTS audit_global_music ON public.global_music;
CREATE TRIGGER audit_global_music AFTER UPDATE ON public.global_music FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
DROP TRIGGER IF EXISTS audit_premium_orders ON public.premium_orders;
CREATE TRIGGER audit_premium_orders AFTER UPDATE ON public.premium_orders FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
