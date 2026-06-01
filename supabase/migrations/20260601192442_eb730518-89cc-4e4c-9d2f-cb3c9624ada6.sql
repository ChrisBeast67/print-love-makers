-- Create the real Global Announcements chat (everyone can read, only owner/deputy/admin can post)
INSERT INTO public.chats (id, name, type, admin_only, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '📢 Global Announcements',
  'group',
  true,
  '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      admin_only = true;

-- Everyone (any authenticated user) can read global announcement messages
CREATE POLICY "Anyone can read global announcements"
ON public.messages
FOR SELECT
TO authenticated
USING (chat_id = '00000000-0000-0000-0000-000000000001');

-- Only owners and deputies (and legacy admins) can post in global announcements
CREATE POLICY "Owners and deputies can post global announcements"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  chat_id = '00000000-0000-0000-0000-000000000001'
  AND auth.uid() = user_id
  AND NOT public.is_banned(auth.uid())
  AND (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'deputy')
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- Everyone (any authenticated user) can see the global announcements chat row
CREATE POLICY "Anyone can view global announcements chat"
ON public.chats
FOR SELECT
TO authenticated
USING (id = '00000000-0000-0000-0000-000000000001');