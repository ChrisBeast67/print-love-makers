-- Health check fix: Ensure global announcements is fully accessible
-- Uses SECURITY DEFINER to bypass RLS for admin setup operations
BEGIN;

-- 1. Ensure the global announcements chat exists (SECURITY DEFINER)
SET LOCAL search_path = public;

INSERT INTO public.chats (id, name, type, created_by, admin_only, is_global_announcements)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '📢 Global Announcements',
  'group',
  '00000000-0000-0000-0000-000000000000',
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = '📢 Global Announcements',
  admin_only = true,
  is_global_announcements = true;

-- 2. Ensure SECURITY DEFINER function can add members (re-create if missing)
CREATE OR REPLACE FUNCTION public.force_join_global_announcements()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add all users who aren't already members
  INSERT INTO public.chat_members (chat_id, user_id, role)
  SELECT 
    '00000000-0000-0000-0000-000000000001',
    id,
    'member'
  FROM auth.users
  WHERE NOT EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_id = '00000000-0000-0000-0000-000000000001' 
    AND user_id = auth.users.id
  )
  ON CONFLICT DO NOTHING;
END;
$$;

-- 3. Execute the force join
SELECT public.force_join_global_announcements();

-- 4. Drop and recreate the chats SELECT policy to allow viewing global announcements
DROP POLICY IF EXISTS "Anyone can view global announcements chat" ON public.chats;

CREATE POLICY "Anyone can view global announcements chat"
ON public.chats FOR SELECT TO authenticated
USING (
  id = '00000000-0000-0000-0000-000000000001'
  OR public.is_chat_member(id, auth.uid())
);

-- 5. Drop and recreate the chats INSERT policy to allow creation of global announcements (first time only)
DROP POLICY IF EXISTS "Anyone can create global announcements chat" ON public.chats;

CREATE POLICY "Anyone can create global announcements chat"
ON public.chats FOR INSERT TO authenticated
WITH CHECK (
  id = '00000000-0000-0000-0000-000000000001'
  AND auth.uid() = created_by
);

-- 6. Ensure the chat_members policies are correct for global announcements
-- First drop conflicting policies
DROP POLICY IF EXISTS "Anyone can join global announcements" ON public.chat_members;

DROP POLICY IF EXISTS "Prevent leaving global announcements" ON public.chat_members;

-- Recreate with proper global announcements exception
CREATE POLICY "Admins can add members to global announcements"
ON public.chat_members FOR INSERT TO authenticated
WITH CHECK (
  chat_id = '00000000-0000-0000-0000-000000000001'
  OR public.is_chat_admin(chat_id, auth.uid())
);

CREATE POLICY "Prevent leaving global announcements"
ON public.chat_members FOR DELETE TO authenticated
USING (chat_id != '00000000-0000-0000-0000-000000000001');

-- 7. Ensure the messages policies are correct for global announcements  
DROP POLICY IF EXISTS "Owner/deputy can send global announcements messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can view global announcements messages" ON public.messages;

CREATE POLICY "Owner/deputy can send global announcements messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND NOT public.is_banned(auth.uid())
  AND (
    public.is_chat_member(chat_id, auth.uid())
    OR (
      chat_id = '00000000-0000-0000-0000-000000000001'
      AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'deputy'))
    )
  )
);

CREATE POLICY "Anyone can view global announcements messages"
ON public.messages FOR SELECT TO authenticated
USING (
  chat_id = '00000000-0000-0000-0000-000000000001'
  OR public.is_chat_member(chat_id, auth.uid())
);

-- 8. Drop the helper function (cleanup)
DROP FUNCTION IF EXISTS public.force_join_global_announcements();

COMMIT;