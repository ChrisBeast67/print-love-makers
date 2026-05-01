
-- Staff can make themselves admin of any group
CREATE OR REPLACE FUNCTION public.staff_join_as_admin(_chat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
  _chat_type text;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_staff(_me) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT type INTO _chat_type FROM public.chats WHERE id = _chat_id;
  IF _chat_type IS NULL THEN RAISE EXCEPTION 'Chat not found'; END IF;
  IF _chat_type <> 'group' THEN RAISE EXCEPTION 'Can only self-promote in groups'; END IF;

  -- Insert or update membership to admin
  INSERT INTO public.chat_members (chat_id, user_id, role)
  VALUES (_chat_id, _me, 'admin')
  ON CONFLICT (chat_id, user_id) DO UPDATE SET role = 'admin';
END;
$$;

-- Group admin can promote/demote a member
CREATE OR REPLACE FUNCTION public.set_member_role(_chat_id uuid, _target uuid, _role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _role NOT IN ('admin', 'member') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF NOT public.is_chat_admin(_chat_id, _me) THEN RAISE EXCEPTION 'Not a chat admin'; END IF;
  IF _target = _me THEN RAISE EXCEPTION 'Cannot change your own role'; END IF;
  IF NOT public.is_chat_member(_chat_id, _target) THEN RAISE EXCEPTION 'User is not a member'; END IF;

  UPDATE public.chat_members SET role = _role::chat_member_role
  WHERE chat_id = _chat_id AND user_id = _target;
END;
$$;
