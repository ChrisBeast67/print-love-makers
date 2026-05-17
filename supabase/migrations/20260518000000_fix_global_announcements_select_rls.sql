-- Fix RLS for global announcements to show members count
BEGIN;

-- Drop the old restrictive SELECT policy
DROP POLICY IF EXISTS "Members can view memberships of their chats" ON public.chat_members;

-- Create new policy that allows everyone to see members of global announcements
CREATE POLICY "Anyone can view global announcements members"
ON public.chat_members FOR SELECT TO authenticated
USING (
  public.is_chat_member(chat_id, auth.uid())
  OR chat_id = '00000000-0000-0000-0000-000000000001'
);

-- Also update messages SELECT to be consistent
DROP POLICY IF EXISTS "Members can view chat messages" ON public.messages;

CREATE POLICY "Anyone can view global announcements messages"
ON public.messages FOR SELECT TO authenticated
USING (
  public.is_chat_member(chat_id, auth.uid())
  OR chat_id = '00000000-0000-0000-0000-000000000001'
);

COMMIT;