-- Fix RLS for global announcements messages and members visibility
BEGIN;

-- Allow owner/deputy to SELECT messages in global announcements
DROP POLICY IF EXISTS "Owner/deputy can view global announcements messages" ON public.messages;
CREATE POLICY "Owner/deputy can view global announcements messages"
ON public.messages FOR SELECT TO authenticated
USING (
  chat_id != '00000000-0000-0000-0000-000000000001'
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('owner', 'deputy')
  )
  OR public.is_chat_member(chat_id, auth.uid())
);

-- Allow owner/deputy to SELECT chat_members for global announcements
DROP POLICY IF EXISTS "Owner/deputy can view global announcements members" ON public.chat_members;
CREATE POLICY "Owner/deputy can view global announcements members"
ON public.chat_members FOR SELECT TO authenticated
USING (
  chat_id != '00000000-0000-0000-0000-000000000001'
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('owner', 'deputy')
  )
  OR public.is_chat_member(chat_id, auth.uid())
);

COMMIT;