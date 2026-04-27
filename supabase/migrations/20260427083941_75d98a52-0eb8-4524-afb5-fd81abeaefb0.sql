
CREATE TYPE game_kind AS ENUM ('parkour','skribble');

CREATE TABLE IF NOT EXISTS public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL,
  kind game_kind NOT NULL,
  started_by uuid NOT NULL,
  winner_id uuid,
  awarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view sessions in their chats"
ON public.game_sessions FOR SELECT TO authenticated
USING (public.is_chat_member(chat_id, auth.uid()));

CREATE POLICY "Members create sessions in their chats"
ON public.game_sessions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = started_by AND public.is_chat_member(chat_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.award_game_credits(_session_id uuid, _winner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _chat uuid;
  _starter uuid;
  _already boolean;
  _winner_reward int := 25;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT chat_id, started_by, awarded INTO _chat, _starter, _already
  FROM public.game_sessions WHERE id = _session_id FOR UPDATE;

  IF _chat IS NULL THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF _already THEN RAISE EXCEPTION 'Already awarded'; END IF;

  -- Only the starter (host) can finalize results
  IF _me <> _starter THEN RAISE EXCEPTION 'Only host can award'; END IF;

  -- Winner must be a chat member
  IF NOT public.is_chat_member(_chat, _winner_id) THEN
    RAISE EXCEPTION 'Winner is not a chat member';
  END IF;

  UPDATE public.game_sessions
  SET winner_id = _winner_id, awarded = true, ended_at = now()
  WHERE id = _session_id;

  INSERT INTO public.user_credits (user_id, balance)
  VALUES (_winner_id, _winner_reward)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = public.user_credits.balance + _winner_reward, updated_at = now();
END;
$$;
