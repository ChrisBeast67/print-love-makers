-- Ensure Global Announcements is set up properly
-- Run this to fix any users not joined to global announcements

BEGIN;

-- Make sure the global announcements chat exists
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

-- Auto-join ALL existing users to global announcements
INSERT INTO public.chat_members (chat_id, user_id, role)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  id,
  'member'
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.chat_members 
  WHERE chat_id = '00000000-0000-0000-0000-000000000001' AND user_id = auth.users.id
)
ON CONFLICT DO NOTHING;

COMMIT;
