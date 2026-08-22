import { useCallback, useEffect, useRef, useState } from "react";
import { Music, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Track = {
  url: string | null;
  title: string | null;
  playing: boolean;
  started_at: string | null;
};

export const GlobalMusic = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
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

  // Sync playback with the broadcast state
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    if (!track?.playing || !track.url) {
      el.pause();
      setBlocked(false);
      return;
    }

    if (el.src !== track.url) el.src = track.url;

    // Seek so late joiners hear roughly the same moment
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
  }, [track]);

  const enable = () => {
    const el = audioRef.current;
    if (!el) return;
    el.play().then(
      () => setBlocked(false),
      () => setBlocked(true),
    );
  };

  const toggleMute = () => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };

  const active = Boolean(track?.playing && track?.url);

  return (
    <>
      <audio ref={audioRef} loop className="hidden" />
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
