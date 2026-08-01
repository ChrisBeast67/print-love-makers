# Live Voice & Video Calling in Chats

Add real-time calling to DMs and group chats: a call button in the chat header, an incoming-call ring on the other person's device, and live audio/video once answered.

## What the user sees

- Call buttons (phone + camera) in the chat header of every DM and group chat.
- Starting a call rings everyone else in that chat: a full-screen incoming-call card with the caller's name/avatar, a ringtone, Accept and Decline buttons. Ringing works anywhere in the app, not just on the chat page.
- Once accepted, a call overlay shows each participant's video tile (or avatar when camera is off), with controls: mute mic, toggle camera, hang up.
- If nobody answers within ~45 seconds, the call auto-cancels and shows "No answer".
- Group calls support up to 4 participants; joining beyond that shows "Call is full".
- A short system line is posted in the chat afterwards ("Call ended - 3:12").

## How it works

Calls use WebRTC directly between browsers (peer-to-peer), so audio/video never passes through the server. The server is only used for signalling - telling the other devices that a call started and exchanging connection details.

Note: peer-to-peer works for most home/mobile networks. On strict corporate or some mobile carrier networks a relay (TURN) server is needed; that is a paid third-party service and is not included here. If reliability turns out to be a problem, adding a TURN provider later is a small change.

## Technical details

Database (one migration):
- `calls` table: `id`, `chat_id`, `started_by`, `kind` ('audio' | 'video'), `status` ('ringing' | 'active' | 'ended'), `created_at`, `answered_at`, `ended_at`. GRANTs for `authenticated` + `service_role`, RLS scoped with existing `public.is_chat_member(chat_id, auth.uid())`.
- `call_participants` table: `call_id`, `user_id`, `state` ('invited' | 'joined' | 'declined' | 'left'), `joined_at`, `left_at`. Same GRANT/RLS pattern via the parent call's chat membership.
- Security-definer RPCs: `start_call(_chat_id, _kind)` (rejects if a ringing/active call already exists for the chat, caps participants at 4, inserts invited rows for all other chat members), `answer_call(_call_id)`, `decline_call(_call_id)`, `leave_call(_call_id)` (marks call ended when the last participant leaves).
- Add `calls` and `call_participants` to the `supabase_realtime` publication so ring/answer/hangup propagate instantly.

Signalling:
- A Supabase Realtime broadcast channel per call (`call:<id>`) carries SDP offers/answers and ICE candidates between peers. No new table for signalling traffic.
- Mesh topology: each participant opens an `RTCPeerConnection` to each other participant (fine at 4 people).

Frontend:
- `src/hooks/useCalls.tsx` - app-level provider mounted in `App.tsx` inside `AuthProvider`. Subscribes to realtime inserts on `call_participants` for the current user, exposes `incomingCall`, `activeCall`, `startCall`, `answer`, `decline`, `hangUp`.
- `src/hooks/useWebRTC.ts` - peer connection mesh, `getUserMedia`, track management, mute/camera toggles, cleanup on unmount.
- `src/components/call/IncomingCallDialog.tsx` - ringing UI, ringtone via WebAudio oscillator loop (no asset needed), auto-dismiss after 45s.
- `src/components/call/CallOverlay.tsx` - responsive video tile grid, local preview, mic/camera/hangup controls, connection status.
- `src/pages/Chat.tsx` - add Phone and Video buttons in the chat header wired to `startCall`.
- Translations for the new strings added to `src/hooks/useLanguage.tsx` (English, Chinese, Spanish).

Permissions and edge cases:
- Microphone/camera permission prompt handled with a clear error toast if denied or unavailable.
- Banned users and admin-only chats: calling follows the same membership checks; in admin-only groups only chat admins may start a call.
- Hanging up, tab close, and navigation all release media tracks and mark the participant as left.
