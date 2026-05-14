-- Global Announcements Chat - Fix RLS
-- This migration ensures the global announcements chat works properly

BEGIN;

-- Create a security definer function to auto-join users to global announcements
CREATE OR REPLACE FUNCTION public.auto_join_global_announcements()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  global_chat_id uuid := '00000000-0000-0000-0000-000000000001';
  the_user uuid := auth.uid();
BEGIN
  -- Check if user is already a member
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_id = global_chat_id AND user_id = the_user
  ) THEN
    -- Insert the user as a member
    INSERT INTO public.chat_members (chat_id, user_id, role)
    VALUES (global_chat_id, the_user, 'member')
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- Create the global announcements chat if it doesn't exist
-- Use auth.uid() for created_by to satisfy the RLS policy
DO $$
DECLARE
  global_chat_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Check if chat exists
  IF NOT EXISTS (SELECT 1 FROM public.chats WHERE id = global_chat_id) THEN
    -- Create chat as the current user
    INSERT INTO public.chats (id, name, type, created_by, admin_only, is_global_announcements)
    VALUES (
      global_chat_id,
      '📢 Global Announcements',
      'group',
      auth.uid(),
      true,
      true
    );
  ELSE
    -- Update existing chat to ensure it's correct
    UPDATE public.chats 
    SET name = '📢 Global Announcements',
        admin_only = true,
        is_global_announcements = true
    WHERE id = global_chat_id;
  END IF;
END;
$$;

-- Add RLS policy to allow viewing global announcements chat for all authenticated users
DROP POLICY IF EXISTS "Anyone can view global announcements" ON public.chats;
CREATE POLICY "Anyone can view global announcements"
ON public.chats FOR SELECT
TO authenticated
USING (id = '00000000-0000-0000-0000-000000000001');

-- Add RLS policy to allow joining global announcements for all authenticated users
DROP POLICY IF EXISTS "Anyone can join global announcements" ON public.chat_members;
CREATE POLICY "Anyone can join global announcements"
ON public.chat_members FOR INSERT
TO authenticated
WITH CHECK (chat_id = '00000000-0000-0000-0000-000000000001');

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