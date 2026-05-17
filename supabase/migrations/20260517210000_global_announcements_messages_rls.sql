-- Global Announcements Messages - Allow owner/deputy to send messages
-- This fixes the RLS error when sending messages to global announcements

BEGIN;

-- Create a special policy that allows owner/deputy to insert messages into global announcements
-- without needing to be a chat member (they still need to be authenticated)
DROP POLICY IF EXISTS "Owner/deputy can send global announcements messages" ON public.messages;
CREATE POLICY "Owner/deputy can send global announcements messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND NOT public.is_banned(auth.uid())
  AND (
    chat_id != '00000000-0000-0000-0000-000000000001'
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('owner', 'deputy')
    )
  )
);

COMMIT;