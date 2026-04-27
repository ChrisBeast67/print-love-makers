import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import { toast } from "sonner";

interface Props {
  sessionId: string;
  chatId: string;
  userId: string;
  username: string;
  isHost: boolean;
  onClose: () => void;
}

const W = 720;
const H = 280;
const COURSE_LEN = 4000;
const GRAVITY = 0.7;
const JUMP = -13;
const SPEED = 4;

interface Obstacle { x: number; w: number; h: number }

// Deterministic-ish course based on session id so all players get same layout
function buildCourse(seed: string): Obstacle[] {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) | 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1000) / 1000;
  };
  const out: Obstacle[] = [];
  let x = 600;
  while (x < COURSE_LEN - 200) {
    out.push({ x, w: 30 + Math.floor(rand() * 30), h: 30 + Math.floor(rand() * 40) });
    x += 220 + Math.floor(rand() * 220);
  }
  return out;
}

interface PlayerState { x: number; finished: boolean; finishTime: number | null; username: string }

export const Parkour = ({ sessionId, chatId, userId, username, isHost, onClose }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countdown, setCountdown] = useState<number | null>(3);
  const [running, setRunning] = useState(false);
  const [players, setPlayers] = useState<Record<string, PlayerState>>({});
  const [winner, setWinner] = useState<{ id: string; username: string } | null>(null);

  // local player physics
  const stateRef = useRef({
    x: 0, y: H - 60, vy: 0, onGround: true, finished: false, finishTime: null as number | null,
    startedAt: 0,
  });
  const obstaclesRef = useRef<Obstacle[]>(buildCourse(sessionId));
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Setup realtime
  useEffect(() => {
    const ch = supabase.channel(`parkour:${sessionId}`, { config: { broadcast: { self: true } } });
    channelRef.current = ch;

    setPlayers((p) => ({ ...p, [userId]: { x: 0, finished: false, finishTime: null, username } }));

    ch.on("broadcast", { event: "pos" }, ({ payload }) => {
      setPlayers((prev) => ({
        ...prev,
        [payload.id]: {
          x: payload.x,
          finished: payload.finished,
          finishTime: payload.finishTime,
          username: payload.username,
        },
      }));
    });

    ch.on("broadcast", { event: "winner" }, ({ payload }) => {
      setWinner({ id: payload.id, username: payload.username });
      setRunning(false);
    });

    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, userId, username]);

  // Countdown
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      setRunning(true);
      stateRef.current.startedAt = performance.now();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const broadcastPos = useCallback((finished = false, finishTime: number | null = null) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "pos",
      payload: { id: userId, username, x: stateRef.current.x, finished, finishTime },
    });
  }, [userId, username]);

  // Game loop + input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") && running) {
        if (stateRef.current.onGround && !stateRef.current.finished) {
          stateRef.current.vy = JUMP;
          stateRef.current.onGround = false;
        }
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let lastBroadcast = 0;

    const draw = (t: number) => {
      const s = stateRef.current;
      if (!s.finished) {
        s.x += SPEED;
        s.vy += GRAVITY;
        s.y += s.vy;
        if (s.y >= H - 60) { s.y = H - 60; s.vy = 0; s.onGround = true; }

        // collisions
        for (const o of obstaclesRef.current) {
          const px = 80; // player draws at fixed screen x
          const playerWorldX = s.x + px;
          if (
            playerWorldX + 20 > o.x &&
            playerWorldX < o.x + o.w &&
            s.y + 30 > H - 30 - o.h
          ) {
            s.x = Math.max(0, s.x - SPEED * 6); // knockback
          }
        }

        if (s.x >= COURSE_LEN) {
          s.finished = true;
          s.finishTime = (performance.now() - s.startedAt) / 1000;
          broadcastPos(true, s.finishTime);
          if (isHost) {
            // host declares winner immediately on first finish if no winner yet
            setWinner((w) => {
              if (w) return w;
              channelRef.current?.send({
                type: "broadcast", event: "winner",
                payload: { id: userId, username },
              });
              return { id: userId, username };
            });
          }
        }
      }

      // background
      ctx.fillStyle = "#0b1224";
      ctx.fillRect(0, 0, W, H);
      // grid
      ctx.strokeStyle = "rgba(80,140,255,0.08)";
      const offset = -((stateRef.current.x) % 40);
      for (let i = 0; i < 30; i++) {
        ctx.beginPath(); ctx.moveTo(i * 40 + offset, 0); ctx.lineTo(i * 40 + offset, H); ctx.stroke();
      }
      // ground
      ctx.fillStyle = "#1d3a8a";
      ctx.fillRect(0, H - 30, W, 30);
      // finish line indicator on minimap (top bar)
      const progress = Math.min(1, stateRef.current.x / COURSE_LEN);
      ctx.fillStyle = "#1e293b"; ctx.fillRect(10, 10, W - 20, 8);
      ctx.fillStyle = "#3b82f6"; ctx.fillRect(10, 10, (W - 20) * progress, 8);

      // obstacles (relative to camera)
      ctx.fillStyle = "#f87171";
      for (const o of obstaclesRef.current) {
        const sx = o.x - stateRef.current.x + 80;
        if (sx > -100 && sx < W + 50) {
          ctx.fillRect(sx, H - 30 - o.h, o.w, o.h);
        }
      }

      // other players (ghost markers on top progress bar)
      Object.entries(players).forEach(([id, p]) => {
        if (id === userId) return;
        const px = 10 + (W - 20) * Math.min(1, p.x / COURSE_LEN);
        ctx.fillStyle = p.finished ? "#fbbf24" : "#94a3b8";
        ctx.beginPath(); ctx.arc(px, 14, 5, 0, Math.PI * 2); ctx.fill();
      });

      // player
      ctx.fillStyle = "#60a5fa";
      ctx.fillRect(80, stateRef.current.y, 20, 30);
      ctx.fillStyle = "#fff";
      ctx.font = "12px sans-serif";
      ctx.fillText(username, 70, stateRef.current.y - 6);

      // broadcast every ~200ms
      if (t - lastBroadcast > 200) {
        broadcastPos(stateRef.current.finished, stateRef.current.finishTime);
        lastBroadcast = t;
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [running, players, userId, username, broadcastPos, isHost]);

  // Award credits: only host triggers, only once
  const awardedRef = useRef(false);
  useEffect(() => {
    if (!winner || !isHost || awardedRef.current) return;
    awardedRef.current = true;
    (async () => {
      const { error } = await supabase.rpc("award_game_credits", {
        _session_id: sessionId,
        _winner_id: winner.id,
      });
      if (error) toast.error(error.message);
      else toast.success(`${winner.username} won +25 credits!`);
    })();
  }, [winner, isHost, sessionId]);

  void chatId;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-sm text-muted-foreground">
        Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">Space</kbd> to jump. First to the finish wins.
      </div>
      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className="rounded-lg border border-primary/30" />
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center text-7xl font-bold gradient-text">
            {countdown === 0 ? "GO!" : countdown}
          </div>
        )}
        {winner && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur flex flex-col items-center justify-center gap-3 rounded-lg">
            <Trophy className="h-12 w-12 text-amber-500" />
            <div className="text-2xl font-bold">{winner.username} wins!</div>
            <div className="text-sm text-muted-foreground">+25 credits awarded</div>
            <Button onClick={onClose}>Close</Button>
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        Players: {Object.values(players).map((p) => p.username).join(", ")}
      </div>
    </div>
  );
};
