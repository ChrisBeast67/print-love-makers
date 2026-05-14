-- Global Announcements Chat
-- A special chat where only owners and deputies can send messages

BEGIN;

-- Add is_global_announcements column if not exists
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS is_global_announcements BOOLEAN DEFAULT false;

-- Create the global announcements chat (use a valid UUID for created_by)
INSERT INTO public.chats (id, name, type, created_by, admin_only, is_global_announcements)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '📢 Global Announcements',
  'group',
  '00000000-0000-0000-0000-000000000000',  -- placeholder - will be updated
  true,  -- admin_only means only admins/deputies can send
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = '📢 Global Announcements',
  admin_only = true,
  is_global_announcements = true;

-- Auto-join all existing users to the global announcements chat
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

-- Make it so the global announcements chat cannot be deleted
DROP POLICY IF EXISTS "Prevent deleting global announcements" ON public.chats;
CREATE POLICY "Prevent deleting global announcements"
ON public.chats FOR DELETE
USING (id != '00000000-0000-0000-0000-000000000001');

DROP POLICY IF EXISTS "Prevent leaving global announcements" ON public.chat_members;
CREATE POLICY "Prevent leaving global announcements"
ON public.chat_members FOR DELETE
USING (chat_id != '00000000-0000-0000-0000-000000000001');

COMMIT;