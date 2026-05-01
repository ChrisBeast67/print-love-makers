
-- Add admin_only flag to chats
ALTER TABLE public.chats ADD COLUMN admin_only boolean NOT NULL DEFAULT false;

-- Update the message insert policy to block non-admins when admin_only is on
DROP POLICY "Members can insert messages in their chats" ON public.messages;

CREATE POLICY "Members can insert messages in their chats"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND is_chat_member(chat_id, auth.uid())
  AND NOT is_banned(auth.uid())
  AND (
    NOT (SELECT c.admin_only FROM public.chats c WHERE c.id = chat_id)
    OR is_chat_admin(chat_id, auth.uid())
  )
);
