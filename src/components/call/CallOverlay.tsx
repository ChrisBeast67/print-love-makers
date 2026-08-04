import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCalls } from "@/hooks/useCalls";

const VideoTile = ({ stream, muted, label }: { stream: MediaStream; muted?: boolean; label: string }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const hasVideo = stream.getVideoTracks().some((t) => t.enabled);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
    ref.current.play().catch(() => undefined);
  }, [stream]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-muted/30 border border-border/50 aspect-video">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full object-cover ${hasVideo ? "" : "opacity-0"}`}
      />
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-lg font-semibold text-primary">
            {label.slice(0, 2).toUpperCase()}
          </div>
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded bg-background/70 px-2 py-0.5 text-xs">{label}</span>
    </div>
  );
};

/** Dedicated audio sink so remote voice is always heard, even with no video track. */
const RemoteAudio = ({ stream }: { stream: MediaStream }) => {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
    ref.current.volume = 1;
    ref.current.play().catch(() => undefined);
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline className="hidden" />;
};

/** Quiet ringback tone for the caller while the call is ringing. */
function useRingback(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    ctx.resume().catch(() => undefined);

    const beep = () => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 420;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.05);
      gain.gain.setValueAtTime(0.12, now + 0.9);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.05);
    };

    beep();
    const t = setInterval(beep, 3000);
    return () => {
      clearInterval(t);
      ctx.close().catch(() => undefined);
    };
  }, [active]);
}

export const CallOverlay = ({ nameFor }: { nameFor?: (userId: string) => string }) => {
  const { activeCall, localStream, remoteStreams, micOn, camOn, toggleMic, toggleCam, hangUp } = useCalls();
  const [seconds, setSeconds] = useState(0);
  useRingback(activeCall?.status === "ringing");

  useEffect(() => {
    if (!activeCall) { setSeconds(0); return; }
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [activeCall]);

  if (!activeCall) return null;

  const remotes = Object.entries(remoteStreams);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-background/95 backdrop-blur-xl p-4">
      <div className="mb-3 text-center">
        <div className="text-sm font-medium">
          {activeCall.status === "ringing" ? "Ringing…" : `In call · ${mm}:${ss}`}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {remotes.map(([id, stream]) => (
          <RemoteAudio key={`a-${id}`} stream={stream} />
        ))}
        <div className={`grid gap-3 ${remotes.length > 1 ? "grid-cols-2" : "grid-cols-1"} max-w-3xl mx-auto`}>
          {remotes.map(([id, stream]) => (
            <VideoTile key={id} stream={stream} label={nameFor?.(id) ?? "Peer"} />
          ))}
          {localStream && (
            <VideoTile stream={localStream} muted label="You" />
          )}
        </div>
        {remotes.length === 0 && (
          <p className="mt-4 text-center text-sm text-muted-foreground">Waiting for someone to join…</p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <Button variant={micOn ? "outline" : "secondary"} className="rounded-full h-12 w-12 p-0" onClick={toggleMic} aria-label="Toggle microphone">
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        <Button variant={camOn ? "outline" : "secondary"} className="rounded-full h-12 w-12 p-0" onClick={toggleCam} aria-label="Toggle camera">
          {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>
        <Button variant="destructive" className="rounded-full h-12 w-12 p-0" onClick={hangUp} aria-label="Hang up">
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};
