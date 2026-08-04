# Call notification check + much louder ringing

## Verification result (already checked)

The database side is working correctly:

- `start_call` inserts the call, adds the caller as `joined`, and adds every **other** chat member as `invited` in one statement. The earlier "more target columns than expressions" bug is gone.
- Real call records confirm it: the most recent calls each have 2 participant rows (caller + invitee).
- Live updates are enabled for both the calls and call-participants tables, and the view rules let every chat member see them, so each invited person's device does get notified.

One real issue found: an old call from Aug 3 is still stuck in "ringing" in one chat. `start_call` only auto-clears stale ringing calls older than 60 seconds, which does cover it, so no code change is needed — but the plan closes the loop by ending that leftover row so the chat isn't blocked.

## What changes

1. Clear the stuck "ringing" call record left over from testing.
2. Make the incoming ring far louder and more attention-grabbing.
3. Add a quieter ringback tone for the caller so they hear the call is out.

## Louder ringtone details

In `src/components/call/IncomingCallDialog.tsx`, replace the single quiet sine beep with:

- Peak gain raised from 0.15 to ~0.9, pushed through a `DynamicsCompressor` so it stays loud without clipping.
- Two stacked oscillators (440 Hz + 880 Hz, square/sawtooth blend) for a piercing classic-phone timbre instead of a soft tone.
- Classic double-ring pattern repeating every 1.5s instead of 2s.
- `ctx.resume()` on mount plus a one-time pointer/keydown listener to unlock audio if the browser suspended the audio context.
- Device vibration alongside the tone (`navigator.vibrate` pattern) where supported.
- Ringtone stops on answer, decline, timeout, and unmount (existing cleanup extended to the new nodes).

Caller-side ringback: a small low-volume tone loop in `CallOverlay.tsx` while `activeCall.status === "ringing"`, stopping once the call goes active.

Note: browsers block audio until the user has interacted with the page at least once in that tab. The unlock listener covers most cases, but a brand-new tab that has never been clicked may stay silent until the first click — that is a browser rule, not something the app can override.
