-- Fix chat_members SELECT policy for global announcements
BEGIN;

-- Allow all authenticated users to see chat members (RLS will filter by is_chat_member)
DROP POLICY IF EXISTS "Members can view memberships of their chats" ON public.chat_members;

CREATE POLICY "Members can view memberships of their chats"
ON public.chat_members FOR SELECT TO authenticated
USING (
  public.is_chat_member(chat_id, auth.uid())
  OR chat_id = '00000000-0000-0000-0000-000000000001'
);

-- Also update messages SELECT to allow viewing global announcements messages for all members
DROP POLICY IF EXISTS "Members can view chat messages" ON public.messages;

CREATE POLICY "Members can view chat messages"
ON public.messages FOR SELECT TO authenticated
USING (
  public.is_chat_member(chat_id, auth.uid())
  OR chat_id = '00000000-0000-0000-0000-000000000001'
);

COMMIT;