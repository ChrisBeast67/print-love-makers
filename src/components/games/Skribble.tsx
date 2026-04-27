import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy, Eraser } from "lucide-react";
import { toast } from "sonner";

interface Props {
  sessionId: string;
  chatId: string;
  userId: string;
  username: string;
  isHost: boolean;
  onClose: () => void;
}

const WORDS = [
  "rocket", "pizza", "robot", "octopus", "guitar", "castle", "dragon",
  "banana", "computer", "rainbow", "skateboard", "volcano", "wizard",
  "submarine", "lighthouse", "telescope", "cactus", "elephant",
];

const W = 720;
const H = 360;

interface ChatMsg { id: string; user: string; text: string; correct?: boolean }

export const Skribble = ({ sessionId, userId, username, isHost, onClose }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(isHost ? userId : null);
  const [drawerName, setDrawerName] = useState<string | null>(isHost ? username : null);
  const [word, setWord] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null); // only the drawer knows
  const [scores, setScores] = useState<Record<string, { username: string; score: number }>>({});
  const [guess, setGuess] = useState("");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [winner, setWinner] = useState<{ id: string; username: string } | null>(null);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);

  const isDrawer = drawerId === userId;

  // setup channel
  useEffect(() => {
    const ch = supabase.channel(`skribble:${sessionId}`, { config: { broadcast: { self: false } } });
    channelRef.current = ch;

    ch.on("broadcast", { event: "stroke" }, ({ payload }) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.strokeStyle = payload.color || "#1d3a8a";
      ctx.lineWidth = payload.size || 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(payload.from.x, payload.from.y);
      ctx.lineTo(payload.to.x, payload.to.y);
      ctx.stroke();
    });
    ch.on("broadcast", { event: "clear" }, () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, W, H);
    });
    ch.on("broadcast", { event: "round" }, ({ payload }) => {
      setDrawerId(payload.drawerId);
      setDrawerName(payload.drawerName);
      setWord(payload.maskedWord);
      setMsgs([]);
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, W, H);
      if (payload.drawerId !== userId) setSecret(null);
    });
    ch.on("broadcast", { event: "msg" }, ({ payload }) => {
      setMsgs((m) => [...m, payload]);
      if (payload.correct) {
        setScores((s) => {
          const cur = s[payload.userId] ?? { username: payload.user, score: 0 };
          return { ...s, [payload.userId]: { ...cur, score: cur.score + 10 } };
        });
      }
    });
    ch.on("broadcast", { event: "winner" }, ({ payload }) => {
      setWinner({ id: payload.id, username: payload.username });
    });

    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, userId]);

  // host picks word and starts the round
  const startRound = useCallback(() => {
    const w = WORDS[Math.floor(Math.random() * WORDS.length)];
    setSecret(w);
    setWord(w.replace(/[a-z]/gi, "_ "));
    setDrawerId(userId);
    setDrawerName(username);
    channelRef.current?.send({
      type: "broadcast", event: "round",
      payload: { drawerId: userId, drawerName: username, maskedWord: w.replace(/[a-z]/gi, "_ ") },
    });
    channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
  }, [userId, username]);

  useEffect(() => {
    if (isHost && !word) {
      const t = setTimeout(startRound, 500);
      return () => clearTimeout(t);
    }
  }, [isHost, word, startRound]);

  // draw handlers
  const getPt = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };
  const onDown = (e: React.PointerEvent) => {
    if (!isDrawer) return;
    drawingRef.current = true;
    lastPtRef.current = getPt(e);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!isDrawer || !drawingRef.current) return;
    const pt = getPt(e);
    const from = lastPtRef.current!;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = "#1d3a8a"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
    channelRef.current?.send({
      type: "broadcast", event: "stroke",
      payload: { from, to: pt, color: "#1d3a8a", size: 3 },
    });
    lastPtRef.current = pt;
  };
  const onUp = () => { drawingRef.current = false; lastPtRef.current = null; };

  const clearCanvas = () => {
    if (!isDrawer) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, W, H);
    channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
  };

  const submitGuess = () => {
    const g = guess.trim();
    if (!g) return;
    setGuess("");
    const correct = !!secret && g.toLowerCase() === secret.toLowerCase();
    // Drawer should never guess
    if (isDrawer) return;
    const msg: ChatMsg = {
      id: crypto.randomUUID(),
      user: username,
      text: correct ? `✓ guessed it!` : g,
      correct,
    };
    channelRef.current?.send({
      type: "broadcast", event: "msg",
      payload: { ...msg, userId },
    });
    setMsgs((m) => [...m, msg]);
    if (correct) {
      setScores((s) => {
        const cur = s[userId] ?? { username, score: 0 };
        return { ...s, [userId]: { ...cur, score: cur.score + 10 } };
      });
    }
  };

  const endGame = async () => {
    // Determine winner: highest score
    const entries = Object.entries(scores);
    if (entries.length === 0) {
      toast.error("No one scored yet");
      return;
    }
    entries.sort((a, b) => b[1].score - a[1].score);
    const [winId, winData] = entries[0];
    channelRef.current?.send({
      type: "broadcast", event: "winner",
      payload: { id: winId, username: winData.username },
    });
    setWinner({ id: winId, username: winData.username });
    const { error } = await supabase.rpc("award_game_credits", {
      _session_id: sessionId, _winner_id: winId,
    });
    if (error) toast.error(error.message);
    else toast.success(`${winData.username} won +25 credits!`);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[720px] text-sm">
        <div>
          Drawer: <span className="font-semibold">{drawerName ?? "—"}</span>
        </div>
        <div className="font-mono text-base tracking-widest">
          {isDrawer ? secret : word ?? ""}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        className={`rounded-lg border border-primary/30 bg-white touch-none ${isDrawer ? "cursor-crosshair" : "cursor-not-allowed"}`}
        style={{ maxWidth: "100%" }}
      />

      <div className="flex gap-2 w-full max-w-[720px]">
        {isDrawer ? (
          <>
            <Button variant="secondary" size="sm" onClick={clearCanvas}>
              <Eraser className="h-4 w-4 mr-1" /> Clear
            </Button>
            {isHost && (
              <Button variant="secondary" size="sm" onClick={startRound}>New word</Button>
            )}
          </>
        ) : (
          <>
            <Input
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitGuess()}
              placeholder="Type your guess…"
            />
            <Button onClick={submitGuess}>Guess</Button>
          </>
        )}
        {isHost && (
          <Button variant="default" size="sm" onClick={endGame} className="ml-auto">
            End & award winner
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-[720px]">
        <div className="rounded-lg border border-border p-3 max-h-32 overflow-auto text-sm space-y-1">
          {msgs.length === 0 ? (
            <div className="text-muted-foreground text-xs">Guesses appear here…</div>
          ) : msgs.map((m) => (
            <div key={m.id} className={m.correct ? "text-emerald-600 font-medium" : ""}>
              <span className="font-semibold">{m.user}:</span> {m.text}
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border p-3 text-sm">
          <div className="font-semibold mb-1">Scores</div>
          {Object.entries(scores).length === 0 ? (
            <div className="text-muted-foreground text-xs">No one scored yet</div>
          ) : (
            Object.entries(scores)
              .sort((a, b) => b[1].score - a[1].score)
              .map(([id, s]) => (
                <div key={id} className="flex justify-between">
                  <span>{s.username}</span>
                  <span className="font-mono">{s.score}</span>
                </div>
              ))
          )}
        </div>
      </div>

      {winner && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <Trophy className="h-10 w-10 text-amber-500" />
          <div className="text-xl font-bold">{winner.username} wins!</div>
          <div className="text-sm text-muted-foreground">+25 credits awarded</div>
          <Button onClick={onClose}>Close</Button>
        </div>
      )}
    </div>
  );
};
