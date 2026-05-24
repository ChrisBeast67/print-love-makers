-- Add hacker mode columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_hacker BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hacker_since TIMESTAMPTZ;

-- Allow authenticated users to update their own hacker status
-- (so users can remove hacker mode from themselves)
CREATE POLICY "Users can update their own hacker status"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow admins to update any user's hacker status
CREATE POLICY "Admins can update any user's hacker status"
ON public.profiles FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members cm
    JOIN public.chats c ON c.id = cm.chat_id
    WHERE cm.user_id = auth.uid()
    AND cm.role = 'admin'
    AND c.type = 'dm'
    AND c.created_by = auth.uid()
  )
);