import { useEffect, useRef } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCalls } from "@/hooks/useCalls";

/** Loud looping ringtone using WebAudio (no asset required). */
function useRingtone(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    ctxRef.current = ctx;

    // Compressor keeps the loud output from clipping.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 12;
    const master = ctx.createGain();
    master.gain.value = 1;
    comp.connect(master).connect(ctx.destination);

    const unlock = () => { ctx.resume().catch(() => undefined); };
    unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    const tone = (start: number, dur: number) => {
      [
        { f: 440, type: "square" as OscillatorType, g: 0.9 },
        { f: 880, type: "sawtooth" as OscillatorType, g: 0.45 },
      ].forEach(({ f, type, g }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(g, start + 0.02);
        gain.gain.setValueAtTime(g, start + dur - 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(gain).connect(comp);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      });
    };

    const ring = () => {
      const now = ctx.currentTime;
      tone(now, 0.4);
      tone(now + 0.5, 0.4);
      navigator.vibrate?.([400, 100, 400, 600]);
    };

    ring();
    timerRef.current = setInterval(ring, 1500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      navigator.vibrate?.(0);
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
