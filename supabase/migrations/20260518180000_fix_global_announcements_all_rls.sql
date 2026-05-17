-- Fix ALL RLS issues for Global Announcements in one migration
BEGIN;

-- 1. Allow INSERT into chat_members for global announcements (anyone can join)
DROP POLICY IF EXISTS "Anyone can join global announcements" ON public.chat_members;
CREATE POLICY "Anyone can join global announcements"
ON public.chat_members FOR INSERT TO authenticated
WITH CHECK (
  chat_id = '00000000-0000-0000-0000-000000000001'
  OR public.is_chat_admin(chat_id, auth.uid())
);

-- 2. Allow SELECT from chat_members for global announcements (anyone can see members)
DROP POLICY IF EXISTS "Anyone can view global announcements members" ON public.chat_members;
CREATE POLICY "Anyone can view global announcements members"
ON public.chat_members FOR SELECT TO authenticated
USING (
  chat_id = '00000000-0000-0000-0000-000000000001'
  OR public.is_chat_member(chat_id, auth.uid())
);

-- 3. Allow INSERT messages for global announcements (only owner/deputy)
DROP POLICY IF EXISTS "Owner/deputy can send global announcements messages" ON public.messages;
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

-- 4. Allow SELECT messages for global announcements (anyone can read)
DROP POLICY IF EXISTS "Anyone can view global announcements messages" ON public.messages;
CREATE POLICY "Anyone can view global announcements messages"
ON public.messages FOR SELECT TO authenticated
USING (
  chat_id = '00000000-0000-0000-0000-000000000001'
  OR public.is_chat_member(chat_id, auth.uid())
);

-- 5. Ensure the global announcements chat exists
INSERT INTO public.chats (id, name, type, created_by, is_global_announcements)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '📢 Global Announcements',
  'group',
  '00000000-0000-0000-0000-000000000000',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = '📢 Global Announcements',
  is_global_announcements = true;

-- 6. Auto-join all existing users to global announcements
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

COMMIT;