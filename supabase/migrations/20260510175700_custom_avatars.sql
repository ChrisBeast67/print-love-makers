-- Add custom avatar columns + RLS + insert RPC
BEGIN;

-- 1. Track who created an avatar + flag for custom ones
ALTER TABLE public.avatar_items
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. RLS: allow owners/deputies to insert custom avatars
DROP POLICY IF EXISTS "Avatar items viewable by authenticated" ON public.avatar_items;
CREATE POLICY "Avatar items viewable by authenticated"
  ON public.avatar_items FOR SELECT TO authenticated USING (true);

-- Insert: owner or deputy can create, otherwise only via RPC (open_pack)
CREATE POLICY "Owners and deputies can insert custom avatars"
  ON public.avatar_items FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      public.has_role(auth.uid(), 'owner')
      OR public.has_role(auth.uid(), 'deputy')
    )
  );

-- 3. RPC: insert custom avatar (SECURITY DEFINER so it's always allowed)
CREATE OR REPLACE FUNCTION public.insert_custom_avatar(
  _name TEXT,
  _emoji TEXT,
  _theme TEXT,
  _rarity TEXT,
  _accent_hsl TEXT DEFAULT '180 80% 50%',
  _slug TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _slug_gen TEXT;
  _new_id UUID;
BEGIN
  -- Must be owner or deputy
  IF NOT (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'deputy')) THEN
    RAISE EXCEPTION 'Only owners and deputies can upload custom avatars';
  END IF;

  -- Generate slug if not provided
  _slug_gen := coalesce(_slug, lower(replace(replace(_name, ' ', '-'), '''', '')) || '-' || floor(random() * 99999)::text);

  -- Insert the avatar
  INSERT INTO public.avatar_items (slug, name, theme, rarity, emoji, accent_hsl, created_by, is_custom)
  VALUES (_slug_gen, _name, _theme, _rarity, _emoji, _accent_hsl, auth.uid(), TRUE)
  RETURNING id INTO _new_id;

  -- Give the creator 1 copy automatically
  INSERT INTO public.user_avatars (user_id, avatar_item_id, quantity)
  VALUES (auth.uid(), _new_id, 1)
  ON CONFLICT (user_id, avatar_item_id) DO UPDATE SET quantity = user_avatars.quantity + 1;

  RETURN _new_id;
END;
$$;

COMMIT;
