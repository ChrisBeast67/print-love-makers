CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  started_by uuid NOT NULL,
  kind text NOT NULL DEFAULT 'audio',
  status text NOT NULL DEFAULT 'ringing',
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat members can view calls" ON public.calls
  FOR SELECT TO authenticated
  USING (public.is_chat_member(chat_id, auth.uid()));

CREATE TABLE public.call_participants (
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'invited',
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (call_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_participants TO authenticated;
GRANT ALL ON public.call_participants TO service_role;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat members can view call participants" ON public.call_participants
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.calls c
    WHERE c.id = call_participants.call_id
      AND public.is_chat_member(c.chat_id, auth.uid())
  ));

CREATE INDEX idx_calls_chat_status ON public.calls(chat_id, status);
CREATE INDEX idx_call_participants_user ON public.call_participants(user_id);

CREATE OR REPLACE FUNCTION public.start_call(_chat_id uuid, _kind text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
  _id uuid;
  _admin_only boolean;
  _member_count int;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _kind NOT IN ('audio','video') THEN RAISE EXCEPTION 'Invalid call type'; END IF;
  IF NOT public.is_chat_member(_chat_id, _me) THEN RAISE EXCEPTION 'Not a member of this chat'; END IF;
  IF public.is_banned(_me) THEN RAISE EXCEPTION 'You are banned'; END IF;

  SELECT admin_only INTO _admin_only FROM public.chats WHERE id = _chat_id;
  IF COALESCE(_admin_only, false) AND NOT public.is_chat_admin(_chat_id, _me) THEN
    RAISE EXCEPTION 'Only admins can start calls in this chat';
  END IF;

  -- Auto-expire stale ringing calls
  UPDATE public.calls SET status = 'ended', ended_at = now()
    WHERE chat_id = _chat_id AND status = 'ringing' AND created_at < now() - interval '60 seconds';

  IF EXISTS (SELECT 1 FROM public.calls WHERE chat_id = _chat_id AND status IN ('ringing','active')) THEN
    RAISE EXCEPTION 'A call is already in progress in this chat';
  END IF;

  SELECT count(*) INTO _member_count FROM public.chat_members WHERE chat_id = _chat_id;
  IF _member_count > 4 THEN RAISE EXCEPTION 'Calls support up to 4 participants'; END IF;

  INSERT INTO public.calls (chat_id, started_by, kind) VALUES (_chat_id, _me, _kind)
  RETURNING id INTO _id;

  INSERT INTO public.call_participants (call_id, user_id, state, joined_at)
  VALUES (_id, _me, 'joined', now());

  INSERT INTO public.call_participants (call_id, user_id, state)
  SELECT _id, m.user_id FROM public.chat_members m
  WHERE m.chat_id = _chat_id AND m.user_id <> _me;

  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.answer_call(_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
  _joined int;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.call_participants WHERE call_id = _call_id AND user_id = _me) THEN
    RAISE EXCEPTION 'Not invited to this call';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.calls WHERE id = _call_id AND status IN ('ringing','active')) THEN
    RAISE EXCEPTION 'Call is no longer available';
  END IF;

  SELECT count(*) INTO _joined FROM public.call_participants WHERE call_id = _call_id AND state = 'joined';
  IF _joined >= 4 THEN RAISE EXCEPTION 'Call is full'; END IF;

  UPDATE public.call_participants SET state = 'joined', joined_at = now(), left_at = NULL
    WHERE call_id = _call_id AND user_id = _me;

  UPDATE public.calls SET status = 'active', answered_at = COALESCE(answered_at, now())
    WHERE id = _call_id AND status = 'ringing';
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_call(_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.call_participants SET state = 'declined', left_at = now()
    WHERE call_id = _call_id AND user_id = _me AND state = 'invited';

  IF NOT EXISTS (
    SELECT 1 FROM public.call_participants
    WHERE call_id = _call_id AND state IN ('invited','joined') AND user_id <> (SELECT started_by FROM public.calls WHERE id = _call_id)
  ) THEN
    UPDATE public.calls SET status = 'ended', ended_at = now() WHERE id = _call_id AND status = 'ringing';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_call(_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
  _remaining int;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.call_participants SET state = 'left', left_at = now()
    WHERE call_id = _call_id AND user_id = _me AND state IN ('joined','invited');

  SELECT count(*) INTO _remaining FROM public.call_participants
    WHERE call_id = _call_id AND state = 'joined';

  IF _remaining <= 1 THEN
    UPDATE public.call_participants SET state = 'left', left_at = now()
      WHERE call_id = _call_id AND state IN ('joined','invited');
    UPDATE public.calls SET status = 'ended', ended_at = now()
      WHERE id = _call_id AND status <> 'ended';
  END IF;
END;
$$;

ALTER TABLE public.calls REPLICA IDENTITY FULL;
ALTER TABLE public.call_participants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;