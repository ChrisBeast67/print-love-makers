-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create banned_users table
CREATE TABLE public.banned_users (
  user_id UUID PRIMARY KEY,
  banned_by UUID NOT NULL,
  reason TEXT,
  banned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;

-- 4. Security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_banned(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.banned_users WHERE user_id = _user_id)
$$;

-- 5. RLS for user_roles
CREATE POLICY "Roles viewable by authenticated"
ON public.user_roles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 6. RLS for banned_users
CREATE POLICY "Bans viewable by authenticated"
ON public.banned_users FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can ban"
ON public.banned_users FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = banned_by);

CREATE POLICY "Admins can unban"
ON public.banned_users FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 7. Update messages policies: banned users can't post
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Non-banned users can insert their own messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND NOT public.is_banned(auth.uid()));

-- Admins can delete any message
CREATE POLICY "Admins can delete any message"
ON public.messages FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 8. Auto-grant admin role to user named "chris" on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _username TEXT;
BEGIN
  _username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    _username,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  -- Auto-admin if username is "chris" (case-insensitive)
  IF lower(_username) = 'chris' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Make sure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Promote any existing "chris" to admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM public.profiles WHERE lower(username) = 'chris'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'::app_role FROM public.profiles
ON CONFLICT DO NOTHING;