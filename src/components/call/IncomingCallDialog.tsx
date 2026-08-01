import { useEffect, useRef } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCalls } from "@/hooks/useCalls";

/** Simple looping ringtone using WebAudio (no asset required). */
function useRingtone(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    ctxRef.current = ctx;

    const beep = () => {
      const now = ctx.currentTime;
      [0, 0.4].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 480;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.15, now + offset + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.35);
      });
    };

    beep();
    timerRef.current = setInterval(beep, 2000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      ctx.close().catch(() => undefined);
      ctxRef.current = null;
    };
  }, [active]);
}

export const IncomingCallDialog = ({ callerName }: { callerName?: string }) => {
  const { incomingCall, answer, decline } = useCalls();
  useRingtone(!!incomingCall);

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-md p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 animate-pulse">
          {incomingCall.kind === "video"
            ? <Video className="h-9 w-9 text-primary" />
            : <Phone className="h-9 w-9 text-primary" />}
        </div>
        <h2 className="text-lg font-semibold">{callerName ?? "Someone"} is calling</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Incoming {incomingCall.kind === "video" ? "video" : "voice"} call
        </p>
        <div className="mt-6 flex items-center justify-center gap-4">
          <Button size="lg" variant="destructive" className="rounded-full h-14 w-14 p-0" onClick={decline} aria-label="Decline call">
            <PhoneOff className="h-6 w-6" />
          </Button>
          <Button size="lg" className="rounded-full h-14 w-14 p-0 bg-emerald-600 hover:bg-emerald-500" onClick={answer} aria-label="Accept call">
            <Phone className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};
