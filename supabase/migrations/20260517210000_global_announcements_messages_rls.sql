-- Global Announcements Messages - Allow owner/deputy to send messages
-- This fixes the RLS error when sending messages to global announcements

BEGIN;

-- Replace the old member-only policy with one that allows owner/deputy in global announcements
DROP POLICY IF EXISTS "Members can insert messages in their chats" ON public.messages;

CREATE POLICY "Members can insert messages in their chats (or owner/deputy in global announcements)"
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

COMMIT;