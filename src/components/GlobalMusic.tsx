import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Music, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Track = {
  url: string | null;
  title: string | null;
  playing: boolean;
  started_at: string | null;
};

// Extract a YouTube video id from watch/short/youtu.be/embed links
const youtubeId = (url: string): string | null => {
  const patterns = [
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};

export const GlobalMusic = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(false);

  const fetchTrack = useCallback(async () => {
    const { data } = await supabase
      .from("global_music")
      .select("url,title,playing,started_at")
      .eq("id", 1)
      .maybeSingle();
    setTrack((data as Track) ?? null);
  }, []);

  useEffect(() => {
    fetchTrack();
    const channel = supabase
      .channel("global-music")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "global_music" },
        (payload) => setTrack(payload.new as Track),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTrack]);

  const ytId = track?.url ? youtubeId(track.url) : null;
  const active = Boolean(track?.playing && track?.url);

  const startOffset = useMemo(() => {
    if (!track?.started_at) return 0;
    const s = Math.floor((Date.now() - new Date(track.started_at).getTime()) / 1000);
    return s > 1 && Number.isFinite(s) ? s : 0;
  }, [track?.started_at]);

  // YouTube: start muted (autoplay policy), user taps to unmute
  useEffect(() => {
    if (active && ytId) {
      setMuted(true);
      setBlocked(true);
    }
  }, [active, ytId]);

  const ytCommand = (func: string, args: unknown[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*",
    );
  };

  // Sync playback with the broadcast state (direct audio files)
  useEffect(() => {
    const el = audioRef.current;
    if (!el || ytId) return;

    if (!track?.playing || !track.url) {
      el.pause();
      setBlocked(false);
      return;
    }

    if (el.src !== track.url) el.src = track.url;

    if (track.started_at) {
      const offset = (Date.now() - new Date(track.started_at).getTime()) / 1000;
      if (offset > 1 && Number.isFinite(offset)) {
        el.currentTime = offset;
      }
    }

    el.volume = 0.5;
    el.play().then(
      () => setBlocked(false),
      () => setBlocked(true),
    );
  }, [track, ytId]);

  const enable = () => {
    if (ytId) {
      ytCommand("playVideo");
      ytCommand("unMute");
      ytCommand("setVolume", [60]);
      setMuted(false);
      setBlocked(false);
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    el.play().then(
      () => setBlocked(false),
      () => setBlocked(true),
    );
  };

  const toggleMute = () => {
    if (ytId) {
      const next = !muted;
      ytCommand(next ? "mute" : "unMute");
      setMuted(next);
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };

  return (
    <>
      {!ytId && <audio ref={audioRef} loop className="hidden" />}
      {active && ytId && (
        <iframe
          ref={iframeRef}
          title="Global music"
          allow="autoplay"
          className="pointer-events-none fixed -left-[9999px] top-0 h-[1px] w-[1px] opacity-0"
          src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${ytId}&start=${startOffset}&enablejsapi=1&playsinline=1`}
        />
      )}
      {active && (
        <div className="fixed bottom-4 left-4 z-[80] flex items-center gap-2 rounded-full border border-border/60 bg-background/90 px-3 py-2 text-xs shadow-lg backdrop-blur-xl">
          <Music className="h-4 w-4 animate-pulse text-primary" />
          <span className="max-w-[10rem] truncate">{track?.title || "Now playing"}</span>
          {blocked ? (
            <button
              onClick={enable}
              className="rounded-full bg-primary px-2 py-1 text-primary-foreground"
            >
              Tap to listen
            </button>
          ) : (
            <button onClick={toggleMute} aria-label="Toggle music" className="text-muted-foreground hover:text-foreground">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          )}
        </div>
      )}
    </>
  );
};
