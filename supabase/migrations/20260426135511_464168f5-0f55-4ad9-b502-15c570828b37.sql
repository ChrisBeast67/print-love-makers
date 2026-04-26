
-- Enum for chat type
CREATE TYPE public.chat_type AS ENUM ('dm', 'group');

-- Enum for chat member role
CREATE TYPE public.chat_member_role AS ENUM ('admin', 'member');

-- =========================
-- chats table
-- =========================
CREATE TABLE public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  type public.chat_type NOT NULL DEFAULT 'group',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- =========================
-- chat_members table
-- =========================
CREATE TABLE public.chat_members (
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.chat_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);

ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_chat_members_user_id ON public.chat_members(user_id);

-- =========================
-- Security definer helpers (avoid RLS recursion)
-- =========================
CREATE OR REPLACE FUNCTION public.is_chat_member(_chat_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_id = _chat_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_chat_admin(_chat_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_id = _chat_id AND user_id = _user_id AND role = 'admin'
  )
$$;

-- =========================
-- chats RLS
-- =========================
CREATE POLICY "Members can view their chats"
ON public.chats FOR SELECT TO authenticated
USING (public.is_chat_member(id, auth.uid()));

CREATE POLICY "Authenticated can create chats"
ON public.chats FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update chat"
ON public.chats FOR UPDATE TO authenticated
USING (public.is_chat_admin(id, auth.uid()));

CREATE POLICY "Admins can delete chat"
ON public.chats FOR DELETE TO authenticated
USING (public.is_chat_admin(id, auth.uid()));

-- =========================
-- chat_members RLS
-- =========================
CREATE POLICY "Members can view memberships of their chats"
ON public.chat_members FOR SELECT TO authenticated
USING (public.is_chat_member(chat_id, auth.uid()));

-- Inserting members: the chat creator/admin OR self-join via invite (handled by SECURITY DEFINER fn).
-- Allow admins to add members, and allow users to add themselves (used during chat creation by creator).
CREATE POLICY "Admins can add members"
ON public.chat_members FOR INSERT TO authenticated
WITH CHECK (public.is_chat_admin(chat_id, auth.uid()));

CREATE POLICY "Users can add themselves as creator"
ON public.chat_members FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_id AND c.created_by = auth.uid())
);

CREATE POLICY "Members can update own last_read"
ON public.chat_members FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any member"
ON public.chat_members FOR UPDATE TO authenticated
USING (public.is_chat_admin(chat_id, auth.uid()));

CREATE POLICY "Members can leave (delete self)"
ON public.chat_members FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can remove members"
ON public.chat_members FOR DELETE TO authenticated
USING (public.is_chat_admin(chat_id, auth.uid()));

-- =========================
-- messages: add chat_id and update RLS
-- =========================
ALTER TABLE public.messages ADD COLUMN chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE;
CREATE INDEX idx_messages_chat_id_created_at ON public.messages(chat_id, created_at);

-- Drop old policies that reference the global chat
DROP POLICY IF EXISTS "Messages are viewable by authenticated users" ON public.messages;
DROP POLICY IF EXISTS "Non-banned users can insert their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
DROP POLICY IF EXISTS "Admins can delete any message" ON public.messages;

CREATE POLICY "Members can view chat messages"
ON public.messages FOR SELECT TO authenticated
USING (public.is_chat_member(chat_id, auth.uid()));

CREATE POLICY "Members can insert messages in their chats"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_chat_member(chat_id, auth.uid())
  AND NOT public.is_banned(auth.uid())
);

CREATE POLICY "Users can delete own messages"
ON public.messages FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Chat admins can delete any chat message"
ON public.messages FOR DELETE TO authenticated
USING (public.is_chat_admin(chat_id, auth.uid()));

-- =========================
-- chat_invites table (shareable links)
-- =========================
CREATE TABLE public.chat_invites (
  token TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(16), 'hex'),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE public.chat_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view invites for their chats"
ON public.chat_invites FOR SELECT TO authenticated
USING (public.is_chat_member(chat_id, auth.uid()));

CREATE POLICY "Admins can create invites"
ON public.chat_invites FOR INSERT TO authenticated
WITH CHECK (
  public.is_chat_admin(chat_id, auth.uid())
  AND auth.uid() = created_by
);

CREATE POLICY "Admins can delete invites"
ON public.chat_invites FOR DELETE TO authenticated
USING (public.is_chat_admin(chat_id, auth.uid()));

-- =========================
-- typing_indicators table
-- =========================
CREATE TABLE public.typing_indicators (
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);

ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view typing in their chats"
ON public.typing_indicators FOR SELECT TO authenticated
USING (public.is_chat_member(chat_id, auth.uid()));

CREATE POLICY "Members can insert own typing"
ON public.typing_indicators FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_chat_member(chat_id, auth.uid()));

CREATE POLICY "Members can update own typing"
ON public.typing_indicators FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Members can delete own typing"
ON public.typing_indicators FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- =========================
-- Function: join a chat via invite token (security definer, bypasses RLS for membership add)
-- =========================
CREATE OR REPLACE FUNCTION public.join_chat_with_invite(_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _chat_id UUID;
  _expires TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT chat_id, expires_at INTO _chat_id, _expires
  FROM public.chat_invites
  WHERE token = _token;

  IF _chat_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite';
  END IF;

  IF _expires IS NOT NULL AND _expires < now() THEN
    RAISE EXCEPTION 'Invite expired';
  END IF;

  INSERT INTO public.chat_members (chat_id, user_id, role)
  VALUES (_chat_id, auth.uid(), 'member')
  ON CONFLICT (chat_id, user_id) DO NOTHING;

  RETURN _chat_id;
END;
$$;

-- =========================
-- Function: create or get a DM with another user
-- =========================
CREATE OR REPLACE FUNCTION public.create_or_get_dm(_other_user UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me UUID := auth.uid();
  _chat_id UUID;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _me = _other_user THEN RAISE EXCEPTION 'Cannot DM yourself'; END IF;

  -- Find existing DM with exactly these two members
  SELECT c.id INTO _chat_id
  FROM public.chats c
  WHERE c.type = 'dm'
    AND EXISTS (SELECT 1 FROM public.chat_members m1 WHERE m1.chat_id = c.id AND m1.user_id = _me)
    AND EXISTS (SELECT 1 FROM public.chat_members m2 WHERE m2.chat_id = c.id AND m2.user_id = _other_user)
    AND (SELECT COUNT(*) FROM public.chat_members m3 WHERE m3.chat_id = c.id) = 2
  LIMIT 1;

  IF _chat_id IS NOT NULL THEN
    RETURN _chat_id;
  END IF;

  INSERT INTO public.chats (type, created_by) VALUES ('dm', _me) RETURNING id INTO _chat_id;
  INSERT INTO public.chat_members (chat_id, user_id, role) VALUES (_chat_id, _me, 'admin');
  INSERT INTO public.chat_members (chat_id, user_id, role) VALUES (_chat_id, _other_user, 'member');

  RETURN _chat_id;
END;
$$;

-- =========================
-- Function: create a group chat (creator becomes admin)
-- =========================
CREATE OR REPLACE FUNCTION public.create_group_chat(_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me UUID := auth.uid();
  _chat_id UUID;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  INSERT INTO public.chats (name, type, created_by)
  VALUES (NULLIF(trim(_name), ''), 'group', _me)
  RETURNING id INTO _chat_id;

  INSERT INTO public.chat_members (chat_id, user_id, role)
  VALUES (_chat_id, _me, 'admin');

  RETURN _chat_id;
END;
$$;

-- =========================
-- Function: add member by username (admin only)
-- =========================
CREATE OR REPLACE FUNCTION public.add_member_by_username(_chat_id UUID, _username TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_chat_admin(_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not an admin of this chat';
  END IF;

  SELECT id INTO _target FROM public.profiles WHERE lower(username) = lower(_username);
  IF _target IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

  INSERT INTO public.chat_members (chat_id, user_id, role)
  VALUES (_chat_id, _target, 'member')
  ON CONFLICT (chat_id, user_id) DO NOTHING;
END;
$$;

-- =========================
-- Triggers: keep chat updated_at fresh on new message
-- =========================
CREATE OR REPLACE FUNCTION public.touch_chat_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.chats SET updated_at = now() WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_messages_touch_chat
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.touch_chat_updated_at();

-- =========================
-- Realtime
-- =========================
ALTER TABLE public.chats REPLICA IDENTITY FULL;
ALTER TABLE public.chat_members REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.typing_indicators REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- messages already in publication from earlier migration; ensure idempotent
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
