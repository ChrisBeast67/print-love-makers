-- Helper: is staff (owner or moderator or admin)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('owner','admin','moderator')
  )
$$;

-- Allow owners to manage roles (insert/delete) — moderators cannot
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Owners can insert roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can delete roles" ON public.user_roles
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- Update banned_users policies so moderators can ban too
DROP POLICY IF EXISTS "Admins can ban" ON public.banned_users;
DROP POLICY IF EXISTS "Admins can unban" ON public.banned_users;

CREATE POLICY "Staff can ban" ON public.banned_users
FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) AND auth.uid() = banned_by);

CREATE POLICY "Staff can unban" ON public.banned_users
FOR DELETE TO authenticated
USING (public.is_staff(auth.uid()));

-- RPC: set role (owner only). Allowed targets: 'moderator' or 'user' (clear).
CREATE OR REPLACE FUNCTION public.admin_set_role(_target uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Only owners can change roles';
  END IF;
  IF _role NOT IN ('moderator','owner') THEN
    RAISE EXCEPTION 'Invalid role assignment';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, _role)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_role(_target uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Only owners can change roles';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _target AND role = _role;
END;
$$;

-- RPC: grant credits (staff)
CREATE OR REPLACE FUNCTION public.admin_grant_credits(_target uuid, _amount int)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.user_credits (user_id, balance) VALUES (_target, GREATEST(_amount, 0))
  ON CONFLICT (user_id) DO UPDATE
  SET balance = GREATEST(public.user_credits.balance + _amount, 0), updated_at = now();
END;
$$;

-- RPC: ban / unban (staff)
CREATE OR REPLACE FUNCTION public.admin_ban_user(_target uuid, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO public.banned_users (user_id, banned_by, reason)
  VALUES (_target, auth.uid(), _reason)
  ON CONFLICT (user_id) DO UPDATE SET banned_by = auth.uid(), reason = EXCLUDED.reason, banned_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unban_user(_target uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.banned_users WHERE user_id = _target;
END;
$$;

-- Make first existing 'admin' also an 'owner' for bootstrapping (chris)
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'owner'::app_role FROM public.user_roles WHERE role = 'admin'
ON CONFLICT DO NOTHING;
